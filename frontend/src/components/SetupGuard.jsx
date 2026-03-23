import { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import OnboardingWizard from './OnboardingWizard';

/**
 * Checks whether the user has both keys configured.
 * If not, intercepts and shows the onboarding wizard.
 * Once complete (or already set), renders children.
 */
export default function SetupGuard({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'incomplete' | 'complete'

  async function checkSetup() {
    try {
      const { data } = await api.get('/settings');
      const hasAnthropic = !!data.anthropic_api_key;
      const hasTradovate = !!(data.tradovate_username && data.tradovate_password);
      setStatus(hasAnthropic && hasTradovate ? 'complete' : 'incomplete');
    } catch {
      setStatus('incomplete');
    }
  }

  useEffect(() => { checkSetup(); }, []);

  if (status === 'loading') return null;

  if (status === 'incomplete') {
    return (
      <>
        {/* Render children blurred in background for context */}
        <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>
        <OnboardingWizard onComplete={() => setStatus('complete')} />
      </>
    );
  }

  return children;
}
