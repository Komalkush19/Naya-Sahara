# Data Model: Naya Sahara Hackathon MVP

**Updated**: 2026-11-27 | **Active Spec**: [spec.md](./spec.md)

> This data model supersedes the earlier case-management, hearing-date, consent-scan, and PIN-recovery schema. All development/demo data is synthetic.

## Core Modeling & Privacy Rules

1. **No sensitive case/legal/medical data:** Do not store incarceration histories, court files, offence details, medical diagnoses, children's names, guardian details, or women's real names/emails/phones.
2. **Strict profile separation:** Opt-in community profiles (`communityProfiles`) expose only pseudonymous public-to-members fields and never expose `associatedOrgId` or internal verification metadata.
3. **Server-only secrets:** Password hashes (`memberCredentials`) and handover code hashes (`handoverCodes`) are inaccessible from client Firestore queries (`allow read, write: if false`).
4. **Auth UID–based messaging:** Conversations and message requests authorize using actual Firebase Auth UIDs (`participantIds`), never treating an `orgId` as a user UID.

---

## Firestore Collections

### 1. `organizations/{orgId}`
Public NGO profile, verification status, and embedded caseworker directory.
- `name`, `description`, `mainWorkArea`, `category`, `location`, `address`
- `contactNumber`, `contactEmail`, `logoUrl` (local path under `/images/ngos/`)
- `adminUid` (Firebase Auth UID of the NGO's admin account)
- `verificationStatus`: `pending | verified | rejected | archived`
- `syntheticActiveCaseCount`: synthetic demo metric only (no real case records)
- `caseworkers[]`: `[{ id, name, designation, bio, joiningDate, syntheticCaseCount, status, photoUrl }]`
- `createdAt`, `updatedAt`

**Rules:** Public/Guest & Members read only `verified` NGOs. NGO Admin reads/updates own profile & `caseworkers[]` (cannot change `verificationStatus`). Platform Admin reads all and updates `verificationStatus` / `archived`.

### 2. `staffProfiles/{uid}`
- `uid`, `role` (`platform_admin | ngo_admin`), `orgId` (nullable for Platform Admin), `displayName`, `createdAt`

**Rules:** Staff can read their own profile only; written via `firebase-admin`.

### 3. `members/{uid}`
Internal pseudonymous member record (no real email, phone, or legal name).
- `uid`, `nickname`, `avatarId` (`avatar1`..`avatar4`)
- `associatedOrgId`, `associatedOrgName`, `verificationStatus` (`verified | pending`)
- `joinedAt`, `status` (`active | inactive`)

**Rules:** Member reads/updates own `avatarId`. Associated NGO (`token.orgId == resource.data.associatedOrgId`) reads associated women. Platform Admin reads basic non-sensitive fields (`nickname`, `avatarId`, `joinedAt`, `associatedOrgName`, `verificationStatus`, `status`). Guests and unrelated NGOs/members denied.

### 4. `communityProfiles/{uid}`
Opt-in pseudonymous directory record visible only to authenticated Members.
- `uid`, `nickname`, `avatarId`
- `approximateLocation` (district or municipality only—never GPS coordinates)
- `interests[]` (optional skills/interests)
- `communityOptIn` (boolean)
- `updatedAt`

**Rules:** Authenticated Members read only where `communityOptIn == true`; Member creates/updates own doc only. Denied to Guests.

### 5. `memberCredentials/{normalizedNickname}` (Server-Only)
- `uid`, `passwordHash` (`bcryptjs`), `associatedOrgId`, `createdAt`, `updatedAt`

**Rules:** `allow read, write: if false;` (accessed solely by `firebase-admin` in `frontend/api/`).

### 6. `handoverCodes/{codeId}` (Server-Only)
- `codeHash` (hashed one-time code; raw code never stored), `orgId`, `orgName`, `issuedByUid`, `status` (`active | used | expired`), `expiresAt` (`issuedAt + 72h`), `usedByUid`, `createdAt`, `usedAt`

**Rules:** `allow read, write: if false;` (issued and redeemed solely via `frontend/api/`).

### 7. `notices/{noticeId}`
Unified collection for **NGO Notices** and **Government Notices** (replaces separate `opportunities`).
- `sourceType`: `ngo | government`
- `orgId`, `orgName` (for NGO notices; `null` for government)
- `title`, `originalText`, `originalLanguage` (`ne | en`), `sourceName`, `sourceUrl`, `publicationDate`
- `category`: `jobs | training | financial_aid | workshops | education | rehabilitation | legal_aid | government_program | other`
- `location`, `audienceTags[]`, `requirements`, `deadline` (only if explicitly stated), `contactInfo`
- `aiTranslation`, `aiSummary`, `extractedMeta` (`{ deadline, eligibility, requiredDocuments }` — only if explicitly in source)
- `aiGenerated` (boolean), `reviewStatus` (`not_needed | pending_review | approved | rejected`)
- `publicationStatus`: `draft | published | archived`
- `createdAt`, `updatedAt`, `reviewedBy`, `reviewedAt`

**Rules:** Public/Guest & Members read only where `publicationStatus == 'published'` (and if `aiGenerated == true`, `reviewStatus == 'approved'`). NGO Admin creates/edits/archives/deletes own `sourceType == 'ngo'` notices. Platform Admin manages all notices and reviews/approves/rejects AI content.

### 8. `messageRequests/{requestId}` & `conversations/{convId}` + `messages/{msgId}`
Supports **Woman ↔ NGO** and **Woman ↔ Woman** text-only messaging.
- `messageRequests/{requestId}`: `senderUid`, `senderNickname`, `senderAvatarId`, `recipientUid` (Member UID or NGO `adminUid`), `recipientType` (`ngo | member`), `orgId` (if `ngo`), `recipientLabel`, `participantIds` (`[senderUid, recipientUid]`), `status` (`pending | accepted | declined`), `createdAt`, `respondedAt`
- `conversations/{convId}`: `requestId`, `type` (`member_ngo | member_member`), `participantIds` (`[uidA, uidB]`), `participants` (safe display map: `{ [uid]: { label, avatarId, role } }`), `orgId` (nullable), `lastMessage`, `lastMessageAt`, `createdAt`
- `conversations/{convId}/messages/{msgId}`: `senderUid`, `senderLabel`, `body` (text-only), `createdAt`

**Rules:** Strictly `request.auth.uid in resource.data.participantIds` (using real Firebase Auth UIDs), with parent conversation check and `status == 'accepted'` gating chat access. Denied to Guests and Platform Admin.
