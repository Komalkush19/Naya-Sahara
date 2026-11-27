> [!WARNING]
> **SUPERSEDED HISTORICAL DOCUMENT (2026-11-27):** This file describes an older Firebase Cloud Functions (Blaze), case-management, offline-sync, and PIN-recovery architecture that has been **removed from scope**.
>
> **Active architecture:** Vercel serverless API routes inside `frontend/api/` on the Firebase Spark plan (no Cloud Functions, no Blaze, no Storage, no case management, no PIN recovery, no offline sync). See [spec.md](../spec.md), [plan.md](../plan.md), and [data-model.md](../data-model.md) for current requirements.

# Callable Function Contracts (Historical / Superseded)

These are planned Firebase callable Function interfaces for the MVP. All functions
use validated request/response schemas, explicit authorization, and server-side
transactions for one-time credentials. Raw PINs, codes, public-content source text,
and private messages must not be written to logs.

## Shared Conventions

- Deployed Functions run in `asia-south1`.
- Use Firebase callable SDK authentication context; require the correct role and
  organization claim for authenticated operations.
- Enforce App Check in deployed environments where configured. Emulator tests use
  emulator-compatible settings.
- User-facing errors must not reveal whether another Member account or code exists.
- Never return success-shaped fallback content on model, database, or validation
  failure. Leave content unpublished and return an explicit error.
- Codes are cryptographically random, stored only as keyed hashes, rate-limited, and
  consumed once. PINs are salted and hashed server-side; never store or log raw PINs.
- Idempotent code issuance must return the same active code for the same request key
  without storing its plaintext.

## `issueClaimCode`

**Caller**: Authenticated Org Admin.
**Purpose**: Create the 72-hour handover code shown to the Org Admin for handover.

Request:

```json
{
  "caseId": "string",
  "idempotencyKey": "string"
}
```

Response:

```json
{
  "code": "string",
  "expiresAt": "timestamp"
}
```

Rules:

- The caller's organization must be approved and own the case.
- Consent must be active and the case must be eligible for release handover.
- The release action changes `caseStatus` to `released` and creates the initial
  handover code as one atomic operation.
- Retrying the same `idempotencyKey` returns the same active code and never creates
  or invalidates another code. A distinct request cannot replace a non-expired code.
- For an unclaimed handover, reissue is permitted only after its existing code
  expires; reissue invalidates the old code.
- Create/hash the code and update handover state transactionally. Do not log or
  persist the returned raw code.
- Do not allow a consumed code or claimed handover to be reissued.

## `claimMemberAccount`

**Caller**: Unauthenticated Member during initial account claim.
**Purpose**: Consume a release code, create a nickname/PIN account, and return a
Firebase custom token.

Request:

```json
{
  "code": "string",
  "nickname": "string",
  "pin": "string"
}
```

Response:

```json
{
  "customToken": "string"
}
```

Rules:

- Verify the code hash, expiry, unused state, active consent, and unclaimed handover.
- Require a unique nickname under the normalized nickname index. The index is
  server-only; it must not support public nickname lookup.
- Validate the PIN policy and derive its salted hash on the server.
- Consume the code, create the Member profile and private credential, and link the
  account to the case in an idempotent server-side operation.
- Return the same generic `invalid-claim` failure for malformed, invalid, expired,
  consumed, or otherwise unusable codes. Do not expose a related account or case.
- A nickname collision may return a separate generic `nickname-unavailable` error
  without identifying the existing account.
- The client signs in with the returned token using Firebase
  `signInWithCustomToken`.

## `signInMember`

**Caller**: Unauthenticated Member.
**Purpose**: Authenticate a Member using nickname and PIN without email or phone.

Request:

```json
{
  "nickname": "string",
  "pin": "string"
}
```

Response:

```json
{
  "customToken": "string"
}
```

Rules:

- Normalize the nickname, load credentials only on the server, verify the PIN hash
  using a constant-time comparison, and apply per-account and per-source throttling.
- On success, mint a custom token with server-controlled `role: member` and
  organization claims.
- Return one generic `invalid-credentials` failure for unknown nickname, wrong PIN,
  disabled account, or lockout. Do not disclose which condition occurred.

## `issuePinRecoveryCode`

**Caller**: Authenticated Org Admin.
**Purpose**: Issue a one-time recovery code after the Org Admin has verified the
Member in person.

Request:

```json
{
  "memberUid": "string",
  "idempotencyKey": "string"
}
```

Response:

```json
{
  "code": "string",
  "expiresAt": "timestamp"
}
```

Rules:

- Require an approved organization and verify the Member is linked to a case in that
  organization.
- The Org Admin completes the in-person identity check outside the app; the function
  records the issuing Org Admin and timestamp, not identity evidence.
- Expiry must be no more than 72 hours. Revoke any earlier outstanding recovery code.
- Retrying the same `idempotencyKey` returns the same active recovery code without
  creating another.
- Return the raw code once; store only its keyed hash.

## `resetMemberPin`

**Caller**: Unauthenticated Member holding the in-person recovery code.
**Purpose**: Consume a recovery code, set a new PIN on the same account, and return a
  custom token.

Request:

```json
{
  "recoveryCode": "string",
  "newPin": "string"
}
```

Response:

```json
{
  "customToken": "string"
}
```

Rules:

- Verify the keyed hash, expiry, and unused state; update the existing credential
  without creating another account.
- Consume the recovery code atomically with the PIN change.
- Return the same generic `invalid-recovery-code` failure for invalid, expired, and
  consumed codes. Apply throttling and do not expose account information.

## `draftPublicContent`

**Caller**: Authenticated Platform Admin.
**Purpose**: Generate an unpublished translation and, for a government notice,
proposed location, eligibility, and deadline extraction.

Request:

```json
{
  "contentType": "government_notice | opportunity",
  "contentId": "string",
  "targetLanguage": "ne | en"
}
```

Response:

```json
{
  "draftId": "string",
  "reviewStatus": "needs_review"
}
```

Rules:

- Load the source from the named public-content collection; do not accept arbitrary
  text in the callable request. Confirm the source is public, non-personal content
  before calling the model. In the hackathon, use synthetic content only.
- The model input contains only the original public content and requested language.
  Never read or send case records, Member profiles, consent, credentials, or messages.
- Validate model output against a JSON Schema. For notices, missing location,
  eligibility, or deadline remains unavailable; do not invent values.
- Save the output as a review draft. A model failure or schema failure leaves the
  source unpublished or unchanged and returns an explicit error.
- Do not log model input/output or expose the API key to the browser.

## `approvePublicContentDraft`

**Caller**: Authenticated Platform Admin.
**Purpose**: Publish a reviewed translation or notice.

Request:

```json
{
  "contentType": "government_notice | opportunity",
  "contentId": "string",
  "draftId": "string",
  "approvedFields": {
    "translation": "string"
  }
}
```

Response:

```json
{
  "status": "published"
}
```

Rules:

- Require Platform Admin role and a current review draft for the named content.
- For government notices, `approvedFields` may also include corrected `location`,
  `eligibility`, and `deadline` values or `null` when unavailable. These fields are
  not accepted for opportunities.
- Persist approved/corrected fields with the original content and the exact label
  `AI translated`. Do not publish omitted or unapproved generated fields.
- Record reviewer UID and server timestamp. The public query returns only approved
  content; Members and Guests never receive draft output.

## Offline Update Proposal (Firestore contract)

Offline case edits are not callable requests because a callable cannot be invoked
without a network connection. The client creates an immutable document at
`cases/{caseId}/updateProposals/{proposalId}` using a stable client-generated ID.

- Firestore Rules allow create-only proposals from the authorized Org Admin in the
  case's organization, with active consent and only `field: "nextHearingAt"` plus a
  validated hearing-date timestamp as `proposedValue`. Other case fields and case
  creation are online-only in this MVP.
- A second-generation Firestore trigger validates consent and the base revision,
  then applies the proposal transactionally or marks it `conflict`/`rejected`.
- Trigger retries must be idempotent. One proposal ID can result in at most one case
  log entry.
- The UI displays “Pending sync” while the write is local or the proposal is queued;
  it displays “Synced” only after the server sets `applied`.
- If consent was revoked before the proposal reaches the server, do not apply it;
  preserve the proposal for the reviewed removal process without making case data
  available for ordinary use.

## Message Requests and Conversations (Firestore contract)

- A Member creates a request only for a public, approved NGO. The request document
  stores the Member UID, NGO ID, fixed request state, disclosure version, and
  acknowledgement timestamp; it does not store the Member's email or phone.
- Rules require the acknowledgement and bind the request to `request.auth.uid`.
  The disclosure names the NGO recipient and explains what request data is stored.
- A conversation becomes writable only after the Org Admin accepts the request.
  Before a Member's first message, require a second acknowledgement that message
  text is stored and visible to that NGO. Rules require that acknowledgement before
  accepting the message document.
- Messages are text-only, never sent to AI, and cannot be attached to a case record.
  Block state denies further requests/messages. Reports store fixed reason codes and
  minimal identifiers only.
