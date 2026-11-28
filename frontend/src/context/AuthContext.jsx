import { useEffect, useRef, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../firebase/config.js";
import { AuthContext } from "./authContextDef.js";

// ─── Dev-only timing helpers ──────────────────────────────────────────────────
// Logs are gated on import.meta.env.DEV so they are stripped from production.
// Never log tokens, passwords, keys or personal data.
const t0 = typeof performance !== "undefined" ? () => performance.now() : () => Date.now();
function devLog(label, startMs) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[Auth] ${label}: ${(t0() - startMs).toFixed(0)} ms`);
  }
}

// ─── Role mapping shared by all login paths ───────────────────────────────────
function mapRole(roleString) {
  if (roleString === "member") return "member";
  if (roleString === "ngo_admin") return "org";
  if (roleString === "platform_admin") return "admin";
  return null;
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'member' | 'org' | 'admin' | null
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Generational counter — invalidates stale, superseded, or out-of-order async results
  const authGenerationRef = useRef(0);

  // Lock — prevents onAuthStateChanged from resolving profile during active login
  const isStaffSyncingRef = useRef(false);
  const isSigningInRef = useRef(false);

  // UID of the last successfully resolved profile (guards session-restore deduplication)
  const resolvedUidRef = useRef(null);

  const isMountedRef = useRef(true);

  // ─── resolveProfile ────────────────────────────────────────────────────────
  // Used for SESSION RESTORATION (page reload) where we have no pre-verified data.
  // All initial login paths bypass this and set state directly from their own
  // already-verified backend responses, eliminating a redundant /api/auth/me call.
  //
  // @param cachedIdToken  Pre-fetched token to avoid an extra getIdToken() round-trip.
  const resolveProfile = useCallback(async (fbUser, generation, cachedIdToken) => {
    if (!fbUser) {
      if (isMountedRef.current && authGenerationRef.current === generation) {
        setUser(null);
        setRole(null);
        resolvedUidRef.current = null;
      }
      return { ok: false, error: "No authenticated user" };
    }

    const targetUid = fbUser.uid;

    try {
      const _t = t0();
      const idToken = cachedIdToken ?? await fbUser.getIdToken();
      if (!cachedIdToken) devLog("resolveProfile getIdToken", _t);

      if (
        !isMountedRef.current ||
        authGenerationRef.current !== generation ||
        auth.currentUser?.uid !== targetUid
      ) {
        return { ok: false, error: "Stale auth request cancelled" };
      }

      const meStart = t0();
      const res = await fetch("/api/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      devLog("resolveProfile /api/auth/me", meStart);

      if (
        !isMountedRef.current ||
        authGenerationRef.current !== generation ||
        auth.currentUser?.uid !== targetUid
      ) {
        return { ok: false, error: "Stale auth request cancelled" };
      }

      if (!res.ok || !data.ok) {
        resolvedUidRef.current = null;
        await firebaseSignOut(auth).catch(() => {});
        if (isMountedRef.current && authGenerationRef.current === generation) {
          setUser(null);
          setRole(null);
          setFirebaseUser(null);
        }
        return { ok: false, error: data.error || "Session is invalid or account is inactive" };
      }

      const profile = data.user;
      const mappedRole = mapRole(profile.role);

      if (isMountedRef.current && authGenerationRef.current === generation) {
        setUser(profile);
        setRole(mappedRole);
        resolvedUidRef.current = targetUid;
      }

      return { ok: true, user: profile, role: mappedRole };
    } catch (err) {
      if (isMountedRef.current && authGenerationRef.current === generation) {
        resolvedUidRef.current = null;
      }
      return { ok: false, error: err.message || "Failed to resolve authenticated profile" };
    }
  }, []);

  // ─── onAuthStateChanged ────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMountedRef.current) return;
      setFirebaseUser(fbUser);

      if (fbUser) {
        // If an active login handler is running it owns state — don't interfere
        if (isStaffSyncingRef.current || isSigningInRef.current) return;

        // Session restoration: user is already signed in (e.g. page reload)
        if (resolvedUidRef.current !== fbUser.uid) {
          authGenerationRef.current += 1;
          const currentGen = authGenerationRef.current;
          const result = await resolveProfile(fbUser, currentGen);
          if (isMountedRef.current && authGenerationRef.current === currentGen) {
            setAuthError(result.ok ? null : result.error);
          }
        }
      } else {
        authGenerationRef.current += 1;
        resolvedUidRef.current = null;
        setUser(null);
        setRole(null);
        setAuthError(null);
      }

      if (isMountedRef.current) setLoading(false);
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [resolveProfile]);

  // ─── registerMember ────────────────────────────────────────────────────────
  const registerMember = async ({ code, nickname, password, avatarId }) => {
    setAuthError(null);
    authGenerationRef.current += 1;
    const thisGen = authGenerationRef.current;
    isSigningInRef.current = true;

    try {
      const res = await fetch("/api/auth/register-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, nickname, password, avatarId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const errorMsg = data.error || "Registration failed. Please check your information.";
        if (isMountedRef.current && authGenerationRef.current === thisGen) setAuthError(errorMsg);
        return { ok: false, error: errorMsg };
      }

      if (!isMountedRef.current || authGenerationRef.current !== thisGen) {
        return { ok: false, error: "Authentication superseded" };
      }

      // register-member returns a custom token + full user profile.
      // After signInWithCustomToken we set state directly — no /api/auth/me needed.
      const userCredential = await signInWithCustomToken(auth, data.customToken);

      if (!isMountedRef.current || authGenerationRef.current !== thisGen) {
        return { ok: false, error: "Authentication superseded" };
      }

      const profile = data.user;
      const mappedRole = mapRole(profile.role);

      setUser(profile);
      setRole(mappedRole);
      resolvedUidRef.current = userCredential.user.uid;

      return { ok: true, user: profile };
    } catch (err) {
      const errorMsg = err.message || "Network error during member registration.";
      if (isMountedRef.current && authGenerationRef.current === thisGen) setAuthError(errorMsg);
      return { ok: false, error: errorMsg };
    } finally {
      isSigningInRef.current = false;
    }
  };

  // ─── loginMember ──────────────────────────────────────────────────────────
  // Optimized flow (3 sequential steps vs original 5):
  //   POST /api/auth/login-member  →  signInWithCustomToken  →  setState (no /api/auth/me)
  //
  // login-member already verifies credentials, reads the member doc, and returns
  // the full profile. We set state directly after Firebase accepts the custom token.
  // /api/auth/me is still used for session restoration on page reload (unchanged).
  const loginMember = async ({ nickname, password }) => {
    const loginStart = t0();
    setAuthError(null);
    authGenerationRef.current += 1;
    const thisGen = authGenerationRef.current;
    isSigningInRef.current = true;

    try {
      const apiStart = t0();
      const res = await fetch("/api/auth/login-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password }),
      });

      const data = await res.json().catch(() => ({}));
      devLog("loginMember /api/auth/login-member", apiStart);

      if (!res.ok || !data.ok) {
        const errorMsg = data.error || "Invalid nickname or password.";
        if (isMountedRef.current && authGenerationRef.current === thisGen) setAuthError(errorMsg);
        return { ok: false, error: errorMsg };
      }

      if (!isMountedRef.current || authGenerationRef.current !== thisGen) {
        return { ok: false, error: "Authentication superseded" };
      }

      const tokenStart = t0();
      const userCredential = await signInWithCustomToken(auth, data.customToken);
      devLog("loginMember signInWithCustomToken", tokenStart);

      if (!isMountedRef.current || authGenerationRef.current !== thisGen) {
        return { ok: false, error: "Authentication superseded" };
      }

      // Use the profile already returned by login-member — identical to what /api/auth/me
      // would return but without the extra network round-trip + cold start.
      const profile = data.user;
      const mappedRole = mapRole(profile.role);

      setUser(profile);
      setRole(mappedRole);
      resolvedUidRef.current = userCredential.user.uid;

      devLog("loginMember TOTAL", loginStart);
      return { ok: true, user: profile };
    } catch (err) {
      const errorMsg = err.message || "Network error during member login.";
      if (isMountedRef.current && authGenerationRef.current === thisGen) setAuthError(errorMsg);
      return { ok: false, error: errorMsg };
    } finally {
      isSigningInRef.current = false;
    }
  };

  // ─── loginStaff ───────────────────────────────────────────────────────────
  // Optimized flow (3 effective steps vs original 6):
  //
  //   Before (sequential):
  //     signIn → getIdToken → sync-staff → getIdToken(true) → getIdToken → /api/auth/me
  //
  //   After (getIdToken(true) parallelised; /api/auth/me eliminated):
  //     signIn → getIdToken → [sync-staff ∥ getIdToken(true)] → setState from syncData.profile
  //
  // sync-staff already does a live Firestore read of staffProfiles AND organizations
  // (for NGO admins), sets custom claims, and returns the full staff profile including
  // organizationName. No second Firestore read is needed.
  // /api/auth/me is still used for session restoration on page reload (unchanged).
  const loginStaff = async ({ email, password }) => {
    const loginStart = t0();
    setAuthError(null);
    authGenerationRef.current += 1;
    const thisGen = authGenerationRef.current;
    isSigningInRef.current = true;
    isStaffSyncingRef.current = true;

    try {
      // Step 1: Firebase email/password authentication
      const signInStart = t0();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;
      devLog("loginStaff signInWithEmailAndPassword", signInStart);

      if (!isMountedRef.current || authGenerationRef.current !== thisGen) {
        isStaffSyncingRef.current = false;
        return { ok: false, error: "Authentication superseded" };
      }

      // Step 2: Fetch the initial token (no force-refresh yet)
      const tokenStart = t0();
      const initialIdToken = await fbUser.getIdToken();
      devLog("loginStaff getIdToken (initial)", tokenStart);

      // Kick off the forced refresh immediately in the background — runs concurrently
      // with the sync-staff network request so we don't pay its RTT sequentially.
      const refreshedTokenPromise = fbUser.getIdToken(true);

      // Step 3a: Backend staff verification + custom claims attachment
      const syncStart = t0();
      const syncRes = await fetch("/api/auth/sync-staff", {
        method: "POST",
        headers: { Authorization: `Bearer ${initialIdToken}` },
      });
      const syncData = await syncRes.json().catch(() => ({}));
      devLog("loginStaff /api/auth/sync-staff", syncStart);

      if (!syncRes.ok || !syncData.ok) {
        isStaffSyncingRef.current = false;
        await firebaseSignOut(auth).catch(() => {});
        if (isMountedRef.current && authGenerationRef.current === thisGen) {
          setUser(null);
          setRole(null);
          setFirebaseUser(null);
          resolvedUidRef.current = null;
          const errorMsg =
            syncData.error ||
            "Staff verification failed. Account may be inactive or organization unverified.";
          setAuthError(errorMsg);
          return { ok: false, error: errorMsg };
        }
        return { ok: false, error: "Staff verification failed" };
      }

      if (!isMountedRef.current || authGenerationRef.current !== thisGen) {
        isStaffSyncingRef.current = false;
        return { ok: false, error: "Authentication superseded" };
      }

      // Step 3b: Collect the forced token refresh (usually already settled by now)
      const refreshWaitStart = t0();
      await refreshedTokenPromise;
      devLog("loginStaff getIdToken(true) wait (net of parallel overlap)", refreshWaitStart);

      // Step 4: Release sync lock — claims are set, staff identity confirmed
      isStaffSyncingRef.current = false;

      if (!isMountedRef.current || authGenerationRef.current !== thisGen) {
        return { ok: false, error: "Authentication superseded" };
      }

      // Step 5: Set state directly from the already-verified sync-staff response.
      // sync-staff has already read staffProfiles AND organizations (for NGO admins)
      // and returns organizationName. No /api/auth/me needed for initial login.
      const sp = syncData.profile;
      const profile = {
        uid:              sp.uid,
        role:             sp.role,
        email:            sp.email || null,
        name:             sp.name || null,
        designation:      sp.designation || null,
        orgId:            sp.orgId || null,
        organizationName: sp.organizationName || null,
        status:           sp.status,
      };
      const mappedRole = mapRole(profile.role);

      setUser(profile);
      setRole(mappedRole);
      resolvedUidRef.current = fbUser.uid;

      devLog("loginStaff TOTAL", loginStart);
      return { ok: true, user: profile };
    } catch (err) {
      isStaffSyncingRef.current = false;
      let errorMsg = err.message || "Login failed.";
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        errorMsg = "Invalid email or password.";
      } else if (err.code === "auth/too-many-requests") {
        errorMsg =
          "Access temporarily disabled due to many failed login attempts. Please try again later.";
      }
      if (isMountedRef.current && authGenerationRef.current === thisGen) setAuthError(errorMsg);
      return { ok: false, error: errorMsg };
    } finally {
      isSigningInRef.current = false;
    }
  };

  // ─── logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    authGenerationRef.current += 1;
    isStaffSyncingRef.current = false;
    isSigningInRef.current = false;
    resolvedUidRef.current = null;
    setUser(null);
    setRole(null);
    setFirebaseUser(null);
    setAuthError(null);
    setLoading(false);
    try {
      await firebaseSignOut(auth);
    } catch {
      // Handled silently
    }
  };

  const value = {
    firebaseUser,
    user,
    role,
    loading,
    authError,
    registerMember,
    loginMember,
    loginStaff,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
