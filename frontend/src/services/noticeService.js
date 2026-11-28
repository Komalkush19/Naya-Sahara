/**
 * Notice Service — Naya Sahara
 *
 * All notice operations go through the backend API (never direct Firestore client SDK)
 * to ensure server-side authorization is enforced on every write.
 */

/**
 * Fetch the public notice board (approved + published notices).
 * No auth required.
 *
 * @returns {Promise<{ ok: boolean, notices: Array, error?: string }>}
 */
export async function fetchPublicNotices() {
  try {
    const res = await fetch("/api/notices", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, notices: [], error: data.error || `Failed to fetch notices (${res.status})` };
    }
    return { ok: true, notices: data.notices || [] };
  } catch (err) {
    return { ok: false, notices: [], error: err.message || "Network error fetching notices" };
  }
}

/**
 * Fetch all notices belonging to the authenticated NGO's organization.
 * Requires a valid ngo_admin id token.
 *
 * @param {string} idToken
 * @returns {Promise<{ ok: boolean, notices: Array, error?: string }>}
 */
export async function fetchOrgNotices(idToken) {
  if (!idToken) return { ok: false, notices: [], error: "Authentication token required" };
  try {
    const res = await fetch("/api/notices?scope=mine", {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}`, Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, notices: [], error: data.error || `Failed to fetch org notices (${res.status})` };
    }
    return { ok: true, notices: data.notices || [] };
  } catch (err) {
    return { ok: false, notices: [], error: err.message || "Network error fetching org notices" };
  }
}

/**
 * Fetch ALL notices for the platform administrator.
 *
 * @param {string} idToken
 * @returns {Promise<{ ok: boolean, notices: Array, error?: string }>}
 */
export async function fetchAdminNotices(idToken) {
  if (!idToken) return { ok: false, notices: [], error: "Authentication token required" };
  try {
    const res = await fetch("/api/admin/notices", {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}`, Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, notices: [], error: data.error || `Failed to fetch admin notices (${res.status})` };
    }
    return { ok: true, notices: data.notices || [] };
  } catch (err) {
    return { ok: false, notices: [], error: err.message || "Network error fetching admin notices" };
  }
}

/**
 * NGO staff: Create a notice (draft or submit for review).
 *
 * @param {string} idToken
 * @param {object} noticeData
 * @param {boolean} asDraft
 * @returns {Promise<{ ok: boolean, noticeId?: string, error?: string }>}
 */
export async function createNoticeApi(idToken, noticeData, asDraft = false) {
  if (!idToken) return { ok: false, error: "Authentication token required" };
  try {
    const res = await fetch("/api/notices", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...noticeData, asDraft }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to create notice (${res.status})` };
    }
    return { ok: true, noticeId: data.noticeId, publicationStatus: data.publicationStatus, reviewStatus: data.reviewStatus };
  } catch (err) {
    return { ok: false, error: err.message || "Network error creating notice" };
  }
}

/**
 * NGO staff: Update (edit) an existing notice.
 *
 * @param {string} idToken
 * @param {string} noticeId
 * @param {object} changes
 * @param {boolean} asDraft
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function updateNoticeApi(idToken, noticeId, changes, asDraft = false) {
  if (!idToken) return { ok: false, error: "Authentication token required" };
  try {
    const res = await fetch("/api/notices", {
      method: "PUT",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ noticeId, ...changes, asDraft }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to update notice (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Network error updating notice" };
  }
}

/**
 * NGO staff: Delete a draft or rejected notice.
 *
 * @param {string} idToken
 * @param {string} noticeId
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function deleteNoticeApi(idToken, noticeId) {
  if (!idToken) return { ok: false, error: "Authentication token required" };
  try {
    const res = await fetch("/api/notices", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ noticeId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to delete notice (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Network error deleting notice" };
  }
}

/**
 * Admin: Execute a moderation action on a notice.
 *
 * @param {string} idToken
 * @param {string} action  — 'approve' | 'reject' | 'publish' | 'unpublish' | 'archive' | 'restore' | 'delete'
 * @param {string} noticeId
 * @param {object} [extras]  — { rejectionReason }
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function adminModerateNotice(idToken, action, noticeId, extras = {}) {
  if (!idToken) return { ok: false, error: "Authentication token required" };
  try {
    const res = await fetch("/api/admin/notices", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, noticeId, ...extras }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Moderation action failed (${res.status})` };
    }
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err.message || "Network error executing moderation action" };
  }
}

/**
 * Admin: Create a government notice (approve + optionally publish immediately).
 *
 * @param {string} idToken
 * @param {object} noticeData
 * @param {boolean} asDraft
 * @returns {Promise<{ ok: boolean, noticeId?: string, error?: string }>}
 */
export async function createGovNoticeApi(idToken, noticeData, asDraft = false) {
  if (!idToken) return { ok: false, error: "Authentication token required" };
  try {
    const res = await fetch("/api/admin/notices", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_gov", ...noticeData, asDraft }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to create government notice (${res.status})` };
    }
    return { ok: true, noticeId: data.noticeId };
  } catch (err) {
    return { ok: false, error: err.message || "Network error creating government notice" };
  }
}
