import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import {
  extractBearerToken,
  hashHandoverCode,
  getClientIp,
  sendJson,
} from "../_lib/authUtils.js";

/**
 * Generates an unpredictable, cryptographically secure handover code.
 * Format: "NS-" followed by 6 characters selected from an unambiguous 32-character alphabet.
 * Provides over 1 billion possible combinations (32^6 = 1,073,741,824).
 *
 * @returns {string} Plaintext handover code e.g. "NS-7K9B2M"
 */
export function generateSecureHandoverCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 characters, excluding ambiguous 0, 1, I, O
  const randomBytes = crypto.randomBytes(6);
  let code = "NS-";
  for (let i = 0; i < 6; i++) {
    code += alphabet[randomBytes[i] % alphabet.length];
  }
  return code;
}

/**
 * Checks and records rate limiting for handover code generation.
 * Limits to 30 code generation requests per 60 minutes per staff user.
 *
 * @param {object} db Firestore instance
 * @param {string} docId Rate limit identifier
 * @param {number} [windowMs]
 * @param {number} [maxAttempts]
 * @returns {Promise<{ blocked: boolean, minutesRemaining: number }>}
 */
async function checkAndRecordIssuanceRateLimit(
  db,
  docId,
  { windowMs = 60 * 60 * 1000, maxAttempts = 30 } = {}
) {
  const rateLimitRef = db.collection("authRateLimits").doc(docId);
  const now = Date.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(rateLimitRef);
      let count = 1;
      let windowStart = now;

      if (snap.exists) {
        const data = snap.data();
        const existingWindowStart = data.windowStart?.toMillis
          ? data.windowStart.toMillis()
          : data.windowStart
            ? new Date(data.windowStart).getTime()
            : now;

        if (now - existingWindowStart < windowMs) {
          count = (data.count || 0) + 1;
          windowStart = existingWindowStart;

          if (count > maxAttempts) {
            const minutesRemaining = Math.max(
              1,
              Math.ceil((existingWindowStart + windowMs - now) / 60000)
            );
            return { blocked: true, minutesRemaining };
          }
        } else {
          count = 1;
          windowStart = now;
        }
      }

      transaction.set(
        rateLimitRef,
        {
          count,
          windowStart: new Date(windowStart),
          lastIssuedAt: new Date(now),
        },
        { merge: true }
      );

      return { blocked: false, minutesRemaining: 0 };
    });
  } catch {
    // If rate limiting transaction fails, allow execution but do not block legitimate requests
    return { blocked: false, minutesRemaining: 0 };
  }
}

/**
 * Core handler for issuing secure, single-use 72-hour handover codes.
 * Requires an authenticated NGO staff member belonging to a verified organization.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [deps]
 * @param {object} [deps.db]
 * @param {object} [deps.auth]
 */
export async function handleIssueHandoverCode(
  req,
  res,
  { db = adminDb, auth = adminAuth } = {}
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  // 1. Verify Authorization Bearer token
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
      error: error.message || "Invalid or expired authorization token",
    });
  }

  // 2. Enforce token claim check: NGO Admin role must be present in verified claims
  if (decodedToken.role !== "ngo_admin") {
    return sendJson(res, 403, {
      ok: false,
      error: "Only verified NGO staff are authorized to issue handover codes",
    });
  }

  // 3. Derive organization ID strictly from verified token claims (preventing payload spoofing)
  const tokenOrgId = decodedToken.orgId;
  if (!tokenOrgId || typeof tokenOrgId !== "string" || !tokenOrgId.trim()) {
    return sendJson(res, 403, {
      ok: false,
      error: "Staff account is not associated with an organization",
    });
  }

  const staffUid = decodedToken.uid;

  // 4. Live Staff Profile Verification (preventing stale token claims or suspended staff access)
  const staffRef = db.collection("staffProfiles").doc(staffUid);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists) {
    return sendJson(res, 403, {
      ok: false,
      error: "Staff profile not found or account is not authorized",
    });
  }

  const staffData = staffSnap.data();

  if (staffData.status !== "active") {
    return sendJson(res, 403, {
      ok: false,
      error: "Staff account is suspended or inactive",
    });
  }

  if (staffData.role !== "ngo_admin") {
    return sendJson(res, 403, {
      ok: false,
      error: "Staff profile does not possess the required ngo_admin role",
    });
  }

  // Confirm staff profile orgId independently matches the verified token orgId
  if (!staffData.orgId || staffData.orgId !== tokenOrgId) {
    return sendJson(res, 403, {
      ok: false,
      error: "Staff profile organization assignment does not match active session",
    });
  }

  const orgId = tokenOrgId;

  // 5. Verify organization record exists and is in 'verified' status
  const orgRef = db.collection("organizations").doc(orgId);
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
      error: "Associated organization is not verified to issue handover codes",
    });
  }

  // 6. Rate limiting: protect against automated code generation abuse (per staff member and IP)
  const clientIp = getClientIp(req);
  const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex");
  const rateLimitDocId = `issue_${staffUid}_${ipHash.slice(0, 16)}`;

  const rateLimit = await checkAndRecordIssuanceRateLimit(db, rateLimitDocId, {
    windowMs: 60 * 60 * 1000,
    maxAttempts: 30,
  });

  if (rateLimit.blocked) {
    return sendJson(res, 429, {
      ok: false,
      error: `Handover code issuance rate limit exceeded. Please wait ${rateLimit.minutesRemaining} minute(s).`,
    });
  }

  // 6. Generate collision-resistant secure code and compute SHA-256 hash
  const now = Date.now();
  const validityDurationMs = 72 * 60 * 60 * 1000; // exactly 72 hours
  const expiresAt = new Date(now + validityDurationMs);

  const serverTimestamp = FieldValue?.serverTimestamp
    ? FieldValue.serverTimestamp()
    : new Date(now);

  let plaintextCode = "";
  let codeHash = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    plaintextCode = generateSecureHandoverCode();
    codeHash = hashHandoverCode(plaintextCode);

    const existingSnap = await db.collection("handoverCodes").doc(codeHash).get();
    if (!existingSnap.exists) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    return sendJson(res, 500, {
      ok: false,
      error: "Failed to generate unique handover code. Please try again.",
    });
  }

  // 7. Store hashed handover code in Firestore
  // Preserves exact schema expected by /api/auth/register-member
  const handoverRef = db.collection("handoverCodes").doc(codeHash);
  await handoverRef.set({
    status: "available",
    issuedByOrgId: orgId,
    caseWorkerId: staffUid,
    caseWorkerName: staffData.name || decodedToken.name || staffDataName(decodedToken),
    createdAt: serverTimestamp,
    expiresAt,
    regAttemptId: null,
    reservationExpiresAt: null,
  });

  // 8. Return plaintext code once to authorized client; never expose hash
  return sendJson(res, 201, {
    ok: true,
    code: plaintextCode,
    expiresAt: expiresAt.toISOString(),
    issuedAt: new Date(now).toISOString(),
    status: "available",
    issuedByOrgId: orgId,
  });
}

function staffDataName(token) {
  if (token.name) return token.name;
  if (token.email) return token.email.split("@")[0];
  return "NGO Caseworker";
}

export default function handler(req, res) {
  return handleIssueHandoverCode(req, res);
}
