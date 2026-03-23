require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const ws = require('./ws');
const { dailyReset } = require('./services/killSwitch');

const algosRouter    = require('./routes/algos');
const webhookRouter  = require('./routes/webhook');
const scriptsRouter  = require('./routes/scripts');
const settingsRouter = require('./routes/settings');
const authRouter     = require('./routes/auth');
const billingRouter  = require('./routes/billing');
const db             = require('./db');

const app = express();
const server = http.createServer(app);

// Public base URL — set to tunnel URL when available, else fallback
let publicBaseUrl = null;
app.get('/public-url', (req, res) => res.json({ url: publicBaseUrl }));

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
// Stripe webhook needs raw body — mount BEFORE express.json()
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── WebSocket ─────────────────────────────────────────────────────────
ws.init(server);

// ── Routes ────────────────────────────────────────────────────────────
app.use('/auth',     authRouter);
app.use('/billing',  billingRouter);
app.use('/algos',    algosRouter);
app.use('/webhook',  webhookRouter);
app.use('/scripts',  scriptsRouter);
app.use('/settings', settingsRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

// ── Serve built frontend in production ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  // SPA fallback — all non-API routes return index.html
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Midnight cron — reset daily P&L and kill switches ─────────────────
function scheduleMidnightReset() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;

  setTimeout(async () => {
    await dailyReset();
    scheduleMidnightReset(); // reschedule for next midnight
  }, msUntilMidnight);

  console.log(`[cron] Daily reset scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
}

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`TradeFlow backend running on port ${PORT}`);
  await db.migrate();
  scheduleMidnightReset();

  // Auto-start public tunnel in dev only
  if (process.env.NODE_ENV !== 'production') {
    try {
      const localtunnel = require('localtunnel');
      const tunnel = await localtunnel({ port: PORT });
      publicBaseUrl = tunnel.url;
      console.log(`[tunnel] Public URL: ${tunnel.url}`);
      tunnel.on('error', err => console.error('[tunnel] error:', err.message));
      tunnel.on('close', () => {
        console.warn('[tunnel] closed — webhook URL is no longer public');
        publicBaseUrl = null;
      });
    } catch (err) {
      console.warn('[tunnel] Could not start localtunnel:', err.message);
    }
  } else {
    publicBaseUrl = process.env.BACKEND_URL || null;
  }
});
