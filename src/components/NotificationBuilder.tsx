import { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Check } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { User as FirebaseUser } from 'firebase/auth';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationRule = {
  id: string;
  type: 'daily' | 'weekly';
  localDayOfWeek: number | null; // null for daily rules
  localTime: string;             // "HH:MM" in local time
  utcDayOfWeek: number | null;   // null for daily rules
  utcHour: number;
  utcMinute: number;
  message: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 48 }).map((_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    value: `${String(h).padStart(2, '0')}:${m}`,
    label: `${displayH}:${m} ${ampm}`,
  };
});

const DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Convert a local time (and optional local day-of-week) to UTC equivalents. */
function toUTC(localTime: string, localDay: number | null) {
  const [hours, minutes] = localTime.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  if (localDay !== null) {
    d.setDate(d.getDate() + ((localDay - d.getDay() + 7) % 7));
  }
  return {
    utcHour: d.getUTCHours(),
    utcMinute: d.getUTCMinutes(),
    utcDayOfWeek: localDay !== null ? d.getUTCDay() : null,
  };
}

/** Strip null values so Firestore never receives undefined or null fields. */
function sanitizeRule(rule: NotificationRule): Record<string, unknown> {
  return {
    id: rule.id,
    type: rule.type,
    localTime: rule.localTime,
    utcHour: rule.utcHour,
    utcMinute: rule.utcMinute,
    message: rule.message,
    ...(rule.localDayOfWeek !== null && { localDayOfWeek: rule.localDayOfWeek }),
    ...(rule.utcDayOfWeek !== null && { utcDayOfWeek: rule.utcDayOfWeek }),
  };
}

function makeRule(): NotificationRule {
  const localTime = '09:00';
  const utc = toUTC(localTime, null);
  return {
    id: Math.random().toString(36).slice(2, 9),
    type: 'daily',
    localDayOfWeek: null,
    localTime,
    message: 'Time to plan dinner!',
    ...utc,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export const NotificationBuilder = ({ firebaseUser }: { firebaseUser: FirebaseUser }) => {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load rules from Firestore on mount ────────────────────────────────────
  useEffect(() => {
    getDoc(doc(db, 'auth_users', firebaseUser.uid))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          // Support both old and new formats
          const loaded: NotificationRule[] = (data.pushPrefs?.rules ?? []).map((r: any) => ({
            id: r.id ?? Math.random().toString(36).slice(2, 9),
            type: r.type ?? 'daily',
            localTime: r.localTime ?? '09:00',
            localDayOfWeek: r.localDayOfWeek ?? null,
            utcHour: r.utcHour ?? 9,
            utcMinute: r.utcMinute ?? 0,
            utcDayOfWeek: r.utcDayOfWeek ?? null,
            message: r.message ?? '',
          }));
          setRules(loaded);
        }
      })
      .catch(e => console.error('Failed to load notification rules:', e))
      .finally(() => setLoading(false));
  }, [firebaseUser.uid]);

  // ── Persist rules to Firestore ────────────────────────────────────────────
  const persist = async (newRules: NotificationRule[]) => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      await setDoc(
        doc(db, 'auth_users', firebaseUser.uid),
        { pushPrefs: { rules: newRules.map(sanitizeRule) } },
        { merge: true }
      );
      setSaveStatus('saved');
      // Reset to idle after 2 seconds
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e: any) {
      console.error('Failed to save notification rules:', e);
      setSaveError(e?.message ?? e?.code ?? 'Unknown error');
      setSaveStatus('error');
    }
  };

  // ── Rule mutations — update state immediately, then persist ──────────────
  const addRule = () => {
    const newRules = [...rules, makeRule()];
    setRules(newRules);
    persist(newRules);
  };

  const removeRule = (id: string) => {
    const newRules = rules.filter(r => r.id !== id);
    setRules(newRules);
    persist(newRules);
  };

  const updateRuleField = (id: string, changes: Partial<NotificationRule>) => {
    const newRules = rules.map(r => {
      if (r.id !== id) return r;
      const merged = { ...r, ...changes };
      // Recompute UTC whenever time or day changes
      const utc = toUTC(merged.localTime, merged.localDayOfWeek);
      return { ...merged, ...utc };
    });
    setRules(newRules);
    persist(newRules);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Loading…</div>;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Heads-ups</span>
        <span style={{ fontSize: '0.75rem', color: saveStatus === 'error' ? '#ef4444' : saveStatus === 'saved' ? '#22c55e' : 'var(--text-muted)' }}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && <><Check size={12} style={{ display: 'inline', marginRight: 2 }} />Saved</>}
          {saveStatus === 'error' && `Error: ${saveError}`}
        </span>
      </div>

      {/* Rule cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {rules.map(rule => (
          <div key={rule.id} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem',
          }}>
            {/* Row 1: frequency controls + delete */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {/* Daily / Weekly */}
              <select
                value={rule.type}
                onChange={e => updateRuleField(rule.id, {
                  type: e.target.value as 'daily' | 'weekly',
                  localDayOfWeek: e.target.value === 'weekly' ? 1 : null,
                })}
                style={selectStyle}
              >
                <option value="daily">Every day</option>
                <option value="weekly">Weekly</option>
              </select>

              {/* Day picker (weekly only) */}
              {rule.type === 'weekly' && (
                <select
                  value={rule.localDayOfWeek ?? 1}
                  onChange={e => updateRuleField(rule.id, { localDayOfWeek: Number(e.target.value) })}
                  style={selectStyle}
                >
                  {DAY_OPTIONS.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              )}

              {/* Time picker */}
              <select
                value={rule.localTime}
                onChange={e => updateRuleField(rule.id, { localTime: e.target.value })}
                style={selectStyle}
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {/* Delete */}
              <button
                onClick={() => removeRule(rule.id)}
                style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                title="Remove"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Row 2: message text */}
            <input
              type="text"
              value={rule.message}
              onChange={e => updateRuleField(rule.id, { message: e.target.value })}
              onBlur={() => persist(rules)}
              placeholder="Notification message…"
              style={{
                width: '100%', padding: '0.5rem', fontSize: '16px',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                background: 'transparent', color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        {/* Add button */}
        <button
          onClick={addRule}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            padding: '0.6rem', background: 'transparent',
            border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          <Plus size={15} /> Add Heads-up
        </button>
      </div>
    </div>
  );
};

const selectStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-body)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};
