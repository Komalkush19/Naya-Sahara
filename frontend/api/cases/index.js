/**
 * /api/cases — Case Management endpoint.
 *
 * GET  /api/cases               — List cases.
 *                                 - NGO staff: returns all cases for their orgId (or filtered by memberId).
 *                                 - Member: returns their own cases only.
 *                                 - Platform Admin: returns all cases (or by orgId/memberId).
 * POST /api/cases               — NGO staff creates a case for an associated member.
 * PUT  /api/cases               — NGO staff updates permitted case fields (status, priority, assigned caseworker, title, description).
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

export async function handleCases(req, res, { db = adminDb, auth = adminAuth } = {}) {
  const decoded = await verifyToken(req, auth);
  if (!decoded) {
    return sendJson(res, 401, { ok: false, error: "Authentication required" });
  }

  const { role, uid, orgId } = decoded;

  // ─── GET /api/cases ────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url, `http://localhost`);
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
        // Members only see their own cases
        queryRef = queryRef.where("memberId", "==", uid);
      } else if (role === "platform_admin") {
        if (orgId) {
          queryRef = queryRef.where("orgId", "==", orgId);
        }
        if (memberIdFilter) {
          queryRef = queryRef.where("memberId", "==", memberIdFilter);
        }
      } else {
        return sendJson(res, 403, { ok: false, error: "Unauthorized access" });
      }

      if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
        queryRef = queryRef.where("status", "==", statusFilter);
      }

      const snap = await queryRef.get();
      const cases = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          caseId: doc.id,
          memberId: d.memberId || "",
          memberNickname: d.memberNickname || "",
          orgId: d.orgId || "",
          caseTitle: d.caseTitle || "",
          category: d.category || "General Support",
          priority: d.priority || "medium",
          status: d.status || "open",
          description: d.description || "",
          assignedStaffId: d.assignedStaffId || null,
          assignedStaffName: d.assignedStaffName || null,
          archived: Boolean(d.archived),
          createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt || null),
          updatedAt: d.updatedAt?.toMillis ? d.updatedAt.toMillis() : (d.updatedAt || null),
          createdBy: d.createdBy || "",
        };
      });

      // Sort in memory by updatedAt or createdAt desc
      cases.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

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
      return sendJson(res, 403, { ok: false, error: "No organization associated with staff profile" });
    }

    const body = await parseJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });
    }

    const {
      memberId,
      caseTitle,
      category,
      priority,
      description,
      assignedStaffId,
      assignedStaffName,
    } = body;

    if (!memberId || typeof memberId !== "string" || !memberId.trim()) {
      return sendJson(res, 400, { ok: false, error: "memberId is required" });
    }
    if (!caseTitle || typeof caseTitle !== "string" || !caseTitle.trim()) {
      return sendJson(res, 400, { ok: false, error: "caseTitle is required" });
    }

    // Security Check: Member MUST be associated with the caller's organization
    const memberSnap = await db.collection("members").doc(memberId.trim()).get();
    if (!memberSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Associated member record not found" });
    }
    const memberData = memberSnap.data();
    if (memberData.associatedOrgId !== orgId) {
      return sendJson(res, 403, {
        ok: false,
        error: "Member is not associated with your organization",
      });
    }

    const casePriority = VALID_PRIORITIES.includes(priority) ? priority : "medium";
    const caseCategory = VALID_CATEGORIES.includes(category) ? category : "General Support";
    const caseStatus = "open";

    const caseId = `case_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const now = FieldValue.serverTimestamp();

    const newCase = {
      caseId,
      memberId: memberId.trim(),
      memberNickname: memberData.nickname || "Member",
      orgId,
      caseTitle: caseTitle.trim().slice(0, 200),
      category: caseCategory,
      priority: casePriority,
      status: caseStatus,
      description: typeof description === "string" ? description.trim().slice(0, 5000) : "",
      assignedStaffId: assignedStaffId ? String(assignedStaffId).trim() : null,
      assignedStaffName: assignedStaffName ? String(assignedStaffName).trim() : null,
      archived: false,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.collection("cases").doc(caseId).set(newCase);

      // Audit log entry
      const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await db.collection("adminAuditLogs").doc(logId).set({
        logId,
        action: "CASE_CREATED",
        targetType: "case",
        targetId: caseId,
        actorUid: uid,
        actorRole: "ngo_admin",
        details: {
          orgId,
          memberId: memberId.trim(),
          caseTitle: newCase.caseTitle,
          priority: casePriority,
        },
        timestamp: now,
      });

      return sendJson(res, 201, { ok: true, caseId, case: newCase });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to create case record" });
    }
  }

  // ─── PUT /api/cases (Update Case) ──────────────────────────────────────────
  if (req.method === "PUT") {
    if (role !== "ngo_admin" && role !== "platform_admin") {
      return sendJson(res, 403, { ok: false, error: "Unauthorized to update cases" });
    }

    const body = await parseJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });
    }

    const { caseId } = body;
    if (!caseId || typeof caseId !== "string" || !caseId.trim()) {
      return sendJson(res, 400, { ok: false, error: "caseId is required" });
    }

    const caseRef = db.collection("cases").doc(caseId.trim());
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Case not found" });
    }

    const existingCase = caseSnap.data();

    // Security check: NGO staff can only update cases in their org
    if (role === "ngo_admin" && existingCase.orgId !== orgId) {
      return sendJson(res, 403, { ok: false, error: "Access denied to other organization's case" });
    }

    const updates = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.caseTitle && typeof body.caseTitle === "string" && body.caseTitle.trim()) {
      updates.caseTitle = body.caseTitle.trim().slice(0, 200);
    }
    if (body.description !== undefined && typeof body.description === "string") {
      updates.description = body.description.trim().slice(0, 5000);
    }
    if (body.category && VALID_CATEGORIES.includes(body.category)) {
      updates.category = body.category;
    }
    if (body.priority && VALID_PRIORITIES.includes(body.priority)) {
      updates.priority = body.priority;
    }
    if (body.status && VALID_STATUSES.includes(body.status)) {
      updates.status = body.status;
    }
    if (body.assignedStaffId !== undefined) {
      updates.assignedStaffId = body.assignedStaffId ? String(body.assignedStaffId).trim() : null;
    }
    if (body.assignedStaffName !== undefined) {
      updates.assignedStaffName = body.assignedStaffName ? String(body.assignedStaffName).trim() : null;
    }
    if (body.archived !== undefined) {
      updates.archived = Boolean(body.archived);
    }

    try {
      await caseRef.update(updates);

      // Audit log entry for significant updates (status change or caseworker assignment)
      if (body.status || body.assignedStaffId !== undefined || body.archived !== undefined) {
        const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        await db.collection("adminAuditLogs").doc(logId).set({
          logId,
          action: "CASE_UPDATED",
          targetType: "case",
          targetId: caseId.trim(),
          actorUid: uid,
          actorRole: role,
          details: {
            orgId: existingCase.orgId,
            statusChange: body.status || null,
            assignedStaffChange: body.assignedStaffName || null,
            archived: body.archived !== undefined ? Boolean(body.archived) : null,
          },
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      return sendJson(res, 200, { ok: true, caseId: caseId.trim(), updates });
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
