import { useState } from 'react';
import { useStore } from '../store';
import { Plus, Trash2, Heart, Star, Clock } from 'lucide-react';

export const MenuView = () => {
  const { menu, addMenuItem, removeMenuItem } = useStore();
  const [newItemName, setNewItemName] = useState('');
  const [activeCategory, setActiveCategory] = useState<'signature' | 'wishlist' | 'history'>('signature');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    
    addMenuItem({
      id: Math.random().toString(36).substring(7),
      name: newItemName.trim(),
      category: activeCategory
    });
    setNewItemName('');
  };

  const categories = [
    { id: 'signature', label: 'Signature', icon: <Star size={18} />, desc: 'Dishes we make all the time' },
    { id: 'wishlist', label: 'Wishlist', icon: <Heart size={18} />, desc: 'Dishes we want to try' },
    { id: 'history', label: 'History', icon: <Clock size={18} />, desc: 'Dishes we made before' },
  ] as const;

  const currentItems = menu.filter(m => m.category === activeCategory);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Our Menu</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="hover-lift"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-xl)',
                background: activeCategory === cat.id ? 'var(--text-primary)' : 'var(--bg-card)',
                color: activeCategory === cat.id ? 'white' : 'var(--text-primary)',
                fontWeight: 600, border: '1px solid var(--border-color)',
                transition: 'all 0.2s'
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          {categories.find(c => c.id === activeCategory)?.desc}
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <input 
            type="text"
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            placeholder={`Add to ${activeCategory}...`}
            style={{ 
              flex: 1, padding: '1rem', borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.5)',
              fontSize: '1.1rem', fontFamily: 'inherit', outline: 'none'
            }}
          />
          <button 
            type="submit"
            className="hover-lift active-scale"
            style={{ 
              background: 'var(--accent-color)', color: 'white', 
              padding: '0 1.5rem', borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            <Plus size={24} />
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
              No dishes in this category yet.
            </div>
          ) : (
            currentItems.map(item => (
              <div 
                key={item.id} 
                className="glass"
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)'
                }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>{item.name}</span>
                <button 
                  onClick={() => removeMenuItem(item.id)}
                  className="hover-lift"
                  style={{ color: 'var(--text-muted)', padding: '0.5rem' }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
