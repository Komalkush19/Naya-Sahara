import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import {
  extractBearerToken,
  sendJson,
  parseJsonBody,
  validatePassword,
} from "../_lib/authUtils.js";

/**
 * Validates email format with a standard RFC-compliant regex.
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Authorizes staff management operations.
 * Validates caller's ID token and live staff profile.
 *
 * @param {import("http").IncomingMessage} req
 * @param {object} auth
 * @param {object} db
 * @returns {Promise<{ authorized: boolean, callerUid?: string, callerRole?: string, callerOrgId?: string, error?: string, statusCode?: number }>}
 */
async function authorizeStaffManager(req, auth, db) {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      authorized: false,
      error: "Missing or invalid authorization token",
      statusCode: 401,
    };
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (err) {
    return {
      authorized: false,
      error: err.message || "Invalid or expired authorization token",
      statusCode: 401,
    };
  }

  const callerUid = decodedToken.uid;
  const staffRef = db.collection("staffProfiles").doc(callerUid);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists) {
    return {
      authorized: false,
      error: "Staff profile not found",
      statusCode: 403,
    };
  }

  const staffData = staffSnap.data();
  if (staffData.status !== "active") {
    return {
      authorized: false,
      error: "Staff account is suspended or inactive",
      statusCode: 403,
    };
  }

  const callerRole = staffData.role;
  if (callerRole !== "platform_admin" && callerRole !== "ngo_admin") {
    return {
      authorized: false,
      error: "Caller role is not authorized for staff management",
      statusCode: 403,
    };
  }

  // If NGO Admin, verify associated organization is active and verified
  if (callerRole === "ngo_admin") {
    if (!staffData.orgId) {
      return {
        authorized: false,
        error: "Staff account is not associated with an organization",
        statusCode: 403,
      };
    }

    const orgRef = db.collection("organizations").doc(staffData.orgId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      return {
        authorized: false,
        error: "Associated organization not found",
        statusCode: 403,
      };
    }

    const orgData = orgSnap.data();
    if (orgData.verificationStatus !== "verified") {
      return {
        authorized: false,
        error: "Associated organization is not verified",
        statusCode: 403,
      };
    }
  }

  return {
    authorized: true,
    callerUid,
    callerRole,
    callerOrgId: staffData.orgId || null,
  };
}

/**
 * Endpoint for managing organization staff members (caseworkers/admins).
 * Supports retrieving staff roster, provisioning new staff accounts,
 * and toggling active/suspended/deactivated status.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [deps]
 * @param {object} [deps.db]
 * @param {object} [deps.auth]
 */
export async function handleOrgStaff(
  req,
  res,
  { db = adminDb, auth = adminAuth } = {}
) {
  // 1. Authorize caller
  const authResult = await authorizeStaffManager(req, auth, db);
  if (!authResult.authorized) {
    return sendJson(res, authResult.statusCode || 403, {
      ok: false,
      error: authResult.error,
    });
  }

  const { callerUid, callerRole, callerOrgId } = authResult;

  // 2. GET: List staff for organization
  if (req.method === "GET") {
    let targetOrgId;

    // Parse orgId from query param (applicable to both NGO admin and Platform Admin)
    const url = new URL(req.url, "http://localhost");
    const requestedOrgId = url.searchParams.get("orgId");

    if (callerRole === "ngo_admin") {
      // NGO admins are always scoped to their own organization
      targetOrgId = callerOrgId;

      // If they explicitly requested a different orgId, block immediately
      if (requestedOrgId && requestedOrgId !== callerOrgId) {
        return sendJson(res, 403, {
          ok: false,
          error: "You are not authorized to view staff of another organization",
        });
      }
    } else {
      // Platform Admin can specify orgId via query param or header
      targetOrgId = requestedOrgId || callerOrgId;
    }

    if (!targetOrgId) {
      return sendJson(res, 400, {
        ok: false,
        error: "Organization ID is required",
      });
    }

    // NGO admins cannot query staff of another organization
    if (callerRole === "ngo_admin" && targetOrgId !== callerOrgId) {
      return sendJson(res, 403, {
        ok: false,
        error: "You are not authorized to view staff of another organization",
      });
    }

    try {
      const snap = await db
        .collection("staffProfiles")
        .where("orgId", "==", targetOrgId)
        .get();

      const staff = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: data.name || "",
          email: data.email || "",
          role: data.role || "ngo_admin",
          roleTitle: data.roleTitle || "Community Support Caseworker",
          status: data.status || "active",
          orgId: data.orgId || targetOrgId,
          createdAt: data.createdAt || null,
        };
      });

      return sendJson(res, 200, { ok: true, staff });
    } catch {
      return sendJson(res, 500, {
        ok: false,
        error: "Failed to retrieve staff roster",
      });
    }
  }

  // 3. POST: Staff operations (provision, update_status)
  if (req.method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });
    }

    const { action } = body;

    // Operation A: Provision new staff member
    if (action === "provision") {
      const { email, password, name, roleTitle } = body;
      let targetOrgId = body.orgId;

      if (callerRole === "ngo_admin") {
        targetOrgId = callerOrgId;
      } else if (!targetOrgId) {
        targetOrgId = callerOrgId;
      }

      if (!targetOrgId) {
        return sendJson(res, 400, {
          ok: false,
          error: "Organization ID is required to provision staff",
        });
      }

      if (callerRole === "ngo_admin" && targetOrgId !== callerOrgId) {
        return sendJson(res, 403, {
          ok: false,
          error: "You cannot provision staff for another organization",
        });
      }

      const effectiveEmail = (email || "").trim().toLowerCase();
      if (!isValidEmail(effectiveEmail)) {
        return sendJson(res, 400, {
          ok: false,
          error: "A valid staff email address is required",
        });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return sendJson(res, 400, {
          ok: false,
          error: passwordValidation.error,
        });
      }

      const trimmedName = (name || "").trim();
      if (trimmedName.length < 2) {
        return sendJson(res, 400, {
          ok: false,
          error: "Staff member display name must be at least 2 characters",
        });
      }

      // Create user in Firebase Auth
      let newUserRecord;
      try {
        newUserRecord = await auth.createUser({
          email: effectiveEmail,
          password: password,
          displayName: trimmedName,
        });
      } catch (authErr) {
        if (authErr.code === "auth/email-already-exists") {
          return sendJson(res, 409, {
            ok: false,
            error: "An account with this email address already exists",
          });
        }
        return sendJson(res, 500, {
          ok: false,
          error: authErr.message || "Failed to create staff account",
        });
      }

      // Assign custom claims strictly as ngo_admin (never platform_admin)
      try {
        await auth.setCustomUserClaims(newUserRecord.uid, {
          role: "ngo_admin",
          orgId: targetOrgId,
        });
      } catch {
        // Continue to persist profile
      }

      const now = FieldValue.serverTimestamp();
      const staffDoc = {
        uid: newUserRecord.uid,
        email: effectiveEmail,
        name: trimmedName,
        role: "ngo_admin",
        roleTitle: (roleTitle || "Community Support Caseworker").trim(),
        orgId: targetOrgId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const auditDoc = {
        logId,
        action: "STAFF_PROVISIONED",
        targetType: "staff",
        targetId: newUserRecord.uid,
        actorUid: callerUid,
        actorRole: callerRole,
        details: {
          email: effectiveEmail,
          name: trimmedName,
          orgId: targetOrgId,
        },
        timestamp: now,
      };

      const batch = db.batch();
      batch.set(db.collection("staffProfiles").doc(newUserRecord.uid), staffDoc);
      batch.set(db.collection("adminAuditLogs").doc(logId), auditDoc);
      // Increment organization caseworkerCount
      batch.update(db.collection("organizations").doc(targetOrgId), {
        caseworkerCount: FieldValue.increment(1),
        updatedAt: now,
      });

      await batch.commit();

      return sendJson(res, 201, {
        ok: true,
        staff: {
          uid: newUserRecord.uid,
          name: trimmedName,
          email: effectiveEmail,
          role: "ngo_admin",
          roleTitle: staffDoc.roleTitle,
          status: "active",
          orgId: targetOrgId,
        },
        message: "Staff member provisioned successfully",
      });
    }

    // Operation B: Update staff status (activate, suspend, deactivate)
    if (action === "update_status") {
      const { staffUid, status } = body;

      if (!staffUid || typeof staffUid !== "string") {
        return sendJson(res, 400, {
          ok: false,
          error: "Staff member UID is required",
        });
      }

      const allowedStatuses = ["active", "suspended", "deactivated"];
      if (!status || !allowedStatuses.includes(status)) {
        return sendJson(res, 400, {
          ok: false,
          error: `Status must be one of: ${allowedStatuses.join(", ")}`,
        });
      }

      // Self-modification protection
      if (staffUid === callerUid) {
        return sendJson(res, 400, {
          ok: false,
          error: "You cannot change your own account status",
        });
      }

      const targetStaffRef = db.collection("staffProfiles").doc(staffUid);
      const targetStaffSnap = await targetStaffRef.get();

      if (!targetStaffSnap.exists) {
        return sendJson(res, 404, {
          ok: false,
          error: "Target staff profile not found",
        });
      }

      const targetData = targetStaffSnap.data();

      // Platform admins cannot be modified via org staff endpoint
      if (targetData.role === "platform_admin") {
        return sendJson(res, 403, {
          ok: false,
          error: "Platform administrator status cannot be modified via this endpoint",
        });
      }

      // NGO Admins can only modify staff belonging to their own organization
      if (callerRole === "ngo_admin" && targetData.orgId !== callerOrgId) {
        return sendJson(res, 403, {
          ok: false,
          error: "You are not authorized to modify staff from another organization",
        });
      }

      const now = FieldValue.serverTimestamp();
      const previousStatus = targetData.status;

      const batch = db.batch();
      batch.update(targetStaffRef, {
        status,
        updatedAt: now,
      });

      const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      batch.set(db.collection("adminAuditLogs").doc(logId), {
        logId,
        action: "STAFF_STATUS_CHANGED",
        targetType: "staff",
        targetId: staffUid,
        actorUid: callerUid,
        actorRole: callerRole,
        details: {
          previousStatus,
          newStatus: status,
          orgId: targetData.orgId,
        },
        timestamp: now,
      });

      // If suspended or deactivated, revoke refresh tokens to immediately invalidate active sessions
      if (status === "suspended" || status === "deactivated") {
        try {
          await auth.revokeRefreshTokens(staffUid);
        } catch {
          // Best effort token revocation
        }
      }

      await batch.commit();

      return sendJson(res, 200, {
        ok: true,
        staffUid,
        status,
        message: `Staff status updated to ${status}`,
      });
    }

    return sendJson(res, 400, {
      ok: false,
      error: "Invalid action. Supported actions: 'provision', 'update_status'",
    });
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

export default async function handler(req, res) {
  return handleOrgStaff(req, res);
}
