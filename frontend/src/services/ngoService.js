import { db } from "../firebase/config.js";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * Calls the secure backend endpoint to issue a cryptographically random,
 * single-use 72-hour handover code associated with the verified NGO.
 *
 * @param {string} idToken Firebase Auth ID token with ngo_admin claim
 * @returns {Promise<{ ok: boolean, code?: string, expiresAt?: string, issuedAt?: string, status?: string, error?: string }>}
 */
export async function issueHandoverCode(idToken) {
  if (!idToken) {
    return { ok: false, error: "Authentication required to issue handover codes" };
  }

  try {
    const res = await fetch("/api/ngo/issue-handover-code", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || `Failed to issue handover code (${res.status})`,
      };
    }

    return {
      ok: true,
      code: data.code,
      expiresAt: data.expiresAt,
      issuedAt: data.issuedAt,
      status: data.status || "available",
      issuedByOrgId: data.issuedByOrgId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Network error while issuing handover code",
    };
  }
}

/**
 * Queries real member records from Firestore associated with the NGO organization.
 * Strictly enforces where("associatedOrgId", "==", activeOrgId) as required by Firestore Rules.
 *
 * @param {string} activeOrgId Organization ID derived from verified user claims
 * @returns {Promise<{ ok: boolean, members: Array<object>, error?: string }>}
 */
export async function fetchAssociatedMembers(activeOrgId) {
  if (!activeOrgId) {
    return { ok: false, error: "Missing organization identifier", members: [] };
  }

  try {
    const membersRef = collection(db, "members");
    const q = query(membersRef, where("associatedOrgId", "==", activeOrgId));
    const snap = await getDocs(q);

    const members = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      let joinedDate = "Recent";
      if (data.createdAt?.toDate) {
        joinedDate = data.createdAt.toDate().toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      } else if (data.createdAt) {
        joinedDate = new Date(data.createdAt).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      }

      members.push({
        id: docSnap.id,
        memberId: data.memberId || docSnap.id,
        nickname: data.nickname || data.normalizedNickname || "Anonymous",
        avatarId: data.avatarId || "avatar_1",
        associatedOrgId: data.associatedOrgId,
        caseWorkerId: data.caseWorkerId || null,
        caseWorkerName: data.caseWorkerName || null,
        district: data.district || null,
        interests: Array.isArray(data.interests) ? data.interests : [],
        communityOptIn: Boolean(data.communityOptIn),
        status: data.status || "active",
        joinedDate,
      });
    });

    return { ok: true, members };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Failed to retrieve associated member records",
      members: [],
    };
  }
}
