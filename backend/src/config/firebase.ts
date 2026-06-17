import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.js';

const defaultServiceAccountPath = resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccountPath =
  env.FIREBASE_SERVICE_ACCOUNT_PATH || defaultServiceAccountPath;
const hasServiceAccountFile = existsSync(serviceAccountPath);
const hasGoogleApplicationCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

if (!getApps().length) {
  if (hasServiceAccountFile) {
    initializeApp({
      credential: cert(serviceAccountPath),
    });
  } else if (env.ALLOW_UNVERIFIED_AUTH || hasGoogleApplicationCredentials || env.NODE_ENV === 'production') {
    initializeApp();
  } else {
    throw new Error(
      [
        'Missing Firebase Admin service account for Blink backend.',
        `Expected file: ${serviceAccountPath}`,
        'Download it from the same Firebase project used by android/app/google-services.json.',
        'For this app, android/app/google-services.json uses project_id "buzzchat-7d99a".',
        'Save the Admin SDK JSON as backend/serviceAccountKey.json, then restart the backend.',
      ].join(' '),
    );
  }
}

export const firebaseAuth = getAuth();

export async function verifyFirebaseToken(token?: string) {
  if (!token) {
    throw new Error('Missing Firebase ID token');
  }

  if (env.ALLOW_UNVERIFIED_AUTH) {
    return {
      uid: token,
      email: undefined,
      name: 'Local User',
      picture: undefined,
    };
  }

  return firebaseAuth.verifyIdToken(token);
}
