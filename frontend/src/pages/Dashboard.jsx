import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAlgos, createAlgo, connectWS, getSettings, stopAllAlgos, duplicateAlgo, getRecentSignals } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AlgoCard from '../components/AlgoCard';
import AnimatedNumber from '../components/AnimatedNumber';
import RobotLogo from '../components/RobotLogo';

const TEMPLATES = [
  {
    key: 'scalper',
    icon: '⚡',
    name: 'Scalper',
    desc: 'Lightning-fast entries. Tight 6-tick target, 4-tick stop. High frequency, small wins.',
    tags: ['market entry', '6-tick TP', '4-tick SL'],
    color: '#4d9fff',
  },
  {
    key: 'trend',
    icon: '📈',
    name: 'Trend Follower',
    desc: 'Ride big moves. 40-tick target, trailing 15-tick stop. Breakeven protection built in.',
    tags: ['trailing stop', '40-tick TP', 'breakeven'],
    color: '#34d399',
  },
  {
    key: 'breakout',
    icon: '🚀',
    name: 'Breakout',
    desc: 'Capitalize on momentum. 25-tick target, fixed 12-tick stop. Clean and simple.',
    tags: ['market entry', '25-tick TP', '12-tick SL'],
    color: '#a78bfa',
  },
  {
    key: 'reversal',
    icon: '🔄',
    name: 'Reversal',
    desc: 'Counter-trend entries. Limit order fill, 15-tick TP, breakeven at 7 ticks.',
    tags: ['limit entry', '15-tick TP', 'breakeven'],
    color: '#f59e0b',
  },
  {
    key: null,
    icon: '✏️',
    name: 'Custom',
    desc: 'Start with a blank slate and configure every setting yourself.',
    tags: ['manual setup'],
    color: 'var(--text-muted)',
  },
];

export default function Dashboard() {
  const [algos, setAlgos]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [newName, setNewName]           = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [selectedTemplate, setTemplate] = useState(null); // null = not chosen yet
  const [templateStep, setTemplateStep] = useState('pick'); // 'pick' | 'name'
  const [signals, setSignals]           = useState({});
  const [clock, setClock]               = useState(new Date());
  const [banners, setBanners]           = useState({ anthropic: false, tradovate: false });
  const [dismissedBanners, setDismissedBanners] = useState(new Set());
  const [stopping, setStopping]         = useState(false);
  const [stopConfirm, setStopConfirm]   = useState(false);
  const [stopError, setStopError]       = useState(null);
  const [ticker, setTicker]             = useState([]);
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await getAlgos();
      setAlgos(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSettings().then(s => {
      setBanners({
        anthropic: !s.anthropic_api_key,
        tradovate:  s.broker_mode === 'tradovate' && !s.tradovate_username,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getRecentSignals().then(rows => setTicker(rows.slice(0, 20))).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const cleanup = connectWS((msg) => {
      if (msg.type === 'signal') {
        setSignals(prev => ({ ...prev, [msg.algoId]: { action: msg.action, ts: Date.now() } }));
        // Prepend to ticker
        setTicker(prev => [{
          id: Date.now(),
          algo_name: msg.algoName || '—',
          action: msg.action,
          symbol: msg.symbol,
          pnl: msg.pnl,
          status: msg.status,
        }, ...prev].slice(0, 20));
        load();
      }
    });
    return cleanup;
  }, [load]);

  function updateAlgo(updated) {
    setAlgos(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
  }

  function removeAlgo(id) {
    setAlgos(prev => prev.filter(a => a.id !== id));
  }

  async function handleDuplicate(id) {
    try {
      const clone = await duplicateAlgo(id);
      setAlgos(prev => [...prev, { ...clone, trades_today: 0, last_signal_at: null }]);
    } catch (err) {
      console.error('Duplicate failed', err);
    }
  }

  function openCreate() {
    setNewName('');
    setTemplate(undefined); // undefined = not yet chosen (show picker)
    setTemplateStep('pick');
    setShowCreate(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const payload = { name: newName.trim() };
      if (selectedTemplate !== null) payload.template = selectedTemplate;
      const algo = await createAlgo(payload);
      setAlgos(prev => [...prev, { ...algo, trades_today: 0, last_signal_at: null }]);
      setNewName('');
      setShowCreate(false);
      navigate(`/algo/${algo.id}`, { state: { tab: 'wizard' } });
    } finally {
      setCreating(false);
    }
  }

  async function handleStopAll() {
    setStopping(true);
    setStopError(null);
    try {
      await stopAllAlgos();
      setAlgos(prev => prev.map(a => ({ ...a, is_active: false })));
      setStopConfirm(false);
      await load();
    } catch (err) {
      setStopError(err?.response?.data?.error || 'Request failed — check your connection and try again.');
    } finally {
      setStopping(false);
    }
  }

  const totalPnl    = algos.reduce((s, a) => s + parseFloat(a.daily_pnl || 0), 0);
  const totalTrades = algos.reduce((s, a) => s + parseInt(a.trades_today || 0, 10), 0);
  const liveCount   = algos.filter(a => a.is_active && !a.kill_switch_triggered_at).length;

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Emergency Stop confirm overlay */}
      {stopConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(20,10,10,0.95)', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 20, padding: '40px 48px', textAlign: 'center', maxWidth: 400,
            boxShadow: '0 0 60px rgba(239,68,68,0.2)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛑</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
              Emergency Stop
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
              This will immediately deactivate <strong style={{ color: 'var(--text-main)' }}>all {liveCount} running algo{liveCount !== 1 ? 's' : ''}</strong>. No new signals will be processed.
            </div>
            {stopError && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#ef4444' }}>
                {stopError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={handleStopAll}
                disabled={stopping}
                style={{
                  padding: '12px 28px', borderRadius: 10, border: 'none', cursor: stopping ? 'default' : 'pointer',
                  background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14,
                  opacity: stopping ? 0.7 : 1,
                }}
              >
                {stopping ? 'Stopping…' : 'Stop All Algos'}
              </button>
              <button
                onClick={() => { setStopConfirm(false); setStopError(null); }}
                style={{
                  padding: '12px 24px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template + Name modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'rgba(12,12,18,0.97)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24, padding: '24px 24px', width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          }}>
            {templateStep === 'pick' ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                    Choose a template
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Pre-configured order settings — adjust any time
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {TEMPLATES.map(t => (
                    <button
                      key={t.key ?? 'custom'}
                      onClick={() => { setTemplate(t.key); setTemplateStep('name'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 0.15s', width: '100%',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = `${t.color}12`;
                        e.currentTarget.style.borderColor = `${t.color}40`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{t.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{t.name}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {t.tags.map(tag => (
                              <span key={tag} style={{
                                fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                                background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}30`,
                              }}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.desc}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }}>›</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowCreate(false)}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                    background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: 24 }}>
                  <button
                    type="button"
                    onClick={() => setTemplateStep('pick')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 16 }}
                  >
                    ← Back
                  </button>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
                    Name your algo
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {selectedTemplate
                      ? `Using the ${TEMPLATES.find(t => t.key === selectedTemplate)?.name} template`
                      : 'Custom configuration — you\'ll set up order settings next'}
                  </div>
                </div>

                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. MNQ Scalper, ES Trend, NQ Breakout"
                  className="tf-input"
                  style={{ width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="btn btn-primary"
                    style={{ flex: 1, opacity: creating ? 0.6 : 1 }}
                  >
                    {creating ? 'Creating…' : 'Create Algo →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    style={{
                      padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                      background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark />
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em' }}>
            TradeFlow
          </span>
        </div>
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="nav-date" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {clock.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          <span className="nav-clock mono" style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

          {/* Emergency Stop — always visible, disabled when nothing is live */}
          {algos.length > 0 && (
            <button
              onClick={() => { setStopError(null); setStopConfirm(true); }}
              disabled={liveCount === 0}
              className="nav-stop-btn"
            style={{
                padding: '5px 14px', borderRadius: 8, fontWeight: 700,
                fontSize: 12, letterSpacing: '0.03em', transition: 'all 0.15s',
                cursor: liveCount === 0 ? 'default' : 'pointer',
                border: liveCount > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                background: liveCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                color: liveCount > 0 ? '#ef4444' : 'var(--text-dim)',
                opacity: liveCount === 0 ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (liveCount > 0) e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
              onMouseLeave={e => { if (liveCount > 0) e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              title={liveCount > 0 ? 'Stop all running algos immediately' : 'No active algos'}
            >
              🛑 STOP ALL
            </button>
          )}

          {user && (
            <Link
              to="/billing"
              style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                background: user.subscription_status === 'active'
                  ? 'rgba(52,211,153,0.12)' : 'rgba(124,106,247,0.15)',
                border: user.subscription_status === 'active'
                  ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(124,106,247,0.3)',
                color: user.subscription_status === 'active' ? '#34d399' : '#a78bfa',
                textDecoration: 'none',
              }}
            >
              {user.subscription_status === 'active' ? 'Pro' : 'Trial'}
            </Link>
          )}
          <button
            onClick={toggleTheme}
            className="nav-icon-btn"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/settings" className="nav-icon-btn" title="Settings">⚙</Link>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="nav-icon-btn"
            style={{ border: 'none' }}
            title="Sign out"
          >
            ↩
          </button>
        </div>
      </nav>

      {/* Live Trade Ticker */}
      {ticker.length > 0 && <TickerTape items={ticker} />}

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '36px 24px' }}>

        {/* Setup banners */}
        {banners.anthropic && !dismissedBanners.has('anthropic') && (
          <SetupBanner
            message="Add your Anthropic API key to enable the indicator wizard."
            onDismiss={() => setDismissedBanners(s => new Set([...s, 'anthropic']))}
          />
        )}
        {banners.tradovate && !dismissedBanners.has('tradovate') && (
          <SetupBanner
            message="Tradovate mode is active but credentials are missing — orders will fail."
            color="var(--red)"
            onDismiss={() => setDismissedBanners(s => new Set([...s, 'tradovate']))}
          />
        )}

        {/* Summary bar */}
        <div className="summary-grid">
          <SummaryCard
            label="Today's P&L"
            sublabel="Across all algos"
            color={totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
          >
            <AnimatedNumber
              value={totalPnl}
              format={v => `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`}
              className="mono tabular"
              style={{ fontSize: 36, fontWeight: 800, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}
            />
          </SummaryCard>

          <SummaryCard label="Trades today" sublabel="Filled orders" color="var(--blue)">
            <AnimatedNumber
              value={totalTrades}
              format={v => Math.round(v)}
              className="mono tabular"
              style={{ fontSize: 36, fontWeight: 800, color: 'var(--blue)' }}
            />
          </SummaryCard>

          <SummaryCard label="Algos live" sublabel="Currently running" color="var(--purple)">
            <span className="mono tabular" style={{ fontSize: 36, fontWeight: 800, color: 'var(--purple)' }}>
              {liveCount}
            </span>
          </SummaryCard>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
              Your Algos
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Each algo has its own signal URL — paste it into any TradingView alert
            </p>
          </div>
          <button
            onClick={openCreate}
            className="btn btn-primary"
          >
            + New Algo
          </button>
        </div>

        {/* Algo grid */}
        {loading ? (
          <LoadingGrid />
        ) : algos.length === 0 ? (
          <EmptyState onNew={openCreate} />
        ) : (
          <div className="algo-grid">
            {algos.map(algo => (
              <AlgoCard
                key={algo.id}
                algo={algo}
                onUpdate={updateAlgo}
                onDelete={removeAlgo}
                onDuplicate={handleDuplicate}
                flashSignal={signals[algo.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LogoMark() {
  return <RobotLogo />;
}

function SummaryCard({ label, sublabel, color, children }) {
  return (
    <div className="glass" style={{ borderRadius: 16, padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 24, right: 24, height: 1,
        background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
      }} />
      <div className="label" style={{ marginBottom: 10 }}>{label}</div>
      {children}
      {sublabel && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{sublabel}</div>
      )}
    </div>
  );
}

function EmptyState({ onNew }) {
  const steps = [
    { n: '1', label: 'Create an algo', sub: 'Name it, pick a template' },
    { n: '2', label: 'Connect TradingView', sub: 'Paste your webhook URL' },
    { n: '3', label: 'Go live', sub: 'Signals execute automatically' },
  ];
  return (
    <div className="glass" style={{ textAlign: 'center', padding: '72px 32px', borderRadius: 20 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
        background: 'linear-gradient(135deg, var(--blue), var(--purple))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, boxShadow: '0 0 24px rgba(77,159,255,0.3)',
      }}>⚡</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
        Your algos live here
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 40, maxWidth: 340, margin: '0 auto 40px' }}>
        Connect any TradingView indicator to automated trade execution in three steps.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40, flexWrap: 'wrap' }}>
        {steps.map((step, i) => (
          <div key={step.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: '0 16px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, margin: '0 auto 8px',
                background: 'rgba(77,159,255,0.12)', border: '1px solid rgba(77,159,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'var(--blue)',
              }}>{step.n}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 3 }}>{step.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{step.sub}</div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 16, padding: '0 4px', marginBottom: 20 }}>→</div>
            )}
          </div>
        ))}
      </div>

      <button onClick={onNew} className="btn btn-primary" style={{ fontSize: 14, padding: '11px 28px' }}>
        Create your first algo →
      </button>
    </div>
  );
}

function SetupBanner({ message, color = 'var(--blue)', onDismiss }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', marginBottom: 16, borderRadius: 10,
      background: `${color}12`, border: `1px solid ${color}30`,
    }}>
      <span style={{ fontSize: 13, color }}>
        ⚠ {message}
      </span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Link to="/settings" style={{ fontSize: 12, color, fontWeight: 600, textDecoration: 'none' }}>
          Go to Settings →
        </Link>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
        >×</button>
      </div>
    </div>
  );
}

function TickerTape({ items }) {
  // Duplicate items so the scroll loops seamlessly
  const doubled = [...items, ...items];
  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)',
      overflow: 'hidden', position: 'relative',
      height: 32,
    }}>
      {/* Fade edges */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, zIndex: 2, background: 'linear-gradient(90deg, var(--bg, #08080f), transparent)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, zIndex: 2, background: 'linear-gradient(270deg, var(--bg, #08080f), transparent)', pointerEvents: 'none' }} />

      <div style={{
        display: 'flex', alignItems: 'center', height: '100%',
        animation: `ticker-scroll ${Math.max(items.length * 4, 20)}s linear infinite`,
        width: 'max-content',
      }}>
        {doubled.map((item, i) => {
          const pnl = parseFloat(item.pnl || 0);
          const pnlColor = pnl > 0 ? '#34d399' : pnl < 0 ? '#ef4444' : 'var(--text-dim)';
          const actionColor = item.action === 'buy' ? '#34d399' : '#ef4444';
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 24px', whiteSpace: 'nowrap', fontSize: 11 }}>
              <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{item.algo_name || '—'}</span>
              <span style={{ color: actionColor, fontWeight: 700 }}>{(item.action || 'BUY').toUpperCase()}</span>
              {item.symbol && <span style={{ color: 'var(--text-muted)' }}>{item.symbol}</span>}
              {item.status === 'executed' && (
                <span style={{ color: pnlColor, fontWeight: 600, fontFamily: 'monospace' }}>
                  {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                </span>
              )}
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 14, marginLeft: 4 }}>·</span>
            </span>
          );
        })}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="algo-grid">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton" style={{ height: 220 }} />
      ))}
    </div>
  );
}
