/**
 * /api/org — Unified Organization Registration and Public Directory endpoint.
 *
 * Routes handled:
 *   GET  /api/org or /api/org/list-public — Public directory of verified organizations.
 *   POST /api/org or /api/org/apply       — Unauthenticated organization application.
 */

import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../_lib/firebaseAdmin.js";
import {
  getClientIp,
  checkIpRateLimit,
  recordFailedIpAttempt,
  sendJson,
  parseJsonBody,
  validatePassword,
} from "../_lib/authUtils.js";

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Public directory endpoint for verified organizations.
 * Returns only organizations with verificationStatus == 'verified'.
 */
export async function handleListPublicOrganizations(
  req,
  res,
  { db = adminDb } = {}
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  try {
    const snap = await db
      .collection("organizations")
      .where("verificationStatus", "==", "verified")
      .get();

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
        logoUrl: data.logoUrl || null,
        caseworkerCount: data.caseworkerCount || 1,
        associatedCount: data.associatedCount || 0,
        verificationStatus: data.verificationStatus || "verified",
        status: data.status || "approved",
      };
    });

    return sendJson(res, 200, {
      ok: true,
      organizations,
    });
  } catch {
    return sendJson(res, 500, {
      ok: false,
      error: "Failed to retrieve verified organization directory",
    });
  }
}

/**
 * Endpoint for submitting an organization registration application.
 * Unauthenticated / public submission that creates a pending organization,
 * provisions a pending admin account, and records an administrative audit log.
 */
export async function handleApplyOrganization(
  req,
  res,
  { db = adminDb, auth = adminAuth } = {}
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  // 1. IP rate limiting to prevent automated application spam
  const clientIp = getClientIp(req);
  const rateLimitDocId = `ip_apply_${crypto.createHash("sha256").update(clientIp).digest("hex")}`;
  const rateLimitStatus = await checkIpRateLimit(db, rateLimitDocId);
  if (rateLimitStatus.blocked) {
    return sendJson(res, 429, {
      ok: false,
      error: `Too many registration attempts. Please try again in ${rateLimitStatus.minutesRemaining} minutes.`,
    });
  }

  // 2. Parse and validate JSON request body
  const body = await parseJsonBody(req);
  if (!body) {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });
  }

  const {
    name,
    location,
    category,
    focus,
    contactPhone,
    contactEmail,
    applicantName,
    applicantEmail,
    applicantPassword,
  } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    return sendJson(res, 400, {
      ok: false,
      error: "Organization name must be between 2 and 100 characters in length",
    });
  }

  if (!location || typeof location !== "string" || location.trim().length < 2) {
    return sendJson(res, 400, {
      ok: false,
      error: "Service location/district is required",
    });
  }

  if (!focus || typeof focus !== "string" || focus.trim().length < 5) {
    return sendJson(res, 400, {
      ok: false,
      error: "Public service description must be at least 5 characters in length",
    });
  }

  const effectiveEmail = (applicantEmail || contactEmail || "").trim().toLowerCase();
  if (!isValidEmail(effectiveEmail)) {
    return sendJson(res, 400, {
      ok: false,
      error: "A valid contact/applicant email address is required",
    });
  }

  const effectivePassword = applicantPassword || "";
  const passwordValidation = validatePassword(effectivePassword);
  if (!passwordValidation.valid) {
    return sendJson(res, 400, {
      ok: false,
      error: passwordValidation.error,
    });
  }

  const trimmedName = name.trim();
  const normalizedName = trimmedName.toLowerCase();
  const effectiveApplicantName = (applicantName || `${trimmedName} Representative`).trim();
  const effectivePhone = (contactPhone || "").trim();
  const effectiveCategory = (category || "General Support").trim();

  // 3. F-3 Remediation: Atomically reserve the normalized org name inside a Firestore transaction.
  const RESERVATION_TTL_MS = 15 * 60 * 1000;
  const reservationRef = db.collection("orgNameReservations").doc(normalizedName);

  try {
    await db.runTransaction(async (transaction) => {
      const reservationSnap = await transaction.get(reservationRef);

      if (reservationSnap.exists) {
        const resData = reservationSnap.data();
        const resCreatedAt = resData.reservedAt?.toMillis
          ? resData.reservedAt.toMillis()
          : resData.reservedAt
            ? new Date(resData.reservedAt).getTime()
            : 0;

        if (Date.now() - resCreatedAt < RESERVATION_TTL_MS) {
          throw Object.assign(new Error("NAME_TAKEN"), { code: "NAME_RESERVED" });
        }
      }

      transaction.set(reservationRef, {
        normalizedName,
        reservedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (txErr) {
    if (txErr.code === "NAME_RESERVED") {
      await recordFailedIpAttempt(db, rateLimitDocId, FieldValue.serverTimestamp());
      return sendJson(res, 409, {
        ok: false,
        error: "An organization with this name has already been registered or is pending review",
      });
    }
    return sendJson(res, 500, {
      ok: false,
      error: "Failed to process organization registration. Please try again.",
    });
  }

  // 4. Post-reservation duplicate checks
  try {
    const existingNameSnap = await db
      .collection("organizations")
      .where("normalizedName", "==", normalizedName)
      .get();

    if (!existingNameSnap.empty) {
      await recordFailedIpAttempt(db, rateLimitDocId, FieldValue.serverTimestamp());
      await reservationRef.delete().catch(() => {});
      return sendJson(res, 409, {
        ok: false,
        error: "An organization with this name has already been registered or is pending review",
      });
    }

    const existingEmailSnap = await db
      .collection("organizations")
      .where("contactEmail", "==", effectiveEmail)
      .get();

    if (!existingEmailSnap.empty) {
      await recordFailedIpAttempt(db, rateLimitDocId, FieldValue.serverTimestamp());
      await reservationRef.delete().catch(() => {});
      return sendJson(res, 409, {
        ok: false,
        error: "An organization application with this contact email already exists",
      });
    }

    // 5. Verify email availability in Firebase Auth
    try {
      const existingUser = await auth.getUserByEmail(effectiveEmail);
      if (existingUser) {
        await recordFailedIpAttempt(db, rateLimitDocId, FieldValue.serverTimestamp());
        await reservationRef.delete().catch(() => {});
        return sendJson(res, 409, {
          ok: false,
          error: "An account with this email address already exists",
        });
      }
    } catch (authErr) {
      if (authErr.code !== "auth/user-not-found") {
        // ignore other lookup errors and proceed
      }
    }

    // 6. Create user account in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: effectiveEmail,
        password: effectivePassword,
        displayName: effectiveApplicantName,
      });
    } catch (createErr) {
      await reservationRef.delete().catch(() => {});
      if (createErr.code === "auth/email-already-exists") {
        return sendJson(res, 409, {
          ok: false,
          error: "An account with this email address already exists",
        });
      }
      return sendJson(res, 500, {
        ok: false,
        error: createErr.message || "Failed to create administrator account",
      });
    }

    // 7. Generate organization ID and persist documents (batch)
    const orgId = `org_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const now = FieldValue.serverTimestamp();

    const orgDoc = {
      id: orgId,
      name: trimmedName,
      normalizedName,
      location: location.trim(),
      category: effectiveCategory,
      focus: focus.trim(),
      contactPhone: effectivePhone,
      contactEmail: effectiveEmail,
      applicantName: effectiveApplicantName,
      applicantEmail: effectiveEmail,
      applicantUid: userRecord.uid,
      verificationStatus: "pending",
      status: "pending",
      caseworkerCount: 1,
      associatedCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const staffDoc = {
      uid: userRecord.uid,
      email: effectiveEmail,
      name: effectiveApplicantName,
      role: "ngo_admin",
      orgId: orgId,
      status: "pending_verification",
      createdAt: now,
      updatedAt: now,
    };

    const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const auditDoc = {
      logId,
      action: "ORG_APPLIED",
      targetType: "organization",
      targetId: orgId,
      actorUid: userRecord.uid,
      actorRole: "applicant",
      details: {
        orgName: trimmedName,
        applicantEmail: effectiveEmail,
        location: location.trim(),
      },
      timestamp: now,
    };

    try {
      const batch = db.batch();
      batch.set(db.collection("organizations").doc(orgId), orgDoc);
      batch.set(db.collection("staffProfiles").doc(userRecord.uid), staffDoc);
      batch.set(db.collection("adminAuditLogs").doc(logId), auditDoc);
      batch.delete(reservationRef);
      await batch.commit();

      return sendJson(res, 201, {
        ok: true,
        orgId,
        status: "pending",
        message:
          "Organization application submitted successfully and is pending administrator review.",
      });
    } catch {
      await reservationRef.delete().catch(() => {});
      try {
        await auth.deleteUser(userRecord.uid);
      } catch {
        // Best-effort rollback
      }
      return sendJson(res, 500, {
        ok: false,
        error: "Failed to persist organization application",
      });
    }
  } catch (outerErr) {
    await reservationRef.delete().catch(() => {});
    return sendJson(res, 500, {
      ok: false,
      error: outerErr.message || "Failed to process organization registration",
    });
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.includes("/list-public") || url.searchParams.get("action") === "list-public") {
    return handleListPublicOrganizations(req, res);
  }
  if (url.pathname.includes("/apply") || url.searchParams.get("action") === "apply") {
    return handleApplyOrganization(req, res);
  }
  if (req.method === "GET") {
    return handleListPublicOrganizations(req, res);
  }
  if (req.method === "POST") {
    return handleApplyOrganization(req, res);
  }
  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}
