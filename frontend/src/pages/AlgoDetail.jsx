import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getAlgo, updateAlgo, deleteAlgo, resetKillSwitch,
  getOrderSets, createOrderSet, updateOrderSet, deleteOrderSet,
  getSignals, connectWS, getPublicUrl, sendTestSignal,
} from '../api';
import OrderSetForm from '../components/OrderSetForm';
import SignalLog from '../components/SignalLog';
import AnimatedNumber from '../components/AnimatedNumber';
import Tooltip from '../components/Tooltip';
import IndicatorWizard from '../components/wizard/IndicatorWizard';
import RobotLogo from '../components/RobotLogo';
import PerformanceTab from '../components/PerformanceTab';

export default function AlgoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [algo, setAlgo] = useState(null);
  const [orderSets, setOrderSets] = useState([]);
  const [signals, setSignals] = useState([]);
  const [newSignalIds, setNewSignalIds] = useState([]);
  const [tab, setTab] = useState(location.state?.tab || 'signals');
  const [addingOrderSet, setAddingOrderSet] = useState(false);
  const [savingOrderSet, setSavingOrderSet] = useState(false);
  const [editingOrderSetId, setEditingOrderSetId] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [publicBase, setPublicBase] = useState(null);
  const [editAlgo, setEditAlgo] = useState(false);
  const [algoForm, setAlgoForm] = useState({});
  const [savingAlgo, setSavingAlgo] = useState(false);
  const prevSignalCount = useRef(0);

  const loadAll = useCallback(async () => {
    const [a, os, s] = await Promise.all([getAlgo(id), getOrderSets(id), getSignals(id)]);
    setAlgo(a);
    setOrderSets(os);
    setSignals(prev => {
      // Detect new signals and animate them
      if (s.length > prevSignalCount.current) {
        const newIds = s.slice(0, s.length - prevSignalCount.current).map(x => x.id);
        setNewSignalIds(newIds);
        setTimeout(() => setNewSignalIds([]), 2000);
      }
      prevSignalCount.current = s.length;
      return s;
    });
    setAlgoForm({
      name: a.name,
      kill_switch_amount: a.kill_switch_amount,
      kill_switch_pause: a.kill_switch_pause,
      schedule_enabled: a.schedule_enabled || false,
      schedule_start: a.schedule_start || '09:30',
      schedule_end: a.schedule_end || '16:00',
      schedule_days: a.schedule_days || ['Mon','Tue','Wed','Thu','Fri'],
    });
  }, [id]);

  useEffect(() => {
    loadAll();
    getPublicUrl().then(url => { if (url) setPublicBase(url); }).catch(() => {});
    const cleanup = connectWS((msg) => {
      if (msg.algoId == id && msg.type === 'signal') {
        loadAll();
      }
    });
    return cleanup;
  }, [id, loadAll]);

  async function handleSaveOrderSet(form) {
    setSavingOrderSet(true);
    try {
      if (editingOrderSetId) {
        const updated = await updateOrderSet(id, editingOrderSetId, form);
        setOrderSets(prev => prev.map(os => os.id === editingOrderSetId ? updated : os));
        setEditingOrderSetId(null);
      } else {
        const created = await createOrderSet(id, form);
        setOrderSets(prev => [...prev, created]);
        setAddingOrderSet(false);
      }
    } finally {
      setSavingOrderSet(false);
    }
  }

  async function handleToggleOrderSet(os) {
    const updated = await updateOrderSet(id, os.id, { is_active: !os.is_active });
    setOrderSets(prev => prev.map(o => o.id === os.id ? updated : o));
  }

  async function handleDeleteOrderSet(osId) {
    if (!confirm('Delete this order set?')) return;
    await deleteOrderSet(id, osId);
    setOrderSets(prev => prev.filter(o => o.id !== osId));
  }

  async function handleSaveAlgo() {
    setSavingAlgo(true);
    try {
      const updated = await updateAlgo(id, algoForm);
      setAlgo(prev => ({ ...prev, ...updated }));
      setEditAlgo(false);
    } finally {
      setSavingAlgo(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete algo "${algo.name}"? This cannot be undone.`)) return;
    await deleteAlgo(id);
    navigate('/');
  }

  async function handleResetKS() {
    const updated = await resetKillSwitch(id);
    setAlgo(prev => ({ ...prev, ...updated }));
  }

  function copyWebhookUrl() {
    const url = `http://localhost:3001/webhook/${algo.webhook_id}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  if (!algo) return <Loading />;

  const webhookBase = (publicBase || 'http://localhost:3001').replace(/\/$/, '');
  const webhookUrl = `${webhookBase}/webhook/${algo.webhook_id}`;
  const pnl = parseFloat(algo.daily_pnl || 0);
  const isKillActive = !!algo.kill_switch_triggered_at;
  const isLive = algo.is_active && !isKillActive;

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }} className="page-enter">
      {/* Nav */}
      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 18, padding: '4px 10px' }}
          >
            ←
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotLogo size={28} borderRadius={8} fontSize={14} glowSize={12} />
            <span className="gradient-text" style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>
              TradeFlow
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isKillActive && (
            <button onClick={handleResetKS} className="btn btn-danger btn-sm">
              Reset kill switch
            </button>
          )}
          <StatusBadge algo={algo} />
        </div>
      </nav>

      <div className="page-content">

        {/* Kill switch warning */}
        {isKillActive && (
          <div style={{
            background: 'rgba(255,59,92,0.07)', border: '1px solid rgba(255,59,92,0.3)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 20 }}>🛑</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>
                Auto-stop triggered — daily loss limit hit
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                New signals are blocked to prevent further losses.
                {algo.kill_switch_pause === 'manual' ? ' Manual reset required.' : ' Will resume automatically.'}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="algo-header rise-1">
          <div>
            {editAlgo ? (
              <input
                autoFocus
                value={algoForm.name}
                onChange={e => setAlgoForm(f => ({ ...f, name: e.target.value }))}
                className="tf-input"
                style={{ fontSize: 26, fontWeight: 700, width: 280 }}
              />
            ) : (
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
                {algo.name}
              </h1>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Created {new Date(algo.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              {algo.schedule_enabled && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: 'rgba(77,159,255,0.12)', border: '1px solid rgba(77,159,255,0.3)',
                  color: 'var(--blue)', letterSpacing: '0.04em',
                }}>
                  🕐 {algo.schedule_start}–{algo.schedule_end} ET
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {editAlgo ? (
              <>
                <button onClick={handleSaveAlgo} disabled={savingAlgo} className="btn btn-primary btn-sm">
                  {savingAlgo ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditAlgo(false)} className="btn btn-ghost btn-sm">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditAlgo(true)} className="btn btn-ghost btn-sm">Edit</button>
                <button onClick={handleDelete} className="btn btn-danger btn-sm">Delete</button>
              </>
            )}
          </div>
        </div>

        {/* Stats + webhook row */}
        <div className="stats-grid rise-2">

          <div className="glass" style={{ borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: `linear-gradient(90deg, transparent, ${pnl >= 0 ? 'rgba(0,230,118,0.5)' : 'rgba(255,77,106,0.5)'}, transparent)` }} />
            <div className="label" style={{ marginBottom: 8 }}>Today's P&L</div>
            <AnimatedNumber
              value={pnl}
              format={v => `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`}
              className="mono tabular"
              style={{ fontSize: 26, fontWeight: 800, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
            />
          </div>

          <div className="glass" style={{ borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: 'linear-gradient(90deg, transparent, rgba(77,159,255,0.5), transparent)' }} />
            <div className="label" style={{ marginBottom: 8 }}>Trades today</div>
            <span className="mono tabular" style={{ fontSize: 26, fontWeight: 800, color: 'var(--blue)' }}>
              {algo.trades_today || 0}
            </span>
          </div>

          <div className="glass" style={{ borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,77,106,0.5), transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <span className="label">Auto-stop at</span>
              <Tooltip text="Trading stops automatically if you lose more than this amount in a day" />
            </div>
            {editAlgo ? (
              <input
                type="number"
                value={algoForm.kill_switch_amount}
                onChange={e => setAlgoForm(f => ({ ...f, kill_switch_amount: parseFloat(e.target.value) || 0 }))}
                className="tf-input"
                style={{ fontSize: 15, width: '100%' }}
              />
            ) : (
              <span className="mono tabular" style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)' }}>
                -${parseFloat(algo.kill_switch_amount).toFixed(0)}
              </span>
            )}
          </div>

          {/* Webhook card */}
          <div className="glass" style={{ borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
              <span className="label">Your signal URL</span>
              <Tooltip text={'Paste this into TradingView → Alert → Webhook URL. Set the alert message to: {"symbol":"{{ticker}}","action":"buy"}'} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code className="mono" style={{
                flex: 1, fontSize: 11, color: 'var(--blue)',
                background: 'rgba(77,159,255,0.07)', border: '1px solid rgba(77,159,255,0.2)',
                padding: '8px 10px', borderRadius: 7,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
              }}>
                {webhookUrl}
              </code>
              <button
                onClick={copyWebhookUrl}
                className="btn btn-sm btn-ghost"
                style={{
                  whiteSpace: 'nowrap', transition: 'all 0.2s',
                  ...(copiedUrl ? {
                    background: 'rgba(0,230,118,0.12)',
                    borderColor: 'rgba(0,230,118,0.35)',
                    color: 'var(--green)',
                  } : {}),
                }}
              >
                {copiedUrl ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
              → Paste this into TradingView → Alert → Webhook URL
            </div>
          </div>
        </div>

        {/* Pause duration + Schedule when editing */}
        {editAlgo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <div className="glass" style={{ borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>
                After auto-stop triggers, pause trading for:
              </div>
              <select
                value={algoForm.kill_switch_pause}
                onChange={e => setAlgoForm(f => ({ ...f, kill_switch_pause: e.target.value }))}
                className="tf-input"
                style={{ maxWidth: 260 }}
              >
                <option value="1h">1 hour</option>
                <option value="2h">2 hours</option>
                <option value="4h">4 hours</option>
                <option value="rest_of_day">Rest of day</option>
                <option value="manual">Manual reset only</option>
              </select>
            </div>
            <ScheduleBuilder
              form={algoForm}
              set={(field, val) => setAlgoForm(f => ({ ...f, [field]: val }))}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="tab-bar rise-3" style={{ marginBottom: 20 }}>
          <button
            className={`tab ${tab === 'signals' ? 'active' : ''}`}
            onClick={() => setTab('signals')}
          >
            Signal Log <span style={{ fontSize: 11, opacity: 0.7 }}>({signals.length})</span>
          </button>
          <button
            className={`tab ${tab === 'order-sets' ? 'active' : ''}`}
            onClick={() => setTab('order-sets')}
          >
            Order Sets <span style={{ fontSize: 11, opacity: 0.7 }}>({orderSets.length})</span>
          </button>
          <button
            className={`tab ${tab === 'wizard' ? 'active' : ''}`}
            onClick={() => setTab('wizard')}
          >
            Setup Indicator
          </button>
          <button
            className={`tab ${tab === 'performance' ? 'active' : ''}`}
            onClick={() => setTab('performance')}
          >
            Performance
          </button>
          <button
            className={`tab ${tab === 'test' ? 'active' : ''}`}
            onClick={() => setTab('test')}
          >
            Test Signal
          </button>
        </div>

        {/* Signal log */}
        {tab === 'signals' && (
          <div className="glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
            <SignalLog signals={signals} newIds={newSignalIds} />
          </div>
        )}

        {/* Indicator wizard */}
        {tab === 'wizard' && (
          <IndicatorWizard algoId={id} webhookUrl={webhookUrl} />
        )}

        {/* Performance analytics */}
        {tab === 'performance' && (
          <PerformanceTab algoId={id} />
        )}

        {/* Webhook tester */}
        {tab === 'test' && (
          <WebhookTester algoId={id} webhookUrl={webhookUrl} />
        )}

        {/* Order sets */}
        {tab === 'order-sets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {orderSets.map(os => (
              <div key={os.id}>
                {editingOrderSetId === os.id ? (
                  <OrderSetForm
                    initial={os}
                    onSave={handleSaveOrderSet}
                    onCancel={() => setEditingOrderSetId(null)}
                    saving={savingOrderSet}
                  />
                ) : (
                  <OrderSetCard
                    os={os}
                    onToggle={() => handleToggleOrderSet(os)}
                    onEdit={() => setEditingOrderSetId(os.id)}
                    onDelete={() => handleDeleteOrderSet(os.id)}
                  />
                )}
              </div>
            ))}

            {addingOrderSet ? (
              <OrderSetForm
                onSave={handleSaveOrderSet}
                onCancel={() => setAddingOrderSet(false)}
                saving={savingOrderSet}
              />
            ) : (
              <button
                onClick={() => setAddingOrderSet(true)}
                style={{
                  padding: '14px', borderRadius: 12,
                  border: '1px dashed rgba(255,255,255,0.12)', background: 'transparent',
                  color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.color = 'var(--blue)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.color = 'var(--text-dim)'; }}
              >
                + Add order set — what should happen when a signal fires
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function OrderSetCard({ os, onToggle, onEdit, onDelete }) {
  const entryLabels = {
    market:       'Market order',
    limit_signal: 'Limit (signal price)',
    limit_offset: `Limit (${os.limit_offset_ticks}t better)`,
  };

  return (
    <div className={`glass ${os.is_active ? '' : ''}`} style={{
      borderRadius: 12, padding: '16px 20px',
      opacity: os.is_active ? 1 : 0.45,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={onToggle} className="toggle" data-on={os.is_active ? 'true' : undefined} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-main)' }}>{os.name}</span>
          {!os.is_active && <span className="label">Disabled</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onEdit} className="btn btn-ghost btn-xs">Edit</button>
          <button onClick={onDelete} className="btn btn-danger btn-xs">Delete</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span className="chip">{os.contracts} contract{os.contracts !== 1 ? 's' : ''}</span>
        <span className="chip">{entryLabels[os.entry_type] || os.entry_type}</span>
        <span className="chip" style={{ color: 'var(--green)', borderColor: 'rgba(0,230,118,0.25)' }}>
          TP: {os.profit_target_ticks}t
        </span>
        <span className="chip" style={{ color: 'var(--red)', borderColor: 'rgba(255,59,92,0.25)' }}>
          {os.stop_type === 'trailing' ? 'Trail' : 'SL'}: {os.stop_ticks}t
        </span>
        {os.breakeven_enabled && (
          <span className="chip" style={{ color: 'var(--yellow)', borderColor: 'rgba(255,200,80,0.25)' }}>
            BE: {os.breakeven_ticks}t
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ algo }) {
  const isKill = !!algo.kill_switch_triggered_at;
  const isPaused = !algo.is_active;
  const status = isKill ? 'kill' : isPaused ? 'paused' : 'live';
  const label = isKill ? 'Kill switch' : isPaused ? 'Paused' : 'Live';
  const color = isKill ? 'var(--red)' : isPaused ? 'var(--yellow)' : 'var(--green)';
  const dotClass = isKill ? 'status-dot pulse-red-dot' : isPaused ? 'status-dot status-dot-paused' : 'status-dot pulse-green-dot';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '6px 12px', borderRadius: 20,
      background: color + '14', border: `1px solid ${color}40`,
    }}>
      <span className={dotClass} />
      <span style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function ScheduleBuilder({ form, set }) {
  function toggleDay(day) {
    const days = form.schedule_days || [];
    set('schedule_days', days.includes(day) ? days.filter(d => d !== day) : [...days, day]);
  }

  const activeDays = form.schedule_days || [];

  return (
    <div className="glass" style={{ borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>Trading Schedule</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {form.schedule_enabled
              ? 'Signals blocked outside the hours you set below'
              : 'All hours allowed — enable to restrict when signals fire'}
          </div>
        </div>
        <div
          onClick={() => set('schedule_enabled', !form.schedule_enabled)}
          className="toggle"
          data-on={form.schedule_enabled ? 'true' : undefined}
          style={{ flexShrink: 0 }}
        />
      </div>

      {form.schedule_enabled && (
        <>
          {/* Day picker */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Active days
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WEEKDAYS.map(day => {
                const on = activeDays.includes(day);
                const isWeekend = day === 'Sat' || day === 'Sun';
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{
                      width: 44, height: 44, borderRadius: 10, cursor: 'pointer',
                      fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
                      transition: 'all 0.15s',
                      background: on
                        ? (isWeekend ? 'rgba(245,158,11,0.18)' : 'rgba(77,159,255,0.18)')
                        : 'rgba(255,255,255,0.04)',
                      outline: on
                        ? `1px solid ${isWeekend ? 'rgba(245,158,11,0.5)' : 'rgba(77,159,255,0.5)'}`
                        : '1px solid rgba(255,255,255,0.08)',
                      color: on
                        ? (isWeekend ? 'var(--yellow)' : 'var(--blue)')
                        : 'var(--text-muted)',
                      border: 'none',
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>
              {activeDays.length === 0
                ? 'No days selected — all signals will be blocked'
                : `Active: ${activeDays.join(', ')}`}
            </div>
          </div>

          {/* Time range */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Active hours <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>(Eastern Time)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 30 }}>From</span>
                <input
                  type="time"
                  value={form.schedule_start || '09:30'}
                  onChange={e => set('schedule_start', e.target.value)}
                  className="tf-input"
                  style={{ width: 130 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 16 }}>to</span>
                <input
                  type="time"
                  value={form.schedule_end || '16:00'}
                  onChange={e => set('schedule_end', e.target.value)}
                  className="tf-input"
                  style={{ width: 130 }}
                />
              </div>
            </div>

            {/* Visual hour strip */}
            <HourStrip start={form.schedule_start || '09:30'} end={form.schedule_end || '16:00'} />
          </div>
        </>
      )}
    </div>
  );
}

function HourStrip({ start, end }) {
  const startH = parseInt(start.split(':')[0]);
  const endH   = parseInt(end.split(':')[0]);
  const hours  = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 12, height: 18 }}>
      {hours.map(h => {
        const active = h >= startH && h < endH;
        const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`;
        const isMarket = h >= 9 && h < 16;
        return (
          <div
            key={h}
            title={`${label} — ${active ? 'active' : 'blocked'}`}
            style={{
              flex: 1, borderRadius: 2,
              background: active
                ? (isMarket ? 'var(--blue)' : 'rgba(77,159,255,0.4)')
                : 'rgba(255,255,255,0.05)',
              opacity: active ? 1 : 0.5,
              transition: 'background 0.2s',
              position: 'relative',
            }}
          />
        );
      })}
    </div>
  );
}

function WebhookTester({ algoId, webhookUrl }) {
  const [action, setAction] = useState('buy');
  const [symbol, setSymbol] = useState('MNQ');
  const [price, setPrice] = useState('');
  const [firing, setFiring] = useState(false);
  const [result, setResult] = useState(null); // { ok, data }
  const [copiedPayload, setCopiedPayload] = useState(false);

  const payload = JSON.stringify({
    action,
    symbol: symbol || '{{ticker}}',
    ...(price ? { price: parseFloat(price) } : { price: '{{close}}' }),
  }, null, 2);

  const curlCmd = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ action, symbol: symbol || 'MNQ', ...(price ? { price: parseFloat(price) } : {}) })}'`;

  async function fire() {
    setFiring(true);
    setResult(null);
    try {
      const data = await sendTestSignal(algoId, { action, symbol: symbol || 'TEST', price: price ? parseFloat(price) : null });
      setResult({ ok: true, data });
    } catch (err) {
      setResult({ ok: false, data: err?.response?.data || { error: err.message } });
    } finally {
      setFiring(false);
    }
  }

  function copyPayload() {
    navigator.clipboard.writeText(payload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Action toggle */}
      <div className="glass" style={{ borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Signal Direction
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {['buy', 'sell'].map(a => (
            <button
              key={a}
              onClick={() => setAction(a)}
              style={{
                padding: '10px 28px', borderRadius: 10, fontWeight: 700, fontSize: 15,
                cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                background: action === a
                  ? (a === 'buy' ? 'rgba(0,230,118,0.18)' : 'rgba(255,59,92,0.18)')
                  : 'rgba(255,255,255,0.05)',
                color: action === a
                  ? (a === 'buy' ? 'var(--green)' : 'var(--red)')
                  : 'var(--text-dim)',
                boxShadow: action === a
                  ? `0 0 16px ${a === 'buy' ? 'rgba(0,230,118,0.2)' : 'rgba(255,59,92,0.2)'}`
                  : 'none',
                outline: action === a
                  ? `1px solid ${a === 'buy' ? 'rgba(0,230,118,0.35)' : 'rgba(255,59,92,0.35)'}`
                  : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {a === 'buy' ? '▲ BUY' : '▼ SELL'}
            </button>
          ))}
        </div>
      </div>

      {/* Symbol + Price */}
      <div className="glass" style={{ borderRadius: 14, padding: 24, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
            Symbol
          </label>
          <input
            className="tf-input"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="MNQ, ES, NQ…"
            style={{ fontSize: 15, fontWeight: 600 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
            Price <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <input
            className="tf-input"
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="Leave blank for market"
            style={{ fontSize: 15 }}
          />
        </div>
      </div>

      {/* Payload preview */}
      <div className="glass" style={{ borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            JSON Payload Preview
          </span>
          <button
            onClick={copyPayload}
            className={`btn btn-xs ${copiedPayload ? 'btn-primary' : 'btn-ghost'}`}
            style={{ transition: 'all 0.2s' }}
          >
            {copiedPayload ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre className="mono" style={{
          margin: 0, fontSize: 13,
          background: 'rgba(77,159,255,0.05)', border: '1px solid rgba(77,159,255,0.15)',
          borderRadius: 8, padding: '14px 16px', color: 'var(--blue)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {payload}
        </pre>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
            cURL equivalent
          </div>
          <pre className="mono" style={{
            margin: 0, fontSize: 11,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '12px 14px', color: 'var(--text-dim)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {curlCmd}
          </pre>
        </div>
      </div>

      {/* Fire button */}
      <button
        onClick={fire}
        disabled={firing}
        style={{
          padding: '16px', borderRadius: 12, border: 'none',
          background: action === 'buy'
            ? 'linear-gradient(135deg, rgba(0,230,118,0.2), rgba(0,230,118,0.1))'
            : 'linear-gradient(135deg, rgba(255,59,92,0.2), rgba(255,59,92,0.1))',
          outline: `1px solid ${action === 'buy' ? 'rgba(0,230,118,0.35)' : 'rgba(255,59,92,0.35)'}`,
          color: action === 'buy' ? 'var(--green)' : 'var(--red)',
          fontSize: 16, fontWeight: 800, cursor: firing ? 'not-allowed' : 'pointer',
          letterSpacing: '0.03em', transition: 'all 0.15s',
          opacity: firing ? 0.6 : 1,
          boxShadow: action === 'buy' ? '0 0 24px rgba(0,230,118,0.15)' : '0 0 24px rgba(255,59,92,0.15)',
        }}
      >
        {firing ? 'Firing…' : `⚡ Fire ${action.toUpperCase()} Signal`}
      </button>

      {/* Result */}
      {result && (
        <div style={{
          borderRadius: 12, padding: '18px 20px',
          background: result.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,59,92,0.08)',
          border: `1px solid ${result.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,59,92,0.3)'}`,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: result.ok ? 'var(--green)' : 'var(--red)',
            marginBottom: result.data ? 10 : 0,
          }}>
            {result.ok ? '✓ Signal fired successfully' : '✗ Signal failed'}
          </div>
          {result.data && (
            <pre className="mono" style={{
              margin: 0, fontSize: 12,
              color: result.ok ? 'rgba(0,230,118,0.8)' : 'rgba(255,59,92,0.8)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 14,
    }}>
      <div className="glass" style={{ padding: '24px 40px', borderRadius: 14 }}>
        Loading…
      </div>
    </div>
  );
}
