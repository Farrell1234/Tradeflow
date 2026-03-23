import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useTheme } from '../context/ThemeContext';
import RobotLogo from '../components/RobotLogo';

const api = (method, path, body) => {
  const token = localStorage.getItem('tf_token');
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => r.json());
};

export default function Settings() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [original, setOriginal] = useState({});
  const [form, setForm]         = useState({
    anthropic_api_key:  '',
    broker_mode:        'mock',
    tradovate_mode:     'demo',
    tradovate_username: '',
    tradovate_password: '',
    tradovate_cid:      '',
    tradovate_secret:   '',
    tradovate_app_id:   'TradeFlow',
  });

  // Track which sensitive fields the user has actively edited
  const [editedSensitive, setEditedSensitive] = useState(new Set());

  // Test results
  const [anthropicTest, setAnthropicTest] = useState(null); // null | {ok,error}
  const [tradovateTest, setTradovateTest] = useState(null);
  const [testingA, setTestingA]           = useState(false);
  const [testingT, setTestingT]           = useState(false);

  // Show/hide toggles for sensitive fields
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);
  const [showSecret,    setShowSecret]    = useState(false);

  useEffect(() => {
    api('GET', '/settings').then(data => {
      setOriginal(data);
      setForm({
        anthropic_api_key:  data.anthropic_api_key  || '',
        broker_mode:        data.broker_mode        || 'mock',
        tradovate_mode:     data.tradovate_mode     || 'demo',
        tradovate_username: data.tradovate_username || '',
        tradovate_password: data.tradovate_password || '',
        tradovate_cid:      data.tradovate_cid      || '',
        tradovate_secret:   data.tradovate_secret   || '',
        tradovate_app_id:   data.tradovate_app_id   || 'TradeFlow',
      });
      setLoading(false);
    });
  }, []);

  const SENSITIVE = ['anthropic_api_key', 'tradovate_password', 'tradovate_secret'];

  function handleChange(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    if (SENSITIVE.includes(key)) {
      setEditedSensitive(s => new Set([...s, key]));
    }
    // Clear test results when credentials change
    if (key.startsWith('anthropic')) setAnthropicTest(null);
    if (key.startsWith('tradovate')) setTradovateTest(null);
  }

  // Focus on sensitive field → clear masked value so user can type fresh
  function handleSensitiveFocus(key) {
    if (!editedSensitive.has(key) && form[key] && form[key].startsWith('••')) {
      setForm(f => ({ ...f, [key]: '' }));
      setEditedSensitive(s => new Set([...s, key]));
    }
  }

  // If user blurs a sensitive field without typing → restore masked original
  function handleSensitiveBlur(key) {
    if (form[key] === '' && original[key]) {
      setForm(f => ({ ...f, [key]: original[key] }));
      setEditedSensitive(s => { const n = new Set(s); n.delete(key); return n; });
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const patch = {
        broker_mode:        form.broker_mode,
        tradovate_mode:     form.tradovate_mode,
        tradovate_username: form.tradovate_username,
        tradovate_cid:      form.tradovate_cid,
        tradovate_app_id:   form.tradovate_app_id,
      };
      // Only include sensitive fields if user actually edited them
      for (const key of SENSITIVE) {
        if (editedSensitive.has(key)) {
          patch[key] = form[key];
        }
      }
      const updated = await api('PUT', '/settings', patch);
      setOriginal(updated);
      setForm(f => ({
        ...f,
        anthropic_api_key:  editedSensitive.has('anthropic_api_key') ? updated.anthropic_api_key || '' : f.anthropic_api_key,
        tradovate_password: editedSensitive.has('tradovate_password') ? updated.tradovate_password || '' : f.tradovate_password,
        tradovate_secret:   editedSensitive.has('tradovate_secret')   ? updated.tradovate_secret  || '' : f.tradovate_secret,
      }));
      setEditedSensitive(new Set());
      addToast('Settings saved', 'success');
    } catch {
      addToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function testAnthropic() {
    setTestingA(true);
    setAnthropicTest(null);
    try {
      const r = await api('POST', '/settings/test-anthropic');
      setAnthropicTest(r);
    } finally {
      setTestingA(false);
    }
  }

  async function testTradovate() {
    setTestingT(true);
    setTradovateTest(null);
    try {
      const r = await api('POST', '/settings/test-tradovate');
      setTradovateTest(r);
    } finally {
      setTestingT(false);
    }
  }

  const isDirty = editedSensitive.size > 0
    || form.broker_mode        !== (original.broker_mode        || 'mock')
    || form.tradovate_mode     !== (original.tradovate_mode     || 'demo')
    || form.tradovate_username !== (original.tradovate_username || '')
    || form.tradovate_cid      !== (original.tradovate_cid      || '')
    || form.tradovate_app_id   !== (original.tradovate_app_id   || 'TradeFlow');

  if (loading) return <SettingsShell navigate={navigate}><LoadingState /></SettingsShell>;

  return (
    <SettingsShell navigate={navigate}>
      <form onSubmit={handleSave}>

        {/* ── Appearance ───────────────────────────────── */}
        <section className="glass" style={{ borderRadius: 16, padding: 28, marginBottom: 20 }}>
          <SectionHeader
            icon={theme === 'dark' ? '🌙' : '☀️'}
            title="Appearance"
            subtitle="Switch between dark and light mode"
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {theme === 'dark' ? 'Easy on the eyes at night' : 'Crisp and clear in bright light'}
              </div>
            </div>
            <div
              className="toggle"
              data-on={theme === 'light' ? 'true' : undefined}
              onClick={toggleTheme}
            />
          </div>
        </section>

        {/* ── AI Configuration ─────────────────────────── */}
        <section className="glass" style={{ borderRadius: 16, padding: 28, marginBottom: 20 }}>
          <SectionHeader
            icon="🤖"
            title="AI Configuration"
            subtitle="Used by the indicator wizard to analyze your Pine Script"
          />

          <Field label="Anthropic API Key">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showAnthropic ? 'text' : 'password'}
                value={form.anthropic_api_key}
                onChange={e => handleChange('anthropic_api_key', e.target.value)}
                onFocus={() => handleSensitiveFocus('anthropic_api_key')}
                onBlur={() => handleSensitiveBlur('anthropic_api_key')}
                placeholder={original.anthropic_api_key ? 'Enter new key to replace' : 'sk-ant-api03-…'}
                className="tf-input"
                style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0 14px', fontSize: 14 }}
                onClick={() => setShowAnthropic(v => !v)}
                title={showAnthropic ? 'Hide' : 'Show'}
              >
                {showAnthropic ? '🙈' : '👁'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={testAnthropic}
                disabled={testingA}
                style={{ whiteSpace: 'nowrap', opacity: testingA ? 0.6 : 1 }}
              >
                {testingA ? 'Testing…' : 'Test'}
              </button>
            </div>
            {anthropicTest && (
              <TestResult result={anthropicTest} successMsg="Connected to Anthropic" />
            )}
            <FieldHint>
              Get your key at console.anthropic.com → API Keys
            </FieldHint>
          </Field>
        </section>

        {/* ── Broker Configuration ──────────────────────── */}
        <section className="glass" style={{ borderRadius: 16, padding: 28, marginBottom: 24 }}>
          <SectionHeader
            icon="📡"
            title="Broker Configuration"
            subtitle="Control where orders are sent when a signal fires"
          />

          <Field label="Broker Mode">
            <SegmentedToggle
              value={form.broker_mode}
              options={[
                { value: 'mock',      label: 'Mock (safe)',     desc: 'Simulates trades — no real orders' },
                { value: 'tradovate', label: 'Tradovate (live)', desc: 'Places real orders on your account' },
              ]}
              onChange={v => handleChange('broker_mode', v)}
            />
          </Field>

          {form.broker_mode === 'tradovate' && (
            <>
              <Divider />

              <Field label="Environment">
                <SegmentedToggle
                  value={form.tradovate_mode}
                  options={[
                    { value: 'demo', label: 'Demo', desc: 'Paper trading — no real money' },
                    { value: 'live', label: 'Live', desc: 'Real money — use with care' },
                  ]}
                  onChange={v => handleChange('tradovate_mode', v)}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
                <Field label="Username">
                  <input
                    type="text"
                    value={form.tradovate_username}
                    onChange={e => handleChange('tradovate_username', e.target.value)}
                    placeholder="Your Tradovate username"
                    className="tf-input"
                    autoComplete="off"
                  />
                </Field>

                <Field label="Password">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.tradovate_password}
                      onChange={e => handleChange('tradovate_password', e.target.value)}
                      onFocus={() => handleSensitiveFocus('tradovate_password')}
                      onBlur={() => handleSensitiveBlur('tradovate_password')}
                      placeholder={original.tradovate_password ? 'Enter new password to replace' : 'Your Tradovate password'}
                      className="tf-input"
                      style={{ flex: 1 }}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0 12px' }}
                      onClick={() => setShowPassword(v => !v)}
                    >{showPassword ? '🙈' : '👁'}</button>
                  </div>
                </Field>

                <Field label="App CID" hint="From Tradovate developer portal">
                  <input
                    type="text"
                    value={form.tradovate_cid}
                    onChange={e => handleChange('tradovate_cid', e.target.value)}
                    placeholder="e.g. 12345"
                    className="tf-input mono"
                  />
                </Field>

                <Field label="App Secret">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={form.tradovate_secret}
                      onChange={e => handleChange('tradovate_secret', e.target.value)}
                      onFocus={() => handleSensitiveFocus('tradovate_secret')}
                      onBlur={() => handleSensitiveBlur('tradovate_secret')}
                      placeholder={original.tradovate_secret ? 'Enter new secret to replace' : 'Your app secret'}
                      className="tf-input"
                      style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0 12px' }}
                      onClick={() => setShowSecret(v => !v)}
                    >{showSecret ? '🙈' : '👁'}</button>
                  </div>
                </Field>
              </div>

              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={testTradovate}
                  disabled={testingT}
                  style={{ opacity: testingT ? 0.6 : 1 }}
                >
                  {testingT ? 'Connecting…' : 'Test Connection'}
                </button>
                {tradovateTest && (
                  <TestResult
                    result={tradovateTest}
                    successMsg={tradovateTest.accountId ? `Connected — Account ${tradovateTest.accountId}` : 'Connected'}
                    inline
                  />
                )}
              </div>

              {form.tradovate_mode === 'live' && (
                <div style={{
                  marginTop: 16, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(255, 80, 80, 0.08)', border: '1px solid rgba(255, 80, 80, 0.25)',
                  fontSize: 12, color: 'var(--red)',
                }}>
                  Live mode places real orders with real money. Make sure you've tested on Demo first.
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Save ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{
              opacity: saving ? 0.7 : 1,
              boxShadow: isDirty ? '0 0 20px rgba(77,159,255,0.4)' : undefined,
            }}
          >
            {saving ? 'Saving…' : isDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>

      </form>
    </SettingsShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingsShell({ navigate, children }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 13 }}
          >
            ← Back
          </button>
          <RobotLogo />
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em' }}>
            TradeFlow
          </span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Settings</span>
      </nav>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '36px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>Settings</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Configure your API keys and broker connection
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{title}</span>
      </div>
      {subtitle && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', paddingLeft: 28 }}>{subtitle}</p>}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="label" style={{ marginBottom: 6 }}>
        {label}{hint && <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 6 }}>— {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function FieldHint({ children }) {
  return (
    <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-dim)' }}>{children}</div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0 20px' }} />;
}

function SegmentedToggle({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            padding: '7px 18px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            transition: 'all 0.15s',
            background: value === opt.value ? 'rgba(77,159,255,0.18)' : 'transparent',
            color: value === opt.value ? 'var(--blue)' : 'var(--text-muted)',
            boxShadow: value === opt.value ? '0 0 12px rgba(77,159,255,0.2)' : 'none',
          }}
          title={opt.desc}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TestResult({ result, successMsg, inline }) {
  const style = inline
    ? { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }
    : { marginTop: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 };

  if (result.ok) {
    return (
      <span style={{ ...style, color: 'var(--green)' }}>
        ✓ {successMsg}
      </span>
    );
  }
  return (
    <span style={{ ...style, color: 'var(--red)' }}>
      ✗ {result.error || 'Connection failed'}
    </span>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[1, 2].map(i => (
        <div key={i} className="skeleton" style={{ height: 200 }} />
      ))}
    </div>
  );
}
