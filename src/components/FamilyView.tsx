import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useAuth, generateHouseholdId } from '../auth';
import type { User } from '../store';
import { Plus, Trash2, Edit2, Copy, LogOut, Bell } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { db, messaging } from '../firebase';
import { NotificationBuilder } from './NotificationBuilder';
import { useScrollRestoration } from '../useScrollRestoration';

const PREDEFINED_COLORS = [
  'var(--color-coral)', 'var(--color-sunflower)', 'var(--color-mint)',
  'var(--color-lavender)', 'var(--color-sky)', 'var(--color-peach)',
  'var(--color-rose)', 'var(--color-sage)'
];

export const FamilyView = () => {
  const { users, addUser, updateUser, removeUser } = useStore();
  const { firebaseUser, activeHouseholdId, households, switchHousehold, leaveHousehold, createHousehold, joinHousehold, signOut } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  useScrollRestoration('family');

  useEffect(() => {
    if (firebaseUser) {
      getDoc(doc(db, 'auth_users', firebaseUser.uid)).then(snap => {
        if (snap.exists() && snap.data().fcmToken) {
          setPushEnabled(true);
        }
      });
    }
  }, [firebaseUser]);

  const handleTogglePush = async () => {
    if (!messaging || !firebaseUser) return;
    setNotifSaving(true);
    try {
      if (pushEnabled) {
        await updateDoc(doc(db, 'auth_users', firebaseUser.uid), { fcmToken: null });
        setPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Explicitly register the SW for Firebase at the correct path
          const swReg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}firebase-messaging-sw.js`);
          const token = await getToken(messaging, { 
            serviceWorkerRegistration: swReg,
            vapidKey: import.meta.env.VITE_VAPID_KEY 
          });
          if (token) {
            await updateDoc(doc(db, 'auth_users', firebaseUser.uid), {
              fcmToken: token
            });
            setPushEnabled(true);
          }
        } else {
          alert('Notification permission denied. Please enable them in your device settings.');
        }
      }
    } catch (e: any) {
      console.error(e);
      alert(`Failed to setup notifications: ${e.message}\nMake sure you are running this as an installed PWA (Add to Home Screen) and have provided a VAPID key in your environment if needed.`);
    }
    setNotifSaving(false);
  };

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

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    setLoggingOut(false);
  };

  const handleSwitchHousehold = async (hid: string) => {
    if (hid === activeHouseholdId) return;
    if (window.confirm(`Switch to household ${hid}?`)) {
      await switchHousehold(hid);
    }
  };

  const handleLeaveHousehold = async (hid: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent row click
    if (households.length === 1) {
      if (window.confirm(`WARNING: You are leaving your LAST household.\n\nIf you proceed, your account will be DELETED, and you will need to sign up again.\n\nType 'OK' if you are sure.`)) {
        try {
          await leaveHousehold(hid);
        } catch (err: any) {
          if (err.message.includes('requires-recent-login')) {
            alert('For security reasons, please log out and log back in before deleting your account.');
          } else {
            alert(err.message);
          }
        }
      }
    } else {
      if (window.confirm(`Are you sure you want to leave household ${hid}?\n\nIf you are the last member in it, ALL its data will be permanently deleted.`)) {
        await leaveHousehold(hid);
      }
    }
  };

  const handleCreateNew = async () => {
    const newCode = generateHouseholdId();
    try {
      await createHousehold(newCode);
      alert(`Created and switched to new household: ${newCode}`);
      setShowAddMenu(false);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleJoinExisting = async () => {
    const code = window.prompt("Enter the 6-character household code:");
    if (!code) return;
    try {
      await joinHousehold(code.toUpperCase());
      alert(`Joined and switched to household: ${code.toUpperCase()}`);
      setShowAddMenu(false);
    } catch (e: any) {
      alert(e.message);
    }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Households
          </h3>
          {households.length < 3 && !showAddMenu && (
            <button onClick={() => setShowAddMenu(true)} className="hover-lift active-scale" style={{
              background: 'rgba(59,130,246,0.1)', color: 'var(--accent-color)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8rem', border: 'none'
            }}>
              + Add
            </button>
          )}
        </div>

        {showAddMenu && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: 'var(--bg-body)', padding: '0.5rem', borderRadius: 'var(--radius-lg)' }}>
            <button onClick={handleCreateNew} className="hover-lift active-scale" style={{
              flex: 1, background: 'var(--accent-color)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.85rem'
            }}>
              Create New
            </button>
            <button onClick={handleJoinExisting} className="hover-lift active-scale" style={{
              flex: 1, background: '#8b5cf6', color: 'white', border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.85rem'
            }}>
              Join Existing
            </button>
            <button onClick={() => setShowAddMenu(false)} className="hover-lift" style={{
              background: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '0.5rem', fontWeight: 600, fontSize: '0.85rem'
            }}>
              Cancel
            </button>
          </div>
        )}

        {firebaseUser && (
          <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Signed in as <strong style={{ color: 'var(--text-primary)' }}>{firebaseUser.email}</strong>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {households.map(hid => (
            <div key={hid}
              onClick={() => handleSwitchHousehold(hid)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)',
                border: hid === activeHouseholdId ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: hid === activeHouseholdId ? 'rgba(59,130,246,0.05)' : 'transparent',
                cursor: hid === activeHouseholdId ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.15em', color: hid === activeHouseholdId ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                  {hid}
                </span>
                {hid === activeHouseholdId && (
                  <span style={{ fontSize: '0.7rem', background: 'var(--accent-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '99px', fontWeight: 700 }}>ACTIVE</span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {hid === activeHouseholdId && (
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(hid); alert('Copied!'); }} className="hover-lift" style={{ padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}>
                    <Copy size={16} />
                  </button>
                )}
                <button onClick={(e) => handleLeaveHousehold(hid, e)} className="hover-lift" style={{ padding: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444' }}>
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          Tap a code to switch households. Share the active code with family to let them join. Max 3 households.
        </p>
      </div>

      {/* Notification Settings */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={18} /> Notifications
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem' }}>What are we having for…?</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Get notified to plan your meals.</div>
          </div>
          <button
            onClick={handleTogglePush}
            disabled={notifSaving}
            className="hover-lift active-scale"
            style={{
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-xl)', fontWeight: 600,
              background: pushEnabled ? 'var(--accent-color)' : 'rgba(0,0,0,0.05)',
              color: pushEnabled ? 'white' : 'var(--text-primary)',
              border: pushEnabled ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
            }}
          >
            {notifSaving ? '...' : pushEnabled ? 'Enabled' : 'Notify Me'}
          </button>
        </div>
        {pushEnabled && firebaseUser && (
          <NotificationBuilder firebaseUser={firebaseUser} />
        )}
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
