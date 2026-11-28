/**
 * Phase 4B-R: Organization Lifecycle, Staff Authorization & Firestore Security Review
 * Mocked endpoint tests — do NOT require a running server.
 *
 * Tests:
 *  Section 1  — Stale Token / Suspended Staff (backend live-profile checks)
 *  Section 2  — Staff Role Authorization
 *  Section 3  — Concurrent Duplicate Applications (F-3 name reservation)
 *  Section 4  — Canonical Organization Visibility (F-4)
 *  Section 5  — Audit Log & Transaction Integrity (F-5)
 */

import assert from "node:assert/strict";

// ─── Shared mock infrastructure ────────────────────────────────────────────────

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.body = body ? JSON.parse(body) : null; },
  };
  return res;
}

function makeReq(method, body = null, headers = {}) {
  const req = {
    method,
    url: "/",
    headers: { "content-type": "application/json", ...headers },
    body,
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(JSON.stringify(body));
    },
  };
  return req;
}

function makeAuthToken(claims = {}) {
  return `Bearer fake-token-${JSON.stringify(claims)}`;
}

function makeAuth(overrides = {}) {
  return {
    async verifyIdToken(token) {
      const match = token.replace("Bearer ", "").match(/fake-token-(.*)/);
      if (!match) throw Object.assign(new Error("invalid-token"), { code: "auth/invalid-token" });
      return JSON.parse(match[1]);
    },
    async createUser(data) {
      if (overrides.createUserError) throw overrides.createUserError;
      return { uid: `uid_${data.email.replace(/[@.]/g, "_")}` };
    },
    async getUserByEmail(email) {
      if (overrides.existingEmail === email) return { uid: "existing_uid" };
      throw Object.assign(new Error("user-not-found"), { code: "auth/user-not-found" });
    },
    async deleteUser() {},
    async setCustomUserClaims() {
      if (overrides.claimsError) throw overrides.claimsError;
    },
    async revokeRefreshTokens() {},
    ...overrides,
  };
}

function makeDb(docs = {}, overrides = {}) {
  const store = { ...docs };

  const makeDocRef = (path) => ({
    path,
    id: path.split("/").pop(),
    async get() {
      const data = store[path];
      return { exists: !!data, data: () => data };
    },
    async set(data) { store[path] = data; },
    async update(data) { store[path] = { ...store[path], ...data }; },
    async delete() { delete store[path]; },
  });

  const makeQuery = (collection, filters = []) => ({
    _collection: collection,
    _filters: filters,
    where(field, op, val) {
      return makeQuery(collection, [...filters, { field, op, val }]);
    },
    async get() {
      const colDocs = Object.entries(store)
        .filter(([k]) => k.startsWith(collection + "/"))
        .map(([k, v]) => {
          const docId = k.substring(collection.length + 1);
          const docPath = k;
          return {
            id: docId,
            ref: makeDocRef(docPath),
            data: () => v,
            exists: true,
          };
        });

      let filtered = colDocs;
      for (const f of filters) {
        filtered = filtered.filter(d => {
          const val = d.data()[f.field];
          if (f.op === "==") return val === f.val;
          return true;
        });
      }
      return { docs: filtered, empty: filtered.length === 0 };
    },
  });

  let batchCommitCount = 0;

  const db = {
    _store: store,
    collection(name) {
      return {
        doc(id) { return makeDocRef(`${name}/${id}`); },
        where(field, op, val) { return makeQuery(name, [{ field, op, val }]); },
        async get() { return makeQuery(name).get(); },
      };
    },
    batch() {
      const ops = [];
      batchCommitCount = 0;
      return {
        set(ref, data) { ops.push({ type: "set", ref, data }); return this; },
        update(ref, data) { ops.push({ type: "update", ref, data }); return this; },
        delete(ref) { ops.push({ type: "delete", ref }); return this; },
        async commit() {
          batchCommitCount++;
          if (overrides.batchFailAfter !== undefined && ops.length > overrides.batchFailAfter) {
            throw new Error("Simulated batch commit failure");
          }
          for (const op of ops) {
            const path = op.ref?.path ?? op.ref?.id;
            if (!path) continue;
            if (op.type === "set") store[path] = op.data;
            if (op.type === "update") store[path] = { ...store[path], ...op.data };
            if (op.type === "delete") delete store[path];
          }
        },
      };
    },
    async runTransaction(fn) {
      const txOps = [];
      const txObj = {
        async get(ref) {
          const data = store[ref.path];
          return { exists: !!data, data: () => data };
        },
        set(ref, data) { txOps.push({ type: "set", ref, data }); },
        delete(ref) { txOps.push({ type: "delete", ref }); },
      };
      let result;
      try {
        result = await fn(txObj);
      } catch (err) {
        throw err; // propagate NAME_RESERVED or other tx errors unchanged
      }
      for (const op of txOps) {
        const path = op.ref?.path ?? op.ref?.id;
        if (!path) continue;
        if (op.type === "set") store[path] = op.data;
        if (op.type === "delete") delete store[path];
      }
      return result;
    },
  };
  return db;
}

// ─── Import handlers ───────────────────────────────────────────────────────────

const { handleOrgStaff } = await import("../frontend/api/org/staff.js");
const { handleAdminOrganizations } = await import("../frontend/api/admin/index.js");
const { handleIssueHandoverCode } = await import("../frontend/api/ngo/issue-handover-code.js");
const { handleApplyOrganization, handleListPublicOrganizations } = await import("../frontend/api/org/index.js");

// ─── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${label}`);
    console.error(`     ${err.message}`);
    failures.push({ label, error: err.message });
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Stale Token / Suspended Staff
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n── Section 1: Stale Token / Suspended Staff (Backend Live-Profile Checks) ──");

await test("4BR-1.1 Suspended staff cannot call /api/org/staff (live status check)", async () => {
  const db = makeDb({
    "staffProfiles/suspended_uid": { uid: "suspended_uid", role: "ngo_admin", orgId: "org1", status: "suspended" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("GET", null, {
    authorization: makeAuthToken({ uid: "suspended_uid", role: "ngo_admin", orgId: "org1" }),
  });
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body?.error?.toLowerCase().includes("suspended") || res.body?.error?.toLowerCase().includes("inactive"),
    `Expected 'suspended/inactive' error, got: ${res.body?.error}`);
});

await test("4BR-1.2 Deactivated staff cannot call /api/ngo/issue-handover-code", async () => {
  const db = makeDb({
    "staffProfiles/deactivated_uid": { uid: "deactivated_uid", role: "ngo_admin", orgId: "org1", status: "deactivated" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", {}, {
    authorization: makeAuthToken({ uid: "deactivated_uid", role: "ngo_admin", orgId: "org1" }),
  });
  const res = makeRes();
  await handleIssueHandoverCode(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
  assert.ok(res.body?.error?.toLowerCase().includes("suspend") || res.body?.error?.toLowerCase().includes("inactive"),
    `Expected suspension error, got: ${res.body?.error}`);
});

await test("4BR-1.3 Active staff with valid token can call /api/org/staff (baseline pass)", async () => {
  const db = makeDb({
    "staffProfiles/active_uid": { uid: "active_uid", role: "ngo_admin", orgId: "org1", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("GET", null, {
    authorization: makeAuthToken({ uid: "active_uid", role: "ngo_admin", orgId: "org1" }),
  });
  req.url = "/?orgId=org1";
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
});

await test("4BR-1.4 Suspended staff cannot provision new staff members", async () => {
  const db = makeDb({
    "staffProfiles/suspended_uid": { uid: "suspended_uid", role: "ngo_admin", orgId: "org1", status: "suspended" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", { action: "provision", email: "new@org.np", password: "Secure123!", name: "New Staff" }, {
    authorization: makeAuthToken({ uid: "suspended_uid", role: "ngo_admin", orgId: "org1" }),
  });
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
});

await test("4BR-1.5 Suspended platform_admin cannot call /api/admin/organizations", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "suspended" },
  });
  const auth = makeAuth();
  const req = makeReq("GET", null, {
    authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }),
  });
  const res = makeRes();
  await handleAdminOrganizations(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
});

await test("4BR-1.6 Staff with missing profile is blocked (not just status check)", async () => {
  const db = makeDb({});
  const auth = makeAuth();
  const req = makeReq("GET", null, {
    authorization: makeAuthToken({ uid: "ghost_uid", role: "ngo_admin", orgId: "org1" }),
  });
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
});

await test("4BR-1.7 Status change to 'suspended' blocks further API calls on same session", async () => {
  // Simulate: staff is active, then gets suspended mid-session
  const db = makeDb({
    "staffProfiles/uid_about_to_suspend": { uid: "uid_about_to_suspend", role: "ngo_admin", orgId: "org1", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();

  // First call succeeds (active)
  const req1 = makeReq("GET", null, {
    authorization: makeAuthToken({ uid: "uid_about_to_suspend", role: "ngo_admin", orgId: "org1" }),
  });
  req1.url = "/?orgId=org1";
  const res1 = makeRes();
  await handleOrgStaff(req1, res1, { db, auth });
  assert.equal(res1.statusCode, 200, "First call should succeed");

  // Now suspend the staff member in Firestore (simulates admin action)
  db._store["staffProfiles/uid_about_to_suspend"].status = "suspended";

  // Second call with the same token should now fail (live Firestore read)
  const req2 = makeReq("GET", null, {
    authorization: makeAuthToken({ uid: "uid_about_to_suspend", role: "ngo_admin", orgId: "org1" }),
  });
  req2.url = "/?orgId=org1";
  const res2 = makeRes();
  await handleOrgStaff(req2, res2, { db, auth });
  assert.equal(res2.statusCode, 403, `Second call with stale token should return 403, got ${res2.statusCode}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Staff Role Authorization
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n── Section 2: Staff Role Authorization ──");

await test("4BR-2.1 ngo_admin cannot call platform_admin-only /api/admin/organizations", async () => {
  const db = makeDb({
    "staffProfiles/ngo_uid": { uid: "ngo_uid", role: "ngo_admin", orgId: "org1", status: "active" },
  });
  const auth = makeAuth();
  const req = makeReq("GET", null, {
    authorization: makeAuthToken({ uid: "ngo_uid", role: "ngo_admin", orgId: "org1" }),
  });
  const res = makeRes();
  await handleAdminOrganizations(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
});

await test("4BR-2.2 ngo_admin cannot view staff of a different organization", async () => {
  const db = makeDb({
    "staffProfiles/ngo_uid": { uid: "ngo_uid", role: "ngo_admin", orgId: "org1", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("GET", null, {
    authorization: makeAuthToken({ uid: "ngo_uid", role: "ngo_admin", orgId: "org1" }),
  });
  req.url = "/?orgId=org2";
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
});

await test("4BR-2.3 ngo_admin provisioning is always scoped to own org (body orgId ignored)", async () => {
  // Production behavior: when callerRole=ngo_admin, targetOrgId is silently locked to
  // callerOrgId. The body orgId for another org is ignored. This prevents cross-org
  // provisioning without returning 403 — the ngo_admin simply cannot escape their org.
  const db = makeDb({
    "staffProfiles/ngo_uid": { uid: "ngo_uid", role: "ngo_admin", orgId: "org1", status: "active" },
    "organizations/org1": { verificationStatus: "verified", caseworkerCount: 1 },
  });
  const auth = makeAuth();
  const req = makeReq("POST",
    { action: "provision", email: "other@org2.np", password: "Secure123!", name: "New Staff", orgId: "org2" },
    { authorization: makeAuthToken({ uid: "ngo_uid", role: "ngo_admin", orgId: "org1" }) }
  );
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  // Should succeed but provision into org1 (not org2)
  assert.equal(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body?.staff?.orgId, "org1", "Provisioned staff must be in ngo_admin's own org (org1), not org2");
});

await test("4BR-2.4 ngo_admin cannot modify staff of another organization via update_status", async () => {
  const db = makeDb({
    "staffProfiles/ngo_uid": { uid: "ngo_uid", role: "ngo_admin", orgId: "org1", status: "active" },
    "staffProfiles/target_uid": { uid: "target_uid", role: "ngo_admin", orgId: "org2", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("POST",
    { action: "update_status", staffUid: "target_uid", status: "suspended" },
    { authorization: makeAuthToken({ uid: "ngo_uid", role: "ngo_admin", orgId: "org1" }) }
  );
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
});

await test("4BR-2.5 Staff cannot self-suspend (self-modification protection)", async () => {
  const db = makeDb({
    "staffProfiles/self_uid": { uid: "self_uid", role: "ngo_admin", orgId: "org1", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("POST",
    { action: "update_status", staffUid: "self_uid", status: "suspended" },
    { authorization: makeAuthToken({ uid: "self_uid", role: "ngo_admin", orgId: "org1" }) }
  );
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 400, `Expected 400 (self-modification), got ${res.statusCode}`);
});

await test("4BR-2.6 Provisioned staff always gets ngo_admin role (never platform_admin)", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("POST",
    { action: "provision", email: "newstaff@org1.np", password: "Secure123!", name: "New Staff", orgId: "org1" },
    { authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }) }
  );
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body?.staff?.role, "ngo_admin", "Provisioned staff must always have ngo_admin role");
});

await test("4BR-2.7 platform_admin profile cannot be modified via org/staff endpoint", async () => {
  const db = makeDb({
    "staffProfiles/ngo_uid": { uid: "ngo_uid", role: "ngo_admin", orgId: "org1", status: "active" },
    "staffProfiles/padmin_uid": { uid: "padmin_uid", role: "platform_admin", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("POST",
    { action: "update_status", staffUid: "padmin_uid", status: "suspended" },
    { authorization: makeAuthToken({ uid: "ngo_uid", role: "ngo_admin", orgId: "org1" }) }
  );
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Concurrent Duplicate Applications (F-3)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n── Section 3: Concurrent Duplicate Applications (F-3 Name Reservation) ──");

await test("4BR-3.1 Single valid application succeeds and creates org + staff + audit", async () => {
  const db = makeDb({});
  const auth = makeAuth();
  const req = makeReq("POST", {
    name: "Sahara Foundation", location: "Kathmandu", focus: "Reintegration support",
    contactEmail: "admin@sahara.np", applicantPassword: "SecurePass1!",
  });
  const res = makeRes();
  await handleApplyOrganization(req, res, { db, auth });
  assert.equal(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body?.orgId, "Response must include orgId");
  // Org document should exist
  const orgKeys = Object.keys(db._store).filter(k => k.startsWith("organizations/"));
  assert.ok(orgKeys.length > 0, "Org document should be in store");
  // Reservation should be cleaned up (deleted by batch)
  const resKeys = Object.keys(db._store).filter(k => k.startsWith("orgNameReservations/"));
  assert.equal(resKeys.length, 0, "Name reservation sentinel should be deleted after successful commit");
});

await test("4BR-3.2 Duplicate name is rejected with 409 (reservation gate)", async () => {
  // Pre-seed a live reservation to simulate a concurrent request that got there first
  const db = makeDb({
    "orgNameReservations/sahara foundation": {
      normalizedName: "sahara foundation",
      reservedAt: { toMillis: () => Date.now() - 5000 }, // 5 sec old, within TTL
    },
  });
  const auth = makeAuth();
  const req = makeReq("POST", {
    name: "Sahara Foundation", location: "Kathmandu", focus: "Reintegration support",
    contactEmail: "admin2@sahara.np", applicantPassword: "SecurePass1!",
  });
  const res = makeRes();
  await handleApplyOrganization(req, res, { db, auth });
  assert.equal(res.statusCode, 409, `Expected 409, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body?.error?.toLowerCase().includes("name"), `Expected name conflict error, got: ${res.body?.error}`);
});

await test("4BR-3.3 Stale reservation (> 15 min) is reclaimed and application proceeds", async () => {
  const db = makeDb({
    "orgNameReservations/stale org": {
      normalizedName: "stale org",
      reservedAt: { toMillis: () => Date.now() - 20 * 60 * 1000 }, // 20 min old, past TTL
    },
  });
  const auth = makeAuth();
  const req = makeReq("POST", {
    name: "Stale Org", location: "Pokhara", focus: "Legal aid for returnees",
    contactEmail: "new@staleorg.np", applicantPassword: "SecurePass1!",
  });
  const res = makeRes();
  await handleApplyOrganization(req, res, { db, auth });
  assert.equal(res.statusCode, 201, `Expected 201 (stale reservation reclaimed), got ${res.statusCode}: ${JSON.stringify(res.body)}`);
});

await test("4BR-3.4 Duplicate email is rejected with 409", async () => {
  const db = makeDb({
    "organizations/org_existing": { normalizedName: "other org", contactEmail: "existing@org.np", verificationStatus: "pending" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", {
    name: "Brand New Org", location: "Chitwan", focus: "Wellbeing services for migrants",
    contactEmail: "existing@org.np", applicantPassword: "SecurePass1!",
  });
  const res = makeRes();
  await handleApplyOrganization(req, res, { db, auth });
  assert.equal(res.statusCode, 409, `Expected 409, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body?.error?.toLowerCase().includes("email"), `Expected email conflict, got: ${res.body?.error}`);
  // Reservation must be released on rejection path
  const resKeys = Object.keys(db._store).filter(k => k.startsWith("orgNameReservations/"));
  assert.equal(resKeys.length, 0, "Reservation should be deleted after email duplicate rejection");
});

await test("4BR-3.5 Failed Firestore batch triggers Auth user cleanup", async () => {
  // Batch will fail on the 4th operation (after org, staff, audit, delete-reservation = 4 ops → fail at >3)
  const db = makeDb({}, { batchFailAfter: 2 });
  let deleteUserCalled = false;
  const auth = makeAuth({ async deleteUser() { deleteUserCalled = true; } });
  const req = makeReq("POST", {
    name: "Failing Org", location: "Bhaktapur", focus: "Mental health support",
    contactEmail: "fail@org.np", applicantPassword: "SecurePass1!",
  });
  const res = makeRes();
  await handleApplyOrganization(req, res, { db, auth });
  assert.equal(res.statusCode, 500, `Expected 500, got ${res.statusCode}`);
  assert.ok(deleteUserCalled, "Auth.deleteUser must be called to clean up Auth user after batch failure");
  // Reservation must also be cleaned up
  const resKeys = Object.keys(db._store).filter(k => k.startsWith("orgNameReservations/"));
  assert.equal(resKeys.length, 0, "Reservation sentinel should be deleted after batch failure");
});

await test("4BR-3.6 Duplicate org name in committed organizations is rejected (post-reservation query)", async () => {
  // Reservation passes (no sentinel), but the org already exists in committed store
  const db = makeDb({
    "organizations/org_exists": { normalizedName: "existing org", contactEmail: "diff@org.np", verificationStatus: "pending" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", {
    name: "Existing Org", location: "Kathmandu", focus: "Youth welfare programs Nepal",
    contactEmail: "new@org.np", applicantPassword: "SecurePass1!",
  });
  const res = makeRes();
  await handleApplyOrganization(req, res, { db, auth });
  assert.equal(res.statusCode, 409, `Expected 409, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Canonical Organization Visibility (F-4)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n── Section 4: Canonical Organization Visibility (F-4) ──");

await test("4BR-4.1 list-public only returns verificationStatus=verified orgs", async () => {
  const db = makeDb({
    "organizations/org_verified": { name: "Verified Org", verificationStatus: "verified", status: "approved", location: "Ktm" },
    "organizations/org_pending": { name: "Pending Org", verificationStatus: "pending", status: "pending", location: "Ktm" },
    "organizations/org_rejected": { name: "Rejected Org", verificationStatus: "rejected", status: "rejected", location: "Ktm" },
    "organizations/org_archived": { name: "Archived Org", verificationStatus: "archived", status: "archived", location: "Ktm" },
  });
  const req = makeReq("GET");
  const res = makeRes();
  await handleListPublicOrganizations(req, res, { db });
  assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  assert.equal(res.body?.organizations?.length, 1, `Expected 1 org, got ${res.body?.organizations?.length}`);
  assert.equal(res.body?.organizations?.[0]?.name, "Verified Org");
});

await test("4BR-4.2 Archived org does not appear in public directory even if legacy status=approved", async () => {
  // Simulates an org that was approved, then archived — legacy data might have status=approved
  const db = makeDb({
    "organizations/org_archived_legacy": {
      name: "Archived Legacy Org",
      verificationStatus: "archived",
      status: "approved", // legacy/stale field — should NOT trigger visibility
      location: "Lalitpur",
    },
  });
  const req = makeReq("GET");
  const res = makeRes();
  await handleListPublicOrganizations(req, res, { db });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.organizations?.length, 0, "Archived org must not appear in public list even if status=approved");
});

await test("4BR-4.3 Rejected org does not appear in public directory", async () => {
  const db = makeDb({
    "organizations/org_rejected": { name: "Rejected Org", verificationStatus: "rejected", status: "rejected", location: "Ktm" },
  });
  const req = makeReq("GET");
  const res = makeRes();
  await handleListPublicOrganizations(req, res, { db });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.organizations?.length, 0, "Rejected org must not appear in public list");
});

await test("4BR-4.4 Pending org does not appear in public directory", async () => {
  const db = makeDb({
    "organizations/org_pending": { name: "Pending Org", verificationStatus: "pending", status: "pending", location: "Ktm" },
  });
  const req = makeReq("GET");
  const res = makeRes();
  await handleListPublicOrganizations(req, res, { db });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.organizations?.length, 0, "Pending org must not appear in public list");
});

await test("4BR-4.5 list-public does not expose applicant credentials or internal fields", async () => {
  const db = makeDb({
    "organizations/org_v": {
      name: "Safe Org", verificationStatus: "verified", status: "approved", location: "Ktm",
      applicantPassword: "secret", applicantUid: "uid123", reviewedBy: "admin_uid", rejectionReason: null,
    },
  });
  const req = makeReq("GET");
  const res = makeRes();
  await handleListPublicOrganizations(req, res, { db });
  const org = res.body?.organizations?.[0];
  assert.ok(org, "Should return one org");
  assert.equal(org.applicantPassword, undefined, "applicantPassword must not be exposed");
  assert.equal(org.applicantUid, undefined, "applicantUid must not be exposed");
  assert.equal(org.reviewedBy, undefined, "reviewedBy must not be exposed");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Audit Log & Transaction Integrity (F-5)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n── Section 5: Audit Log & Transaction Integrity (F-5) ──");

await test("4BR-5.1 Org approval writes audit log in same batch commit as org+staff update", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "active" },
    "organizations/org1": { name: "Test Org", verificationStatus: "pending", status: "pending" },
    "staffProfiles/applicant_uid": { uid: "applicant_uid", role: "ngo_admin", orgId: "org1", status: "pending_verification" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", { orgId: "org1", action: "approve" }, {
    authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }),
  });
  const res = makeRes();
  await handleAdminOrganizations(req, res, { db, auth });
  assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  // Org must now be verified
  assert.equal(db._store["organizations/org1"]?.verificationStatus, "verified", "Org verificationStatus should be verified");
  // Audit log must exist
  const logKeys = Object.keys(db._store).filter(k => k.startsWith("adminAuditLogs/"));
  assert.ok(logKeys.length > 0, "Audit log should be created on org approval");
  // Staff must be active
  assert.equal(db._store["staffProfiles/applicant_uid"]?.status, "active", "Staff should be activated on org approval");
});

await test("4BR-5.2 Org rejection writes audit log and marks staff as rejected", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "active" },
    "organizations/org_reject": { name: "Bad Org", verificationStatus: "pending", status: "pending" },
    "staffProfiles/bad_uid": { uid: "bad_uid", role: "ngo_admin", orgId: "org_reject", status: "pending_verification" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", { orgId: "org_reject", action: "reject", rejectionReason: "Insufficient documentation" }, {
    authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }),
  });
  const res = makeRes();
  await handleAdminOrganizations(req, res, { db, auth });
  assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  assert.equal(db._store["organizations/org_reject"]?.verificationStatus, "rejected");
  assert.equal(db._store["staffProfiles/bad_uid"]?.status, "rejected", "Staff should be marked rejected on org rejection");
  const logKeys = Object.keys(db._store).filter(k => k.startsWith("adminAuditLogs/"));
  assert.ok(logKeys.length > 0, "Audit log should be created on org rejection");
});

await test("4BR-5.3 Org archive writes audit log atomically", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "active" },
    "organizations/org_archive": { name: "Old Org", verificationStatus: "verified", status: "approved" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", { orgId: "org_archive", action: "archive" }, {
    authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }),
  });
  const res = makeRes();
  await handleAdminOrganizations(req, res, { db, auth });
  assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
  assert.equal(db._store["organizations/org_archive"]?.verificationStatus, "archived");
  const logKeys = Object.keys(db._store).filter(k => k.startsWith("adminAuditLogs/"));
  assert.ok(logKeys.length > 0, "Audit log should be created on org archive");
});

await test("4BR-5.4 Staff status update writes audit log atomically in same batch", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "active" },
    "staffProfiles/target_uid": { uid: "target_uid", role: "ngo_admin", orgId: "org1", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("POST",
    { action: "update_status", staffUid: "target_uid", status: "suspended" },
    { authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }) }
  );
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.equal(db._store["staffProfiles/target_uid"]?.status, "suspended", "Staff status should be suspended");
  const logKeys = Object.keys(db._store).filter(k => k.startsWith("adminAuditLogs/"));
  assert.ok(logKeys.length > 0, "Audit log must be written on staff status change");
});

await test("4BR-5.5 Audit log records previousStatus and newStatus on staff update", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "active" },
    "staffProfiles/target_uid": { uid: "target_uid", role: "ngo_admin", orgId: "org1", status: "active" },
    "organizations/org1": { verificationStatus: "verified" },
  });
  const auth = makeAuth();
  const req = makeReq("POST",
    { action: "update_status", staffUid: "target_uid", status: "deactivated" },
    { authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }) }
  );
  const res = makeRes();
  await handleOrgStaff(req, res, { db, auth });
  assert.equal(res.statusCode, 200);
  const logKey = Object.keys(db._store).find(k => k.startsWith("adminAuditLogs/"));
  const log = db._store[logKey];
  assert.ok(log, "Audit log must exist");
  assert.equal(log.action, "STAFF_STATUS_CHANGED", "Audit action must be STAFF_STATUS_CHANGED");
  assert.equal(log.details?.previousStatus, "active", "previousStatus should be 'active'");
  assert.equal(log.details?.newStatus, "deactivated", "newStatus should be 'deactivated'");
});

await test("4BR-5.6 Rejection without reason is blocked (mandatory reason enforcement)", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "active" },
    "organizations/org1": { name: "Test Org", verificationStatus: "pending", status: "pending" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", { orgId: "org1", action: "reject" }, {
    authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }),
  });
  const res = makeRes();
  await handleAdminOrganizations(req, res, { db, auth });
  assert.equal(res.statusCode, 400, `Expected 400 for missing rejection reason, got ${res.statusCode}`);
});

await test("4BR-5.7 Rejection with short reason (< 5 chars) is blocked", async () => {
  const db = makeDb({
    "staffProfiles/admin_uid": { uid: "admin_uid", role: "platform_admin", status: "active" },
    "organizations/org1": { name: "Test Org", verificationStatus: "pending", status: "pending" },
  });
  const auth = makeAuth();
  const req = makeReq("POST", { orgId: "org1", action: "reject", rejectionReason: "No" }, {
    authorization: makeAuthToken({ uid: "admin_uid", role: "platform_admin" }),
  });
  const res = makeRes();
  await handleAdminOrganizations(req, res, { db, auth });
  assert.equal(res.statusCode, 400, `Expected 400 for short rejection reason, got ${res.statusCode}`);
});

// ─── Final Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`Phase 4B-R Security Review: ${passed + failed} tests`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
if (failures.length > 0) {
  console.log("\nFailed tests:");
  for (const f of failures) {
    console.log(`  - ${f.label}`);
    console.log(`    ${f.error}`);
  }
  process.exit(1);
}
console.log("═".repeat(60));
