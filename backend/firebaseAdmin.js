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

const initializeFromServiceAccountFile = (keyPath, sourceName) => {
  if (!fs.existsSync(keyPath)) {
    return false;
  }

  try {
    const serviceAccount = JSON.parse(
      fs.readFileSync(keyPath, 'utf8')
    );

    app = getExistingApp('zixovibes-admin') || initializeApp({
      credential: cert(serviceAccount)
    }, 'zixovibes-admin');

    console.log(`[Firebase Admin] Initialized via ${sourceName}: ${path.basename(keyPath)}`);
    return true;
  } catch (err) {
    console.error(
      `[Firebase Admin] Failed to initialize from ${keyPath}:`,
      err
    );
    return false;
  }
};

// 1. Render Secret File
const renderSecretPath = '/etc/secrets/firebase-service-account.json';

if (!app) {
  initializeFromServiceAccountFile(
    renderSecretPath,
    'Render secret file'
  );
}

// 2. Local service account JSON
if (!app) {
  const possibleKeyFiles = [
    path.join(import.meta.dirname, 'firebase-service-account.json'),
    path.join(
      import.meta.dirname,
      'zixovibes-firebase-adminsdk-fbsvc-bd618a68eb.json'
    )
  ];

  for (const keyPath of possibleKeyFiles) {
    if (initializeFromServiceAccountFile(keyPath, 'local service account')) {
      break;
    }
  }
}

// 3. Environment credentials
if (
  !app &&
  process.env.FIREBASE_PRIVATE_KEY &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PROJECT_ID
) {
  try {
    const formattedKey = process.env.FIREBASE_PRIVATE_KEY
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');

    app = getExistingApp('zixovibes-admin') || initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      })
    }, 'zixovibes-admin');

    console.log('[Firebase Admin] Initialized via environment credentials.');
  } catch (err) {
    console.error(
      '[Firebase Admin] Initialization via environment variables failed:',
      err
    );
  }
}

// 4. Application Default Credentials
if (!app && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    app = getExistingApp('zixovibes-admin') ||
      initializeApp({}, 'zixovibes-admin');

    console.log(
      '[Firebase Admin] Initialized via Application Default Credentials.'
    );
  } catch (err) {
    console.error(
      '[Firebase Admin] Initialization via Application Default Credentials failed:',
      err
    );
  }
}

export const adminDb = app ? getFirestore(app) : null;