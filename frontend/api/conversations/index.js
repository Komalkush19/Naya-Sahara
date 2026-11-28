/**
 * /api/conversations — Unified Conversation and Real-Time Messaging endpoint.
 *
 * Routes handled:
 *   /api/conversations:
 *     GET  /api/conversations               — List conversations for caller.
 *     POST /api/conversations               — Initiate conversation request.
 *     PUT  /api/conversations               — Update conversation status/safety flags.
 *   /api/conversations/messages:
 *     GET  /api/conversations/messages?conversationId=... — Retrieve messages for accepted conversation.
 *     POST /api/conversations/messages                    — Send message in accepted conversation.
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

// ─── Sub-handler for Messages ────────────────────────────────────────────────
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

// ─── Sub-handler for Conversations ───────────────────────────────────────────
export async function handleConversations(req, res, { db = adminDb, auth = adminAuth } = {}) {
  // Check if routed for messages
  const url = new URL(req.url, `http://localhost`);
  if (url.pathname.includes("/messages") || url.searchParams.get("sub") === "messages") {
    return handleMessages(req, res, { db, auth });
  }

  const decoded = await verifyToken(req, auth);
  if (!decoded) {
    return sendJson(res, 401, { ok: false, error: "Authentication required" });
  }

  const { role, uid, orgId } = decoded;

  // Platform admin is strictly prohibited from reading or participating in private chats
  if (role === "platform_admin") {
    return sendJson(res, 403, { ok: false, error: "Platform administrators cannot access private user conversations" });
  }

  // ─── GET /api/conversations ────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      let conversations = [];

      if (role === "ngo_admin") {
        if (!orgId) {
          return sendJson(res, 403, { ok: false, error: "No organization associated with staff profile" });
        }
        // NGO staff sees conversations where orgId matches
        const snap = await db.collection("conversations")
          .where("orgId", "==", orgId)
          .get();

        conversations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } else if (role === "member") {
        // Query conversations where user is in participantIds
        const snap = await db.collection("conversations")
          .where("participantIds", "array-contains", uid)
          .get();

        conversations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } else {
        return sendJson(res, 403, { ok: false, error: "Unauthorized role for conversations" });
      }

      // Sort in memory by updatedAt descending (or createdAt)
      conversations.sort((a, b) => {
        const timeA = a.updatedAt || a.createdAt || "";
        const timeB = b.updatedAt || b.createdAt || "";
        return timeB.localeCompare(timeA);
      });

      return sendJson(res, 200, { ok: true, conversations });
    } catch (err) {
      console.error("[api/conversations GET]", err);
      return sendJson(res, 500, { ok: false, error: "Failed to fetch conversations" });
    }
  }

  // ─── POST /api/conversations ───────────────────────────────────────────────
  if (req.method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    const { targetId, targetType, targetName, targetAvatar, targetSubtitle, introMessage } = body;

    if (!targetId || !targetType) {
      return sendJson(res, 400, { ok: false, error: "targetId and targetType ('member' or 'ngo') are required" });
    }

    // Role validation
    if (role !== "member" && role !== "ngo_admin") {
      return sendJson(res, 403, { ok: false, error: "Only members and NGO staff can initiate conversations" });
    }

    // Prohibition: NGO-to-NGO
    if (role === "ngo_admin" && targetType === "ngo") {
      return sendJson(res, 400, { ok: false, error: "NGO-to-NGO messaging is not permitted" });
    }

    // Prohibition: Self-request
    const effectiveRequesterId = role === "ngo_admin" ? orgId : uid;
    if (effectiveRequesterId === targetId || uid === targetId) {
      return sendJson(res, 400, { ok: false, error: "Cannot send a conversation request to yourself" });
    }

    try {
      let resolvedOrgId = null;
      let requesterName = "";
      let requesterAvatar = "";

      if (role === "ngo_admin") {
        resolvedOrgId = orgId;
        const orgDoc = await db.collection("organizations").doc(orgId).get();
        requesterName = orgDoc.exists ? (orgDoc.data().name || "NGO") : "NGO";
      } else {
        // Role is member
        const memberDoc = await db.collection("members").doc(uid).get();
        if (!memberDoc.exists) {
          return sendJson(res, 404, { ok: false, error: "Member record not found" });
        }
        const memberData = memberDoc.data();
        requesterName = memberData.nickname || "Community Member";

        if (targetType === "ngo") {
          resolvedOrgId = targetId;
          // Verify that the member is associated with this NGO
          if (memberData.orgId && memberData.orgId !== targetId) {
            return sendJson(res, 403, {
              ok: false,
              error: "Members can only message their designated associated NGO",
            });
          }

          // Verify NGO exists and is approved
          const orgDoc = await db.collection("organizations").doc(targetId).get();
          if (!orgDoc.exists || orgDoc.data().status !== "approved") {
            return sendJson(res, 400, { ok: false, error: "Target organization is not an active verified NGO" });
          }
        } else if (targetType === "member") {
          // Peer member to member
          const peerDoc = await db.collection("members").doc(targetId).get();
          if (!peerDoc.exists) {
            return sendJson(res, 404, { ok: false, error: "Target member not found" });
          }
        }
      }

      // Check for duplicate pending or accepted conversations between these participants
      const participantPair = [effectiveRequesterId, targetId].sort();
      const existingQuery = await db.collection("conversations")
        .where("participantPair", "==", participantPair)
        .get();

      if (!existingQuery.empty) {
        // Check states
        for (const doc of existingQuery.docs) {
          const cData = doc.data();
          if (cData.blocked) {
            return sendJson(res, 400, { ok: false, error: "Conversation with this user is blocked", conversationId: doc.id });
          }
          if (cData.requestStatus === "pending") {
            return sendJson(res, 409, {
              ok: false,
              error: "A request is already pending between these participants",
              conversationId: doc.id,
            });
          }
          if (cData.requestStatus === "accepted") {
            return sendJson(res, 200, {
              ok: true,
              message: "Conversation is already active",
              conversation: { id: doc.id, ...cData },
            });
          }
          // If declined or cancelled, we can revive it or create a new request
          if (cData.requestStatus === "declined" || cData.requestStatus === "cancelled") {
            const now = new Date().toISOString();
            const updatePayload = {
              requestStatus: "pending",
              requesterId: effectiveRequesterId,
              requesterRole: role === "ngo_admin" ? "org" : "member",
              requesterName,
              recipientId: targetId,
              recipientRole: targetType,
              recipientName: targetName || cData.recipientName,
              updatedAt: now,
            };
            await doc.ref.update(updatePayload);
            return sendJson(res, 200, {
              ok: true,
              conversation: { id: doc.id, ...cData, ...updatePayload },
            });
          }
        }
      }

      // Create new conversation document
      const now = new Date().toISOString();
      const convId = `conv_${crypto.randomUUID()}`;
      const participantIds = [uid, targetId];
      if (role === "ngo_admin" && !participantIds.includes(orgId)) {
        participantIds.push(orgId);
      }

      const convDoc = {
        type: targetType === "ngo" || role === "ngo_admin" ? "ngo" : "member",
        requesterId: effectiveRequesterId,
        requesterRole: role === "ngo_admin" ? "org" : "member",
        requesterName,
        requesterAvatar,
        recipientId: targetId,
        recipientRole: targetType,
        recipientName: targetName || (targetType === "ngo" ? "NGO" : "Member"),
        recipientAvatar: targetAvatar || null,
        participantIds,
        participantPair,
        organizationId: resolvedOrgId,
        orgId: resolvedOrgId,
        participantSubtitle: targetSubtitle || (targetType === "ngo" ? "Verified Support NGO" : "Community Peer"),
        requestStatus: "pending",
        blocked: false,
        reported: false,
        introMessage: introMessage ? String(introMessage).trim() : null,
        lastMessageText: introMessage ? String(introMessage).trim() : null,
        lastMessageTime: introMessage ? now : null,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection("conversations").doc(convId).set(convDoc);

      return sendJson(res, 201, {
        ok: true,
        conversation: { id: convId, ...convDoc },
      });
    } catch (err) {
      console.error("[api/conversations POST]", err);
      return sendJson(res, 500, { ok: false, error: "Failed to create conversation request" });
    }
  }

  // ─── PUT /api/conversations ────────────────────────────────────────────────
  if (req.method === "PUT") {
    const body = await parseJsonBody(req);
    if (!body || !body.conversationId || !body.action) {
      return sendJson(res, 400, { ok: false, error: "conversationId and action are required" });
    }

    const { conversationId, action, reason } = body;
    const convRef = db.collection("conversations").doc(conversationId);

    try {
      const snap = await convRef.get();
      if (!snap.exists) {
        return sendJson(res, 404, { ok: false, error: "Conversation not found" });
      }

      const conv = snap.data();
      const isParticipant =
        (conv.participantIds && conv.participantIds.includes(uid)) ||
        (conv.type === "ngo" && role === "ngo_admin" && orgId && conv.orgId === orgId);

      if (!isParticipant) {
        return sendJson(res, 403, { ok: false, error: "You are not a participant in this conversation" });
      }

      const isIntendedRecipient =
        (conv.recipientRole === "member" && conv.recipientId === uid) ||
        ((conv.recipientRole === "org" || conv.recipientRole === "ngo") && role === "ngo_admin" && (conv.recipientId === orgId || conv.orgId === orgId));

      const isRequester =
        (conv.requesterRole === "member" && conv.requesterId === uid) ||
        ((conv.requesterRole === "org" || conv.requesterRole === "ngo") && role === "ngo_admin" && (conv.requesterId === orgId || conv.orgId === orgId));

      const now = new Date().toISOString();

      if (action === "accept") {
        if (!isIntendedRecipient || isRequester) {
          return sendJson(res, 403, { ok: false, error: "Only the intended recipient can accept this conversation request" });
        }
        if (conv.requestStatus !== "pending") {
          return sendJson(res, 400, { ok: false, error: `Cannot accept conversation in '${conv.requestStatus}' status` });
        }

        await convRef.update({
          requestStatus: "accepted",
          respondedAt: now,
          updatedAt: now,
        });

        return sendJson(res, 200, { ok: true, status: "accepted" });
      }

      if (action === "decline") {
        if (!isIntendedRecipient || isRequester) {
          return sendJson(res, 403, { ok: false, error: "Only the intended recipient can decline this conversation request" });
        }
        if (conv.requestStatus !== "pending") {
          return sendJson(res, 400, { ok: false, error: `Cannot decline conversation in '${conv.requestStatus}' status` });
        }

        await convRef.update({
          requestStatus: "declined",
          respondedAt: now,
          updatedAt: now,
        });

        return sendJson(res, 200, { ok: true, status: "declined" });
      }

      if (action === "cancel") {
        if (!isRequester) {
          return sendJson(res, 403, { ok: false, error: "Only the original requester can cancel a pending request" });
        }
        if (conv.requestStatus !== "pending") {
          return sendJson(res, 400, { ok: false, error: `Cannot cancel request in '${conv.requestStatus}' status` });
        }

        await convRef.update({
          requestStatus: "cancelled",
          updatedAt: now,
        });

        return sendJson(res, 200, { ok: true, status: "cancelled" });
      }

      if (action === "block") {
        await convRef.update({
          blocked: true,
          blockedByUid: uid,
          updatedAt: now,
        });

        return sendJson(res, 200, { ok: true, blocked: true });
      }

      if (action === "unblock") {
        await convRef.update({
          blocked: false,
          blockedByUid: null,
          updatedAt: now,
        });

        return sendJson(res, 200, { ok: true, blocked: false });
      }

      if (action === "report") {
        const reportReason = typeof reason === "string" && reason.trim() ? reason.trim() : "Flagged for safety review";
        const reportId = `rep_${crypto.randomUUID()}`;

        await db.collection("reports").doc(reportId).set({
          conversationId,
          reportingUserId: uid,
          reportingRole: role === "ngo_admin" ? "org" : "member",
          reason: reportReason,
          status: "pending_review",
          createdAt: now,
        });

        await convRef.update({
          reported: true,
          updatedAt: now,
        });

        return sendJson(res, 200, { ok: true, reported: true });
      }

      return sendJson(res, 400, { ok: false, error: `Unknown action: '${action}'` });
    } catch (err) {
      console.error("[api/conversations PUT]", err);
      return sendJson(res, 500, { ok: false, error: "Failed to update conversation" });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.includes("/messages") || url.searchParams.get("sub") === "messages") {
    return handleMessages(req, res);
  }
  return handleConversations(req, res);
}
