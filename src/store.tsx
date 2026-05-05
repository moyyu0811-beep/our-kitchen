import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { startOfWeek, format, subWeeks } from 'date-fns';
import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
  recipeId?: string | null;
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

type StoreState = {
  users: User[];
  menu: MenuItem[];
  calendar: CalendarData;
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
  breakfast: { assigneeId: null, recipeId: null },
  lunch: { assigneeId: null, recipeId: null },
  dinner: { assigneeId: null, recipeId: null },
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
};

const StoreContext = createContext<StoreContextType | null>(null);

export const getWeekKey = (date: Date) => {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
};

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StoreState>({
    users: [],
    menu: [],
    calendar: {},
    rolloverPrompt: null,
  });

  const [loading, setLoading] = useState(true);

  // Firestore listeners
  useEffect(() => {
    let inits = 0;
    const checkInit = () => {
      inits++;
      if (inits >= 3) setLoading(false);
    };

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      if (snap.empty) {
        DEFAULT_USERS.forEach(u => setDoc(doc(db, 'users', u.id), u));
      } else {
        const users = snap.docs.map(d => d.data() as User);
        setState(s => ({ ...s, users }));
      }
      checkInit();
    });

    const unsubMenu = onSnapshot(collection(db, 'menu'), (snap) => {
      if (snap.empty) {
        DEFAULT_MENU.forEach(m => setDoc(doc(db, 'menu', m.id), m));
      } else {
        const menu = snap.docs.map(d => d.data() as MenuItem);
        setState(s => ({ ...s, menu }));
      }
      checkInit();
    });

    const unsubCal = onSnapshot(collection(db, 'calendar'), (snap) => {
      const calendar: CalendarData = {};
      snap.docs.forEach(d => {
        calendar[d.id] = d.data() as WeekData;
      });
      setState(s => ({ ...s, calendar }));
      checkInit();
    });

    return () => {
      unsubUsers();
      unsubMenu();
      unsubCal();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    
    // Check for rollover on load
    const currentWeekKey = getWeekKey(new Date());
    if (!state.calendar[currentWeekKey] && state.rolloverPrompt?.weekKey !== currentWeekKey) {
      // Check if there was a previous week
      const previousWeekKey = getWeekKey(subWeeks(new Date(), 1));
      if (state.calendar[previousWeekKey]) {
        setState(s => ({ ...s, rolloverPrompt: { show: true, weekKey: currentWeekKey } }));
      } else {
        // First time ever using the app, just create empty week
        setDoc(doc(db, 'calendar', currentWeekKey), emptyWeek());
      }
    }
  }, [state.calendar, state.rolloverPrompt, loading]);

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
      // Optimistically update local state so UI doesn't flicker, while writing to db
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="animate-pulse text-[var(--color-text-muted)]">Loading Kitchen...</div>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{
      ...state,
      addUser, updateUser, removeUser,
      addMenuItem, updateMenuItem, removeMenuItem,
      updateMeal, handleRollover
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
};
