import { initializeApp, deleteApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-coldrun',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
export const isConfigured = !!import.meta.env.VITE_FIREBASE_PROJECT_ID || useEmulators;

export const app = initializeApp(config);
export const auth = getAuth(app);

// Persistent IndexedDB cache: the app keeps working offline and only downloads changes.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: 80 * 1024 * 1024 }),
});

if (useEmulators) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

/**
 * Creates an Auth account for another person without signing the admin out.
 * Spark (free) plan has no Cloud Functions / Admin SDK, so a throw-away secondary app is used.
 */
export async function createAuthAccount(email: string, password: string): Promise<string> {
  const secondary = initializeApp(config, 'secondary-' + Date.now());
  try {
    const a = initializeAuth(secondary, { persistence: inMemoryPersistence });
    if (useEmulators) connectAuthEmulator(a, `http://${location.hostname}:9099`, { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(a, email, password);
    await signOut(a);
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}
