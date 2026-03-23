import { useState, useEffect } from 'react';
import { generateAlertScript, sendTestSignal } from '../../api';

const LOADING_MESSAGES = [
  'Building your custom script…',
  'Wiring up your money printer…',
  'Reading your indicator signals…',
  'Injecting TradeFlow alerts…',
  'Connecting buy and sell conditions…',
  'Calibrating the entry logic…',
  'Almost got it…',
  'Wrapping up the Pine Script…',
  'Making your alerts bulletproof…',
  'Just about done…',
];

export default function SetupGuide({ config, scriptId, webhookUrl, algoId, onComplete }) {
  const [alertScript, setAlertScript] = useState(null);
  const [generating, setGenerating]   = useState(true);
  const [genError, setGenError]       = useState(false);
  const [loadingMsg, setLoadingMsg]   = useState(LOADING_MESSAGES[0]);
  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState(null);
  const [activeStep, setActiveStep]   = useState(0);

  useEffect(() => {
    generateAlertScript(scriptId)
      .then(r => setAlertScript(r.alertScript))
      .catch(() => setGenError(true))
      .finally(() => setGenerating(false));
  }, [scriptId]);

  useEffect(() => {
    if (!generating) return;
    let i = 1;
    const interval = setInterval(() => {
      setLoadingMsg(LOADING_MESSAGES[i % LOADING_MESSAGES.length]);
      i++;
    }, 2200);
    return () => clearInterval(interval);
  }, [generating]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sendTestSignal(algoId);
      setTestResult(result);
    } catch {
      setTestResult({ status: 'error', reason: 'Could not reach the server.' });
    } finally {
      setTesting(false);
    }
  }

  const STEPS = [
    { label: 'Add to TradingView', icon: '📊' },
    { label: 'Create Alerts',      icon: '🔔' },
    { label: 'Test Connection',    icon: '⚡' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'wizard-step-in 0.35s ease' }}>

      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
          Connect TradingView
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          3 quick steps and your algo will fire live trades automatically
        </p>
      </div>

      {/* Step progress tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeStep === i ? 'rgba(77,159,255,0.15)' : 'transparent',
              color: activeStep === i ? 'var(--blue)' : 'var(--text-dim)',
              fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              outline: activeStep === i ? '1px solid rgba(77,159,255,0.3)' : 'none',
            }}
          >
            <span>{s.icon}</span>
            <span style={{ display: window.innerWidth < 500 ? 'none' : undefined }}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Step 0 — Add script to TradingView */}
      {activeStep === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Visual diagram */}
          <TradingViewDiagram step="pine-editor" />

          <div className="glass" style={{ borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
              Follow these steps in TradingView:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { n: 1, text: 'Open TradingView and load your chart' },
                { n: 2, text: 'Click "Pine Editor" at the bottom of the screen' },
                { n: 3, text: 'Click "Open" → "New script" to start fresh' },
                { n: 4, text: 'Select ALL the existing code (Ctrl+A) and delete it' },
                { n: 5, text: 'Paste the TradeFlow script below, then click "Save"' },
                { n: 6, text: 'Click "Add to chart" — your indicator will appear on screen' },
              ].map(({ n, text }) => (
                <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(77,159,255,0.12)', border: '1px solid rgba(77,159,255,0.3)',
                    color: 'var(--blue)', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{n}</div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, paddingTop: 3 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The script */}
          <div className="glass" style={{ borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                Your TradeFlow Script
              </span>
              {!generating && !genError && alertScript && (
                <CopyBtn value={alertScript} label="Copy Script" />
              )}
            </div>

            {generating ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10, background: 'rgba(77,159,255,0.07)', border: '1px solid rgba(77,159,255,0.2)' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '2px solid var(--blue)', borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite', flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, color: 'var(--blue)' }}>{loadingMsg}</span>
              </div>
            ) : genError ? (
              <div style={{ fontSize: 13, color: 'var(--red)', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,77,106,0.07)', border: '1px solid rgba(255,77,106,0.2)' }}>
                Could not generate the script. Try refreshing the page.
              </div>
            ) : (
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '12px 14px', maxHeight: 160, overflowY: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {alertScript}
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveStep(1)}
            className="btn btn-primary"
            disabled={generating || genError}
            style={{ padding: '14px', fontSize: 14 }}
          >
            Script is on my chart → Next Step
          </button>
        </div>
      )}

      {/* Step 1 — Create alerts */}
      {activeStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <TradingViewDiagram step="create-alert" />

          <div className="glass" style={{ borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
              Create 2 alerts — one Buy, one Sell:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { n: 1, text: 'Right-click your indicator on the chart' },
                { n: 2, text: 'Click "Add Alert on [your indicator name]"' },
                { n: 3, text: 'Set Condition to "TradeFlow Buy"' },
                { n: 4, text: 'Check the "Webhook URL" box and paste your URL (below)' },
                { n: 5, text: 'The Message field is already set — do NOT change it' },
                { n: 6, text: 'Set "Trigger" to "Once Per Bar Close" and click Save' },
                { n: 7, text: 'Repeat for "TradeFlow Sell"' },
              ].map(({ n, text }) => (
                <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
                    color: 'var(--green)', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{n}</div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, paddingTop: 3 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert config values */}
          <div className="glass" style={{ borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
              Copy these into your TradingView alert:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AlertRow label="Buy condition" value="TradeFlow Buy"  hint="Condition dropdown" color="var(--green)" />
              <AlertRow label="Sell condition" value="TradeFlow Sell" hint="Condition dropdown" color="var(--red)" />
              <AlertRow label="Webhook URL" value={webhookUrl} hint="Paste into Webhook URL field" color="var(--blue)" />
            </div>

            {/* JSON payload preview */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                The Message field will auto-fill with this JSON — don't change it:
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                whiteSpace: 'pre',
              }}>
{`{
  "action": "buy",
  "symbol": "{{ticker}}",
  "price": {{close}}
}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                For the sell alert, action will be "sell" — the script handles this automatically.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setActiveStep(0)} className="btn btn-ghost" style={{ flex: '0 0 auto' }}>
              ← Back
            </button>
            <button onClick={() => setActiveStep(2)} className="btn btn-primary" style={{ flex: 1, padding: '14px', fontSize: 14 }}>
              Alerts are created → Test it
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Test */}
      {activeStep === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="glass" style={{ borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
              Send a test signal
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
              This fires a simulated buy signal through your algo. If everything is connected, you'll see it appear in the Signal Log.
            </div>
            <button
              onClick={handleTest}
              disabled={testing || !algoId}
              className="btn btn-primary"
              style={{ fontSize: 14, padding: '13px 32px', marginBottom: 16 }}
            >
              {testing ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  Sending…
                </span>
              ) : 'Send Test Signal'}
            </button>
            {testResult && <TestResultBanner result={testResult} />}
          </div>

          <div className="glass" style={{ borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, fontWeight: 600 }}>
              Your webhook URL for TradingView alerts:
            </div>
            <AlertRow label="Webhook URL" value={webhookUrl} hint="Already set up on your alerts" color="var(--blue)" />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setActiveStep(1)} className="btn btn-ghost" style={{ flex: '0 0 auto' }}>
              ← Back
            </button>
            <button
              onClick={onComplete}
              className="btn btn-primary"
              style={{
                flex: 1, padding: '14px', fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, rgba(0,200,100,0.9), rgba(0,230,118,0.7))',
              }}
            >
              ✓ All set — Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Visual diagram of TradingView UI
function TradingViewDiagram({ step }) {
  if (step === 'pine-editor') {
    return (
      <div style={{
        borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        {/* Fake TradingView chrome */}
        <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', opacity: 0.7 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', opacity: 0.7 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', opacity: 0.7 }} />
          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>TradingView — Pine Editor</span>
        </div>
        <div style={{ padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Chart area */}
          <div style={{ height: 64, borderRadius: 8, background: 'rgba(77,159,255,0.05)', border: '1px solid rgba(77,159,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Chart area</span>
          </div>
          {/* Bottom panel */}
          <div style={{ borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 12px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <TabChip label="Pine Editor" active />
              <TabChip label="Strategy Tester" />
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>← Click this tab at the bottom</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(167,139,250,0.8)', background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '6px 10px' }}>
              //@version=5{'\n'}indicator("TradeFlow...", overlay=true){'\n'}
              <span style={{ color: 'rgba(77,159,255,0.8)' }}>// ← Paste your script here</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'create-alert') {
    return (
      <div style={{
        borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', opacity: 0.7 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', opacity: 0.7 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', opacity: 0.7 }} />
          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>TradingView — Create Alert</span>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AlertFormRow label="Condition" value="My Indicator — TradeFlow Buy" highlight />
          <AlertFormRow label="Trigger"   value="Once Per Bar Close" />
          <AlertFormRow label="Message"   value='{"action":"buy","symbol":"{{ticker}}","price":{{close}}}' mono />
          <div style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(77,159,255,0.08)', border: '1px solid rgba(77,159,255,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid var(--blue)', background: 'var(--blue)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' }}>✓</div>
            <span style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600 }}>Webhook URL ← Check this box and paste your URL</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function TabChip({ label, active }) {
  return (
    <div style={{
      fontSize: 10, padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
      background: active ? 'rgba(77,159,255,0.15)' : 'transparent',
      color: active ? 'var(--blue)' : 'var(--text-dim)',
      border: active ? '1px solid rgba(77,159,255,0.3)' : '1px solid transparent',
      fontWeight: active ? 700 : 400,
    }}>
      {label}
    </div>
  );
}

function AlertFormRow({ label, value, highlight, mono }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ width: 80, flexShrink: 0, fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</div>
      <div style={{
        flex: 1, fontSize: 10, padding: '5px 8px', borderRadius: 5,
        background: highlight ? 'rgba(77,159,255,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${highlight ? 'rgba(77,159,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
        color: highlight ? 'var(--blue)' : 'var(--text-muted)',
        fontFamily: mono ? 'monospace' : 'inherit',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  );
}

function StepBadge({ n }) {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(77,159,255,0.12)', border: '1px solid rgba(77,159,255,0.3)',
      color: 'var(--blue)', fontSize: 12, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {n}
    </div>
  );
}

function AlertRow({ label, value, hint, color }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hint}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="mono" style={{
          flex: 1, fontSize: 11, color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
          padding: '7px 10px', borderRadius: 6,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </div>
        <CopyBtn value={value} />
      </div>
    </div>
  );
}

function TestResultBanner({ result }) {
  const isSuccess = result.status === 'executed';
  const isBlocked = result.status === 'blocked_kill_switch' || result.status === 'blocked_schedule';
  const color  = isSuccess ? 'var(--green)' : isBlocked ? 'var(--yellow)' : 'var(--red)';
  const bg     = isSuccess ? 'rgba(0,230,118,0.07)' : isBlocked ? 'rgba(255,215,64,0.07)' : 'rgba(255,77,106,0.07)';
  const border = isSuccess ? 'rgba(0,230,118,0.25)' : isBlocked ? 'rgba(255,215,64,0.25)' : 'rgba(255,77,106,0.25)';
  const msg    = isSuccess
    ? 'Signal received! Check your Signal Log tab.'
    : isBlocked
    ? `Connected — but algo is paused (${result.status.replace('blocked_', '').replace('_', ' ')}). Resume it to trade.`
    : result.reason || result.error || 'Something went wrong.';

  return (
    <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: bg, border: `1px solid ${border}`, fontSize: 13, color, textAlign: 'left' }}>
      {isSuccess ? '✓ ' : isBlocked ? '⚠ ' : '✗ '}{msg}
    </div>
  );
}

function CopyBtn({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className={`btn btn-sm ${copied ? 'btn-primary' : 'btn-ghost'}`}
      style={{ whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0 }}
    >
      {copied ? '✓ Copied!' : label}
    </button>
  );
}
