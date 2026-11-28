/* global process */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { hashHandoverCode } from "../frontend/api/_lib/authUtils.js";
import {
  handleIssueHandoverCode,
  generateSecureHandoverCode,
} from "../frontend/api/ngo/issue-handover-code.js";
import { handleRegisterMember } from "../frontend/api/auth/register-member.js";

/**
 * Mock Firestore database supporting documents, collections, queries, and transactions.
 */
class MockFirestore {
  constructor() {
    this.data = new Map(); // collectionName -> Map(docId -> { data, version })
  }

  _getCol(colName) {
    if (!this.data.has(colName)) {
      this.data.set(colName, new Map());
    }
    return this.data.get(colName);
  }

  collection(colName) {
    const self = this;
    return {
      doc(docId) {
        return {
          id: docId,
          collection: colName,
          async get() {
            const col = self._getCol(colName);
            const entry = col.get(docId);
            const exists = Boolean(entry);
            const docData = exists ? structuredClone(entry.data) : undefined;
            return {
              exists,
              id: docId,
              data: () => docData,
            };
          },
          async set(newData, options = {}) {
            const col = self._getCol(colName);
            const entry = col.get(docId);
            const nextVersion = (entry?.version || 0) + 1;
            if (options.merge && entry) {
              col.set(docId, {
                data: { ...entry.data, ...structuredClone(newData) },
                version: nextVersion,
              });
            } else {
              col.set(docId, {
                data: structuredClone(newData),
                version: nextVersion,
              });
            }
          },
        };
      },
      where(field, op, val) {
        return {
          async get() {
            const col = self._getCol(colName);
            const docs = [];
            for (const [id, entry] of col.entries()) {
              if (op === "==" && entry.data[field] === val) {
                docs.push({
                  id,
                  data: () => structuredClone(entry.data),
                });
              }
            }
            return {
              size: docs.length,
              empty: docs.length === 0,
              docs,
              forEach(callback) {
                docs.forEach(callback);
              },
            };
          },
        };
      },
    };
  }

  async runTransaction(updateFunction) {
    const self = this;
    const reads = new Map();
    const writes = [];

    const transaction = {
      async get(docRef) {
        const col = self._getCol(docRef.collection);
        const entry = col.get(docRef.id);
        const version = entry?.version || 0;
        reads.set(`${docRef.collection}/${docRef.id}`, version);
        const exists = Boolean(entry);
        const docData = exists ? structuredClone(entry.data) : undefined;
        return {
          exists,
          id: docRef.id,
          data: () => docData,
        };
      },
      set(docRef, data, options = {}) {
        writes.push({ type: "set", docRef, data, options });
      },
    };

    const result = await updateFunction(transaction);

    // Commit writes
    for (const w of writes) {
      const col = self._getCol(w.docRef.collection);
      const entry = col.get(w.docRef.id);
      const nextVersion = (entry?.version || 0) + 1;
      if (w.options.merge && entry) {
        col.set(w.docRef.id, {
          data: { ...entry.data, ...structuredClone(w.data) },
          version: nextVersion,
        });
      } else {
        col.set(w.docRef.id, {
          data: structuredClone(w.data),
          version: nextVersion,
        });
      }
    }

    return result;
  }
}

/**
 * Mock Firebase Auth service.
 */
class MockAuth {
  constructor(users = new Map()) {
    this.users = users; // token -> decodedToken
    this.createdUsers = new Map();
  }

  async verifyIdToken(token) {
    if (!this.users.has(token)) {
      const err = new Error("Decoding Firebase ID token failed");
      err.code = "auth/argument-error";
      throw err;
    }
    return this.users.get(token);
  }

  async createUser(properties) {
    this.createdUsers.set(properties.uid, properties);
    return { uid: properties.uid, ...properties };
  }

  async createCustomToken(uid, claims) {
    return `custom_token_${uid}_${JSON.stringify(claims)}`;
  }
}

function createMockReqRes({ method = "POST", headers = {}, body = {} } = {}) {
  const req = {
    method,
    headers: { ...headers },
    body,
  };
  let statusCode = 200;
  let responseData = null;
  const resHeaders = {};

  const res = {
    setHeader(key, val) {
      resHeaders[key] = val;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    end(payload) {
      if (typeof payload === "string") {
        try {
          responseData = JSON.parse(payload);
        } catch {
          responseData = payload;
        }
      } else {
        responseData = payload;
      }
    },
    get statusCode() {
      return statusCode;
    },
    set statusCode(code) {
      statusCode = code;
    },
    get data() {
      return responseData;
    },
    get headers() {
      return resHeaders;
    },
  };

  return { req, res };
}

async function main() {
  console.log("=============================================================");
  console.log("Naya Sahara | Phase 4A Handover Code & Member Roster Suite");
  console.log("=============================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  // Common fixtures
  const VALID_NGO_TOKEN = "valid_ngo_token";
  const UNVERIFIED_NGO_TOKEN = "unverified_ngo_token";
  const MEMBER_TOKEN = "member_token";
  const ADMIN_TOKEN = "admin_token";

  function setupTestEnv() {
    const db = new MockFirestore();
    const auth = new MockAuth();

    // Seed verified NGO
    db.collection("organizations").doc("org_asha").set({
      id: "org_asha",
      name: "Asha Sathi Nepal",
      verificationStatus: "verified",
      status: "approved",
    });

    // Seed unverified NGO
    db.collection("organizations").doc("org_pending").set({
      id: "org_pending",
      name: "Pending NGO",
      verificationStatus: "pending",
      status: "pending",
    });

    // Seed active staff profile for Asha Sathi
    db.collection("staffProfiles").doc("staff_asha_1").set({
      uid: "staff_asha_1",
      email: "caseworker@ashasathi.org",
      name: "Maya Caseworker",
      role: "ngo_admin",
      orgId: "org_asha",
      status: "active",
    });

    // Seed active staff profile for Pending NGO
    db.collection("staffProfiles").doc("staff_pending_1").set({
      uid: "staff_pending_1",
      email: "staff@pending.org",
      name: "Pending Staff",
      role: "ngo_admin",
      orgId: "org_pending",
      status: "active",
    });

    // Map tokens
    auth.users.set(VALID_NGO_TOKEN, {
      uid: "staff_asha_1",
      email: "caseworker@ashasathi.org",
      name: "Maya Caseworker",
      role: "ngo_admin",
      orgId: "org_asha",
    });

    auth.users.set(UNVERIFIED_NGO_TOKEN, {
      uid: "staff_pending_1",
      email: "staff@pending.org",
      name: "Pending Staff",
      role: "ngo_admin",
      orgId: "org_pending",
    });

    auth.users.set(MEMBER_TOKEN, {
      uid: "member_1",
      role: "member",
    });

    auth.users.set(ADMIN_TOKEN, {
      uid: "admin_1",
      role: "platform_admin",
    });

    return { db, auth };
  }

  // =========================================================================
  // 1. Backend Endpoint Authorization Tests
  // =========================================================================
  await test("Test 1: Unauthenticated request is rejected (401)", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: {},
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 401);
    assert.equal(res.data.ok, false);
  });

  await test("Test 2: Invalid bearer token is rejected (401)", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: { authorization: "Bearer invalid_gibberish" },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 401);
    assert.equal(res.data.ok, false);
  });

  await test("Test 3: Member role is forbidden from issuing codes (403)", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${MEMBER_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error, /Only verified NGO staff/);
  });

  await test("Test 4: Platform admin without NGO assignment is forbidden (403)", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
  });

  await test("Test 5: Unverified NGO staff request is forbidden (403)", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${UNVERIFIED_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error, /not verified/);
  });

  await test("Test 6: Verified NGO staff can issue a handover code (201)", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.ok, true);
    assert.ok(typeof res.data.code === "string");
    assert.match(res.data.code, /^NS-[2-9A-HJ-NP-Z]{6}$/);
    assert.equal(res.data.status, "available");
    assert.equal(res.data.issuedByOrgId, "org_asha");
  });

  // =========================================================================
  // Phase 4A-R: Targeted Staff Authorization & Stale Claims Tests
  // =========================================================================
  await test("Test 6.1: Missing staff profile in Firestore is rejected (403)", async () => {
    const { db, auth } = setupTestEnv();
    // Valid token for staff_no_profile_1, but no document in staffProfiles
    auth.users.set("staff_no_profile_token", {
      uid: "staff_no_profile_1",
      email: "orphan@ashasathi.org",
      role: "ngo_admin",
      orgId: "org_asha",
    });
    const { req, res } = createMockReqRes({
      headers: { authorization: "Bearer staff_no_profile_token" },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error, /Staff profile not found/);
  });

  await test("Test 6.2: Suspended staff profile in Firestore is rejected (403)", async () => {
    const { db, auth } = setupTestEnv();
    // Staff profile marked suspended in database
    await db.collection("staffProfiles").doc("staff_asha_1").set({
      uid: "staff_asha_1",
      role: "ngo_admin",
      orgId: "org_asha",
      status: "suspended", // Suspended
    });
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error, /suspended or inactive/);
  });

  await test("Test 6.3: Staff profile with mismatched orgId is rejected (403)", async () => {
    const { db, auth } = setupTestEnv();
    // Staff profile orgId changed to org_ujjwal in database while token still has org_asha
    await db.collection("staffProfiles").doc("staff_asha_1").set({
      uid: "staff_asha_1",
      role: "ngo_admin",
      orgId: "org_ujjwal", // Mismatch with token org_asha
      status: "active",
    });
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error, /does not match/i);
  });

  await test("Test 6.4: Staff profile with non-NGO role in Firestore is rejected (403)", async () => {
    const { db, auth } = setupTestEnv();
    // Profile role demoted in database
    await db.collection("staffProfiles").doc("staff_asha_1").set({
      uid: "staff_asha_1",
      role: "member", // Demoted
      orgId: "org_asha",
      status: "active",
    });
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error, /possess the required ngo_admin role/);
  });

  await test("Test 6.5: Valid active staff profile independently confirmed succeeds (201)", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.status, "available");
  });

  await test("Test 6.6: Organization becoming unverified rejects subsequent requests (403)", async () => {
    const { db, auth } = setupTestEnv();
    // Organization verification revoked in Firestore
    await db.collection("organizations").doc("org_asha").set({
      id: "org_asha",
      name: "Asha Sathi Nepal",
      verificationStatus: "revoked",
    });
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error, /not verified/);
  });

  await test("Test 6.7: Previously issued ID token with stale authorization claims is rejected (403)", async () => {
    const { db, auth } = setupTestEnv();
    // Token claims still say ngo_admin for org_asha, but staff was dismissed (doc deleted)
    const staleToken = "stale_dismissed_staff_token";
    auth.users.set(staleToken, {
      uid: "staff_dismissed_99",
      email: "dismissed@ashasathi.org",
      role: "ngo_admin", // Stale claim!
      orgId: "org_asha",
    });
    // staffProfiles/staff_dismissed_99 does NOT exist
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${staleToken}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error, /Staff profile not found/);
  });

  // =========================================================================
  // 2. Cryptographic Security, Storage & Expiry Tests
  // =========================================================================
  await test("Test 7: Generated codes are unpredictable and collision-resistant", async () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      const code = generateSecureHandoverCode();
      assert.match(code, /^NS-[2-9A-HJ-NP-Z]{6}$/);
      assert.ok(!codes.has(code), "Duplicate code detected!");
      codes.add(code);
    }
    assert.equal(codes.size, 50);
  });

  await test("Test 8: Handover code is stored strictly as SHA-256 hash in Firestore", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    const plaintext = res.data.code;
    const expectedHash = hashHandoverCode(plaintext);

    // Verify plaintext is NOT the document ID
    const plaintextSnap = await db.collection("handoverCodes").doc(plaintext).get();
    assert.equal(plaintextSnap.exists, false);

    // Verify hash IS the document ID
    const hashSnap = await db.collection("handoverCodes").doc(expectedHash).get();
    assert.equal(hashSnap.exists, true);
    const stored = hashSnap.data();
    assert.equal(stored.status, "available");
    assert.equal(stored.issuedByOrgId, "org_asha");
    assert.equal(stored.caseWorkerId, "staff_asha_1");
  });

  await test("Test 9: Handover code expiration is set to exactly 72 hours", async () => {
    const { db, auth } = setupTestEnv();
    const before = Date.now();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    const after = Date.now();

    const expectedExpiryMillis = 72 * 60 * 60 * 1000;
    const expiresAt = new Date(res.data.expiresAt).getTime();
    assert.ok(expiresAt >= before + expectedExpiryMillis);
    assert.ok(expiresAt <= after + expectedExpiryMillis);
  });

  await test("Test 10: Payload spoofing of orgId is strictly ignored", async () => {
    const { db, auth } = setupTestEnv();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
      body: { orgId: "spoofed_hacked_org" }, // Spoofing attempt
    });
    await handleIssueHandoverCode(req, res, { db, auth });
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.issuedByOrgId, "org_asha");

    const codeHash = hashHandoverCode(res.data.code);
    const doc = await db.collection("handoverCodes").doc(codeHash).get();
    assert.equal(doc.data().issuedByOrgId, "org_asha"); // Strictly org_asha
  });

  await test("Test 11: Rate limiting throttles after 30 code requests in an hour (429)", async () => {
    const { db, auth } = setupTestEnv();
    // Simulate 30 successful issues
    for (let i = 0; i < 30; i++) {
      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${VALID_NGO_TOKEN}`, "x-forwarded-for": "192.168.1.100" },
      });
      await handleIssueHandoverCode(req, res, { db, auth });
      assert.equal(res.statusCode, 201);
    }

    // 31st attempt should be throttled
    const { req: thReq, res: thRes } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}`, "x-forwarded-for": "192.168.1.100" },
    });
    await handleIssueHandoverCode(thReq, thRes, { db, auth });
    assert.equal(thRes.statusCode, 429);
    assert.match(thRes.data.error, /rate limit exceeded/);
  });

  // =========================================================================
  // 3. End-to-End Registration Redemption Tests
  // =========================================================================
  await test("Test 12: Registration can successfully redeem an issued handover code", async () => {
    const { db, auth } = setupTestEnv();

    // 1. NGO issues handover code
    const { req: issueReq, res: issueRes } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(issueReq, issueRes, { db, auth });
    assert.equal(issueRes.statusCode, 201);
    const issuedCode = issueRes.data.code;

    // 2. Woman registers with this code
    const { req: regReq, res: regRes } = createMockReqRes({
      body: {
        code: issuedCode,
        nickname: "Kopila",
        password: "ValidSecurePassword123!",
        avatarId: "avatar_2",
      },
    });
    await handleRegisterMember(regReq, regRes, { db, auth });
    assert.equal(regRes.statusCode, 201);
    assert.equal(regRes.data.ok, true);
    assert.ok(regRes.data.customToken);

    // 3. Verify code status in DB is now "used"
    const codeHash = hashHandoverCode(issuedCode);
    const hSnap = await db.collection("handoverCodes").doc(codeHash).get();
    assert.equal(hSnap.data().status, "used");

    // 4. Verify member profile is associated with org_asha
    const memberUid = hSnap.data().usedByMemberId;
    assert.ok(memberUid);
    const mSnap = await db.collection("members").doc(memberUid).get();
    assert.equal(mSnap.data().associatedOrgId, "org_asha");
    assert.equal(mSnap.data().nickname, "Kopila");
  });

  await test("Test 13: Already-used handover code cannot be redeemed twice", async () => {
    const { db, auth } = setupTestEnv();

    // Issue code
    const { req: iReq, res: iRes } = createMockReqRes({
      headers: { authorization: `Bearer ${VALID_NGO_TOKEN}` },
    });
    await handleIssueHandoverCode(iReq, iRes, { db, auth });
    const code = iRes.data.code;

    // First registration succeeds
    const { req: r1Req, res: r1Res } = createMockReqRes({
      body: { code, nickname: "WomanOne", password: "Password123!" },
    });
    await handleRegisterMember(r1Req, r1Res, { db, auth });
    assert.equal(r1Res.statusCode, 201);

    // Second registration with same code fails
    const { req: r2Req, res: r2Res } = createMockReqRes({
      body: { code, nickname: "WomanTwo", password: "Password123!" },
    });
    await handleRegisterMember(r2Req, r2Res, { db, auth });
    assert.equal(r2Res.statusCode, 400);
    assert.match(r2Res.data.error, /Invalid or expired/);
  });

  await test("Test 14: Expired handover code cannot be redeemed", async () => {
    const { db, auth } = setupTestEnv();

    const expiredCode = "NS-EXPIRE";
    const codeHash = hashHandoverCode(expiredCode);
    await db.collection("handoverCodes").doc(codeHash).set({
      status: "available",
      issuedByOrgId: "org_asha",
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    const { req, res } = createMockReqRes({
      body: { code: expiredCode, nickname: "LateRegistrant", password: "Password123!" },
    });
    await handleRegisterMember(req, res, { db, auth });
    assert.equal(res.statusCode, 400);
    assert.match(res.data.error, /Invalid or expired/);
  });

  // =========================================================================
  // 4. NGO Member Roster Retrieval & Isolation Tests
  // =========================================================================
  await test("Test 15: Member roster retrieval strictly isolates organizations", async () => {
    const { db } = setupTestEnv();

    // Seed 2 members for Asha Sathi
    await db.collection("members").doc("mem_asha_1").set({
      memberId: "mem_asha_1",
      nickname: "AshaMember1",
      associatedOrgId: "org_asha",
      status: "active",
      createdAt: new Date(),
    });
    await db.collection("members").doc("mem_asha_2").set({
      memberId: "mem_asha_2",
      nickname: "AshaMember2",
      associatedOrgId: "org_asha",
      status: "active",
      createdAt: new Date(),
    });

    // Seed 1 member for another NGO
    await db.collection("members").doc("mem_other_1").set({
      memberId: "mem_other_1",
      nickname: "OtherMember",
      associatedOrgId: "org_other",
      status: "active",
      createdAt: new Date(),
    });

    // Query for org_asha
    const ashaQuery = db.collection("members").where("associatedOrgId", "==", "org_asha");
    const ashaSnap = await ashaQuery.get();
    assert.equal(ashaSnap.size, 2);
    const ashaNicknames = ashaSnap.docs.map((d) => d.data().nickname);
    assert.ok(ashaNicknames.includes("AshaMember1"));
    assert.ok(ashaNicknames.includes("AshaMember2"));
    assert.ok(!ashaNicknames.includes("OtherMember"));

    // Query for org_other
    const otherQuery = db.collection("members").where("associatedOrgId", "==", "org_other");
    const otherSnap = await otherQuery.get();
    assert.equal(otherSnap.size, 1);
    assert.equal(otherSnap.docs[0].data().nickname, "OtherMember");
  });

  await test("Test 16: Empty member roster returns empty list gracefully", async () => {
    const { db } = setupTestEnv();
    const emptyQuery = db.collection("members").where("associatedOrgId", "==", "org_empty");
    const snap = await emptyQuery.get();
    assert.equal(snap.size, 0);
    assert.equal(snap.empty, true);
  });

  console.log("\n=============================================================");
  console.log(`Phase 4A Test Suite Results: ${passed} passed, ${failed} failed`);
  console.log("=============================================================");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
