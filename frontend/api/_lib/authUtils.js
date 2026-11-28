import crypto from "node:crypto";

/**
 * 12-round dummy bcrypt hash for timing-safe user enumeration mitigation.
 * Used during failed login attempts when the requested nickname does not exist.
 */
export const DUMMY_BCRYPT_HASH =
  "$2b$12$XeD9HrDu34r012MfOttLlOg/7HjS6tSKfQSH10Wj2Ya9kd97xf0BW";

/**
 * Normalizes a nickname for canonical storage and case-insensitive uniqueness checks.
 * Strips whitespace, converts to lowercase, and applies Unicode NFC normalization.
 *
 * @param {string} rawNickname
 * @returns {string}
 */
export function normalizeNickname(rawNickname) {
  if (typeof rawNickname !== "string") return "";
  return rawNickname.trim().toLowerCase().normalize("NFC");
}

/**
 * Validates nickname syntax and safety constraints:
 * - Must be a string
 * - Length between 2 and 24 characters
 * - Only lowercase alphanumeric characters, underscores, and hyphens
 *
 * @param {string} normalizedNickname
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNickname(normalizedNickname) {
  if (typeof normalizedNickname !== "string" || normalizedNickname.length === 0) {
    return { valid: false, error: "Nickname is required" };
  }
  if (normalizedNickname.length < 2 || normalizedNickname.length > 24) {
    return {
      valid: false,
      error: "Nickname must be between 2 and 24 characters in length",
    };
  }
  const nicknameRegex = /^[a-z0-9_-]+$/;
  if (!nicknameRegex.test(normalizedNickname)) {
    return {
      valid: false,
      error:
        "Nickname may only contain alphanumeric characters, underscores, and hyphens",
    };
  }
  return { valid: true };
}

/**
 * Validates member password requirements:
 * - Must be a string
 * - Length between 8 and 128 characters
 *
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, error: "Password is required" };
  }
  if (password.length < 8) {
    return {
      valid: false,
      error: "Password must be at least 8 characters in length",
    };
  }
  if (password.length > 128) {
    return {
      valid: false,
      error: "Password cannot exceed 128 characters in length",
    };
  }
  return { valid: true };
}

/**
 * Generates the SHA-256 hash of an onboarding handover code.
 * Handover codes are normalized to uppercase and trimmed before hashing.
 *
 * @param {string} code
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function hashHandoverCode(code) {
  if (typeof code !== "string") return "";
  const normalized = code.trim().toUpperCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Extracts Bearer token from incoming request Authorization headers.
 *
 * @param {import("http").IncomingMessage} req
 * @returns {string|null}
 */
export function extractBearerToken(req) {
  const authHeader =
    req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader !== "string") return null;
  const parts = authHeader.trim().split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}

/**
 * Safely extracts client IP address prioritizing Vercel's trusted edge headers.
 * In Vercel serverless environments, `x-real-ip` is populated by the Vercel edge router
 * and cannot be spoofed by downstream clients.
 *
 * @param {import("http").IncomingMessage} req
 * @returns {string}
 */
export function getClientIp(req) {
  if (!req?.headers) return "127.0.0.1";
  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp.trim()) {
    return xRealIp.trim();
  }
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
    return xForwardedFor.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}

/**
 * Standard HTTP helper to send JSON responses.
 *
 * @param {import("http").ServerResponse} res
 * @param {number} statusCode
 * @param {object} data
 */
export function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

/**
 * Checks if a given rate limit document is actively blocking requests.
 *
 * @param {object} db Firestore instance
 * @param {string} docId Document identifier under authRateLimits
 * @param {number} [now] Current timestamp in milliseconds
 * @returns {Promise<{ blocked: boolean, minutesRemaining: number }>}
 */
export async function checkIpRateLimit(db, docId, now = Date.now()) {
  try {
    const ipRef = db.collection("authRateLimits").doc(docId);
    const snap = await ipRef.get();
    if (!snap.exists) {
      return { blocked: false, minutesRemaining: 0 };
    }
    const data = snap.data();
    let blockedUntilMillis = 0;
    if (data.blockedUntil?.toMillis) {
      blockedUntilMillis = data.blockedUntil.toMillis();
    } else if (data.blockedUntil) {
      blockedUntilMillis = new Date(data.blockedUntil).getTime();
    }
    if (blockedUntilMillis > now) {
      const minutesRemaining = Math.max(
        1,
        Math.ceil((blockedUntilMillis - now) / 60000)
      );
      return { blocked: true, minutesRemaining };
    }
    return { blocked: false, minutesRemaining: 0 };
  } catch {
    return { blocked: false, minutesRemaining: 0 };
  }
}

/**
 * Concurrency-safe atomic recording of a failed authentication attempt per rate limit key.
 * If attempts within the configured window reach maxAttempts, the key is blocked for blockDurationMs.
 *
 * @param {object} db Firestore instance
 * @param {string} docId Document identifier under authRateLimits
 * @param {object} [serverTimestamp] Firestore server timestamp
 * @param {object} [options]
 * @param {number} [options.windowMs] Duration of sliding window in ms (default 5 min)
 * @param {number} [options.maxAttempts] Max failed attempts before block (default 15)
 * @param {number} [options.blockDurationMs] Block duration in ms (default 15 min)
 */
export async function recordFailedIpAttempt(
  db,
  docId,
  serverTimestamp,
  {
    windowMs = 5 * 60 * 1000,
    maxAttempts = 15,
    blockDurationMs = 15 * 60 * 1000,
  } = {}
) {
  const ipRef = db.collection("authRateLimits").doc(docId);
  try {
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ipRef);
      const now = Date.now();

      let attempts = 1;
      let windowStart = now;

      if (snap.exists) {
        const data = snap.data();
        let startMillis = data.windowStart?.toMillis
          ? data.windowStart.toMillis()
          : new Date(data.windowStart || now).getTime();

        if (now - startMillis < windowMs) {
          attempts = (data.attempts || 0) + 1;
          windowStart = startMillis;
        }
      }

      const updates = {
        attempts,
        windowStart: new Date(windowStart),
        updatedAt: serverTimestamp || new Date(),
      };

      if (attempts >= maxAttempts) {
        updates.blockedUntil = new Date(now + blockDurationMs);
      }

      transaction.set(ipRef, updates, { merge: true });
    });
  } catch {
    // Non-blocking rate-limit tracking error
  }
}

/**
 * Safely parses JSON body from incoming HTTP request.
 * Supports pre-parsed objects, JSON strings, and raw streams.
 *
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<object|null>}
 */
export async function parseJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return null;
      }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let data = "";
    if (typeof req.on !== "function") {
      return resolve({});
    }
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}
