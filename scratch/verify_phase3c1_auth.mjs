/* global process */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "../frontend/node_modules/bcryptjs/index.js";

import {
  normalizeNickname,
  validateNickname,
  validatePassword,
  hashHandoverCode,
  getClientIp,
  DUMMY_BCRYPT_HASH,
} from "../frontend/api/_lib/authUtils.js";

import { handleRegisterMember } from "../frontend/api/auth/register-member.js";
import { handleLoginMember } from "../frontend/api/auth/login-member.js";
import { handleSyncStaff } from "../frontend/api/auth/sync-staff.js";
import { handleMe } from "../frontend/api/auth/me.js";

/**
 * Mock Firestore database implementing documents, collections, and atomic transactions
 * with optimistic concurrency control (OCC) and retry logic mirroring real Cloud Firestore.
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
          async update(updates) {
            const col = self._getCol(colName);
            const entry = col.get(docId);
            if (!entry) {
              throw new Error(`Document ${colName}/${docId} does not exist`);
            }
            col.set(docId, {
              data: { ...entry.data, ...structuredClone(updates) },
              version: entry.version + 1,
            });
          },
          async delete() {
            const col = self._getCol(colName);
            col.delete(docId);
          },
        };
      },
    };
  }

  async runTransaction(updateFunction, maxRetries = 25) {
    const self = this;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const readVersions = new Map();
      const stagedWrites = [];

      const transaction = {
        async get(docRef) {
          const col = self._getCol(docRef.collection);
          const entry = col.get(docRef.id);
          const version = entry ? entry.version : 0;
          readVersions.set(`${docRef.collection}/${docRef.id}`, version);
          return docRef.get();
        },
        set(docRef, data, options = {}) {
          stagedWrites.push({
            action: "set",
            colName: docRef.collection,
            docId: docRef.id,
            data: structuredClone(data),
            options,
          });
        },
        update(docRef, data) {
          stagedWrites.push({
            action: "update",
            colName: docRef.collection,
            docId: docRef.id,
            data: structuredClone(data),
          });
        },
        delete(docRef) {
          stagedWrites.push({
            action: "delete",
            colName: docRef.collection,
            docId: docRef.id,
          });
        },
      };

      let result;
      try {
        result = await updateFunction(transaction);
      } catch (err) {
        throw err;
      }

      // Concurrency conflict check
      let conflict = false;
      for (const [key, v] of readVersions.entries()) {
        const [cName, dId] = key.split("/");
        const col = self._getCol(cName);
        const currentEntry = col.get(dId);
        const currentVersion = currentEntry ? currentEntry.version : 0;
        if (currentVersion !== v) {
          conflict = true;
          break;
        }
      }

      if (conflict) {
        // Contention detected: wait jittered delay and retry
        await new Promise((r) => setTimeout(r, Math.random() * 15 + 5));
        continue;
      }

      // Apply staged writes atomically
      for (const write of stagedWrites) {
        const col = self._getCol(write.colName);
        const current = col.get(write.docId);
        const nextVersion = (current?.version || 0) + 1;
        if (write.action === "set") {
          if (write.options?.merge && current) {
            col.set(write.docId, {
              data: { ...current.data, ...write.data },
              version: nextVersion,
            });
          } else {
            col.set(write.docId, { data: write.data, version: nextVersion });
          }
        } else if (write.action === "update") {
          if (!current) {
            throw new Error(`Document ${write.colName}/${write.docId} not found`);
          }
          col.set(write.docId, {
            data: { ...current.data, ...write.data },
            version: nextVersion,
          });
        } else if (write.action === "delete") {
          col.delete(write.docId);
        }
      }

      return result;
    }
    throw new Error("Transaction conflict retry limit exceeded");
  }
}

/**
 * Mock Firebase Auth service.
 */
class MockAuth {
  constructor() {
    this.users = new Map();
    this.customTokensMinted = [];
  }

  async createUser({ uid, displayName }) {
    if (this.users.has(uid)) {
      throw new Error(`User with uid ${uid} already exists`);
    }
    const user = { uid, displayName, customClaims: {} };
    this.users.set(uid, user);
    return user;
  }

  async deleteUser(uid) {
    this.users.delete(uid);
  }

  async createCustomToken(uid, claims = {}) {
    this.customTokensMinted.push({ uid, claims });
    return `mock-custom-token-for-${uid}-${JSON.stringify(claims)}`;
  }

  async setCustomUserClaims(uid, claims) {
    const user = this.users.get(uid);
    if (!user) throw new Error(`User ${uid} not found`);
    user.customClaims = { ...claims };
  }

  async verifyIdToken(token) {
    if (!token || !token.startsWith("valid-id-token-")) {
      throw new Error("Decoding Firebase ID token failed");
    }
    const parts = token.replace("valid-id-token-", "").split(":");
    const uid = parts[0];
    const role = parts[1] || undefined;
    const email = parts[2] || `${uid}@example.com`;
    return {
      uid,
      role,
      email,
    };
  }
}

/**
 * Creates mock HTTP request and response objects.
 */
function createMockHttp({ method = "GET", body = null, headers = {} } = {}) {
  const req = {
    method,
    body,
    headers: { ...headers },
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(content) {
      if (typeof content === "string") {
        try {
          this.body = JSON.parse(content);
        } catch {
          this.body = content;
        }
      } else {
        this.body = content;
      }
    },
  };

  return { req, res };
}

// ==========================================
// Test Suite Execution (24 Scenarios)
// ==========================================
async function runTestSuite() {
  console.log("=================================================");
  console.log("Naya Sahara | Phase 3C-1R Remediation Test Suite");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ [PASS] Scenario ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] Scenario ${name}:`, err.message);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // --- Scenario 1: Valid member registration (associatedOrgId alignment) ---
  await test("1: Valid member registration sets associatedOrgId and communityProfiles", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();

    const code = "NS-123456";
    const codeHash = hashHandoverCode(code);
    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "unused",
      issuedByOrgId: "org_sahara_01",
      caseWorkerId: "cw_01",
      caseWorkerName: "Sita Sharma",
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    });

    const { req, res } = createMockHttp({
      method: "POST",
      body: {
        code,
        nickname: "Anjali_2026",
        password: "SuperSecretPassword123",
        avatarId: "avatar_3",
      },
    });

    await handleRegisterMember(req, res, { db, auth });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.customToken);
    assert.equal(res.body.user.nickname, "Anjali_2026");
    assert.equal(res.body.user.role, "member");
    assert.equal(res.body.user.avatarId, "avatar_3");
    assert.equal(res.body.user.associatedOrgId, "org_sahara_01");

    // Verify members document uses associatedOrgId
    const memberSnap = await db.collection("members").doc(res.body.user.uid).get();
    assert.equal(memberSnap.data().status, "active");
    assert.equal(memberSnap.data().associatedOrgId, "org_sahara_01");

    // Verify community profile strictly matches rules whitelist
    const commSnap = await db.collection("communityProfiles").doc(res.body.user.uid).get();
    const commData = commSnap.data();
    assert.equal(commData.uid, res.body.user.uid);
    assert.equal(commData.communityOptIn, false);
    assert.deepEqual(commData.interests, []);
    assert.equal(commData.optIn, undefined); // Should NOT have legacy optIn
    assert.equal(commData.memberId, undefined); // Should NOT have legacy memberId
  });

  // --- Scenario 2: Invalid handover code hash ---
  await test("2: Member registration with invalid handover code hash", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const { req, res } = createMockHttp({
      method: "POST",
      body: { code: "NS-NONEXISTENT", nickname: "Maya_99", password: "ValidPassword123" },
    });
    await handleRegisterMember(req, res, { db, auth });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
  });

  // --- Scenario 3: Already-used handover code ---
  await test("3: Member registration with already-used handover code", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const code = "NS-USED01";
    const codeHash = hashHandoverCode(code);
    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "used",
      usedByMemberId: "prev_user",
    });
    const { req, res } = createMockHttp({
      method: "POST",
      body: { code, nickname: "Maya_99", password: "ValidPassword123" },
    });
    await handleRegisterMember(req, res, { db, auth });
    assert.equal(res.statusCode, 400);
  });

  // --- Scenario 4: Expired handover code ---
  await test("4: Member registration with expired handover code", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const code = "NS-EXPIRED01";
    const codeHash = hashHandoverCode(code);
    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "unused",
      expiresAt: new Date(Date.now() - 3600 * 1000),
    });
    const { req, res } = createMockHttp({
      method: "POST",
      body: { code, nickname: "Pooja_99", password: "ValidPassword123" },
    });
    await handleRegisterMember(req, res, { db, auth });
    assert.equal(res.statusCode, 400);
  });

  // --- Scenario 5: Duplicate/taken nickname ---
  await test("5: Member registration with duplicate/taken nickname", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    await db.collection("memberCredentials").doc("sunita").set({
      normalizedNickname: "sunita",
      memberId: "existing_uid",
      status: "active",
    });
    const code = "NS-FRESH01";
    const codeHash = hashHandoverCode(code);
    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "unused",
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    });
    const { req, res } = createMockHttp({
      method: "POST",
      body: { code, nickname: "  SuNiTa  ", password: "ValidPassword123" },
    });
    await handleRegisterMember(req, res, { db, auth });
    assert.equal(res.statusCode, 409);
  });

  // --- Scenario 6: Invalid nickname syntax ---
  await test("6: Member registration with invalid nickname syntax", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    let http = createMockHttp({
      method: "POST",
      body: { code: "NS-ABCDEF", nickname: "a", password: "Password123" },
    });
    await handleRegisterMember(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 400);
  });

  // --- Scenario 7: Invalid password (< 8 chars) ---
  await test("7: Member registration with invalid password (< 8 chars)", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const http = createMockHttp({
      method: "POST",
      body: { code: "NS-ABCDEF", nickname: "good_name", password: "short" },
    });
    await handleRegisterMember(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 400);
  });

  // --- Scenario 8: Registration concurrency / race condition ---
  await test("8: Registration concurrency race simulation", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const code = "NS-CONCURRENT";
    const codeHash = hashHandoverCode(code);
    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "unused",
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    });

    const http1 = createMockHttp({
      method: "POST",
      body: { code, nickname: "racer_one", password: "Password123" },
    });
    const http2 = createMockHttp({
      method: "POST",
      body: { code, nickname: "racer_two", password: "Password123" },
    });

    await Promise.all([
      handleRegisterMember(http1.req, http1.res, { db, auth }),
      handleRegisterMember(http2.req, http2.res, { db, auth }),
    ]);

    const statuses = [http1.res.statusCode, http2.res.statusCode].sort();
    assert.deepEqual(statuses, [201, 409]);
  });

  // --- Scenario 9: Registration rollback on failure ---
  await test("9: Registration rollback on Auth failure", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    auth.createUser = async () => {
      throw new Error("Simulated Auth service outage");
    };
    const code = "NS-ROLLBACK01";
    const codeHash = hashHandoverCode(code);
    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "unused",
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    });

    const http = createMockHttp({
      method: "POST",
      body: { code, nickname: "rollback_user", password: "Password123" },
    });

    await handleRegisterMember(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 500);

    const handoverSnap = await db.collection("handoverCodes").doc(codeHash).get();
    assert.equal(handoverSnap.data().status, "unused");
    assert.equal(handoverSnap.data().regAttemptId, null);
  });

  // --- Scenario 10: Valid member login ---
  await test("10: Valid member login projects associatedOrgId and resets counters", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const memberId = "mem_test_10";
    const passwordHash = await bcrypt.hash("CorrectPassword123", 10);

    await db.collection("memberCredentials").doc("radha").set({
      normalizedNickname: "radha",
      memberId,
      passwordHash,
      status: "active",
      failedAttempts: 2,
    });

    await db.collection("members").doc(memberId).set({
      memberId,
      nickname: "Radha",
      avatarId: "avatar_2",
      associatedOrgId: "org_sahara_valley",
    });

    const http = createMockHttp({
      method: "POST",
      headers: { "x-real-ip": "203.0.113.1" },
      body: { nickname: "  RaDhA  ", password: "CorrectPassword123" },
    });

    await handleLoginMember(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 200);
    assert.equal(http.res.body.user.associatedOrgId, "org_sahara_valley");

    const credSnap = await db.collection("memberCredentials").doc("radha").get();
    assert.equal(credSnap.data().failedAttempts, 0);
  });

  // --- Scenario 11: Non-existent nickname timing-safe comparison ---
  await test("11: Non-existent nickname triggers timing-safe comparison", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const http = createMockHttp({
      method: "POST",
      body: { nickname: "ghost_user", password: "Password123" },
    });
    const start = Date.now();
    await handleLoginMember(http.req, http.res, { db, auth });
    const duration = Date.now() - start;
    assert.equal(http.res.statusCode, 401);
    assert.ok(duration >= 20);
  });

  // --- Scenario 12: Incorrect password increments failedAttempts ---
  await test("12: Incorrect password increments failedAttempts", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const passwordHash = await bcrypt.hash("Password123", 10);
    await db.collection("memberCredentials").doc("geeta").set({
      normalizedNickname: "geeta",
      memberId: "mem_geeta",
      passwordHash,
      status: "active",
      failedAttempts: 1,
    });

    const http = createMockHttp({
      method: "POST",
      body: { nickname: "geeta", password: "WrongPassword" },
    });
    await handleLoginMember(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 401);

    const credSnap = await db.collection("memberCredentials").doc("geeta").get();
    assert.equal(credSnap.data().failedAttempts, 2);
  });

  // --- Scenario 13: Member login account lockout ---
  await test("13: Member login account lockout on 5th failed attempt", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const passwordHash = await bcrypt.hash("Password123", 10);
    await db.collection("memberCredentials").doc("lock_test").set({
      normalizedNickname: "lock_test",
      memberId: "mem_lock",
      passwordHash,
      status: "active",
      failedAttempts: 4,
    });

    const http = createMockHttp({
      method: "POST",
      body: { nickname: "lock_test", password: "WrongPassword" },
    });
    await handleLoginMember(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 401);
    assert.match(http.res.body.error, /account locked/i);

    const credSnap = await db.collection("memberCredentials").doc("lock_test").get();
    assert.equal(credSnap.data().failedAttempts, 5);
    assert.ok(credSnap.data().lockedUntil);
  });

  // --- Scenario 14: Staff sync for platform_admin ---
  await test("14: Staff sync for active platform_admin attaches custom claims", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const adminUid = "admin_01";
    await auth.createUser({ uid: adminUid, displayName: "Platform Admin" });
    await db.collection("staffProfiles").doc(adminUid).set({
      uid: adminUid,
      role: "platform_admin",
      status: "active",
    });

    const http = createMockHttp({
      method: "POST",
      headers: { authorization: `Bearer valid-id-token-${adminUid}:undefined:admin@org.com` },
    });
    await handleSyncStaff(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 200);
    assert.deepEqual(http.res.body.claims, { role: "platform_admin" });
  });

  // --- Scenario 15: Staff sync for ngo_admin in verified NGO ---
  await test("15: Staff sync for active ngo_admin in verified NGO", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const staffUid = "staff_01";
    const orgId = "org_verified_01";
    await auth.createUser({ uid: staffUid, displayName: "Staff" });
    await db.collection("organizations").doc(orgId).set({
      name: "Verified NGO",
      verificationStatus: "verified",
    });
    await db.collection("staffProfiles").doc(staffUid).set({
      uid: staffUid,
      role: "ngo_admin",
      orgId,
      status: "active",
    });

    const http = createMockHttp({
      method: "POST",
      headers: { authorization: `Bearer valid-id-token-${staffUid}:undefined:staff@org.com` },
    });
    await handleSyncStaff(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 200);
    assert.deepEqual(http.res.body.claims, { role: "ngo_admin", orgId });
  });

  // --- Scenario 16: Staff sync rejected for unverified NGO or inactive staff ---
  await test("16: Staff sync rejected for unverified NGO or inactive staff", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const staffUid = "staff_unverified";
    const orgId = "org_pending";
    await auth.createUser({ uid: staffUid, displayName: "Staff" });
    await db.collection("organizations").doc(orgId).set({
      name: "Pending NGO",
      verificationStatus: "pending",
    });
    await db.collection("staffProfiles").doc(staffUid).set({
      uid: staffUid,
      role: "ngo_admin",
      orgId,
      status: "active",
    });

    const http = createMockHttp({
      method: "POST",
      headers: { authorization: `Bearer valid-id-token-${staffUid}` },
    });
    await handleSyncStaff(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 403);
  });

  // --- Scenario 17: /api/auth/me for member, staff, unauthenticated ---
  await test("17: /api/auth/me projects associatedOrgId and protects credentials", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const memberUid = "mem_01";
    await db.collection("members").doc(memberUid).set({
      memberId: memberUid,
      nickname: "Laxmi",
      associatedOrgId: "org_asha",
      status: "active",
    });

    const http = createMockHttp({
      method: "GET",
      headers: { authorization: `Bearer valid-id-token-${memberUid}:member` },
    });
    await handleMe(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 200);
    assert.equal(http.res.body.user.associatedOrgId, "org_asha");
    assert.equal(http.res.body.user.passwordHash, undefined);
  });

  // --- NEW Scenario 18: Community Profile Schema Whitelist Compliance ---
  await test("18: Community profile adheres 100% to isValidCommunityProfile whitelist", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const code = "NS-COMM-VALID";
    const codeHash = hashHandoverCode(code);
    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "unused",
      issuedByOrgId: "org_01",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    });

    const { req, res } = createMockHttp({
      method: "POST",
      body: { code, nickname: "valid_comm_user", password: "Password123" },
    });
    await handleRegisterMember(req, res, { db, auth });
    assert.equal(res.statusCode, 201);

    const commSnap = await db.collection("communityProfiles").doc(res.body.user.uid).get();
    const docData = commSnap.data();

    // Must match keys: ['uid', 'nickname', 'avatarId', 'district', 'interests', 'communityOptIn', 'updatedAt']
    const allowedKeys = new Set([
      "uid",
      "nickname",
      "avatarId",
      "district",
      "interests",
      "communityOptIn",
      "updatedAt",
    ]);

    for (const key of Object.keys(docData)) {
      assert.ok(
        allowedKeys.has(key),
        `Unexpected key '${key}' violates isValidCommunityProfile schema!`
      );
    }

    assert.equal(typeof docData.uid, "string");
    assert.equal(typeof docData.nickname, "string");
    assert.equal(typeof docData.avatarId, "string");
    assert.ok(Array.isArray(docData.interests));
    assert.equal(typeof docData.communityOptIn, "boolean");
    assert.equal(docData.communityOptIn, false);
  });

  // --- NEW Scenario 19: Registration finalization after reservation expiration ---
  await test("19: Registration finalization rejected if reservation expires during processing", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const code = "NS-EXPIRE-FINAL";
    const codeHash = hashHandoverCode(code);

    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "unused",
      issuedByOrgId: "org_01",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    });

    // Intercept transaction: before Phase 3 finalization, backdate reservationExpiresAt to the past
    const originalRunTransaction = db.runTransaction.bind(db);
    let phaseCount = 0;
    db.runTransaction = async function (fn) {
      phaseCount++;
      if (phaseCount === 2) {
        // Manipulate reservation timestamp right before finalization transaction
        const hEntry = db._getCol("handoverCodes").get(codeHash);
        if (hEntry) {
          hEntry.data.reservationExpiresAt = new Date(Date.now() - 1000); // Expired!
        }
      }
      return originalRunTransaction(fn);
    };

    const http = createMockHttp({
      method: "POST",
      body: { code, nickname: "slow_registrant", password: "Password123" },
    });

    await handleRegisterMember(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 409);
    assert.match(http.res.body.error, /reservation expired/i);
  });

  // --- NEW Scenario 20: Reservation ownership during cleanup ---
  await test("20: Registration cleanup rollback does not delete competitor reservation", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const code = "NS-CLEANUP-OWN";
    const codeHash = hashHandoverCode(code);

    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "unused",
      issuedByOrgId: "org_01",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    });

    // Simulate competitor overtaking reservation during slow Auth creation
    auth.createUser = async () => {
      // Competitor overwrites reservation in Firestore
      const hEntry = db._getCol("handoverCodes").get(codeHash);
      hEntry.data.regAttemptId = "competitor_attempt_id";
      hEntry.data.reservationExpiresAt = new Date(Date.now() + 120000);

      const cEntry = db._getCol("memberCredentials").get("contested_user");
      if (cEntry) {
        cEntry.data.regAttemptId = "competitor_attempt_id";
      }
      throw new Error("Simulated auth failure to trigger rollback");
    };

    const http = createMockHttp({
      method: "POST",
      body: { code, nickname: "contested_user", password: "Password123" },
    });

    await handleRegisterMember(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 500);

    // Verify competitor's reservation was preserved and NOT cleared
    const handoverSnap = await db.collection("handoverCodes").doc(codeHash).get();
    assert.equal(handoverSnap.data().regAttemptId, "competitor_attempt_id");
  });

  // --- NEW Scenario 21: Concurrency-safe failed login attempts accounting ---
  await test("21: Concurrency-safe atomic increment for failed login attempts", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const passwordHash = await bcrypt.hash("CorrectPassword123", 10);

    await db.collection("memberCredentials").doc("concurrent_target").set({
      normalizedNickname: "concurrent_target",
      memberId: "mem_concurrent",
      passwordHash,
      status: "active",
      failedAttempts: 0,
    });

    // Launch 5 concurrent wrong-password requests
    const requests = Array.from({ length: 5 }, (_, i) =>
      createMockHttp({
        method: "POST",
        headers: { "x-real-ip": `198.51.100.${i + 1}` }, // Different IPs to test account counter specifically
        body: { nickname: "concurrent_target", password: `WrongAttempt_${i}` },
      })
    );

    await Promise.all(
      requests.map((r) => handleLoginMember(r.req, r.res, { db, auth }))
    );

    const credSnap = await db.collection("memberCredentials").doc("concurrent_target").get();
    assert.equal(
      credSnap.data().failedAttempts,
      5,
      `Expected exactly 5 failed attempts after concurrency, got ${credSnap.data().failedAttempts}`
    );
    assert.ok(
      credSnap.data().lockedUntil,
      "Account must be locked after 5 concurrent failures"
    );
  });

  // --- NEW Scenario 22: IP-based login abuse throttling ---
  await test("22: IP-based rate limiting throttles after 15 failed attempts within window", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const clientIp = "192.0.2.88";

    // Issue 15 consecutive failed attempts from same IP
    for (let i = 0; i < 15; i++) {
      const http = createMockHttp({
        method: "POST",
        headers: { "x-real-ip": clientIp },
        body: { nickname: `nonexistent_${i}`, password: "BadPassword123" },
      });
      await handleLoginMember(http.req, http.res, { db, auth });
      assert.equal(http.res.statusCode, 401);
    }

    // 16th attempt from the same IP must be throttled with HTTP 429
    const throttledHttp = createMockHttp({
      method: "POST",
      headers: { "x-real-ip": clientIp },
      body: { nickname: "any_nickname", password: "AnyPassword123" },
    });
    await handleLoginMember(throttledHttp.req, throttledHttp.res, { db, auth });
    assert.equal(throttledHttp.res.statusCode, 429);
    assert.match(throttledHttp.res.body.error, /too many login attempts/i);
  });

  // --- NEW Scenario 23: Suspended staff access rejection ---
  await test("23: Suspended staff profile is rejected on both sync-staff and me", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const suspendedUid = "staff_suspended_01";
    await auth.createUser({ uid: suspendedUid, displayName: "Suspended Staff" });

    await db.collection("staffProfiles").doc(suspendedUid).set({
      uid: suspendedUid,
      role: "ngo_admin",
      orgId: "org_01",
      status: "suspended", // Suspended
    });

    // Test sync-staff
    const syncHttp = createMockHttp({
      method: "POST",
      headers: { authorization: `Bearer valid-id-token-${suspendedUid}:ngo_admin` },
    });
    await handleSyncStaff(syncHttp.req, syncHttp.res, { db, auth });
    assert.equal(syncHttp.res.statusCode, 403);
    assert.match(syncHttp.res.body.error, /suspended or inactive/i);

    // Test me
    const meHttp = createMockHttp({
      method: "GET",
      headers: { authorization: `Bearer valid-id-token-${suspendedUid}:ngo_admin` },
    });
    await handleMe(meHttp.req, meHttp.res, { db, auth });
    assert.equal(meHttp.res.statusCode, 403);
    assert.match(meHttp.res.body.error, /inactive/i);
  });

  // --- NEW Scenario 24: Organization verification revocation rejection ---
  await test("24: Staff sync rejected when organization verification is revoked", async () => {
    const db = new MockFirestore();
    const auth = new MockAuth();
    const staffUid = "staff_revoked_org";
    const orgId = "org_revoked_01";
    await auth.createUser({ uid: staffUid, displayName: "Revoked Org Staff" });

    await db.collection("organizations").doc(orgId).set({
      name: "Revoked NGO",
      verificationStatus: "revoked", // Verification revoked
    });

    await db.collection("staffProfiles").doc(staffUid).set({
      uid: staffUid,
      role: "ngo_admin",
      orgId,
      status: "active",
    });

    const http = createMockHttp({
      method: "POST",
      headers: { authorization: `Bearer valid-id-token-${staffUid}:undefined:staff@revoked.org` },
    });

    await handleSyncStaff(http.req, http.res, { db, auth });
    assert.equal(http.res.statusCode, 403);
    assert.match(http.res.body.error, /not verified/i);
  });

  console.log("\n=================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
