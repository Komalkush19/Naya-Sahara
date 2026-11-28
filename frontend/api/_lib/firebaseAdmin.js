/* global process */

import dotenv from "dotenv";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// In local development, load .env.local if variables are not already present in process.env
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
  try {
    dotenv.config({ path: ".env.local" });
  } catch {
    // In production or containerized environments, process.env is pre-populated
  }
}

// Format private key handling outer quotes and escaped newlines safely
const formatPrivateKey = (key) => {
  if (!key) return undefined;
  let cleaned = key.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.replace(/\\n/g, "\n");
};

// Verify credentials
const getServiceAccount = () => {
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

  return {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  };
};

let _adminApp = null;
let _adminAuth = null;
let _adminDb = null;

export const getAdminApp = () => {
  if (_adminApp) return _adminApp;
  if (getApps().length > 0) {
    _adminApp = getApps()[0];
    return _adminApp;
  }
  const serviceAccount = getServiceAccount();
  _adminApp = initializeApp({
    credential: cert(serviceAccount),
  });
  return _adminApp;
};

export const getAdminAuth = () => {
  if (!_adminAuth) {
    _adminAuth = getAuth(getAdminApp());
  }
  return _adminAuth;
};

export const getAdminDb = () => {
  if (!_adminDb) {
    _adminDb = getFirestore(getAdminApp());
  }
  return _adminDb;
};

export const adminAuth = new Proxy({}, {
  get: (_target, prop) => {
    const auth = getAdminAuth();
    const val = auth[prop];
    return typeof val === 'function' ? val.bind(auth) : val;
  }
});

export const adminDb = new Proxy({}, {
  get: (_target, prop) => {
    const db = getAdminDb();
    const val = db[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  }
});
