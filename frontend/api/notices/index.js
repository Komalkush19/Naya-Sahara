/**
 * /api/notices — Unified Notice CRUD endpoint.
 *
 * GET  /api/notices               — Public board (approved+published only, no auth required)
 * GET  /api/notices?scope=mine    — NGO staff: own org notices (requires ngo_admin token)
 * POST /api/notices               — NGO staff: create notice (draft or submit for review)
 * PUT  /api/notices               — NGO staff: update own notice (draft/resubmit; cannot self-approve)
 * DELETE /api/notices             — NGO staff: delete own notice (draft or rejected only)
 */

import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { extractBearerToken, sendJson, parseJsonBody } from "../_lib/authUtils.js";

const ALLOWED_NGO_CATEGORIES = [
  "Training",
  "Job",
  "Aid",
  "Workshop",
  "Education",
  "Rehabilitation",
  "General",
];

/**
 * Verify bearer token and return decoded claims. Returns null on failure.
 */
async function verifyToken(req, auth) {
  const token = extractBearerToken(req);
  if (!token) return null;
  try {
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

/**
 * Sanitize a notice body received from the frontend.
 * Strips any fields an NGO should not be able to set server-side.
 */
function sanitizeNoticeInput(body) {
  const {
    title,
    original,
    originalLanguage,
    nepaliTranslation,
    englishTranslation,
    simplifiedSummary,
    translation,
    category,
    location,
    eligibility,
    deadline,
    sourceAuthority,
    sourceUrl,
  } = body;

  return {
    title: (typeof title === "string" ? title.trim() : "").slice(0, 300),
    original: (typeof original === "string" ? original.trim() : "").slice(0, 10000),
    originalLanguage: ["ne", "en"].includes(originalLanguage) ? originalLanguage : "ne",
    nepaliTranslation: typeof nepaliTranslation === "string" ? nepaliTranslation.trim().slice(0, 5000) : "",
    englishTranslation: typeof englishTranslation === "string" ? englishTranslation.trim().slice(0, 5000) : "",
    simplifiedSummary: typeof simplifiedSummary === "string" ? simplifiedSummary.trim().slice(0, 1000) : "",
    translation: typeof translation === "string" ? translation.trim().slice(0, 5000) : "",
    category: ALLOWED_NGO_CATEGORIES.includes(category) ? category : "General",
    // NGO notices are always source=ngo; only admin can set gov
    sourceType: "ngo",
    source: "ngo",
    location: typeof location === "string" ? location.trim().slice(0, 200) : "",
    eligibility: typeof eligibility === "string" ? eligibility.trim().slice(0, 500) : "",
    deadline: typeof deadline === "string" ? deadline.trim().slice(0, 100) : "",
    sourceAuthority: typeof sourceAuthority === "string" ? sourceAuthority.trim().slice(0, 300) : "",
    sourceUrl: typeof sourceUrl === "string" && sourceUrl.trim().startsWith("http") ? sourceUrl.trim().slice(0, 2000) : null,
  };
}

export async function handleNotices(req, res, { db = adminDb, auth = adminAuth } = {}) {
  // ─── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url, `http://localhost`);
    const scope = url.searchParams.get("scope");

    // scope=mine — NGO staff reading their own org's notices
    if (scope === "mine") {
      const decoded = await verifyToken(req, auth);
      if (!decoded) {
        return sendJson(res, 401, { ok: false, error: "Authentication required" });
      }
      if (decoded.role !== "ngo_admin") {
        return sendJson(res, 403, { ok: false, error: "Only NGO staff can access this endpoint" });
      }
      const orgId = decoded.orgId;
      if (!orgId) {
        return sendJson(res, 403, { ok: false, error: "No organization associated with this account" });
      }

      try {
        const snap = await db
          .collection("notices")
          .where("orgId", "==", orgId)
          .orderBy("createdAt", "desc")
          .get();

        const notices = snap.docs.map((doc) => docToNotice(doc));
        return sendJson(res, 200, { ok: true, notices });
      } catch {
        return sendJson(res, 500, { ok: false, error: "Failed to fetch organization notices" });
      }
    }

    // Public board — approved + published only, no auth required
    try {
      const snap = await db
        .collection("notices")
        .where("publicationStatus", "==", "published")
        .where("reviewStatus", "==", "approved")
        .orderBy("publishedAt", "desc")
        .get();

      const notices = snap.docs.map((doc) => docToNotice(doc));
      return sendJson(res, 200, { ok: true, notices });
    } catch {
      // Fallback: index may not exist yet — query without orderBy
      try {
        const snap = await db
          .collection("notices")
          .where("publicationStatus", "==", "published")
          .where("reviewStatus", "==", "approved")
          .get();
        const notices = snap.docs
          .map((doc) => docToNotice(doc))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return sendJson(res, 200, { ok: true, notices });
      } catch {
        return sendJson(res, 500, { ok: false, error: "Failed to fetch public notices" });
      }
    }
  }

  // ─── POST — Create notice ─────────────────────────────────────────────────
  if (req.method === "POST") {
    const decoded = await verifyToken(req, auth);
    if (!decoded) {
      return sendJson(res, 401, { ok: false, error: "Authentication required" });
    }
    if (decoded.role !== "ngo_admin") {
      return sendJson(res, 403, { ok: false, error: "Only NGO staff can create notices" });
    }
    const orgId = decoded.orgId;
    if (!orgId) {
      return sendJson(res, 403, { ok: false, error: "No organization associated with this account" });
    }

    // Verify org is verified/active
    const orgSnap = await db.collection("organizations").doc(orgId).get();
    if (!orgSnap.exists || orgSnap.data().verificationStatus !== "verified") {
      return sendJson(res, 403, { ok: false, error: "Only verified organizations can publish notices" });
    }

    const body = await parseJsonBody(req);
    if (!body) return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });

    const { asDraft } = body;
    const fields = sanitizeNoticeInput(body);

    if (!fields.title) return sendJson(res, 400, { ok: false, error: "Notice title is required" });
    if (!fields.original) return sendJson(res, 400, { ok: false, error: "Notice original text is required" });

    const publicationStatus = asDraft ? "draft" : "unpublished";
    const reviewStatus = asDraft ? "draft" : "pending_review";

    const noticeId = `notice_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const now = FieldValue.serverTimestamp();

    const doc = {
      ...fields,
      orgId,
      orgName: orgSnap.data().name || "",
      publicationStatus,
      reviewStatus,
      status: asDraft ? "draft" : "pending_review",
      rejectionReason: "",
      createdBy: decoded.uid,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };

    try {
      await db.collection("notices").doc(noticeId).set(doc);
      return sendJson(res, 201, { ok: true, noticeId, publicationStatus, reviewStatus });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to create notice" });
    }
  }

  // ─── PUT — Update own notice ──────────────────────────────────────────────
  if (req.method === "PUT") {
    const decoded = await verifyToken(req, auth);
    if (!decoded) {
      return sendJson(res, 401, { ok: false, error: "Authentication required" });
    }
    if (decoded.role !== "ngo_admin") {
      return sendJson(res, 403, { ok: false, error: "Only NGO staff can update notices" });
    }
    const orgId = decoded.orgId;

    const body = await parseJsonBody(req);
    if (!body) return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });

    const { noticeId, asDraft } = body;
    if (!noticeId || typeof noticeId !== "string") {
      return sendJson(res, 400, { ok: false, error: "noticeId is required" });
    }

    const noticeRef = db.collection("notices").doc(noticeId.trim());
    const noticeSnap = await noticeRef.get();
    if (!noticeSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Notice not found" });
    }

    const existing = noticeSnap.data();
    // Ownership check: NGO can only edit their own notices
    if (existing.orgId !== orgId) {
      return sendJson(res, 403, { ok: false, error: "You can only edit your organization's own notices" });
    }

    // Cannot edit approved+published notices without returning to review
    const fields = sanitizeNoticeInput({ ...existing, ...body });
    if (!fields.title) return sendJson(res, 400, { ok: false, error: "Notice title is required" });
    if (!fields.original) return sendJson(res, 400, { ok: false, error: "Notice original text is required" });

    // If previously approved, editing returns it to review unless archiving
    const isArchiving = body.publicationStatus === "archived";
    const wasApproved = existing.reviewStatus === "approved";
    const publicationStatus = isArchiving ? "archived" : asDraft ? "draft" : "unpublished";
    const reviewStatus = isArchiving ? existing.reviewStatus : asDraft ? "draft" : "pending_review";

    try {
      await noticeRef.update({
        ...fields,
        publicationStatus,
        reviewStatus,
        status: isArchiving ? "archived" : asDraft ? "draft" : "pending_review",
        rejectionReason: "",
        updatedAt: FieldValue.serverTimestamp(),
        // Clear publishedAt if returning to review
        ...(wasApproved && !isArchiving ? { publishedAt: null } : {}),
      });
      return sendJson(res, 200, { ok: true, noticeId, publicationStatus, reviewStatus });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to update notice" });
    }
  }

  // ─── DELETE — Delete own notice (draft or rejected only) ─────────────────
  if (req.method === "DELETE") {
    const decoded = await verifyToken(req, auth);
    if (!decoded) {
      return sendJson(res, 401, { ok: false, error: "Authentication required" });
    }
    if (decoded.role !== "ngo_admin") {
      return sendJson(res, 403, { ok: false, error: "Only NGO staff can delete notices" });
    }
    const orgId = decoded.orgId;

    const body = await parseJsonBody(req);
    if (!body) return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });

    const { noticeId } = body;
    if (!noticeId || typeof noticeId !== "string") {
      return sendJson(res, 400, { ok: false, error: "noticeId is required" });
    }

    const noticeRef = db.collection("notices").doc(noticeId.trim());
    const noticeSnap = await noticeRef.get();
    if (!noticeSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Notice not found" });
    }

    const existing = noticeSnap.data();
    if (existing.orgId !== orgId) {
      return sendJson(res, 403, { ok: false, error: "You can only delete your organization's own notices" });
    }

    try {
      await noticeRef.delete();
      return sendJson(res, 200, { ok: true, noticeId });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to delete notice" });
    }
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

/**
 * Convert a Firestore doc snapshot to a notice object safe for frontend.
 * Never exposes internal admin or org-private fields to public GET.
 */
function docToNotice(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    title: d.title || "",
    original: d.original || "",
    originalLanguage: d.originalLanguage || "ne",
    nepaliTranslation: d.nepaliTranslation || d.translation || "",
    englishTranslation: d.englishTranslation || "",
    simplifiedSummary: d.simplifiedSummary || "",
    translation: d.translation || d.nepaliTranslation || "",
    category: d.category || "General",
    sourceType: d.sourceType || "ngo",
    source: d.source || "ngo",
    location: d.location || "",
    eligibility: d.eligibility || "",
    deadline: d.deadline || "",
    sourceAuthority: d.sourceAuthority || d.orgName || "",
    sourceUrl: d.sourceUrl || null,
    orgId: d.orgId || "",
    orgName: d.orgName || "",
    publicationStatus: d.publicationStatus || "draft",
    reviewStatus: d.reviewStatus || "pending_review",
    status: d.status || d.reviewStatus || "draft",
    rejectionReason: d.rejectionReason || "",
    aiGenerated: d.aiGenerated || false,
    createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : null,
    updatedAt: d.updatedAt?.toMillis ? d.updatedAt.toMillis() : null,
    publishedAt: d.publishedAt?.toMillis ? d.publishedAt.toMillis() : null,
    publicationDate: d.publishedAt
      ? new Date(d.publishedAt.toMillis ? d.publishedAt.toMillis() : d.publishedAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })
      : null,
    ingestionDate: d.createdAt
      ? new Date(d.createdAt.toMillis ? d.createdAt.toMillis() : d.createdAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })
      : null,
  };
}

export default async function handler(req, res) {
  return handleNotices(req, res);
}
