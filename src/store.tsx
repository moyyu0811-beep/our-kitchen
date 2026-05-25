import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { startOfWeek, format, subWeeks, subDays } from 'date-fns';
import { db } from './firebase';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, getDocs, writeBatch,
} from 'firebase/firestore';

// ── Types ─────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  name: string;
  color: string;
  householdId?: string;
};

export type MenuItem = {
  id: string;
  name: string;
  category: 'signature' | 'wishlist' | 'history';
  createdAt?: number;
  householdId?: string;
};

export type MealBooking = {
  assigneeId: string | 'dine-out' | null;
  coAssigneeId?: string | null;
  recipeIds?: string[];
};

export type DayMeals = {
  breakfast: MealBooking;
  lunch: MealBooking;
  dinner: MealBooking;
};

export type WeekData = {
  0: DayMeals; 1: DayMeals; 2: DayMeals; 3: DayMeals;
  4: DayMeals; 5: DayMeals; 6: DayMeals;
};

type CalendarData = Record<string, WeekData>;

export type GroceryItem = {
  id: string;
  name: string;
  addedAt: number;
  householdId?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  purchasedAt: number;
  householdId?: string;
};

export type PurchaseHistoryItem = {
  id: string;
  name: string;
  ranOutAt: number;
  householdId?: string;
};

type StoreState = {
  users: User[];
  menu: MenuItem[];
  calendar: CalendarData;
  groceryList: GroceryItem[];
  inventory: InventoryItem[];
  purchaseHistory: PurchaseHistoryItem[];
  rolloverPrompt: { show: boolean; weekKey: string } | null;
};

// ── Context ───────────────────────────────────────────────────────────────────

type StoreContextType = StoreState & {
  addUser: (user: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  removeUser: (id: string) => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  removeMenuItem: (id: string) => void;
  updateMeal: (weekKey: string, day: keyof WeekData, meal: keyof DayMeals, booking: Partial<MealBooking>) => void;
  handleRollover: (action: 'copy' | 'fresh') => void;
  addGroceryItem: (name: string) => void;
  checkOffGrocery: (item: GroceryItem) => void;
  removeGroceryItem: (id: string) => void;
  ranOutInventory: (item: InventoryItem) => void;
  clearPurchaseHistory: () => void;
  deletePurchaseHistoryItem: (id: string) => void;
};

const StoreContext = createContext<StoreContextType | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

export const getWeekKey = (date: Date) =>
  format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');

const emptyDay = (): DayMeals => ({
  breakfast: { assigneeId: null, coAssigneeId: null, recipeIds: [] },
  lunch: { assigneeId: null, coAssigneeId: null, recipeIds: [] },
  dinner: { assigneeId: null, coAssigneeId: null, recipeIds: [] },
});

const emptyWeek = (): WeekData => ({
  0: emptyDay(), 1: emptyDay(), 2: emptyDay(), 3: emptyDay(),
  4: emptyDay(), 5: emptyDay(), 6: emptyDay(),
});

const migrateBooking = (raw: Record<string, unknown>): MealBooking => {
  const recipeIds: string[] = Array.isArray(raw.recipeIds) ? raw.recipeIds as string[] : [];
  if (typeof raw.recipeId === 'string' && raw.recipeId && !recipeIds.includes(raw.recipeId)) {
    recipeIds.push(raw.recipeId as string);
  }
  return {
    assigneeId: (raw.assigneeId as string | null) ?? null,
    coAssigneeId: (raw.coAssigneeId as string | null) ?? null,
    recipeIds,
  };
};

const migrateWeekData = (raw: Record<string, unknown>): WeekData => {
  const week = emptyWeek();
  for (let i = 0; i <= 6; i++) {
    const day = raw[i.toString()] as Record<string, unknown> | undefined;
    if (day) {
      week[i as keyof WeekData] = {
        breakfast: migrateBooking((day.breakfast as Record<string, unknown>) || {}),
        lunch: migrateBooking((day.lunch as Record<string, unknown>) || {}),
        dinner: migrateBooking((day.dinner as Record<string, unknown>) || {}),
      };
    }
  }
  return week;
};

// ── Provider ──────────────────────────────────────────────────────────────────

export const StoreProvider = ({
  children,
  householdId,
}: {
  children: ReactNode;
  householdId: string;
}) => {
  const [state, setState] = useState<StoreState>({
    users: [],
    menu: [],
    calendar: {},
    groceryList: [],
    inventory: [],
    purchaseHistory: [],
    rolloverPrompt: null,
  });
  const [loading, setLoading] = useState(true);

  // ── One-time data migration for BBB10 (adds householdId to legacy docs) ──
  useEffect(() => {
    if (householdId !== 'BBB10') return;
    const migrateColl = async (collName: string) => {
      const snap = await getDocs(collection(db, collName));
      const batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach(d => {
        if (!d.data().householdId) {
          batch.update(d.ref, { householdId: 'BBB10' });
          count++;
        }
      });
      if (count > 0) await batch.commit();
    };
    Promise.all(['users', 'menu', 'grocery_list', 'inventory', 'purchase_history'].map(migrateColl));
    // Calendar docs use householdId prefix so they don't need field migration
  }, [householdId]);

  // ── Firestore listeners (scoped to householdId) ───────────────────────────
  useEffect(() => {
    let usersLoaded = false;
    let calLoaded = false;
    const checkInit = () => { if (usersLoaded && calLoaded) setLoading(false); };

    const hq = (coll: string) => query(collection(db, coll), where('householdId', '==', householdId));

    const DEFAULT_USERS: User[] = [
      { id: `${householdId}_1`, name: 'Moy', color: 'var(--color-coral)', householdId },
      { id: `${householdId}_2`, name: 'Baibai', color: 'var(--color-sky)', householdId },
    ];

    const unsubUsers = onSnapshot(hq('users'), snap => {
      if (snap.empty && householdId !== 'BBB10') {
        DEFAULT_USERS.forEach(u => setDoc(doc(db, 'users', u.id), u));
      } else {
        setState(s => ({ ...s, users: snap.docs.map(d => d.data() as User) }));
      }
      usersLoaded = true;
      checkInit();
    }, () => { usersLoaded = true; checkInit(); });

    const unsubMenu = onSnapshot(hq('menu'), snap => {
      const menu = snap.docs
        .map(d => d.data() as MenuItem)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setState(s => ({ ...s, menu }));
    }, () => {});

    const unsubCal = onSnapshot(
      query(collection(db, 'calendar'), where('householdId', '==', householdId)),
      snap => {
        const calendar: CalendarData = {};
        snap.docs.forEach(d => {
          // Doc ID format: `${householdId}_${weekKey}` — strip prefix for local key
          const rawKey = d.id.startsWith(`${householdId}_`) ? d.id.slice(householdId.length + 1) : d.id;
          calendar[rawKey] = migrateWeekData(d.data() as Record<string, unknown>);
        });
        setState(s => ({ ...s, calendar }));
        calLoaded = true;
        checkInit();
      },
      () => { calLoaded = true; checkInit(); }
    );

    const unsubGrocery = onSnapshot(hq('grocery_list'), snap => {
      const groceryList = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as GroceryItem))
        .sort((a, b) => b.addedAt - a.addedAt);
      setState(s => ({ ...s, groceryList }));
    }, () => {});

    const unsubInventory = onSnapshot(hq('inventory'), snap => {
      const inventory = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as InventoryItem))
        .sort((a, b) => b.purchasedAt - a.purchasedAt);
      setState(s => ({ ...s, inventory }));
    }, () => {});

    const unsubHistory = onSnapshot(hq('purchase_history'), snap => {
      const purchaseHistory = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as PurchaseHistoryItem))
        .sort((a, b) => b.ranOutAt - a.ranOutAt);
      setState(s => ({ ...s, purchaseHistory }));
    }, () => {});

    return () => {
      unsubUsers(); unsubMenu(); unsubCal();
      unsubGrocery(); unsubInventory(); unsubHistory();
    };
  }, [householdId]);

  // ── One-time dedup of history items (same name → keep oldest) ────────────
  useEffect(() => {
    if (loading) return;
    const historyItems = state.menu.filter(m => m.category === 'history');
    const seen = new Map<string, MenuItem>();
    const toDelete: string[] = [];
    // menu is sorted newest-first; reverse to keep oldest
    [...historyItems].reverse().forEach(item => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) {
        toDelete.push(item.id);
      } else {
        seen.set(key, item);
      }
    });
    toDelete.forEach(id => deleteDoc(doc(db, 'menu', id)));
  }, [loading]); // intentionally only on loading transition

  // ── Rollover prompt ───────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const currentWeekKey = getWeekKey(new Date());
    if (!state.calendar[currentWeekKey] && state.rolloverPrompt?.weekKey !== currentWeekKey) {
      const previousWeekKey = getWeekKey(subWeeks(new Date(), 1));
      if (state.calendar[previousWeekKey]) {
        setState(s => ({ ...s, rolloverPrompt: { show: true, weekKey: currentWeekKey } }));
      } else {
        setDoc(doc(db, 'calendar', `${householdId}_${currentWeekKey}`), {
          ...emptyWeek(), householdId,
        });
      }
    }
  }, [state.calendar, state.rolloverPrompt, loading, householdId]);

  // ── Auto-roll yesterday's calendar dishes into menu history ───────────────
  const processedHistoryRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading || state.menu.length === 0) return;
    const yesterday = subDays(new Date(), 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
    if (processedHistoryRef.current.has(yesterdayStr)) return;

    const weekKey = getWeekKey(yesterday);
    const weekData = state.calendar[weekKey];
    if (!weekData) return;

    const mondayOfWeek = startOfWeek(yesterday, { weekStartsOn: 1 });
    const dayIdx = Math.round((yesterday.getTime() - mondayOfWeek.getTime()) / 86400000) as keyof WeekData;
    const dayData = weekData[dayIdx];
    if (!dayData) return;

    const meals: (keyof DayMeals)[] = ['breakfast', 'lunch', 'dinner'];
    const existingHistoryNames = new Set(
      state.menu.filter(m => m.category === 'history').map(m => m.name.toLowerCase())
    );
    const allMenuById = new Map(state.menu.map(m => [m.id, m]));
    const addedNamesThisRun = new Set<string>();

    meals.forEach(meal => {
      const booking = dayData[meal];
      (booking.recipeIds || []).forEach(rid => {
        const original = allMenuById.get(rid);
        if (!original) return;
        // Custom dishes are already history — don't re-add
        if (original.category === 'history') return;
        const nameLower = original.name.toLowerCase();
        if (existingHistoryNames.has(nameLower) || addedNamesThisRun.has(nameLower)) return;
        addedNamesThisRun.add(nameLower);
        const historyItem: MenuItem = {
          id: `hist-${householdId}-${rid}-${yesterdayStr}`,
          name: original.name,
          category: 'history',
          createdAt: Date.now(),
          householdId,
        };
        setDoc(doc(db, 'menu', historyItem.id), historyItem);
      });
    });
    processedHistoryRef.current.add(yesterdayStr);
  }, [loading, state.calendar, householdId]); // NOT state.menu to avoid loop

  // ── Actions ───────────────────────────────────────────────────────────────

  const addUser = async (user: User) =>
    setDoc(doc(db, 'users', user.id), { ...user, householdId });
  const updateUser = async (id: string, updates: Partial<User>) =>
    updateDoc(doc(db, 'users', id), updates);
  const removeUser = async (id: string) =>
    deleteDoc(doc(db, 'users', id));

  const addMenuItem = async (item: MenuItem) =>
    setDoc(doc(db, 'menu', item.id), { ...item, householdId, createdAt: item.createdAt ?? Date.now() });
  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) =>
    updateDoc(doc(db, 'menu', id), updates);
  const removeMenuItem = async (id: string) =>
    deleteDoc(doc(db, 'menu', id));

  const updateMeal = async (weekKey: string, day: keyof WeekData, meal: keyof DayMeals, booking: Partial<MealBooking>) => {
    const docId = `${householdId}_${weekKey}`;
    setState(s => {
      const week = s.calendar[weekKey] || emptyWeek();
      const newWeek = {
        ...week,
        [day]: { ...week[day], [meal]: { ...week[day][meal], ...booking } }
      };
      setDoc(doc(db, 'calendar', docId), { ...newWeek, householdId });
      return { ...s, calendar: { ...s.calendar, [weekKey]: newWeek } };
    });
  };

  const handleRollover = async (action: 'copy' | 'fresh') => {
    if (!state.rolloverPrompt) return;
    const currentWeekKey = state.rolloverPrompt.weekKey;
    const previousWeekKey = getWeekKey(subWeeks(new Date(currentWeekKey), 1));
    let newWeek = emptyWeek();
    if (action === 'copy' && state.calendar[previousWeekKey]) {
      newWeek = JSON.parse(JSON.stringify(state.calendar[previousWeekKey]));
    }
    await setDoc(doc(db, 'calendar', `${householdId}_${currentWeekKey}`), { ...newWeek, householdId });
    setState(s => ({ ...s, rolloverPrompt: null }));
  };

  const addGroceryItem = async (name: string) =>
    addDoc(collection(db, 'grocery_list'), { name, addedAt: Date.now(), householdId });
  const checkOffGrocery = async (item: GroceryItem) => {
    await deleteDoc(doc(db, 'grocery_list', item.id));
    await addDoc(collection(db, 'inventory'), { name: item.name, purchasedAt: Date.now(), householdId });
  };
  const removeGroceryItem = async (id: string) =>
    deleteDoc(doc(db, 'grocery_list', id));
  const ranOutInventory = async (item: InventoryItem) => {
    await deleteDoc(doc(db, 'inventory', item.id));
    await addDoc(collection(db, 'purchase_history'), { name: item.name, ranOutAt: Date.now(), householdId });
  };
  const clearPurchaseHistory = async () => {
    state.purchaseHistory.forEach(h => deleteDoc(doc(db, 'purchase_history', h.id)));
  };
  const deletePurchaseHistoryItem = async (id: string) =>
    deleteDoc(doc(db, 'purchase_history', id));

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>🍳</div>
        <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading Kitchen…</div>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{
      ...state,
      addUser, updateUser, removeUser,
      addMenuItem, updateMenuItem, removeMenuItem,
      updateMeal, handleRollover,
      addGroceryItem, checkOffGrocery, removeGroceryItem,
      ranOutInventory, clearPurchaseHistory, deletePurchaseHistoryItem,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
