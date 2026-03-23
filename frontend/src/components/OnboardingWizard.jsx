import { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import RobotLogo from './RobotLogo';

// ── Animated gradient orb background ──────────────────────────────────────

function OrbBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', width: 600, height: 600,
        borderRadius: '50%', top: '-100px', left: '50%', transform: 'translateX(-60%)',
        background: 'radial-gradient(circle, rgba(124,106,247,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'orbPulse 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400,
        borderRadius: '50%', bottom: '-60px', right: '10%',
        background: 'radial-gradient(circle, rgba(77,159,255,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'orbPulse 8s ease-in-out infinite reverse',
      }} />
      <style>{`
        @keyframes orbPulse { 0%,100% { opacity: 0.6; transform: translateX(-60%) scale(1); } 50% { opacity: 1; transform: translateX(-60%) scale(1.1); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes checkPop { 0% { transform: scale(0); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .step-animate { animation: fadeUp 0.4s ease forwards; }
        .glow-btn:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(124,106,247,0.5) !important; }
        .glow-btn:active { transform: translateY(0); }
        .glow-btn { transition: all 0.2s ease !important; }
        .key-input:focus { border-color: rgba(124,106,247,0.6) !important; box-shadow: 0 0 0 3px rgba(124,106,247,0.15) !important; outline: none; }
      `}</style>
    </div>
  );
}

// ── Progress stepper ───────────────────────────────────────────────────────

function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 48 }}>
      {[1, 2].map((n, i) => {
        const done   = step > n;
        const active = step === n;
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                transition: 'all 0.4s ease',
                background: done
                  ? 'linear-gradient(135deg, #34d399, #10b981)'
                  : active
                    ? 'linear-gradient(135deg, #7c6af7, #4d9fff)'
                    : 'rgba(255,255,255,0.05)',
                border: done || active ? 'none' : '2px solid rgba(255,255,255,0.1)',
                color: done || active ? '#fff' : 'rgba(255,255,255,0.25)',
                boxShadow: done
                  ? '0 0 20px rgba(52,211,153,0.4)'
                  : active
                    ? '0 0 20px rgba(124,106,247,0.5)'
                    : 'none',
                animation: done ? 'checkPop 0.3s ease' : 'none',
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                color: done || active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                transition: 'color 0.3s',
              }}>
                {n === 1 ? 'ANTHROPIC AI' : 'TRADOVATE'}
              </span>
            </div>
            {i < 1 && (
              <div style={{
                width: 80, height: 2, margin: '0 12px', marginBottom: 26,
                background: step > 1
                  ? 'linear-gradient(90deg, #34d399, #10b981)'
                  : 'rgba(255,255,255,0.07)',
                transition: 'background 0.4s ease',
                borderRadius: 2,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Reusable field ─────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </label>
        {hint && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)',
  border: '1.5px solid rgba(255,255,255,0.1)',
  borderRadius: 12, padding: '13px 16px',
  color: 'rgba(255,255,255,0.9)', fontSize: 14,
  transition: 'all 0.2s',
  fontFamily: 'inherit',
};

const iconBtnStyle = {
  background: 'rgba(255,255,255,0.07)',
  border: '1.5px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '0 14px',
  cursor: 'pointer', fontSize: 16,
  color: 'rgba(255,255,255,0.5)',
  flexShrink: 0, transition: 'all 0.2s',
};

// ── Status banner ──────────────────────────────────────────────────────────

function StatusBanner({ result }) {
  if (!result) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', borderRadius: 12,
      marginTop: 12, marginBottom: 4,
      background: result.ok ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1.5px solid ${result.ok ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
      color: result.ok ? '#34d399' : '#f87171',
      fontSize: 13, fontWeight: 500,
      animation: 'fadeUp 0.3s ease',
    }}>
      <span style={{ fontSize: 16 }}>{result.ok ? '✅' : '❌'}</span>
      {result.ok ? 'Connected successfully!' : result.error || 'Connection failed — double-check your credentials'}
    </div>
  );
}

// ── Step 1: Anthropic ──────────────────────────────────────────────────────

function AnthropicStep({ onComplete }) {
  const [key,     setKey]     = useState('');
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);

  async function handleConnect() {
    if (!key.trim()) return;
    setLoading(true); setResult(null);
    try {
      await api.put('/settings', { anthropic_api_key: key.trim() });
      const { data } = await api.post('/settings/test-anthropic');
      setResult(data);
      if (data.ok) setTimeout(onComplete, 1000);
    } catch {
      setResult({ ok: false, error: 'Something went wrong — please try again' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="step-animate">
      {/* Icon */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', width: 72, height: 72, borderRadius: 22,
          background: 'linear-gradient(135deg, rgba(124,106,247,0.3), rgba(77,159,255,0.2))',
          border: '1.5px solid rgba(124,106,247,0.4)',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 34, marginBottom: 20,
          boxShadow: '0 0 40px rgba(124,106,247,0.25)',
        }}>
          🧠
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          Connect your AI brain
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0, maxWidth: 380, marginInline: 'auto' }}>
          TradeFlow uses Claude AI to read your TradingView indicators and automatically set up your trading logic. You need one API key — it takes 30 seconds.
        </p>
      </div>

      {/* How to get it */}
      <div style={{
        background: 'rgba(124,106,247,0.07)',
        border: '1.5px solid rgba(124,106,247,0.2)',
        borderRadius: 14, padding: '16px 20px', marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          How to get your free API key
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['1', 'Go to', 'console.anthropic.com', 'https://console.anthropic.com'],
            ['2', 'Click', '"API Keys"', null],
            ['3', 'Click', '"Create Key"', null],
            ['4', 'Copy', 'the key and paste it below', null],
          ].map(([n, pre, bold, href]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(124,106,247,0.3)', border: '1px solid rgba(124,106,247,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#a78bfa',
              }}>{n}</div>
              <span>
                {pre}{' '}
                {href
                  ? <a href={href} target="_blank" rel="noreferrer" style={{ color: '#7c6af7', fontWeight: 600, textDecoration: 'none' }}>{bold}</a>
                  : <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{bold}</strong>
                }
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <Field label="Anthropic API Key" hint="starts with sk-ant-api03-…">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="key-input"
            type={show ? 'text' : 'password'}
            value={key}
            onChange={e => { setKey(e.target.value); setResult(null); }}
            placeholder="Paste your key here…"
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13, flex: 1 }}
            autoFocus
            autoComplete="off"
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
          />
          <button type="button" onClick={() => setShow(v => !v)} style={iconBtnStyle}>
            {show ? '🙈' : '👁'}
          </button>
        </div>
      </Field>

      <StatusBanner result={result} />

      <button
        onClick={handleConnect}
        disabled={!key.trim() || loading || result?.ok}
        className="glow-btn"
        style={{
          width: '100%', marginTop: 20,
          background: 'linear-gradient(135deg, #7c6af7 0%, #4d9fff 100%)',
          border: 'none', borderRadius: 14, padding: '16px',
          color: '#fff', fontSize: 15, fontWeight: 700,
          cursor: !key.trim() || loading || result?.ok ? 'not-allowed' : 'pointer',
          opacity: !key.trim() || loading || result?.ok ? 0.5 : 1,
          boxShadow: '0 4px 24px rgba(124,106,247,0.4)',
          letterSpacing: '0.01em',
        }}
      >
        {loading ? '⏳  Testing connection…' : result?.ok ? '✓  Connected!' : '⚡  Connect & Test'}
      </button>
    </div>
  );
}

// ── Step 2: Tradovate ──────────────────────────────────────────────────────

function TradovateStep({ onComplete }) {
  const [form, setForm] = useState({
    tradovate_username: '', tradovate_password: '',
    tradovate_cid: '', tradovate_secret: '',
    tradovate_app_id: 'TradeFlow', tradovate_mode: 'demo',
    broker_mode: 'tradovate',
  });
  const [showPw,   setShowPw]   = useState(false);
  const [showSec,  setShowSec]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setResult(null); }

  async function handleConnect() {
    setLoading(true); setResult(null);
    try {
      await api.put('/settings', form);
      const { data } = await api.post('/settings/test-tradovate');
      setResult(data);
      if (data.ok) setTimeout(onComplete, 1000);
    } catch {
      setResult({ ok: false, error: 'Something went wrong — please try again' });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = form.tradovate_username && form.tradovate_password && !loading && !result?.ok;

  return (
    <div className="step-animate">
      {/* Icon */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', width: 72, height: 72, borderRadius: 22,
          background: 'linear-gradient(135deg, rgba(52,211,153,0.25), rgba(77,159,255,0.15))',
          border: '1.5px solid rgba(52,211,153,0.3)',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 34, marginBottom: 20,
          boxShadow: '0 0 40px rgba(52,211,153,0.2)',
        }}>
          📡
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          Connect your trading account
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0, maxWidth: 380, marginInline: 'auto' }}>
          This is where your trades actually execute. Start with <strong style={{ color: '#34d399' }}>Demo mode</strong> — it's free and uses fake money so you can test safely.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24,
        background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4,
      }}>
        {[
          { v: 'demo', label: '🧪  Demo', sub: 'Fake money — safe to test', color: '#34d399' },
          { v: 'live', label: '💰  Live',  sub: 'Real money — be careful!',  color: '#f87171' },
        ].map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => set('tradovate_mode', opt.v)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
              cursor: 'pointer', transition: 'all 0.2s',
              background: form.tradovate_mode === opt.v ? 'rgba(255,255,255,0.08)' : 'transparent',
              boxShadow: form.tradovate_mode === opt.v ? '0 2px 12px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: form.tradovate_mode === opt.v ? opt.color : 'rgba(255,255,255,0.3)', marginBottom: 2 }}>
              {opt.label}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{opt.sub}</div>
          </button>
        ))}
      </div>

      {form.tradovate_mode === 'live' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)',
          borderRadius: 12, marginBottom: 20, fontSize: 13, color: '#fca5a5',
          animation: 'fadeUp 0.3s ease',
        }}>
          ⚠️ <span>Live mode places <strong>real orders with real money</strong>. Only use this after testing on Demo.</span>
        </div>
      )}

      {/* Credentials grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 4 }}>
        <Field label="Username" hint="required">
          <input
            className="key-input"
            type="text"
            value={form.tradovate_username}
            onChange={e => set('tradovate_username', e.target.value)}
            placeholder="Your Tradovate username"
            style={inputStyle}
            autoComplete="off"
          />
        </Field>

        <Field label="Password" hint="required">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="key-input"
              type={showPw ? 'text' : 'password'}
              value={form.tradovate_password}
              onChange={e => set('tradovate_password', e.target.value)}
              placeholder="Your password"
              style={{ ...inputStyle, flex: 1 }}
              autoComplete="off"
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={iconBtnStyle}>{showPw ? '🙈' : '👁'}</button>
          </div>
        </Field>
      </div>

      {/* Advanced — collapsible */}
      <details style={{ marginBottom: 4 }}>
        <summary style={{
          fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
          cursor: 'pointer', padding: '8px 0', userSelect: 'none',
          listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 10 }}>▶</span>
          Advanced — App CID &amp; Secret (optional for most users)
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
          <Field label="App CID" hint="developer portal">
            <input className="key-input" type="text" value={form.tradovate_cid} onChange={e => set('tradovate_cid', e.target.value)} placeholder="e.g. 12345" style={{ ...inputStyle, fontFamily: 'monospace' }} />
          </Field>
          <Field label="App Secret" hint="developer portal">
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="key-input" type={showSec ? 'text' : 'password'} value={form.tradovate_secret} onChange={e => set('tradovate_secret', e.target.value)} placeholder="Your app secret" style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 12 }} autoComplete="off" />
              <button type="button" onClick={() => setShowSec(v => !v)} style={iconBtnStyle}>{showSec ? '🙈' : '👁'}</button>
            </div>
          </Field>
        </div>
      </details>

      <StatusBanner result={result} />

      <button
        onClick={handleConnect}
        disabled={!canSubmit}
        className="glow-btn"
        style={{
          width: '100%', marginTop: 20,
          background: canSubmit
            ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
            : 'rgba(255,255,255,0.07)',
          border: 'none', borderRadius: 14, padding: '16px',
          color: canSubmit ? '#fff' : 'rgba(255,255,255,0.3)',
          fontSize: 15, fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          boxShadow: canSubmit ? '0 4px 24px rgba(52,211,153,0.35)' : 'none',
          letterSpacing: '0.01em',
        }}
      >
        {loading ? '⏳  Testing connection…' : result?.ok ? '✓  Connected!' : '🚀  Connect & Test'}
      </button>
    </div>
  );
}

// ── Complete celebration ───────────────────────────────────────────────────

function CompleteScreen({ onEnter }) {
  useEffect(() => {
    const t = setTimeout(onEnter, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="step-animate" style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{
        fontSize: 72, marginBottom: 24,
        filter: 'drop-shadow(0 0 30px rgba(52,211,153,0.6))',
        animation: 'checkPop 0.5s ease',
      }}>
        🎉
      </div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
        You're all set!
      </h2>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
        Both connections verified. Taking you to your dashboard…
      </p>
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#34d399',
            opacity: 0.4,
            animation: `orbPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1); // 1 | 2 | 'done'

  return (
    <>
      <OrbBg />
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(12px)',
        zIndex: 100,
      }}>
        <div style={{
          background: 'rgba(10,10,16,0.97)',
          border: '1.5px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: '44px 44px 40px',
          width: '100%',
          maxWidth: 520,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
          animation: 'scaleIn 0.35s ease',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 36 }}>
            <RobotLogo size={36} borderRadius={11} fontSize={17} glowSize={24} />
            <span style={{
              fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.5))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              TradeFlow
            </span>
          </div>

          {step !== 'done' && <Stepper step={step} />}

          {step === 1    && <AnthropicStep onComplete={() => setStep(2)} />}
          {step === 2    && <TradovateStep onComplete={() => setStep('done')} />}
          {step === 'done' && <CompleteScreen onEnter={onComplete} />}
        </div>
      </div>
    </>
  );
}
