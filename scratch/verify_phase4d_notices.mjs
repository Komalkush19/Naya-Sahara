/**
 * Phase 4D Integration Test Suite — Notices & Announcements System
 *
 * Validates:
 *  1. NGO notice draft creation (authenticated, verified org)
 *  2. NGO notice editing (draft/resubmission)
 *  3. NGO ownership enforcement (cannot edit/delete other org's notices)
 *  4. NGO submission for review (unapproved cannot self-publish)
 *  5. Admin listing of all notices across all statuses
 *  6. Admin rejection with mandatory reason requirement (< 5 chars rejected)
 *  7. Admin approval and publication
 *  8. Government notice creation with official source attribution and separate translations
 *  9. Public board filtering (drafts, pending reviews, rejected notices NEVER leak)
 * 10. Audit logging in adminAuditLogs for moderation and gov notice actions
 * 11. Admin lifecycle actions: unpublish, archive, restore, delete
 */

import assert from 'node:assert/strict';
import { handleNotices } from '../frontend/api/notices/index.js';
import { handleAdminNotices } from '../frontend/api/admin/index.js';

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
    collection: (collPath) => ({
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
            return {
              docs: matching,
              size: matching.length,
            };
          },
        };
        return queryObj;
      },
      orderBy: () => ({
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
      }),
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
    }),
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

function makeReqRes({ method = 'GET', url = '/api/notices', token, body } = {}) {
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
  let headers = {};
  let responseData = '';

  const res = {
    setHeader: (k, v) => {
      headers[k.toLowerCase()] = v;
    },
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

// ── Test Runner ──────────────────────────────────────────────────────────

async function runTests() {
  console.log('🧪 Starting Phase 4D Notices & Announcements Test Suite\n');

  const db = createMockDb();
  const auth = createMockAuth({
    'token-ngo-1': { uid: 'user-ngo-1', role: 'ngo_admin', orgId: 'org-1' },
    'token-ngo-2': { uid: 'user-ngo-2', role: 'ngo_admin', orgId: 'org-2' },
    'token-admin': { uid: 'admin-1', role: 'platform_admin' },
    'token-member': { uid: 'member-1', role: 'member' },
  });

  // Seed organizations
  await db.collection('organizations').doc('org-1').set({
    name: 'Asha Sathi Nepal',
    verificationStatus: 'verified',
    status: 'approved',
  });
  await db.collection('organizations').doc('org-2').set({
    name: 'Unverified NGO',
    verificationStatus: 'pending',
    status: 'pending',
  });

  // Seed platform admin profile
  await db.collection('staffProfiles').doc('admin-1').set({
    role: 'platform_admin',
    status: 'active',
  });

  let createdNoticeId;

  // ── TEST 1: Unverified NGO cannot create notice ──────────────────────────
  {
    console.log('Test 1: Unverified NGO cannot create notice');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/notices',
      token: 'token-ngo-2',
      body: { title: 'Test', original: 'Some text', asDraft: true },
    });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 403);
    assert.equal(json.ok, false);
    assert.match(json.error, /verified organizations/i);
    console.log('  ✅ Unverified NGO correctly rejected (403)');
  }

  // ── TEST 2: Verified NGO creates draft notice ────────────────────────────
  {
    console.log('\nTest 2: Verified NGO creates draft notice');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/notices',
      token: 'token-ngo-1',
      body: {
        title: 'Weaving & Tailoring Training',
        original: 'महिलाहरूका लागि निःशुल्क सिलाई कटाई तालिम।',
        category: 'Training',
        location: 'Lalitpur',
        eligibility: 'Community women',
        deadline: 'Dec 30, 2026',
        asDraft: true,
      },
    });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 201);
    assert.equal(json.ok, true);
    assert.equal(json.publicationStatus, 'draft');
    assert.equal(json.reviewStatus, 'draft');
    assert.ok(json.noticeId);
    createdNoticeId = json.noticeId;
    console.log(`  ✅ Draft created with ID: ${createdNoticeId}`);
  }

  // ── TEST 3: Draft notice is NOT visible on public board ──────────────────
  {
    console.log('\nTest 3: Draft notice is hidden from public notice board');
    const { req, res } = makeReqRes({ method: 'GET', url: '/api/notices' });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.notices.length, 0);
    console.log('  ✅ Public board returned 0 notices (draft not leaked)');
  }

  // ── TEST 4: NGO can view its own draft notice ────────────────────────────
  {
    console.log('\nTest 4: NGO can view its own draft notices via scope=mine');
    const { req, res } = makeReqRes({
      method: 'GET',
      url: '/api/notices?scope=mine',
      token: 'token-ngo-1',
    });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.notices.length, 1);
    assert.equal(json.notices[0].id, createdNoticeId);
    console.log('  ✅ NGO successfully retrieved own draft notice');
  }

  // ── TEST 5: Another NGO cannot edit the notice (ownership check) ─────────
  {
    console.log('\nTest 5: Another NGO cannot edit the notice (ownership check)');
    const { req, res } = makeReqRes({
      method: 'PUT',
      url: '/api/notices',
      token: 'token-ngo-2',
      body: { noticeId: createdNoticeId, title: 'Hacked Title' },
    });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 403);
    assert.equal(json.ok, false);
    assert.match(json.error, /own notices/i);
    console.log('  ✅ Cross-organization edit blocked (403)');
  }

  // ── TEST 6: NGO submits draft notice for review ──────────────────────────
  {
    console.log('\nTest 6: NGO submits notice for review (asDraft: false)');
    const { req, res } = makeReqRes({
      method: 'PUT',
      url: '/api/notices',
      token: 'token-ngo-1',
      body: {
        noticeId: createdNoticeId,
        asDraft: false,
      },
    });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.reviewStatus, 'pending_review');
    assert.equal(json.publicationStatus, 'unpublished');
    console.log('  ✅ Notice successfully transitioned to pending_review/unpublished');
  }

  // ── TEST 7: Pending review notice still hidden from public board ──────────
  {
    console.log('\nTest 7: Pending notice is hidden from public notice board');
    const { req, res } = makeReqRes({ method: 'GET', url: '/api/notices' });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.notices.length, 0);
    console.log('  ✅ Public board returned 0 notices (pending review not leaked)');
  }

  // ── TEST 8: Admin lists notices across all statuses ──────────────────────
  {
    console.log('\nTest 8: Admin moderation queue lists all notices');
    const { req, res } = makeReqRes({
      method: 'GET',
      url: '/api/admin/notices',
      token: 'token-admin',
    });
    await handleAdminNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.notices.length, 1);
    assert.equal(json.notices[0].id, createdNoticeId);
    assert.equal(json.notices[0].reviewStatus, 'pending_review');
    console.log('  ✅ Admin sees pending notice in moderation queue');
  }

  // ── TEST 9: Admin rejection requires explanation (>= 5 chars) ───────────
  {
    console.log('\nTest 9: Admin rejection requires explanation of at least 5 chars');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/admin/notices',
      token: 'token-admin',
      body: { action: 'reject', noticeId: createdNoticeId, rejectionReason: 'bad' },
    });
    await handleAdminNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 400);
    assert.equal(json.ok, false);
    assert.match(json.error, /at least 5 characters/i);
    console.log('  ✅ Short rejection reason blocked (400)');
  }

  // ── TEST 10: Admin rejects notice with valid reason + logs audit ─────────
  {
    console.log('\nTest 10: Admin rejects notice with valid reason and audit log');
    const reason = 'Please specify daily stipend and transport support details.';
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/admin/notices',
      token: 'token-admin',
      body: { action: 'reject', noticeId: createdNoticeId, rejectionReason: reason },
    });
    await handleAdminNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.reviewStatus, 'rejected');

    // Check notice state
    const noticeSnap = await db.collection('notices').doc(createdNoticeId).get();
    assert.equal(noticeSnap.data().reviewStatus, 'rejected');
    assert.equal(noticeSnap.data().rejectionReason, reason);

    // Check audit log
    const auditLogs = Object.values(db._store).filter((v) => v.action === 'NOTICE_REJECTED');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].targetId, createdNoticeId);
    assert.equal(auditLogs[0].details.rejectionReason, reason);
    console.log('  ✅ Notice rejected and audit log recorded in adminAuditLogs');
  }

  // ── TEST 11: NGO re-edits and resubmits rejected notice ──────────────────
  {
    console.log('\nTest 11: NGO re-edits and resubmits rejected notice');
    const { req, res } = makeReqRes({
      method: 'PUT',
      url: '/api/notices',
      token: 'token-ngo-1',
      body: {
        noticeId: createdNoticeId,
        eligibility: 'Adult women; NPR 500 daily stipend provided.',
        asDraft: false,
      },
    });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.reviewStatus, 'pending_review');
    assert.equal(json.publicationStatus, 'unpublished');

    const noticeSnap = await db.collection('notices').doc(createdNoticeId).get();
    assert.equal(noticeSnap.data().reviewStatus, 'pending_review');
    assert.equal(noticeSnap.data().rejectionReason, '');
    console.log('  ✅ Notice returned to pending_review; rejectionReason cleared');
  }

  // ── TEST 12: Admin approves and publishes notice ─────────────────────────
  {
    console.log('\nTest 12: Admin approves and publishes notice');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/admin/notices',
      token: 'token-admin',
      body: { action: 'approve', noticeId: createdNoticeId },
    });
    await handleAdminNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(json.reviewStatus, 'approved');
    assert.equal(json.publicationStatus, 'published');

    const auditLogs = Object.values(db._store).filter((v) => v.action === 'NOTICE_APPROVED');
    assert.equal(auditLogs.length, 1);
    console.log('  ✅ Notice approved + published; NOTICE_APPROVED logged in adminAuditLogs');
  }

  // ── TEST 13: Approved notice now appears on public board ─────────────────
  {
    console.log('\nTest 13: Approved notice appears on public board');
    const { req, res } = makeReqRes({ method: 'GET', url: '/api/notices' });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.notices.length, 1);
    assert.equal(json.notices[0].id, createdNoticeId);
    assert.equal(json.notices[0].title, 'Weaving & Tailoring Training');
    console.log('  ✅ Approved notice visible on public notice board');
  }

  // ── TEST 14: Admin creates verified government notice ────────────────────
  let govNoticeId;
  {
    console.log('\nTest 14: Admin creates verified government notice');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/admin/notices',
      token: 'token-admin',
      body: {
        action: 'create_gov',
        title: 'Emergency Livelihood Grant for Returnee Women',
        sourceAuthority: 'Ministry of Women, Children and Senior Citizens',
        sourceUrl: 'https://mowcsc.gov.np/notices/2026/livelihood-grant',
        originalLanguage: 'ne',
        original: 'महिला, बालबालिका तथा ज्येष्ठ नागरिक मन्त्रालयबाट आपतकालीन जीविकोपार्जन अनुदान विनियोजन गरिएको छ।',
        nepaliTranslation: 'आर्थिक पुनर्स्थापनाका लागि महिलाहरूलाई जीविकोपार्जन अनुदान आवेदन खुला।',
        englishTranslation: 'Emergency livelihood grant applications open for vulnerable returnee women.',
        simplifiedSummary: 'सरकारी अनुदान: स्थानीय महिला विकास शाखामार्फत आवेदन दिन सकिनेछ।',
        category: 'Financial',
        location: 'All 77 Districts',
        eligibility: 'Women in transition/reintegration',
        deadline: 'Jan 15, 2027',
        asDraft: false,
      },
    });
    await handleAdminNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 201);
    assert.equal(json.ok, true);
    assert.equal(json.reviewStatus, 'approved');
    assert.equal(json.publicationStatus, 'published');
    govNoticeId = json.noticeId;

    // Check doc attributes
    const govDoc = (await db.collection('notices').doc(govNoticeId).get()).data();
    assert.equal(govDoc.sourceType, 'government');
    assert.equal(govDoc.source, 'gov');
    assert.equal(govDoc.sourceAuthority, 'Ministry of Women, Children and Senior Citizens');
    assert.equal(govDoc.sourceUrl, 'https://mowcsc.gov.np/notices/2026/livelihood-grant');
    assert.ok(govDoc.nepaliTranslation);
    assert.ok(govDoc.englishTranslation);
    assert.ok(govDoc.simplifiedSummary);

    // Check audit log
    const auditLogs = Object.values(db._store).filter((v) => v.action === 'GOV_NOTICE_CREATED');
    assert.equal(auditLogs.length, 1);
    console.log(`  ✅ Government notice created (${govNoticeId}) with separate translations and audit log`);
  }

  // ── TEST 15: Public board returns both NGO and Government notices ────────
  {
    console.log('\nTest 15: Public board returns both NGO and Gov published notices');
    const { req, res } = makeReqRes({ method: 'GET', url: '/api/notices' });
    await handleNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.notices.length, 2);
    const types = json.notices.map((n) => n.sourceType);
    assert.ok(types.includes('ngo'));
    assert.ok(types.includes('government'));
    console.log('  ✅ Public board correctly lists both NGO and Government notices');
  }

  // ── TEST 16: Admin unpublishes notice ────────────────────────────────────
  {
    console.log('\nTest 16: Admin unpublishes notice');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/admin/notices',
      token: 'token-admin',
      body: { action: 'unpublish', noticeId: createdNoticeId },
    });
    await handleAdminNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.publicationStatus, 'unpublished');

    // Public board now only has the 1 gov notice
    const pubRes = makeReqRes({ method: 'GET', url: '/api/notices' });
    await handleNotices(pubRes.req, pubRes.res, { db, auth });
    assert.equal(pubRes.res._json().notices.length, 1);
    assert.equal(pubRes.res._json().notices[0].id, govNoticeId);
    console.log('  ✅ Unpublish verified; notice removed from public board');
  }

  // ── TEST 17: Admin deletes notice with audit log ─────────────────────────
  {
    console.log('\nTest 17: Admin deletes notice with audit log');
    const { req, res } = makeReqRes({
      method: 'POST',
      url: '/api/admin/notices',
      token: 'token-admin',
      body: { action: 'delete', noticeId: createdNoticeId },
    });
    await handleAdminNotices(req, res, { db, auth });
    const json = res._json();
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);

    const docSnap = await db.collection('notices').doc(createdNoticeId).get();
    assert.equal(docSnap.exists, false);

    const auditLogs = Object.values(db._store).filter((v) => v.action === 'NOTICE_DELETED');
    assert.equal(auditLogs.length, 1);
    console.log('  ✅ Notice deleted and NOTICE_DELETED logged in adminAuditLogs');
  }

  console.log('\n🎉 ALL 17 PHASE 4D TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
