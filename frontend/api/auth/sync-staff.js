import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { extractBearerToken, sendJson } from "../_lib/authUtils.js";

/**
 * Core staff profile synchronization handler.
 * Verifies staff identity against trusted Firestore documents and attaches custom claims.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [deps]
 * @param {object} [deps.db]
 * @param {object} [deps.auth]
 */
export async function handleSyncStaff(req, res, { db = adminDb, auth = adminAuth } = {}) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return sendJson(res, 401, {
      ok: false,
      error: "Missing or invalid authorization token",
    });
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (error) {
    return sendJson(res, 401, {
      ok: false,
      error: error.message || "Invalid or expired token",
    });
  }

  const uid = decodedToken.uid;
  const staffRef = db.collection("staffProfiles").doc(uid);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists) {
    return sendJson(res, 403, {
      ok: false,
      error: "Staff profile not found for this account",
    });
  }

  const staffData = staffSnap.data();

  if (staffData.status !== "active") {
    return sendJson(res, 403, {
      ok: false,
      error: "Staff account is suspended or inactive",
    });
  }

  if (staffData.role !== "ngo_admin" && staffData.role !== "platform_admin") {
    return sendJson(res, 403, {
      ok: false,
      error: "Account role is not authorized for staff synchronization",
    });
  }

  let claims = {};
  let organizationName = null;

  if (staffData.role === "platform_admin") {
    claims = {
      role: "platform_admin",
    };
  } else if (staffData.role === "ngo_admin") {
    if (!staffData.orgId) {
      return sendJson(res, 403, {
        ok: false,
        error: "Staff account is not associated with an organization",
      });
    }

    const orgRef = db.collection("organizations").doc(staffData.orgId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      return sendJson(res, 403, {
        ok: false,
        error: "Associated organization not found",
      });
    }

    const orgData = orgSnap.data();
    if (orgData.verificationStatus !== "verified") {
      return sendJson(res, 403, {
        ok: false,
        error: "Associated organization is not verified",
      });
    }

    // Capture org name here — zero extra Firestore reads (we already have the doc)
    organizationName = orgData.name || null;

    claims = {
      role: "ngo_admin",
      orgId: staffData.orgId,
    };
  }

  // Set custom user claims securely
  await auth.setCustomUserClaims(uid, claims);

  return sendJson(res, 200, {
    ok: true,
    profile: {
      uid,
      email: decodedToken.email || staffData.email || null,
      role: staffData.role,
      orgId: staffData.orgId || null,
      organizationName,
      name: staffData.name || null,
      designation: staffData.designation || null,
      status: staffData.status,
    },
    claims,
  });
}

export default async function handler(req, res) {
  return handleSyncStaff(req, res);
}
