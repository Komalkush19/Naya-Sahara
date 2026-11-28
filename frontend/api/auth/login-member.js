import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import {
  DUMMY_BCRYPT_HASH,
  normalizeNickname,
  getClientIp,
  sendJson,
  checkIpRateLimit,
  recordFailedIpAttempt,
} from "../_lib/authUtils.js";

/**
 * Core member login handler supporting dependency injection.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [deps]
 * @param {object} [deps.db]
 * @param {object} [deps.auth]
 */
export async function handleLoginMember(req, res, { db = adminDb, auth = adminAuth } = {}) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });
    }
  }

  const { nickname, password } = body || {};

  if (
    !nickname ||
    typeof nickname !== "string" ||
    !nickname.trim() ||
    !password ||
    typeof password !== "string"
  ) {
    return sendJson(res, 400, {
      ok: false,
      error: "Nickname and password are required",
    });
  }

  const clientIp = getClientIp(req);
  const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex");
  const now = Date.now();

  const serverTimestamp = FieldValue?.serverTimestamp
    ? FieldValue.serverTimestamp()
    : new Date();

  // 1. IP-level distributed abuse throttling check
  const ipRateLimit = await checkIpRateLimit(db, ipHash, now);
  if (ipRateLimit.blocked) {
    return sendJson(res, 429, {
      ok: false,
      error: `Too many login attempts from this network. Please try again in ${ipRateLimit.minutesRemaining} minute(s).`,
    });
  }

  const normalizedNickname = normalizeNickname(nickname);
  const credRef = db.collection("memberCredentials").doc(normalizedNickname);
  const credSnap = await credRef.get();

  // Timing-safe user enumeration mitigation:
  // If the user does not exist or is inactive, compare against DUMMY_BCRYPT_HASH
  if (!credSnap.exists || credSnap.data().status !== "active") {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    await recordFailedIpAttempt(db, ipHash, serverTimestamp);
    return sendJson(res, 401, {
      ok: false,
      error: "Invalid nickname or password",
    });
  }

  const credData = credSnap.data();

  // Check account lockout
  let lockedUntilMillis = 0;
  if (credData.lockedUntil?.toMillis) {
    lockedUntilMillis = credData.lockedUntil.toMillis();
  } else if (credData.lockedUntil) {
    lockedUntilMillis = new Date(credData.lockedUntil).getTime();
  }

  if (lockedUntilMillis > now) {
    const minutesRemaining = Math.max(
      1,
      Math.ceil((lockedUntilMillis - now) / 60000)
    );
    return sendJson(res, 423, {
      ok: false,
      error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
    });
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, credData.passwordHash);

  if (!isMatch) {
    let isNowLocked = false;

    // Concurrency-safe atomic transaction for failed-attempts accounting
    await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(credRef);
      if (!freshSnap.exists) return;
      const freshData = freshSnap.data();
      const currentAttempts = (freshData.failedAttempts || 0) + 1;

      const updates = {
        failedAttempts: currentAttempts,
        updatedAt: serverTimestamp,
      };

      if (currentAttempts >= 5) {
        isNowLocked = true;
        updates.lockedUntil = new Date(now + 15 * 60 * 1000);
      }

      transaction.update(credRef, updates);
    });

    await recordFailedIpAttempt(db, ipHash, serverTimestamp);

    if (isNowLocked) {
      return sendJson(res, 401, {
        ok: false,
        error:
          "Invalid nickname or password. Account locked for 15 minutes due to multiple failed attempts.",
      });
    }

    return sendJson(res, 401, {
      ok: false,
      error: "Invalid nickname or password",
    });
  }

  // Password matched: reset failed attempts atomically if previously incremented
  if (credData.failedAttempts > 0 || credData.lockedUntil) {
    await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(credRef);
      if (!freshSnap.exists) return;
      transaction.update(credRef, {
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: serverTimestamp,
      });
    });
  }

  // Fetch member profile
  const memberRef = db.collection("members").doc(credData.memberId);
  const memberSnap = await memberRef.get();
  const memberData = memberSnap.exists ? memberSnap.data() : null;

  // Mint custom token with member claims
  const customToken = await auth.createCustomToken(credData.memberId, {
    role: "member",
    memberId: credData.memberId,
  });

  return sendJson(res, 200, {
    ok: true,
    customToken,
    user: {
      uid: credData.memberId,
      role: "member",
      nickname: memberData?.nickname || credData.normalizedNickname,
      avatarId: memberData?.avatarId || "avatar_1",
      associatedOrgId: memberData?.associatedOrgId || null,
      caseWorkerName: memberData?.caseWorkerName || null,
      status: memberData?.status || "active",
      district: memberData?.district || null,
      interests: memberData?.interests || [],
      communityOptIn: Boolean(memberData?.communityOptIn),
    },
  });
}

export default async function handler(req, res) {
  return handleLoginMember(req, res);
}
