import { useState } from 'react';
import { UtensilsCrossed, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { useAuth, generateHouseholdId, householdExists, createHousehold } from '../auth';

type Screen = 'login' | 'signup' | 'household';

type HouseholdChoice = 'create' | 'join' | null;

export const AuthPage = () => {
  const { signIn, signUp } = useAuth();

  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Household setup
  const [householdChoice, setHouseholdChoice] = useState<HouseholdChoice>(null);
  const [joinCode, setJoinCode] = useState('');
  const [newCode] = useState(() => generateHouseholdId());
  const [codeCopied, setCodeCopied] = useState(false);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setPendingCreds({ email, password });
    setScreen('household');
  };

  const handleHouseholdCreate = async () => {
    if (!pendingCreds) return;
    setLoading(true);
    setError('');
    try {
      await signUp(pendingCreds.email, pendingCreds.password, newCode);
      await createHousehold(newCode);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleHouseholdJoin = async () => {
    if (!pendingCreds) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError('Please enter a household code.'); return; }
    setLoading(true);
    setError('');
    try {
      const exists = await householdExists(code);
      if (!exists) { setError('Household code not found. Check the code and try again.'); setLoading(false); return; }
      await signUp(pendingCreds.email, pendingCreds.password, code);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(newCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // ── Household Setup Screen ────────────────────────────────────────────────

  if (screen === 'household') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏠</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Set Up Your Household</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              A household lets your family share the same Kitchen data.
            </p>
          </div>

          {!householdChoice ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button onClick={() => setHouseholdChoice('create')} style={optionBtnStyle('#3b82f6')}>
                <span style={{ fontSize: '1.5rem' }}>✨</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700 }}>Create New Household</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Start fresh — share your code with your partner</div>
                </div>
              </button>
              <button onClick={() => setHouseholdChoice('join')} style={optionBtnStyle('#8b5cf6')}>
                <span style={{ fontSize: '1.5rem' }}>🔗</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700 }}>Join Existing Household</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Enter the code your partner shared with you</div>
                </div>
              </button>
            </div>
          ) : householdChoice === 'create' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                Your household code — share this with your partner so they can join.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: '2rem', fontWeight: 800, letterSpacing: '0.2em',
                  background: 'rgba(59,130,246,0.1)', padding: '0.75rem 1.5rem',
                  borderRadius: 'var(--radius-xl)', color: '#2563eb', border: '2px solid rgba(59,130,246,0.25)'
                }}>
                  {newCode}
                </span>
                <button onClick={copyCode} className="hover-lift" style={{
                  padding: '0.75rem', borderRadius: 'var(--radius-md)',
                  background: codeCopied ? 'rgba(34,197,94,0.12)' : 'var(--bg-card)',
                  border: '1px solid var(--border-color)', color: codeCopied ? '#16a34a' : 'var(--text-primary)'
                }}>
                  {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}
              <button onClick={handleHouseholdCreate} disabled={loading} style={primaryBtnStyle}>
                {loading ? 'Creating…' : 'Create & Continue →'}
              </button>
              <button onClick={() => setHouseholdChoice(null)} style={ghostBtnStyle}>← Back</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                Enter the household code your partner shared with you.
              </p>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. GH7VD"
                maxLength={6}
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 700 }}
              />
              {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}
              <button onClick={handleHouseholdJoin} disabled={loading} style={primaryBtnStyle}>
                {loading ? 'Joining…' : 'Join Household →'}
              </button>
              <button onClick={() => setHouseholdChoice(null)} style={ghostBtnStyle}>← Back</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Login / Signup Screen ─────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', marginBottom: '0.5rem' }}>
            <UtensilsCrossed size={32} />
            <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>Our Kitchen</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Your family's shared cooking hub</p>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', borderRadius: 'var(--radius-xl)', background: 'rgba(0,0,0,0.05)', padding: '4px', marginBottom: '1.75rem' }}>
          {(['login', 'signup'] as const).map(s => (
            <button key={s} onClick={() => { setScreen(s); setError(''); }} style={{
              flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-lg)',
              background: screen === s ? 'white' : 'transparent',
              fontWeight: screen === s ? 700 : 400,
              color: screen === s ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: screen === s ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s', border: 'none', cursor: 'pointer', fontSize: '0.95rem',
              textTransform: 'capitalize',
            }}>
              {s === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={screen === 'login' ? handleLogin : handleSignup}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={{ ...inputStyle, paddingRight: '3rem' }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0,
                }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={loading} style={primaryBtnStyle}>
            {loading ? '…' : screen === 'login' ? 'Log In' : 'Continue →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
          {screen === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setScreen(screen === 'login' ? 'signup' : 'login'); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}>
            {screen === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
};

// ── Style helpers ─────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
  background: 'var(--bg-primary)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.6)',
  borderRadius: 'var(--radius-xl)',
  padding: '2.5rem 2rem',
  boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem 1rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.6)',
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.9rem',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent-color)',
  color: 'white',
  fontWeight: 700,
  fontSize: '1rem',
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const ghostBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: 'var(--radius-md)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: '0.9rem',
  border: '1px solid var(--border-color)',
  cursor: 'pointer',
};

const optionBtnStyle = (color: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1.25rem',
  borderRadius: 'var(--radius-xl)',
  background: color,
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'transform 0.15s, box-shadow 0.15s',
  boxShadow: `0 4px 16px ${color}44`,
});

const friendlyError = (err: unknown): string => {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Incorrect email or password.';
  }
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/network-request-failed') return 'Network error — check your connection.';
  return 'Something went wrong. Please try again.';
};
