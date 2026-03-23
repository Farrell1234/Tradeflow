import { api } from './context/AuthContext';

export const getAlgos      = ()        => api.get('/algos').then(r => r.data);
export const getAlgo       = (id)      => api.get(`/algos/${id}`).then(r => r.data);
export const createAlgo    = (data)    => api.post('/algos', data).then(r => r.data);
export const updateAlgo    = (id, data)=> api.put(`/algos/${id}`, data).then(r => r.data);
export const deleteAlgo    = (id)      => api.delete(`/algos/${id}`).then(r => r.data);
export const resetKillSwitch = (id)    => api.post(`/algos/${id}/reset-kill-switch`).then(r => r.data);
export const stopAllAlgos   = ()       => api.post('/algos/stop-all').then(r => r.data);
export const duplicateAlgo  = (id)     => api.post(`/algos/${id}/duplicate`).then(r => r.data);

export const getOrderSets   = (algoId)           => api.get(`/algos/${algoId}/order-sets`).then(r => r.data);
export const createOrderSet = (algoId, data)     => api.post(`/algos/${algoId}/order-sets`, data).then(r => r.data);
export const updateOrderSet = (algoId, id, data) => api.put(`/algos/${algoId}/order-sets/${id}`, data).then(r => r.data);
export const deleteOrderSet = (algoId, id)       => api.delete(`/algos/${algoId}/order-sets/${id}`).then(r => r.data);

export const getSignals       = (algoId) => api.get(`/algos/${algoId}/signals`).then(r => r.data);
export const getRecentSignals = ()        => api.get('/algos/recent-signals').then(r => r.data);

export const analyzeScript       = (content, filename, algoId) => api.post('/scripts/analyze', { content, filename, algoId }).then(r => r.data);
export const saveScriptConfig    = (scriptId, final_config)    => api.patch(`/scripts/${scriptId}/config`, { final_config }).then(r => r.data);
export const getAlgoScript       = (algoId)                    => api.get(`/scripts/algo/${algoId}`).then(r => r.data);
export const generateAlertScript = (scriptId)                  => api.post(`/scripts/${scriptId}/alert-script`).then(r => r.data);
export const getPublicUrl        = ()                           => api.get('/public-url').then(r => r.data.url);
export const sendTestSignal      = (algoId, payload = {})        => api.post(`/algos/${algoId}/test-signal`, payload).then(r => r.data);

export const getSettings      = ()     => api.get('/settings').then(r => r.data);
export const saveSettings     = (data) => api.put('/settings', data).then(r => r.data);
export const testAnthropicKey = ()     => api.post('/settings/test-anthropic').then(r => r.data);
export const testTradovate    = ()     => api.post('/settings/test-tradovate').then(r => r.data);

export const getAlgoAnalytics = (algoId) => api.get(`/algos/${algoId}/analytics`).then(r => r.data);

export const getBillingStatus   = ()     => api.get('/billing/status').then(r => r.data);
export const createCheckout     = ()     => api.post('/billing/create-checkout').then(r => r.data);
export const createPortalSession = ()    => api.post('/billing/portal').then(r => r.data);

// WebSocket helper — sends auth token on connect, returns cleanup function
export function connectWS(onMessage) {
  const base   = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.host}`;
  const wsBase = base.replace(/^http/, 'ws');
  const wsUrl  = wsBase.replace(/\/$/, '');
  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    const token = localStorage.getItem('tf_token');
    if (token) {
      socket.send(JSON.stringify({ type: 'auth', token }));
    }
  };

  socket.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };

  socket.onerror = (e) => console.error('[ws] error', e);
  return () => socket.close();
}
