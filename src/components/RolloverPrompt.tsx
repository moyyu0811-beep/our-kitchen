import { useStore } from '../store';
import { Sparkles, RefreshCcw } from 'lucide-react';

export const RolloverPrompt = () => {
  const { rolloverPrompt, handleRollover } = useStore();

  if (!rolloverPrompt?.show) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '2rem' }}>New Week! ☀️</h2>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          It's Monday! Would you like to inherit the plans from last week or start fresh?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button 
            className="hover-lift active-scale"
            onClick={() => handleRollover('copy')}
            style={{ 
              background: 'var(--accent-color)', color: 'white', 
              padding: '1rem', borderRadius: 'var(--radius-lg)',
              fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontSize: '1.1rem'
            }}>
            <RefreshCcw size={20} />
            Like last week!
          </button>
          <button 
            className="hover-lift active-scale"
            onClick={() => handleRollover('fresh')}
            style={{ 
              background: 'rgba(255,255,255,0.5)', color: 'var(--text-primary)', 
              padding: '1rem', borderRadius: 'var(--radius-lg)',
              fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              border: '1px solid var(--border-color)', fontSize: '1.1rem'
            }}>
            <Sparkles size={20} />
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
};
