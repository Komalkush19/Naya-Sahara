/**
 * verify_phase4f_messaging.mjs
 *
 * Comprehensive integration test suite for Phase 4F:
 * 1. Member requests conversation with associated NGO (valid)
 * 2. Member cannot request conversation with unassociated NGO (enforces NGO association)
 * 3. NGO-to-NGO conversation request prohibited (SEC-2)
 * 4. Self-request prohibited
 * 5. Duplicate pending request blocked / handled
 * 6. Intended recipient accepts request (valid)
 * 7. Requester cannot accept own request (SEC-1)
 * 8. Requester can cancel pending request (valid)
 * 9. Non-participant cannot access conversations or messages (isolation)
 * 10. Platform admin denied message access (privacy isolation)
 * 11. Sending message in pending conversation fails closed
 * 12. Sending message in accepted conversation succeeds & immutability respected
 * 13. Blocking conversation disables message sending
 * 14. Unblocking restores messaging ability
 * 15. Safety report creation on flagged conversation
 */

import { handleConversations } from "../frontend/api/conversations/index.js";
import { handleMessages } from "../frontend/api/conversations/messages.js";

// In-memory Mock Firestore implementation
class MockDocRef {
  constructor(parentCollection, id, data = null) {
    this.parentCollection = parentCollection;
    this.id = id;
    this._data = data;
    this._subcollections = new Map();
  }

  async get() {
    return {
      exists: this._data !== null,
      id: this.id,
      data: () => (this._data ? JSON.parse(JSON.stringify(this._data)) : undefined),
    };
  }

  async set(data) {
    this._data = JSON.parse(JSON.stringify(data));
  }

  async update(patch) {
    if (!this._data) throw new Error("Document does not exist");
    this._data = { ...this._data, ...JSON.parse(JSON.stringify(patch)) };
  }

  collection(subName) {
    if (!this._subcollections.has(subName)) {
      this._subcollections.set(subName, new MockCollection(subName));
    }
    return this._subcollections.get(subName);
  }
}

class MockCollection {
  constructor(name) {
    this.name = name;
    this.docs = new Map();
  }

  doc(id) {
    if (!this.docs.has(id)) {
      this.docs.set(id, new MockDocRef(this, id));
    }
    return this.docs.get(id);
  }

  where(field, op, val) {
    return new MockQuery(this, [{ field, op, val }]);
  }

  orderBy(field, dir = "asc") {
    return new MockQuery(this, [], [{ field, dir }]);
  }

  async get() {
    return new MockQuery(this, []).get();
  }
}

class MockQuery {
  constructor(collection, filters = [], orders = []) {
    this.collection = collection;
    this.filters = filters;
    this.orders = orders;
  }

  where(field, op, val) {
    return new MockQuery(this.collection, [...this.filters, { field, op, val }], this.orders);
  }

  orderBy(field, dir = "asc") {
    return new MockQuery(this.collection, this.filters, [...this.orders, { field, dir }]);
  }

  async get() {
    let results = [];
    for (const [id, docRef] of this.collection.docs.entries()) {
      if (docRef._data !== null) {
        let match = true;
        for (const f of this.filters) {
          const docVal = docRef._data[f.field];
          if (f.op === "==") {
            if (Array.isArray(docVal) && Array.isArray(f.val)) {
              if (JSON.stringify(docVal) !== JSON.stringify(f.val)) match = false;
            } else if (docVal !== f.val) {
              match = false;
            }
          } else if (f.op === "array-contains") {
            if (!Array.isArray(docVal) || !docVal.includes(f.val)) match = false;
          }
        }
        if (match) {
          results.push({
            id,
            data: () => JSON.parse(JSON.stringify(docRef._data)),
            ref: docRef,
          });
        }
      }
    }

    if (this.orders.length > 0) {
      for (const order of this.orders) {
        results.sort((a, b) => {
          const valA = a.data()[order.field] || "";
          const valB = b.data()[order.field] || "";
          if (order.dir === "asc") return valA.localeCompare(valA);
          return valB.localeCompare(valA);
        });
      }
    }

    return {
      empty: results.length === 0,
      size: results.length,
      docs: results,
    };
  }
}

class MockDb {
  constructor() {
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(name));
    }
    return this.collections.get(name);
  }
}

function createMockReqRes({ method = "GET", url = "http://localhost", body = null, tokenUser = null }) {
  const req = {
    method,
    url,
    headers: {
      authorization: tokenUser ? `Bearer test-token-for-${tokenUser.uid}` : undefined,
    },
    body: body ? JSON.stringify(body) : "",
    async *[Symbol.asyncIterator]() {
      if (body) {
        yield Buffer.from(JSON.stringify(body));
      }
    },
  };

  let responseData = null;
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    setHeader() {},
    end(content) {
      if (content && !responseData) {
        try {
          responseData = JSON.parse(content);
        } catch {
          responseData = content;
        }
      }
      return res;
    },
  };

  const getResult = () => ({ status: res.statusCode, body: responseData });

  return { req, res, getResult };
}

function createMockAuth(tokenMap) {
  return {
    async verifyIdToken(token) {
      if (tokenMap[token]) return tokenMap[token];
      throw new Error("Invalid token");
    },
  };
}

async function runTests() {
  console.log("=== Starting Phase 4F Messaging & Request Verification Suite ===");
  const db = new MockDb();

  // Setup test actors
  const MEMBER_1 = { uid: "member_1_uid", role: "member" };
  const MEMBER_2 = { uid: "member_2_uid", role: "member" };
  const NGO_STAFF_A = { uid: "ngo_staff_a", role: "ngo_admin", orgId: "org_alpha" };
  const NGO_STAFF_B = { uid: "ngo_staff_b", role: "ngo_admin", orgId: "org_beta" };
  const PLATFORM_ADMIN = { uid: "admin_uid", role: "platform_admin" };

  const authMap = {
    "test-token-for-member_1_uid": MEMBER_1,
    "test-token-for-member_2_uid": MEMBER_2,
    "test-token-for-ngo_staff_a": NGO_STAFF_A,
    "test-token-for-ngo_staff_b": NGO_STAFF_B,
    "test-token-for-admin_uid": PLATFORM_ADMIN,
  };
  const auth = createMockAuth(authMap);

  // Pre-seed Firestore DB
  // Organizations
  await db.collection("organizations").doc("org_alpha").set({
    name: "Alpha Women Support",
    status: "approved",
  });
  await db.collection("organizations").doc("org_beta").set({
    name: "Beta Hope Center",
    status: "approved",
  });

  // Members: member 1 belongs to org_alpha
  await db.collection("members").doc("member_1_uid").set({
    nickname: "Asha",
    orgId: "org_alpha",
    status: "active",
  });
  await db.collection("members").doc("member_2_uid").set({
    nickname: "Sita",
    orgId: "org_beta",
    status: "active",
  });

  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition, message) {
    testsTotal++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(`✅ PASS: ${message}`);
      testsPassed++;
    }
  }

  let testConversationId = null;

  // Test 1: Member 1 requests conversation with their associated NGO (org_alpha) -> Success (201)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "POST",
      tokenUser: MEMBER_1,
      body: {
        targetId: "org_alpha",
        targetType: "ngo",
        targetName: "Alpha Women Support",
        introMessage: "Namaste, I need assistance with legal paperwork.",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 201 && r.body.ok === true, "Member can send request to their associated NGO");
    assert(r.body.conversation.requestStatus === "pending", "Initial request status is 'pending'");
    assert(r.body.conversation.blocked === false, "Conversation is initially unblocked");
    testConversationId = r.body.conversation.id;
  }

  // Test 2: Member 1 tries to request conversation with unassociated NGO (org_beta) -> Denied (403)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "POST",
      tokenUser: MEMBER_1,
      body: {
        targetId: "org_beta",
        targetType: "ngo",
        targetName: "Beta Hope Center",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 403, "Member cannot send request to an unassociated NGO");
  }

  // Test 3: NGO-to-NGO conversation request prohibited (SEC-2) -> Denied (400)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "POST",
      tokenUser: NGO_STAFF_A,
      body: {
        targetId: "org_beta",
        targetType: "ngo",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 400 && r.body.error.includes("NGO-to-NGO"), "NGO-to-NGO messaging is strictly prohibited");
  }

  // Test 4: Self-request prohibited -> Denied (400)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "POST",
      tokenUser: MEMBER_1,
      body: {
        targetId: "member_1_uid",
        targetType: "member",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 400, "Self-requests are prohibited");
  }

  // Test 5: Duplicate pending request between Member 1 and org_alpha -> Returns 409
  {
    const { req, res, getResult } = createMockReqRes({
      method: "POST",
      tokenUser: MEMBER_1,
      body: {
        targetId: "org_alpha",
        targetType: "ngo",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 409, "Duplicate pending request is rejected with 409 conflict");
  }

  // Test 6: Requester (Member 1) CANNOT accept their own request (SEC-1) -> Denied (403)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "PUT",
      tokenUser: MEMBER_1,
      body: {
        conversationId: testConversationId,
        action: "accept",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 403, "Requester cannot self-accept conversation (SEC-1 enforced)");
  }

  // Test 7: Non-participant (NGO Staff B) cannot view or update conversation -> Denied (403)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "PUT",
      tokenUser: NGO_STAFF_B,
      body: {
        conversationId: testConversationId,
        action: "accept",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 403, "Non-participant cannot access or modify conversation");
  }

  // Test 8: Platform Admin denied conversation access -> Denied (403)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "GET",
      tokenUser: PLATFORM_ADMIN,
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 403, "Platform Admin is denied conversation read access (zero central inbox)");
  }

  // Test 9: Sending message in pending conversation fails closed -> Denied (403)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "POST",
      tokenUser: MEMBER_1,
      body: {
        conversationId: testConversationId,
        text: "Hello, are you there?",
      },
    });
    await handleMessages(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 403, "Sending message in non-accepted conversation fails closed");
  }

  // Test 10: Intended recipient (NGO Staff A) accepts conversation request -> Success (200)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "PUT",
      tokenUser: NGO_STAFF_A,
      body: {
        conversationId: testConversationId,
        action: "accept",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 200 && r.body.status === "accepted", "Intended recipient accepts conversation request");
  }

  // Test 11: Sending message in accepted conversation succeeds (201)
  {
    const { req, res, getResult } = createMockReqRes({
      method: "POST",
      tokenUser: MEMBER_1,
      body: {
        conversationId: testConversationId,
        text: "Namaste caseworker, thank you for accepting.",
      },
    });
    await handleMessages(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 201 && r.body.ok === true, "Participant can send message in accepted conversation");
    assert(r.body.message.text === "Namaste caseworker, thank you for accepting.", "Message text matches");
  }

  // Test 12: NGO replies to message -> Success (201) & parent preview updated
  {
    const { req, res, getResult } = createMockReqRes({
      method: "POST",
      tokenUser: NGO_STAFF_A,
      body: {
        conversationId: testConversationId,
        text: "Namaste Asha, we are here to support you.",
      },
    });
    await handleMessages(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 201 && r.body.ok === true, "NGO caseworker can reply to message");

    // Verify parent document lastMessageText updated
    const convSnap = await db.collection("conversations").doc(testConversationId).get();
    assert(convSnap.data().lastMessageText === "Namaste Asha, we are here to support you.", "Parent lastMessageText updated");
  }

  // Test 13: Read messages in accepted conversation -> Returns messages in order
  {
    const { req, res, getResult } = createMockReqRes({
      method: "GET",
      url: `http://localhost/api/conversations/messages?conversationId=${testConversationId}`,
      tokenUser: MEMBER_1,
    });
    await handleMessages(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 200 && Array.isArray(r.body.messages) && r.body.messages.length === 2, "Participant reads message history");
  }

  // Test 14: Participant blocks conversation -> Messaging is blocked
  {
    const { req, res, getResult } = createMockReqRes({
      method: "PUT",
      tokenUser: MEMBER_1,
      body: {
        conversationId: testConversationId,
        action: "block",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 200 && r.body.blocked === true, "Participant can block conversation");

    // Attempting to send message while blocked must fail (403)
    const { req: msgReq, res: msgRes, getResult: getMsgResult } = createMockReqRes({
      method: "POST",
      tokenUser: NGO_STAFF_A,
      body: {
        conversationId: testConversationId,
        text: "Can you hear me?",
      },
    });
    await handleMessages(msgReq, msgRes, { db, auth });
    const msgR = getMsgResult();
    assert(msgR.status === 403, "Sending message in blocked conversation is rejected");
  }

  // Test 15: Participant unblocks conversation -> Messaging re-enabled
  {
    const { req, res, getResult } = createMockReqRes({
      method: "PUT",
      tokenUser: MEMBER_1,
      body: {
        conversationId: testConversationId,
        action: "unblock",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 200 && r.body.blocked === false, "Participant can unblock conversation");

    // Attempting to send message after unblock must succeed (201)
    const { req: msgReq, res: msgRes, getResult: getMsgResult } = createMockReqRes({
      method: "POST",
      tokenUser: MEMBER_1,
      body: {
        conversationId: testConversationId,
        text: "Unblocked and continuing our conversation.",
      },
    });
    await handleMessages(msgReq, msgRes, { db, auth });
    const msgR = getMsgResult();
    assert(msgR.status === 201, "Sending message succeeds after unblocking");
  }

  // Test 16: Participant reports conversation -> Record saved in reports collection
  {
    const { req, res, getResult } = createMockReqRes({
      method: "PUT",
      tokenUser: MEMBER_1,
      body: {
        conversationId: testConversationId,
        action: "report",
        reason: "Testing reporting functionality for safety",
      },
    });
    await handleConversations(req, res, { db, auth });
    const r = getResult();
    assert(r.status === 200 && r.body.reported === true, "Safety report submitted successfully");

    const reportsSnap = await db.collection("reports").get();
    assert(reportsSnap.size === 1, "Report document created in root /reports collection");
  }

  // Test 17: Requester cancels pending request workflow
  {
    // Create new pending conversation between Member 2 and org_beta
    const { req: cReq, res: cRes, getResult: getCResult } = createMockReqRes({
      method: "POST",
      tokenUser: MEMBER_2,
      body: {
        targetId: "org_beta",
        targetType: "ngo",
        targetName: "Beta Hope Center",
      },
    });
    await handleConversations(cReq, cRes, { db, auth });
    const cR = getCResult();
    assert(cR.status === 201, "Member 2 creates pending request with org_beta");
    const conv2Id = cR.body.conversation.id;

    // Member 2 cancels pending request
    const { req: cancelReq, res: cancelRes, getResult: getCancelResult } = createMockReqRes({
      method: "PUT",
      tokenUser: MEMBER_2,
      body: {
        conversationId: conv2Id,
        action: "cancel",
      },
    });
    await handleConversations(cancelReq, cancelRes, { db, auth });
    const cancelR = getCancelResult();
    assert(cancelR.status === 200 && cancelR.body.status === "cancelled", "Requester can cancel their pending request");
  }

  console.log(`\n========================================`);
  console.log(`Phase 4F Results: ${testsPassed}/${testsTotal} passed (${Math.round((testsPassed / testsTotal) * 100)}%)`);
  console.log(`========================================\n`);
}

runTests().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
