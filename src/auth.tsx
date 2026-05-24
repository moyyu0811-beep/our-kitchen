import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthContextType = {
  firebaseUser: FirebaseUser | null;
  householdId: string | null;
  authLoading: boolean;
  signUp: (email: string, password: string, householdId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<string>; // returns householdId
  signOut: () => Promise<void>;
};

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // Load householdId from Firestore user doc
        const userDoc = await getDoc(doc(db, 'auth_users', user.uid));
        if (userDoc.exists()) {
          setHouseholdId(userDoc.data().householdId as string);
        } else {
          // Shouldn't happen, but fallback
          setHouseholdId(null);
        }
      } else {
        setHouseholdId(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const signUp = async (email: string, password: string, hid: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'auth_users', cred.user.uid), {
      email,
      householdId: hid,
      createdAt: Date.now(),
    });
    setHouseholdId(hid);
  };

  const signIn = async (email: string, password: string): Promise<string> => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'auth_users', cred.user.uid));
    const hid = userDoc.exists() ? (userDoc.data().householdId as string) : '';
    setHouseholdId(hid);
    return hid;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setHouseholdId(null);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, householdId, authLoading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ── Household ID generator ────────────────────────────────────────────────────

export const generateHouseholdId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

// ── Check if household exists ─────────────────────────────────────────────────

export const householdExists = async (hid: string): Promise<boolean> => {
  const snap = await getDoc(doc(db, 'households', hid));
  return snap.exists();
};

export const createHousehold = async (hid: string) => {
  await setDoc(doc(db, 'households', hid), { createdAt: Date.now() });
};
