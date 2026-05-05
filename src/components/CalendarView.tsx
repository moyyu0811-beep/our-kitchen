import { useState, Fragment } from 'react';
import { useStore, getWeekKey } from '../store';
import type { WeekData, DayMeals } from '../store';
import { format, addWeeks, subWeeks, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, MoreHorizontal, Utensils } from 'lucide-react';

const MEALS: (keyof DayMeals)[] = ['breakfast', 'lunch', 'dinner'];

export const CalendarView = () => {
  const { users, calendar, updateMeal, menu } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeMenuBlock, setActiveMenuBlock] = useState<{dayIndex: number, meal: keyof DayMeals} | null>(null);
  
  const weekKey = getWeekKey(currentDate);
  const weekData = calendar[weekKey] || {
    0: { breakfast: {}, lunch: {}, dinner: {} },
    1: { breakfast: {}, lunch: {}, dinner: {} },
    2: { breakfast: {}, lunch: {}, dinner: {} },
    3: { breakfast: {}, lunch: {}, dinner: {} },
    4: { breakfast: {}, lunch: {}, dinner: {} },
    5: { breakfast: {}, lunch: {}, dinner: {} },
    6: { breakfast: {}, lunch: {}, dinner: {} },
  };

  const monday = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(monday, i));

  const handleBlockClick = (dayIndex: number, meal: keyof DayMeals) => {
    const currentAssignee = weekData[dayIndex as keyof WeekData]?.[meal]?.assigneeId;
    
    // Cycle: Unassigned -> User1 -> User2 -> ... -> Dine Out -> Unassigned
    let nextAssigneeId: string | null = null;
    
    if (!currentAssignee) {
      if (users.length > 0) nextAssigneeId = users[0].id;
      else nextAssigneeId = 'dine-out';
    } else if (currentAssignee === 'dine-out') {
      nextAssigneeId = null;
    } else {
      const userIdx = users.findIndex(u => u.id === currentAssignee);
      if (userIdx !== -1 && userIdx < users.length - 1) {
        nextAssigneeId = users[userIdx + 1].id;
      } else {
        nextAssigneeId = 'dine-out';
      }
    }
    
    updateMeal(weekKey, dayIndex as keyof WeekData, meal, { assigneeId: nextAssigneeId });
  };

  const getBlockStyle = (assigneeId?: string | null) => {
    if (!assigneeId) return { background: 'rgba(255,255,255,0.3)', border: '2px dashed var(--border-color)' };
    if (assigneeId === 'dine-out') return { background: 'var(--color-dine-out)', color: 'white', border: '2px solid transparent' };
    const user = users.find(u => u.id === assigneeId);
    return { background: user ? user.color : 'rgba(255,255,255,0.3)', color: '#1e293b', border: '2px solid transparent' };
  };

  const renderMenuDrawer = () => {
    if (!activeMenuBlock) return null;
    
    const currentRecipeId = weekData[activeMenuBlock.dayIndex as keyof WeekData]?.[activeMenuBlock.meal]?.recipeId;
    
    const signatures = menu.filter(m => m.category === 'signature');
    const wishlists = menu.filter(m => m.category === 'wishlist');
    const histories = menu.filter(m => m.category === 'history');

    const handleSelect = (recipeId: string | null) => {
      updateMeal(weekKey, activeMenuBlock.dayIndex as keyof WeekData, activeMenuBlock.meal, { recipeId });
      setActiveMenuBlock(null);
    };

    const renderSection = (title: string, items: typeof menu) => {
      if (items.length === 0) return null;
      return (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="hover-lift active-scale"
                style={{
                  background: currentRecipeId === item.id ? 'var(--accent-color)' : 'rgba(255,255,255,0.7)',
                  color: currentRecipeId === item.id ? 'white' : 'var(--text-primary)',
                  padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', textAlign: 'left',
                  border: '1px solid var(--border-color)', fontWeight: 500
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50, 
        display: 'flex', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)'
      }} onClick={() => setActiveMenuBlock(null)}>
        <div 
          className="glass-panel" 
          style={{ 
            width: '100%', maxWidth: '350px', height: '100%', 
            borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)', 
            padding: '2rem', display: 'flex', flexDirection: 'column',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem' }}>Select Menu</h3>
            <button onClick={() => setActiveMenuBlock(null)} className="glass hover-lift" style={{ padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <button
              onClick={() => handleSelect(null)}
              className="hover-lift"
              style={{
                width: '100%', background: 'transparent', color: 'var(--color-dine-out)',
                padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', textAlign: 'left',
                border: '2px dashed var(--border-color)', marginBottom: '1.5rem', fontWeight: 600
              }}
            >
              Clear Recipe
            </button>
            
            {renderSection('Signature', signatures)}
            {renderSection('Wishlist', wishlists)}
            {renderSection('History', histories)}
            
            {menu.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                Your menu is empty. Go to the Menu tab to add some dishes!
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '1rem 0' }}>
      {renderMenuDrawer()}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '0 1rem' }}>
        <button onClick={() => setCurrentDate(d => subWeeks(d, 1))} className="glass hover-lift" style={{ padding: '0.5rem', borderRadius: '50%' }}>
          <ChevronLeft />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          {format(monday, 'MMM d')} - {format(addDays(monday, 6), 'MMM d, yyyy')}
        </h2>
        <button onClick={() => setCurrentDate(d => addWeeks(d, 1))} className="glass hover-lift" style={{ padding: '0.5rem', borderRadius: '50%' }}>
          <ChevronRight />
        </button>
      </div>

      <div style={{ overflowX: 'auto', padding: '0 1rem', paddingBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(120px, 1fr))', gap: '1rem', minWidth: '800px' }}>
          {/* Header row */}
          <div></div>
          {days.map((day, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '0.5rem', fontWeight: 600 }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{format(day, 'EEE')}</div>
              <div style={{ fontSize: '1.5rem' }}>{format(day, 'd')}</div>
            </div>
          ))}

          {/* Meals rows */}
          {MEALS.map((meal) => (
            <Fragment key={meal}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '1rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                {meal}
              </div>
              {days.map((_, dayIndex) => {
                const booking = weekData[dayIndex as keyof WeekData]?.[meal] || { assigneeId: null };
                const style = getBlockStyle(booking.assigneeId);
                const user = users.find(u => u.id === booking.assigneeId);
                
                return (
                  <div 
                    key={dayIndex}
                    onClick={() => handleBlockClick(dayIndex, meal)}
                    className="glass-panel active-scale"
                    style={{ 
                      ...style, 
                      height: '100px', 
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: booking.assigneeId ? 'var(--shadow-md)' : 'none'
                    }}
                  >
                    {booking.assigneeId === 'dine-out' ? (
                      <>
                        <span style={{ fontSize: '2rem' }}>👏</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '4px' }}>Dine Out</span>
                      </>
                    ) : user ? (
                      <>
                        <span style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '1.1rem' }}>{user.name}</span>
                        {booking.recipeId && (
                          <span style={{ fontSize: '0.8rem', marginTop: '4px', textAlign: 'center', padding: '0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {menu.find(m => m.id === booking.recipeId)?.name}
                          </span>
                        )}
                      </>
                    ) : (
                      <Utensils size={24} opacity={0.2} />
                    )}

                    {/* Small menu button as requested */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuBlock({ dayIndex, meal });
                      }}
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        padding: '4px',
                        background: 'rgba(255,255,255,0.4)',
                        borderRadius: '50%',
                        backdropFilter: 'blur(4px)'
                      }}
                      className="hover-lift"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
