/**
 * Phase 4B Integration Test Suite
 * Tests: Organization lifecycle, Admin verification, Staff management, Audit logs
 *
 * Uses real handler functions with mock Firestore/Auth to validate business logic.
 * Does NOT connect to real Firebase or deploy anything.
 */

import assert from 'node:assert/strict'
import crypto from 'node:crypto'

// ═══════════════════════════════════════════════════════════════
// Mock Firestore + Auth infrastructure
// ═══════════════════════════════════════════════════════════════

function makeServerTimestamp() {
  const now = new Date()
  return {
    _type: 'serverTimestamp',
    toMillis: () => now.getTime(),
    toDate: () => now,
  }
}

const FieldValue = {
  serverTimestamp: () => makeServerTimestamp(),
  increment: (n) => ({ _type: 'increment', value: n }),
}

function createMockDb() {
  const store = {}

  const mockDoc = (collPath, docId) => {
    const fullPath = `${collPath}/${docId}`
    return {
      get: async () => {
        const data = store[fullPath]
        return {
          exists: Boolean(data),
          id: docId,
          ref: mockDoc(collPath, docId),
          data: () => (data ? { ...data } : undefined),
        }
      },
      set: async (data, opts) => {
        if (opts?.merge) {
          store[fullPath] = { ...(store[fullPath] || {}), ...data }
        } else {
          store[fullPath] = { ...data }
        }
      },
      update: async (data) => {
        store[fullPath] = { ...(store[fullPath] || {}), ...data }
      },
      delete: async () => {
        delete store[fullPath]
      },
    }
  }

  const mockCollection = (collPath) => ({
    doc: (id) => mockDoc(collPath, id),
    where: (field, op, value) => {
      const filters = [{ field, op, value }]
      const queryObj = {
        where: (f2, op2, v2) => {
          filters.push({ field: f2, op: op2, value: v2 })
          return queryObj
        },
        get: async () => {
          const docs = Object.entries(store)
            .filter(([path]) => path.startsWith(`${collPath}/`))
            .filter(([, data]) =>
              filters.every(({ field: f, op: o, value: v }) => {
                if (o === '==') return data?.[f] === v
                return true
              }),
            )
            .map(([path, data]) => {
              const id = path.split('/').pop()
              return {
                id,
                exists: true,
                ref: mockDoc(collPath, id),
                data: () => ({ ...data }),
              }
            })
          return { empty: docs.length === 0, docs }
        },
      }
      return queryObj
    },
    get: async () => {
      const docs = Object.entries(store)
        .filter(([path]) => path.startsWith(`${collPath}/`))
        .map(([path, data]) => {
          const id = path.split('/').pop()
          return {
            id,
            exists: true,
            ref: mockDoc(collPath, id),
            data: () => ({ ...data }),
          }
        })
      return { empty: docs.length === 0, docs }
    },
  })

  const batchOps = []
  const mockBatch = () => {
    const ops = []
    return {
      set: (ref, data, opts) => {
        ops.push({ type: 'set', ref, data, opts })
        return undefined
      },
      update: (ref, data) => {
        ops.push({ type: 'update', ref, data })
        return undefined
      },
      delete: (ref) => {
        ops.push({ type: 'delete', ref })
        return undefined
      },
      commit: async () => {
        for (const op of ops) {
          if (op.type === 'set') {
            await op.ref.set(op.data, op.opts)
          } else if (op.type === 'update') {
            await op.ref.update(op.data)
          } else if (op.type === 'delete') {
            await op.ref.delete()
          }
        }
      },
    }
  }

  return {
    collection: (path) => mockCollection(path),
    batch: mockBatch,
    runTransaction: async (fn) => {
      const tx = {
        get: async (ref) => ref.get(),
        set: (ref, data, opts) => ref.set(data, opts),
        update: (ref, data) => ref.update(data),
        delete: (ref) => ref.delete(),
      }
      return fn(tx)
    },
    _store: store,
  }
}

function createMockAuth(existingEmails = {}) {
  const users = { ...existingEmails }
  const revokedTokens = new Set()

  return {
    _users: users,
    _revokedTokens: revokedTokens,
    verifyIdToken: async (token) => {
      if (token === 'invalid') throw new Error('Firebase ID token has expired or is invalid')
      if (token.startsWith('forged_admin_')) {
        return { uid: token.replace('forged_admin_', ''), role: 'platform_admin' }
      }
      const user = users[token]
      if (!user) throw new Error('No such user')
      return user
    },
    createUser: async ({ email, password, displayName }) => {
      if (users[email]) throw Object.assign(new Error('Email already exists'), { code: 'auth/email-already-exists' })
      const uid = `uid_${crypto.randomBytes(4).toString('hex')}`
      const record = { uid, email, displayName }
      users[email] = { uid, email, displayName }
      users[uid] = record
      return record
    },
    getUserByEmail: async (email) => {
      if (!users[email]) throw Object.assign(new Error('No user found'), { code: 'auth/user-not-found' })
      return users[email]
    },
    deleteUser: async (uid) => {
      const entry = Object.entries(users).find(([, u]) => u?.uid === uid)
      if (entry) delete users[entry[0]]
    },
    setCustomUserClaims: async (uid, claims) => {
      const entry = Object.entries(users).find(([, u]) => u?.uid === uid)
      if (entry) {
        users[entry[0]] = { ...users[entry[0]], ...claims }
      }
    },
    revokeRefreshTokens: async (uid) => {
      revokedTokens.add(uid)
    },
  }
}

// Mock HTTP request / response helpers
function makeReq(method, body = null, headers = {}) {
  const bodyStr = body ? JSON.stringify(body) : ''
  return {
    method,
    headers,
    body: body,
    url: '/api/test',
    socket: { remoteAddress: '127.0.0.1' },
    on: (event, handler) => {
      if (event === 'data' && bodyStr) handler(bodyStr)
      if (event === 'end') handler()
    },
  }
}

function makeRes() {
  const res = { statusCode: 200, headers: {}, body: '' }
  res.setHeader = (k, v) => { res.headers[k] = v }
  res.end = (data) => { res.body = data }
  res.json = () => JSON.parse(res.body)
  return res
}

function bearerReq(method, token, body = null) {
  return makeReq(method, body, { authorization: `Bearer ${token}` })
}

// ═══════════════════════════════════════════════════════════════
// Import handlers
// ═══════════════════════════════════════════════════════════════

import { handleApplyOrganization } from '../frontend/api/org/apply.js'
import { handleListPublicOrganizations } from '../frontend/api/org/list-public.js'
import { handleAdminOrganizations } from '../frontend/api/admin/organizations.js'
import { handleOrgStaff } from '../frontend/api/org/staff.js'

// ═══════════════════════════════════════════════════════════════
// Test runner
// ═══════════════════════════════════════════════════════════════

let passed = 0
let failed = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
    failures.push({ name, error: err.message })
  }
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────────────────────`)
}

// ═══════════════════════════════════════════════════════════════
// Test Suites
// ═══════════════════════════════════════════════════════════════

async function runTests() {
  console.log('\nPhase 4B: Organization Lifecycle & Staff Management\n')

  // ─── 4B-1: Organization Application (POST /api/org/apply) ───

  section('4B-1: Organization Application')

  await test('4B-1.1 Rejects GET method', async () => {
    const db = createMockDb()
    const auth = createMockAuth()
    const req = makeReq('GET')
    const res = makeRes()
    await handleApplyOrganization(req, res, { db, auth })
    assert.equal(res.statusCode, 405)
    assert.equal(res.json().ok, false)
  })

  await test('4B-1.2 Rejects request with missing name', async () => {
    const db = createMockDb()
    const auth = createMockAuth()
    const req = makeReq('POST', {
      focus: 'Community support',
      applicantEmail: 'test@test.org',
      applicantPassword: 'secure123',
    })
    const res = makeRes()
    await handleApplyOrganization(req, res, { db, auth })
    assert.equal(res.statusCode, 400)
    assert.match(res.json().error, /name/i)
  })

  await test('4B-1.3 Rejects request with missing contact email', async () => {
    const db = createMockDb()
    const auth = createMockAuth()
    const req = makeReq('POST', {
      name: 'Valid NGO',
      location: 'Kathmandu',
      focus: 'Community support and reintegration',
      applicantPassword: 'secure123',
    })
    const res = makeRes()
    await handleApplyOrganization(req, res, { db, auth })
    assert.equal(res.statusCode, 400)
    assert.match(res.json().error, /email/i)
  })

  await test('4B-1.4 Rejects weak password (< 8 chars)', async () => {
    const db = createMockDb()
    const auth = createMockAuth()
    const req = makeReq('POST', {
      name: 'Valid NGO',
      location: 'Kathmandu',
      focus: 'Community support',
      applicantEmail: 'admin@valid.org',
      applicantPassword: 'short',
    })
    const res = makeRes()
    await handleApplyOrganization(req, res, { db, auth })
    assert.equal(res.statusCode, 400)
    assert.match(res.json().error, /password/i)
  })

  await test('4B-1.5 Valid application creates org + staffProfile + auditLog', async () => {
    const db = createMockDb()
    const auth = createMockAuth()
    const req = makeReq('POST', {
      name: 'Sunrise Foundation Nepal',
      location: 'Pokhara',
      category: 'Skills & Reintegration',
      focus: 'Supporting post-release women through vocational training',
      contactPhone: '+977-61-123456',
      applicantEmail: 'admin@sunrise.org.np',
      applicantPassword: 'sunrise_secure_2024',
    })
    const res = makeRes()
    await handleApplyOrganization(req, res, { db, auth })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.equal(body.ok, true)
    assert.ok(body.orgId, 'orgId must be returned')
    assert.equal(body.status, 'pending')

    // Verify org document exists in mock store
    const orgSnap = await db.collection('organizations').doc(body.orgId).get()
    assert.ok(orgSnap.exists, 'Organization document must exist in Firestore')
    assert.equal(orgSnap.data().verificationStatus, 'pending')
    assert.equal(orgSnap.data().status, 'pending')
    assert.ok(orgSnap.data().applicantUid, 'applicantUid must be stored')

    // Verify staffProfile document exists
    const applicantUid = orgSnap.data().applicantUid
    const staffSnap = await db.collection('staffProfiles').doc(applicantUid).get()
    assert.ok(staffSnap.exists, 'StaffProfile must be created for applicant')
    assert.equal(staffSnap.data().status, 'pending_verification')
    assert.equal(staffSnap.data().role, 'ngo_admin')
    assert.equal(staffSnap.data().orgId, body.orgId)

    // Verify audit log
    const hasAuditLog = Object.entries(db._store).some(
      ([key, val]) =>
        key.startsWith('adminAuditLogs/') &&
        val.action === 'ORG_APPLIED' &&
        val.targetId === body.orgId,
    )
    assert.ok(hasAuditLog, 'ORG_APPLIED audit log must be recorded')
  })

  await test('4B-1.6 Duplicate name blocked (409)', async () => {
    const db = createMockDb()
    const auth = createMockAuth()
    // Seed an existing org
    await db.collection('organizations').doc('org_existing').set({
      normalizedName: 'sunrise foundation nepal',
      contactEmail: 'other@email.com',
    })
    const req = makeReq('POST', {
      name: 'Sunrise Foundation Nepal',
      location: 'Kathmandu',
      focus: 'Community support and reintegration services',
      applicantEmail: 'newadmin@sunrise2.org',
      applicantPassword: 'secure_pass_2024',
    })
    const res = makeRes()
    await handleApplyOrganization(req, res, { db, auth })
    assert.equal(res.statusCode, 409)
    assert.match(res.json().error, /already/i)
  })

  await test('4B-1.7 Duplicate email blocked (409)', async () => {
    const db = createMockDb()
    const auth = createMockAuth()
    await db.collection('organizations').doc('org_existing').set({
      normalizedName: 'different org',
      contactEmail: 'admin@duplicate.org',
    })
    const req = makeReq('POST', {
      name: 'New Organization Nepal',
      location: 'Lalitpur',
      focus: 'General support and reintegration services',
      applicantEmail: 'admin@duplicate.org',
      applicantPassword: 'secure_pass_2024',
    })
    const res = makeRes()
    await handleApplyOrganization(req, res, { db, auth })
    assert.equal(res.statusCode, 409)
    assert.match(res.json().error, /email/i)
  })

  // ─── 4B-2: Public Organization Directory (GET /api/org/list-public) ───

  section('4B-2: Public Organization Directory')

  await test('4B-2.1 Returns only verified organizations', async () => {
    const db = createMockDb()
    await db.collection('organizations').doc('org_verified').set({
      name: 'Verified NGO', location: 'Kathmandu', category: 'Support',
      focus: 'Aid', verificationStatus: 'verified',
    })
    await db.collection('organizations').doc('org_pending').set({
      name: 'Pending NGO', location: 'Pokhara', category: 'Other',
      focus: 'Unknown', verificationStatus: 'pending',
    })
    await db.collection('organizations').doc('org_rejected').set({
      name: 'Rejected NGO', location: 'Lalitpur', category: 'None',
      focus: 'N/A', verificationStatus: 'rejected',
    })

    const req = makeReq('GET')
    const res = makeRes()
    await handleListPublicOrganizations(req, res, { db })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.ok, true)
    assert.equal(body.organizations.length, 1)
    assert.equal(body.organizations[0].name, 'Verified NGO')
  })

  await test('4B-2.2 Rejects POST method', async () => {
    const db = createMockDb()
    const req = makeReq('POST')
    const res = makeRes()
    await handleListPublicOrganizations(req, res, { db })
    assert.equal(res.statusCode, 405)
  })

  await test('4B-2.3 Does not expose applicant credentials or review notes', async () => {
    const db = createMockDb()
    await db.collection('organizations').doc('org_v').set({
      name: 'Safe NGO', location: 'Kathmandu', category: 'Support',
      focus: 'Community aid', verificationStatus: 'verified',
      applicantPassword: 'TOP_SECRET', rejectionReason: 'internal_note',
    })
    const req = makeReq('GET')
    const res = makeRes()
    await handleListPublicOrganizations(req, res, { db })
    const org = res.json().organizations[0]
    assert.equal(org.applicantPassword, undefined, 'Must not expose applicantPassword')
    assert.equal(org.rejectionReason, undefined, 'Must not expose rejectionReason in public view')
  })

  // ─── 4B-3: Admin Organization Management (GET+POST /api/admin/organizations) ───

  section('4B-3: Admin Organization Management')

  function setupAdminScenario() {
    const db = createMockDb()
    const authMock = createMockAuth()

    const adminUid = 'admin_uid_001'
    // Set up verified admin token
    authMock._users['valid_admin_token'] = {
      uid: adminUid,
      role: 'platform_admin',
    }

    // Active platform admin profile
    db._store[`staffProfiles/${adminUid}`] = {
      uid: adminUid,
      role: 'platform_admin',
      status: 'active',
      email: 'admin@platform.org',
    }

    // A pending organization
    db._store['organizations/org_pending_001'] = {
      id: 'org_pending_001',
      name: 'Test NGO Nepal',
      normalizedName: 'test ngo nepal',
      location: 'Kathmandu',
      focus: 'Community support',
      applicantUid: 'staff_pending_uid',
      contactEmail: 'staff@testngo.org',
      verificationStatus: 'pending',
      status: 'pending',
      caseworkerCount: 1,
    }

    // Pending staff profile associated with that org
    db._store[`staffProfiles/staff_pending_uid`] = {
      uid: 'staff_pending_uid',
      orgId: 'org_pending_001',
      role: 'ngo_admin',
      status: 'pending_verification',
      email: 'staff@testngo.org',
    }

    return { db, auth: authMock, adminToken: 'valid_admin_token', adminUid }
  }

  await test('4B-3.1 Unauthenticated request returns 401', async () => {
    const { db, auth } = setupAdminScenario()
    const req = makeReq('GET', null, {})
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 401)
  })

  await test('4B-3.2 Non-admin token (member) returns 403', async () => {
    const { db, auth } = setupAdminScenario()
    auth._users['member_token'] = { uid: 'member_uid', role: 'member' }
    const req = bearerReq('GET', 'member_token')
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 403)
  })

  await test('4B-3.3 Forged platform_admin claim without active staff profile returns 403', async () => {
    const { db, auth } = setupAdminScenario()
    // Token claims platform_admin but no staffProfile exists for this uid
    auth._users['forged_token'] = { uid: 'nonexistent_uid', role: 'platform_admin' }
    const req = bearerReq('GET', 'forged_token')
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 403)
    assert.match(res.json().error, /not found|profile/i)
  })

  await test('4B-3.4 Admin GET returns all organizations including pending', async () => {
    const { db, auth, adminToken } = setupAdminScenario()
    const req = bearerReq('GET', adminToken)
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.ok, true)
    assert.ok(body.organizations.length >= 1, 'Should return at least the pending org')
    const pendingOrg = body.organizations.find((o) => o.id === 'org_pending_001')
    assert.ok(pendingOrg, 'Pending org must be visible to admin')
  })

  await test('4B-3.5 Admin can approve org and staff is activated', async () => {
    const { db, auth, adminToken } = setupAdminScenario()
    const req = bearerReq('POST', adminToken, { orgId: 'org_pending_001', action: 'approve' })
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.ok, true)
    assert.equal(body.verificationStatus, 'verified')

    // Org should be verified in mock store
    const orgData = db._store['organizations/org_pending_001']
    assert.equal(orgData.verificationStatus, 'verified')
    assert.equal(orgData.status, 'approved')
    assert.equal(orgData.reviewedBy, 'admin_uid_001')

    // Staff should be activated
    const staffData = db._store['staffProfiles/staff_pending_uid']
    assert.equal(staffData.status, 'active')

    // Audit log should exist for ORG_APPROVED
    const hasAuditLog = Object.entries(db._store).some(
      ([key, val]) =>
        key.startsWith('adminAuditLogs/') &&
        val.action === 'ORG_APPROVED' &&
        val.targetId === 'org_pending_001',
    )
    assert.ok(hasAuditLog, 'ORG_APPROVED audit log must be created')
  })

  await test('4B-3.6 Admin rejection requires a reason', async () => {
    const { db, auth, adminToken } = setupAdminScenario()
    const req = bearerReq('POST', adminToken, { orgId: 'org_pending_001', action: 'reject' })
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 400)
    assert.match(res.json().error, /reason/i)
  })

  await test('4B-3.7 Admin rejection with reason updates org and staff', async () => {
    const { db, auth, adminToken } = setupAdminScenario()
    const reason = 'Insufficient documentation provided during review'
    const req = bearerReq('POST', adminToken, {
      orgId: 'org_pending_001',
      action: 'reject',
      rejectionReason: reason,
    })
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 200)

    const orgData = db._store['organizations/org_pending_001']
    assert.equal(orgData.verificationStatus, 'rejected')
    assert.equal(orgData.rejectionReason, reason)

    const staffData = db._store['staffProfiles/staff_pending_uid']
    assert.equal(staffData.status, 'rejected')

    const hasAuditLog = Object.entries(db._store).some(
      ([key, val]) =>
        key.startsWith('adminAuditLogs/') &&
        val.action === 'ORG_REJECTED' &&
        val.details?.rejectionReason === reason,
    )
    assert.ok(hasAuditLog, 'ORG_REJECTED audit log with reason must exist')
  })

  await test('4B-3.8 Admin can archive a verified org', async () => {
    const { db, auth, adminToken } = setupAdminScenario()
    // First approve it
    db._store['organizations/org_pending_001'].verificationStatus = 'verified'
    db._store['organizations/org_pending_001'].status = 'approved'

    const req = bearerReq('POST', adminToken, { orgId: 'org_pending_001', action: 'archive' })
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 200)
    assert.equal(db._store['organizations/org_pending_001'].verificationStatus, 'archived')
  })

  await test('4B-3.9 Admin can restore an archived org', async () => {
    const { db, auth, adminToken } = setupAdminScenario()
    db._store['organizations/org_pending_001'].verificationStatus = 'archived'
    db._store['organizations/org_pending_001'].status = 'archived'

    const req = bearerReq('POST', adminToken, { orgId: 'org_pending_001', action: 'restore' })
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 200)
    assert.equal(db._store['organizations/org_pending_001'].verificationStatus, 'verified')
  })

  await test('4B-3.10 Suspended admin account blocked', async () => {
    const { db, auth, adminToken, adminUid } = setupAdminScenario()
    db._store[`staffProfiles/${adminUid}`].status = 'suspended'

    const req = bearerReq('GET', adminToken)
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 403)
    assert.match(res.json().error, /inactive|suspended/i)
  })

  // ─── 4B-4: Staff Management (GET+POST /api/org/staff) ───

  section('4B-4: Staff Management')

  function setupOrgScenario() {
    const db = createMockDb()
    const authMock = createMockAuth()

    const orgAdminUid = 'org_admin_uid_001'
    const orgId = 'org_active_001'

    authMock._users['ngo_admin_token'] = { uid: orgAdminUid, role: 'ngo_admin', orgId }

    db._store[`staffProfiles/${orgAdminUid}`] = {
      uid: orgAdminUid,
      role: 'ngo_admin',
      orgId,
      status: 'active',
      email: 'admin@activeorg.org',
    }

    db._store[`organizations/${orgId}`] = {
      id: orgId,
      name: 'Active Org Nepal',
      verificationStatus: 'verified',
      status: 'approved',
    }

    return { db, auth: authMock, ngoToken: 'ngo_admin_token', orgAdminUid, orgId }
  }

  await test('4B-4.1 Unauthenticated request returns 401', async () => {
    const { db, auth } = setupOrgScenario()
    const req = makeReq('GET', null, {})
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 401)
  })

  await test('4B-4.2 NGO admin can list their own staff', async () => {
    const { db, auth, ngoToken, orgAdminUid, orgId } = setupOrgScenario()
    const req = bearerReq('GET', ngoToken)
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.ok, true)
    assert.ok(Array.isArray(body.staff), 'staff must be an array')
  })

  await test('4B-4.3 NGO admin cannot view staff of another organization', async () => {
    const { db, auth, ngoToken } = setupOrgScenario()
    const req = bearerReq('GET', ngoToken)
    req.url = '/api/org/staff?orgId=org_other_999'
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 403)
    assert.match(res.json().error, /not authorized|another organization/i)
  })

  await test('4B-4.4 NGO admin can provision new caseworker', async () => {
    const { db, auth, ngoToken, orgId } = setupOrgScenario()
    const req = bearerReq('POST', ngoToken, {
      action: 'provision',
      name: 'Sita Sharma',
      email: 'sita.sharma@activeorg.org',
      password: 'sita_secure_pass123',
      roleTitle: 'Community Caseworker',
    })
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.equal(body.ok, true)
    assert.equal(body.staff.name, 'Sita Sharma')
    assert.equal(body.staff.orgId, orgId)
    assert.equal(body.staff.role, 'ngo_admin')

    // Verify staffProfile was persisted
    const staffSnap = await db.collection('staffProfiles').doc(body.staff.uid).get()
    assert.ok(staffSnap.exists, 'New staff profile must exist in store')
    assert.equal(staffSnap.data().status, 'active')

    // Audit log
    const hasAudit = Object.entries(db._store).some(
      ([key, val]) =>
        key.startsWith('adminAuditLogs/') &&
        val.action === 'STAFF_PROVISIONED' &&
        val.details?.name === 'Sita Sharma',
    )
    assert.ok(hasAudit, 'STAFF_PROVISIONED audit log must exist')
  })

  await test('4B-4.5 Staff cannot be provisioned with invalid email', async () => {
    const { db, auth, ngoToken } = setupOrgScenario()
    const req = bearerReq('POST', ngoToken, {
      action: 'provision',
      name: 'Invalid Email Test',
      email: 'not-an-email',
      password: 'pass12345678',
    })
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 400)
    assert.match(res.json().error, /email/i)
  })

  await test('4B-4.6 NGO admin can suspend a caseworker', async () => {
    const { db, auth, ngoToken, orgId } = setupOrgScenario()
    const targetUid = 'caseworker_uid_002'
    db._store[`staffProfiles/${targetUid}`] = {
      uid: targetUid, orgId, role: 'ngo_admin', status: 'active', email: 'cw@test.org',
    }

    const req = bearerReq('POST', ngoToken, {
      action: 'update_status',
      staffUid: targetUid,
      status: 'suspended',
    })
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 200)
    assert.equal(db._store[`staffProfiles/${targetUid}`].status, 'suspended')

    // Verify refresh token was revoked
    assert.ok(auth._revokedTokens.has(targetUid), 'Refresh tokens must be revoked for suspended staff')

    // Audit log
    const hasAudit = Object.entries(db._store).some(
      ([key, val]) =>
        key.startsWith('adminAuditLogs/') &&
        val.action === 'STAFF_STATUS_CHANGED' &&
        val.targetId === targetUid &&
        val.details?.newStatus === 'suspended',
    )
    assert.ok(hasAudit, 'STAFF_STATUS_CHANGED audit log must exist')
  })

  await test('4B-4.7 Staff cannot change their own status', async () => {
    const { db, auth, ngoToken, orgAdminUid } = setupOrgScenario()
    const req = bearerReq('POST', ngoToken, {
      action: 'update_status',
      staffUid: orgAdminUid,
      status: 'suspended',
    })
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 400)
    assert.match(res.json().error, /own account/i)
  })

  await test('4B-4.8 Staff cannot modify staff of another organization', async () => {
    const { db, auth, ngoToken } = setupOrgScenario()
    db._store['staffProfiles/other_org_staff'] = {
      uid: 'other_org_staff', orgId: 'different_org_999', role: 'ngo_admin', status: 'active',
    }
    const req = bearerReq('POST', ngoToken, {
      action: 'update_status',
      staffUid: 'other_org_staff',
      status: 'suspended',
    })
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 403)
    assert.match(res.json().error, /another organization/i)
  })

  await test('4B-4.9 Platform admin status cannot be modified via org/staff endpoint', async () => {
    const { db, auth, ngoToken } = setupOrgScenario()
    db._store['staffProfiles/platform_admin_target'] = {
      uid: 'platform_admin_target', role: 'platform_admin', status: 'active', orgId: 'org_active_001',
    }
    const req = bearerReq('POST', ngoToken, {
      action: 'update_status',
      staffUid: 'platform_admin_target',
      status: 'suspended',
    })
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 403)
    assert.match(res.json().error, /platform administrator/i)
  })

  await test('4B-4.10 Suspended NGO admin cannot access staff management', async () => {
    const { db, auth, ngoToken, orgAdminUid } = setupOrgScenario()
    db._store[`staffProfiles/${orgAdminUid}`].status = 'suspended'

    const req = bearerReq('GET', ngoToken)
    const res = makeRes()
    await handleOrgStaff(req, res, { db, auth })
    assert.equal(res.statusCode, 403)
    assert.match(res.json().error, /suspended|inactive/i)
  })

  // ─── 4B-5: Audit Log Integrity ───

  section('4B-5: Audit Log Integrity')

  await test('4B-5.1 Application creates ORG_APPLIED audit log with correct fields', async () => {
    const db = createMockDb()
    const auth = createMockAuth()
    const req = makeReq('POST', {
      name: 'Audit Test Nepal Foundation',
      location: 'Bhaktapur',
      focus: 'Trauma-informed community support services',
      applicantEmail: 'audit@testfoundation.org',
      applicantPassword: 'audit_secure_2024',
    })
    const res = makeRes()
    await handleApplyOrganization(req, res, { db, auth })
    assert.equal(res.statusCode, 201)

    const orgId = res.json().orgId
    const auditEntries = Object.entries(db._store)
      .filter(([key]) => key.startsWith('adminAuditLogs/'))
      .map(([, val]) => val)

    const appliedLog = auditEntries.find((e) => e.action === 'ORG_APPLIED' && e.targetId === orgId)
    assert.ok(appliedLog, 'ORG_APPLIED log must exist')
    assert.equal(appliedLog.targetType, 'organization')
    assert.ok(appliedLog.actorUid, 'actorUid must be recorded')
    assert.equal(appliedLog.actorRole, 'applicant')
    assert.ok(appliedLog.details?.orgName, 'details.orgName must be recorded')
  })

  await test('4B-5.2 Approval creates ORG_APPROVED log with reviewedBy', async () => {
    const { db, auth, adminToken, adminUid } = setupAdminScenario()
    const req = bearerReq('POST', adminToken, { orgId: 'org_pending_001', action: 'approve' })
    const res = makeRes()
    await handleAdminOrganizations(req, res, { db, auth })
    assert.equal(res.statusCode, 200)

    const auditEntries = Object.entries(db._store)
      .filter(([key]) => key.startsWith('adminAuditLogs/'))
      .map(([, val]) => val)

    const approvedLog = auditEntries.find((e) => e.action === 'ORG_APPROVED')
    assert.ok(approvedLog, 'ORG_APPROVED audit log must exist')
    assert.equal(approvedLog.actorUid, adminUid)
    assert.equal(approvedLog.actorRole, 'platform_admin')
    assert.equal(approvedLog.targetId, 'org_pending_001')
  })

  // ─── Print Summary ───

  console.log('\n' + '═'.repeat(65))
  console.log(`Phase 4B Results: ${passed} passed, ${failed} failed`)
  if (failures.length > 0) {
    console.log('\nFailed tests:')
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f.name}\n     ${f.error}`))
  }
  console.log('═'.repeat(65))

  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Test suite crashed:', err)
  process.exit(1)
})
