import { useState } from 'react';
import Tooltip from './Tooltip';

const ENTRY_TYPES = [
  {
    value: 'market',
    label: 'Market order',
    desc: 'Executes instantly at the current price — fastest, always fills',
  },
  {
    value: 'limit_signal',
    label: 'Limit at signal price',
    desc: 'Places a limit order at the exact price your alert sends — good for S/R levels or FVGs',
  },
  {
    value: 'limit_offset',
    label: 'Limit with offset',
    desc: 'Tries to get a slightly better price than market by X ticks',
  },
];

const STOP_TYPES = [
  {
    value: 'fixed',
    label: 'Fixed stop loss',
    desc: 'Stop stays at a fixed distance from your entry price',
  },
  {
    value: 'trailing',
    label: 'Trailing stop',
    desc: 'Stop follows the price up (for longs) — locks in profits as it moves',
  },
];

const defaultValues = {
  name: 'Order Set',
  contracts: 1,
  entry_type: 'market',
  limit_offset_ticks: 2,
  profit_target_ticks: 20,
  stop_type: 'fixed',
  stop_ticks: 20,
  breakeven_enabled: false,
  breakeven_ticks: 10,
  trail_activation_ticks: 0,
  trail_step_ticks: 0,
  trail_lock_ticks: null,
};

export default function OrderSetForm({ initial = {}, onSave, onCancel, saving }) {
  const merged = { ...defaultValues, ...initial };
  const [form, setForm] = useState(merged);

  // Local UI toggles derived from saved values
  const [activationOn, setActivationOn] = useState((merged.trail_activation_ticks || 0) > 0);
  const [stepOn,       setStepOn]       = useState((merged.trail_step_ticks       || 0) > 0);
  const [lockOn,       setLockOn]       = useState(merged.trail_lock_ticks != null && merged.trail_lock_ticks > 0);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function toggleActivation(on) {
    setActivationOn(on);
    set('trail_activation_ticks', on ? (form.trail_activation_ticks > 0 ? form.trail_activation_ticks : 10) : 0);
  }

  function toggleStep(on) {
    setStepOn(on);
    set('trail_step_ticks', on ? (form.trail_step_ticks > 0 ? form.trail_step_ticks : 4) : 0);
  }

  function toggleLock(on) {
    setLockOn(on);
    set('trail_lock_ticks', on ? (form.trail_lock_ticks > 0 ? form.trail_lock_ticks : 8) : null);
  }

  return (
    <div className="glass" style={{ borderRadius: 14, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: -4 }}>
        {initial.id ? 'Edit order set' : 'Add order set'}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -12 }}>
        An order set defines what happens every time a signal fires — what to buy/sell, how many contracts, and when to exit.
      </p>

      {/* Name */}
      <Field label="Order set name" tip="Give it a descriptive name like 'Quick scalp' or '3 contract runner'">
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Quick scalp"
          className="tf-input"
        />
      </Field>

      {/* Contracts */}
      <Field label="How many contracts?" tip="One contract = one unit of the futures symbol. Start with 1 if you're new.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number"
            value={form.contracts}
            min={1}
            onChange={e => set('contracts', parseInt(e.target.value, 10) || 1)}
            className="tf-input"
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>contract{form.contracts !== 1 ? 's' : ''}</span>
        </div>
      </Field>

      {/* Entry type */}
      <Field label="How do you want to enter?" tip="Market orders fill right away. Limit orders wait for a specific price.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ENTRY_TYPES.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${form.entry_type === opt.value ? 'rgba(77,159,255,0.4)' : 'var(--border)'}`,
                background: form.entry_type === opt.value ? 'rgba(77,159,255,0.06)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="radio"
                checked={form.entry_type === opt.value}
                onChange={() => set('entry_type', opt.value)}
                style={{ marginTop: 3, accentColor: 'var(--blue)', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>

      {form.entry_type === 'limit_offset' && (
        <Field label="How many ticks better than market?" tip="e.g. 2 ticks means your limit is 2 ticks below the ask on a buy signal">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              value={form.limit_offset_ticks}
              min={1}
              onChange={e => set('limit_offset_ticks', parseInt(e.target.value, 10) || 1)}
              className="tf-input"
              style={{ width: 100 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ticks</span>
          </div>
        </Field>
      )}

      {/* Profit target */}
      <Field label="Take profit — how many ticks?" tip="A tick is the minimum price movement. For MNQ: 1 tick = $0.50. For ES: 1 tick = $12.50.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number"
            value={form.profit_target_ticks}
            min={1}
            onChange={e => set('profit_target_ticks', parseInt(e.target.value, 10) || 1)}
            className="tf-input"
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ticks from entry</span>
        </div>
      </Field>

      {/* Stop type */}
      <Field label="Stop loss type" tip="Fixed stops are simpler. Trailing stops follow the price to lock in profits.">
        <div style={{ display: 'flex', gap: 10 }}>
          {STOP_TYPES.map(opt => (
            <label
              key={opt.value}
              style={{
                flex: 1, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${form.stop_type === opt.value ? 'rgba(255,77,106,0.35)' : 'var(--border)'}`,
                background: form.stop_type === opt.value ? 'rgba(255,77,106,0.05)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="radio"
                checked={form.stop_type === opt.value}
                onChange={() => set('stop_type', opt.value)}
                style={{ marginTop: 3, accentColor: 'var(--red)', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>

      {/* ── Fixed stop ────────────────────────────────────────────────────── */}
      {form.stop_type === 'fixed' && (
        <Field label="Stop loss distance" tip="How many ticks below entry before you exit at a loss">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              value={form.stop_ticks}
              min={1}
              onChange={e => set('stop_ticks', parseInt(e.target.value, 10) || 1)}
              className="tf-input"
              style={{ width: 100 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ticks</span>
          </div>
        </Field>
      )}

      {/* ── Trailing stop expanded panel ──────────────────────────────────── */}
      {form.stop_type === 'trailing' && (
        <div style={{
          border: '1px solid rgba(255,77,106,0.18)',
          borderRadius: 12,
          background: 'rgba(255,77,106,0.025)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,77,106,0.1)',
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>
            Trailing Stop Configuration
          </div>

          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Trail distance */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span className="label">Trail distance</span>
                <Tooltip text="How far behind price the stop follows as it moves in your favor" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  value={form.stop_ticks}
                  min={1}
                  onChange={e => set('stop_ticks', parseInt(e.target.value, 10) || 1)}
                  className="tf-input"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ticks behind price</span>
              </div>
            </div>

            <Divider />

            {/* Activation */}
            <TrailSubOption
              label="Activation offset"
              tip="The stop doesn't begin trailing until price moves this far in your favor. Prevents the trailing stop from being as tight as a fixed stop right after entry."
              enabled={activationOn}
              onToggle={toggleActivation}
              onLabel="Wait before trailing starts"
              offLabel="Trail from entry immediately"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  value={form.trail_activation_ticks || 10}
                  min={1}
                  onChange={e => set('trail_activation_ticks', parseInt(e.target.value, 10) || 1)}
                  className="tf-input"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ticks in profit before trailing starts</span>
              </div>
            </TrailSubOption>

            <Divider />

            {/* Step size */}
            <TrailSubOption
              label="Step size (ratchet)"
              tip="The stop only advances when price improves by this increment. Reduces noise-triggered stop movements during strong trends."
              enabled={stepOn}
              onToggle={toggleStep}
              onLabel="Move stop in increments"
              offLabel="Move stop continuously with price"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  value={form.trail_step_ticks || 4}
                  min={1}
                  onChange={e => set('trail_step_ticks', parseInt(e.target.value, 10) || 1)}
                  className="tf-input"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>tick increments</span>
              </div>
            </TrailSubOption>

            <Divider />

            {/* Profit lock */}
            <TrailSubOption
              label="Profit lock"
              tip="Trail adjusts so you can never exit below this profit level. Unlike breakeven (which locks in zero), this guarantees a minimum gain."
              enabled={lockOn}
              onToggle={toggleLock}
              onLabel="Lock in minimum profit"
              offLabel="No minimum profit guaranteed"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  value={form.trail_lock_ticks || 8}
                  min={1}
                  onChange={e => set('trail_lock_ticks', parseInt(e.target.value, 10) || 1)}
                  className="tf-input"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ticks minimum profit to preserve</span>
              </div>
            </TrailSubOption>

          </div>
        </div>
      )}

      {/* Breakeven */}
      <Field label="Move stop to breakeven?" tip="Once you're up X ticks, your stop moves to your entry price — so you can't lose on this trade.">
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div
            onClick={() => set('breakeven_enabled', !form.breakeven_enabled)}
            className="toggle"
            data-on={form.breakeven_enabled ? 'true' : undefined}
          />
          <span style={{ fontSize: 13, color: form.breakeven_enabled ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {form.breakeven_enabled ? 'Yes — move stop to breakeven' : 'No — keep stop fixed'}
          </span>
        </label>
      </Field>

      {form.breakeven_enabled && (
        <Field label="After how many ticks profit?" tip="Once price moves this many ticks in your favor, your stop moves to entry">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              value={form.breakeven_ticks}
              min={1}
              onChange={e => set('breakeven_ticks', parseInt(e.target.value, 10) || 1)}
              className="tf-input"
              style={{ width: 100 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ticks</span>
          </div>
        </Field>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? 'Saving…' : 'Save order set'}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TrailSubOption({ label, tip, enabled, onToggle, onLabel, offLabel, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span className="label">{label}</span>
        {tip && <Tooltip text={tip} />}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: enabled ? 12 : 0 }}>
        <div
          className="toggle"
          data-on={enabled ? 'true' : undefined}
          onClick={() => onToggle(!enabled)}
        />
        <span style={{ fontSize: 13, color: enabled ? 'var(--text-main)' : 'var(--text-muted)' }}>
          {enabled ? onLabel : offLabel}
        </span>
      </label>
      {enabled && children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,77,106,0.08)' }} />;
}

function Field({ label, tip, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label className="label">{label}</label>
        {tip && <Tooltip text={tip} />}
      </div>
      {children}
    </div>
  );
}
