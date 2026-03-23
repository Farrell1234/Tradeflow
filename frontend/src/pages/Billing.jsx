import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBillingStatus, createCheckout, createPortalSession } from '../api';

function daysLeft(dateStr) {
  if (!dateStr) return 0;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function StatusBadge({ status }) {
  const colors = {
    trialing:  { bg: 'rgba(124,106,247,0.15)', border: 'rgba(124,106,247,0.35)', color: '#a78bfa', label: 'Trial' },
    active:    { bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',   color: '#34d399', label: 'Active' },
    past_due:  { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   color: '#fbbf24', label: 'Past Due' },
    canceled:  { bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)',    color: '#f87171', label: 'Canceled' },
  };
  const c = colors[status] || colors.canceled;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: '3px 12px',
      fontSize: 12, fontWeight: 600, color: c.color,
    }}>
      {c.label}
    </span>
  );
}

export default function Billing() {
  const { user, refreshUser } = useAuth();
  const [billing,    setBilling]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [checkoutLoading, setCL]    = useState(false);
  const [portalLoading,   setPL]    = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    getBillingStatus()
      .then(setBilling)
      .catch(() => {})
      .finally(() => setLoading(false));
    // Refresh user after Stripe redirect
    if (searchParams.get('success')) refreshUser();
  }, []);

  async function handleUpgrade() {
    setCL(true);
    try {
      const { url } = await createCheckout();
      window.location.href = url;
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start checkout');
    } finally {
      setCL(false);
    }
  }

  async function handlePortal() {
    setPL(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to open portal');
    } finally {
      setPL(false);
    }
  }

  const status  = billing?.subscription_status || user?.subscription_status;
  const days    = daysLeft(billing?.trial_ends_at);
  const isActive = status === 'active';
  const isTrialing = status === 'trialing';

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <Link to="/" style={styles.back}>← Back to Dashboard</Link>
      </div>

      <div style={styles.container}>
        <h1 style={styles.title}>Billing &amp; Plan</h1>

        {searchParams.get('success') && (
          <div style={styles.successBanner}>
            Subscription activated — you're all set!
          </div>
        )}
        {searchParams.get('canceled') && (
          <div style={styles.cancelBanner}>
            Checkout canceled. Your trial is still active.
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Current Plan</div>
              <div style={styles.cardSub}>{user?.email}</div>
            </div>
            <StatusBadge status={status} />
          </div>

          {isTrialing && (
            <div style={styles.trialInfo}>
              <div style={styles.trialDays}>{days}</div>
              <div style={styles.trialLabel}>days left in trial</div>
              <div style={styles.trialNote}>Add a payment method before your trial ends to keep access</div>
            </div>
          )}

          {isActive && (
            <div style={styles.activeInfo}>
              <span style={styles.activeCheck}>✓</span>
              Full access — all features unlocked
            </div>
          )}

          {status === 'canceled' || status === 'past_due' ? (
            <div style={styles.expiredInfo}>
              Your subscription has lapsed. Upgrade to restore access.
            </div>
          ) : null}

          <div style={styles.actions}>
            {!isActive && (
              <button onClick={handleUpgrade} disabled={checkoutLoading} style={styles.upgradeBtn}>
                {checkoutLoading ? 'Redirecting…' : isTrialing ? 'Upgrade to Pro — $29/mo' : 'Reactivate Subscription'}
              </button>
            )}
            {billing?.has_subscription && (
              <button onClick={handlePortal} disabled={portalLoading} style={styles.portalBtn}>
                {portalLoading ? 'Opening…' : 'Manage Billing'}
              </button>
            )}
          </div>
        </div>

        <div style={styles.featuresCard}>
          <div style={styles.featuresTitle}>Everything in Pro</div>
          <div style={styles.featuresList}>
            {[
              'Unlimited algos',
              'Real Tradovate broker integration',
              'AI Pine Script analyzer',
              'Real-time P&L tracking',
              'Performance analytics',
              'TradingView webhook support',
            ].map(f => (
              <div key={f} style={styles.featureItem}>
                <span style={styles.featureCheck}>✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '24px',
    background: 'var(--bg)',
  },
  header: {
    marginBottom: 32,
  },
  back: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'color 0.15s',
  },
  container: {
    maxWidth: 520,
    margin: '0 auto',
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text-main)',
    margin: '0 0 24px',
  },
  successBanner: {
    background: 'rgba(52,211,153,0.1)',
    border: '1px solid rgba(52,211,153,0.3)',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#34d399',
    fontSize: 14,
    marginBottom: 20,
  },
  cancelBanner: {
    background: 'rgba(251,191,36,0.1)',
    border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#fbbf24',
    fontSize: 14,
    marginBottom: 20,
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '24px',
    marginBottom: 16,
    backdropFilter: 'blur(20px)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-main)',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  trialInfo: {
    textAlign: 'center',
    padding: '20px 0',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    marginBottom: 20,
  },
  trialDays: {
    fontSize: 48,
    fontWeight: 700,
    color: '#7c6af7',
    lineHeight: 1,
  },
  trialLabel: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginTop: 6,
  },
  trialNote: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 10,
    maxWidth: 260,
    margin: '10px auto 0',
  },
  activeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px',
    background: 'rgba(52,211,153,0.07)',
    borderRadius: 8,
    color: '#34d399',
    fontSize: 14,
    marginBottom: 20,
  },
  activeCheck: {
    fontSize: 16,
    fontWeight: 700,
  },
  expiredInfo: {
    padding: '14px',
    background: 'rgba(239,68,68,0.07)',
    borderRadius: 8,
    color: '#f87171',
    fontSize: 14,
    marginBottom: 20,
  },
  actions: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  upgradeBtn: {
    flex: 1,
    background: 'linear-gradient(135deg, #7c6af7, #6d5ce7)',
    border: 'none',
    borderRadius: 8,
    padding: '12px 20px',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    minWidth: 200,
  },
  portalBtn: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 20px',
    color: 'var(--text-muted)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  featuresCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '20px 24px',
  },
  featuresTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 14,
  },
  featuresList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  featureItem: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    fontSize: 14,
    color: 'var(--text-main)',
  },
  featureCheck: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 700,
  },
};
