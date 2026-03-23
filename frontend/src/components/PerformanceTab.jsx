import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getAlgoAnalytics } from '../api';
import AnimatedNumber from './AnimatedNumber';

function StatCard({ label, value, format, color, sub }) {
  const formatted = typeof format === 'function' ? format(value) : value;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '18px 20px',
      flex: 1,
      minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>
        {formatted ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div style={{
      background: 'rgba(15,15,20,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: val >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
        {val >= 0 ? '+' : ''}${Math.abs(val).toFixed(2)}
      </div>
    </div>
  );
};

export default function PerformanceTab({ algoId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    getAlgoAnalytics(algoId)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [algoId]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading analytics…</div>;
  }
  if (error) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#f87171', fontSize: 13 }}>{error}</div>;
  }
  if (!data || data.totalTrades === 0) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
          No completed trades yet
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Send a test signal to get started
        </div>
      </div>
    );
  }

  // Build cumulative P&L series
  const cumulative = [];
  let running = 0;
  for (const d of data.dailyPnl) {
    running += d.pnl;
    cumulative.push({ date: d.date, pnl: parseFloat(running.toFixed(2)) });
  }

  const winPct = Math.round(data.winRate * 100);

  return (
    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard
          label="Total P&L"
          value={data.totalPnl}
          format={v => `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`}
          color={data.totalPnl >= 0 ? '#34d399' : '#f87171'}
        />
        <StatCard
          label="Win Rate"
          value={winPct}
          format={v => `${v}%`}
          color={winPct >= 50 ? '#34d399' : '#f87171'}
          sub={`${data.totalTrades} trades total`}
        />
        <StatCard
          label="Profit Factor"
          value={data.profitFactor}
          format={v => v === null ? '∞' : v?.toFixed(2)}
          color={data.profitFactor === null || data.profitFactor >= 1 ? '#7c6af7' : '#f87171'}
        />
        <StatCard
          label="Max Drawdown"
          value={data.maxDrawdown}
          format={v => `$${v.toFixed(2)}`}
          color="#f87171"
        />
      </div>

      {/* Avg win/loss */}
      <div style={{ display: 'flex', gap: 12 }}>
        <StatCard
          label="Avg Win"
          value={data.avgWin}
          format={v => `+$${v.toFixed(2)}`}
          color="#34d399"
        />
        <StatCard
          label="Avg Loss"
          value={data.avgLoss}
          format={v => `$${v.toFixed(2)}`}
          color="#f87171"
        />
      </div>

      {/* Cumulative P&L chart */}
      {cumulative.length > 1 && (
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
            Cumulative P&L
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={cumulative} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c6af7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c6af7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="pnl" stroke="#7c6af7" strokeWidth={2} fill="url(#pnlGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily P&L bar chart */}
      {data.dailyPnl.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
            Daily P&L
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.dailyPnl} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {data.dailyPnl.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? '#34d399' : '#f87171'} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
