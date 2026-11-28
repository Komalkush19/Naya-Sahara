/* global process */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

/**
 * Stage 3: Dedicated Firestore Security Rules Emulator Test Suite
 * Executes against the local Firestore Emulator via @firebase/rules-unit-testing.
 *
 * Uses the canonical production rules file at the repository root and dedicated demo project demo-naya-sahara.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const PROJECT_ID = "demo-naya-sahara";
const RULES_PATH = path.resolve(REPO_ROOT, "firestore.rules");

async function main() {
  console.log("=============================================================");
  console.log("Naya Sahara | Phase 3C-3B2 Firestore Rules Emulator Suite");
  console.log("=============================================================\n");

  if (!fs.existsSync(RULES_PATH)) {
    console.error(`[FATAL] Canonical rules file not found at: ${RULES_PATH}`);
    process.exit(1);
  }

  const rulesContent = fs.readFileSync(RULES_PATH, "utf8");
  console.log(`[INIT] Loaded canonical rules from: ${RULES_PATH} (${rulesContent.length} bytes)`);
  console.log(`[INIT] Target Project ID: ${PROJECT_ID}`);

  // Resolve @firebase/rules-unit-testing using require from frontend/package.json
  let rulesTesting;
  try {
    const require = createRequire(path.resolve(REPO_ROOT, "frontend/package.json"));
    rulesTesting = require("@firebase/rules-unit-testing");
  } catch (err) {
    console.log(`\n[STAGE 1 NOTICE] @firebase/rules-unit-testing could not be loaded: ${err.message}`);
    return;
  }

  const {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
  } = rulesTesting;

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const [host, portStr] = emulatorHost.split(":");
  const port = parseInt(portStr || "8080", 10);

  let testEnv;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rulesContent,
        host,
        port,
      },
    });
  } catch (err) {
    console.log(`\n[EMULATOR CONNECTION STATUS] Could not connect to Firestore Emulator at ${host}:${port}: ${err.message}`);
    console.log("Make sure the Firebase Emulator is running via: firebase emulators:exec --only firestore '...'");
    return;
  }

  let passed = 0;
  let failed = 0;

  async function runTest(name, fn) {
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}`);
      console.error(`  Error: ${err.message}`);
      failed++;
    } finally {
      await testEnv.clearFirestore();
    }
  }

  // =========================================================================
  // 1. Authentication and Default Access
  // =========================================================================
  await runTest("Default Deny: Unmatched collection read/write is denied", async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthed.collection("random_unmatched").doc("doc1").get());
    await assertFails(unauthed.collection("random_unmatched").doc("doc1").set({ a: 1 }));
  });

  await runTest("Default Deny: Authenticated users cannot access unmatched paths", async () => {
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertFails(authed.collection("arbitrary_unknown").doc("item1").get());
    await assertFails(authed.collection("arbitrary_unknown").doc("item1").set({ data: "leak" }));
  });

  // =========================================================================
  // 2. Members (members/{memberUid})
  // =========================================================================
  await runTest("Members: Member can read their own profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("members").doc("user_1").set({
        nickname: "Maya",
        status: "active",
        associatedOrgId: "org_asha",
      });
    });
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertSucceeds(authed.collection("members").doc("user_1").get());
  });

  await runTest("Members: Member cannot read another member's profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("members").doc("user_2").set({
        nickname: "Kamala",
        status: "active",
        associatedOrgId: "org_asha",
      });
    });
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertFails(authed.collection("members").doc("user_2").get());
  });

  await runTest("Members: Verified NGO staff can read associated members", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("organizations").doc("org_asha").set({
        verificationStatus: "verified",
      });
      await context.firestore().collection("members").doc("user_1").set({
        associatedOrgId: "org_asha",
      });
    });
    const staffCtx = testEnv.authenticatedContext("staff_1", {
      role: "ngo_admin",
      orgId: "org_asha",
    }).firestore();
    await assertSucceeds(staffCtx.collection("members").doc("user_1").get());
  });

  await runTest("Members: NGO staff cannot read member of another organization", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("organizations").doc("org_other").set({
        verificationStatus: "verified",
      });
      await context.firestore().collection("members").doc("user_2").set({
        associatedOrgId: "org_other",
      });
    });
    const staffCtx = testEnv.authenticatedContext("staff_1", {
      role: "ngo_admin",
      orgId: "org_asha",
    }).firestore();
    await assertFails(staffCtx.collection("members").doc("user_2").get());
  });

  await runTest("Members: Unverified NGO staff cannot read associated member records", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("organizations").doc("org_pending").set({
        verificationStatus: "pending",
      });
      await context.firestore().collection("members").doc("user_3").set({
        associatedOrgId: "org_pending",
      });
    });
    const staffCtx = testEnv.authenticatedContext("staff_p", {
      role: "ngo_admin",
      orgId: "org_pending",
    }).firestore();
    await assertFails(staffCtx.collection("members").doc("user_3").get());
  });

  await runTest("Members: NGO member query without associatedOrgId filter is denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("organizations").doc("org_asha").set({
        verificationStatus: "verified",
      });
      await context.firestore().collection("members").doc("user_1").set({
        associatedOrgId: "org_asha",
      });
    });
    const staffCtx = testEnv.authenticatedContext("staff_1", {
      role: "ngo_admin",
      orgId: "org_asha",
    }).firestore();
    // Unconstrained query denied
    await assertFails(staffCtx.collection("members").get());
  });

  await runTest("Members: NGO member query properly constrained with associatedOrgId succeeds", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("organizations").doc("org_asha").set({
        verificationStatus: "verified",
      });
      await context.firestore().collection("members").doc("user_1").set({
        associatedOrgId: "org_asha",
      });
    });
    const staffCtx = testEnv.authenticatedContext("staff_1", {
      role: "ngo_admin",
      orgId: "org_asha",
    }).firestore();
    // Properly constrained query succeeds
    await assertSucceeds(
      staffCtx.collection("members").where("associatedOrgId", "==", "org_asha").get()
    );
  });

  await runTest("Members: Member can update own avatarId and updatedAt only", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("members").doc("user_1").set({
        nickname: "Maya",
        avatarId: "avatar_1",
        associatedOrgId: "org_asha",
        status: "active",
      });
    });
    const authed = testEnv.authenticatedContext("user_1").firestore();
    // Valid update
    await assertSucceeds(
      authed.collection("members").doc("user_1").update({
        avatarId: "avatar_2",
        updatedAt: new Date().toISOString(),
      })
    );
    // Tampering with protected status fails
    await assertFails(
      authed.collection("members").doc("user_1").update({
        status: "vip",
      })
    );
  });

  await runTest("Members: Client creation and deletion are denied (server-only)", async () => {
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertFails(
      authed.collection("members").doc("user_new").set({ nickname: "Newbie" })
    );
    await assertFails(
      authed.collection("members").doc("user_1").delete()
    );
  });

  // =========================================================================
  // 3. Sensitive Collections (Client Denied)
  // =========================================================================
  await runTest("Sensitive: Clients cannot read or write memberCredentials", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("memberCredentials").doc("sajilo").set({
        passwordHash: "$2b$12$hash",
      });
    });
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertFails(authed.collection("memberCredentials").doc("sajilo").get());
    await assertFails(authed.collection("memberCredentials").doc("sajilo").set({ passwordHash: "hacked" }));
  });

  await runTest("Sensitive: Clients cannot read or write handoverCodes", async () => {
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertFails(authed.collection("handoverCodes").doc("code_hash").get());
    await assertFails(authed.collection("handoverCodes").doc("code_hash").set({ status: "used" }));
  });

  await runTest("Sensitive: Clients cannot read or write authRateLimits", async () => {
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertFails(authed.collection("authRateLimits").doc("ip_hash").get());
    await assertFails(authed.collection("authRateLimits").doc("ip_hash").set({ attempts: 0 }));
  });

  await runTest("Sensitive: Clients cannot write adminAuditLogs; Admin can read", async () => {
    const authed = testEnv.authenticatedContext("user_1").firestore();
    const admin = testEnv.authenticatedContext("admin_1", { role: "platform_admin" }).firestore();
    await assertFails(authed.collection("adminAuditLogs").doc("log1").set({ action: "audit" }));
    await assertFails(admin.collection("adminAuditLogs").doc("log1").set({ action: "audit" }));
    await assertFails(authed.collection("adminAuditLogs").doc("log1").get());
    await assertSucceeds(admin.collection("adminAuditLogs").doc("log1").get());
  });

  // =========================================================================
  // 4. Community Profiles (communityProfiles/{memberUid})
  // =========================================================================
  await runTest("CommunityProfiles: Opted-in profiles are readable by authenticated members", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("communityProfiles").doc("user_2").set({
        uid: "user_2",
        nickname: "Kamala",
        avatarId: "avatar_1",
        communityOptIn: true,
      });
      await context.firestore().collection("communityProfiles").doc("user_3").set({
        uid: "user_3",
        nickname: "Pooja",
        avatarId: "avatar_2",
        communityOptIn: false,
      });
    });
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertSucceeds(authed.collection("communityProfiles").doc("user_2").get());
    await assertFails(authed.collection("communityProfiles").doc("user_3").get());
  });

  await runTest("CommunityProfiles: Schema whitelist strictly enforced on write", async () => {
    const authed = testEnv.authenticatedContext("user_1").firestore();
    // Valid write
    await assertSucceeds(
      authed.collection("communityProfiles").doc("user_1").set({
        uid: "user_1",
        nickname: "Maya",
        avatarId: "avatar_1",
        district: "Lalitpur",
        interests: ["Tailoring"],
        communityOptIn: true,
      })
    );
    // Malicious write with injected unauthorized attribute
    await assertFails(
      authed.collection("communityProfiles").doc("user_1").set({
        uid: "user_1",
        nickname: "Maya",
        avatarId: "avatar_1",
        communityOptIn: true,
        isVerifiedAdmin: true, // Prohibited key
      })
    );
  });

  await runTest("CommunityProfiles: User cannot modify another user's profile", async () => {
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertFails(
      authed.collection("communityProfiles").doc("user_2").set({
        uid: "user_2",
        nickname: "Spoofed",
        avatarId: "avatar_1",
        communityOptIn: true,
      })
    );
  });

  await runTest("CommunityProfiles: User can delete own community profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("communityProfiles").doc("user_1").set({
        uid: "user_1",
        nickname: "Maya",
        avatarId: "avatar_1",
        communityOptIn: true,
      });
    });
    const authed = testEnv.authenticatedContext("user_1").firestore();
    await assertSucceeds(authed.collection("communityProfiles").doc("user_1").delete());
  });

  // =========================================================================
  // 5. Organizations and Staff
  // =========================================================================
  await runTest("Organizations: Public can read verified NGOs only", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("organizations").doc("org_verified").set({
        name: "Verified NGO",
        verificationStatus: "verified",
      });
      await context.firestore().collection("organizations").doc("org_pending").set({
        name: "Pending NGO",
        verificationStatus: "pending",
      });
    });
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(unauthed.collection("organizations").doc("org_verified").get());
    await assertFails(unauthed.collection("organizations").doc("org_pending").get());
  });

  await runTest("Organizations: NGO staff can read own organization regardless of status", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("organizations").doc("org_pending").set({
        name: "Pending NGO",
        verificationStatus: "pending",
      });
    });
    const staffCtx = testEnv.authenticatedContext("staff_p", {
      role: "ngo_admin",
      orgId: "org_pending",
    }).firestore();
    await assertSucceeds(staffCtx.collection("organizations").doc("org_pending").get());
  });

  await runTest("Organizations: Staff cannot alter verificationStatus or id", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("organizations").doc("org_asha").set({
        name: "Asha Sathi",
        verificationStatus: "verified",
        id: "org_asha",
      });
    });
    const staffCtx = testEnv.authenticatedContext("staff_1", {
      role: "ngo_admin",
      orgId: "org_asha",
    }).firestore();
    // Staff updating caseworkers succeeds
    await assertSucceeds(
      staffCtx.collection("organizations").doc("org_asha").update({ caseworkers: ["Worker 1"] })
    );
    // Staff attempting to tamper with verificationStatus fails
    await assertFails(
      staffCtx.collection("organizations").doc("org_asha").update({ verificationStatus: "unverified" })
    );
  });

  await runTest("Organizations: Platform admin can create and delete organizations", async () => {
    const admin = testEnv.authenticatedContext("admin_1", { role: "platform_admin" }).firestore();
    const staff = testEnv.authenticatedContext("staff_1", { role: "ngo_admin", orgId: "org_asha" }).firestore();

    await assertSucceeds(
      admin.collection("organizations").doc("org_new").set({ name: "New NGO", verificationStatus: "verified" })
    );
    await assertFails(
      staff.collection("organizations").doc("org_new2").set({ name: "Staff Created NGO" })
    );
    await assertSucceeds(admin.collection("organizations").doc("org_new").delete());
  });

  await runTest("StaffProfiles: Staff can read own profile; other staff and writes denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("staffProfiles").doc("staff_1").set({
        uid: "staff_1",
        email: "staff@asha.org",
        role: "ngo_admin",
        orgId: "org_asha",
      });
    });
    const staff1 = testEnv.authenticatedContext("staff_1").firestore();
    const staff2 = testEnv.authenticatedContext("staff_2").firestore();
    await assertSucceeds(staff1.collection("staffProfiles").doc("staff_1").get());
    await assertFails(staff2.collection("staffProfiles").doc("staff_1").get());
    await assertFails(staff1.collection("staffProfiles").doc("staff_1").update({ role: "platform_admin" }));
  });

  // =========================================================================
  // 6. Notices
  // =========================================================================
  await runTest("Notices: Public can read published and approved notices only", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("notices").doc("pub_notice").set({
        title: "Public Notice",
        publicationStatus: "published",
        reviewStatus: "approved",
      });
      await context.firestore().collection("notices").doc("draft_notice").set({
        title: "Draft Notice",
        publicationStatus: "draft",
        reviewStatus: "pending_review",
        orgId: "org_asha",
      });
    });
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(unauthed.collection("notices").doc("pub_notice").get());
    await assertFails(unauthed.collection("notices").doc("draft_notice").get());
  });

  await runTest("Notices: Staff can create notice in draft status for own org only", async () => {
    const staffA = testEnv.authenticatedContext("staff_1", { role: "ngo_admin", orgId: "org_asha" }).firestore();

    // Staff creating notice for own org in draft succeeds
    await assertSucceeds(
      staffA.collection("notices").doc("notice_draft_1").set({
        title: "Vocational Class",
        orgId: "org_asha",
        publicationStatus: "draft",
      })
    );

    // Staff creating notice for another org fails
    await assertFails(
      staffA.collection("notices").doc("notice_draft_other").set({
        title: "Other Org Notice",
        orgId: "org_other",
        publicationStatus: "draft",
      })
    );

    // Staff attempting to directly publish without review fails
    await assertFails(
      staffA.collection("notices").doc("notice_published_direct").set({
        title: "Direct Published Notice",
        orgId: "org_asha",
        publicationStatus: "published",
        reviewStatus: "approved",
      })
    );
  });

  // =========================================================================
  // 7. Conversations and Messages
  // =========================================================================
  await runTest("Conversations: Authorized participant can read; non-participant denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("conversations").doc("conv_part").set({
        type: "member",
        participantIds: ["user_1", "user_2"],
        requestStatus: "accepted",
      });
    });
    const partCtx = testEnv.authenticatedContext("user_1").firestore();
    const nonPartCtx = testEnv.authenticatedContext("user_3").firestore();

    await assertSucceeds(partCtx.collection("conversations").doc("conv_part").get());
    await assertFails(nonPartCtx.collection("conversations").doc("conv_part").get());
  });

  await runTest("Conversations: SEC-1 prevents requester from accepting own request", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("conversations").doc("conv_1").set({
        type: "member",
        participantIds: ["user_1", "user_2"],
        requesterId: "user_1",
        requesterRole: "member",
        recipientId: "user_2",
        recipientRole: "member",
        requestStatus: "pending",
        blocked: false,
      });
    });
    const requesterCtx = testEnv.authenticatedContext("user_1").firestore();
    const recipientCtx = testEnv.authenticatedContext("user_2").firestore();

    // Requester attempting to accept fails
    await assertFails(
      requesterCtx.collection("conversations").doc("conv_1").update({ requestStatus: "accepted" })
    );
    // Intended recipient accepting succeeds
    await assertSucceeds(
      recipientCtx.collection("conversations").doc("conv_1").update({ requestStatus: "accepted" })
    );
  });

  await runTest("Conversations: SEC-2 prevents NGO-to-NGO initiation", async () => {
    const ngoStaff = testEnv.authenticatedContext("staff_1", {
      role: "ngo_admin",
      orgId: "org_asha",
    }).firestore();

    // NGO to member succeeds
    await assertSucceeds(
      ngoStaff.collection("conversations").doc("conv_ngo_mem").set({
        type: "ngo",
        requesterId: "org_asha",
        requesterRole: "org",
        recipientId: "user_1",
        recipientRole: "member",
        requestStatus: "pending",
        blocked: false,
      })
    );

    // NGO to NGO fails
    await assertFails(
      ngoStaff.collection("conversations").doc("conv_ngo_ngo").set({
        type: "ngo",
        requesterId: "org_asha",
        requesterRole: "org",
        recipientId: "org_other",
        recipientRole: "org",
        requestStatus: "pending",
        blocked: false,
      })
    );
  });

  await runTest("Messages: Creation allowed in accepted conversation; denied in pending/blocked", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("conversations").doc("conv_acc").set({
        type: "member",
        participantIds: ["user_1", "user_2"],
        requestStatus: "accepted",
        blocked: false,
      });
      await context.firestore().collection("conversations").doc("conv_pend").set({
        type: "member",
        participantIds: ["user_1", "user_2"],
        requestStatus: "pending",
        blocked: false,
      });
      await context.firestore().collection("conversations").doc("conv_blk").set({
        type: "member",
        participantIds: ["user_1", "user_2"],
        requestStatus: "accepted",
        blocked: true,
      });
    });
    const authed = testEnv.authenticatedContext("user_1").firestore();

    // In accepted conversation succeeds
    await assertSucceeds(
      authed.collection("conversations").doc("conv_acc").collection("messages").doc("msg_1").set({
        authorId: "user_1",
        text: "Namaste",
      })
    );

    // In pending conversation fails
    await assertFails(
      authed.collection("conversations").doc("conv_pend").collection("messages").doc("msg_2").set({
        authorId: "user_1",
        text: "Pre-acceptance attempt",
      })
    );

    // In blocked conversation fails
    await assertFails(
      authed.collection("conversations").doc("conv_blk").collection("messages").doc("msg_3").set({
        authorId: "user_1",
        text: "Blocked attempt",
      })
    );
  });

  await runTest("Messages: Messages are immutable (cannot update or delete)", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("conversations").doc("conv_acc").set({
        type: "member",
        participantIds: ["user_1", "user_2"],
        requestStatus: "accepted",
        blocked: false,
      });
      await context.firestore().collection("conversations").doc("conv_acc").collection("messages").doc("msg_1").set({
        authorId: "user_1",
        text: "Permanent text",
      });
    });
    const authed = testEnv.authenticatedContext("user_1").firestore();

    await assertFails(
      authed.collection("conversations").doc("conv_acc").collection("messages").doc("msg_1").update({ text: "Edited" })
    );
    await assertFails(
      authed.collection("conversations").doc("conv_acc").collection("messages").doc("msg_1").delete()
    );
  });

  // =========================================================================
  // 8. Reports
  // =========================================================================
  await runTest("Reports: Member can create report; Admin can read; Unauthorized cannot read", async () => {
    const reporter = testEnv.authenticatedContext("user_1").firestore();
    const admin = testEnv.authenticatedContext("admin_1", { role: "platform_admin" }).firestore();
    const bystander = testEnv.authenticatedContext("user_2").firestore();

    await assertSucceeds(
      reporter.collection("reports").doc("rep_1").set({
        reporterUid: "user_1",
        reason: "Harassment",
      })
    );
    await assertFails(bystander.collection("reports").doc("rep_1").get());
    await assertSucceeds(admin.collection("reports").doc("rep_1").get());
  });

  console.log("\n=============================================================");
  console.log(`Firestore Emulator Suite Results: ${passed} passed, ${failed} failed`);
  console.log("=============================================================");

  await testEnv.cleanup();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
