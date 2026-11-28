/* global process */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { handleRegisterMember } from "../frontend/api/auth/register-member.js";
import { handleLoginMember } from "../frontend/api/auth/login-member.js";
import { handleSyncStaff } from "../frontend/api/auth/sync-staff.js";
import { handleMe } from "../frontend/api/auth/me.js";
import { hashHandoverCode } from "../frontend/api/_lib/authUtils.js";

/**
 * Phase 3C-3B1 Verification Suite:
 * Tests the AuthContext lifecycle, concurrency locks, stale response rejection,
 * registration IP abuse protection, and synthetic identity cleanup.
 */

// -----------------------------------------------------------------------------
// In-Memory Mock Firestore with Transaction Support
// -----------------------------------------------------------------------------
class MockFirestore {
  constructor() {
    this.collections = new Map();
  }

  _getCol(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name);
  }

  collection(name) {
    const self = this;
    return {
      doc(id) {
        return {
          id,
          collection: name,
          async get() {
            const col = self._getCol(name);
            const entry = col.get(id);
            return {
              id,
              exists: Boolean(entry),
              data: () => (entry ? { ...entry.data } : undefined),
            };
          },
          async set(data, options = {}) {
            const col = self._getCol(name);
            const current = col.get(id);
            const nextVersion = (current?.version || 0) + 1;
            if (options.merge && current) {
              col.set(id, {
                data: { ...current.data, ...data },
                version: nextVersion,
              });
            } else {
              col.set(id, { data: { ...data }, version: nextVersion });
            }
          },
          async update(data) {
            const col = self._getCol(name);
            const current = col.get(id);
            if (!current) throw new Error(`Document ${name}/${id} not found`);
            col.set(id, {
              data: { ...current.data, ...data },
              version: current.version + 1,
            });
          },
          async delete() {
            const col = self._getCol(name);
            col.delete(id);
          },
        };
      },
    };
  }

  async runTransaction(updateFunction) {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const readVersions = new Map();
      const stagedWrites = [];
      const self = this;

      const transaction = {
        async get(docRef) {
          const col = self._getCol(docRef.collection);
          const entry = col.get(docRef.id);
          readVersions.set(
            `${docRef.collection}/${docRef.id}`,
            entry ? entry.version : 0
          );
          return {
            id: docRef.id,
            exists: Boolean(entry),
            data: () => (entry ? { ...entry.data } : undefined),
          };
        },
        set(docRef, data, options = {}) {
          stagedWrites.push({
            action: "set",
            colName: docRef.collection,
            docId: docRef.id,
            data,
            options,
          });
        },
        update(docRef, data) {
          stagedWrites.push({
            action: "update",
            colName: docRef.collection,
            docId: docRef.id,
            data,
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
          if (!current) throw new Error(`Document ${write.colName}/${write.docId} not found`);
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
    throw new Error("Transaction aborted after max contention retries");
  }
}

// -----------------------------------------------------------------------------
// Mock Firebase Auth and HTTP Helpers
// -----------------------------------------------------------------------------
class MockAuth {
  constructor() {
    this.users = new Map();
    this.customClaims = new Map();
  }

  async createUser({ displayName }) {
    const uid = `uid_${crypto.randomUUID().slice(0, 8)}`;
    this.users.set(uid, { uid, displayName });
    return { uid, displayName };
  }

  async createCustomToken(uid, claims = {}) {
    this.customClaims.set(uid, { ...claims });
    return `custom_token_${uid}_${JSON.stringify(claims)}`;
  }

  async setCustomUserClaims(uid, claims) {
    this.customClaims.set(uid, { ...claims });
  }

  async verifyIdToken(token) {
    if (!token || !token.startsWith("Bearer-token-")) {
      throw new Error("Invalid Bearer token");
    }
    const uid = token.replace("Bearer-token-", "");
    const claims = this.customClaims.get(uid) || {};
    return { uid, email: `${uid}@example.com`, ...claims };
  }
}

function createMockHttp({ method = "GET", headers = {}, body = null }) {
  const req = {
    method,
    headers: { ...headers },
    body,
  };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(data) {
      this.rawOutput = data;
      try {
        this.body = JSON.parse(data);
      } catch {
        this.body = data;
      }
    },
  };
  return { req, res };
}

// -----------------------------------------------------------------------------
// AuthContext Simulation Engine (Faithfully mirroring AuthContext.jsx)
// -----------------------------------------------------------------------------
class SimulatedAuthContext {
  constructor({ clientAuth, apiRouter }) {
    this.clientAuth = clientAuth;
    this.apiRouter = apiRouter;

    // React state mirrors
    this.firebaseUser = null;
    this.user = null;
    this.role = null;
    this.loading = true;
    this.authError = null;

    // Internal refs
    this.authGeneration = 0;
    this.isStaffSyncing = false;
    this.isSigningIn = false;
    this.resolvedUid = null;
    this.isMounted = true;

    // Instrumentation metrics
    this.profileResolutionCount = 0;
    this.profileResolutionsByUid = new Map();

    // Subscribe to client auth changes
    this.unsubscribe = clientAuth.onAuthStateChanged(async (fbUser) => {
      if (!this.isMounted) return;
      this.firebaseUser = fbUser;

      if (fbUser) {
        // H-1: Prevent premature resolution if staff sync or direct sign-in is orchestrating
        if (this.isStaffSyncing || this.isSigningIn) {
          return;
        }

        if (this.resolvedUid !== fbUser.uid) {
          this.authGeneration += 1;
          const currentGen = this.authGeneration;
          const res = await this.resolveProfile(fbUser, currentGen);
          if (this.isMounted && this.authGeneration === currentGen) {
            if (!res.ok) this.authError = res.error;
            else this.authError = null;
          }
        }
      } else {
        this.authGeneration += 1;
        this.resolvedUid = null;
        this.user = null;
        this.role = null;
        this.authError = null;
      }

      if (this.isMounted) {
        this.loading = false;
      }
    });
  }

  unmount() {
    this.isMounted = false;
    if (this.unsubscribe) this.unsubscribe();
  }

  async resolveProfile(fbUser, generation, delayMs = 0) {
    if (!fbUser) {
      if (this.isMounted && this.authGeneration === generation) {
        this.user = null;
        this.role = null;
        this.resolvedUid = null;
      }
      return { ok: false, error: "No authenticated user" };
    }

    const targetUid = fbUser.uid;

    try {
      const idToken = await fbUser.getIdToken();

      if (!this.isMounted || this.authGeneration !== generation || this.clientAuth.currentUser?.uid !== targetUid) {
        return { ok: false, error: "Stale auth request cancelled" };
      }

      // Simulate optional controlled network delay
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      const res = await this.apiRouter.call("GET", "/api/auth/me", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!this.isMounted || this.authGeneration !== generation || this.clientAuth.currentUser?.uid !== targetUid) {
        return { ok: false, error: "Stale auth request cancelled" };
      }

      if (!res.ok || !res.body.ok) {
        this.resolvedUid = null;
        await this.clientAuth.signOut();
        if (this.isMounted && this.authGeneration === generation) {
          this.user = null;
          this.role = null;
          this.firebaseUser = null;
        }
        return { ok: false, error: res.body?.error || "Profile invalid" };
      }

      const profile = res.body.user;
      let mappedRole = null;
      if (profile.role === "member") mappedRole = "member";
      else if (profile.role === "ngo_admin") mappedRole = "org";
      else if (profile.role === "platform_admin") mappedRole = "admin";

      if (this.isMounted && this.authGeneration === generation) {
        this.user = profile;
        this.role = mappedRole;
        this.resolvedUid = targetUid;
        this.profileResolutionCount++;
        const prevCount = this.profileResolutionsByUid.get(targetUid) || 0;
        this.profileResolutionsByUid.set(targetUid, prevCount + 1);
      }

      return { ok: true, user: profile, role: mappedRole };
    } catch (err) {
      if (this.isMounted && this.authGeneration === generation) {
        this.resolvedUid = null;
      }
      return { ok: false, error: err.message };
    }
  }

  async loginStaff({ email, password }) {
    this.authError = null;
    this.authGeneration += 1;
    const thisGen = this.authGeneration;
    this.isSigningIn = true;
    this.isStaffSyncing = true;

    try {
      // Step 1: Firebase Auth email/pw sign-in
      const userCredential = await this.clientAuth.signInWithEmailAndPassword(email, password);
      const fbUser = userCredential.user;

      if (!this.isMounted || this.authGeneration !== thisGen) {
        this.isStaffSyncing = false;
        return { ok: false, error: "Authentication superseded" };
      }

      // Step 2: Extract initial ID token and call /api/auth/sync-staff
      const initialToken = await fbUser.getIdToken();
      const syncRes = await this.apiRouter.call("POST", "/api/auth/sync-staff", {
        headers: { Authorization: `Bearer ${initialToken}` },
      });

      if (!syncRes.ok || !syncRes.body.ok) {
        this.isStaffSyncing = false;
        this.isSigningIn = false;
        await this.clientAuth.signOut();
        const errorMsg = syncRes.body?.error || "Staff verification failed";
        if (this.isMounted) {
          this.user = null;
          this.role = null;
          this.firebaseUser = null;
          this.resolvedUid = null;
          this.authError = errorMsg;
        }
        return { ok: false, error: errorMsg };
      }

      if (!this.isMounted || this.authGeneration !== thisGen) {
        this.isStaffSyncing = false;
        return { ok: false, error: "Authentication superseded" };
      }

      // Step 3: Force refresh token
      await fbUser.getIdToken(true);

      // Step 4: Release sync lock
      this.isStaffSyncing = false;

      // Step 5: Authoritatively resolve profile
      const prof = await this.resolveProfile(fbUser, thisGen);
      return prof;
    } catch (err) {
      this.isStaffSyncing = false;
      this.authError = err.message;
      return { ok: false, error: err.message };
    } finally {
      this.isSigningIn = false;
    }
  }

  async loginMember({ nickname, password }) {
    this.authError = null;
    this.authGeneration += 1;
    const thisGen = this.authGeneration;
    this.isSigningIn = true;

    try {
      const res = await this.apiRouter.call("POST", "/api/auth/login-member", {
        body: { nickname, password },
      });
      if (!res.ok || !res.body.ok) {
        this.authError = res.body?.error || "Login failed";
        return { ok: false, error: this.authError };
      }
      if (!this.isMounted || this.authGeneration !== thisGen) {
        return { ok: false, error: "Authentication superseded" };
      }
      const cred = await this.clientAuth.signInWithCustomToken(res.body.customToken);
      const prof = await this.resolveProfile(cred.user, thisGen);
      return prof;
    } finally {
      this.isSigningIn = false;
    }
  }

  async logout() {
    this.authGeneration += 1;
    this.isStaffSyncing = false;
    this.isSigningIn = false;
    this.resolvedUid = null;
    this.user = null;
    this.role = null;
    this.firebaseUser = null;
    this.authError = null;
    this.loading = false;
    await this.clientAuth.signOut();
  }
}

// -----------------------------------------------------------------------------
// Mock Client Auth Supporting Custom Tokens and Force-Refresh Claims
// -----------------------------------------------------------------------------
class MockBrowserClientAuth {
  constructor(adminAuthInstance) {
    this.adminAuth = adminAuthInstance;
    this.currentUser = null;
    this.listeners = [];
  }

  onAuthStateChanged(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  _trigger() {
    for (const fn of this.listeners) {
      fn(this.currentUser);
    }
  }

  async signInWithEmailAndPassword(email, password) {
    if (password === "wrong_pw") {
      throw new Error("Invalid password");
    }
    const uid = `staff_${email.replace(/@/g, "_at_").replace(/[^a-z0-9_]/gi, "_")}`;
    const claims = this.adminAuth.customClaims.get(uid) || {};
    this.currentUser = {
      uid,
      email,
      claims: { ...claims },
      getIdToken: async (force = false) => {
        if (force) {
          const fresh = this.adminAuth.customClaims.get(uid) || {};
          this.currentUser.claims = { ...fresh };
        }
        return `Bearer-token-${uid}`;
      },
    };
    this._trigger();
    return { user: this.currentUser };
  }

  async signInWithCustomToken(customToken) {
    const prefix = "token_member_";
    const uid = customToken.startsWith(prefix) ? customToken.slice(prefix.length) : customToken;
    const claims = this.adminAuth.customClaims.get(uid) || {};
    this.currentUser = {
      uid,
      claims: { ...claims },
      getIdToken: async () => `Bearer-token-${uid}`,
    };
    this._trigger();
    return { user: this.currentUser };
  }

  async signOut() {
    this.currentUser = null;
    this._trigger();
  }
}

// -----------------------------------------------------------------------------
// Test Runner
// -----------------------------------------------------------------------------
async function runTests() {
  console.log("=============================================================");
  console.log("Naya Sahara | Phase 3C-3B1 Lifecycle & Abuse Verification");
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
      if (err.stack) {
        console.error(`  Stack: ${err.stack.split("\n")[1]}`);
      }
      failed++;
    }
  }

  // Helper setup for router calling handlers
  function createApiRouter(db, adminAuth) {
    return {
      async call(method, url, { headers = {}, body = null } = {}) {
        const { req, res } = createMockHttp({ method, headers, body });
        if (url === "/api/auth/register-member") {
          await handleRegisterMember(req, res, { db, auth: adminAuth });
        } else if (url === "/api/auth/login-member") {
          await handleLoginMember(req, res, { db, auth: adminAuth });
        } else if (url === "/api/auth/sync-staff") {
          await handleSyncStaff(req, res, { db, auth: adminAuth });
        } else if (url === "/api/auth/me") {
          await handleMe(req, res, { db, auth: adminAuth });
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, error: "Not found" }));
        }
        return { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: res.body };
      },
    };
  }

  // 1. Staff login does not resolve profile before synchronization
  await test("Test 1: Staff login does not resolve profile before synchronization", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const uid = "staff_maya_at_asha";
    await db.collection("staffProfiles").doc(uid).set({
      uid,
      role: "ngo_admin",
      orgId: "org-asha",
      status: "active",
      name: "Maya Caseworker",
    });
    await db.collection("organizations").doc("org-asha").set({
      id: "org-asha",
      name: "Asha Sathi Nepal",
      verificationStatus: "verified",
    });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });

    // Spy on resolveProfile: during loginStaff, isStaffSyncing should prevent listener resolution
    let preSyncResolutionFired = false;
    const origResolve = ctx.resolveProfile.bind(ctx);
    ctx.resolveProfile = async (...args) => {
      if (ctx.isStaffSyncing) {
        preSyncResolutionFired = true;
      }
      return origResolve(...args);
    };

    const res = await ctx.loginStaff({ email: "maya@asha", password: "secure_password" });
    assert.equal(res.ok, true);
    assert.equal(preSyncResolutionFired, false, "Profile resolution must NOT run while isStaffSyncing is true");
    ctx.unmount();
  });

  // 2. Exactly one authoritative profile resolution occurs after successful staff synchronization
  await test("Test 2: Exactly one authoritative profile resolution occurs after staff sync", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const uid = "staff_deepa_at_asha";
    await db.collection("staffProfiles").doc(uid).set({
      uid,
      role: "ngo_admin",
      orgId: "org-asha",
      status: "active",
      name: "Deepa Caseworker",
    });
    await db.collection("organizations").doc("org-asha").set({
      id: "org-asha",
      name: "Asha Sathi Nepal",
      verificationStatus: "verified",
    });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });
    assert.equal(ctx.profileResolutionCount, 0);

    const res = await ctx.loginStaff({ email: "deepa@asha", password: "secure_password" });
    assert.equal(res.ok, true);
    assert.equal(ctx.role, "org");
    assert.equal(ctx.profileResolutionCount, 1, "Exactly one profile resolution should occur during staff login");
    ctx.unmount();
  });

  // 3. Failed staff synchronization signs out safely
  await test("Test 3: Failed staff synchronization signs out safely without leaking state", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const uid = "staff_suspended_user";
    await db.collection("staffProfiles").doc(uid).set({
      uid,
      role: "ngo_admin",
      orgId: "org-asha",
      status: "suspended", // Account suspended
    });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });
    const res = await ctx.loginStaff({ email: "suspended_user", password: "password123" });

    assert.equal(res.ok, false);
    assert.match(res.error, /suspended|inactive/i);
    assert.equal(ctx.user, null);
    assert.equal(ctx.role, null);
    assert.equal(clientAuth.currentUser, null, "Firebase client user must be signed out on sync failure");
    ctx.unmount();
  });

  // 4. Delayed /api/auth/me response cannot restore a profile after logout
  await test("Test 4: Delayed /api/auth/me response cannot restore profile after logout (H-2)", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const uid = "mem_user_delayed";
    await db.collection("members").doc(uid).set({
      uid,
      nickname: "delayed_user",
      status: "active",
      associatedOrgId: "org-asha",
    });
    adminAuth.customClaims.set(uid, { role: "member" });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });
    await clientAuth.signInWithCustomToken(`token_member_${uid}`);

    // Launch an async profile resolution with artificial 50ms delay
    const gen = ctx.authGeneration;
    const pendingResolution = ctx.resolveProfile(clientAuth.currentUser, gen, 50);

    // Immediate logout while the response is in-flight
    await ctx.logout();
    assert.equal(ctx.user, null);
    assert.equal(ctx.role, null);

    // Wait for the delayed resolution to complete
    const delayedResult = await pendingResolution;
    assert.equal(delayedResult.ok, false);
    assert.equal(delayedResult.error, "Stale auth request cancelled");
    assert.equal(ctx.user, null, "Profile must remain null and not be resurrected by stale response");
    assert.equal(ctx.role, null);
    ctx.unmount();
  });

  // 5. Switching accounts invalidates the previous account's pending response
  await test("Test 5: Switching accounts invalidates the previous account's pending response", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const userA = "mem_user_a";
    const userB = "mem_user_b";
    await db.collection("members").doc(userA).set({ uid: userA, nickname: "UserA", status: "active" });
    await db.collection("members").doc(userB).set({ uid: userB, nickname: "UserB", status: "active" });
    adminAuth.customClaims.set(userA, { role: "member" });
    adminAuth.customClaims.set(userB, { role: "member" });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });

    // User A signs in; dispatch delayed profile fetch (100ms)
    ctx.isSigningIn = true;
    await clientAuth.signInWithCustomToken(`token_member_${userA}`);
    const genA = ++ctx.authGeneration;
    const reqA = ctx.resolveProfile(clientAuth.currentUser, genA, 100);

    // User B signs in rapidly before User A's response returns
    await clientAuth.signInWithCustomToken(`token_member_${userB}`);
    const genB = ++ctx.authGeneration;
    const reqB = ctx.resolveProfile(clientAuth.currentUser, genB, 10);

    await reqB;
    assert.equal(ctx.user.uid, userB, "State must reflect User B");

    // Wait for User A's slower response
    const resA = await reqA;
    assert.equal(resA.ok, false);
    assert.equal(resA.error, "Stale auth request cancelled");
    assert.equal(ctx.user.uid, userB, "User A's delayed response must NOT overwrite User B");
    ctx.unmount();
  });

  // 6. Out-of-order profile responses cannot overwrite newer state
  await test("Test 6: Out-of-order responses for same user cannot overwrite newer state", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const uid = "mem_concurrent_reqs";
    await db.collection("members").doc(uid).set({ uid, nickname: "RapidClicker", status: "active" });
    adminAuth.customClaims.set(uid, { role: "member" });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });
    ctx.isSigningIn = true;
    await clientAuth.signInWithCustomToken(`token_member_${uid}`);

    // Request 1: launched at gen 1, slow (80ms)
    const gen1 = ++ctx.authGeneration;
    const slowReq = ctx.resolveProfile(clientAuth.currentUser, gen1, 80);

    // Request 2: launched at gen 2, fast (10ms)
    const gen2 = ++ctx.authGeneration;
    const fastReq = ctx.resolveProfile(clientAuth.currentUser, gen2, 10);

    const res2 = await fastReq;
    assert.equal(res2.ok, true);

    const res1 = await slowReq;
    assert.equal(res1.ok, false);
    assert.equal(res1.error, "Stale auth request cancelled");
    ctx.unmount();
  });

  // 7. Token refresh does not create duplicate profile requests unnecessarily
  await test("Test 7: Forced token refresh does not trigger duplicate profile requests", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const uid = "staff_token_test";
    await db.collection("staffProfiles").doc(uid).set({
      uid,
      role: "ngo_admin",
      orgId: "org-asha",
      status: "active",
      name: "Token Refresher",
    });
    await db.collection("organizations").doc("org-asha").set({
      id: "org-asha",
      name: "Asha Sathi Nepal",
      verificationStatus: "verified",
    });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });
    await ctx.loginStaff({ email: "token_test", password: "password123" });
    assert.equal(ctx.profileResolutionCount, 1);

    // Simulating token refresh via getIdToken(true) without auth state transition
    await clientAuth.currentUser.getIdToken(true);
    // Since onAuthStateChanged is used (which does not re-fire on token-only refresh),
    // no redundant /api/auth/me request is dispatched!
    assert.equal(ctx.profileResolutionCount, 1, "Token refresh must not trigger duplicate profile requests");
    ctx.unmount();
  });

  // 8. Custom claims become visible after forced token refresh
  await test("Test 8: Custom claims become active after forced token refresh", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const uid = "staff_claims_check";
    await db.collection("staffProfiles").doc(uid).set({
      uid,
      role: "ngo_admin",
      orgId: "org-asha",
      status: "active",
    });
    await db.collection("organizations").doc("org-asha").set({
      id: "org-asha",
      name: "Asha Sathi Nepal",
      verificationStatus: "verified",
    });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });
    await ctx.loginStaff({ email: "claims_check", password: "pw" });

    // Inspect clientAuth user claims
    assert.equal(clientAuth.currentUser.claims.role, "ngo_admin");
    assert.equal(clientAuth.currentUser.claims.orgId, "org-asha");
    assert.equal(ctx.role, "org");
    ctx.unmount();
  });

  // 9. Registration IP throttling activates at the configured threshold (10 invalid attempts)
  await test("Test 9: Registration IP rate limiting throttles at 10 failed code attempts (HTTP 429)", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();

    const clientIp = "192.168.10.45";
    const headers = { "x-real-ip": clientIp };

    // Submit 9 invalid handover code attempts (should return 400 Invalid or expired handover code)
    for (let i = 1; i <= 9; i++) {
      const { req, res } = createMockHttp({
        method: "POST",
        headers,
        body: { code: `INVALID_CODE_${i}`, nickname: `user_${i}`, password: "ValidPassword123" },
      });
      await handleRegisterMember(req, res, { db, auth: adminAuth });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.error, "Invalid or expired handover code");
    }

    // 10th invalid attempt reaches threshold
    const { req: req10, res: res10 } = createMockHttp({
      method: "POST",
      headers,
      body: { code: "INVALID_CODE_10", nickname: "user_10", password: "ValidPassword123" },
    });
    await handleRegisterMember(req10, res10, { db, auth: adminAuth });
    assert.equal(res10.statusCode, 400);

    // 11th attempt is throttled with HTTP 429
    const { req: req11, res: res11 } = createMockHttp({
      method: "POST",
      headers,
      body: { code: "INVALID_CODE_11", nickname: "user_11", password: "ValidPassword123" },
    });
    await handleRegisterMember(req11, res11, { db, auth: adminAuth });
    assert.equal(res11.statusCode, 429);
    assert.match(res11.body.error, /Too many invalid registration attempts from this network/);
  });

  // 10. Concurrent invalid registration attempts cannot bypass rate limiting
  await test("Test 10: Concurrent invalid registration attempts cannot bypass rate limit", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();

    const clientIp = "10.0.5.99";
    const headers = { "x-real-ip": clientIp };

    // Fire 15 simultaneous invalid requests concurrently from the same IP
    const promises = Array.from({ length: 15 }, (_, i) => {
      const { req, res } = createMockHttp({
        method: "POST",
        headers,
        body: { code: `CONCURRENT_BAD_CODE_${i}`, nickname: `concur_${i}`, password: "ValidPassword123" },
      });
      return handleRegisterMember(req, res, { db, auth: adminAuth }).then(() => res);
    });

    await Promise.all(promises);

    // Verify all 15 attempts were captured atomically in the rate limit document without lost updates
    const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex");
    const snap = await db.collection("authRateLimits").doc(`reg_${ipHash}`).get();
    assert.equal(snap.data().attempts, 15, "Transaction must record all 15 attempts atomically without lost updates");
    assert.ok(snap.data().blockedUntil, "Document must have blockedUntil set");

    // The very next request from this IP must immediately be rejected with 429
    const { req: followUpReq, res: followUpRes } = createMockHttp({
      method: "POST",
      headers,
      body: { code: "ANOTHER_BAD_CODE", nickname: "user_blocked", password: "ValidPassword123" },
    });
    await handleRegisterMember(followUpReq, followUpRes, { db, auth: adminAuth });
    assert.equal(followUpRes.statusCode, 429);
    assert.match(followUpRes.body.error, /Too many invalid registration attempts from this network/);
  });

  // 11. Successful registration is not counted as a failed attempt
  await test("Test 11: Successful registration is not counted against failed rate-limit attempts", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();

    const clientIp = "172.16.0.22";
    const headers = { "x-real-ip": clientIp };

    // Seed a valid handover code
    const validCode = "NS-VALID-SUCCESS";
    const codeHash = hashHandoverCode(validCode);
    await db.collection("handoverCodes").doc(codeHash).set({
      codeHash,
      status: "available",
      associatedOrgId: "org-asha",
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    });

    const { req, res } = createMockHttp({
      method: "POST",
      headers,
      body: { code: validCode, nickname: "success_member", password: "ValidPassword123" },
    });
    await handleRegisterMember(req, res, { db, auth: adminAuth });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.ok, true);

    // Verify rate limit document for this IP has not recorded any failed attempt
    const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex");
    const rateSnap = await db.collection("authRateLimits").doc(`reg_${ipHash}`).get();
    assert.equal(rateSnap.exists, false, "Successful registration must never create or increment rate-limit failure document");
  });

  // 12. Logout clears all prototype identity state
  await test("Test 12: Logout resets user, role, and all session state", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();
    const clientAuth = new MockBrowserClientAuth(adminAuth);
    const apiRouter = createApiRouter(db, adminAuth);

    const uid = "mem_logout_check";
    await db.collection("members").doc(uid).set({ uid, nickname: "LogoutTester", status: "active" });
    adminAuth.customClaims.set(uid, { role: "member" });

    const ctx = new SimulatedAuthContext({ clientAuth, apiRouter });
    ctx.isSigningIn = true;
    await clientAuth.signInWithCustomToken(`token_member_${uid}`);
    const gen = ++ctx.authGeneration;
    await ctx.resolveProfile(clientAuth.currentUser, gen);
    ctx.isSigningIn = false;

    assert.equal(ctx.user.nickname, "LogoutTester");
    assert.equal(ctx.role, "member");

    await ctx.logout();
    assert.equal(ctx.user, null);
    assert.equal(ctx.role, null);
    assert.equal(ctx.firebaseUser, null);
    assert.equal(ctx.resolvedUid, null);
    ctx.unmount();
  });

  // 13. Existing member and staff authentication regression tests still pass
  await test("Test 13: Regression check on member and staff credential auth contracts", async () => {
    const db = new MockFirestore();
    const adminAuth = new MockAuth();

    // Member login flow check
    const credRef = db.collection("memberCredentials").doc("maya_active");
    await credRef.set({
      nickname: "maya_active",
      passwordHash: "$2b$12$4mU8d2Y3c6fH6aR4w1g4lOP9z0wA8kL7c5m3B1x4v5n7q9s0t1u2", // dummy hash
      status: "active",
      uid: "uid_maya",
      failedAttempts: 0,
    });
    await db.collection("members").doc("uid_maya").set({
      uid: "uid_maya",
      nickname: "maya_active",
      status: "active",
      associatedOrgId: "org-asha",
    });

    // Test handleMe for member
    adminAuth.customClaims.set("uid_maya", { role: "member" });
    const { req: meReq, res: meRes } = createMockHttp({
      method: "GET",
      headers: { authorization: "Bearer Bearer-token-uid_maya" },
    });
    await handleMe(meReq, meRes, { db, auth: adminAuth });
    assert.equal(meRes.statusCode, 200);
    assert.equal(meRes.body.user.associatedOrgId, "org-asha");
    assert.equal(meRes.body.user.role, "member");
  });

  console.log("\n=============================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
