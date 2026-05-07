import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { startOfWeek, format, subWeeks, subDays } from 'date-fns';
import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';

export type User = {
  id: string;
  name: string;
  color: string;
};

export type MenuItem = {
  id: string;
  name: string;
  category: 'signature' | 'wishlist' | 'history';
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
  0: DayMeals; // Monday
  1: DayMeals; // Tuesday
  2: DayMeals; // Wednesday
  3: DayMeals; // Thursday
  4: DayMeals; // Friday
  5: DayMeals; // Saturday
  6: DayMeals; // Sunday
};

type CalendarData = Record<string, WeekData>;

// Grocery types
export type GroceryItem = {
  id: string;
  name: string;
  addedAt: number; // timestamp
};

export type InventoryItem = {
  id: string;
  name: string;
  purchasedAt: number; // timestamp
};

export type PurchaseHistoryItem = {
  id: string;
  name: string;
  ranOutAt: number; // timestamp
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

const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Mom', color: 'var(--color-coral)' },
  { id: '2', name: 'Dad', color: 'var(--color-sky)' },
];

const DEFAULT_MENU: MenuItem[] = [
  { id: '1', name: 'Spaghetti Bolognese', category: 'signature' },
  { id: '2', name: 'Tacos', category: 'signature' },
  { id: '3', name: 'Beef Wellington', category: 'wishlist' },
];

const emptyDay = (): DayMeals => ({
  breakfast: { assigneeId: null, coAssigneeId: null, recipeIds: [] },
  lunch: { assigneeId: null, coAssigneeId: null, recipeIds: [] },
  dinner: { assigneeId: null, coAssigneeId: null, recipeIds: [] },
});

const emptyWeek = (): WeekData => ({
  0: emptyDay(), 1: emptyDay(), 2: emptyDay(), 3: emptyDay(),
  4: emptyDay(), 5: emptyDay(), 6: emptyDay(),
});

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
};

const StoreContext = createContext<StoreContextType | null>(null);

export const getWeekKey = (date: Date) => {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
};

// Migrate old single recipeId → recipeIds array
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

export const StoreProvider = ({ children }: { children: ReactNode }) => {
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

  // Firestore listeners
  useEffect(() => {
    let inits = 0;
    const checkInit = () => {
      inits++;
      if (inits >= 6) setLoading(false);
    };

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      if (snap.empty) {
        DEFAULT_USERS.forEach(u => setDoc(doc(db, 'users', u.id), u));
      } else {
        const users = snap.docs.map(d => d.data() as User);
        setState(s => ({ ...s, users }));
      }
      checkInit();
    }, (error) => { console.error('Users sync error:', error); checkInit(); });

    const unsubMenu = onSnapshot(collection(db, 'menu'), (snap) => {
      if (snap.empty) {
        DEFAULT_MENU.forEach(m => setDoc(doc(db, 'menu', m.id), m));
      } else {
        const menu = snap.docs.map(d => d.data() as MenuItem);
        setState(s => ({ ...s, menu }));
      }
      checkInit();
    }, (error) => { console.error('Menu sync error:', error); checkInit(); });

    const unsubCal = onSnapshot(collection(db, 'calendar'), (snap) => {
      const calendar: CalendarData = {};
      snap.docs.forEach(d => {
        calendar[d.id] = migrateWeekData(d.data() as Record<string, unknown>);
      });
      setState(s => ({ ...s, calendar }));
      checkInit();
    }, (error) => { console.error('Calendar sync error:', error); checkInit(); });

    const unsubGrocery = onSnapshot(collection(db, 'grocery_list'), (snap) => {
      const groceryList = snap.docs.map(d => ({ id: d.id, ...d.data() } as GroceryItem));
      groceryList.sort((a, b) => b.addedAt - a.addedAt);
      setState(s => ({ ...s, groceryList }));
      checkInit();
    }, (error) => { console.error('Grocery sync error:', error); checkInit(); });

    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snap) => {
      const inventory = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
      inventory.sort((a, b) => b.purchasedAt - a.purchasedAt);
      setState(s => ({ ...s, inventory }));
      checkInit();
    }, (error) => { console.error('Inventory sync error:', error); checkInit(); });

    const unsubHistory = onSnapshot(collection(db, 'purchase_history'), (snap) => {
      const purchaseHistory = snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseHistoryItem));
      purchaseHistory.sort((a, b) => b.ranOutAt - a.ranOutAt);
      setState(s => ({ ...s, purchaseHistory }));
      checkInit();
    }, (error) => { console.error('Purchase history sync error:', error); checkInit(); });

    return () => {
      unsubUsers(); unsubMenu(); unsubCal();
      unsubGrocery(); unsubInventory(); unsubHistory();
    };
  }, []);

  // Rollover prompt check
  useEffect(() => {
    if (loading) return;
    const currentWeekKey = getWeekKey(new Date());
    if (!state.calendar[currentWeekKey] && state.rolloverPrompt?.weekKey !== currentWeekKey) {
      const previousWeekKey = getWeekKey(subWeeks(new Date(), 1));
      if (state.calendar[previousWeekKey]) {
        setState(s => ({ ...s, rolloverPrompt: { show: true, weekKey: currentWeekKey } }));
      } else {
        setDoc(doc(db, 'calendar', currentWeekKey), emptyWeek());
      }
    }
  }, [state.calendar, state.rolloverPrompt, loading]);

  // Auto-roll yesterday's used recipes into menu history
  useEffect(() => {
    if (loading || state.menu.length === 0) return;
    const yesterday = subDays(new Date(), 1);
    const weekKey = getWeekKey(yesterday);
    const weekData = state.calendar[weekKey];
    if (!weekData) return;

    // Find which day index yesterday was (Monday=0...Sunday=6)
    const mondayOfWeek = startOfWeek(yesterday, { weekStartsOn: 1 });
    const dayIdx = Math.round((yesterday.getTime() - mondayOfWeek.getTime()) / 86400000) as keyof WeekData;
    const dayData = weekData[dayIdx];
    if (!dayData) return;

    const meals: (keyof DayMeals)[] = ['breakfast', 'lunch', 'dinner'];
    const historyIds = new Set(state.menu.filter(m => m.category === 'history').map(m => m.id));
    const allMenuIds = new Set(state.menu.map(m => m.id));

    meals.forEach(meal => {
      const booking = dayData[meal];
      (booking.recipeIds || []).forEach(rid => {
        if (!historyIds.has(rid) && allMenuIds.has(rid)) {
          // Add a new history entry (copy with new id so original stays in its category)
          const original = state.menu.find(m => m.id === rid);
          if (original && original.category !== 'history') {
            const historyItem: MenuItem = {
              id: `hist-${rid}-${format(yesterday, 'yyyy-MM-dd')}`,
              name: original.name,
              category: 'history',
            };
            setDoc(doc(db, 'menu', historyItem.id), historyItem);
          }
        }
      });
    });
  }, [loading, state.calendar, state.menu]);

  const addUser = async (user: User) => {
    await setDoc(doc(db, 'users', user.id), user);
  };
  const updateUser = async (id: string, updates: Partial<User>) => {
    await updateDoc(doc(db, 'users', id), updates);
  };
  const removeUser = async (id: string) => {
    await deleteDoc(doc(db, 'users', id));
  };
  const addMenuItem = async (item: MenuItem) => {
    await setDoc(doc(db, 'menu', item.id), item);
  };
  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    await updateDoc(doc(db, 'menu', id), updates);
  };
  const removeMenuItem = async (id: string) => {
    await deleteDoc(doc(db, 'menu', id));
  };

  const updateMeal = async (weekKey: string, day: keyof WeekData, meal: keyof DayMeals, booking: Partial<MealBooking>) => {
    setState(s => {
      const week = s.calendar[weekKey] || emptyWeek();
      const newWeek = {
        ...week,
        [day]: {
          ...week[day],
          [meal]: { ...week[day][meal], ...booking }
        }
      };
      setDoc(doc(db, 'calendar', weekKey), newWeek);
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
    await setDoc(doc(db, 'calendar', currentWeekKey), newWeek);
    setState(s => ({ ...s, rolloverPrompt: null }));
  };

  // Grocery actions
  const addGroceryItem = async (name: string) => {
    await addDoc(collection(db, 'grocery_list'), { name, addedAt: Date.now() });
  };
  const checkOffGrocery = async (item: GroceryItem) => {
    await deleteDoc(doc(db, 'grocery_list', item.id));
    await addDoc(collection(db, 'inventory'), { name: item.name, purchasedAt: Date.now() });
  };
  const removeGroceryItem = async (id: string) => {
    await deleteDoc(doc(db, 'grocery_list', id));
  };
  const ranOutInventory = async (item: InventoryItem) => {
    await deleteDoc(doc(db, 'inventory', item.id));
    await addDoc(collection(db, 'purchase_history'), { name: item.name, ranOutAt: Date.now() });
  };
  const clearPurchaseHistory = async () => {
    state.purchaseHistory.forEach(h => deleteDoc(doc(db, 'purchase_history', h.id)));
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>🍳</div>
        <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading Kitchen...</div>
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
      ranOutInventory, clearPurchaseHistory,
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
