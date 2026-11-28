import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import { extractBearerToken, sendJson } from "../_lib/authUtils.js";

/**
 * Core /api/auth/me handler.
 * Resolves current user profile safely without exposing sensitive credential data.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [deps]
 * @param {object} [deps.db]
 * @param {object} [deps.auth]
 */
export async function handleMe(req, res, { db = adminDb, auth = adminAuth } = {}) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
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
  const roleClaim = decodedToken.role;

  // Case 1: Member profile resolution
  if (roleClaim === "member") {
    const memberRef = db.collection("members").doc(uid);
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      return sendJson(res, 404, {
        ok: false,
        error: "Member profile not found",
      });
    }

    const memberData = memberSnap.data();
    if (memberData.status !== "active") {
      return sendJson(res, 403, {
        ok: false,
        error: "Member account is inactive",
      });
    }

    return sendJson(res, 200, {
      ok: true,
      user: {
        uid,
        role: "member",
        nickname: memberData.nickname,
        avatarId: memberData.avatarId || "avatar_1",
        associatedOrgId: memberData.associatedOrgId || null,
        caseWorkerName: memberData.caseWorkerName || null,
        status: memberData.status,
        district: memberData.district || null,
        interests: memberData.interests || [],
        communityOptIn: Boolean(memberData.communityOptIn),
        createdAt: memberData.createdAt || null,
      },
    });
  }

  // Case 2: Staff profile resolution (ngo_admin or platform_admin)
  if (roleClaim === "ngo_admin" || roleClaim === "platform_admin") {
    const staffRef = db.collection("staffProfiles").doc(uid);
    const staffSnap = await staffRef.get();

    if (!staffSnap.exists) {
      return sendJson(res, 404, {
        ok: false,
        error: "Staff profile not found",
      });
    }

    const staffData = staffSnap.data();
    if (staffData.status !== "active") {
      return sendJson(res, 403, {
        ok: false,
        error: "Staff account is inactive",
      });
    }

    let organizationName = null;
    if (staffData.orgId) {
      const orgRef = db.collection("organizations").doc(staffData.orgId);
      const orgSnap = await orgRef.get();
      if (orgSnap.exists) {
        organizationName = orgSnap.data().name || null;
      }
    }

    return sendJson(res, 200, {
      ok: true,
      user: {
        uid,
        role: staffData.role,
        email: decodedToken.email || staffData.email || null,
        name: staffData.name || null,
        designation: staffData.designation || null,
        orgId: staffData.orgId || null,
        organizationName,
        status: staffData.status,
      },
    });
  }

  // Case 3: Role claim not set yet, fallback inspection
  const staffRef = db.collection("staffProfiles").doc(uid);
  const staffSnap = await staffRef.get();
  if (staffSnap.exists && staffSnap.data().status === "active") {
    const staffData = staffSnap.data();
    let organizationName = null;
    if (staffData.orgId) {
      const orgRef = db.collection("organizations").doc(staffData.orgId);
      const orgSnap = await orgRef.get();
      if (orgSnap.exists) {
        organizationName = orgSnap.data().name || null;
      }
    }
    return sendJson(res, 200, {
      ok: true,
      user: {
        uid,
        role: staffData.role,
        email: decodedToken.email || staffData.email || null,
        name: staffData.name || null,
        designation: staffData.designation || null,
        orgId: staffData.orgId || null,
        organizationName,
        status: staffData.status,
      },
    });
  }

  const memberRef = db.collection("members").doc(uid);
  const memberSnap = await memberRef.get();
  if (memberSnap.exists && memberSnap.data().status === "active") {
    const memberData = memberSnap.data();
    return sendJson(res, 200, {
      ok: true,
      user: {
        uid,
        role: "member",
        nickname: memberData.nickname,
        avatarId: memberData.avatarId || "avatar_1",
        associatedOrgId: memberData.associatedOrgId || null,
        caseWorkerName: memberData.caseWorkerName || null,
        status: memberData.status,
        district: memberData.district || null,
        interests: memberData.interests || [],
        communityOptIn: Boolean(memberData.communityOptIn),
        createdAt: memberData.createdAt || null,
      },
    });
  }

  return sendJson(res, 404, {
    ok: false,
    error: "User profile not found",
  });
}

export default async function handler(req, res) {
  return handleMe(req, res);
}
