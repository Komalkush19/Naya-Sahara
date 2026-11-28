/**
 * /api/cases/index.js — Unified Case Management and Progress Notes endpoint.
 *
 * Routes handled:
 *   /api/cases (or path !== 'notes'):
 *     GET  /api/cases               — List cases (by org, member, or admin).
 *     POST /api/cases               — NGO staff creates a case.
 *     PUT  /api/cases               — NGO staff updates case fields.
 *   /api/cases/notes (or ?sub=notes):
 *     GET  /api/cases/notes?caseId=... — Retrieve progress notes.
 *     POST /api/cases/notes            — NGO staff adds progress note.
 */

import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { extractBearerToken, sendJson, parseJsonBody } from "../_lib/authUtils.js";

const VALID_STATUSES = ["open", "in_progress", "on_hold", "resolved", "closed"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_CATEGORIES = [
  "Reintegration",
  "Livelihood & Skills",
  "Legal Support",
  "Health & Wellbeing",
  "Emergency Shelter",
  "Family Counseling",
  "General Support",
];

async function verifyToken(req, auth) {
  const token = extractBearerToken(req);
  if (!token) return null;
  try {
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

// ─── Sub-handler for Notes ───────────────────────────────────────────────────
export async function handleCaseNotes(req, res, { db = adminDb, auth = adminAuth } = {}) {
  const decoded = await verifyToken(req, auth);
  if (!decoded) {
    return sendJson(res, 401, { ok: false, error: "Authentication required" });
  }

  const { role, uid, orgId } = decoded;

  // ─── GET /api/cases/notes?caseId=... ────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url, `http://localhost`);
    const caseId = url.searchParams.get("caseId");

    if (!caseId || typeof caseId !== "string" || !caseId.trim()) {
      return sendJson(res, 400, { ok: false, error: "caseId is required" });
    }

    const caseSnap = await db.collection("cases").doc(caseId.trim()).get();
    if (!caseSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Case not found" });
    }

    const caseData = caseSnap.data();

    // Authorization check
    if (role === "ngo_admin") {
      if (!orgId || caseData.orgId !== orgId) {
        return sendJson(res, 403, { ok: false, error: "Access denied to case notes of another organization" });
      }
    } else if (role === "member") {
      if (caseData.memberId !== uid) {
        return sendJson(res, 403, { ok: false, error: "Access denied to another member's case notes" });
      }
    } else if (role !== "platform_admin") {
      return sendJson(res, 403, { ok: false, error: "Unauthorized access" });
    }

    try {
      const notesSnap = await db
        .collection("cases")
        .doc(caseId.trim())
        .collection("notes")
        .get();

      let notes = notesSnap.docs.map((doc) => {
        const d = doc.data();
        let createdAtMillis = 0;
        if (d.createdAt && typeof d.createdAt.toMillis === "function") {
          createdAtMillis = d.createdAt.toMillis();
        } else if (typeof d.createdAt === "number") {
          createdAtMillis = d.createdAt;
        } else if (typeof d.createdAt === "string") {
          createdAtMillis = new Date(d.createdAt).getTime();
        }

        return {
          id: doc.id,
          ...d,
          createdAt: createdAtMillis,
        };
      });

      // Filter: Members must only see member_visible notes
      if (role === "member") {
        notes = notes.filter((n) => n.visibility === "member_visible");
      }

      // Sort descending by createdAt
      notes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return sendJson(res, 200, { ok: true, notes });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to retrieve case notes" });
    }
  }

  // ─── POST /api/cases/notes (Add Note) ──────────────────────────────────────
  if (req.method === "POST") {
    if (role !== "ngo_admin" && role !== "platform_admin") {
      return sendJson(res, 403, { ok: false, error: "Only authorized NGO staff can add case notes" });
    }

    const body = await parseJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    const { caseId, content, visibility = "internal", authorName, authorRole } = body;

    if (!caseId || typeof caseId !== "string" || !caseId.trim()) {
      return sendJson(res, 400, { ok: false, error: "caseId is required" });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return sendJson(res, 400, { ok: false, error: "content cannot be empty" });
    }
    if (visibility !== "internal" && visibility !== "member_visible") {
      return sendJson(res, 400, { ok: false, error: "visibility must be 'internal' or 'member_visible'" });
    }

    const caseRef = db.collection("cases").doc(caseId.trim());
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Case not found" });
    }

    const caseData = caseSnap.data();

    if (role === "ngo_admin") {
      if (!orgId || caseData.orgId !== orgId) {
        return sendJson(res, 403, { ok: false, error: "Cannot add notes to a case belonging to another organization" });
      }
    }

    const noteId = `note_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const newNote = {
      caseId: caseId.trim(),
      authorId: uid,
      authorName: authorName || "Caseworker",
      authorRole: authorRole || "Staff",
      content: content.trim(),
      visibility,
      createdAt: FieldValue.serverTimestamp(),
    };

    try {
      await caseRef.collection("notes").doc(noteId).set(newNote);
      await caseRef.update({
        updatedAt: FieldValue.serverTimestamp(),
      });

      return sendJson(res, 201, {
        ok: true,
        noteId,
        note: {
          id: noteId,
          ...newNote,
          createdAt: Date.now(),
        },
      });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to record case note" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

// ─── Sub-handler for Cases ───────────────────────────────────────────────────
export async function handleCases(req, res, { db = adminDb, auth = adminAuth } = {}) {
  // Check if routed for notes
  const url = new URL(req.url, `http://localhost`);
  if (url.pathname.endsWith("/notes") || url.searchParams.get("sub") === "notes") {
    return handleCaseNotes(req, res, { db, auth });
  }

  const decoded = await verifyToken(req, auth);
  if (!decoded) {
    return sendJson(res, 401, { ok: false, error: "Authentication required" });
  }

  const { role, uid, orgId } = decoded;

  // ─── GET /api/cases ────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const memberIdFilter = url.searchParams.get("memberId");
    const statusFilter = url.searchParams.get("status");

    try {
      let queryRef = db.collection("cases");

      if (role === "ngo_admin") {
        if (!orgId) {
          return sendJson(res, 403, { ok: false, error: "No organization associated with staff profile" });
        }
        queryRef = queryRef.where("orgId", "==", orgId);
        if (memberIdFilter) {
          queryRef = queryRef.where("memberId", "==", memberIdFilter);
        }
      } else if (role === "member") {
        queryRef = queryRef.where("memberId", "==", uid);
      } else if (role === "platform_admin") {
        if (orgId) queryRef = queryRef.where("orgId", "==", orgId);
        if (memberIdFilter) queryRef = queryRef.where("memberId", "==", memberIdFilter);
      } else {
        return sendJson(res, 403, { ok: false, error: "Unauthorized access" });
      }

      if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
        queryRef = queryRef.where("status", "==", statusFilter);
      }

      const snap = await queryRef.get();
      const cases = snap.docs.map((doc) => {
        const d = doc.data();
        let createdAtMillis = 0;
        let updatedAtMillis = 0;
        if (d.createdAt && typeof d.createdAt.toMillis === "function") {
          createdAtMillis = d.createdAt.toMillis();
        } else if (typeof d.createdAt === "number") {
          createdAtMillis = d.createdAt;
        } else if (typeof d.createdAt === "string") {
          createdAtMillis = new Date(d.createdAt).getTime();
        }

        if (d.updatedAt && typeof d.updatedAt.toMillis === "function") {
          updatedAtMillis = d.updatedAt.toMillis();
        } else if (typeof d.updatedAt === "number") {
          updatedAtMillis = d.updatedAt;
        } else if (typeof d.updatedAt === "string") {
          updatedAtMillis = new Date(d.updatedAt).getTime();
        }

        return {
          id: doc.id,
          ...d,
          createdAt: createdAtMillis,
          updatedAt: updatedAtMillis,
        };
      });

      cases.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return sendJson(res, 200, { ok: true, cases });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to retrieve cases" });
    }
  }

  // ─── POST /api/cases (Create Case) ─────────────────────────────────────────
  if (req.method === "POST") {
    if (role !== "ngo_admin") {
      return sendJson(res, 403, { ok: false, error: "Only authorized NGO staff can create cases" });
    }
    if (!orgId) {
      return sendJson(res, 403, { ok: false, error: "Staff member has no associated organization" });
    }

    const body = await parseJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    const {
      memberId,
      caseTitle,
      category = "General Support",
      priority = "medium",
      description = "",
      assignedStaffId = uid,
      assignedStaffName = "",
    } = body;

    if (!memberId || typeof memberId !== "string" || !memberId.trim()) {
      return sendJson(res, 400, { ok: false, error: "memberId is required" });
    }
    if (!caseTitle || typeof caseTitle !== "string" || !caseTitle.trim()) {
      return sendJson(res, 400, { ok: false, error: "caseTitle is required" });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return sendJson(res, 400, { ok: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
    }
    if (!VALID_PRIORITIES.includes(priority)) {
      return sendJson(res, 400, { ok: false, error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` });
    }

    const memberRef = db.collection("members").doc(memberId.trim());
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Associated member not found" });
    }

    const memberData = memberSnap.data();
    const memberOrgId = memberData.orgId || memberData.associatedOrgId;
    if (memberOrgId !== orgId) {
      return sendJson(res, 403, {
        ok: false,
        error: "Cannot create a case for a member not associated with your organization",
      });
    }

    const caseId = `case_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const newCase = {
      memberId: memberId.trim(),
      memberNickname: memberData.nickname || "Anonymous Member",
      orgId,
      assignedStaffId,
      assignedStaffName: assignedStaffName || "Caseworker",
      caseTitle: caseTitle.trim(),
      category,
      priority,
      status: "open",
      description: description ? description.trim() : "",
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    try {
      await db.collection("cases").doc(caseId).set(newCase);

      const logId = `audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await db.collection("adminAuditLogs").doc(logId).set({
        action: "CASE_CREATED",
        targetType: "case",
        targetId: caseId,
        actorUid: uid,
        actorRole: role,
        orgId,
        details: { memberId: memberId.trim(), caseTitle: caseTitle.trim(), category, priority },
        timestamp: FieldValue.serverTimestamp(),
      });

      return sendJson(res, 201, {
        ok: true,
        caseId,
        case: {
          id: caseId,
          ...newCase,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to create case record" });
    }
  }

  // ─── PUT /api/cases (Update Case) ──────────────────────────────────────────
  if (req.method === "PUT") {
    if (role !== "ngo_admin" && role !== "platform_admin") {
      return sendJson(res, 403, { ok: false, error: "Only authorized NGO staff can update cases" });
    }

    const body = await parseJsonBody(req);
    if (!body || !body.caseId) {
      return sendJson(res, 400, { ok: false, error: "caseId is required" });
    }

    const { caseId, status, priority, assignedStaffId, assignedStaffName, caseTitle, description, category, archived } = body;
    const caseRef = db.collection("cases").doc(caseId.trim());
    const caseSnap = await caseRef.get();

    if (!caseSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Case not found" });
    }

    const currentCase = caseSnap.data();

    if (role === "ngo_admin") {
      if (!orgId || currentCase.orgId !== orgId) {
        return sendJson(res, 403, { ok: false, error: "Cannot modify a case belonging to another organization" });
      }
    }

    const updates = { updatedAt: FieldValue.serverTimestamp() };

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return sendJson(res, 400, { ok: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
      }
      updates.status = status;
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return sendJson(res, 400, { ok: false, error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` });
      }
      updates.priority = priority;
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return sendJson(res, 400, { ok: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
      }
      updates.category = category;
    }

    if (assignedStaffId !== undefined) updates.assignedStaffId = assignedStaffId;
    if (assignedStaffName !== undefined) updates.assignedStaffName = assignedStaffName;
    if (caseTitle !== undefined && caseTitle.trim()) updates.caseTitle = caseTitle.trim();
    if (description !== undefined) updates.description = description.trim();
    if (archived !== undefined) updates.archived = Boolean(archived);

    try {
      await caseRef.update(updates);

      const logId = `audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await db.collection("adminAuditLogs").doc(logId).set({
        action: "CASE_UPDATED",
        targetType: "case",
        targetId: caseId.trim(),
        actorUid: uid,
        actorRole: role,
        orgId: currentCase.orgId,
        details: { status, priority, assignedStaffId, assignedStaffName },
        timestamp: FieldValue.serverTimestamp(),
      });

      return sendJson(res, 200, {
        ok: true,
        case: {
          id: caseId.trim(),
          ...currentCase,
          ...updates,
          updatedAt: Date.now(),
        },
      });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to update case record" });
    }
  }

  res.setHeader("Allow", "GET, POST, PUT");
  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

export default async function handler(req, res) {
  return handleCases(req, res);
}
