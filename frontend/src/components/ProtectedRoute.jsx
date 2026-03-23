import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireSubscription = true }) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requireSubscription) {
    const s = user.subscription_status;
    if (s !== 'trialing' && s !== 'active') {
      return <Navigate to="/billing" replace />;
    }
  }

  return children;
}
