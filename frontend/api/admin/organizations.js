import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { extractBearerToken, sendJson, parseJsonBody } from "../_lib/authUtils.js";

/**
 * Verifies that the caller has an active platform_admin session.
 * Enforces live staff profile validation in addition to token claims.
 *
 * @param {import("http").IncomingMessage} req
 * @param {object} auth
 * @param {object} db
 * @returns {Promise<{ authorized: boolean, adminUid?: string, error?: string, statusCode?: number }>}
 */
async function verifyPlatformAdmin(req, auth, db) {
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

  if (decodedToken.role !== "platform_admin") {
    return {
      authorized: false,
      error: "Access restricted to platform administrators",
      statusCode: 403,
    };
  }

  const adminUid = decodedToken.uid;
  const staffRef = db.collection("staffProfiles").doc(adminUid);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists) {
    return {
      authorized: false,
      error: "Administrator profile not found",
      statusCode: 403,
    };
  }

  const staffData = staffSnap.data();
  if (staffData.status !== "active") {
    return {
      authorized: false,
      error: "Administrator account is inactive or suspended",
      statusCode: 403,
    };
  }

  if (staffData.role !== "platform_admin") {
    return {
      authorized: false,
      error: "Administrator profile does not have platform_admin role",
      statusCode: 403,
    };
  }

  return { authorized: true, adminUid };
}

/**
 * Platform Administrator endpoint for viewing all organization applications
 * and executing lifecycle transitions (approve, reject, archive, restore).
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [deps]
 * @param {object} [deps.db]
 * @param {object} [deps.auth]
 */
export async function handleAdminOrganizations(
  req,
  res,
  { db = adminDb, auth = adminAuth } = {}
) {
  // 1. Authorize platform administrator
  const authResult = await verifyPlatformAdmin(req, auth, db);
  if (!authResult.authorized) {
    return sendJson(res, authResult.statusCode || 403, {
      ok: false,
      error: authResult.error,
    });
  }
  const { adminUid } = authResult;

  // 2. GET: List all organizations across all statuses
  if (req.method === "GET") {
    try {
      const snap = await db.collection("organizations").get();
      const organizations = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || "",
          location: data.location || "",
          category: data.category || "General Support",
          focus: data.focus || "",
          contactPhone: data.contactPhone || "",
          contactEmail: data.contactEmail || "",
          applicantName: data.applicantName || "",
          applicantEmail: data.applicantEmail || "",
          applicantUid: data.applicantUid || null,
          verificationStatus: data.verificationStatus || "pending",
          status: data.status || "pending",
          rejectionReason: data.rejectionReason || null,
          reviewedBy: data.reviewedBy || null,
          reviewedAt: data.reviewedAt || null,
          caseworkerCount: data.caseworkerCount || 1,
          associatedCount: data.associatedCount || 0,
          logoUrl: data.logoUrl || null,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      });

      // Sort newest first in memory
      organizations.sort((a, b) => {
        const timeA = a.createdAt?.toMillis
          ? a.createdAt.toMillis()
          : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis
          ? b.createdAt.toMillis()
          : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      return sendJson(res, 200, { ok: true, organizations });
    } catch {
      return sendJson(res, 500, {
        ok: false,
        error: "Failed to retrieve administrative organization directory",
      });
    }
  }

  // 3. POST: Execute lifecycle transition
  if (req.method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });
    }

    const { orgId, action, rejectionReason } = body;

    if (!orgId || typeof orgId !== "string" || !orgId.trim()) {
      return sendJson(res, 400, {
        ok: false,
        error: "Organization ID is required",
      });
    }

    const allowedActions = ["approve", "reject", "archive", "restore"];
    if (!action || !allowedActions.includes(action)) {
      return sendJson(res, 400, {
        ok: false,
        error: `Action must be one of: ${allowedActions.join(", ")}`,
      });
    }

    if (action === "reject") {
      if (
        !rejectionReason ||
        typeof rejectionReason !== "string" ||
        rejectionReason.trim().length < 5
      ) {
        return sendJson(res, 400, {
          ok: false,
          error: "A mandatory rejection reason of at least 5 characters is required",
        });
      }
    }

    const targetOrgId = orgId.trim();
    const orgRef = db.collection("organizations").doc(targetOrgId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      return sendJson(res, 404, {
        ok: false,
        error: "Organization not found",
      });
    }

    const orgData = orgSnap.data();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    let updatedVerificationStatus;
    let updatedStatus;
    let auditAction;
    let auditDetails = { orgName: orgData.name };

    if (action === "approve") {
      updatedVerificationStatus = "verified";
      updatedStatus = "approved";
      auditAction = "ORG_APPROVED";

      batch.update(orgRef, {
        verificationStatus: updatedVerificationStatus,
        status: updatedStatus,
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
        rejectionReason: null,
      });

      // Collect pending staff UIDs for claims update (outside the batch)
      const staffQuerySnap = await db
        .collection("staffProfiles")
        .where("orgId", "==", targetOrgId)
        .where("status", "==", "pending_verification")
        .get();

      for (const staffDoc of staffQuerySnap.docs) {
        batch.update(staffDoc.ref, {
          status: "active",
          updatedAt: now,
        });
      }

      // F-5 Remediation: Commit the Firestore batch FIRST so org and staff documents
      // are in a consistent state before Firebase Auth claims are updated.
      // If claims update fails, the org is still correctly marked verified in Firestore
      // and the staff profile is active — the user can re-login to get fresh claims.
      // This is safer than: claims succeed → batch fails → stale token grants access.
      const auditRef = db.collection("adminAuditLogs").doc(logId);
      batch.set(auditRef, {
        logId,
        action: auditAction,
        targetType: "organization",
        targetId: targetOrgId,
        actorUid: adminUid,
        actorRole: "platform_admin",
        details: auditDetails,
        timestamp: now,
      });

      await batch.commit();

      // Best-effort custom claims update (after Firestore is consistent)
      for (const staffDoc of staffQuerySnap.docs) {
        try {
          await auth.setCustomUserClaims(staffDoc.id, {
            role: "ngo_admin",
            orgId: targetOrgId,
          });
        } catch {
          // Claims update failed; staff will re-sync claims on next login via /api/auth/sync-staff
        }
      }

      return sendJson(res, 200, {
        ok: true,
        orgId: targetOrgId,
        verificationStatus: updatedVerificationStatus,
        status: updatedStatus,
        message: `Organization successfully transitioned to ${updatedStatus}`,
      });
    } else if (action === "reject") {
      updatedVerificationStatus = "rejected";
      updatedStatus = "rejected";
      auditAction = "ORG_REJECTED";
      auditDetails.rejectionReason = rejectionReason.trim();

      batch.update(orgRef, {
        verificationStatus: updatedVerificationStatus,
        status: updatedStatus,
        rejectionReason: rejectionReason.trim(),
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
      });

      // Mark pending staff as rejected
      const staffQuerySnap = await db
        .collection("staffProfiles")
        .where("orgId", "==", targetOrgId)
        .where("status", "==", "pending_verification")
        .get();

      for (const staffDoc of staffQuerySnap.docs) {
        batch.update(staffDoc.ref, {
          status: "rejected",
          updatedAt: now,
        });
      }
    } else if (action === "archive") {
      updatedVerificationStatus = "archived";
      updatedStatus = "archived";
      auditAction = "ORG_ARCHIVED";

      batch.update(orgRef, {
        verificationStatus: updatedVerificationStatus,
        status: updatedStatus,
        updatedAt: now,
      });
    } else if (action === "restore") {
      updatedVerificationStatus = "verified";
      updatedStatus = "approved";
      auditAction = "ORG_RESTORED";

      batch.update(orgRef, {
        verificationStatus: updatedVerificationStatus,
        status: updatedStatus,
        updatedAt: now,
      });
    }

    const auditRef = db.collection("adminAuditLogs").doc(logId);
    batch.set(auditRef, {
      logId,
      action: auditAction,
      targetType: "organization",
      targetId: targetOrgId,
      actorUid: adminUid,
      actorRole: "platform_admin",
      details: auditDetails,
      timestamp: now,
    });

    await batch.commit();

    return sendJson(res, 200, {
      ok: true,
      orgId: targetOrgId,
      verificationStatus: updatedVerificationStatus,
      status: updatedStatus,
      message: `Organization successfully transitioned to ${updatedStatus}`,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

export default async function handler(req, res) {
  return handleAdminOrganizations(req, res);
}
