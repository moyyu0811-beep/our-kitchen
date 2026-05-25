import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthContextType = {
  firebaseUser: FirebaseUser | null;
  households: string[];
  activeHouseholdId: string | null;
  authLoading: boolean;
  signUp: (email: string, password: string, householdId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<string>; // returns activeHouseholdId
  signOut: () => Promise<void>;
  switchHousehold: (hid: string) => Promise<void>;
  joinHousehold: (hid: string) => Promise<void>;
  createHousehold: (hid: string) => Promise<void>;
  leaveHousehold: (hid: string) => Promise<void>;
};

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [households, setHouseholds] = useState<string[]>([]);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const userRef = doc(db, 'auth_users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          let userHouseholds = data.households || [];
          let userActive = data.activeHouseholdId || null;

          // Seamless migration for old 1-to-1 users
          if (!data.households && data.householdId) {
            userHouseholds = [data.householdId];
            userActive = data.householdId;
            await updateDoc(userRef, {
              households: userHouseholds,
              activeHouseholdId: userActive,
            });
          }

          setHouseholds(userHouseholds);
          setActiveHouseholdId(userActive);
        } else {
          setHouseholds([]);
          setActiveHouseholdId(null);
        }
      } else {
        setHouseholds([]);
        setActiveHouseholdId(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const signUp = async (email: string, password: string, hid: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'auth_users', cred.user.uid), {
      email,
      households: [hid],
      activeHouseholdId: hid,
      createdAt: Date.now(),
    });
    setHouseholds([hid]);
    setActiveHouseholdId(hid);
  };

  const signIn = async (email: string, password: string): Promise<string> => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'auth_users', cred.user.uid));
    const data = userDoc.exists() ? userDoc.data() : null;
    const active = data?.activeHouseholdId || data?.householdId || '';
    const hids = data?.households || (active ? [active] : []);
    setHouseholds(hids);
    setActiveHouseholdId(active);
    return active;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setHouseholds([]);
    setActiveHouseholdId(null);
  };

  const switchHousehold = async (hid: string) => {
    if (!firebaseUser || !households.includes(hid)) return;
    await updateDoc(doc(db, 'auth_users', firebaseUser.uid), { activeHouseholdId: hid });
    setActiveHouseholdId(hid);
  };

  const joinHousehold = async (hid: string) => {
    if (!firebaseUser) return;
    if (households.length >= 3) throw new Error('You can only join up to 3 households.');
    if (households.includes(hid)) throw new Error('You are already in this household.');
    
    const exists = await householdExistsDb(hid);
    if (!exists) throw new Error('Household code not found.');

    await updateDoc(doc(db, 'auth_users', firebaseUser.uid), {
      households: arrayUnion(hid),
      activeHouseholdId: hid,
    });
    setHouseholds([...households, hid]);
    setActiveHouseholdId(hid);
  };

  const createHousehold = async (hid: string) => {
    if (!firebaseUser) return;
    if (households.length >= 3) throw new Error('You can only create up to 3 households.');
    
    await createHouseholdDb(hid);
    await updateDoc(doc(db, 'auth_users', firebaseUser.uid), {
      households: arrayUnion(hid),
      activeHouseholdId: hid,
    });
    setHouseholds([...households, hid]);
    setActiveHouseholdId(hid);
  };

  const leaveHousehold = async (hid: string) => {
    if (!firebaseUser) return;

    // Check if user is the absolute last member of this household
    const usersSnap = await getDocs(query(collection(db, 'auth_users'), where('households', 'array-contains', hid)));
    const isLastMember = usersSnap.size <= 1;

    // If last member, delete all household data
    if (isLastMember) {
      await deleteHouseholdData(hid);
      await deleteDoc(doc(db, 'households', hid));
    }

    const newHouseholds = households.filter(h => h !== hid);
    
    // If leaving last and ONLY household -> Delete user account entirely
    if (newHouseholds.length === 0) {
      await deleteDoc(doc(db, 'auth_users', firebaseUser.uid));
      await firebaseUser.delete();
      setFirebaseUser(null);
      setHouseholds([]);
      setActiveHouseholdId(null);
      return;
    }

    const newActive = newHouseholds[0];

    await updateDoc(doc(db, 'auth_users', firebaseUser.uid), {
      households: arrayRemove(hid),
      activeHouseholdId: newActive,
    });

    setHouseholds(newHouseholds);
    setActiveHouseholdId(newActive);
  };

  return (
    <AuthContext.Provider value={{
      firebaseUser, households, activeHouseholdId, authLoading,
      signUp, signIn, signOut, switchHousehold, joinHousehold, createHousehold, leaveHousehold
    }}>
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

// ── DB Helpers ────────────────────────────────────────────────────────────────

export const householdExistsDb = async (hid: string): Promise<boolean> => {
  const snap = await getDoc(doc(db, 'households', hid));
  return snap.exists();
};

export const createHouseholdDb = async (hid: string) => {
  await setDoc(doc(db, 'households', hid), { createdAt: Date.now() });
};

const deleteHouseholdData = async (hid: string) => {
  const collections = ['menu', 'grocery_list', 'inventory', 'purchase_history', 'calendar', 'users'];
  const batch = writeBatch(db);
  let count = 0;

  for (const coll of collections) {
    const snap = await getDocs(query(collection(db, coll), where('householdId', '==', hid)));
    snap.docs.forEach(d => {
      batch.delete(d.ref);
      count++;
    });
  }

  if (count > 0) {
    await batch.commit();
  }
};
