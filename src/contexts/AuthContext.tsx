import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface ProfileExtras {
  fullName?: string;
  company?: string;
  role?: string;
}

interface ProfileUpdate {
  displayName?: string;
  email?: string;
  fullName?: string;
  company?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  demoSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
  getProfileExtras: () => ProfileExtras;
}

// Default context value for demo/fallback mode (if AuthProvider fails to mount)
const defaultAuthContext: AuthContextType = {
  user: null,
  userProfile: null,
  loading: false,
  signIn: async () => { throw new Error('Auth not available'); },
  signUp: async () => { throw new Error('Auth not available'); },
  signInWithGoogle: async () => { throw new Error('Auth not available'); },
  demoSignIn: async () => { console.log('Demo sign-in (no-op)'); },
  signOut: async () => { console.log('Sign-out (no-op)'); },
  resetPassword: async () => { throw new Error('Auth not available'); },
  updateProfile: async () => { throw new Error('Auth not available'); },
  getProfileExtras: () => ({}),
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

const googleProvider = new GoogleAuthProvider();
const PROFILE_EXTRAS_KEY = 'nova_profile_extras';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });
      return unsubscribe;
    } catch (err) {
      console.warn('Firebase auth listener failed — running in demo mode:', err);
      setLoading(false);
      return () => {};
    }
  }, []);

  // Email/password sign in
  const signIn = async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      throw mapFirebaseError(error);
    }
  };

  // Email/password sign up
  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // Set display name if provided
      if (displayName && credential.user) {
        await updateProfile(credential.user, { displayName });
      }
    } catch (error: unknown) {
      throw mapFirebaseError(error);
    }
  };

  // Google sign in
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      throw mapFirebaseError(error);
    }
  };

  // Demo / anonymous sign in
  const demoSignIn = async () => {
    try {
      const credential = await signInAnonymously(auth);
      // Give anonymous users a friendly display name
      if (credential.user) {
        await updateProfile(credential.user, { displayName: 'Demo User' });
      }
    } catch (error: unknown) {
      throw mapFirebaseError(error);
    }
  };

  // Sign out
  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  // Password reset
  const resetPassword = async (email: string) => {
    if (!email) {
      throw new Error('Email is required');
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
      throw mapFirebaseError(error);
    }
  };

  // Update user profile (displayName + extras stored locally)
  const handleUpdateProfile = async (data: ProfileUpdate) => {
    if (!user) throw new Error('Not authenticated');

    // Update Firebase displayName if changed
    if (data.displayName !== undefined) {
      await updateProfile(user, { displayName: data.displayName });
    }

    // Store extras in localStorage keyed by uid
    const extras = getProfileExtras();
    const updated: ProfileExtras = {
      fullName: data.fullName ?? extras.fullName,
      company: data.company ?? extras.company,
      role: data.role ?? extras.role,
    };
    localStorage.setItem(`${PROFILE_EXTRAS_KEY}_${user.uid}`, JSON.stringify(updated));
  };

  // Get extra profile fields from localStorage
  const getProfileExtras = (): ProfileExtras => {
    if (!user) return {};
    try {
      const stored = localStorage.getItem(`${PROFILE_EXTRAS_KEY}_${user.uid}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile: user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        demoSignIn,
        signOut,
        resetPassword,
        updateProfile: handleUpdateProfile,
        getProfileExtras,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Map Firebase error codes to user-friendly messages
function mapFirebaseError(error: unknown): Error {
  const code = (error as { code?: string })?.code || '';
  const errorMap: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/popup-blocked': 'Pop-up was blocked by your browser. Please allow pop-ups and try again.',
  };
  return new Error(errorMap[code] || 'An unexpected error occurred. Please try again.');
}
