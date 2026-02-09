import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Demo user type (matches Firebase User interface for compatibility)
export interface DemoUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Extended profile for settings (stored with user)
export interface UserProfileUpdate {
  displayName?: string;
  email?: string;
  fullName?: string;
  company?: string;
  role?: string;
}

interface StoredProfileExtras {
  fullName?: string;
  company?: string;
  role?: string;
}

interface AuthContextType {
  user: DemoUser | null;
  userProfile: DemoUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: UserProfileUpdate) => Promise<void>;
  getProfileExtras: () => StoredProfileExtras;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local storage key for persisting demo auth
const AUTH_STORAGE_KEY = 'crewos_demo_auth';
const PROFILE_STORAGE_KEY = 'crewos_demo_profile';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount (or handle #logout)
  useEffect(() => {
    if (window.location.hash === '#logout') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      window.location.hash = '';
      setLoading(false);
      return;
    }
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Create demo user
    const demoUser: DemoUser = {
      uid: `demo_${Date.now()}`,
      email: email,
      displayName: email.split('@')[0],
      photoURL: null
    };

    // Persist to localStorage
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const signUp = async (email: string, password: string) => {
    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!email.includes('@')) {
      throw new Error('Please enter a valid email address');
    }
    
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Create demo user
    const demoUser: DemoUser = {
      uid: `demo_${Date.now()}`,
      email: email,
      displayName: email.split('@')[0],
      photoURL: null
    };

    // Persist to localStorage
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const signOut = async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    setUser(null);
  };

  const updateProfile = async (data: UserProfileUpdate) => {
    if (!user) return;
    const updated: DemoUser = {
      ...user,
      displayName: data.displayName ?? user.displayName,
      email: data.email ?? user.email,
    };
    setUser(updated);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
    const profileExtras = {
      fullName: data.fullName,
      company: data.company,
      role: data.role,
    };
    const existing = localStorage.getItem(PROFILE_STORAGE_KEY);
    const merged = existing ? { ...JSON.parse(existing), ...profileExtras } : profileExtras;
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
  };

  const getProfileExtras = (): StoredProfileExtras => {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile: user, loading, signIn, signUp, signOut, updateProfile, getProfileExtras }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
