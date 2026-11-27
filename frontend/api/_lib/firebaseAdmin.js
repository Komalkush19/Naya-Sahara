
/* global process */

import dotenv from "dotenv";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Explicitly load local backend credentials
dotenv.config({ path: ".env.local" });

const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

// Verify credentials
const missingVariables = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
].filter((key) => !process.env[key]);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingVariables.join(", ")}`
  );
}

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
