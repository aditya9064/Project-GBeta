import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, browserLocalPersistence, setPersistence, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDb50N-Tdn7gVpgQCIflOd5HfAI9mogmxQ",
  authDomain: "gbeta-a7ea6.firebaseapp.com",
  projectId: "gbeta-a7ea6",
  storageBucket: "gbeta-a7ea6.firebasestorage.app",
  messagingSenderId: "1077289487136",
  appId: "1:1077289487136:web:fc56fec1128dd8bfbd6545",
  measurementId: "G-N7FR8JGSMC"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

// Set persistence to local (survives browser restarts)
setPersistence(auth, browserLocalPersistence);

// Resolves once Firebase has determined the initial auth state.
// Subsequent calls return immediately.
const _authReady: Promise<void> = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, () => {
    unsub();
    resolve();
  });
});

/**
 * Returns headers with the current user's Firebase ID token.
 * Waits for Firebase Auth to finish restoring the session before
 * checking for a token, so early API calls don't race the auth state.
 * Safe to call when no user is signed in — returns plain Content-Type headers.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    await _authReady;
    const token = await auth.currentUser?.getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* no-op — user not signed in */ }
  return headers;
}

export { app, db, auth };
