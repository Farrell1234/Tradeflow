import { useState, useEffect } from 'react';
import { getAlgoScript, sendTestSignal } from '../../api';
import ScriptUploader from './ScriptUploader';
import OrderSetConfig from './OrderSetConfig';
import SetupGuide from './SetupGuide';

// Steps:
// 'loading'    = checking DB for existing config
// 1            = upload
// 2            = configure order set
// 3            = copy into TradingView
// 'configured' = already set up — show preview

export default function IndicatorWizard({ algoId, webhookUrl }) {
  const [step, setStep]                 = useState('loading');
  const [existingScript, setExistingScript] = useState(null);
  const [analysis, setAnalysis]         = useState(null);
  const [scriptId, setScriptId]         = useState(null);
  const [filename, setFilename]         = useState('');
  const [config, setConfig]             = useState(null);

  useEffect(() => {
    getAlgoScript(algoId)
      .then(script => {
        if (script?.final_config) {
          setExistingScript(script);
          setConfig(script.final_config);
          setStep('configured');
        } else {
          setStep(1);
        }
      })
      .catch(() => setStep(1));
  }, [algoId]);

  function handleAnalysisComplete(result, sid, _content, fname) {
    setAnalysis(result);
    setScriptId(sid);
    setFilename(fname || '');
    setStep(2);
  }

  function handleConfigComplete(finalConfig) {
    setConfig(finalConfig);
    setStep(3);
  }

  function handleComplete() {
    getAlgoScript(algoId).then(script => {
      if (script) {
        setExistingScript(script);
        setConfig(script.final_config);
      }
      setStep('configured');
    }).catch(() => setStep('configured'));
  }

  function handleStartEdit() {
    setAnalysis(null);
    setScriptId(null);
    setFilename('');
    setConfig(null);
    setStep(1);
  }

  const stepLabels = ['Upload', 'Configure', 'Connect'];

  if (step === 'loading') {
    return (
      <div className="glass" style={{ borderRadius: 14, padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (step === 'configured') {
    return <ConfiguredView config={config} existingScript={existingScript} webhookUrl={webhookUrl} algoId={algoId} onEdit={handleStartEdit} />;
  }

  const visibleSteps = [1, 2, 3];
  const currentStep = typeof step === 'number' ? step : 1;

  return (
    <div>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
        {visibleSteps.map((s, i) => {
          const done   = currentStep > s;
          const active = currentStep === s;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < visibleSteps.length - 1 ? 1 : undefined }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: done ? 'var(--green)' : active ? 'var(--blue)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${done ? 'var(--green)' : active ? 'var(--blue)' : 'rgba(255,255,255,0.12)'}`,
                color: done || active ? '#000' : 'var(--text-dim)',
                fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
                boxShadow: active ? '0 0 12px rgba(77,159,255,0.4)' : 'none',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 11, fontWeight: active ? 700 : 400,
                color: active ? 'var(--text-main)' : done ? 'var(--text-muted)' : 'var(--text-dim)',
                marginLeft: 6, whiteSpace: 'nowrap',
              }}>
                {stepLabels[i]}
              </span>
              {i < visibleSteps.length - 1 && (
                <div style={{
                  flex: 1, height: 1, margin: '0 12px',
                  background: done ? 'rgba(0,230,118,0.4)' : 'rgba(255,255,255,0.07)',
                  transition: 'background 0.3s ease',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <ScriptUploader algoId={algoId} onAnalysisComplete={handleAnalysisComplete} />
      )}

      {step === 2 && analysis && (
        <OrderSetConfig
          analysis={analysis}
          filename={filename}
          scriptId={scriptId}
          algoId={algoId}
          onComplete={handleConfigComplete}
        />
      )}

      {step === 3 && config && (
        <SetupGuide
          config={config}
          scriptId={scriptId}
          webhookUrl={webhookUrl}
          algoId={algoId}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}

function ConfiguredView({ config, existingScript, webhookUrl, algoId, onEdit }) {
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState(null);
  const analysis = existingScript?.analysis;
  const os = config?.suggestedOrderSet;

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
  const entryLabel = os?.entry_type === 'market' ? 'Market order' : os?.entry_type === 'limit_signal' ? 'Limit at signal price' : 'Limit with offset';
  const stopLabel  = os?.stop_type === 'trailing' ? 'Trailing stop' : 'Fixed stop loss';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'wizard-step-in 0.35s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em' }}>
              INDICATOR CONNECTED
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
            {existingScript?.filename?.replace('.pine', '') || 'Your Indicator'}
          </h2>
          {analysis?.summary && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)', maxWidth: 620, lineHeight: 1.55 }}>
              {analysis.summary}
            </p>
          )}
        </div>
        <button onClick={onEdit} className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }}>
          Replace Indicator
        </button>
      </div>

      {os && (
        <div className="glass" style={{ borderRadius: 14, padding: '18px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>
            CONFIGURED TRADE SETTINGS
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="chip">{entryLabel}</span>
            {os.profit_target_ticks && (
              <span className="chip" style={{ color: 'var(--green)', borderColor: 'rgba(0,230,118,0.25)' }}>
                {os.profit_target_ticks}-tick target
              </span>
            )}
            {os.stop_ticks && (
              <span className="chip" style={{ color: 'var(--red)', borderColor: 'rgba(255,77,106,0.25)' }}>
                {stopLabel} · {os.stop_ticks}t
              </span>
            )}
            {os.breakeven_enabled && (
              <span className="chip" style={{ color: 'var(--yellow)', borderColor: 'rgba(255,215,64,0.25)' }}>
                Breakeven at {os.breakeven_ticks}t
              </span>
            )}
          </div>
        </div>
      )}

      <div className="glass" style={{ borderRadius: 14, padding: '16px 22px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Your TradingView alerts should point to this webhook URL:
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
          <CopyBtn value={webhookUrl} />
        </div>
      </div>

      <div className="glass" style={{ borderRadius: 14, padding: '16px 22px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Send a test signal to confirm TradeFlow is receiving alerts from TradingView.
        </div>
        <button
          onClick={handleTest}
          disabled={testing}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {testing ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--blue)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              Sending…
            </span>
          ) : 'Send Test Signal'}
        </button>
        {testResult && <TestResultBanner result={testResult} />}
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
    <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: bg, border: `1px solid ${border}`, fontSize: 13, color }}>
      {isSuccess ? '✓ ' : isBlocked ? '⚠ ' : '✗ '}{msg}
    </div>
  );
}

function CopyBtn({ value }) {
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
      {copied ? '✓ Copied!' : 'Copy'}
    </button>
  );
}
