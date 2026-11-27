> [!WARNING]
> **SUPERSEDED HISTORICAL TASK LIST (2026-11-27):** These tasks were generated for an older Next.js + TypeScript + Cloud Functions + case-management plan and do **not** represent active work items. Refer to [spec.md](./spec.md), [plan.md](./plan.md), and [data-model.md](./data-model.md) for the confirmed React + Vite + JS + Vercel API + Firebase Spark MVP.

# Tasks: Naya Sahara Service-Tracking MVP (Historical / Superseded)

**Input**: Design documents from `specs/001-service-tracking-mvp/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Acceptance, role-access, and offline tests are included because the feature
specification defines independent tests and measurable success criteria.

**Organization**: Tasks are grouped by user story. Every task has an exact
implementation or test path.

## Phase 1: Setup

**Purpose**: Initialize the application, source layout, and test/emulator tooling.

- [ ] T001 Initialize the Next.js App Router TypeScript application and create the planned `src/`, `functions/`, `shared/`, and `tests/` roots in `package.json` and the repository root.
- [ ] T002 Configure Tailwind CSS, shadcn/ui, shared CSS tokens, and base UI components in `components.json`, `src/app/globals.css`, and `src/components/ui/`.
- [ ] T003 [P] Configure Firebase Emulator Suite, Vitest, and Playwright in `firebase.json`, `.firebaserc`, `vitest.config.ts`, and `playwright.config.ts`.

## Phase 2: Foundational

**Purpose**: Build shared authorization, data contracts, localization, and safe service
boundaries required before any user story.

- [ ] T004 Configure Firebase Web/Admin SDK initialization, emulator connection, Asia-South region constants, and a bootstrap boundary that selects Firestore cache before any Firestore use in `src/lib/firebase/client.ts`, `functions/src/config.ts`, and `functions/src/index.ts`.
- [ ] T005 Implement staff sign-in, verified-email/TOTP enrollment gates, server-assigned role/org claims, and staff profile validation in `src/features/auth/`, `functions/src/auth/claims.ts`, and `shared/schemas/access.ts`; use `data-model.md` definitions for `StaffProfile.uid`, `StaffProfile.role`, `StaffProfile.orgId`, and `StaffProfile.displayName`.
- [ ] T006 Define and unit-test the shared Consent, Case, CaseUpdateProposal, and CaseLogEntry schemas in `shared/schemas/consent.ts`, `shared/schemas/case.ts`, `shared/schemas/case-update.ts`, and `tests/unit/domain-schemas.test.ts`; use `data-model.md` definitions for `Consent.caseId`, `Consent.orgId`, `Consent.method`, `Consent.consentVersion`, `Consent.language`, `Consent.recordedAt`, `Consent.status`, `Consent.revokedAt`, `Consent.copyProvidedAt`, `Consent.syntheticScanObjectRef`; `Case.orgId`, `Case.consentId`, `Case.memberUid`, `Case.caseStatus`, `Case.nextHearingAt`, `Case.hearingReminderEnabled`, `Case.legalStatus`, `Case.expectedReleaseMonth`, `Case.healthHygieneNeeds`, `Case.releaseChecklist`, `Case.revision`, `Case.createdAt`, `Case.updatedAt`; `CaseUpdateProposal.proposalId`, `CaseUpdateProposal.orgId`, `CaseUpdateProposal.caseId`, `CaseUpdateProposal.actorUid`, `CaseUpdateProposal.field`, `CaseUpdateProposal.proposedValue`, `CaseUpdateProposal.baseRevision`, `CaseUpdateProposal.createdAt`, `CaseUpdateProposal.status`, `CaseUpdateProposal.serverAppliedAt`, `CaseUpdateProposal.resolution`; and `CaseLogEntry.proposalId`, `CaseLogEntry.field`, `CaseLogEntry.previousValue`, `CaseLogEntry.newValue`, `CaseLogEntry.actorUid`, `CaseLogEntry.createdAt`. Constrain offline proposals to `nextHearingAt` only as specified in `data-model.md`.
- [ ] T007 Establish deny-by-default Firestore and Storage Rules, role/org helper functions, and baseline emulator access tests in `firestore.rules`, `storage.rules`, and `tests/rules/authorization-base.test.ts`.
- [ ] T008 Set Nepali (`ne`) as the default locale, add the English (`en`) toggle, load Noto Sans Devanagari, and create responsive locale layouts in `src/i18n/request.ts`, `src/app/[locale]/layout.tsx`, `messages/ne.json`, and `messages/en.json`.
- [ ] T009 Implement typed error handling and privacy-safe audit logging for callable functions in `functions/src/lib/errors.ts`, `functions/src/lib/audit.ts`, and `functions/test/audit.test.ts`; use `data-model.md` definitions for `AuditEvent.actorUid`, `AuditEvent.orgId`, `AuditEvent.actionCode`, `AuditEvent.entityId`, and `AuditEvent.createdAt`, and exclude case values, messages, credentials, codes, and AI source text.
- [ ] T010 Implement a server-only public-content AI adapter and callable draft flow with JSON Schema validation, Platform Admin authorization, explicit model errors, and no logging of source/output text in `functions/src/public-content/ai-client.ts`, `functions/src/public-content/draft.ts`, `shared/schemas/public-content-ai.ts`, and `functions/test/public-content-ai.test.ts`.
- [ ] T011 Create an emulator-only synthetic seed script for organizations, staff, Members, consented cases, opportunities, and public notices in `scripts/seed-demo.ts`; make `npm run seed:demo` refuse non-emulator Firebase targets in `package.json` and `scripts/seed-demo.ts`.

**Checkpoint**: Shared app foundation, emulator environment, role boundaries, schemas,
and synthetic seed data are ready.

## Phase 3: User Story 1 - Approve an NGO and track a case through release (Priority: P1)

**Goal**: Approve an NGO, record consented minimal case data, complete release
handover, and let a Member claim an account without email or phone.

**Independent Test**: Using seeded Platform Admin and Org Admin accounts, register
and approve a synthetic NGO, create a consented case, record only allowed fields,
release and hand over a one-time code, claim as a Member, verify the Member sees
only her case and resources, and test PIN recovery.

### Tests for User Story 1

- [ ] T012 [P] [US1] Write the organization-approval, consented-case, release-handover, Member-claim, and PIN-recovery browser journey in `tests/e2e/organization-case-handover.spec.ts`.
- [ ] T013 [P] [US1] Write Firestore and Storage Rules tests for consent, role/org scope, Member ownership, and synthetic consent artifacts in `tests/rules/organization-consent-case.test.ts`.
- [ ] T014 [P] [US1] Write callable tests for one-time claim/recovery codes, generic failures, expiry, replacement, PIN hashing, and rate limits in `functions/test/member-auth.test.ts`.

### Implementation for User Story 1

- [ ] T015 [P] [US1] Define and validate organization registration/profile data in `shared/schemas/organization.ts`; use `data-model.md` definitions for `Organization.name`, `Organization.location`, `Organization.registrationStatus`, `Organization.profile`, `Organization.createdAt`, and `Organization.updatedAt`.
- [ ] T016 [P] [US1] Define and validate Caseworker roster and assignment data in `shared/schemas/caseworker.ts`; use `data-model.md` definitions for `CaseworkerRoster.orgId`, `CaseworkerRoster.displayName`, `CaseworkerRoster.active`, `CaseworkerAssignment.orgId`, `CaseworkerAssignment.caseworkerId`, `CaseworkerAssignment.caseId`, and `CaseworkerAssignment.status`.
- [ ] T017 [US1] Implement NGO registration, Platform Admin approval/rejection, and Org Admin profile/roster/assignment screens in `src/features/admin/organizations/registration-form.tsx`, `src/features/admin/approvals/organizations-page.tsx`, and `src/features/admin/caseworkers/roster-page.tsx`.
- [ ] T018 [US1] Implement consent capture/revocation, the constrained case form, allowed case-change history, generic release checklist, Member consent-copy delivery, and synthetic-only consent-artifact upload in `src/features/cases/case-form.tsx`, `src/features/admin/consent/consent-panel.tsx`, and `src/features/admin/consent-artifacts/upload.tsx`.
- [ ] T019 [US1] Enforce approved-organization, active-consent, Org Admin ownership, and Member case ownership rules for organization/case documents and synthetic consent artifacts in `firestore.rules` and `storage.rules`.
- [ ] T020 [US1] Implement claim-code issuance, Member nickname/PIN claim and sign-in, and in-person PIN recovery callables with server-only hashes, generic errors, idempotent issuance, and rate limits in `functions/src/auth/claim.ts`, `functions/src/auth/member-sign-in.ts`, `functions/src/auth/pin-recovery.ts`, and `functions/src/auth/credentials.ts`; use `data-model.md` definitions for `MemberProfile.uid`, `MemberProfile.orgId`, `MemberProfile.caseId`, `MemberProfile.nickname`, `MemberProfile.accountStatus`, `MemberProfile.createdAt`, `MemberProfile.updatedAt`; `MemberCredentials.normalizedNickname`, `MemberCredentials.pinSalt`, `MemberCredentials.pinHash`, `MemberCredentials.failedAttempts`, `MemberCredentials.lockedUntil`, `MemberCredentials.updatedAt`; `ClaimHandover.orgId`, `ClaimHandover.caseId`, `ClaimHandover.codeHash`, `ClaimHandover.issuedAt`, `ClaimHandover.expiresAt`, `ClaimHandover.status`, `ClaimHandover.consumedAt`, `ClaimHandover.replacedAt`; and `PINRecoveryCode.orgId`, `PINRecoveryCode.memberUid`, `PINRecoveryCode.codeHash`, `PINRecoveryCode.issuedAt`, `PINRecoveryCode.expiresAt`, `PINRecoveryCode.status`, `PINRecoveryCode.consumedAt`, `PINRecoveryCode.replacedAt`.
- [ ] T021 [US1] Implement the Member claim/sign-in screens and own-case dashboard with nickname-only presentation, consent-copy access, and no email/phone fields in `src/features/member/claim/claim-form.tsx`, `src/features/member/dashboard/page.tsx`, and `src/features/member/consent-copy/page.tsx`.
- [ ] T022 [US1] Implement the Org Admin recovery-code issuance screen and Member PIN-reset screen, including same-account recovery and generic invalid/expired/reused-code feedback in `src/features/member/recovery/reset-pin-form.tsx` and `src/features/admin/member-recovery/issue-code-button.tsx`.

**Checkpoint**: NGO approval, consented casework, release handover, Member access, and
PIN recovery work independently with synthetic data.

## Phase 4: User Story 2 - Find and understand support opportunities (Priority: P1)

**Goal**: Publish training, job, and aid opportunities; let Members filter by location
and type, hear content, and view approved translations.

**Independent Test**: With a seeded Member and synthetic public opportunities, filter
by location and type, switch between original and approved Nepali/English content,
and verify read-aloud uses the selected language.

### Tests for User Story 2

- [ ] T023 [P] [US2] Write opportunity filtering, language switching, translation-label, and read-aloud browser tests in `tests/e2e/opportunities.spec.ts`.
- [ ] T024 [P] [US2] Write opportunity type/location/schema and filtering unit tests in `tests/unit/opportunities.test.ts`.

### Implementation for User Story 2

- [ ] T025 [P] [US2] Define and validate opportunity and translation fields in `shared/schemas/opportunity.ts`; use `data-model.md` definitions for `Opportunity.orgId`, `Opportunity.type`, `Opportunity.location`, `Opportunity.originalText`, `Opportunity.originalLanguage`, `Opportunity.publicationStatus`, `Opportunity.translationDraft`, and `Opportunity.translationApproval`.
- [ ] T026 [US2] Implement Org Admin opportunity creation/editing/submission/publication and Platform Admin translation-draft review/approval controls using the shared public-content callable in `src/features/opportunities/admin/opportunity-editor.tsx` and `src/features/admin/public-content-review/opportunity-translation-review.tsx`.
- [ ] T027 [US2] Implement Member opportunity browse/filter views and original/approved translation display with the exact “AI translated” label in `src/features/opportunities/member/opportunity-list.tsx`.
- [ ] T028 [US2] Implement accessible read-aloud and language-aware content controls, using public cached audio where available and local-only voices for private text, in `src/features/opportunities/read-aloud.ts` and `src/components/accessibility/ReadAloudButton.tsx`.

**Checkpoint**: A Member can independently discover and understand synthetic public
opportunities without accessing case data.

## Phase 5: User Story 3 - Publish a reviewed government notice (Priority: P1)

**Goal**: Let a Platform Admin enter a public notice, review/correct AI translation
and extracted fields, and publish only approved content.

**Independent Test**: Create a synthetic public notice, request a draft, verify it
remains hidden, approve/correct translation and extracted details, and verify only
the approved content is visible to Members and Guests.

### Tests for User Story 3

- [ ] T029 [P] [US3] Write notice authoring, draft-hidden, approval, correction, and public-display browser tests in `tests/e2e/government-notices.spec.ts`.
- [ ] T030 [P] [US3] Write Rules tests proving drafts are unreadable to Members/Guests and only approved notices are public in `tests/rules/government-notices.test.ts`.

### Implementation for User Story 3

- [ ] T031 [P] [US3] Define and validate public notice and AI review fields in `shared/schemas/government-notice.ts`; use `data-model.md` definitions for `GovernmentNotice.sourceText`, `GovernmentNotice.sourceLanguage`, `GovernmentNotice.translation`, `GovernmentNotice.location`, `GovernmentNotice.eligibility`, `GovernmentNotice.deadline`, `GovernmentNotice.reviewStatus`, and `GovernmentNotice.publicationStatus`.
- [ ] T032 [US3] Implement Platform Admin notice entry, public-source confirmation, AI draft request, side-by-side review, correction, and approval screens in `src/features/notices/admin/notice-review.tsx`.
- [ ] T033 [US3] Implement notice draft persistence, Platform Admin approval, publication-state transitions, and public-only queries using the shared callable in `functions/src/notices/approval.ts` and `src/features/notices/public/notice-list.tsx`; keep unreviewed output hidden and preserve the original beside the labelled translation.

**Checkpoint**: Public notices cannot reach Members or Guests until an Admin has
reviewed and approved generated content.

## Phase 6: User Story 4 - Contact an NGO safely (Priority: P1)

**Goal**: Display NGO profiles, gate message requests and chat with explicit
disclosures, and provide block/report and quick exit.

**Independent Test**: With seeded Member/NGO accounts, submit a disclosed request,
accept it as the NGO, confirm the first-message disclosure before sending, then test
block, report, and quick exit.

### Tests for User Story 4

- [ ] T034 [P] [US4] Write message-request, first-message acknowledgement, acceptance, block/report, and quick-exit browser tests in `tests/e2e/messaging-safety.spec.ts`.
- [ ] T035 [P] [US4] Write message-request, conversation, block, and report schema tests in `tests/unit/messaging-safety.test.ts`.

### Implementation for User Story 4

- [ ] T036 [P] [US4] Define and validate request, conversation, message, block, and report records in `shared/schemas/messaging.ts`; use `data-model.md` definitions for `MessageRequest.memberUid`, `MessageRequest.orgId`, `MessageRequest.status`, `MessageRequest.disclosureVersion`, `MessageRequest.acknowledgedAt`; `Conversation.requestId`, `Conversation.memberUid`, `Conversation.orgId`, `Conversation.firstMessageDisclosureVersion`, `Conversation.firstMessageDisclosureAcceptedAt`; `Message.senderUid`, `Message.body`, `Message.createdAt`; `Block.actorUid`, `Block.targetUid`, `Block.status`; and `Report.reporterUid`, `Report.targetUid`, `Report.reasonCode`, `Report.reviewStatus`.
- [ ] T037 [US4] Implement public NGO profile views, Member request disclosure/affirmation, and Org Admin accept/decline actions in `src/features/organizations/public/profile.tsx` and `src/features/messaging/requests/request-form.tsx`.
- [ ] T038 [US4] Implement accepted conversations, first-message disclosure, text-only messaging, block/report actions, and matching Firestore Rules in `src/features/messaging/conversations/`, `src/features/safety/`, and `firestore.rules`; do not store attachments or send messages to AI.
- [ ] T039 [US4] Implement the persistent quick-exit control and discreet member-facing app identity in `src/components/safety/QuickExitButton.tsx`, `src/app/[locale]/layout.tsx`, and `src/app/manifest.ts`.

**Checkpoint**: Member contact stays opt-in, recipient-specific, and separate from
case records; blocked contact cannot continue.

## Phase 7: User Story 5 - Add a minimal offline hearing-date edit (Priority: P1)

**Goal**: After the core online journeys work, implement one narrow offline slice:
change only `nextHearingAt`, synchronize it once, show clear states, and preserve a
same-field conflict for Org Admin resolution. Do not build generic offline case
creation, multi-field editing, or a reusable sync framework.

**Independent Test**: With a seeded synthetic consented case, take the browser
offline, change only its next hearing date, reconnect, verify one applied case-log
entry and “Synced” status, then test a concurrent online edit and resolve both
preserved values.

### Tests for User Story 5

- [ ] T040 [P] [US5] Write one-field browser offline/reconnect, duplicate-retry, consent-revocation, and concurrent-`nextHearingAt`-conflict tests in `tests/e2e/offline-case-log.spec.ts`.
- [ ] T041 [P] [US5] Write trigger idempotency, base-revision conflict, and revoked-consent tests in `functions/test/case-update-processing.test.ts`.

### Implementation for User Story 5

- [ ] T042 [US5] Select `persistentLocalCache` once at app bootstrap only after an authorized Org Admin confirms the device is trusted and the demo is synthetic; keep offline case edits Org Admin-only and show Offline/Pending sync/Synced or unsupported-browser states in `src/lib/offline/firestore-cache.ts` and `src/components/offline/SyncStatus.tsx`; never claim cache clearing is secure erasure.
- [ ] T043 [US5] Implement only a `nextHearingAt` proposal with client-generated ID, base revision, idempotent processing, active-consent check, one case-log entry, and two-value conflict resolution in `src/lib/offline/case-updates.ts`, `functions/src/cases/process-update-proposal.ts`, and `src/features/cases/conflict-resolution/`; use `data-model.md` definitions for `CaseUpdateProposal.field`, `CaseUpdateProposal.proposedValue`, and `CaseLogEntry.proposalId`, `CaseLogEntry.field`, `CaseLogEntry.previousValue`, `CaseLogEntry.newValue`, `CaseLogEntry.actorUid`, `CaseLogEntry.createdAt`.
- [ ] T044 [US5] Add create-only Rules for `nextHearingAt` proposals and emulator checks for active consent, organization scope, valid hearing-date timestamps, duplicate denial, and Member/Guest denial in `firestore.rules` and `tests/rules/case-update-proposals.test.ts`.

**Checkpoint**: The synthetic offline journey shows truthful pending/synced states,
produces exactly one log entry, and never silently overwrites a conflicting date.

## Phase 8: User Story 6 - Join an anonymous community group (Priority: P2)

**Goal**: Let Members join optional peer-support groups and post under nicknames with
block/report controls.

**Independent Test**: With seeded Members and a synthetic group, join, post, verify
nickname-only rendering, then report/block and confirm blocked contact is prevented.

### Tests for User Story 6

- [ ] T045 [P] [US6] Write group join/post/nickname/report/block browser tests in `tests/e2e/community-groups.spec.ts`.
- [ ] T046 [P] [US6] Write community profile, membership, and post schema tests in `tests/unit/community.test.ts`.

### Implementation for User Story 6

- [ ] T047 [P] [US6] Define and validate community profile, group, membership, and post records in `shared/schemas/community.ts`; use `data-model.md` definitions for `CommunityProfile.uid`, `CommunityProfile.nickname`, `Group.groupId`, `Group.name`, `GroupMembership.groupId`, `GroupMembership.memberUid`, `GroupMembership.status`, `GroupPost.groupId`, `GroupPost.authorUid`, `GroupPost.body`, and `GroupPost.createdAt`.
- [ ] T048 [US6] Implement group discovery/join, nickname-only text posts, and reused report/block actions with Firestore Rules in `src/features/community/` and `firestore.rules`; omit photos, attachments, and full moderation tooling.

**Checkpoint**: The P2 community feature can be enabled without exposing legal
identity or case information.

## Phase 9: Polish and Cross-Cutting Concerns

**Purpose**: Validate the connected demo, accessibility, and release gates.

- [ ] T049 [P] Complete the six-step synthetic demo and navigation integration in `tests/e2e/demo-flow.spec.ts`, covering NGO registration/approval, case entry/release, Member claim, opportunity discovery, notice approval, and NGO contact.
- [ ] T050 [P] Verify Nepali-first rendering, keyboard/focus behavior, large icon-and-text controls, responsive layouts, and read-aloud fallbacks in `tests/e2e/accessibility.spec.ts` and `src/app/[locale]/`.
- [ ] T051 Run Rules, unit, function, and browser suites; resolve failures in `tests/`, `functions/test/`, and `package.json` scripts.
- [ ] T052 Validate local emulator setup, seeded synthetic data, offline rehearsal, and demo instructions against `specs/001-service-tracking-mvp/quickstart.md`.
- [ ] T053 Add a deployment/release checklist that blocks real member data, real consent scans, and real persistent offline case data until lawyer, privacy, security, and device-cache reviews are complete in `specs/001-service-tracking-mvp/quickstart.md`.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1–US4 (Phases 3–6)**: Depend on the foundation and can be developed with
  independent synthetic fixtures. US1 is the first end-to-end priority.
- **US5 (Phase 7)**: Uses the shared case schemas and is scheduled after the core
  online journeys; it remains a narrow, single-field offline increment.
- **US6 (Phase 8)**: Depends on the foundation and the shared block/report controls
  delivered by US4.
- **Polish (Phase 9)**: Depends on all selected stories.

### User Story Dependencies

- **US1 (P1)**: No dependency on another story; primary account/case journey.
- **US2 (P1)**: Can use a seeded Member and public-content fixture; final demo
  integration uses the account flow from US1.
- **US3 (P1)**: Can be implemented and tested independently with a seeded Platform
  Admin and synthetic public notice.
- **US4 (P1)**: Can be implemented and tested with seeded Member/NGO accounts; US6
  reuses its block/report controls.
- **US5 (P1)**: Uses the shared Case/Consent/CaseUpdateProposal schemas from Phase 2
  and a seeded synthetic case; scheduled after US1–US4 and has no dependency on their
  UI.
- **US6 (P2)**: Depends on US4 block/report behavior for shared safety controls.

### Parallel Opportunities

- Setup T002 and T003 can proceed in parallel after T001.
- Foundation T005–T009 can proceed in parallel after T004; T010 and T011 follow
  their service/emulator prerequisites.
- Within each story, the listed schema and test tasks touch separate files and can
  start in parallel; implementation starts after tests are written and run red.
- US2, US3, and US4 can be developed in parallel after Phase 2 with seeded fixtures.
  Schedule US5 after US1–US4; start US6 after US4 safety controls are available.

### Parallel Examples by User Story

```text
US1: T012 + T013 + T014 (journey, Rules, and callable tests)
US2: T023 + T024 + T025 (browser tests, unit tests, and schema)
US3: T029 + T030 + T031 (browser tests, Rules tests, and schema)
US4: T034 + T035 + T036 (browser tests, unit tests, and schema)
US5: T040 + T041 (browser and Functions tests)
US6: T045 + T046 + T047 (browser tests, unit tests, and schema)
```

## Implementation Strategy

### Hackathon MVP

Complete Setup and Foundation, then deliver **US1–US4** for the core online demo.
After those journeys work, add US5 as a small, single-field offline follow-on for
`nextHearingAt`; do not expand it into general offline casework. US6 is P2 and may
follow if time permits. All demo, test, and preview data remains synthetic, and no
real-world pilot proceeds until the offline and review gates are satisfied.

### Incremental Delivery

1. Complete Setup and Foundation; validate emulator-only seeds and role rules.
2. Deliver US1 and verify NGO approval, consent, release handover, Member claim, and
   recovery independently.
3. Deliver US2 and US3 independently, then run the public opportunity/notice flows.
4. Deliver US4 with seeded accounts, then verify message consent and block/report.
5. Add the narrow US5 hearing-date offline slice and verify conflict resolution.
6. Add US6 after shared safety controls are complete.
7. Run the four-minute synthetic demo, quickstart, accessibility, and release-gate
   checks.

## Notes

- Every task uses the required checkbox, sequential ID, optional `[P]`, story label
  for story tasks, and exact file path.
- Tests are written before implementation within each story and should fail until
  the behavior is implemented.
- `data-model.md` is canonical for constrained fields; schema tasks cite each
  implemented entity field.
- Persistent browser caching, consent scans, and all other data remain synthetic
  only; clearing Firestore persistence is not secure erasure.
