# Feature Specification: Naya Sahara Hackathon MVP (Source of Truth)

**Branch**: `main` | **Updated**: 2026-11-27 | **Status**: Active Authoritative Specification

> This specification reflects the confirmed project scope and overrides earlier drafts referencing Next.js, TypeScript, Firebase Cloud Functions, Firebase Storage, case management, hearing-date offline sync, PIN recovery, community feeds/groups, NGO-to-NGO chat, or a separate Opportunities page.

---

## 1. Product Overview

Naya Sahara (नयाँ सहारा) is a single cohesive web platform (React + Vite + JavaScript, Vercel API routes, Firebase Spark Auth + Firestore) with four interfaces:

1. **Public / Guest Interface**
2. **Platform Admin Dashboard**
3. **NGO Dashboard**
4. **Woman / Member Dashboard**

All development and demonstration records are synthetic.

---

## 2. User Roles & Interface Requirements

### 2.1 Public / Guest Interface
- **Landing Page:** Navigation bar, Naya Sahara branding/logo, About Us, Notices preview, Organizations preview, Funders section, Donate button, Login and Register buttons, Footer with contact details, and Guest mode entry.
- **Guest Capabilities (no account required):** Browse verified NGOs and open NGO profiles (logo, name, short description, main area of work, contact number, location, verification status); browse published Government and NGO notices; filter notices and NGOs by location and category.
- **Guest Restrictions:** Cannot send messages, view community profiles, create a member profile, or access private Admin/NGO/Member dashboards (enforced by Auth & Firestore Rules, not just UI).

### 2.2 Platform Admin Dashboard
- **Overview:** Dynamic counts for total NGOs, verified NGOs, pending verifications, total registered women, active members, published notices, and archived notices.
- **NGO Management:** View all NGOs, inspect details (including associated caseworker/member counts), verify or reject NGO registrations, update NGO info where appropriate, archive or delete NGOs.
- **Active Users Overview:** View basic non-sensitive membership metadata only (nickname, illustrated avatar, registration date, verifying NGO, account status). Never expose credentials, conversations, or sensitive personal data.
- **Notice Management (Government & NGO):** Create, read, update, delete, archive, restore, publish, and unpublish notices. For Government notices, manually submit official public text/source URL and optionally request AI-assisted translation/summarization/extraction; review, edit, approve, or reject AI output before publication.

### 2.3 NGO Dashboard
- **Overview:** Verification status, NGO profile summary, total caseworkers, synthetic active-case demonstration metric (no actual case-management workflows), registered women count, published notices count, recent activity.
- **NGO Profile:** View and update own logo, name, description, main area of work, contact number, email, address, district/location (cannot self-verify).
- **Caseworker Directory:** Display caseworker cards/list (name, portrait, designation, professional info, joining date, synthetic active case count, current status) with expanded modal/card view. No individual caseworker login accounts.
- **Associated Women & Handover Codes:** View women associated with the NGO using pseudonymous details only (nickname, illustrated avatar, joined date, verification status, verifying NGO). Generate single-use 72-hour handover codes (stored hashed server-side).
- **NGO Notices:** Create, edit, publish, archive, and delete own NGO notices across categories: Jobs, Training, Financial aid, Workshops, Education, Rehabilitation, and Other support services. Each supports title, description, category, location, requirements, optional deadline, contact info, org ID, publication date, and status.

### 2.4 Woman / Member Dashboard
- **Primary Navigation:** `Home / My Profile`, `Your Community`, `Find NGOs`, `Chats`, `Notices`.
- **Onboarding & Auth (No Email / Phone):** Enter NGO-issued 72-hour single-use handover code, choose a unique nickname, create a password, and select an illustrated avatar. Log in with nickname + password via Vercel backend validation (`bcryptjs`) and Firebase `signInWithCustomToken()`.
- **My Profile:** View/manage nickname, illustrated avatar, joining date, verifying NGO, general location, and community opt-in/privacy preferences.
- **Your Community (Opt-In Directory Only):** Browse women who opted into the directory. Cards show only nickname, illustrated avatar, approximate location (district/municipality), and optional interests/skills. Initiate a 1:1 message request. No groups, no public wall/feed.
- **Find NGOs:** Browse verified NGOs, view profiles/services/notices, and initiate a message request.
- **Chats (Text-Only, Request-Gated):** Supports **Woman ↔ NGO** and **Woman ↔ Woman** only. Recipient must accept the message request before the conversation opens. Uses Firebase Auth participant UIDs (never an `orgId` as a user UID). Real-time text messages with timestamps, loading/empty states, and no attachments, calls, or AI inspection.
- **Notices (Two Tabs):** Single Notices section with **NGO Notices** and **Government Notices** tabs, both filterable by location, category, keywords, and deadline (where applicable). Opening a notice displays original text separately from clearly labelled AI translations/summaries.
- **Safety & Accessibility:** Persistent Quick Exit button, discreet `"My Support"` branding, Nepali-first (`ne`) with `en` toggle, and browser-native Read-Aloud with honest device voice fallback.

---

## 3. Functional Requirements Summary

- **FR-001 (Stack):** React + Vite + JS frontend, Vercel `/api/` backend, Firebase Spark (Auth + Firestore only).
- **FR-002 (Auth & Roles):** Staff use Firebase Auth with server-verified `platform_admin` / `ngo_admin` custom claims; women use custom-token auth backed by hashed passwords and 72h single-use hashed handover codes.
- **FR-003 (Privacy):** Zero real names, real photos, emails/phones for women, incarceration histories, court records, or medical records stored anywhere.
- **FR-004 (Community & Messaging):** Opt-in pseudonymous directory only; request-before-chat for Woman ↔ NGO and Woman ↔ Woman; participant UID authorization in Firestore Rules.
- **FR-005 (Merged Notices & AI Gate):** No separate Opportunities page; NGO opportunities are categories in NGO Notices. AI runs only on public notice text via Admin action, never invents eligibility/deadlines/documents, and stays unpublished until Platform Admin approval.
- **FR-006 (Minimal Connectivity):** Online/offline indicator, connectivity error feedback with retry, and optional public-notice caching only. No offline sync queue or cached sensitive data.
- **FR-007 (Local Assets):** All visual assets stored locally under `frontend/public/images/` with SVG fallback placeholders (see `IMAGE_ASSETS.md`).
