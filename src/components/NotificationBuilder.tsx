import { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { User as FirebaseUser } from 'firebase/auth';

export type NotificationRule = {
  id: string;
  type: 'daily' | 'weekly';
  localDayOfWeek?: number;
  localTime: string;
  utcDayOfWeek?: number;
  utcHour: number;
  utcMinute: number;
  message: string;
};

const TIME_OPTIONS = Array.from({ length: 48 }).map((_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    value: `${h.toString().padStart(2, '0')}:${m}`,
    label: `${displayH}:${m} ${ampm}`
  };
});

const DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function localToUTC(localDay: number | undefined, localTime: string) {
  const [hours, minutes] = localTime.split(':').map(Number);
  const now = new Date();
  
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  
  if (localDay !== undefined) {
    const currentDay = d.getDay();
    const diff = localDay - currentDay;
    d.setDate(d.getDate() + diff);
  }
  
  return {
    utcHour: d.getUTCHours(),
    utcMinute: d.getUTCMinutes(),
    utcDayOfWeek: localDay !== undefined ? d.getUTCDay() : undefined
  };
}

export const NotificationBuilder = ({ firebaseUser }: { firebaseUser: FirebaseUser }) => {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'auth_users', firebaseUser.uid)).then(snap => {
      if (snap.exists() && snap.data().pushPrefs?.rules) {
        setRules(snap.data().pushPrefs.rules);
      } else {
        // Default migration
        const oldPrefs = snap.data()?.pushPrefs;
        if (oldPrefs && !oldPrefs.rules) {
          const migrated: NotificationRule[] = [];
          if (oldPrefs.morning) {
            const utc = localToUTC(undefined, '08:30');
            migrated.push({ id: 'm1', type: 'daily', localTime: '08:30', message: oldPrefs.morning.msg || '今天吃什么？', ...utc });
          }
          if (oldPrefs.evening) {
            const utc = localToUTC(undefined, '20:30');
            migrated.push({ id: 'e1', type: 'daily', localTime: '20:30', message: oldPrefs.evening.msg || '明天吃什么？', ...utc });
          }
          if (migrated.length > 0) {
            setRules(migrated);
            setDoc(doc(db, 'auth_users', firebaseUser.uid), { pushPrefs: { rules: migrated } }, { merge: true }).catch(console.error);
          }
        } else if (!oldPrefs) {
          const r1 = { id: 'r1', type: 'daily' as const, localTime: '08:30', message: '今天吃什么？', ...localToUTC(undefined, '08:30') };
          const r2 = { id: 'r2', type: 'daily' as const, localTime: '20:30', message: '明天吃什么？', ...localToUTC(undefined, '20:30') };
          setRules([r1, r2]);
          setDoc(doc(db, 'auth_users', firebaseUser.uid), { pushPrefs: { rules: [r1, r2] } }, { merge: true }).catch(console.error);
        }
      }
      setLoading(false);
    }).catch(e => {
      console.error("Failed to load rules:", e);
      setLoading(false);
    });
  }, [firebaseUser]);

  const saveRules = async (newRules: NotificationRule[]) => {
    setSaving(true);
    setSaveError('');
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Save timed out — check your connection.')), 8000)
      );
      await Promise.race([
        setDoc(doc(db, 'auth_users', firebaseUser.uid), { pushPrefs: { rules: newRules } }, { merge: true }),
        timeout
      ]);
      setRules(newRules);
    } catch (e: any) {
      const msg = e?.message || e?.code || JSON.stringify(e) || 'Unknown error';
      console.error('Failed to save rules. Code:', e?.code, 'Message:', e?.message, e);
      setSaveError(`Could not save: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const addRule = async () => {
    const newRule: NotificationRule = {
      id: Math.random().toString(36).substring(7),
      type: 'daily',
      localTime: '09:00',
      message: 'Time to plan!',
      ...localToUTC(undefined, '09:00')
    };
    await saveRules([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    saveRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<NotificationRule>) => {
    const newRules = rules.map(r => {
      if (r.id === id) {
        const merged = { ...r, ...updates };
        const utc = localToUTC(merged.type === 'weekly' ? (merged.localDayOfWeek ?? 0) : undefined, merged.localTime);
        return { ...merged, ...utc };
      }
      return r;
    });
    saveRules(newRules);
  };

  if (loading) return <div style={{ fontSize: '0.8rem', padding: '1rem' }}>Loading schedules...</div>;

  return (
    <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
        Heads-ups
        {saving && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Saving...</span>}
      </h4>
      {saveError && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{saveError}</p>}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rules.map(rule => (
          <div key={rule.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select 
                value={rule.type} 
                onChange={(e) => updateRule(rule.id, { type: e.target.value as 'daily'|'weekly', localDayOfWeek: e.target.value === 'weekly' ? 0 : undefined })}
                style={{ padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>

              {rule.type === 'weekly' && (
                <select 
                  value={rule.localDayOfWeek ?? 0} 
                  onChange={(e) => updateRule(rule.id, { localDayOfWeek: parseInt(e.target.value) })}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                >
                  {DAY_OPTIONS.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              )}

              <select 
                value={rule.localTime} 
                onChange={(e) => updateRule(rule.id, { localTime: e.target.value })}
                style={{ padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              
              <button onClick={() => removeRule(rule.id)} style={{ marginLeft: 'auto', padding: '0.25rem', color: 'var(--color-dine-out)' }}>
                <Trash2 size={16} />
              </button>
            </div>
            
            <input 
              type="text" 
              value={rule.message}
              onChange={(e) => updateRule(rule.id, { message: e.target.value })}
              placeholder="Notification text..."
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', width: '100%', fontSize: '16px' }}
            />
          </div>
        ))}

        <button onClick={addRule} className="hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-card)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <Plus size={16} /> Add Heads-up
        </button>
      </div>
    </div>
  );
};
