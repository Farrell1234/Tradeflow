import { useState } from 'react';
import { createOrderSet, saveScriptConfig } from '../../api';
import { useToast } from '../Toast';

export default function OrderSetConfig({ analysis, filename, scriptId, algoId, onComplete }) {
  const indicatorName = filename?.replace('.pine', '') || 'Your Indicator';
  const toast = useToast();

  // If questions exist, use question-based flow; otherwise fall back to static form
  if (analysis.questions?.length === 6) {
    return (
      <QuestionFlow
        analysis={analysis}
        indicatorName={indicatorName}
        scriptId={scriptId}
        algoId={algoId}
        onComplete={onComplete}
        toast={toast}
      />
    );
  }

  return (
    <StaticForm
      analysis={analysis}
      indicatorName={indicatorName}
      scriptId={scriptId}
      algoId={algoId}
      onComplete={onComplete}
      toast={toast}
    />
  );
}

// ── Question-based flow ───────────────────────────────────────────────────────

function QuestionFlow({ analysis, indicatorName, scriptId, algoId, onComplete, toast }) {
  const qs = analysis.questions;

  // Build initial answers from question defaults
  const [answers, setAnswers] = useState(() => {
    const init = {};
    for (const q of qs) {
      if (q.type === 'toggle_with_number') {
        init[q.id] = { enabled: q.default_enabled ?? false, value: q.default_value ?? 10 };
      } else {
        init[q.id] = q.default ?? (q.type === 'number' ? 1 : q.options?.[0]?.value ?? '');
      }
    }
    return init;
  });

  const [saving, setSaving] = useState(false);

  function setAnswer(id, value) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const be = answers.breakeven;
      const orderSetData = {
        name: `${indicatorName} Order Set`,
        contracts: Number(answers.contracts) || 1,
        entry_type: answers.entry_type || 'market',
        profit_target_ticks: Number(answers.profit_target_ticks) || 20,
        stop_ticks: Number(answers.stop_ticks) || 15,
        stop_type: answers.stop_type || 'fixed',
        breakeven_enabled: be?.enabled ?? false,
        breakeven_ticks: be?.enabled ? Number(be.value) || 10 : 10,
      };

      await createOrderSet(algoId, orderSetData);

      const finalConfig = {
        ...analysis,
        suggestedOrderSet: {
          entry_type: orderSetData.entry_type,
          profit_target_ticks: orderSetData.profit_target_ticks,
          stop_ticks: orderSetData.stop_ticks,
          stop_type: orderSetData.stop_type,
          breakeven_enabled: orderSetData.breakeven_enabled,
          breakeven_ticks: orderSetData.breakeven_enabled ? orderSetData.breakeven_ticks : null,
        },
      };
      await saveScriptConfig(scriptId, finalConfig);
      onComplete(finalConfig);
    } catch (err) {
      console.error('[OrderSetConfig] submit error:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to save settings.');
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'wizard-step-in 0.35s ease' }}>
      <SummaryCard analysis={analysis} />

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 4 }}>
        TELL US HOW YOU WANT TO TRADE IT
      </div>

      {qs.map((q, i) => (
        <div key={q.id} className="glass" style={{ borderRadius: 14, padding: '18px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14, lineHeight: 1.5 }}>
            {i + 1}. {q.question}
          </div>
          <QuestionInput q={q} value={answers[q.id]} onChange={val => setAnswer(q.id, val)} />
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="btn btn-primary"
        style={{ padding: '14px 28px', fontSize: 14, fontWeight: 700 }}
      >
        {saving ? 'Creating…' : 'Create My Order Set \u2192'}
      </button>
    </div>
  );
}

function QuestionInput({ q, value, onChange }) {
  if (q.type === 'number') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="number"
          min={q.min ?? 1}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: 80, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
            color: 'var(--text-main)', fontWeight: 700, fontSize: 16, textAlign: 'center',
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{q.unit}</span>
      </div>
    );
  }

  if (q.type === 'choice') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {q.options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="btn btn-sm"
            style={{
              border: `1px solid ${value === opt.value ? 'var(--blue)' : 'var(--border)'}`,
              background: value === opt.value ? 'rgba(77,159,255,0.12)' : 'transparent',
              color: value === opt.value ? 'var(--blue)' : 'var(--text-muted)',
              fontWeight: value === opt.value ? 700 : 400,
              transition: 'all 0.15s',
              padding: '8px 14px',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === 'toggle_with_number') {
    const enabled = value?.enabled ?? false;
    const numVal  = value?.value ?? q.default_value ?? 10;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {enabled ? 'Yes — move stop to breakeven after' : 'No — keep stop where it was placed'}
          </span>
          <button
            onClick={() => onChange({ enabled: !enabled, value: numVal })}
            className="toggle"
            data-on={enabled ? '' : undefined}
          />
        </div>
        {enabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>After</span>
            <input
              type="number"
              min={1}
              value={numVal}
              onChange={e => onChange({ enabled, value: e.target.value })}
              style={{
                width: 64, padding: '5px 8px', borderRadius: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                color: 'var(--yellow)', fontWeight: 700, fontSize: 13, textAlign: 'center',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.unit}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Static fallback form ──────────────────────────────────────────────────────

function StaticForm({ analysis, indicatorName, scriptId, algoId, onComplete, toast }) {
  const os = analysis.suggestedOrderSet || {};
  const [entryType, setEntryType]           = useState(os.entry_type || 'market');
  const [profitTicks, setProfitTicks]       = useState(os.profit_target_ticks ?? 20);
  const [stopTicks, setStopTicks]           = useState(os.stop_ticks ?? 15);
  const [stopType, setStopType]             = useState(os.stop_type || 'fixed');
  const [breakevenOn, setBreakevenOn]       = useState(os.breakeven_enabled || false);
  const [breakevenTicks, setBreakevenTicks] = useState(os.breakeven_ticks ?? 10);
  const [saving, setSaving]                 = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      const orderSetData = {
        name: `${indicatorName} Order Set`,
        contracts: 1,
        entry_type: entryType,
        profit_target_ticks: Number(profitTicks),
        stop_ticks: Number(stopTicks),
        stop_type: stopType,
        breakeven_enabled: breakevenOn,
        breakeven_ticks: breakevenOn ? Number(breakevenTicks) : 10,
      };
      await createOrderSet(algoId, orderSetData);
      const finalConfig = {
        ...analysis,
        suggestedOrderSet: {
          entry_type: entryType,
          profit_target_ticks: Number(profitTicks),
          stop_ticks: Number(stopTicks),
          stop_type: stopType,
          breakeven_enabled: breakevenOn,
          breakeven_ticks: breakevenOn ? Number(breakevenTicks) : null,
        },
      };
      await saveScriptConfig(scriptId, finalConfig);
      onComplete(finalConfig);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to save settings.');
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'wizard-step-in 0.35s ease' }}>
      <SummaryCard analysis={analysis} />

      <div className="glass" style={{ borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 18 }}>
          HOW SHOULD TRADEFLOW TRADE WHEN IT FIRES?
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Entry type</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'market', label: 'Market order' },
              { value: 'limit_signal', label: 'Limit at signal price' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setEntryType(opt.value)}
                className="btn btn-sm"
                style={{
                  border: `1px solid ${entryType === opt.value ? 'var(--blue)' : 'var(--border)'}`,
                  background: entryType === opt.value ? 'rgba(77,159,255,0.12)' : 'transparent',
                  color: entryType === opt.value ? 'var(--blue)' : 'var(--text-muted)',
                  fontWeight: entryType === opt.value ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Profit target</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min={1} value={profitTicks} onChange={e => setProfitTicks(e.target.value)}
                style={{ width: 72, padding: '7px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--green)', fontWeight: 700, fontSize: 14, textAlign: 'center' }} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>ticks</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Stop loss</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min={1} value={stopTicks} onChange={e => setStopTicks(e.target.value)}
                style={{ width: 72, padding: '7px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--red)', fontWeight: 700, fontSize: 14, textAlign: 'center' }} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>ticks</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>Trailing stop</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Stop moves with price as it goes in your favor</div>
          </div>
          <button onClick={() => setStopType(s => s === 'trailing' ? 'fixed' : 'trailing')} className="toggle" data-on={stopType === 'trailing' ? '' : undefined} />
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>Move to breakeven</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Move stop to entry price once trade reaches a profit threshold</div>
            </div>
            <button onClick={() => setBreakevenOn(v => !v)} className="toggle" data-on={breakevenOn ? '' : undefined} />
          </div>
          {breakevenOn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>After</span>
              <input type="number" min={1} value={breakevenTicks} onChange={e => setBreakevenTicks(e.target.value)}
                style={{ width: 60, padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--yellow)', fontWeight: 700, fontSize: 13, textAlign: 'center' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ticks in profit</span>
            </div>
          )}
        </div>
      </div>

      <button onClick={handleSubmit} disabled={saving} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: 14, fontWeight: 700 }}>
        {saving ? 'Setting up…' : 'Set Up My Alerts \u2192'}
      </button>
    </div>
  );
}

// ── Shared summary card ───────────────────────────────────────────────────────

function SummaryCard({ analysis }) {
  return (
    <div className="glass" style={{ borderRadius: 14, padding: '18px 22px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <span className="chip" style={{ color: 'var(--blue)', borderColor: 'rgba(77,159,255,0.25)' }}>
          {analysis.scriptType === 'strategy' ? 'Strategy' : 'Indicator'}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {analysis.summary}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <span className="chip" style={{ color: 'var(--green)', borderColor: 'rgba(0,230,118,0.2)', fontSize: 11 }}>
          Buy: {analysis.buyConditionName}
        </span>
        <span className="chip" style={{ color: 'var(--red)', borderColor: 'rgba(255,77,106,0.2)', fontSize: 11 }}>
          Sell: {analysis.sellConditionName}
        </span>
      </div>
    </div>
  );
}
