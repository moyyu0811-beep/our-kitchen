import { useState } from 'react';
import { useStore } from '../store';
import { Plus, Trash2, Star, Heart, Clock, CheckCircle } from 'lucide-react';

const CATEGORY_META = {
  signature: { label: 'Signature', icon: <Star size={16} />, desc: 'Dishes We Make All The Time' },
  wishlist:  { label: 'Wishlist',  icon: <Heart size={16} />, desc: 'Dishes We Want To Try' },
  history:   { label: 'History',  icon: <Clock size={16} />, desc: 'Dishes Cooked In The Past' },
} as const;

type Category = keyof typeof CATEGORY_META;

export const MenuView = () => {
  const { menu, addMenuItem, updateMenuItem, removeMenuItem } = useStore();
  const [newItemName, setNewItemName] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('signature');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    addMenuItem({
      id: Math.random().toString(36).substring(7),
      name: newItemName.trim(),
      category: activeCategory,
    });
    setNewItemName('');
  };

  const moveToSignature = (id: string) => {
    updateMenuItem(id, { category: 'signature' });
  };

  // Items are already sorted by createdAt desc from the store listener
  const currentItems = menu.filter(m => m.category === activeCategory);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1.25rem' }}>Our Menu</h2>

        {/* Blog-style underline tab nav with icons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'nowrap' }}>
          {(Object.keys(CATEGORY_META) as Category[]).map(cat => {
            const meta = CATEGORY_META[cat];
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  background: 'none', border: 'none', padding: '0 0 0.35rem 0',
                  fontWeight: isActive ? 700 : 400,
                  fontSize: '0.9rem',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>

        {/* Description below tabs */}
        <p style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {CATEGORY_META[activeCategory].desc}
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        {/* Add form — hidden for History */}
        {activeCategory !== 'history' && (
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder={`Add To ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}…`}
              style={{
                flex: 1, padding: '1rem', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.5)',
                fontSize: '1.1rem', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              type="submit"
              className="hover-lift active-scale"
              style={{
                background: 'var(--accent-color)', color: 'white',
                padding: '0 1.5rem', borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={24} />
            </button>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
              {activeCategory === 'history'
                ? 'Dishes You Cook Will Appear Here Automatically.'
                : 'No Dishes In This Category Yet.'}
            </div>
          ) : (
            currentItems.map(item => (
              <div
                key={item.id}
                className="glass"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)',
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 500, flex: 1 }}>{item.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {/* History-only: promote to Signature */}
                  {activeCategory === 'history' && (
                    <button
                      onClick={() => moveToSignature(item.id)}
                      className="hover-lift"
                      title="Add To Signature"
                      style={{
                        color: 'var(--accent-color)', padding: '0.5rem',
                        border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-md)',
                        background: 'rgba(59,130,246,0.06)', display: 'flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.75rem', fontWeight: 600,
                      }}
                    >
                      <Star size={14} /> Signature
                    </button>
                  )}
                  {/* Wishlist-only: move to History (Tried it!) */}
                  {activeCategory === 'wishlist' && (
                    <button
                      onClick={() => updateMenuItem(item.id, { category: 'history' })}
                      className="hover-lift"
                      title="Mark As Tried"
                      style={{
                        color: '#16a34a', padding: '0.5rem',
                        border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)',
                        background: 'rgba(34,197,94,0.06)', display: 'flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.75rem', fontWeight: 600,
                      }}
                    >
                      <CheckCircle size={14} /> Tried
                    </button>
                  )}
                  <button
                    onClick={() => removeMenuItem(item.id)}
                    className="hover-lift"
                    style={{ color: 'var(--text-muted)', padding: '0.5rem' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
