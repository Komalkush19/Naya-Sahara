/**
 * Member Profile & Community Directory Service for Naya Sahara.
 *
 * Handles Firestore reads and writes for `members` and `communityProfiles`
 * collections. All writes go through the client SDK using the authenticated
 * user's identity; Firestore Security Rules enforce ownership.
 *
 * Fields the member owns and can update:
 *   members/{uid}            — avatarId, district, interests, communityOptIn, updatedAt
 *   communityProfiles/{uid}  — uid, nickname, avatarId, district, interests, communityOptIn, updatedAt
 *
 * communityProfiles are the public-facing subset. Only members with
 * communityOptIn === true appear in directory queries by others.
 */

import { db } from "../firebase/config";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Read own member record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the caller's own member profile from Firestore.
 * Requires the caller to be authenticated as the matching member.
 *
 * @param {string} uid
 * @returns {Promise<{ ok: boolean, profile?: object, error?: string }>}
 */
export async function fetchMemberProfile(uid) {
  if (!uid) return { ok: false, error: "Member UID required" };
  try {
    const snap = await getDoc(doc(db, "members", uid));
    if (!snap.exists()) return { ok: false, error: "Member profile not found" };
    return { ok: true, profile: { id: snap.id, ...snap.data() } };
  } catch (err) {
    return { ok: false, error: err.message || "Failed to fetch member profile" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Read own communityProfile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the caller's own community profile from Firestore.
 * Returns null profile data if the document does not yet exist.
 *
 * @param {string} uid
 * @returns {Promise<{ ok: boolean, profile?: object|null, error?: string }>}
 */
export async function fetchOwnCommunityProfile(uid) {
  if (!uid) return { ok: false, error: "Member UID required" };
  try {
    const snap = await getDoc(doc(db, "communityProfiles", uid));
    if (!snap.exists()) return { ok: true, profile: null };
    return { ok: true, profile: { id: snap.id, ...snap.data() } };
  } catch (err) {
    return { ok: false, error: err.message || "Failed to fetch community profile" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Update member profile fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persists profile field changes to `members/{uid}` and `communityProfiles/{uid}`.
 *
 * Permitted fields (enforced by Firestore Security Rules):
 *   members: avatarId, district, interests, communityOptIn, updatedAt
 *   communityProfiles: uid, nickname, avatarId, district, interests, communityOptIn, updatedAt
 *
 * @param {string} uid
 * @param {string} nickname  Current nickname (cannot be changed here — nickname changes require server)
 * @param {object} changes
 * @param {string}   [changes.avatarId]
 * @param {string}   [changes.district]
 * @param {string[]} [changes.interests]
 * @param {boolean}  [changes.communityOptIn]
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function updateMemberProfileFirestore(uid, nickname, changes) {
  if (!uid || !nickname) return { ok: false, error: "UID and nickname are required" };

  const { avatarId, district, interests, communityOptIn } = changes;
  const ts = serverTimestamp();

  // Build the members update (only allowed fields)
  const memberUpdate = { updatedAt: ts };
  if (avatarId !== undefined) memberUpdate.avatarId = avatarId;
  if (district !== undefined) memberUpdate.district = district ?? null;
  if (interests !== undefined) memberUpdate.interests = Array.isArray(interests) ? interests : [];
  if (communityOptIn !== undefined) memberUpdate.communityOptIn = Boolean(communityOptIn);

  // Build the full communityProfiles document (must pass schema validation)
  // We fetch the existing community profile first to merge fields
  let existingCommunity = {};
  try {
    const snap = await getDoc(doc(db, "communityProfiles", uid));
    if (snap.exists()) existingCommunity = snap.data();
  } catch {
    // If we can't read it yet, start fresh
  }

  const communityDoc = {
    uid,
    nickname: existingCommunity.nickname || nickname,
    avatarId: avatarId !== undefined ? avatarId : (existingCommunity.avatarId || "avatar_1"),
    district: district !== undefined ? (district || null) : (existingCommunity.district ?? null),
    interests: interests !== undefined
      ? (Array.isArray(interests) ? interests : [])
      : (existingCommunity.interests || []),
    communityOptIn: communityOptIn !== undefined
      ? Boolean(communityOptIn)
      : Boolean(existingCommunity.communityOptIn),
    updatedAt: ts,
  };

  try {
    // Update members doc first (owns avatarId, district, interests, communityOptIn)
    await updateDoc(doc(db, "members", uid), memberUpdate);

    // Upsert communityProfiles doc (strict schema required by rules)
    await setDoc(doc(db, "communityProfiles", uid), communityDoc, { merge: false });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Failed to save profile changes" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Toggle community opt-in only (fast path)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates communityOptIn on both `members` and `communityProfiles` documents.
 * Uses the same schema-valid setDoc to satisfy the strict communityProfiles rule.
 *
 * @param {string} uid
 * @param {string} nickname
 * @param {boolean} optIn
 * @param {object} currentProfile  Current known profile fields (to avoid extra read)
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function updateCommunityOptIn(uid, nickname, optIn, currentProfile = {}) {
  return updateMemberProfileFirestore(uid, nickname, {
    avatarId: currentProfile.avatarId,
    district: currentProfile.district,
    interests: currentProfile.interests,
    communityOptIn: Boolean(optIn),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Fetch community directory (opt-in members only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queries `communityProfiles` for members who have opted into the directory.
 * Returns only the public-safe fields: uid, nickname, avatarId, district, interests.
 *
 * Access: requires the caller to be authenticated as a member (enforced by rules).
 * Rules allow read of communityProfiles where communityOptIn === true.
 *
 * @returns {Promise<{ ok: boolean, members: Array<object>, error?: string }>}
 */
export async function fetchCommunityDirectory() {
  try {
    const q = query(
      collection(db, "communityProfiles"),
      where("communityOptIn", "==", true),
    );
    const snap = await getDocs(q);
    const members = snap.docs.map((d) => {
      const data = d.data();
      // Explicit allowlist — never expose credentials or case data
      return {
        id: d.id,
        nickname: data.nickname || "",
        avatarId: data.avatarId || "avatar_1",
        district: data.district || null,
        interests: Array.isArray(data.interests) ? data.interests : [],
        communityOptIn: true,
      };
    });
    return { ok: true, members };
  } catch (err) {
    return { ok: false, members: [], error: err.message || "Failed to load community directory" };
  }
}
