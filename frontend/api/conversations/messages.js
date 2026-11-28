/**
 * /api/conversations/messages — Messages subcollection endpoint.
 *
 * GET  /api/conversations/messages?conversationId=...
 *      - Retrieves messages for an accepted, unblocked conversation.
 *      - Verifies caller is an authorized participant.
 *      - Fails closed if requestStatus !== 'accepted' or if caller is not authorized.
 *
 * POST /api/conversations/messages
 *      - Sends a message in an accepted conversation.
 *      - Verifies caller is an authorized participant.
 *      - Rejects if requestStatus !== 'accepted' or blocked == true.
 *      - Updates conversation.lastMessageText, lastMessageTime, and updatedAt.
 */

import crypto from "node:crypto";
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

export async function handleMessages(req, res, { db = adminDb, auth = adminAuth } = {}) {
  const decoded = await verifyToken(req, auth);
  if (!decoded) {
    return sendJson(res, 401, { ok: false, error: "Authentication required" });
  }

  const { role, uid, orgId } = decoded;

  // Platform admin is strictly prohibited from reading or sending messages
  if (role === "platform_admin") {
    return sendJson(res, 403, { ok: false, error: "Platform administrators cannot access private user messages" });
  }

  // ─── GET /api/conversations/messages ───────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url, `http://localhost`);
    const conversationId = url.searchParams.get("conversationId");

    if (!conversationId) {
      return sendJson(res, 400, { ok: false, error: "conversationId query parameter is required" });
    }

    try {
      const convRef = db.collection("conversations").doc(conversationId);
      const convSnap = await convRef.get();

      if (!convSnap.exists) {
        return sendJson(res, 404, { ok: false, error: "Conversation not found" });
      }

      const conv = convSnap.data();
      const isParticipant =
        (conv.participantIds && conv.participantIds.includes(uid)) ||
        (conv.type === "ngo" && role === "ngo_admin" && orgId && conv.orgId === orgId);

      if (!isParticipant) {
        return sendJson(res, 403, { ok: false, error: "You are not a participant in this conversation" });
      }

      // Security check: Messages are only readable if the conversation is accepted
      if (conv.requestStatus !== "accepted") {
        return sendJson(res, 403, {
          ok: false,
          error: "Messages are not available until the conversation request has been accepted",
        });
      }

      const messagesSnap = await convRef.collection("messages")
        .orderBy("createdAt", "asc")
        .get();

      const messages = messagesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return sendJson(res, 200, { ok: true, messages });
    } catch (err) {
      console.error("[api/conversations/messages GET]", err);
      return sendJson(res, 500, { ok: false, error: "Failed to fetch messages" });
    }
  }

  // ─── POST /api/conversations/messages ──────────────────────────────────────
  if (req.method === "POST") {
    const body = await parseJsonBody(req);
    if (!body || !body.conversationId || !body.text) {
      return sendJson(res, 400, { ok: false, error: "conversationId and text are required" });
    }

    const { conversationId, text } = body;
    const trimmedText = String(text).trim();

    if (!trimmedText) {
      return sendJson(res, 400, { ok: false, error: "Message text cannot be empty" });
    }

    try {
      const convRef = db.collection("conversations").doc(conversationId);
      const convSnap = await convRef.get();

      if (!convSnap.exists) {
        return sendJson(res, 404, { ok: false, error: "Conversation not found" });
      }

      const conv = convSnap.data();
      const isParticipant =
        (conv.participantIds && conv.participantIds.includes(uid)) ||
        (conv.type === "ngo" && role === "ngo_admin" && orgId && conv.orgId === orgId);

      if (!isParticipant) {
        return sendJson(res, 403, { ok: false, error: "You are not a participant in this conversation" });
      }

      // Must be accepted
      if (conv.requestStatus !== "accepted") {
        return sendJson(res, 403, {
          ok: false,
          error: "Cannot send messages in a non-accepted conversation",
        });
      }

      // Cannot be blocked
      if (conv.blocked) {
        return sendJson(res, 403, {
          ok: false,
          error: "Cannot send messages in a blocked conversation",
        });
      }

      // Resolve author name and role
      let authorName = "User";
      let authorRole = "member";

      if (role === "ngo_admin") {
        authorRole = "org";
        const orgDoc = await db.collection("organizations").doc(orgId).get();
        authorName = orgDoc.exists ? (orgDoc.data().name || "NGO Caseworker") : "NGO Caseworker";
      } else {
        const memberDoc = await db.collection("members").doc(uid).get();
        authorName = memberDoc.exists ? (memberDoc.data().nickname || "Member") : "Member";
      }

      const now = new Date().toISOString();
      const messageId = `msg_${crypto.randomUUID()}`;

      const messageDoc = {
        authorId: role === "ngo_admin" ? orgId : uid,
        senderUid: uid,
        authorRole,
        authorName,
        text: trimmedText,
        createdAt: now,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };

      await convRef.collection("messages").doc(messageId).set(messageDoc);

      // Update parent conversation last message preview
      await convRef.update({
        lastMessageText: trimmedText,
        lastMessageTime: now,
        updatedAt: now,
      });

      return sendJson(res, 201, {
        ok: true,
        message: { id: messageId, ...messageDoc },
      });
    } catch (err) {
      console.error("[api/conversations/messages POST]", err);
      return sendJson(res, 500, { ok: false, error: "Failed to send message" });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

export default async function handler(req, res) {
  return handleMessages(req, res);
}
