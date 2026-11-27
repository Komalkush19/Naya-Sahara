# Quickstart: Naya Sahara MVP

**Updated**: 2026-11-27

## Prerequisites

- Node.js 20.19+ and npm.
- Firebase Spark project (`Naya Sahara`) with Authentication & Firestore enabled.
- Local environment files configured in `frontend/.env` (`VITE_FIREBASE_*`) and `frontend/.env.local` (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) — never commit these files.

## Running Locally

From `frontend/`:

1. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
2. Start the frontend Vite dev server (`http://localhost:5173`):
   ```bash
   npm run dev
   ```
3. Or start Vercel local dev to run both frontend and `frontend/api/` serverless routes (`http://localhost:3000`):
   ```bash
   npx vercel dev
   ```
4. Check linting and production bundle:
   ```bash
   npm run lint
   npm run build
   ```

## Local Image Assets

Place final `.jpg` / `.svg` visual assets under `frontend/public/images/` matching the paths documented in [IMAGE_ASSETS.md](../../../IMAGE_ASSETS.md). Until final `.jpg` assets are added, `AssetImage` renders neutral `.svg` placeholders automatically.

## Safety & Demo Reminders

- Use synthetic data only.
- Never enter real personal names, emails/phones for women, legal histories, or medical data.
- Never expose `frontend/.env.local` or service-account JSON credentials.
