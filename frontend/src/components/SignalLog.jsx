import { useRef } from 'react';

const STATUS = {
  executed:            { color: 'var(--green)',    label: 'Executed' },
  blocked_kill_switch: { color: 'var(--red)',      label: 'Kill switch' },
  blocked_schedule:    { color: 'var(--yellow)',   label: 'Off-schedule' },
  error:               { color: 'var(--text-dim)', label: 'Error' },
};

export default function SignalLog({ signals, newIds = [] }) {
  if (!signals || signals.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '64px 24px', gap: 12, textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, marginBottom: 4,
        }}>
          📡
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>
          No signals yet
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.6 }}>
          Fire a TradingView alert to see your first trade appear here in real time.
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Time', 'Action', 'Symbol', 'Status', 'Entry', 'Exit', 'P&L', 'Sets'].map(h => (
              <th key={h} style={{
                padding: '10px 14px', textAlign: 'left',
                color: 'var(--text-dim)', fontWeight: 500, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map(s => {
            const st = STATUS[s.status] || { color: 'var(--text-dim)', label: s.status };
            const pnl = parseFloat(s.pnl || 0);
            const isNew = newIds.includes(s.id);
            const isGreen = s.status === 'executed' && pnl >= 0;
            const isRed   = s.status === 'executed' && pnl < 0;

            return (
              <tr
                key={s.id}
                className={[
                  'signal-row',
                  isNew ? (isGreen ? 'slide-down flash-green-row' : 'slide-down flash-red-row') : '',
                ].filter(Boolean).join(' ')}
              >
                <td className="mono" style={{ padding: '11px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {new Date(s.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{
                    fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
                    color: s.action === 'buy' ? 'var(--green)' : 'var(--red)',
                  }}>
                    {(s.action || '').toUpperCase()}
                  </span>
                </td>
                <td className="mono" style={{ padding: '11px 14px', color: 'var(--text-main)', fontSize: 13 }}>
                  {s.symbol || '—'}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span className="chip" style={{ background: st.color + '18', color: st.color, borderColor: st.color + '40' }}>
                    {st.label}
                  </span>
                </td>
                <td className="mono" style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                  {s.entry_price != null ? Number(s.entry_price).toLocaleString() : '—'}
                </td>
                <td className="mono" style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                  {s.exit_price != null ? Number(s.exit_price).toLocaleString() : '—'}
                </td>
                <td className="mono tabular" style={{ padding: '11px 14px', fontWeight: 700 }}>
                  {s.pnl != null
                    ? <span style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                      </span>
                    : <span style={{ color: 'var(--text-dim)' }}>—</span>
                  }
                </td>
                <td style={{ padding: '11px 14px', color: 'var(--text-muted)', textAlign: 'center', fontSize: 13 }}>
                  {s.order_sets_fired || 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
