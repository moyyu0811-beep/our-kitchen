import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore, getWeekKey } from '../store';
import type { WeekData, DayMeals } from '../store';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Utensils, Users } from 'lucide-react';

const MEALS: (keyof DayMeals)[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_EMOJIS: Record<string, string> = { breakfast: '☀️', lunch: '🌤️', dinner: '🌙' };

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => setIsMobile(window.innerWidth <= 768), { passive: true });
  }
  return isMobile;
};

export const CalendarView = () => {
  const { users, calendar, updateMeal, menu, addMenuItem } = useStore();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() => {
    const day = new Date().getDay(); // 0=Sun,1=Mon,...6=Sat
    return day === 0 ? 6 : day - 1; // convert to Mon=0..Sun=6
  });
  const [activeMenuBlock, setActiveMenuBlock] = useState<{ dayIndex: number; meal: keyof DayMeals } | null>(null);
  const [coAssigneeBlock, setCoAssigneeBlock] = useState<{ dayIndex: number; meal: keyof DayMeals } | null>(null);
  const [customDish, setCustomDish] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock body scroll when any overlay is open
  useEffect(() => {
    const locked = !!(activeMenuBlock || coAssigneeBlock);
    document.body.classList.toggle('scroll-locked', locked);
    return () => document.body.classList.remove('scroll-locked');
  }, [activeMenuBlock, coAssigneeBlock]);

  const weekKey = getWeekKey(currentDate);
  const weekData = calendar[weekKey] || {
    0: { breakfast: { assigneeId: null, recipeIds: [] }, lunch: { assigneeId: null, recipeIds: [] }, dinner: { assigneeId: null, recipeIds: [] } },
    1: { breakfast: { assigneeId: null, recipeIds: [] }, lunch: { assigneeId: null, recipeIds: [] }, dinner: { assigneeId: null, recipeIds: [] } },
    2: { breakfast: { assigneeId: null, recipeIds: [] }, lunch: { assigneeId: null, recipeIds: [] }, dinner: { assigneeId: null, recipeIds: [] } },
    3: { breakfast: { assigneeId: null, recipeIds: [] }, lunch: { assigneeId: null, recipeIds: [] }, dinner: { assigneeId: null, recipeIds: [] } },
    4: { breakfast: { assigneeId: null, recipeIds: [] }, lunch: { assigneeId: null, recipeIds: [] }, dinner: { assigneeId: null, recipeIds: [] } },
    5: { breakfast: { assigneeId: null, recipeIds: [] }, lunch: { assigneeId: null, recipeIds: [] }, dinner: { assigneeId: null, recipeIds: [] } },
    6: { breakfast: { assigneeId: null, recipeIds: [] }, lunch: { assigneeId: null, recipeIds: [] }, dinner: { assigneeId: null, recipeIds: [] } },
  };

  const monday = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(monday, i));

  // Today's day index (Mon=0..Sun=6) within the displayed week
  const todayWeekKey = getWeekKey(new Date());
  const todayDayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const isCurrentWeek = weekKey === todayWeekKey;

  const cycleAssignee = useCallback((dayIndex: number, meal: keyof DayMeals) => {
    const booking = weekData[dayIndex as keyof WeekData]?.[meal] || { assigneeId: null };
    const current = booking.assigneeId;
    let next: string | null = null;
    if (!current) { next = users.length > 0 ? users[0].id : 'dine-out'; }
    else if (current === 'dine-out') { next = null; }
    else {
      const idx = users.findIndex(u => u.id === current);
      next = idx !== -1 && idx < users.length - 1 ? users[idx + 1].id : 'dine-out';
    }
    updateMeal(weekKey, dayIndex as keyof WeekData, meal, { assigneeId: next });
  }, [weekData, users, weekKey, updateMeal]);

  const handleLongPress = (dayIndex: number, meal: keyof DayMeals) => {
    setCoAssigneeBlock({ dayIndex, meal });
  };

  const startLongPress = (dayIndex: number, meal: keyof DayMeals) => {
    longPressTimer.current = setTimeout(() => handleLongPress(dayIndex, meal), 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const getBlockStyle = (assigneeId?: string | null, coAssigneeId?: string | null) => {
    if (coAssigneeId) {
      return {
        background: 'linear-gradient(135deg, rgba(66,133,244,0.18) 0%, rgba(155,114,217,0.18) 40%, rgba(52,168,143,0.18) 70%, rgba(234,179,8,0.12) 100%)',
        border: '1.5px solid rgba(155,114,217,0.25)',
      };
    }
    if (!assigneeId) return { background: 'rgba(255,255,255,0.3)', border: '2px dashed var(--border-color)' };
    if (assigneeId === 'dine-out') return { background: 'var(--color-dine-out)', color: 'white', border: '2px solid transparent' };
    const user = users.find(u => u.id === assigneeId);
    return { background: user ? user.color : 'rgba(255,255,255,0.3)', color: '#1e293b', border: '2px solid transparent' };
  };

  const toggleRecipe = (recipeId: string) => {
    if (!activeMenuBlock) return;
    const booking = weekData[activeMenuBlock.dayIndex as keyof WeekData]?.[activeMenuBlock.meal] || { assigneeId: null, recipeIds: [] };
    const current = booking.recipeIds || [];
    const next = current.includes(recipeId) ? current.filter(id => id !== recipeId) : [...current, recipeId];
    updateMeal(weekKey, activeMenuBlock.dayIndex as keyof WeekData, activeMenuBlock.meal, { recipeIds: next });
  };

  const renderMenuDrawer = () => {
    if (!activeMenuBlock) return null;
    const booking = weekData[activeMenuBlock.dayIndex as keyof WeekData]?.[activeMenuBlock.meal] || { assigneeId: null, recipeIds: [] };
    const selectedIds = booking.recipeIds || [];
    // Only show signature & wishlist (not history)
    const sections = [
      { key: 'signature', label: 'Signature', items: menu.filter(m => m.category === 'signature') },
      { key: 'wishlist', label: 'Wishlist', items: menu.filter(m => m.category === 'wishlist') },
    ];

    const addCustomDish = () => {
      if (!customDish.trim() || !activeMenuBlock) return;
      const customId = `custom-${Date.now()}`;
      // Custom dishes go straight to history — they're one-offs
      const newItem = { id: customId, name: customDish.trim(), category: 'history' as const };
      addMenuItem(newItem);
      const current = booking.recipeIds || [];
      updateMeal(weekKey, activeMenuBlock.dayIndex as keyof WeekData, activeMenuBlock.meal, { recipeIds: [...current, customId] });
      setCustomDish('');
    };

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={() => setActiveMenuBlock(null)}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '350px', height: '100%', borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)', padding: '2rem', display: 'flex', flexDirection: 'column' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.4rem' }}>Select Dishes</h3>
            <button onClick={() => setActiveMenuBlock(null)} className="glass hover-lift" style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Tap dishes to toggle — multiple selections allowed</p>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
            {/* Customize: add a one-off dish */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customize</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text" value={customDish}
                  onChange={e => setCustomDish(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomDish()}
                  placeholder="Type any dish name…"
                  style={{
                    flex: 1, padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.6)',
                    fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none'
                  }}
                />
                <button onClick={addCustomDish} className="hover-lift" style={{
                  padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-color)', color: 'white', fontWeight: 700, flexShrink: 0
                }}>+</button>
              </div>
            </div>
            {sections.map(({ key, label, items }) => items.length > 0 && (
              <div key={key} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {items.map(item => {
                    const sel = selectedIds.includes(item.id);
                    return (
                      <button key={item.id} onClick={() => toggleRecipe(item.id)} className="hover-lift active-scale" style={{
                        background: sel ? 'var(--accent-color)' : 'rgba(255,255,255,0.7)',
                        color: sel ? 'white' : 'var(--text-primary)',
                        padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', textAlign: 'left',
                        border: sel ? '1px solid var(--accent-color)' : '1px solid var(--border-color)', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                      }}>
                        <span style={{ fontSize: '1rem' }}>{sel ? '✓' : '○'}</span> {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {menu.filter(m => m.category !== 'history').length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Go to Menu tab to add dishes!</div>
            )}
            {/* Clear All — at the bottom */}
            {selectedIds.length > 0 && (
              <button
                onClick={() => updateMeal(weekKey, activeMenuBlock.dayIndex as keyof WeekData, activeMenuBlock.meal, { recipeIds: [] })}
                className="hover-lift"
                style={{
                  width: '100%', background: 'transparent', color: 'var(--text-muted)',
                  padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', textAlign: 'center',
                  border: '1px dashed var(--border-color)', marginTop: '0.5rem', fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                Clear all dishes
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCoAssigneePopover = () => {
    if (!coAssigneeBlock) return null;
    const booking = weekData[coAssigneeBlock.dayIndex as keyof WeekData]?.[coAssigneeBlock.meal] || { assigneeId: null };
    const current = booking.coAssigneeId;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={() => setCoAssigneeBlock(null)}>
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-xl)', minWidth: 260 }} onClick={e => e.stopPropagation()}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} /> Add Co-Chef</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button onClick={() => { updateMeal(weekKey, coAssigneeBlock.dayIndex as keyof WeekData, coAssigneeBlock.meal, { coAssigneeId: null }); setCoAssigneeBlock(null); }}
              className="hover-lift" style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '2px dashed var(--border-color)', background: 'transparent', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted)' }}>
              Solo Chef (Remove Co-Chef)
            </button>
            {users.map(u => (
              <button key={u.id} onClick={() => { updateMeal(weekKey, coAssigneeBlock.dayIndex as keyof WeekData, coAssigneeBlock.meal, { coAssigneeId: u.id }); setCoAssigneeBlock(null); }}
                className="hover-lift active-scale" style={{
                  padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                  background: current === u.id ? u.color : 'rgba(255,255,255,0.7)',
                  border: current === u.id ? '2px solid rgba(0,0,0,0.15)' : '1px solid var(--border-color)',
                  textAlign: 'left', fontWeight: 600
                }}>{u.name}</button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── DESKTOP GRID ──
  const renderDesktopGrid = () => (
    <div style={{ overflowX: 'auto', padding: '0 1rem', paddingBottom: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(120px, 1fr))', gap: '1rem', minWidth: '800px' }}>
        <div></div>
        {days.map((day, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '0.5rem', fontWeight: 600 }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{format(day, 'EEE')}</div>
            <div style={{ fontSize: '1.5rem', color: isCurrentWeek && i === todayDayIdx ? 'var(--accent-color)' : undefined }}>{format(day, 'd')}</div>
          </div>
        ))}
        {MEALS.map(meal => (
          <>
            <div key={`label-${meal}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '1rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
              {meal}
            </div>
            {days.map((_, dayIndex) => {
              const booking = weekData[dayIndex as keyof WeekData]?.[meal] || { assigneeId: null, recipeIds: [] };
              const style = getBlockStyle(booking.assigneeId, booking.coAssigneeId);
              const user = users.find(u => u.id === booking.assigneeId);
              const coUser = users.find(u => u.id === booking.coAssigneeId);
              const recipeNames = (booking.recipeIds || []).map(id => menu.find(m => m.id === id)?.name).filter(Boolean);
              return (
                <div key={dayIndex}
                  className={`glass-panel active-scale ${booking.coAssigneeId ? 'gradient-cooked' : ''}`}
                  style={{ ...style, height: 110, borderRadius: 'var(--radius-lg)', cursor: 'pointer', position: 'relative', display: 'flex', overflow: 'hidden' }}
                  onMouseDown={() => startLongPress(dayIndex, meal)}
                  onMouseUp={cancelLongPress}
                  onTouchStart={() => startLongPress(dayIndex, meal)}
                  onTouchEnd={cancelLongPress}
                >
                  {/* Left: chef */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}
                    onClick={() => cycleAssignee(dayIndex, meal)}>
                    {booking.assigneeId === 'dine-out' ? (
                      <><span style={{ fontSize: '1.5rem' }}>👏</span><span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Dine Out</span></>
                    ) : user ? (
                      <><span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{user.name}</span>{coUser && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>+{coUser.name}</span>}</>
                    ) : (
                      <Utensils size={20} opacity={0.2} />
                    )}
                  </div>
                  {/* Subtle divider */}
                  <div style={{ width: 1, background: 'rgba(0,0,0,0.06)', alignSelf: 'stretch', margin: '12px 0' }} />
                  {/* Right: dish */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', cursor: 'pointer' }}
                    onClick={() => setActiveMenuBlock({ dayIndex, meal })}>
                    {recipeNames.length > 0 ? (
                      <span style={{ fontSize: '0.7rem', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {recipeNames.join(' · ')}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.25)' }}>+ dish</span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );

  // ── MOBILE DAY VIEW ──
  const renderMobileDayView = () => {
    const dayData = weekData[activeDayIndex as keyof WeekData];
    return (
      <div style={{ padding: '0 1rem' }}>
        {/* Date strip */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '1rem', scrollbarWidth: 'none' }}>
          {days.map((day, i) => {
            const isToday = isCurrentWeek && i === todayDayIdx;
            const isActive = i === activeDayIndex;
            return (
              <button key={i} onClick={() => setActiveDayIndex(i)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)', minWidth: 48, flexShrink: 0,
                background: isActive ? 'var(--accent-color)' : isToday ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.5)',
                color: isActive ? 'white' : isToday ? 'var(--accent-color)' : 'var(--text-primary)',
                border: isToday && !isActive ? '1.5px solid var(--accent-color)' : '1px solid transparent',
                fontWeight: 600, transition: 'all 0.2s'
              }}>
                <span style={{ fontSize: '0.7rem' }}>{format(day, 'EEE')}</span>
                <span style={{ fontSize: '1.3rem', lineHeight: 1.3 }}>{format(day, 'd')}</span>
              </button>
            );
          })}
        </div>

        {/* Meal blocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {MEALS.map(meal => {
            const booking = dayData?.[meal] || { assigneeId: null, recipeIds: [] };
            const blockStyle = getBlockStyle(booking.assigneeId, booking.coAssigneeId);
            const user = users.find(u => u.id === booking.assigneeId);
            const coUser = users.find(u => u.id === booking.coAssigneeId);
            const recipeNames = (booking.recipeIds || []).map(id => menu.find(m => m.id === id)?.name).filter(Boolean);
            return (
              <div key={meal} className={`glass-panel ${booking.coAssigneeId ? 'gradient-cooked' : ''}`}
                style={{ ...blockStyle, borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}
                onTouchStart={() => startLongPress(activeDayIndex, meal)}
                onTouchEnd={cancelLongPress}
                onMouseDown={() => startLongPress(activeDayIndex, meal)}
                onMouseUp={cancelLongPress}
              >
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>{MEAL_EMOJIS[meal]}</span>{meal.charAt(0).toUpperCase() + meal.slice(1)}
                </div>
                <div style={{ display: 'flex', minHeight: 80 }}>
                  {/* Left: Chef */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', borderRight: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer' }}
                    onClick={() => cycleAssignee(activeDayIndex, meal)}>
                    {booking.assigneeId === 'dine-out' ? (
                      <><span style={{ fontSize: '1.75rem' }}>👏</span><span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Dine Out</span></>
                    ) : user ? (
                      <><span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user.name}</span>{coUser && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>+{coUser.name}</span>}</>
                    ) : (
                      <><Utensils size={24} opacity={0.15} /><span style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.3)', marginTop: 4 }}>Tap to assign</span></>
                    )}
                  </div>
                  {/* Right: Dish */}
                  <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', cursor: 'pointer' }}
                    onClick={() => setActiveMenuBlock({ dayIndex: activeDayIndex, meal })}>
                    {recipeNames.length > 0 ? (
                      <span style={{ fontSize: '0.85rem', textAlign: 'center', fontWeight: 500 }}>{recipeNames.join(' · ')}</span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.28)' }}>+ Add dish</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '1rem 0' }}>
      {renderMenuDrawer()}
      {renderCoAssigneePopover()}

      {/* Week nav header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 1rem' }}>
        <button onClick={() => setCurrentDate(d => subWeeks(d, 1))} className="glass hover-lift" style={{ padding: '0.5rem', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} />
        </button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {format(monday, 'MMM d')} – {format(addDays(monday, 6), 'MMM d, yyyy')}
        </h2>
        <button onClick={() => setCurrentDate(d => addWeeks(d, 1))} className="glass hover-lift" style={{ padding: '0.5rem', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {isMobile ? renderMobileDayView() : renderDesktopGrid()}
    </div>
  );
};
