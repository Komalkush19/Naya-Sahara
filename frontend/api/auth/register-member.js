import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import {
  normalizeNickname,
  validateNickname,
  validatePassword,
  hashHandoverCode,
  getClientIp,
  checkIpRateLimit,
  recordFailedIpAttempt,
  sendJson,
} from "../_lib/authUtils.js";

/**
 * Core registration handler supporting dependency injection for testing.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [deps]
 * @param {object} [deps.db]
 * @param {object} [deps.auth]
 */
export async function handleRegisterMember(req, res, { db = adminDb, auth = adminAuth } = {}) {
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

  const { code, nickname, password, avatarId } = body || {};

  if (!code || typeof code !== "string" || !code.trim()) {
    return sendJson(res, 400, {
      ok: false,
      error: "Handover code is required",
    });
  }

  const rawNickname = typeof nickname === "string" ? nickname.trim() : "";
  const normalizedNickname = normalizeNickname(rawNickname);
  const nicknameValidation = validateNickname(normalizedNickname);
  if (!nicknameValidation.valid) {
    return sendJson(res, 400, { ok: false, error: nicknameValidation.error });
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return sendJson(res, 400, { ok: false, error: passwordValidation.error });
  }

  const safeAvatarId =
    typeof avatarId === "string" && avatarId.trim()
      ? avatarId.trim()
      : "avatar_1";

  const clientIp = getClientIp(req);
  const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex");
  const regRateLimitDocId = `reg_${ipHash}`;
  const now = Date.now();

  const serverTimestamp = FieldValue?.serverTimestamp
    ? FieldValue.serverTimestamp()
    : new Date();

  // Rate limiting: IP-level abuse protection for registration handover-code guessing
  const rateLimit = await checkIpRateLimit(db, regRateLimitDocId, now);
  if (rateLimit.blocked) {
    return sendJson(res, 429, {
      ok: false,
      error: `Too many invalid registration attempts from this network. Please try again in ${rateLimit.minutesRemaining} minute(s).`,
    });
  }

  const codeHash = hashHandoverCode(code);
  const handoverRef = db.collection("handoverCodes").doc(codeHash);
  const credRef = db.collection("memberCredentials").doc(normalizedNickname);

  const regAttemptId = crypto.randomUUID();
  const reservationExpiryDate = new Date(now + 120 * 1000); // 120s reservation

  let handoverData = null;

  // Phase 1: Reservation Transaction
  try {
    handoverData = await db.runTransaction(async (transaction) => {
      const handoverSnap = await transaction.get(handoverRef);
      if (!handoverSnap.exists) {
        const err = new Error("Invalid or expired handover code");
        err.code = "INVALID_CODE";
        throw err;
      }

      const hData = handoverSnap.data();
      if (hData.status === "used" || hData.status === "revoked") {
        const err = new Error("Invalid or expired handover code");
        err.code = "INVALID_CODE";
        throw err;
      }

      // Check expiry date
      let expiresAtMillis = 0;
      if (hData.expiresAt?.toMillis) {
        expiresAtMillis = hData.expiresAt.toMillis();
      } else if (hData.expiresAt) {
        expiresAtMillis = new Date(hData.expiresAt).getTime();
      }

      if (expiresAtMillis && expiresAtMillis <= now) {
        const err = new Error("Invalid or expired handover code");
        err.code = "INVALID_CODE";
        throw err;
      }

      // Check active reservation by another attempt
      let resExpiryMillis = 0;
      if (hData.reservationExpiresAt?.toMillis) {
        resExpiryMillis = hData.reservationExpiresAt.toMillis();
      } else if (hData.reservationExpiresAt) {
        resExpiryMillis = new Date(hData.reservationExpiresAt).getTime();
      }

      if (
        hData.regAttemptId &&
        hData.regAttemptId !== regAttemptId &&
        resExpiryMillis > now
      ) {
        const err = new Error(
          "Handover code is currently being processed. Please try again in 2 minutes."
        );
        err.code = "CODE_RESERVED";
        throw err;
      }

      // Check nickname uniqueness
      const credSnap = await transaction.get(credRef);
      if (credSnap.exists) {
        const cData = credSnap.data();
        if (cData.status === "active") {
          const err = new Error("Nickname is already taken");
          err.code = "NICKNAME_TAKEN";
          throw err;
        }

        let cResExpiryMillis = 0;
        if (cData.reservationExpiresAt?.toMillis) {
          cResExpiryMillis = cData.reservationExpiresAt.toMillis();
        } else if (cData.reservationExpiresAt) {
          cResExpiryMillis = new Date(cData.reservationExpiresAt).getTime();
        }

        if (
          cData.regAttemptId &&
          cData.regAttemptId !== regAttemptId &&
          cResExpiryMillis > now
        ) {
          const err = new Error("Nickname is currently reserved");
          err.code = "NICKNAME_TAKEN";
          throw err;
        }
      }

      // Reserve both records
      transaction.set(
        handoverRef,
        {
          regAttemptId,
          reservationExpiresAt: reservationExpiryDate,
        },
        { merge: true }
      );

      transaction.set(
        credRef,
        {
          normalizedNickname,
          status: "reserved",
          regAttemptId,
          reservationExpiresAt: reservationExpiryDate,
        },
        { merge: true }
      );

      return hData;
    });
  } catch (error) {
    if (error.code === "NICKNAME_TAKEN" || error.code === "CODE_RESERVED") {
      return sendJson(res, 409, { ok: false, error: error.message });
    }
    if (
      error.code === "INVALID_CODE" ||
      error.code === "CODE_ALREADY_USED" ||
      error.code === "CODE_EXPIRED"
    ) {
      await recordFailedIpAttempt(db, regRateLimitDocId, serverTimestamp, {
        windowMs: 10 * 60 * 1000,
        maxAttempts: 10,
        blockDurationMs: 15 * 60 * 1000,
      });
      return sendJson(res, 400, {
        ok: false,
        error: "Invalid or expired handover code",
      });
    }
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Registration reservation failed",
    });
  }

  // Phase 2: User Provisioning & Hashing
  let memberUid = null;
  let authUserCreated = false;

  try {
    memberUid = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    await auth.createUser({
      uid: memberUid,
      displayName: normalizedNickname,
    });
    authUserCreated = true;

    // Phase 3: Finalization Transaction
    const serverTimestamp = FieldValue?.serverTimestamp
      ? FieldValue.serverTimestamp()
      : new Date();

    const memberRef = db.collection("members").doc(memberUid);
    const commRef = db.collection("communityProfiles").doc(memberUid);

    await db.runTransaction(async (transaction) => {
      const hSnap = await transaction.get(handoverRef);
      const cSnap = await transaction.get(credRef);

      if (!hSnap.exists || hSnap.data().regAttemptId !== regAttemptId) {
        const err = new Error("Handover code reservation lost due to concurrent registration");
        err.code = "CONCURRENCY_CONFLICT";
        throw err;
      }
      if (!cSnap.exists || cSnap.data().regAttemptId !== regAttemptId) {
        const err = new Error("Nickname reservation lost due to concurrent registration");
        err.code = "CONCURRENCY_CONFLICT";
        throw err;
      }

      // Check whether the reservation has expired before finalizing registration
      const nowFinal = Date.now();
      const hData = hSnap.data();
      const cData = cSnap.data();

      let hResExpiryMillis = 0;
      if (hData.reservationExpiresAt?.toMillis) {
        hResExpiryMillis = hData.reservationExpiresAt.toMillis();
      } else if (hData.reservationExpiresAt) {
        hResExpiryMillis = new Date(hData.reservationExpiresAt).getTime();
      }

      let cResExpiryMillis = 0;
      if (cData.reservationExpiresAt?.toMillis) {
        cResExpiryMillis = cData.reservationExpiresAt.toMillis();
      } else if (cData.reservationExpiresAt) {
        cResExpiryMillis = new Date(cData.reservationExpiresAt).getTime();
      }

      if (
        (hResExpiryMillis && hResExpiryMillis <= nowFinal) ||
        (cResExpiryMillis && cResExpiryMillis <= nowFinal)
      ) {
        const err = new Error(
          "Registration reservation expired before finalization. Please try again."
        );
        err.code = "RESERVATION_EXPIRED";
        throw err;
      }

      // Canonical member organization association
      const canonicalOrgId =
        handoverData.issuedByOrgId || handoverData.issuedByNgoId || null;

      // Mark handover code as used
      transaction.set(
        handoverRef,
        {
          status: "used",
          usedAt: serverTimestamp,
          usedByMemberId: memberUid,
          regAttemptId: null,
          reservationExpiresAt: null,
        },
        { merge: true }
      );

      // Finalize member credentials
      transaction.set(
        credRef,
        {
          normalizedNickname,
          memberId: memberUid,
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
          status: "active",
          regAttemptId: null,
          reservationExpiresAt: null,
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        },
        { merge: true }
      );

      // Create private member profile with canonical associatedOrgId
      transaction.set(memberRef, {
        memberId: memberUid,
        nickname: rawNickname,
        normalizedNickname,
        avatarId: safeAvatarId,
        associatedOrgId: canonicalOrgId,
        caseWorkerId: handoverData.caseWorkerId || null,
        caseWorkerName: handoverData.caseWorkerName || null,
        status: "active",
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });

      // Initialize default community profile adhering strictly to isValidCommunityProfile whitelist
      transaction.set(commRef, {
        uid: memberUid,
        nickname: rawNickname,
        avatarId: safeAvatarId,
        district: null,
        interests: [],
        communityOptIn: false,
        updatedAt: serverTimestamp,
      });
    });

    // Canonical organization ID for response projection
    const canonicalOrgId =
      handoverData.issuedByOrgId || handoverData.issuedByNgoId || null;

    // Phase 4: Mint Custom Token
    const customToken = await auth.createCustomToken(memberUid, {
      role: "member",
      memberId: memberUid,
    });

    return sendJson(res, 201, {
      ok: true,
      customToken,
      user: {
        uid: memberUid,
        role: "member",
        nickname: rawNickname,
        avatarId: safeAvatarId,
        associatedOrgId: canonicalOrgId,
      },
    });
  } catch (error) {
    // Rollback: delete Auth user if created
    if (authUserCreated && memberUid) {
      try {
        await auth.deleteUser(memberUid);
      } catch {
        // Log silently
      }
    }

    // Rollback: clear reservations if attempt matches
    try {
      await db.runTransaction(async (transaction) => {
        const hSnap = await transaction.get(handoverRef);
        if (hSnap.exists && hSnap.data().regAttemptId === regAttemptId) {
          transaction.set(
            handoverRef,
            { regAttemptId: null, reservationExpiresAt: null },
            { merge: true }
          );
        }

        const cSnap = await transaction.get(credRef);
        if (cSnap.exists && cSnap.data().regAttemptId === regAttemptId) {
          transaction.delete(credRef);
        }
      });
    } catch {
      // Rollback failure handled
    }

    const isConflict =
      error.code === "CONCURRENCY_CONFLICT" ||
      error.code === "RESERVATION_EXPIRED" ||
      error.message?.includes("reservation lost") ||
      error.message?.includes("reservation expired");

    return sendJson(res, isConflict ? 409 : 500, {
      ok: false,
      error: error.message || "Member registration finalization failed",
    });
  }
}

export default async function handler(req, res) {
  return handleRegisterMember(req, res);
}
