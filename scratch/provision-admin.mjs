/**
 * provision-admin.mjs
 *
 * One-time idempotent script that creates the first Platform Administrator
 * account in Firebase Authentication and writes the corresponding
 * staffProfiles/{uid} document with role: "platform_admin".
 *
 * ── HOW TO RUN ──────────────────────────────────────────────────────────────
 * Run from the repository root (Naya_Sahara/):
 *
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_PASSWORD=YourSecurePass123! \
 *   node --env-file=frontend/.env.local scratch/provision-admin.mjs
 *
 * Optional: set a display name in Firestore (defaults to "Platform Admin"):
 *   ADMIN_NAME="Aarya Dhungana" \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   node --env-file=frontend/.env.local scratch/provision-admin.mjs
 *
 * ── ENV-FILE VARIABLES (from frontend/.env.local) ───────────────────────────
 *   FIREBASE_PROJECT_ID      Firebase project ID
 *   FIREBASE_CLIENT_EMAIL    Service-account client email
 *   FIREBASE_PRIVATE_KEY     Service-account private key (PEM, \n-escaped)
 *
 * ── RUNTIME VARIABLES (pass on command line, never save to any file) ────────
 *   ADMIN_EMAIL              Email for the platform admin account
 *   ADMIN_PASSWORD           Password (min 8 chars; only used if creating new user)
 *   ADMIN_NAME               Display name (optional)
 *
 * ── IDEMPOTENCY ─────────────────────────────────────────────────────────────
 *   - If the Firebase Auth user already exists, its password is NOT changed.
 *   - If staffProfiles already has role: platform_admin + status: active,
 *     only the custom claims are re-applied (safe to repeat).
 *   - If staffProfiles exists with a different role, the script refuses to
 *     overwrite it and exits with a clear error.
 */

// ── Validate Firebase Admin SDK credentials ──────────────────────────────────
const requiredVars = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
const missing = requiredVars.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `\n❌  Missing Firebase Admin SDK variables: ${missing.join(", ")}\n` +
    `    Pass them via --env-file=frontend/.env.local\n`
  );
  process.exit(1);
}

// ── Validate runtime credentials ─────────────────────────────────────────────
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL?.trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim();
const ADMIN_NAME     = process.env.ADMIN_NAME?.trim() || "Platform Admin";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "\n❌  ADMIN_EMAIL and ADMIN_PASSWORD must be set as environment variables.\n" +
    "    Example:\n" +
    "      ADMIN_EMAIL=admin@example.com \\\n" +
    "      ADMIN_PASSWORD=SecurePass123! \\\n" +
    "      node --env-file=frontend/.env.local scratch/provision-admin.mjs\n"
  );
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error("\n❌  ADMIN_PASSWORD must be at least 8 characters.\n");
  process.exit(1);
}

// ── Initialise Firebase Admin SDK ─────────────────────────────────────────────
// firebase-admin is installed in frontend/node_modules; resolve from there.
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath }    from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const frontendDir = resolve(__dirname, "../frontend");

// Use createRequire so Node resolves packages from frontend/node_modules
const req = createRequire(resolve(frontendDir, "package.json"));

const { initializeApp, getApps, cert } = await import(
  req.resolve("firebase-admin/app")
);
const { getAuth }      = await import(req.resolve("firebase-admin/auth"));
const { getFirestore, FieldValue } = await import(
  req.resolve("firebase-admin/firestore")
);

const formatPrivateKey = (key) => {
  if (!key) return undefined;
  let k = key.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  return k.replace(/\\n/g, "\n");
};

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          project_id:   process.env.FIREBASE_PROJECT_ID,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          private_key:  formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
        }),
      });

const adminAuth = getAuth(app);
const adminDb   = getFirestore(app);

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("\n🔧  Naya Sahara — Platform Admin Provisioning");
console.log(`    Project : ${process.env.FIREBASE_PROJECT_ID}`);
console.log(`    Email   : ${ADMIN_EMAIL}`);
console.log(`    Name    : ${ADMIN_NAME}`);
console.log();

// Step 1: Look up or create the Firebase Auth user
let uid;
let userCreated = false;

try {
  const existing = await adminAuth.getUserByEmail(ADMIN_EMAIL);
  uid = existing.uid;
  console.log(`ℹ️   Firebase Auth user already exists (uid: ${uid}).`);
  console.log("    Skipping user creation — password unchanged.");
} catch (err) {
  if (err.code === "auth/user-not-found") {
    const newUser = await adminAuth.createUser({
      email:         ADMIN_EMAIL,
      password:      ADMIN_PASSWORD,
      displayName:   ADMIN_NAME,
      emailVerified: true,
    });
    uid = newUser.uid;
    userCreated = true;
    console.log(`✅  Firebase Auth user created (uid: ${uid}).`);
  } else {
    console.error(`\n❌  Firebase Auth error: ${err.message}\n`);
    process.exit(1);
  }
}

// Step 2: Create or verify the staffProfiles document
const staffRef  = adminDb.collection("staffProfiles").doc(uid);
const staffSnap = await staffRef.get();

if (staffSnap.exists) {
  const data = staffSnap.data();
  if (data.role && data.role !== "platform_admin") {
    console.error(
      `\n❌  staffProfiles/${uid} already exists with role "${data.role}".\n` +
      "    This script only provisions platform_admin accounts.\n" +
      "    Refusing to overwrite an account with a different role.\n"
    );
    process.exit(1);
  }
  console.log(`ℹ️   staffProfiles/${uid} already exists (role: ${data.role || "unset"}).`);
  if (data.role === "platform_admin" && data.status === "active") {
    console.log("    Already role: platform_admin and status: active — no document change.");
  } else {
    await staffRef.set(
      { role: "platform_admin", status: "active", updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    console.log("✅  staffProfiles document updated → role: platform_admin, status: active.");
  }
} else {
  await staffRef.set({
    uid,
    email:       ADMIN_EMAIL,
    name:        ADMIN_NAME,
    role:        "platform_admin",
    status:      "active",
    designation: "Platform Administrator",
    createdAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
  });
  console.log("✅  staffProfiles document created.");
}

// Step 3: Set custom claims — preserve any unrelated existing claims
const userRecord     = await adminAuth.getUser(uid);
const existingClaims = userRecord.customClaims || {};
// Drop stale role-related claims; keep anything else (e.g. app-specific flags)
const { role: _, orgId: _o, memberId: _m, ...otherClaims } = existingClaims;

await adminAuth.setCustomUserClaims(uid, { ...otherClaims, role: "platform_admin" });
console.log('✅  Custom claims set: { role: "platform_admin" }');

// ── Summary ───────────────────────────────────────────────────────────────────
const bar = "═".repeat(62);
console.log(`\n${bar}`);
console.log("  ✅  Provisioning complete");
console.log(bar);
console.log(`  UID    : ${uid}`);
console.log(`  Email  : ${ADMIN_EMAIL}`);
console.log(`  Role   : platform_admin`);
console.log(`  Status : active`);
if (userCreated) {
  console.log();
  console.log("  ⚠️   A new Firebase Auth user was created.");
  console.log("      The password you supplied is NOT stored here or in Firestore.");
  console.log("      Keep it in your password manager.");
}
console.log();
console.log("  NEXT STEPS");
console.log("  ─────────────────────────────────────────────────");
console.log("  1. Start the app with Vercel Dev (serves both");
console.log("     the React frontend AND the /api/* functions):");
console.log();
console.log("       cd frontend");
console.log("       npx vercel dev");
console.log();
console.log("     Open http://localhost:3000 in your browser.");
console.log();
console.log("  2. Click 'Staff Login' and sign in with:");
console.log(`       Email    : ${ADMIN_EMAIL}`);
console.log("       Password : (the value you used for ADMIN_PASSWORD)");
console.log();
console.log("  3. The app calls POST /api/auth/sync-staff, which");
console.log("     reads your staffProfiles document and attaches");
console.log('     your custom claims ({ role: "platform_admin" }).');
console.log();
console.log("  4. You will land on the Platform Admin dashboard.");
console.log(bar);
console.log();
