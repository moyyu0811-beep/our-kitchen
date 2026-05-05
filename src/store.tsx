import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { startOfWeek, format, subWeeks } from 'date-fns';

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

const loadState = (): StoreState => {
  const saved = localStorage.getItem('our-kitchen-state');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse local state", e);
    }
  }
  return {
    users: DEFAULT_USERS,
    menu: DEFAULT_MENU,
    calendar: {},
    rolloverPrompt: null,
  };
};

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StoreState>(loadState());

  useEffect(() => {
    localStorage.setItem('our-kitchen-state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    // Check for rollover on load
    const currentWeekKey = getWeekKey(new Date());
    if (!state.calendar[currentWeekKey] && state.rolloverPrompt?.weekKey !== currentWeekKey) {
      // Check if there was a previous week
      const previousWeekKey = getWeekKey(subWeeks(new Date(), 1));
      if (state.calendar[previousWeekKey]) {
        setState(s => ({ ...s, rolloverPrompt: { show: true, weekKey: currentWeekKey } }));
      } else {
        // First time ever using the app, just create empty week
        setState(s => ({
          ...s,
          calendar: { ...s.calendar, [currentWeekKey]: emptyWeek() }
        }));
      }
    }
  }, [state.calendar, state.rolloverPrompt]);

  const addUser = (user: User) => {
    setState(s => ({ ...s, users: [...s.users, user] }));
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setState(s => ({
      ...s,
      users: s.users.map(u => u.id === id ? { ...u, ...updates } : u)
    }));
  };

  const removeUser = (id: string) => {
    setState(s => ({ ...s, users: s.users.filter(u => u.id !== id) }));
  };

  const addMenuItem = (item: MenuItem) => {
    setState(s => ({ ...s, menu: [...s.menu, item] }));
  };

  const updateMenuItem = (id: string, updates: Partial<MenuItem>) => {
    setState(s => ({
      ...s,
      menu: s.menu.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  const removeMenuItem = (id: string) => {
    setState(s => ({ ...s, menu: s.menu.filter(m => m.id !== id) }));
  };

  const updateMeal = (weekKey: string, day: keyof WeekData, meal: keyof DayMeals, booking: Partial<MealBooking>) => {
    setState(s => {
      const week = s.calendar[weekKey] || emptyWeek();
      const newWeek = {
        ...week,
        [day]: {
          ...week[day],
          [meal]: { ...week[day][meal], ...booking }
        }
      };
      return { ...s, calendar: { ...s.calendar, [weekKey]: newWeek } };
    });
  };

  const handleRollover = (action: 'copy' | 'fresh') => {
    if (!state.rolloverPrompt) return;
    
    const currentWeekKey = state.rolloverPrompt.weekKey;
    const previousWeekKey = getWeekKey(subWeeks(new Date(currentWeekKey), 1));
    
    setState(s => {
      let newCalendar = { ...s.calendar };
      if (action === 'copy' && s.calendar[previousWeekKey]) {
        // Deep copy the previous week but clear recipeIds if we wanted to just copy assignees? 
        // User asked: "inherits the plans from last week, waiting to be further edited"
        newCalendar[currentWeekKey] = JSON.parse(JSON.stringify(s.calendar[previousWeekKey]));
      } else {
        newCalendar[currentWeekKey] = emptyWeek();
      }
      return { ...s, calendar: newCalendar, rolloverPrompt: null };
    });
  };

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
