import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env variables
dotenv.config({ path: path.join(import.meta.dirname, '.env') });

let app;

const getExistingApp = (name) => {
  const apps = getApps();
  return apps.find(a => a.name === name);
};

// 1. Try to initialize using dedicated environment secret keys (pure environment config)
if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
  try {
    app = getExistingApp('zixovibes-admin') || initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    }, 'zixovibes-admin');
    console.log("[Firebase Admin] Initialized via environment credentials.");
  } catch (err) {
    console.error("[Firebase Admin] Initialization via environment variables failed:", err);
  }
}

// 2. Try to initialize using local service account JSON file
if (!app) {
  const possibleKeyFiles = [
    path.join(import.meta.dirname, 'firebase-service-account.json'),
    path.join(import.meta.dirname, 'zixovibes-firebase-adminsdk-fbsvc-bd618a68eb.json')
  ];

  for (const keyPath of possibleKeyFiles) {
    if (fs.existsSync(keyPath)) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        app = getExistingApp('zixovibes-admin') || initializeApp({
          credential: cert(serviceAccount)
        }, 'zixovibes-admin');
        console.log(`[Firebase Admin] Initialized via local service account: ${path.basename(keyPath)}`);
        break;
      } catch (err) {
        console.error(`[Firebase Admin] Failed to initialize from ${keyPath}:`, err);
      }
    }
  }
}

// 3. Fall back to standard GOOGLE_APPLICATION_CREDENTIALS path
if (!app && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    app = getExistingApp('zixovibes-admin') || initializeApp({}, 'zixovibes-admin');
    console.log("[Firebase Admin] Initialized via Application Default Credentials.");
  } catch (err) {
    console.error("[Firebase Admin] Initialization via Application Default Credentials failed:", err);
  }
}

export const adminDb = app ? getFirestore(app) : null;
