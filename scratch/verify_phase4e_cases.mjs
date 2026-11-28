/**
 * Phase 4E Integration Test Suite — Cases & Member Record Management
 *
 * Validates:
 *  1. Case creation by NGO staff for associated members
 *  2. Association enforcement (cannot create case for a member of another NGO)
 *  3. Organization isolation (NGO staff cannot access other orgs' cases)
 *  4. Member access restrictions (members only see their own cases)
 *  5. Caseworker assignment and reassignment
 *  6. Case status and priority updates
 *  7. Case progress notes creation (internal vs member_visible)
 *  8. Note visibility isolation (members cannot view internal notes)
 *  9. Member write restrictions (members cannot create/update cases or notes)
 * 10. Audit logging in adminAuditLogs for case creation and updates
 */

import assert from 'node:assert/strict';
import { handleCases, handleCaseNotes } from '../frontend/api/cases/index.js';

// ── Mock Firestore & Auth ───────────────────────────────────────────────

function makeServerTimestamp() {
  const now = new Date();
  return {
    _type: 'serverTimestamp',
    toMillis: () => now.getTime(),
    toDate: () => now,
  };
}

function createMockDb() {
  const store = {};

  const getDocSnap = (fullPath, docId) => {
    const data = store[fullPath];
    return {
      exists: Boolean(data),
      id: docId,
      data: () => (data ? { ...data } : undefined),
    };
  };

  const db = {
    _store: store,
    collection: (collPath) => {
      const collObj = {
        doc: (docId) => {
          const fullPath = `${collPath}/${docId}`;
          return {
            get: async () => getDocSnap(fullPath, docId),
            set: async (data, opts) => {
              if (opts?.merge) {
                store[fullPath] = { ...(store[fullPath] || {}), ...data };
              } else {
                store[fullPath] = { ...data };
              }
            },
            update: async (data) => {
              if (!store[fullPath]) throw new Error(`Document ${fullPath} not found`);
              store[fullPath] = { ...store[fullPath], ...data };
            },
            delete: async () => {
              delete store[fullPath];
            },
            collection: (subCollPath) => db.collection(`${fullPath}/${subCollPath}`),
          };
        },
        where: (field, op, val) => {
          let filters = [{ field, op, val }];
          const queryObj = {
            where: (f2, op2, val2) => {
              filters.push({ field: f2, op: op2, val: val2 });
              return queryObj;
            },
            orderBy: () => queryObj,
            get: async () => {
              const prefix = `${collPath}/`;
              const matching = Object.entries(store)
                .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
                .map(([k, data]) => ({
                  id: k.slice(prefix.length),
                  data: () => ({ ...data }),
                }))
                .filter((doc) => {
                  const d = doc.data();
                  return filters.every(({ field: f, op: o, val: v }) => {
                    if (o === '==') return d[f] === v;
                    return true;
                  });
                });
              return { docs: matching, size: matching.length };
            },
          };
          return queryObj;
        },
        get: async () => {
          const prefix = `${collPath}/`;
          const matching = Object.entries(store)
            .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
            .map(([k, data]) => ({
              id: k.slice(prefix.length),
              data: () => ({ ...data }),
            }));
          return { docs: matching, size: matching.length };
        },
      };
      return collObj;
    },
  };

  return db;
}

function createMockAuth(users = {}) {
  return {
    verifyIdToken: async (token) => {
      const user = users[token];
      if (!user) throw new Error('Invalid or expired token');
      return user;
    },
  };
}

function makeReqRes({ method = 'GET', url = '/api/cases', token, body } = {}) {
  const req = {
    method,
    url,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  let statusCode = 200;
  let responseData = '';

  const res = {
    setHeader: () => {},
    set statusCode(code) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
    end: (chunk) => {
      if (chunk) responseData += chunk;
    },
    _json: () => {
      try {
        return JSON.parse(responseData);
      } catch {
        return responseData;
      }
    },
  };

  return { req, res };
}

// ── Tests ────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('🧪 Starting Phase 4E Cases & Member Record Management Test Suite\n');

  const db = createMockDb();
  const auth = createMockAuth({
    'token-ngo-1': { uid: 'staff-1', role: 'ngo_admin', orgId: 'org-1' },
    'token-ngo-2': { uid: 'staff-2', role: 'ngo_admin', orgId: 'org-2' },
    'token-member-1': { uid: 'mem-1', role: 'member' },
    'token-member-2': { uid: 'mem-2', role: 'member' },
    'token-admin': { uid: 'admin-1', role: 'platform_admin' },
  });

  // Seed members in Firestore
  // mem-1 is associated with org-1
  await db.collection('members').doc('mem-1').set({
    memberId: 'mem-1',
    nickname: 'Sajilo',
    associatedOrgId: 'org-1',
    status: 'active',
  });

  // mem-2 is associated with org-2
  await db.collection('members').doc('mem-2').set({
    memberId: 'mem-2',
    nickname: 'Prakriti',
    associatedOrgId: 'org-2',
    status: 'active',
  });

  let createdCaseId;

  // ── TEST 1: NGO staff cannot create case for member of another NGO ───────
  {
    console.log('Test 1: NGO staff cannot create case for member of another NGO');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/cases',
      token: 'token-ngo-1',
      body: {
        memberId: 'mem-2', // belongs to org-2!
        caseTitle: 'Cross-Org Case Attempt',
        category: 'Reintegration',
      },
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 403);
    assert.equal(json.ok, false);
    assert.match(json.error, /not associated with your organization/i);
    console.log('  ✅ Cross-organization case creation correctly blocked (403)');
  }

  // ── TEST 2: Member cannot create a case ──────────────────────────────────
  {
    console.log('\nTest 2: Member cannot create a case');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/cases',
      token: 'token-member-1',
      body: {
        memberId: 'mem-1',
        caseTitle: 'Member Self-Created Case',
      },
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 403);
    assert.equal(json.ok, false);
    console.log('  ✅ Unauthorized member case creation blocked (403)');
  }

  // ── TEST 3: NGO staff creates case for associated member ─────────────────
  {
    console.log('\nTest 3: NGO staff creates support case for associated member');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/cases',
      token: 'token-ngo-1',
      body: {
        memberId: 'mem-1',
        caseTitle: 'Tailoring Apprenticeship & Stipend Plan',
        category: 'Livelihood & Skills',
        priority: 'high',
        assignedStaffId: 'staff-worker-1',
        assignedStaffName: 'Maya Sharma',
        description: 'Transitioning to community workshop; grant stipend approved.',
      },
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 201);
    assert.equal(json.ok, true);
    assert.ok(json.caseId);
    assert.equal(json.case.status, 'open');
    assert.equal(json.case.priority, 'high');
    assert.equal(json.case.memberNickname, 'Sajilo');
    assert.equal(json.case.orgId, 'org-1');
    createdCaseId = json.caseId;

    // Check audit log
    const auditLogs = Object.values(db._store).filter((v) => v.action === 'CASE_CREATED');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].targetId, createdCaseId);
    console.log(`  ✅ Case created with ID: ${createdCaseId} and audited in adminAuditLogs`);
  }

  // ── TEST 4: NGO 1 retrieves its organization's cases ─────────────────────
  {
    console.log('\nTest 4: NGO 1 retrieves its organization cases');
    const { req, res } = makeReqRes({
      method: 'GET',
      url: '/api/cases',
      token: 'token-ngo-1',
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.cases.length, 1);
    assert.equal(json.cases[0].id, createdCaseId);
    assert.equal(json.cases[0].caseTitle, 'Tailoring Apprenticeship & Stipend Plan');
    console.log('  ✅ NGO 1 successfully listed own case');
  }

  // ── TEST 5: NGO 2 cannot view NGO 1's cases (organization isolation) ────
  {
    console.log('\nTest 5: Organization isolation (NGO 2 sees 0 cases)');
    const { req, res } = makeReqRes({
      method: 'GET',
      url: '/api/cases',
      token: 'token-ngo-2',
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.cases.length, 0); // No cases for org-2
    console.log('  ✅ NGO 2 isolated: zero cases returned from org-1');
  }

  // ── TEST 6: NGO 2 cannot update NGO 1's case ─────────────────────────────
  {
    console.log('\nTest 6: NGO 2 cannot update NGO 1 case');
    const { req, res } = makeReqRes({
      method: 'PUT',
      url: '/api/cases',
      token: 'token-ngo-2',
      body: {
        caseId: createdCaseId,
        status: 'closed',
      },
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 403);
    assert.equal(json.ok, false);
    console.log('  ✅ Cross-organization case update blocked (403)');
  }

  // ── TEST 7: Member 1 can view their own case ─────────────────────────────
  {
    console.log('\nTest 7: Member 1 can view their own case');
    const { req, res } = makeReqRes({
      method: 'GET',
      url: '/api/cases',
      token: 'token-member-1',
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.cases.length, 1);
    assert.equal(json.cases[0].id, createdCaseId);
    console.log('  ✅ Member 1 successfully retrieved their own case');
  }

  // ── TEST 8: Member 2 cannot view Member 1's case ─────────────────────────
  {
    console.log('\nTest 8: Member 2 cannot view Member 1 case');
    const { req, res } = makeReqRes({
      method: 'GET',
      url: '/api/cases',
      token: 'token-member-2',
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.cases.length, 0);
    console.log('  ✅ Member 2 isolated: Member 1 case not returned');
  }

  // ── TEST 9: NGO staff updates status & reassigns caseworker ─────────────
  {
    console.log('\nTest 9: NGO staff updates status, priority, and assigns caseworker');
    const { req, res } = makeReqRes({
      method: 'PUT',
      url: '/api/cases',
      token: 'token-ngo-1',
      body: {
        caseId: createdCaseId,
        status: 'in_progress',
        priority: 'urgent',
        assignedStaffId: 'staff-worker-2',
        assignedStaffName: 'Deepa Gurung',
      },
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);

    const updatedSnap = await db.collection('cases').doc(createdCaseId).get();
    assert.equal(updatedSnap.data().status, 'in_progress');
    assert.equal(updatedSnap.data().priority, 'urgent');
    assert.equal(updatedSnap.data().assignedStaffName, 'Deepa Gurung');

    const updateAudit = Object.values(db._store).filter((v) => v.action === 'CASE_UPDATED');
    assert.equal(updateAudit.length, 1);
    console.log('  ✅ Case updated to in_progress/urgent, reassigned, and audit logged');
  }

  // ── TEST 10: NGO staff adds internal and member-visible notes ────────────
  let note1Id, note2Id;
  {
    console.log('\nTest 10: NGO staff records dated progress notes');
    // Note 1: internal only
    const res1 = makeReqRes({
      method: 'POST',
      url: '/api/cases/notes',
      token: 'token-ngo-1',
      body: {
        caseId: createdCaseId,
        content: 'Internal caseworker assessment: needs counseling follow-up next Tuesday.',
        visibility: 'internal',
        authorName: 'Maya Sharma',
        authorRole: 'Community Caseworker',
      },
    });
    await handleCaseNotes(res1.req, res1.res, { db, auth });
    assert.equal(res1.res.statusCode, 201);
    note1Id = res1.res._json().noteId;

    // Note 2: member-visible
    const res2 = makeReqRes({
      method: 'POST',
      url: '/api/cases/notes',
      token: 'token-ngo-1',
      body: {
        caseId: createdCaseId,
        content: 'Stipend grant approved! You can collect your sewing supplies on Wednesday at the center.',
        visibility: 'member_visible',
        authorName: 'Deepa Gurung',
        authorRole: 'Vocational Liaison',
      },
    });
    await handleCaseNotes(res2.req, res2.res, { db, auth });
    assert.equal(res2.res.statusCode, 201);
    note2Id = res2.res._json().noteId;

    console.log(`  ✅ 2 progress notes added (${note1Id} internal, ${note2Id} member_visible)`);
  }

  // ── TEST 11: NGO staff can view all notes (internal + member_visible) ────
  {
    console.log('\nTest 11: NGO staff sees all notes (internal + member_visible)');
    const { req, res } = makeReqRes({
      method: 'GET',
      url: `/api/cases/notes?caseId=${createdCaseId}`,
      token: 'token-ngo-1',
    });
    await handleCaseNotes(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.notes.length, 2);
    console.log('  ✅ NGO staff successfully retrieved both internal and shared notes');
  }

  // ── TEST 12: Member ONLY sees member_visible notes (privacy isolation) ──
  {
    console.log('\nTest 12: Member sees ONLY notes marked member_visible');
    const { req, res } = makeReqRes({
      method: 'GET',
      url: `/api/cases/notes?caseId=${createdCaseId}`,
      token: 'token-member-1',
    });
    await handleCaseNotes(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.notes.length, 1);
    assert.equal(json.notes[0].visibility, 'member_visible');
    assert.match(json.notes[0].content, /stipend grant approved/i);
    console.log('  ✅ Privacy verified: Internal caseworker note successfully hidden from member');
  }

  // ── TEST 13: Member cannot add case notes ────────────────────────────────
  {
    console.log('\nTest 13: Member cannot add case notes');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/cases/notes',
      token: 'token-member-1',
      body: {
        caseId: createdCaseId,
        content: 'Member trying to write to case file',
      },
    });
    await handleCaseNotes(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 403);
    assert.equal(json.ok, false);
    console.log('  ✅ Member note writing blocked (403)');
  }

  // ── TEST 14: NGO staff can close and archive completed case ──────────────
  {
    console.log('\nTest 14: NGO staff can close and archive case');
    const { req, res } = makeReqRes({
      method: 'PUT',
      url: '/api/cases',
      token: 'token-ngo-1',
      body: {
        caseId: createdCaseId,
        status: 'closed',
        archived: true,
      },
    });
    await handleCases(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);

    const closedSnap = await db.collection('cases').doc(createdCaseId).get();
    assert.equal(closedSnap.data().status, 'closed');
    assert.equal(closedSnap.data().archived, true);
    console.log('  ✅ Case successfully marked closed and archived with history preserved');
  }

  console.log('\n🎉 ALL 14 PHASE 4E CASE MANAGEMENT TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
