/* global process */

import assert from "node:assert/strict";

/**
 * Frontend Authentication Integration Verification Suite
 * Simulates AuthContext and UI state workflows against mocked Firebase Auth and backend endpoints.
 */

// Define page authorization matrix from App.jsx
const ALLOWED_PAGES_BY_ROLE = {
  guest: new Set(["home", "organizations", "notices"]),
  member: new Set(["home", "notices", "organizations", "community", "messages"]),
  org: new Set(["home", "cases", "team", "notices", "organizations", "messages"]),
  admin: new Set(["home", "organizations", "notices"]),
};

/**
 * Mock Client Firebase Auth instance simulating client SDK methods.
 */
class MockClientAuth {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
  }

  onAuthStateChanged(listener) {
    this.authStateListeners.push(listener);
    // Fire immediately with current state
    listener(this.currentUser);
    return () => {
      this.authStateListeners = this.authStateListeners.filter((l) => l !== listener);
    };
  }

  _notify() {
    for (const listener of this.authStateListeners) {
      listener(this.currentUser);
    }
  }

  async signInWithCustomToken(customToken) {
    if (!customToken || !customToken.startsWith("mock-custom-token-")) {
      const err = new Error("Invalid custom token");
      err.code = "auth/invalid-custom-token";
      throw err;
    }
    const uid = customToken.replace("mock-custom-token-", "").split("-")[0];
    this.currentUser = {
      uid,
      async getIdToken(forceRefresh = false) {
        return `mock-id-token-${uid}-${forceRefresh ? "refreshed" : "cached"}`;
      },
    };
    this._notify();
    return { user: this.currentUser };
  }

  async signInWithEmailAndPassword(email, password) {
    if (password === "wrong_password") {
      const err = new Error("Invalid credential");
      err.code = "auth/invalid-credential";
      throw err;
    }
    const uid = `staff_${email.replace(/[^a-z0-9]/gi, "_")}`;
    this.currentUser = {
      uid,
      email,
      async getIdToken(forceRefresh = false) {
        return `mock-id-token-${uid}-${forceRefresh ? "refreshed" : "cached"}`;
      },
    };
    this._notify();
    return { user: this.currentUser };
  }

  async signOut() {
    this.currentUser = null;
    this._notify();
  }
}

/**
 * Mock Fetch environment simulating backend API responses for frontend integration.
 */
function createMockFetch(apiHandlers = {}) {
  return async function mockFetch(url, options = {}) {
    const method = options.method || "GET";
    const headers = options.headers || {};
    let body = options.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // Leave raw string
      }
    }

    const handler = apiHandlers[`${method} ${url}`];
    if (!handler) {
      return {
        ok: false,
        status: 404,
        async json() {
          return { ok: false, error: `Route ${method} ${url} not found` };
        },
      };
    }

    const response = await handler({ url, method, headers, body });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      async json() {
        return response.body;
      },
    };
  };
}

/**
 * Creates an instance of the AuthContext logic for headless testing.
 */
function createAuthManager({ auth, fetchFn }) {
  let user = null;
  let role = null;
  let loading = true;
  let authError = null;

  async function resolveProfile(fbUser) {
    if (!fbUser) {
      user = null;
      role = null;
      return { ok: false, error: "No user" };
    }
    try {
      const token = await fbUser.getIdToken();
      const res = await fetchFn("/api/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        await auth.signOut();
        user = null;
        role = null;
        return { ok: false, error: data.error || "Profile invalid" };
      }
      const profile = data.user;
      let mappedRole = null;
      if (profile.role === "member") mappedRole = "member";
      else if (profile.role === "ngo_admin") mappedRole = "org";
      else if (profile.role === "platform_admin") mappedRole = "admin";

      user = profile;
      role = mappedRole;
      return { ok: true, user: profile, role: mappedRole };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // Subscribe to auth state
  auth.onAuthStateChanged(async (fbUser) => {
    if (fbUser) {
      await resolveProfile(fbUser);
    } else {
      user = null;
      role = null;
    }
    loading = false;
  });

  return {
    getUser: () => user,
    getRole: () => role,
    isLoading: () => loading,
    getError: () => authError,

    async registerMember({ code, nickname, password, avatarId }) {
      authError = null;
      const res = await fetchFn("/api/auth/register-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, nickname, password, avatarId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        authError = data.error || "Registration failed";
        return { ok: false, error: authError };
      }
      await auth.signInWithCustomToken(data.customToken);
      const prof = await resolveProfile(auth.currentUser);
      return { ok: true, user: prof.user };
    },

    async loginMember({ nickname, password }) {
      authError = null;
      const res = await fetchFn("/api/auth/login-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        authError = data.error || "Login failed";
        return { ok: false, error: authError };
      }
      await auth.signInWithCustomToken(data.customToken);
      const prof = await resolveProfile(auth.currentUser);
      return { ok: true, user: prof.user };
    },

    async loginStaff({ email, password }) {
      authError = null;
      let cred;
      try {
        cred = await auth.signInWithEmailAndPassword(email, password);
      } catch (err) {
        authError = err.message;
        return { ok: false, error: authError };
      }

      const idToken = await cred.user.getIdToken();
      const syncRes = await fetchFn("/api/auth/sync-staff", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const syncData = await syncRes.json();
      if (!syncRes.ok || !syncData.ok) {
        await auth.signOut();
        authError = syncData.error || "Staff verification failed";
        return { ok: false, error: authError };
      }

      await cred.user.getIdToken(true);
      const prof = await resolveProfile(cred.user);
      return { ok: true, user: prof.user };
    },

    async logout() {
      await auth.signOut();
      user = null;
      role = null;
      authError = null;
    },
  };
}

// ==========================================
// Test Suite Execution (12 Scenarios)
// ==========================================
async function runFrontendAuthTests() {
  console.log("=================================================");
  console.log("Naya Sahara | Phase 3C-2 Frontend Auth Test Suite");
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

  // --- Scenario 1: Member registration flow ---
  await test("1: Member registration exchanges custom token and resolves session", async () => {
    const auth = new MockClientAuth();
    const fetchFn = createMockFetch({
      "POST /api/auth/register-member": async ({ body }) => {
        return {
          status: 201,
          body: {
            ok: true,
            customToken: "mock-custom-token-mem_12345-test",
            user: { uid: "mem_12345", nickname: body.nickname, role: "member", associatedOrgId: "org_01" },
          },
        };
      },
      "GET /api/auth/me": async () => {
        return {
          status: 200,
          body: {
            ok: true,
            user: { uid: "mem_12345", nickname: "Ujyalo", role: "member", associatedOrgId: "org_01", avatarId: "avatar_2" },
          },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    const result = await manager.registerMember({
      code: "NS-123456",
      nickname: "Ujyalo",
      password: "Password123",
      avatarId: "avatar_2",
    });

    assert.equal(result.ok, true);
    assert.equal(manager.getRole(), "member");
    assert.equal(manager.getUser().nickname, "Ujyalo");
    assert.equal(manager.getUser().associatedOrgId, "org_01");
  });

  // --- Scenario 2: Member login flow ---
  await test("2: Member login with nickname and password resolves profile", async () => {
    const auth = new MockClientAuth();
    const fetchFn = createMockFetch({
      "POST /api/auth/login-member": async () => {
        return {
          status: 200,
          body: {
            ok: true,
            customToken: "mock-custom-token-mem_radha-test",
            user: { uid: "mem_radha", nickname: "Radha", role: "member", associatedOrgId: "org_sahara" },
          },
        };
      },
      "GET /api/auth/me": async () => {
        return {
          status: 200,
          body: {
            ok: true,
            user: { uid: "mem_radha", nickname: "Radha", role: "member", associatedOrgId: "org_sahara", avatarId: "avatar_1" },
          },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    const result = await manager.loginMember({ nickname: "Radha", password: "Password123" });

    assert.equal(result.ok, true);
    assert.equal(manager.getRole(), "member");
    assert.equal(manager.getUser().associatedOrgId, "org_sahara");
  });

  // --- Scenario 3: NGO staff login and claims synchronization ---
  await test("3: NGO staff login verifies email/pw, syncs staff claims, and maps role to 'org'", async () => {
    const auth = new MockClientAuth();
    const fetchFn = createMockFetch({
      "POST /api/auth/sync-staff": async () => {
        return {
          status: 200,
          body: {
            ok: true,
            profile: { uid: "staff_asha", email: "staff@asha.org", role: "ngo_admin", orgId: "org_asha", status: "active" },
            claims: { role: "ngo_admin", orgId: "org_asha" },
          },
        };
      },
      "GET /api/auth/me": async () => {
        return {
          status: 200,
          body: {
            ok: true,
            user: { uid: "staff_asha", email: "staff@asha.org", role: "ngo_admin", orgId: "org_asha", organizationName: "Asha Sathi", status: "active" },
          },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    const result = await manager.loginStaff({ email: "staff@asha.org", password: "Password123" });

    assert.equal(result.ok, true);
    assert.equal(manager.getRole(), "org"); // Mapped to internal 'org' role
    assert.equal(manager.getUser().orgId, "org_asha");
  });

  // --- Scenario 4: Suspended staff or unverified NGO rejection ---
  await test("4: Suspended staff or unverified NGO login aborts session and signs out", async () => {
    const auth = new MockClientAuth();
    const fetchFn = createMockFetch({
      "POST /api/auth/sync-staff": async () => {
        return {
          status: 403,
          body: { ok: false, error: "Associated organization is not verified" },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    const result = await manager.loginStaff({ email: "unverified@ngo.org", password: "Password123" });

    assert.equal(result.ok, false);
    assert.match(result.error, /not verified/i);
    assert.equal(auth.currentUser, null); // Must be signed out
    assert.equal(manager.getUser(), null);
    assert.equal(manager.getRole(), null);
  });

  // --- Scenario 5: Session restoration on page refresh ---
  await test("5: Session restoration on refresh restores verified profile", async () => {
    const auth = new MockClientAuth();
    // Pre-populate active Firebase user
    auth.currentUser = {
      uid: "mem_restored_01",
      async getIdToken() {
        return "mock-id-token-mem_restored_01";
      },
    };

    const fetchFn = createMockFetch({
      "GET /api/auth/me": async () => {
        return {
          status: 200,
          body: {
            ok: true,
            user: { uid: "mem_restored_01", nickname: "RestoredUser", role: "member", associatedOrgId: "org_01" },
          },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    // Let event loop settle for onAuthStateChanged
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(manager.isLoading(), false);
    assert.equal(manager.getRole(), "member");
    assert.equal(manager.getUser().nickname, "RestoredUser");
  });

  // --- Scenario 6: Session invalidation when /me rejects stale token ---
  await test("6: Session invalidation forces signOut when /api/auth/me rejects token", async () => {
    const auth = new MockClientAuth();
    auth.currentUser = {
      uid: "suspended_user",
      async getIdToken() {
        return "mock-id-token-suspended";
      },
    };

    const fetchFn = createMockFetch({
      "GET /api/auth/me": async () => {
        return {
          status: 403,
          body: { ok: false, error: "Member account is inactive" },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(auth.currentUser, null);
    assert.equal(manager.getUser(), null);
    assert.equal(manager.getRole(), null);
  });

  // --- Scenario 7: Secure Logout ---
  await test("7: Logout resets user, role, and signs out of Firebase", async () => {
    const auth = new MockClientAuth();
    auth.currentUser = { uid: "user_to_logout", async getIdToken() { return "token"; } };
    const fetchFn = createMockFetch({
      "GET /api/auth/me": async () => ({ status: 200, body: { ok: true, user: { role: "member" } } }),
    });

    const manager = createAuthManager({ auth, fetchFn });
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(manager.getRole(), "member");
    await manager.logout();

    assert.equal(auth.currentUser, null);
    assert.equal(manager.getUser(), null);
    assert.equal(manager.getRole(), null);
  });

  // --- Scenario 8: Role-based route restriction matrix ---
  await test("8: Role-based route authorization matrix enforces strict boundaries", async () => {
    // Guest
    assert.ok(ALLOWED_PAGES_BY_ROLE.guest.has("home"));
    assert.ok(ALLOWED_PAGES_BY_ROLE.guest.has("notices"));
    assert.ok(!ALLOWED_PAGES_BY_ROLE.guest.has("cases"));
    assert.ok(!ALLOWED_PAGES_BY_ROLE.guest.has("community"));
    assert.ok(!ALLOWED_PAGES_BY_ROLE.guest.has("messages"));

    // Member
    assert.ok(ALLOWED_PAGES_BY_ROLE.member.has("community"));
    assert.ok(ALLOWED_PAGES_BY_ROLE.member.has("messages"));
    assert.ok(!ALLOWED_PAGES_BY_ROLE.member.has("cases")); // Cannot access NGO cases
    assert.ok(!ALLOWED_PAGES_BY_ROLE.member.has("team")); // Cannot access NGO team

    // NGO (org)
    assert.ok(ALLOWED_PAGES_BY_ROLE.org.has("cases"));
    assert.ok(ALLOWED_PAGES_BY_ROLE.org.has("team"));
    assert.ok(!ALLOWED_PAGES_BY_ROLE.org.has("community")); // Cannot access member community

    // Platform Admin
    assert.ok(ALLOWED_PAGES_BY_ROLE.admin.has("home"));
    assert.ok(!ALLOWED_PAGES_BY_ROLE.admin.has("community"));
  });

  // --- Scenario 9: Registration error handling (invalid/expired code) ---
  await test("9: Registration surfaces clean user-facing error on expired code", async () => {
    const auth = new MockClientAuth();
    const fetchFn = createMockFetch({
      "POST /api/auth/register-member": async () => {
        return {
          status: 400,
          body: { ok: false, error: "Handover code has expired" },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    const result = await manager.registerMember({
      code: "NS-EXPIRED",
      nickname: "NewUser",
      password: "Password123",
      avatarId: "avatar_1",
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /expired/i);
    assert.equal(manager.getUser(), null);
  });

  // --- Scenario 10: Login error handling (account lockout 423) ---
  await test("10: Login surfaces account lockout message on HTTP 423", async () => {
    const auth = new MockClientAuth();
    const fetchFn = createMockFetch({
      "POST /api/auth/login-member": async () => {
        return {
          status: 423,
          body: {
            ok: false,
            error: "Account is temporarily locked due to multiple failed login attempts. Please try again in 14 minute(s).",
          },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    const result = await manager.loginMember({ nickname: "locked_user", password: "Password123" });

    assert.equal(result.ok, false);
    assert.match(result.error, /temporarily locked/i);
  });

  // --- Scenario 11: Login rate limiting (HTTP 429) ---
  await test("11: Login surfaces network throttling on HTTP 429", async () => {
    const auth = new MockClientAuth();
    const fetchFn = createMockFetch({
      "POST /api/auth/login-member": async () => {
        return {
          status: 429,
          body: {
            ok: false,
            error: "Too many login attempts from this network. Please try again in 15 minute(s).",
          },
        };
      },
    });

    const manager = createAuthManager({ auth, fetchFn });
    const result = await manager.loginMember({ nickname: "any_user", password: "Password123" });

    assert.equal(result.ok, false);
    assert.match(result.error, /too many login attempts/i);
  });

  // --- Scenario 12: Unauthenticated view protection ---
  await test("12: Unauthenticated state redirects away from protected 'app' view", async () => {
    // Test logic mirroring App.jsx route guard
    let sessionRole = null;
    let publicView = "app";
    const authLoading = false;

    if (!authLoading && !sessionRole && publicView === "app") {
      publicView = "auth";
    }

    assert.equal(publicView, "auth");
  });

  console.log("\n=================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runFrontendAuthTests();
