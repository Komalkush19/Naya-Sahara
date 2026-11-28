/**
 * /api/admin/notices — Platform Administrator notice moderation endpoint.
 *
 * GET  /api/admin/notices               — List all notices (all statuses, all orgs)
 * POST /api/admin/notices               — Execute moderation action on a notice
 *
 * Actions: approve, reject, publish, unpublish, archive, restore, delete, create_gov
 *
 * Security:
 *  - All endpoints require a verified platform_admin token.
 *  - All moderation actions are logged to adminAuditLogs.
 *  - Admin cannot approve/reject notices on behalf of an NGO (self-moderation is irrelevant
 *    since admins do not own org notices).
 */

import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { extractBearerToken, sendJson, parseJsonBody } from "../_lib/authUtils.js";

const ALLOWED_GOV_CATEGORIES = ["General", "Policy", "Health", "Legal", "Financial", "Employment"];
const ALLOWED_NGO_CATEGORIES = ["Training", "Job", "Aid", "Workshop", "Education", "Rehabilitation", "General"];

/**
 * Verify bearer token and confirm platform_admin role + active staffProfile.
 */
async function verifyPlatformAdmin(req, auth, db) {
  const token = extractBearerToken(req);
  if (!token) {
    return { authorized: false, error: "Missing or invalid authorization token", statusCode: 401 };
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (err) {
    return { authorized: false, error: err.message || "Invalid or expired authorization token", statusCode: 401 };
  }

  if (decoded.role !== "platform_admin") {
    return { authorized: false, error: "Access restricted to platform administrators", statusCode: 403 };
  }

  const staffSnap = await db.collection("staffProfiles").doc(decoded.uid).get();
  if (!staffSnap.exists) {
    return { authorized: false, error: "Administrator profile not found", statusCode: 403 };
  }
  const staffData = staffSnap.data();
  if (staffData.status !== "active" || staffData.role !== "platform_admin") {
    return { authorized: false, error: "Administrator account is inactive or suspended", statusCode: 403 };
  }

  return { authorized: true, adminUid: decoded.uid };
}

function sanitizeGovNoticeInput(body) {
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
    category: ALLOWED_GOV_CATEGORIES.concat(ALLOWED_NGO_CATEGORIES).includes(category) ? category : "General",
    sourceType: "government",
    source: "gov",
    location: typeof location === "string" ? location.trim().slice(0, 200) : "Nepal",
    eligibility: typeof eligibility === "string" ? eligibility.trim().slice(0, 500) : "",
    deadline: typeof deadline === "string" ? deadline.trim().slice(0, 100) : "",
    sourceAuthority: typeof sourceAuthority === "string" ? sourceAuthority.trim().slice(0, 300) : "Government of Nepal",
    sourceUrl: typeof sourceUrl === "string" && sourceUrl.trim().startsWith("http") ? sourceUrl.trim().slice(0, 2000) : null,
  };
}

function docToAdminNotice(doc) {
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
    reviewedBy: d.reviewedBy || null,
    reviewedAt: d.reviewedAt?.toMillis ? d.reviewedAt.toMillis() : null,
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

export async function handleAdminNotices(req, res, { db = adminDb, auth = adminAuth } = {}) {
  const authResult = await verifyPlatformAdmin(req, auth, db);
  if (!authResult.authorized) {
    return sendJson(res, authResult.statusCode || 403, { ok: false, error: authResult.error });
  }
  const { adminUid } = authResult;

  // ─── GET — List all notices across all statuses ─────────────────────────
  if (req.method === "GET") {
    try {
      const snap = await db.collection("notices").orderBy("createdAt", "desc").get();
      const notices = snap.docs.map((doc) => docToAdminNotice(doc));
      return sendJson(res, 200, { ok: true, notices });
    } catch {
      // Fallback without orderBy if index not set
      try {
        const snap = await db.collection("notices").get();
        const notices = snap.docs
          .map((doc) => docToAdminNotice(doc))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return sendJson(res, 200, { ok: true, notices });
      } catch {
        return sendJson(res, 500, { ok: false, error: "Failed to retrieve notice list" });
      }
    }
  }

  // ─── POST — Moderation actions + government notice creation ─────────────
  if (req.method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });

    const { action } = body;
    const ALLOWED_ACTIONS = ["approve", "reject", "publish", "unpublish", "archive", "restore", "delete", "create_gov", "update_gov", "update"];
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return sendJson(res, 400, { ok: false, error: `action must be one of: ${ALLOWED_ACTIONS.join(", ")}` });
    }

    // ── Create government notice ──────────────────────────────────────────
    if (action === "create_gov") {
      const { asDraft } = body;
      const fields = sanitizeGovNoticeInput(body);

      if (!fields.title) return sendJson(res, 400, { ok: false, error: "Notice title is required" });
      if (!fields.original) return sendJson(res, 400, { ok: false, error: "Original notice text is required" });

      const publicationStatus = asDraft ? "draft" : "published";
      const reviewStatus = "approved";
      const noticeId = `govnotice_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const now = FieldValue.serverTimestamp();

      const doc = {
        ...fields,
        orgId: null,
        orgName: fields.sourceAuthority || "Government of Nepal",
        publicationStatus,
        reviewStatus,
        status: "approved",
        rejectionReason: "",
        createdBy: adminUid,
        reviewedBy: adminUid,
        reviewedAt: now,
        createdAt: now,
        updatedAt: now,
        publishedAt: asDraft ? null : now,
        aiGenerated: Boolean(fields.nepaliTranslation || fields.englishTranslation || fields.simplifiedSummary),
      };

      try {
        await db.collection("notices").doc(noticeId).set(doc);

        // Audit log
        const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        await db.collection("adminAuditLogs").doc(logId).set({
          logId,
          action: "GOV_NOTICE_CREATED",
          targetType: "notice",
          targetId: noticeId,
          actorUid: adminUid,
          actorRole: "platform_admin",
          details: { title: fields.title, publicationStatus },
          timestamp: now,
        });

        return sendJson(res, 201, { ok: true, noticeId, publicationStatus, reviewStatus });
      } catch {
        return sendJson(res, 500, { ok: false, error: "Failed to create government notice" });
      }
    }

    // ── Update government notice ──────────────────────────────────────────
    if (action === "update_gov") {
      const { noticeId, asDraft } = body;
      if (!noticeId) return sendJson(res, 400, { ok: false, error: "noticeId is required" });

      const noticeRef = db.collection("notices").doc(noticeId.trim());
      const noticeSnap = await noticeRef.get();
      if (!noticeSnap.exists) return sendJson(res, 404, { ok: false, error: "Notice not found" });

      const existing = noticeSnap.data();
      if (existing.sourceType !== "government" && existing.source !== "gov") {
        return sendJson(res, 400, { ok: false, error: "Only government notices can be updated with this action" });
      }

      const fields = sanitizeGovNoticeInput(body);
      if (!fields.title) return sendJson(res, 400, { ok: false, error: "Notice title is required" });
      if (!fields.original) return sendJson(res, 400, { ok: false, error: "Original notice text is required" });

      const now = FieldValue.serverTimestamp();
      const publicationStatus = asDraft ? "draft" : "published";

      try {
        await noticeRef.update({
          ...fields,
          publicationStatus,
          reviewStatus: "approved",
          status: "approved",
          updatedAt: now,
          reviewedBy: adminUid,
          aiGenerated: Boolean(fields.nepaliTranslation || fields.englishTranslation || fields.simplifiedSummary),
          ...(asDraft ? {} : { publishedAt: existing.publishedAt || now }),
        });

        return sendJson(res, 200, { ok: true, noticeId, publicationStatus });
      } catch {
        return sendJson(res, 500, { ok: false, error: "Failed to update government notice" });
      }
    }

    // ── All other actions require a noticeId ──────────────────────────────
    const { noticeId, rejectionReason } = body;
    if (!noticeId || typeof noticeId !== "string") {
      return sendJson(res, 400, { ok: false, error: "noticeId is required" });
    }

    if (action === "reject") {
      if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length < 5) {
        return sendJson(res, 400, { ok: false, error: "A mandatory rejection reason of at least 5 characters is required" });
      }
    }

    const noticeRef = db.collection("notices").doc(noticeId.trim());
    const noticeSnap = await noticeRef.get();
    if (!noticeSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Notice not found" });
    }

    const now = FieldValue.serverTimestamp();
    const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const existing = noticeSnap.data();

    let updatePayload = { updatedAt: now, reviewedBy: adminUid, reviewedAt: now };
    let auditAction;
    let auditDetails = { title: existing.title, orgId: existing.orgId };

    switch (action) {
      case "approve":
        updatePayload = {
          ...updatePayload,
          reviewStatus: "approved",
          publicationStatus: body.publish === false ? "unpublished" : "published",
          status: "approved",
          publishedAt: body.publish === false ? null : now,
          rejectionReason: "",
        };
        auditAction = "NOTICE_APPROVED";
        break;

      case "update": {
        const fields = sanitizeGovNoticeInput({ ...existing, ...body });
        updatePayload = {
          ...updatePayload,
          ...fields,
        };
        if (body.publicationStatus) updatePayload.publicationStatus = body.publicationStatus;
        if (body.reviewStatus) updatePayload.reviewStatus = body.reviewStatus;
        if (body.status) updatePayload.status = body.status;
        auditAction = "NOTICE_UPDATED";
        break;
      }

      case "reject":
        updatePayload = {
          ...updatePayload,
          reviewStatus: "rejected",
          publicationStatus: "unpublished",
          status: "rejected",
          rejectionReason: rejectionReason.trim(),
        };
        auditAction = "NOTICE_REJECTED";
        auditDetails.rejectionReason = rejectionReason.trim();
        break;

      case "publish":
        // Can only publish approved notices
        if (existing.reviewStatus !== "approved") {
          return sendJson(res, 400, { ok: false, error: "Only approved notices can be published" });
        }
        updatePayload = {
          ...updatePayload,
          publicationStatus: "published",
          status: "approved",
          publishedAt: now,
        };
        auditAction = "NOTICE_PUBLISHED";
        break;

      case "unpublish":
        updatePayload = {
          ...updatePayload,
          publicationStatus: "unpublished",
          status: "unpublished",
        };
        auditAction = "NOTICE_UNPUBLISHED";
        break;

      case "archive":
        updatePayload = {
          ...updatePayload,
          publicationStatus: "archived",
          status: "archived",
        };
        auditAction = "NOTICE_ARCHIVED";
        break;

      case "restore":
        // Restore returns to unpublished/approved — never auto-publishes
        updatePayload = {
          ...updatePayload,
          publicationStatus: "unpublished",
          status: existing.reviewStatus === "approved" ? "approved" : "pending_review",
          publishedAt: null,
        };
        auditAction = "NOTICE_RESTORED";
        break;

      case "delete":
        try {
          await noticeRef.delete();
          await db.collection("adminAuditLogs").doc(logId).set({
            logId,
            action: "NOTICE_DELETED",
            targetType: "notice",
            targetId: noticeId,
            actorUid: adminUid,
            actorRole: "platform_admin",
            details: auditDetails,
            timestamp: now,
          });
          return sendJson(res, 200, { ok: true, noticeId });
        } catch {
          return sendJson(res, 500, { ok: false, error: "Failed to delete notice" });
        }
    }

    try {
      await noticeRef.update(updatePayload);

      await db.collection("adminAuditLogs").doc(logId).set({
        logId,
        action: auditAction,
        targetType: "notice",
        targetId: noticeId,
        actorUid: adminUid,
        actorRole: "platform_admin",
        details: auditDetails,
        timestamp: now,
      });

      return sendJson(res, 200, {
        ok: true,
        noticeId,
        publicationStatus: updatePayload.publicationStatus,
        reviewStatus: updatePayload.reviewStatus,
        status: updatePayload.status,
      });
    } catch {
      return sendJson(res, 500, { ok: false, error: `Failed to execute action: ${action}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

export default async function handler(req, res) {
  return handleAdminNotices(req, res);
}
