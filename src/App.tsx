import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { CalendarView } from './components/CalendarView';
import { FamilyView } from './components/FamilyView';
import { MenuView } from './components/MenuView';
import { RolloverPrompt } from './components/RolloverPrompt';
import { Calendar, Users, UtensilsCrossed } from 'lucide-react';
import { StoreProvider } from './store';

const AppContent = () => {
  return (
    <>
      <RolloverPrompt />
      <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 40, padding: '1rem 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)' }}>
            <UtensilsCrossed /> Our Kitchen
          </h1>
          <nav className="mobile-nav-container" style={{ display: 'flex', gap: '0.5rem' }}>
            <NavLink 
              to="/calendar" 
              className={({ isActive }) => `hover-lift ${isActive ? 'glass-panel' : ''}`}
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, textDecoration: 'none', color: 'inherit' }}
            >
              <Calendar size={18} /> <span>Calendar</span>
            </NavLink>
            <NavLink 
              to="/family" 
              className={({ isActive }) => `hover-lift ${isActive ? 'glass-panel' : ''}`}
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, textDecoration: 'none', color: 'inherit' }}
            >
              <Users size={18} /> <span>Family</span>
            </NavLink>
            <NavLink 
              to="/menu" 
              className={({ isActive }) => `hover-lift ${isActive ? 'glass-panel' : ''}`}
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, textDecoration: 'none', color: 'inherit' }}
            >
              <UtensilsCrossed size={18} /> <span>Menu</span>
            </NavLink>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/family" element={<FamilyView />} />
          <Route path="/menu" element={<MenuView />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavLink to="/calendar" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Calendar size={22} />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/family" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Users size={22} />
          <span>Family</span>
        </NavLink>
        <NavLink to="/menu" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <UtensilsCrossed size={22} />
          <span>Menu</span>
        </NavLink>
      </nav>
    </>
  );
};

function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </StoreProvider>
  );
}

export default App;
