const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'tradeflow-dev-secret';

let wss = null;

// Map<userId, Set<WebSocket>>
const userSockets = new Map();

function init(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    ws._userId = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        // First message from client must be { type: 'auth', token }
        if (msg.type === 'auth' && msg.token) {
          const payload = jwt.verify(msg.token, SECRET);
          ws._userId = payload.id;
          if (!userSockets.has(payload.id)) userSockets.set(payload.id, new Set());
          userSockets.get(payload.id).add(ws);
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        }
      } catch {
        // ignore bad messages / invalid tokens
      }
    });

    ws.on('close', () => {
      if (ws._userId && userSockets.has(ws._userId)) {
        userSockets.get(ws._userId).delete(ws);
        if (userSockets.get(ws._userId).size === 0) {
          userSockets.delete(ws._userId);
        }
      }
    });

    ws.on('error', (err) => console.error('[ws] Error:', err.message));
  });
}

/**
 * Broadcast to a specific user's WebSocket connections.
 * Falls back to all clients when userId is not provided (dev/test).
 */
function broadcast(algoId, payload, userId) {
  if (!wss) return;
  const message = JSON.stringify({ algoId, ...payload });

  if (userId && userSockets.has(userId)) {
    userSockets.get(userId).forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
  } else if (!userId) {
    wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
  }
}

module.exports = { init, broadcast };
