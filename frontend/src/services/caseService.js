/**
 * Case Service — Naya Sahara
 * Handles API communication for Case creation, lifecycle updates, and progress notes.
 */

/**
 * Fetch cases for the authenticated user.
 * - NGO staff receives their organization's cases.
 * - Members receive only their own cases.
 *
 * @param {string} idToken
 * @param {object} [filters]
 * @param {string} [filters.memberId]
 * @param {string} [filters.status]
 * @returns {Promise<{ ok: boolean, cases: Array, error?: string }>}
 */
export async function fetchCases(idToken, { memberId, status } = {}) {
  if (!idToken) return { ok: false, cases: [], error: "Authentication token required" };

  try {
    const params = new URLSearchParams();
    if (memberId) params.append("memberId", memberId);
    if (status) params.append("status", status);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/cases${queryString}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, cases: [], error: data.error || `Failed to fetch cases (${res.status})` };
    }
    return { ok: true, cases: data.cases || [] };
  } catch (err) {
    return { ok: false, cases: [], error: err.message || "Network error fetching cases" };
  }
}

/**
 * Create a new case for an associated member.
 *
 * @param {string} idToken
 * @param {object} payload
 * @param {string} payload.memberId
 * @param {string} payload.caseTitle
 * @param {string} [payload.category]
 * @param {string} [payload.priority]
 * @param {string} [payload.description]
 * @param {string} [payload.assignedStaffId]
 * @param {string} [payload.assignedStaffName]
 * @returns {Promise<{ ok: boolean, caseId?: string, case?: object, error?: string }>}
 */
export async function createCaseApi(idToken, payload) {
  if (!idToken) return { ok: false, error: "Authentication token required" };

  try {
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to create case (${res.status})` };
    }
    return { ok: true, caseId: data.caseId, case: data.case };
  } catch (err) {
    return { ok: false, error: err.message || "Network error creating case" };
  }
}

/**
 * Update an existing case record.
 *
 * @param {string} idToken
 * @param {string} caseId
 * @param {object} updates
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function updateCaseApi(idToken, caseId, updates) {
  if (!idToken) return { ok: false, error: "Authentication token required" };

  try {
    const res = await fetch("/api/cases", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ caseId, ...updates }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to update case (${res.status})` };
    }
    return { ok: true, updates: data.updates };
  } catch (err) {
    return { ok: false, error: err.message || "Network error updating case" };
  }
}

/**
 * Fetch dated progress notes for a case.
 *
 * @param {string} idToken
 * @param {string} caseId
 * @returns {Promise<{ ok: boolean, notes: Array, error?: string }>}
 */
export async function fetchCaseNotesApi(idToken, caseId) {
  if (!idToken) return { ok: false, notes: [], error: "Authentication token required" };

  try {
    const res = await fetch(`/api/cases/notes?caseId=${encodeURIComponent(caseId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, notes: [], error: data.error || `Failed to fetch notes (${res.status})` };
    }
    return { ok: true, notes: data.notes || [] };
  } catch (err) {
    return { ok: false, notes: [], error: err.message || "Network error fetching case notes" };
  }
}

/**
 * Add a dated progress note to a case.
 *
 * @param {string} idToken
 * @param {object} payload
 * @param {string} payload.caseId
 * @param {string} payload.content
 * @param {'internal'|'member_visible'} [payload.visibility]
 * @param {string} [payload.authorName]
 * @param {string} [payload.authorRole]
 * @returns {Promise<{ ok: boolean, noteId?: string, note?: object, error?: string }>}
 */
export async function addCaseNoteApi(idToken, payload) {
  if (!idToken) return { ok: false, error: "Authentication token required" };

  try {
    const res = await fetch("/api/cases/notes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to record note (${res.status})` };
    }
    return { ok: true, noteId: data.noteId, note: data.note };
  } catch (err) {
    return { ok: false, error: err.message || "Network error recording note" };
  }
}
