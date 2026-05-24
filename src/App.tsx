import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { CalendarView } from './components/CalendarView';
import { FamilyView } from './components/FamilyView';
import { MenuView } from './components/MenuView';
import { GroceryView } from './components/GroceryView';
import { RolloverPrompt } from './components/RolloverPrompt';
import { AuthPage } from './components/AuthPage';
import { Calendar, Users, UtensilsCrossed, ShoppingCart } from 'lucide-react';
import { StoreProvider } from './store';
import { AuthProvider, useAuth } from './auth';

const NAV_ITEMS = [
  { to: '/family',   label: 'Family',   icon: <Users size={22} />,          iconSm: <Users size={18} /> },
  { to: '/calendar', label: 'Calendar', icon: <Calendar size={22} />,        iconSm: <Calendar size={18} /> },
  { to: '/menu',     label: 'Menu',     icon: <UtensilsCrossed size={22} />, iconSm: <UtensilsCrossed size={18} /> },
  { to: '/grocery',  label: 'Grocery',  icon: <ShoppingCart size={22} />,    iconSm: <ShoppingCart size={18} /> },
];

const AppContent = () => {
  const { firebaseUser, householdId, authLoading } = useAuth();

  // Show nothing while checking auth state
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>🍳</div>
        <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading…</div>
      </div>
    );
  }

  // Not logged in → show auth page
  if (!firebaseUser || !householdId) {
    return <AuthPage />;
  }

  // Logged in → show main app inside StoreProvider scoped to household
  return (
    <StoreProvider householdId={householdId}>
      <RolloverPrompt />
      <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 40, padding: '1rem 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)' }}>
            <UtensilsCrossed /> Our Kitchen
          </h1>
          {/* Desktop nav */}
          <nav className="mobile-nav-container" style={{ display: 'flex', gap: '0.5rem' }}>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `hover-lift ${isActive ? 'glass-panel' : ''}`}
                style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, textDecoration: 'none', color: 'inherit' }}
              >
                {item.iconSm} <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/family" element={<FamilyView />} />
          <Route path="/menu" element={<MenuView />} />
          <Route path="/grocery" element={<GroceryView />} />
        </Routes>
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </StoreProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
