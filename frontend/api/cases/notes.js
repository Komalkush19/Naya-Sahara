/**
 * /api/cases/notes — Case Progress Notes endpoint.
 *
 * GET  /api/cases/notes?caseId=... — Retrieve dated progress notes for a case.
 *                                    - NGO staff: sees all notes (internal + member_visible).
 *                                    - Member: sees ONLY notes marked member_visible.
 *                                    - Platform Admin: sees all notes.
 * POST /api/cases/notes            — NGO staff adds a dated progress note.
 */

import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { extractBearerToken, sendJson, parseJsonBody } from "../_lib/authUtils.js";

async function verifyToken(req, auth) {
  const token = extractBearerToken(req);
  if (!token) return null;
  try {
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

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
      if (caseData.orgId !== orgId) {
        return sendJson(res, 403, { ok: false, error: "Access denied to other organization's case" });
      }
    } else if (role === "member") {
      if (caseData.memberId !== uid) {
        return sendJson(res, 403, { ok: false, error: "Access denied: not your case" });
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
        return {
          id: doc.id,
          noteId: doc.id,
          caseId: caseId.trim(),
          authorUid: d.authorUid || "",
          authorName: d.authorName || "Staff",
          authorRole: d.authorRole || "Caseworker",
          content: d.content || "",
          visibility: d.visibility || "internal",
          createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt || null),
        };
      });

      // Filter: Members must only see member_visible notes
      if (role === "member") {
        notes = notes.filter((n) => n.visibility === "member_visible");
      }

      // Sort newest first
      notes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return sendJson(res, 200, { ok: true, notes });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to retrieve case notes" });
    }
  }

  // ─── POST /api/cases/notes (Add Note) ──────────────────────────────────────
  if (req.method === "POST") {
    if (role !== "ngo_admin") {
      return sendJson(res, 403, { ok: false, error: "Only authorized NGO staff can add case notes" });
    }

    const body = await parseJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });
    }

    const { caseId, content, visibility, authorName, authorRole } = body;

    if (!caseId || typeof caseId !== "string" || !caseId.trim()) {
      return sendJson(res, 400, { ok: false, error: "caseId is required" });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return sendJson(res, 400, { ok: false, error: "Note content is required" });
    }

    const caseRef = db.collection("cases").doc(caseId.trim());
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) {
      return sendJson(res, 404, { ok: false, error: "Case not found" });
    }

    const caseData = caseSnap.data();
    if (caseData.orgId !== orgId) {
      return sendJson(res, 403, { ok: false, error: "Access denied to other organization's case" });
    }

    const noteVisibility = visibility === "member_visible" ? "member_visible" : "internal";
    const noteId = `note_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const now = FieldValue.serverTimestamp();

    const newNote = {
      noteId,
      caseId: caseId.trim(),
      authorUid: uid,
      authorName: typeof authorName === "string" && authorName.trim() ? authorName.trim() : "Caseworker",
      authorRole: typeof authorRole === "string" && authorRole.trim() ? authorRole.trim() : "Caseworker",
      content: content.trim().slice(0, 5000),
      visibility: noteVisibility,
      createdAt: now,
    };

    try {
      await caseRef.collection("notes").doc(noteId).set(newNote);

      // Touch parent case updatedAt
      await caseRef.update({
        updatedAt: now,
      });

      return sendJson(res, 201, { ok: true, noteId, note: newNote });
    } catch {
      return sendJson(res, 500, { ok: false, error: "Failed to record case note" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

export default async function handler(req, res) {
  return handleCaseNotes(req, res);
}
