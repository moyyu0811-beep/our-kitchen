import { useState } from 'react';
import { useStore } from '../store';
import type { GroceryItem, InventoryItem } from '../store';
import { ShoppingCart, Package, History, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'shopping' | 'inventory' | 'history';

const TAB_META = {
  shopping:  { label: 'Shopping',  icon: <ShoppingCart size={16} />, desc: 'What we need to buy' },
  inventory: { label: 'Inventory', icon: <Package size={16} />,      desc: 'Items we have at home' },
  history:   { label: 'History',   icon: <History size={16} />,      desc: 'Everything we\'ve run out of' },
} as const;

export const GroceryView = () => {
  const {
    groceryList, inventory, purchaseHistory,
    addGroceryItem, checkOffGrocery, removeGroceryItem,
    ranOutInventory, clearPurchaseHistory, deletePurchaseHistoryItem,
  } = useStore();
  const [tab, setTab] = useState<Tab>('shopping');
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState<Set<string>>(new Set());

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    addGroceryItem(input.trim());
    setInput('');
  };

  const handleCheckOff = (item: GroceryItem) => {
    if (checking.has(item.id)) return;
    setChecking(prev => new Set(prev).add(item.id));
    setTimeout(() => checkOffGrocery(item), 500);
  };

  const counts: Record<Tab, number> = {
    shopping: groceryList.length,
    inventory: inventory.length,
    history: purchaseHistory.length,
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1.25rem' }}>Our Grocery</h2>

        {/* Blog-style underline tabs with icons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'nowrap' }}>
          {(Object.keys(TAB_META) as Tab[]).map(t => {
            const meta = TAB_META[t];
            const isActive = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                background: 'none', border: 'none', padding: '0 0 0.35rem 0',
                fontWeight: isActive ? 700 : 400,
                fontSize: '1rem',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                whiteSpace: 'nowrap',
              }}>
                {meta.icon} {meta.label}
                {counts[t] > 0 && (
                  <span style={{
                    background: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    color: 'white', borderRadius: '999px',
                    padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700,
                  }}>{counts[t]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Description below tabs */}
        <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {TAB_META[tab].desc}
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>

        {/* ── Shopping List ── */}
        {tab === 'shopping' && (
          <>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Add item to shopping list…"
                style={{
                  flex: 1, padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.5)',
                  fontSize: '1rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button type="submit" className="hover-lift active-scale" style={{
                background: 'var(--accent-color)', color: 'white',
                padding: '0 1.25rem', borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}><Plus size={22} /></button>
            </form>

            {groceryList.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                Your shopping list is empty. Add something!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {groceryList.map((item: GroceryItem) => {
                  const isChecking = checking.has(item.id);
                  return (
                    <div key={item.id} className="glass grocery-item" style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
                      transition: 'opacity 0.4s, transform 0.4s',
                      opacity: isChecking ? 0 : 1,
                      transform: isChecking ? 'translateX(20px)' : 'none',
                    }}>
                      <button
                        onClick={() => handleCheckOff(item)}
                        className={`grocery-check-btn ${isChecking ? 'checked' : ''}`}
                        title="Mark as purchased"
                      >
                        <span className="check-ring" />
                        <span className="check-mark">✓</span>
                      </button>
                      <span style={{ flex: 1, fontWeight: 500 }}>{item.name}</span>
                      <button onClick={() => removeGroceryItem(item.id)} className="hover-lift"
                        style={{ color: 'var(--text-muted)', padding: '4px', flexShrink: 0 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Inventory ── */}
        {tab === 'inventory' && (
          <>
            {inventory.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                No items yet. Check off items from your shopping list!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {inventory.map((item: InventoryItem) => (
                  <div key={item.id} className="glass" style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
                  }}>
                    <Package size={18} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Purchased {format(new Date(item.purchasedAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {/* Blue "Used it up" with bowl emoji */}
                    <button onClick={() => ranOutInventory(item)} className="hover-lift active-scale" style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)',
                      background: 'rgba(59,130,246,0.1)', color: '#2563eb',
                      fontWeight: 600, fontSize: '0.8rem',
                      border: '1px solid rgba(59,130,246,0.25)', flexShrink: 0,
                    }}>
                      🥣 Used it up
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Purchase History ── */}
        {tab === 'history' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span />
              {purchaseHistory.length > 0 && (
                <button onClick={clearPurchaseHistory} className="hover-lift" style={{
                  fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.3rem 0.6rem',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', flexShrink: 0,
                }}>Clear all</button>
              )}
            </div>
            {purchaseHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                No purchase history yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {purchaseHistory.map(item => (
                  <div key={item.id} className="glass" style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
                  }}>
                    <History size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Ran out {format(new Date(item.ranOutAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <button
                      onClick={() => deletePurchaseHistoryItem(item.id)}
                      className="hover-lift"
                      title="Delete"
                      style={{ color: 'var(--text-muted)', padding: '4px', flexShrink: 0 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
