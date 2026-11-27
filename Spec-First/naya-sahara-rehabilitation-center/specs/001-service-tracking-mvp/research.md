> [!WARNING]
> **SUPERSEDED HISTORICAL DOCUMENT (2026-11-27):** This research log reflects an earlier Next.js + TypeScript + Cloud Functions + TOTP MFA + IndexedDB offline-sync plan that has been **superseded**. See [spec.md](./spec.md) and [plan.md](./plan.md) for the active React + Vite + JS + Vercel API + Firebase Spark architecture.

# Research: Naya Sahara Service-Tracking MVP (Historical / Superseded)

**Date**: 2026-11-26
**Scope**: Resolve implementation choices for the synthetic-data hackathon MVP. This
research does not establish legal compliance or approve a real-world pilot.

## Decisions

### Hosting and application structure

- Use Next.js App Router on Vercel, with Firebase Web SDK access from the browser.
- Keep private case data out of Next.js server rendering, Vercel logs, and deployment
  preview content. Firebase Rules and callable Functions are the authorization and
  trusted-operation boundary.
- Use one application and one TypeScript Cloud Functions codebase. Firebase's
  framework-aware Next.js hosting path is not required for this plan.

**Alternatives considered**: Firebase Hosting with framework integration; a separate
custom backend. Neither is needed for the demo, and a second application backend would
add operational complexity.

### Firebase region and service locations

- Use `asia-south1` (Mumbai) for Firestore and second-generation Cloud Functions, and
  select the Storage bucket in the same region.
- Verify each service's location and project billing before provisioning: Firestore
  and Storage bucket locations cannot be changed after creation, and Cloud Functions
  region affects latency and pricing.
- Firebase Authentication with Identity Platform and second-generation Functions
  must be available and funded before staff TOTP MFA or callable functions are enabled.

**Alternatives considered**: A multi-region Firestore database or a region outside
South Asia. The requested single-region design is simpler; no production availability
objective has been set.

### Authentication and one-time credentials

- Staff accounts (Platform Admin and Org Admin) use verified email/password and TOTP
  MFA through Firebase Authentication with Identity Platform. If the project cannot
  provide this, staff access to case data is blocked rather than shipped without MFA.
- Member nickname/PIN sign-in is handled by a callable Function that verifies a
  server-only salted PIN hash and returns a Firebase custom token. Member accounts
  have no email or phone. Apply rate limits and generic failures to sign-in, claim,
  and recovery attempts; never log raw PINs or codes.
- Claim and recovery codes are single-use, time-limited, stored only as keyed hashes,
  consumed transactionally, and never returned after their initial handover.
- Firebase custom-auth users are not eligible for Firebase's TOTP MFA flow. This is
  intentional for the PIN-based Member journey; staff accounts use TOTP and Member
  PIN recovery remains an in-person Org Admin process.

**Alternatives considered**: Email/phone recovery for Members and SMS MFA for staff.
Both conflict with the specified low-contact Member account flow or are unnecessary
for the selected staff TOTP factor.

### Offline case logging and local data

- Use Firestore web `persistentLocalCache` for the synthetic offline demo, with a
  trusted-device confirmation and Org Admin-only casework access.
- Limit offline edits to `nextHearingAt`; keep case creation and edits to other fields
  online-only for this MVP. Use stable client-generated update IDs, immutable
  proposals, a base revision, and server-side idempotent application. Preserve both
  hearing-date values on conflict and require Org Admin resolution; do not rely on
  Firestore's default same-document last-write-wins behavior.
- “Pending sync” covers both a local pending write and a server proposal awaiting
  processing. Show “Synced” only after the server marks the update applied.
- **Real-data gate**: Firestore's web cache persists across sessions. Its clearing API
  must run before the Firestore instance starts and is not secure erasure. Therefore
  no real member or case data may be cached or used offline until privacy, security,
  and legal review approves the device, encryption, consent-revocation, and removal
  policy. Clearing cache is session hygiene, not a deletion guarantee.
- Use in-memory Firestore cache for any non-offline browser journey where persistence
  is not explicitly needed.

**Alternatives considered**: Directly updating a case document offline, which can
silently overwrite concurrent edits; third-party conflict libraries, which are outside
the MVP scope.

### Authorization and testing

- Put trusted `role` and `orgId` claims on authenticated staff and Member accounts.
  Firestore and Storage Rules enforce role, organization, consent, and member ownership.
- Keep PIN hashes, raw recovery material, and server secrets in server-only paths.
  Platform Admins and Guests cannot read case data; rostered Caseworkers have no
  individual accounts in this MVP.
- Use Firebase Emulator Suite and `@firebase/rules-unit-testing` for role, consent,
  ownership, Storage, and denial tests. Use Playwright for browser flows and a real
  offline/reconnect scenario.

**Alternatives considered**: Relying on UI route checks for authorization. UI checks
are useful for navigation but cannot replace Rules.

### Public-content AI

- Use a server-side Gemini API call with JSON Schema structured output for proposed
  translation and extraction of location, eligibility, and deadline.
- The callable accepts only an identified public notice or opportunity. It never
  accepts case fields, private messages, or member data. Keep the API key server-side
  and do not log source text.
- Store AI output as an unpublished draft. Only a Platform Admin may approve or
  correct it; the original remains visible beside the translation labelled exactly
  “AI translated”.
- Use a mock AI provider in automated tests. Real-provider demos, if enabled, use
  synthetic public text only.

**Alternatives considered**: Client-side model calls, unstructured text responses,
automatic publication, and web scraping. These weaken key handling, validation, the
human review gate, or the defined scope.

### Localization and read-aloud

- Use `next-intl` with Nepali (`ne`) as the default locale, English (`en`) as the
  alternate locale, and Noto Sans Devanagari.
- Use browser/device on-device speech only for private Member text. If a local voice
  is unavailable, retain accessible text and clearly report that read-aloud is
  unavailable; do not send private text to an external speech or AI service.
- Public content may use cached pre-generated Nepali audio. Keep language controls
  explicit and ensure the original public content remains accessible.

## Verification Notes

- Firestore web offline persistence is opt-in, supported in Chrome, Safari, and
  Firefox, persists cache across sessions, and resolves multiple writes to the same
  document with last-write-wins by default.
- Firebase TOTP MFA requires Firebase Authentication with Identity Platform and
  verified staff email. Custom-auth tokens are excluded from Firebase's MFA providers.
- Firebase callable Functions include available Auth and App Check tokens and validate
  authentication tokens before invoking the handler.
- Firestore and Storage locations are provisioning decisions; Cloud Functions
  `asia-south1` supports second-generation functions.
- Gemini supports JSON Schema structured output.
- Firebase Rules tests can run against the Local Emulator Suite with
  `@firebase/rules-unit-testing`.

## Official References

- [Cloud Firestore offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firestore JavaScript API: `clearIndexedDbPersistence`](https://firebase.google.com/docs/reference/js/firestore_.md#clearindexeddbpersistence_205cf72)
- [Firebase Authentication: TOTP MFA for web](https://firebase.google.com/docs/auth/web/totp-mfa)
- [Firebase Authentication: custom authentication](https://firebase.google.com/docs/auth/web/custom-auth)
- [Cloud Functions callable functions](https://firebase.google.com/docs/functions/callable)
- [Cloud Functions locations](https://firebase.google.com/docs/functions/locations)
- [Cloud Firestore locations](https://firebase.google.com/docs/firestore/locations)
- [Cloud Storage for Firebase locations](https://firebase.google.com/docs/storage/locations)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Firebase Security Rules unit tests](https://firebase.google.com/docs/rules/unit-tests)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
