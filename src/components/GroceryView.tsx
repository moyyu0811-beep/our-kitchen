import { useState } from 'react';
import { useStore } from '../store';
import type { GroceryItem, InventoryItem } from '../store';
import { ShoppingCart, Package, History, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'shopping' | 'inventory' | 'history';

export const GroceryView = () => {
  const { groceryList, inventory, purchaseHistory, addGroceryItem, checkOffGrocery, removeGroceryItem, ranOutInventory, clearPurchaseHistory, deletePurchaseHistoryItem } = useStore();
  const [tab, setTab] = useState<Tab>('shopping');
  const [input, setInput] = useState('');
  // Track which items are in "checking off" animation state
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
    // Brief animation delay, then remove
    setTimeout(() => checkOffGrocery(item), 500);
  };

  const tabs = [
    { id: 'shopping' as Tab, label: 'Shopping', icon: <ShoppingCart size={16} />, count: groceryList.length },
    { id: 'inventory' as Tab, label: 'Inventory', icon: <Package size={16} />, count: inventory.length },
    { id: 'history' as Tab, label: 'History', icon: <History size={16} />, count: purchaseHistory.length },
  ];

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Grocery</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Shared across all family devices</p>
      </div>

      {/* Tabs — single row, no wrapping */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="hover-lift" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.6rem 1rem', borderRadius: 'var(--radius-xl)',
            background: tab === t.id ? 'var(--text-primary)' : 'var(--bg-card)',
            color: tab === t.id ? 'white' : 'var(--text-primary)',
            fontWeight: 600, border: '1px solid var(--border-color)',
            transition: 'all 0.2s', whiteSpace: 'nowrap', fontSize: '0.9rem'
          }}>
            {t.icon} {t.label}
            {t.count > 0 && (
              <span style={{
                background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--accent-color)',
                color: 'white', borderRadius: '999px',
                padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>

        {/* Shopping List */}
        {tab === 'shopping' && (
          <>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Add item to shopping list..."
                style={{
                  flex: 1, padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.5)',
                  fontSize: '1rem', fontFamily: 'inherit', outline: 'none'
                }}
              />
              <button type="submit" className="hover-lift active-scale" style={{
                background: 'var(--accent-color)', color: 'white',
                padding: '0 1.25rem', borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
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
                      {/* Circle check button */}
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

        {/* Inventory */}
        {tab === 'inventory' && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Items you have at home. Click "Ran out!" when you've used the last of it.
            </p>
            {inventory.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                No items yet. Check off items from your shopping list!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {inventory.map((item: InventoryItem) => (
                  <div key={item.id} className="glass" style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)'
                  }}>
                    <Package size={18} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Purchased {format(new Date(item.purchasedAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <button onClick={() => ranOutInventory(item)} className="hover-lift active-scale" style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)',
                      background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                      fontWeight: 600, fontSize: '0.8rem',
                      border: '1px solid rgba(239,68,68,0.2)', flexShrink: 0
                    }}>
                      <AlertTriangle size={14} /> Ran out!
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* History */}
        {tab === 'history' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                A log of everything you've run out of.
              </p>
              {purchaseHistory.length > 0 && (
                <button onClick={clearPurchaseHistory} className="hover-lift" style={{
                  fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.3rem 0.6rem',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                  flexShrink: 0, marginLeft: '1rem'
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
                    padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)'
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
