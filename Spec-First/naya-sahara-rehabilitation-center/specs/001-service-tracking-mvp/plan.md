# Implementation Plan: Naya Sahara Hackathon MVP

**Date**: 2026-11-27 | **Active Spec**: [spec.md](./spec.md)

> This plan supersedes the earlier Next.js / TypeScript / Cloud Functions / offline-casework draft.

## Summary

Deliver **Naya Sahara (नयाँ सहारा)** as a single **React + Vite + JavaScript** application (`frontend/`) deployed with **Vercel serverless API routes (`frontend/api/`)** and backed by **Firebase Spark (free tier)** services only: **Firebase Authentication** and **Cloud Firestore**.

## Technical Context

- **Frontend:** React 19, Vite 8, JavaScript/JSX, Tailwind CSS config + custom CSS (`styles.css`), `@fontsource/inter`, `@fontsource/noto-sans-devanagari`, `@fontsource/plus-jakarta-sans`, `material-symbols`.
- **Backend API:** Vercel serverless functions in `frontend/api/` using `firebase-admin`, `bcryptjs`, and `dotenv`.
- **Firebase Services (Spark Plan Only):** Firebase Authentication + Cloud Firestore.
- **Explicit Exclusions:** No Next.js, TypeScript, Firebase Blaze, Cloud Functions, Firebase Storage, Cloudinary, PostgreSQL, or Supabase.
- **Local Visual Assets:** Static images and SVG fallback placeholders under `frontend/public/images/`, centralized in `frontend/src/config/images.js` and documented in `IMAGE_ASSETS.md`.
- **Localization & Accessibility:** Nepali (`ne`) default with English (`en`) toggle via `i18n.js`; browser Web Speech API read-aloud with device Nepali voice check and honest fallback; readable typography (`14px+` body/input minimums).
- **Connectivity:** Simple browser `online`/`offline` indicator, clear connectivity error feedback with retry button, and optional local caching of public notices only (no offline sync queue, no conflict-resolution engine, and no cached sensitive member data).

## Architecture Decisions

1. **Staff Authentication:** Platform Admin and NGO Admins sign in via Firebase Auth with server-verified custom claims (`role`: `platform_admin` | `ngo_admin`, `orgId`). No TOTP/MFA requirement for the hackathon MVP.
2. **Woman / Member Authentication:** Women register without email or phone using a 72-hour single-use NGO handover code, unique nickname, password (`bcryptjs` hashed server-side), and illustrated avatar. A Vercel API route verifies credentials and mints a Firebase custom token for `signInWithCustomToken()`.
3. **Authorization Boundary:** `backend/firestore.rules` enforces public vs. role-scoped vs. participant-UID conversation access. Server-only credentials and handover codes are completely denied to client reads/writes (`allow read, write: if false`).
4. **Public-Content AI (Optional / Admin-Gated):** A Vercel API route sends **only** public notice text to the Gemini API (or equivalent free-tier translation provider) to produce a draft translation, summary, and explicitly stated metadata (`deadline`, `eligibility`, `requiredDocuments`). Output remains hidden until Platform Admin reviews and approves it.
5. **Preserve Existing UI Foundation:** Retain `ui.jsx` primitives, font setup, `i18n.js`, Quick Exit, and working page structures; refactor only where required by scope (Landing page, Member auth, Community opt-in directory, merged NGO/Government Notices tabs, and multi-thread UID-based Chats).

## Project Structure

```text
frontend/
  api/                  # Vercel serverless API routes (firebase-admin)
  public/images/        # Local visual assets & SVG fallback placeholders
  src/
    components/         # AppShell, ui.jsx (with AssetImage fallback)
    config/             # images.js centralized asset paths
    context/            # AuthContext (planned)
    firebase/           # config.js (Auth & Firestore only)
    pages/              # Public, Admin, NGO, and Member views
    services/           # Firestore & API client modules
    App.jsx
    data.js
    i18n.js
    styles.css
backend/
  firebase.json
  firestore.rules
  firestore.indexes.json
```
