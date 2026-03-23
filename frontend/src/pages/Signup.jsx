import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { signup } = useAuth();
  const navigate   = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signup(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◈</span>
          <span style={styles.logoText}>TradeFlow</span>
        </div>

        <div style={styles.badge}>14-day free trial · No card required</div>

        <h2 style={styles.title}>Create your account</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
              autoFocus
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Creating account…' : 'Start free trial'}
          </button>
        </form>

        <div style={styles.features}>
          {['Connect TradingView alerts to live orders', 'AI-powered Pine Script analyzer', 'Real-time P&L dashboard'].map(f => (
            <div key={f} style={styles.feature}>
              <span style={styles.check}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    backdropFilter: 'blur(20px)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  logoIcon: { fontSize: 22, color: '#7c6af7' },
  logoText:  { fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.03em' },
  badge: {
    background: 'rgba(124,106,247,0.15)',
    border: '1px solid rgba(124,106,247,0.3)',
    borderRadius: 20,
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: '#a78bfa',
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
    margin: '0 0 24px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  field:  { display: 'flex', flexDirection: 'column', gap: 6 },
  label:  { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    outline: 'none',
  },
  error: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#f87171',
    fontSize: 13,
  },
  btn: {
    background: 'linear-gradient(135deg, #7c6af7, #6d5ce7)',
    border: 'none',
    borderRadius: 8,
    padding: '12px',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  features: {
    marginTop: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  feature: {
    display: 'flex',
    gap: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
  },
  check: { color: '#34d399', fontSize: 12, fontWeight: 700 },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  link: { color: '#7c6af7', textDecoration: 'none' },
};
