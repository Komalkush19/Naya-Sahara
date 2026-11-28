# Naya Sahara (नयाँ सहारा)

### A privacy-first digital platform connecting NGOs, support opportunities, and women transitioning through and after incarceration in Nepal.

Naya Sahara helps bridge fragmented rehabilitation, training, legal-aid, and employment support in Nepal. It enables verified NGOs to publish public support notices and connect with women, while allowing women to use pseudonymous nickname-and-avatar identities, read translated and simplified government and NGO notices, and communicate safely without exposing their real names, email addresses, or phone numbers.

> **Disclaimer:** Naya Sahara is an information, opportunity-discovery, and safe-communication platform—not a legal or court-records system. It provides general support information, not legal advice.

---

## Core Architecture (Confirmed Stack)

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 19, Vite, JavaScript/JSX | Single-page application in `frontend/` |
| **Styling & Typography** | CSS, Tailwind CSS config, Inter, Noto Sans Devanagari, Plus Jakarta Sans, Material Symbols | Nepali (`ne`) default with English (`en`) toggle |
| **Backend API** | Vercel Serverless Functions (`frontend/api/`) | Node.js routes using `firebase-admin` and `bcryptjs` |
| **Database & Auth** | Firebase Spark (free tier): Cloud Firestore + Firebase Authentication | Custom-token auth for women; Firebase Auth with server-verified roles for staff |
| **Static Visual Assets** | Local files in `frontend/public/images/` | No Firebase Storage, no Cloudinary, no external stock image URLs |
| **Read-Aloud** | Browser Web Speech API (`window.speechSynthesis`) | On-device playback with device-capability fallback |
| **Linting** | ESLint | `npm run lint` inside `frontend/` |

**Explicitly excluded from this stack:** Next.js, TypeScript, Firebase Blaze plan, Firebase Cloud Functions, Firebase Storage, Cloudinary, PostgreSQL, and Supabase.

---

## The Four Application Interfaces

| Interface | Access & Auth | Core Responsibilities |
|---|---|---|
| **1. Public / Guest** | No account required | Landing page, browse verified NGO profiles & contact details, browse published NGO & Government notices with location/category filters. No access to member profiles, chats, or private dashboards. |
| **2. Platform Admin** | Firebase Auth + server-verified `platform_admin` claim | Platform overview metrics; verify, reject, edit, or archive NGOs; view basic non-sensitive member metadata (nickname, avatar, registration date, verifying NGO, status); create, edit, publish, unpublish, archive, and restore Government & NGO notices; review/approve/reject optional AI translations and summaries before publication. |
| **3. NGO Dashboard** | Firebase Auth + server-verified `ngo_admin` claim | Manage own NGO public profile (logo, description, work area, contact info, location); manage caseworker directory (profiles only, no individual logins); view associated women by pseudonymous nickname/avatar/joining date/verification status; issue one-time 72-hour handover codes; create, edit, publish, and archive own NGO notices. |
| **4. Woman / Member Dashboard** | Handover code + unique nickname + password + illustrated avatar (`signInWithCustomToken`) | Personal pseudonymous profile; **Your Community** (opt-in pseudonymous member directory with district/municipality and optional skills/interests); **Find NGOs**; **Chats** (text-only 1:1 Woman ↔ NGO and Woman ↔ Woman after request acceptance); **Notices** (two tabs: **NGO Notices** and **Government Notices** with filters, translation view, and read-aloud); Quick Exit & discreet `"My Support"` mode. |

---

## MVP Scope Highlights & Privacy Boundaries

- **No email or phone required for women:** Women register via an NGO-issued one-time 72-hour handover code, choose a unique nickname, password, and illustrated avatar, and sign in via backend custom-token verification.
- **No sensitive case/medical/legal records:** The MVP does not store incarceration histories, court files, offence details, medical diagnoses, children's names, or guardian details.
- **Merged Notices (no separate Opportunities page):** Jobs, training, financial aid, workshops, education, and rehabilitation programs are categories inside **NGO Notices**.
- **Opt-in Community Directory (no public wall/groups):** **Your Community** displays only opted-in pseudonymous profiles and lets women send 1:1 message requests.
- **Request-gated text-only chat:** Recipients must accept a message request before a conversation opens; authorization relies on Firebase Auth participant UIDs.
- **Human-gated public-content AI:** AI translation/simplification/extraction runs only on public notice text and requires Platform Admin approval before publication. Never send private member data or chat messages to AI.
- **Minimal connectivity support:** Displays a simple online/offline indicator, clear connectivity error feedback with retry, and optional caching of public notices only. No offline case-sync engine or persistent caching of sensitive member data.

---

## Repository Structure

```text
frontend/
  api/                    # Vercel serverless API routes (firebase-admin)
  public/
    favicon.svg
    images/               # Local visual assets & SVG placeholders (see IMAGE_ASSETS.md)
  src/
    components/           # AppShell, reusable UI primitives & AssetImage fallback
    config/               # Centralized image asset manifest (images.js)
    firebase/             # Firebase modular web SDK initialization
    pages/                # Role and feature views
    services/             # Firestore / API service layer
    App.jsx
    data.js               # Synthetic demo seed data
    i18n.js               # Nepali / English helper
    styles.css
  package.json
backend/
  firebase.json
  firestore.rules         # Default-deny until reviewed & deployed
  firestore.indexes.json
Spec-First/               # Product specifications & architecture plans (see spec.md)
IMAGE_ASSETS.md           # Complete local image asset manifest & alt-text spec
```

---

## Getting Started

**Prerequisites:** Node.js 20.19+ and npm.

From `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

- Local Vite dev server: `http://localhost:5173`
- Local Vercel dev server (for API routes in `frontend/api/`): `npx vercel dev` (`http://localhost:3000`)
- Lint & production build:
  ```bash
  npm run lint
  npm run build
  ```

### Security Reminders

- Never commit `.env`, `.env.local`, or `*-firebase-adminsdk-*.json` credentials.
- Never import `firebase-admin` or `bcryptjs` into browser-facing files under `frontend/src/`.
- Always use synthetic demo data during hackathon development and testing.

---

## Team

Developed by:
- **Aarya Dhungana**
- **Komal Kushwaha**
- **Samjhana Senchu**

---

<p align="center">
  <em>Continuity of support. Dignity beyond incarceration. A path toward a new beginning.</em>
  <br/>
  Built under the Women Leaders in Technology (WLiT) Fellowship 2026/27.
</p>
