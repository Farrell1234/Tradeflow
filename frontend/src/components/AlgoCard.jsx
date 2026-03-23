import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAlgo, resetKillSwitch } from '../api';
import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';

function getStatus(algo) {
  if (algo.kill_switch_triggered_at) return 'kill';
  if (!algo.is_active) return 'paused';
  return 'live';
}

function getHealth(algo) {
  if (algo.kill_switch_triggered_at) {
    return { label: 'Kill switch triggered', color: '#ef4444', dot: '#ef4444' };
  }
  if (!algo.is_active) {
    return { label: 'Paused', color: 'var(--text-dim)', dot: '#6b7280' };
  }
  const last = algo.last_signal_at ? new Date(algo.last_signal_at) : null;
  const hoursAgo = last ? (Date.now() - last.getTime()) / 36e5 : Infinity;
  if (hoursAgo < 24) {
    const ago = hoursAgo < 1
      ? `${Math.round(hoursAgo * 60)}m ago`
      : `${Math.round(hoursAgo)}h ago`;
    return { label: `Healthy · ${ago}`, color: '#34d399', dot: '#34d399' };
  }
  if (!last) {
    return { label: 'Idle · No signals yet', color: '#f59e0b', dot: '#f59e0b' };
  }
  return { label: 'Idle · No recent signals', color: '#f59e0b', dot: '#f59e0b' };
}

export default function AlgoCard({ algo, onUpdate, onDelete, onDuplicate, flashSignal }) {
  const navigate = useNavigate();
  const status = getStatus(algo);
  const pnl = parseFloat(algo.daily_pnl || 0);
  const pnlPositive = pnl >= 0;
  const [flashing, setFlashing] = useState(null);
  const flashRef = useRef(null);
  const cardRef = useRef(null);
  const tiltRef = useRef(null);

  // Card flash on signal
  useEffect(() => {
    if (!flashSignal) return;
    const color = flashSignal.action === 'sell' ? 'red' : 'green';
    setFlashing(color);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlashing(null), 700);
  }, [flashSignal]);

  // 3D tilt + cursor spotlight
  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -9;
    const rotY = ((x - cx) / cx) *  9;

    card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px)`;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = '';
    card.style.setProperty('--mouse-x', '-999px');
    card.style.setProperty('--mouse-y', '-999px');
  }, []);

  async function toggleActive(e) {
    e.stopPropagation();
    const updated = await updateAlgo(algo.id, { is_active: !algo.is_active });
    onUpdate(updated);
  }

  async function handleResetKillSwitch(e) {
    e.stopPropagation();
    const updated = await resetKillSwitch(algo.id);
    onUpdate(updated);
  }

  const health  = getHealth(algo);
  const isLive = status === 'live';
  const cardClass = [
    'glass glass-hover',
    isLive ? 'live-card' : status === 'kill' ? 'glow-red' : '',
    flashing === 'green' ? 'card-flash-green' : flashing === 'red' ? 'card-flash-red' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={cardRef}
      className={cardClass}
      onClick={() => {
        const card = cardRef.current;
        if (card) {
          card.style.transition = 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease, opacity 0.18s ease';
          card.style.transform = 'scale(1.03) translateZ(16px)';
          card.style.boxShadow = '0 12px 60px rgba(77,159,255,0.3), 0 0 0 1px rgba(77,159,255,0.35)';
          card.style.opacity = '0.85';
        }
        setTimeout(() => navigate(`/algo/${algo.id}`), 90);
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        borderRadius: 16, padding: '20px 22px',
        cursor: 'pointer', display: 'flex',
        flexDirection: 'column', gap: 14,
        willChange: 'transform',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <SonarDot status={status} />
          <span style={{
            fontWeight: 700, fontSize: 15, color: 'var(--text-main)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {algo.name}
          </span>
        </div>

        <div
          onClick={toggleActive}
          className="toggle"
          data-on={algo.is_active ? 'true' : undefined}
          style={{ flexShrink: 0 }}
        />
      </div>

      {/* Health badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -8 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: health.color,
          boxShadow: `0 0 6px ${health.color}`,
        }} />
        <span style={{ fontSize: 11, color: health.color, fontWeight: 500 }}>
          {health.label}
        </span>
      </div>

      {/* P&L — neon glow */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <AnimatedNumber
          value={pnl}
          format={v => `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`}
          className={`mono tabular ${pnlPositive ? 'pnl-green' : 'pnl-red'}`}
          style={{ fontSize: 32, fontWeight: 800 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>today</span>
      </div>

      {/* Sparkline */}
      <div style={{ margin: '0 -4px' }}>
        <Sparkline data={algo.pnl_series || [0, 0]} color={pnlPositive ? 'var(--green)' : 'var(--red)'} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 20 }}>
        <MiniStat label="Trades" value={algo.trades_today || 0} />
        <MiniStat
          label="Last signal"
          value={algo.last_signal_at
            ? new Date(algo.last_signal_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '—'}
        />
      </div>

      {/* Kill switch banner */}
      {status === 'kill' && (
        <div style={{
          background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.3)',
          borderRadius: 8, padding: '9px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>
            Auto-stop triggered — daily loss limit hit
          </span>
          <button onClick={handleResetKillSwitch} className="btn btn-xs btn-danger" style={{ flexShrink: 0 }}>
            Reset
          </button>
        </div>
      )}

      {/* Footer: webhook + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="mono" style={{
          fontSize: 10, color: 'var(--text-dim)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          /webhook/{algo.webhook_id}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {onDuplicate && (
            <button
              onClick={e => { e.stopPropagation(); onDuplicate(algo.id); }}
              title="Duplicate algo"
              style={{
                padding: '3px 10px', borderRadius: 6,
                border: '1px solid rgba(77,159,255,0.35)',
                background: 'rgba(77,159,255,0.12)', color: '#4d9fff',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(77,159,255,0.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(77,159,255,0.12)'; }}
            >
              ⧉ Clone
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SonarDot({ status }) {
  if (status === 'paused') {
    return (
      <span className="sonar-core" style={{
        background: 'var(--yellow)', boxShadow: '0 0 6px rgba(255,215,64,0.6)', opacity: 0.9,
      }} />
    );
  }
  const cls = status === 'live' ? 'sonar-dot sonar-green' : 'sonar-dot sonar-red';
  return (
    <span className={cls}>
      <span className="sonar-ring" />
      <span className="sonar-ring sonar-ring-2" />
      <span className="sonar-core" />
    </span>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span className="label">{label}</span>
      <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
        {value}
      </span>
    </div>
  );
}
