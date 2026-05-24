import { useState } from 'react';
import { useStore } from '../store';
import { useAuth } from '../auth';
import type { User } from '../store';
import { Plus, Trash2, Edit2, Copy, Check, LogOut } from 'lucide-react';

const PREDEFINED_COLORS = [
  'var(--color-coral)', 'var(--color-sunflower)', 'var(--color-mint)',
  'var(--color-lavender)', 'var(--color-sky)', 'var(--color-peach)',
  'var(--color-rose)', 'var(--color-sage)'
];

export const FamilyView = () => {
  const { users, addUser, updateUser, removeUser } = useStore();
  const { firebaseUser, householdId, signOut } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleAdd = () => {
    const newUser: User = {
      id: Math.random().toString(36).substring(7),
      name: 'New Member',
      color: PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)]
    };
    addUser(newUser);
    startEdit(newUser);
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditColor(user.color);
  };

  const saveEdit = () => {
    if (editingId) {
      updateUser(editingId, { name: editName, color: editColor });
      setEditingId(null);
    }
  };

  const copyCode = () => {
    if (householdId) navigator.clipboard.writeText(householdId);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    setLoggingOut(false);
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem' }}>Our Family</h2>
        <button
          onClick={handleAdd}
          className="hover-lift active-scale"
          style={{
            background: 'var(--accent-color)', color: 'white',
            padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-xl)',
            display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600
          }}>
          <Plus size={20} /> Add Member
        </button>
      </div>

      {/* Family members grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {users.map(user => (
          <div key={user.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
              background: user.color
            }} />

            {editingId === user.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{
                    padding: '0.75rem', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.5)',
                    fontSize: '1.1rem', fontFamily: 'inherit', outline: 'none'
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {PREDEFINED_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{
                        width: '32px', height: '32px', borderRadius: '50%', background: c,
                        border: editColor === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                        transition: 'transform 0.2s'
                      }}
                      className="hover-lift"
                    />
                  ))}
                </div>
                <button
                  onClick={saveEdit}
                  style={{
                    background: 'var(--text-primary)', color: 'white',
                    padding: '0.75rem', borderRadius: 'var(--radius-md)', fontWeight: 600,
                    marginTop: '0.5rem'
                  }}>
                  Save
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.5)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{user.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => startEdit(user)} className="glass hover-lift" style={{ padding: '0.5rem', borderRadius: '50%' }}>
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => removeUser(user.id)} className="glass hover-lift" style={{ padding: '0.5rem', borderRadius: '50%', color: 'var(--color-dine-out)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Household info card */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Your Household
        </h3>

        {firebaseUser && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Signed in as <strong style={{ color: 'var(--text-primary)' }}>{firebaseUser.email}</strong>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Household Code</div>
            <span style={{
              fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.15em',
              color: 'var(--accent-color)'
            }}>
              {householdId}
            </span>
          </div>
          <button onClick={copyCode} className="hover-lift" style={{
            padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)',
            background: codeCopied ? 'rgba(34,197,94,0.1)' : 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: codeCopied ? '#16a34a' : 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem',
            transition: 'all 0.2s',
          }}>
            {codeCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Share this code with your partner so they can join this household.
        </p>
      </div>

      {/* Log out */}
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="hover-lift"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-xl)',
            background: 'rgba(239,68,68,0.08)', color: '#dc2626',
            border: '1px solid rgba(239,68,68,0.2)', fontWeight: 600, fontSize: '0.9rem',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <LogOut size={18} />
          {loggingOut ? 'Logging out…' : 'Log out current account'}
        </button>
      </div>
    </div>
  );
};
