import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, browserLocalPersistence, setPersistence } from 'firebase/auth';

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

export { app, db, auth };
