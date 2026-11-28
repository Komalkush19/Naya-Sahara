import { adminDb } from "../_lib/firebaseAdmin.js";
import { sendJson } from "../_lib/authUtils.js";

/**
 * Public directory endpoint for verified organizations.
 * Returns only organizations with verificationStatus == 'verified'.
 * Protects applicant credentials, review notes, and internal metadata.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {object} [deps]
 * @param {object} [deps.db]
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

export default async function handler(req, res) {
  return handleListPublicOrganizations(req, res);
}
