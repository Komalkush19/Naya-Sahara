/**
 * Organization and Staff Service for Naya Sahara.
 * Provides integration with public directory, registration application,
 * Platform Admin review endpoints, and staff management workflows.
 */

/**
 * Fetches verified public organizations from the backend API.
 * Only verified organizations are returned to guest/unauthenticated users.
 *
 * @returns {Promise<{ ok: boolean, organizations: Array<object>, error?: string }>}
 */
export async function fetchPublicOrganizations() {
  try {
    const res = await fetch("/api/org/list-public", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        organizations: [],
        error: data.error || `Failed to fetch organizations (${res.status})`,
      };
    }

    return {
      ok: true,
      organizations: data.organizations || [],
    };
  } catch (error) {
    return {
      ok: false,
      organizations: [],
      error: error.message || "Network error fetching organization directory",
    };
  }
}

/**
 * Submits an organization registration application.
 *
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} payload.location
 * @param {string} [payload.category]
 * @param {string} payload.focus
 * @param {string} [payload.contactPhone]
 * @param {string} payload.contactEmail
 * @param {string} [payload.applicantName]
 * @param {string} payload.applicantPassword
 * @returns {Promise<{ ok: boolean, orgId?: string, status?: string, message?: string, error?: string }>}
 */
export async function submitOrganizationApplication(payload) {
  try {
    const res = await fetch("/api/org/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || `Failed to submit application (${res.status})`,
      };
    }

    return {
      ok: true,
      orgId: data.orgId,
      status: data.status,
      message: data.message,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Network error submitting application",
    };
  }
}

/**
 * Fetches all organizations (pending, verified, rejected, archived) for platform administrators.
 *
 * @param {string} idToken
 * @returns {Promise<{ ok: boolean, organizations: Array<object>, error?: string }>}
 */
export async function fetchAdminOrganizations(idToken) {
  if (!idToken) {
    return { ok: false, organizations: [], error: "Authentication token required" };
  }

  try {
    const res = await fetch("/api/admin/organizations", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        organizations: [],
        error: data.error || `Failed to fetch admin organizations (${res.status})`,
      };
    }

    return {
      ok: true,
      organizations: data.organizations || [],
    };
  } catch (error) {
    return {
      ok: false,
      organizations: [],
      error: error.message || "Network error fetching administrative directory",
    };
  }
}

/**
 * Executes a platform administrative review action on an organization.
 * Actions: 'approve', 'reject', 'archive', 'restore'.
 *
 * @param {string} idToken
 * @param {object} params
 * @param {string} params.orgId
 * @param {'approve'|'reject'|'archive'|'restore'} params.action
 * @param {string} [params.rejectionReason] Required if action === 'reject'
 * @returns {Promise<{ ok: boolean, orgId?: string, status?: string, error?: string }>}
 */
export async function reviewOrganization(idToken, { orgId, action, rejectionReason }) {
  if (!idToken) {
    return { ok: false, error: "Authentication token required" };
  }

  try {
    const res = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orgId, action, rejectionReason }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || `Review action failed (${res.status})`,
      };
    }

    return {
      ok: true,
      orgId: data.orgId,
      status: data.status,
      verificationStatus: data.verificationStatus,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Network error processing administrative review",
    };
  }
}

/**
 * Fetches staff members for an organization.
 *
 * @param {string} idToken
 * @param {string} [orgId] Required for Platform Admin, optional for NGO Admin
 * @returns {Promise<{ ok: boolean, staff: Array<object>, error?: string }>}
 */
export async function fetchOrgStaff(idToken, orgId) {
  if (!idToken) {
    return { ok: false, staff: [], error: "Authentication token required" };
  }

  try {
    const url = orgId ? `/api/org/staff?orgId=${encodeURIComponent(orgId)}` : "/api/org/staff";
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        staff: [],
        error: data.error || `Failed to fetch staff roster (${res.status})`,
      };
    }

    return {
      ok: true,
      staff: data.staff || [],
    };
  } catch (error) {
    return {
      ok: false,
      staff: [],
      error: error.message || "Network error fetching staff roster",
    };
  }
}

/**
 * Provisions a new staff member for an organization.
 *
 * @param {string} idToken
 * @param {object} payload
 * @param {string} [payload.orgId] Required for Platform Admin, derived for NGO Admin
 * @param {string} payload.email
 * @param {string} payload.name
 * @param {string} payload.password
 * @param {string} [payload.roleTitle]
 * @returns {Promise<{ ok: boolean, staff?: object, error?: string }>}
 */
export async function provisionOrgStaff(idToken, payload) {
  if (!idToken) {
    return { ok: false, error: "Authentication token required" };
  }

  try {
    const res = await fetch("/api/org/staff", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "provision",
        ...payload,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || `Failed to provision staff member (${res.status})`,
      };
    }

    return {
      ok: true,
      staff: data.staff,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Network error provisioning staff member",
    };
  }
}

/**
 * Updates a staff member's active status (active, suspended, deactivated).
 *
 * @param {string} idToken
 * @param {object} params
 * @param {string} params.staffUid
 * @param {'active'|'suspended'|'deactivated'} params.status
 * @returns {Promise<{ ok: boolean, staffUid?: string, status?: string, error?: string }>}
 */
export async function updateStaffStatus(idToken, { staffUid, status }) {
  if (!idToken) {
    return { ok: false, error: "Authentication token required" };
  }

  try {
    const res = await fetch("/api/org/staff", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "update_status",
        staffUid,
        status,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || `Failed to update staff status (${res.status})`,
      };
    }

    return {
      ok: true,
      staffUid: data.staffUid,
      status: data.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Network error updating staff status",
    };
  }
}
