# TradeFlow — Session Handoff Document
> Read this file FIRST before Claude.MD.md. This captures the full current state of TradeFlow and exactly what to build next.
> Last updated: 2026-03-22 (Session 3)

---

## Current Status: What Has Been Built

### ✅ V1 Core — Backend Pipeline (Complete)

- **Express server** on port 3001 (`backend/src/index.js`)
- **PostgreSQL database** (`tradeflow` DB) with full schema
- **Webhook endpoint** — `POST /webhook/:webhookId` receives TradingView signals
- **Order Engine** (`backend/src/services/orderEngine.js`) — processes signals through kill switch → schedule → order sets → mockBroker
- **MockBroker** (`backend/src/services/mockBroker.js`) — simulates fills with realistic tick sizes/P&L (placeholder for real Tradovate — **see next task below**)
- **Kill Switch** (`backend/src/services/killSwitch.js`) — daily loss limit with auto-resume logic
- **WebSocket** real-time broadcasts to frontend on every signal
- **Midnight cron** — resets daily P&L and time-based kill switches

**All core API routes working:**
- `GET/POST/PUT/DELETE /algos` — full CRUD
- `GET/POST/PUT/DELETE /algos/:id/order-sets`
- `GET /algos/:id/signals` — last 50 signals
- `POST /algos/:id/reset-kill-switch`
- `POST /webhook/:webhookId` — main signal intake

### ✅ V1 Core — Frontend UI (Complete)

JARVIS-meets-Apple aesthetic. All pages are fully functional.

**Pages:**
- `frontend/src/pages/Dashboard.jsx` — algo grid, live clock, animated summary stats, WebSocket live updates
- `frontend/src/pages/AlgoDetail.jsx` — algo config, signal log tab, order sets tab, indicator wizard tab, kill switch management

**Components:**
- `frontend/src/components/AlgoCard.jsx` — 3D mouse tilt, cursor spotlight, rotating gradient border (live algos), neon P&L glow, sonar ping status dots
- `frontend/src/components/OrderSetForm.jsx` — full order set config with radio card selectors and tooltips
- `frontend/src/components/SignalLog.jsx` — animated rows, color-coded status chips
- `frontend/src/components/AnimatedNumber.jsx` — cubic ease-out counter animation
- `frontend/src/components/Sparkline.jsx` — recharts AreaChart mini chart
- `frontend/src/components/Toast.jsx` — toast notifications via React portal
- `frontend/src/components/Tooltip.jsx` — hover tooltip helper
- `frontend/src/components/Particles.jsx` — canvas-based floating particle background

### ✅ V1.5 — Pine Script Wizard (Complete)

A 3-step guided setup flow embedded in AlgoDetail. Users upload their TradingView indicator and TradeFlow handles everything else automatically.

**How it works:**
1. User uploads/pastes their Pine Script indicator
2. Claude AI analyzes the script and returns a summary + 6 personalized setup questions
3. User answers the questions (contracts, entry type, profit target, stop loss, stop type, breakeven)
4. TradeFlow creates an Order Set from their answers
5. Claude generates a modified version of the script with TradeFlow alertcondition() calls
6. User pastes the modified script into TradingView and creates 2 alerts (Buy + Sell)
7. TradeFlow tests the connection with a test signal

**New backend files:**
- `backend/src/routes/scripts.js` — 4 routes (see full list below)
- `backend/src/services/pineAnalyzer.js` — two Claude API calls (analyze + generate alert script)

**New frontend files:**
- `frontend/src/components/wizard/IndicatorWizard.jsx` — 3-step wizard container
- `frontend/src/components/wizard/ScriptUploader.jsx` — drag-and-drop + paste UI (step 1)
- `frontend/src/components/wizard/OrderSetConfig.jsx` — AI question renderer (step 2)
- `frontend/src/components/wizard/SetupGuide.jsx` — TradingView setup instructions (step 3)

### ✅ V1.5 — Public Webhook URL via localtunnel (Complete)

TradingView only allows webhooks to port 80/443. The backend now auto-creates a public HTTPS tunnel on startup using `localtunnel`.

- On boot: `backend/src/index.js` starts a localtunnel pointing at port 3001
- `GET /public-url` endpoint returns `{ url: publicBaseUrl }` (null if tunnel failed)
- `frontend/src/pages/AlgoDetail.jsx` fetches this URL and uses it as the webhookUrl
- **Note:** tunnel URL changes on every backend restart. Long-term fix is Railway deployment.
- **Note:** localtunnel occasionally shows a "tunnel password" page for new IPs — users may need to visit `https://loca.lt/` once to bypass.

### ✅ V1.5 — Test Signal Button (Complete)

- `POST /algos/:id/test-signal` fires a fake signal through the full `processSignal()` pipeline
- Now accepts body params: `{ action, symbol, price }` (updated in Session 3)
- Returns `{ status: 'executed' | 'blocked_kill_switch' | 'blocked_schedule' | 'error' }`
- "Send Test Signal" button + result banner present in both SetupGuide (step 3) and ConfiguredView

### ✅ V2 — Webhook Tester Tab (Complete)

Full test panel on AlgoDetail "Test Signal" tab:
- BUY / SELL direction toggle buttons
- Symbol input (prefilled from algo) + price input
- Live JSON payload preview (updates as you type)
- cURL equivalent for command-line testing
- Fire button → shows result banner (executed / blocked / error)
- `api.js` `sendTestSignal(algoId, payload)` updated to accept payload object

### ✅ V2 — Visual Schedule Builder (Complete)

Replaces text inputs in AlgoDetail edit panel:
- 7 clickable day tiles (Mon–Sun) — blue when active, muted when off
- Time range pickers (start/end time inputs)
- 24-cell hour strip visualization — blue cells = active hours, brighter for market hours 9–16
- Backend already had `schedule_enabled/start/end/days` columns and orderEngine check — only frontend was needed

### ✅ V2 — Mobile-Responsive Layout (Complete)

- `frontend/src/index.css` — added `.summary-grid`, `.algo-grid`, `.stats-grid`, `.algo-header`, `.page-content` layout classes
- `@media (max-width: 768px)` and `@media (max-width: 480px)` breakpoints
- Dashboard summary cards stack to 2-col, algo grid goes to 1-col on mobile
- `.stats-grid > *:last-child { grid-column: 1/-1 }` makes webhook card full-width on mobile
- Nav elements (date, email) hide on small screens via `.nav-date`, `.nav-email` classes

### ✅ V2 — Page Transition Animations (Complete)

- AlgoCard click: spring scale up (1.03) + blue glow → navigate after 90ms
- AlgoDetail entry: `.page-enter` (280ms fade+translateY) + `.rise-1/2/3` staggered sections (30/70/110ms delays)
- All animations use `will-change: transform, opacity` — NO `filter: blur()` (caused GPU choppiness)
- Classes defined in `frontend/src/index.css`

---

## Database Schema (Current — All 4 Tables)

```sql
CREATE TABLE algos (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  webhook_id UUID UNIQUE DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  kill_switch_amount NUMERIC DEFAULT 500,
  kill_switch_pause TEXT DEFAULT 'rest_of_day',
  daily_pnl NUMERIC DEFAULT 0,
  kill_switch_triggered_at TIMESTAMPTZ,
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_start TIME DEFAULT '09:30',
  schedule_end TIME DEFAULT '16:00',
  schedule_days TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  schedule_timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_sets (
  id SERIAL PRIMARY KEY,
  algo_id INTEGER REFERENCES algos(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Order Set',
  is_active BOOLEAN DEFAULT true,
  contracts INTEGER DEFAULT 1,
  entry_type TEXT DEFAULT 'market',        -- 'market' | 'limit_signal' | 'limit_offset'
  limit_offset_ticks INTEGER DEFAULT 2,
  profit_target_ticks INTEGER DEFAULT 20,
  stop_type TEXT DEFAULT 'fixed',          -- 'fixed' | 'trailing'
  stop_ticks INTEGER DEFAULT 20,
  breakeven_enabled BOOLEAN DEFAULT false,
  breakeven_ticks INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE signal_log (
  id SERIAL PRIMARY KEY,
  algo_id INTEGER REFERENCES algos(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  action TEXT,                              -- 'buy' | 'sell'
  symbol TEXT,
  status TEXT,                              -- 'executed' | 'blocked_kill_switch' | 'blocked_schedule' | 'error'
  error_message TEXT,
  entry_price NUMERIC,
  exit_price NUMERIC,
  pnl NUMERIC,
  order_sets_fired INTEGER
);

-- Created dynamically by scripts route on first use (ALTER TABLE IF NOT EXISTS pattern)
CREATE TABLE IF NOT EXISTS pine_scripts (
  id SERIAL PRIMARY KEY,
  algo_id INTEGER REFERENCES algos(id) ON DELETE CASCADE,
  filename TEXT,
  content TEXT,                             -- original Pine Script
  analysis JSONB,                           -- Claude analysis output (summary, questions, etc.)
  final_config JSONB,                       -- merged config after user answers questions
  alert_script TEXT,                        -- Claude-generated modified script with alertcondition() calls
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Complete File Tree

```
Trade Flow/
├── HANDOFF.md                          ← This file (read first)
├── Claude.MD.md                        ← Product spec + build roadmap
├── backend/
│   ├── .env                            ← DATABASE_URL, PORT, ANTHROPIC_API_KEY
│   ├── package.json
│   ├── schema.sql                      ← Core DB schema (algos, order_sets, signal_log)
│   └── src/
│       ├── index.js                    ← Express + WS server, cron job, localtunnel, /public-url
│       ├── db.js                       ← pg pool
│       ├── ws.js                       ← WebSocket broadcast helper
│       ├── routes/
│       │   ├── algos.js                ← CRUD algos/order-sets, signals, reset-kill-switch, test-signal
│       │   ├── webhook.js              ← TradingView webhook handler → processSignal()
│       │   └── scripts.js             ← Pine Script analyze, config, alert-script, get-by-algo
│       └── services/
│           ├── orderEngine.js          ← Signal processing pipeline (kill switch → schedule → orders)
│           ├── mockBroker.js           ← Simulated trade execution ← REPLACE THIS FOR TRADOVATE
│           ├── killSwitch.js           ← Daily loss limit logic
│           └── pineAnalyzer.js         ← Claude API calls (analyzeScript + generateAlertScript)
└── frontend/
    ├── index.html                      ← Google Fonts (Inter + JetBrains Mono)
    ├── package.json
    ├── vite.config.js                  ← Proxy: /algos, /webhook, /scripts, /public-url → localhost:3001
    └── src/
        ├── App.jsx                     ← Router + ToastProvider + Particles + scan-lines
        ├── api.js                      ← axios wrapper + connectWS() + all API calls (sendTestSignal accepts payload)
        ├── index.css                   ← Full design system + animation classes + grid classes + media queries
        ├── main.jsx
        ├── context/
        │   └── AuthContext.jsx         ← Auth state pattern (follow this for ThemeContext)
        ├── pages/
        │   ├── Dashboard.jsx           ← Algo grid + summary stats + live clock (mobile-responsive)
        │   ├── AlgoDetail.jsx          ← Algo config + signal log + order sets + indicator wizard + schedule builder + webhook tester
        │   └── Settings.jsx            ← Tradovate credentials + notification settings ← ADD THEME TOGGLE HERE
        └── components/
            ├── AlgoCard.jsx            ← 3D tilt + spotlight + sonar + live border + spring click animation
            ├── OrderSetForm.jsx        ← Order set config form
            ├── SignalLog.jsx           ← Signal history table with animations
            ├── AnimatedNumber.jsx      ← Animated counter
            ├── Sparkline.jsx           ← recharts mini chart
            ├── Toast.jsx               ← Toast notification system
            ├── Tooltip.jsx             ← Hover tooltip
            ├── Particles.jsx           ← Canvas particle background
            └── wizard/
                ├── IndicatorWizard.jsx ← 3-step wizard container + ConfiguredView
                ├── ScriptUploader.jsx  ← Step 1: drag-drop/paste Pine Script
                ├── OrderSetConfig.jsx  ← Step 2: AI question flow + static fallback
                └── SetupGuide.jsx      ← Step 3: copy script + create alerts + test
```

---

## Key Backend Routes (Full Reference)

### Algos (`backend/src/routes/algos.js`)
```
GET    /algos                       — list all algos
POST   /algos                       — create algo
GET    /algos/:id                   — get algo
PUT    /algos/:id                   — update algo
DELETE /algos/:id                   — delete algo
POST   /algos/:id/reset-kill-switch — manually reset kill switch
GET    /algos/:id/order-sets        — list order sets for algo
POST   /algos/:id/order-sets        — create order set
PUT    /algos/:id/order-sets/:osId  — update order set
DELETE /algos/:id/order-sets/:osId  — delete order set
GET    /algos/:id/signals           — last 50 signals
POST   /algos/:id/test-signal       — fire fake buy signal through full pipeline
```

### Scripts (`backend/src/routes/scripts.js`)
```
POST   /scripts/analyze             — body: { content, filename, algoId } → { scriptId, ...analysis, questions[6] }
PATCH  /scripts/:scriptId/config    — body: { final_config } → saves to pine_scripts.final_config
POST   /scripts/:scriptId/alert-script — calls Claude to generate modified script → { alertScript }
GET    /scripts/algo/:algoId        — returns pine_scripts row for an algo (includes analysis, final_config, alert_script)
```

### Webhook (`backend/src/routes/webhook.js`)
```
POST   /webhook/:webhookId          — body: { symbol, action, price? } → processSignal()
```

### Misc (`backend/src/index.js`)
```
GET    /public-url                  — returns { url: string|null } — the localtunnel public HTTPS URL
```

---

## Key Service Details

### `pineAnalyzer.js` — `analyzeScript()` response shape
```json
{
  "summary": "2-3 sentence plain English description",
  "scriptType": "indicator" | "strategy",
  "buyConditionName": "exact alertcondition name or 3-6 word description",
  "sellConditionName": "same for sell",
  "buyAlertJson": { "symbol": "{{ticker}}", "action": "buy", "price": "{{close}}" },
  "sellAlertJson": { "symbol": "{{ticker}}", "action": "sell", "price": "{{close}}" },
  "suggestedOrderSet": {
    "entry_type": "market" | "limit_signal",
    "profit_target_ticks": 20,
    "stop_ticks": 15,
    "stop_type": "fixed" | "trailing",
    "breakeven_enabled": false,
    "breakeven_ticks": null
  },
  "questions": [
    { "id": "contracts",            "type": "number",            "question": "...", "default": 1,        "unit": "contracts", "min": 1 },
    { "id": "entry_type",           "type": "choice",            "question": "...", "options": [...],   "default": "market" },
    { "id": "profit_target_ticks",  "type": "number",            "question": "...", "default": 20,       "unit": "ticks", "min": 1 },
    { "id": "stop_ticks",           "type": "number",            "question": "...", "default": 15,       "unit": "ticks", "min": 1 },
    { "id": "stop_type",            "type": "choice",            "question": "...", "options": [...],   "default": "fixed" },
    { "id": "breakeven",            "type": "toggle_with_number","question": "...", "default_enabled": false, "default_value": 10, "unit": "ticks in profit" }
  ]
}
```

### `mockBroker.js` — `placeOrder(orderSet, signal)` interface
```javascript
// Input:
//   orderSet: { entry_type, profit_target_ticks, stop_ticks, stop_type, contracts, ... }
//   signal:   { action: 'buy'|'sell', symbol: 'MNQ1!', price?: number }
//
// Returns (synchronous):
//   { filled: true, entryPrice, exitPrice, pnl, orderId }
```
**This is the ONLY file that changes when wiring in Tradovate. The interface must stay identical.**

### `orderEngine.js` — `processSignal(algo, signal)` pipeline
1. Kill switch check → block if triggered
2. Schedule check → block if outside window
3. Get active order sets from DB
4. Fire all order sets in parallel via `mockBroker.placeOrder()`
5. Aggregate P&L, log to signal_log
6. Update `algos.daily_pnl`
7. Re-check kill switch threshold → trigger if exceeded
8. WebSocket broadcast

---

## Development Environment

**Start backend:** `cd "Trade Flow/backend" && npm run dev` (port 3001, nodemon)
**Start frontend:** `cd "Trade Flow/frontend" && npm run dev` (port 5173 or 5174)

**Backend `.env` file** (`backend/.env`):
```
DATABASE_URL=postgresql://localhost:5432/tradeflow
PORT=3001
ANTHROPIC_API_KEY=sk-ant-...
```

**Backend dependencies installed:** express, cors, dotenv, pg, ws, uuid, axios, @anthropic-ai/sdk, localtunnel, node-cron

**Frontend dependencies installed:** react, react-router-dom, vite, recharts, axios

---

## Architecture Decisions Already Made (Don't Re-Debate)

1. **No HUD corner brackets** — caused visual artifacts from `overflow: hidden` on `.glass`. Do not re-add.
2. **Neon glow is subtle** — P&L text-shadow capped at `rgba(0,230,118,0.45)`. User said "a little less, it's overwhelming."
3. **mockBroker.js is intentional** — real Tradovate integration is the next task. Its interface is fixed.
4. **recharts is already installed** — use it for any charts.
5. **WebSocket is simple broadcast** — no rooms, no auth. Fine for current stage.
6. **questions array fallback** — `OrderSetConfig` checks `analysis.questions?.length === 6` and falls back to static form for old scripts in DB.
7. **localtunnel is temporary** — Railway deployment will give a permanent HTTPS URL. localtunnel is good enough for local dev.

---

## ── NEXT TASK: Light/Dark Mode Toggle ─────────────────────────────────────

### What this is
Add a theme toggle in Settings that switches the entire app between dark mode (current default) and light mode. User quote: *"allow a toggle that can switch the entire software from dark mode to light mode."*

### Implementation approach

**1. CSS — `frontend/src/index.css`**
Add `[data-theme="light"]` selector that overrides all CSS custom properties defined on `:root`:
- `--bg` → white/light gray
- `--glass` → rgba(255,255,255,0.7) with blur
- `--text-main` → near-black
- `--text-muted` → medium gray
- `--border` → light gray
- Keep `--blue`, `--green`, `--red` accent colors the same (or slightly adjust saturation)
- Adjust `.glass` box-shadow and glassmorphic effects for light backgrounds

**2. Theme Context — `frontend/src/context/ThemeContext.jsx`** (new file)
- Reads `localStorage.getItem('theme')` on init (default: `'dark'`)
- Applies `document.documentElement.setAttribute('data-theme', theme)` immediately
- Exposes `{ theme, toggleTheme }` via context

**3. App.jsx — wrap with `<ThemeProvider>`**

**4. Settings.jsx — add "Appearance" section**
- Toggle switch (same `.toggle` class used elsewhere)
- Label: "Light mode" / "Dark mode"
- Calls `toggleTheme()` from context

### Key files to read first:
- `frontend/src/index.css` — `:root` block has all CSS vars to override
- `frontend/src/pages/Settings.jsx` — add toggle here
- `frontend/src/App.jsx` — wrap with ThemeProvider
- `frontend/src/context/AuthContext.jsx` — follow this pattern for ThemeContext

### DO NOT change:
- Animation classes (`page-enter`, `rise-1/2/3`) — they're already optimized
- Any blur filters in animations — already removed for performance

---

## ── FUTURE TASK: Tradovate Broker Integration ──────────────────────────────

### What this is
Replace `backend/src/services/mockBroker.js` with real Tradovate API calls. The comment in the file says it explicitly: *"This is the ONLY file that changes when we wire in a real broker (Tradovate). The interface stays identical."*

### Files to create/modify
| File | What to do |
|------|-----------|
| `backend/src/services/tradovateBroker.js` | **Create** — the real broker implementation |
| `backend/src/services/mockBroker.js` | **Replace** the require in orderEngine with tradovateBroker (or rename) |
| `backend/src/services/orderEngine.js` | **Make `_executeOrderSet` async** — currently synchronous because mockBroker is sync |
| `backend/.env` | **Add** Tradovate credentials |
| `backend/src/routes/algos.js` (or new route) | **Add** Tradovate credential storage per algo (or per user when accounts exist) |

### Tradovate API Details

**Environments:**
- Demo: `https://demo.tradovateapi.com/v1`
- Live: `https://live.tradovateapi.com/v1`

**Authentication:**
```
POST /auth/accesstokenrequest
Body: {
  "name": "your_username",
  "password": "your_password",
  "appId": "TradeFlow",
  "appVersion": "1.0",
  "cid": 12345,       ← from Tradovate developer app registration
  "sec": "secret"     ← from Tradovate developer app registration
}
Response: {
  "accessToken": "...",
  "expirationTime": "...",
  "userId": 123456,
  "accountId": 789012,
  "name": "...",
  "hasLive": false
}
```

**Order placement:**
```
POST /order/placeorder
Headers: { Authorization: "Bearer {accessToken}" }
Body: {
  "accountId": 789012,
  "symbol": "MNQM5",         ← Tradovate contract name (NOT TradingView symbol)
  "action": "Buy",           ← "Buy" or "Sell" (capitalized, unlike our "buy"/"sell")
  "orderQty": 1,
  "orderType": "Market"      ← "Market" or "Limit"
  // "price": 19500           ← required for Limit orders
}
Response: { "orderId": 123 }
```

**Bracket orders (TP + SL):**
Tradovate supports OSO (one-sends-other) bracket orders via `/order/placeoso`. This sends entry + TP + SL as a single atomic request. Recommended approach for TradeFlow. Alternatively, place TP and SL as separate orders after fill confirmation.

**Account info:**
```
GET /account/list           ← lists accounts for the authenticated user
GET /position/list          ← lists open positions
```

### Symbol Mapping Problem
TradingView uses continuous contract symbols like `MNQ1!`, `ES1!`. Tradovate uses specific contract names like `MNQM5` (March 2025), `MNQU5` (Sep 2025).

**You need to resolve the front-month contract.** Options:
1. `GET /contract/find?name=MNQ` — Tradovate endpoint that finds a contract by product name
2. `GET /product/find?name=MNQ` → then `GET /contract/list` filtered by productId, sorted by expiry
3. Hardcode a mapping that refreshes quarterly (simpler for MVP)

Recommended approach: query `GET /contract/find?name={root}` where root is extracted from the TradingView symbol (strip `1!`, `!`, etc.). This returns the front-month contract details including the exact Tradovate name.

### Required New Env Vars
Add to `backend/.env`:
```
TRADOVATE_USERNAME=your_username
TRADOVATE_PASSWORD=your_password
TRADOVATE_CID=12345
TRADOVATE_SECRET=your_app_secret
TRADOVATE_APP_ID=TradeFlow
TRADOVATE_MODE=demo          ← 'demo' or 'live'
```

### `_executeOrderSet` Must Become Async
Currently in `orderEngine.js`:
```javascript
function _executeOrderSet(orderSet, signal) {
  try {
    const result = mockBroker.placeOrder(orderSet, signal); // synchronous
    return result;
  } catch (err) { ... }
}
```

Must become:
```javascript
async function _executeOrderSet(orderSet, signal) {
  try {
    const result = await tradovateBroker.placeOrder(orderSet, signal); // async
    return result;
  } catch (err) { ... }
}
```
`Promise.all()` already wraps the calls so this change is minimal.

### TP/SL Management with Tradovate
mockBroker simulates instant TP fills. With Tradovate, you have two options:

**Option A — Bracket orders (recommended):**
Place entry + TP limit + stop loss as a single `/order/placeoso` request. Tradovate manages all legs. `placeOrder()` returns immediately after the bracket is placed; actual P&L comes from fill events via WebSocket or polling.

**Option B — Manage TP/SL in code:**
Place market entry, get fill price, then place separate limit order (TP) and stop order (SL). More control but more code.

For MVP, Option A is cleaner and more reliable. Tradovate handles the position management.

### P&L Tracking with Real Fills
With mockBroker, P&L is calculated immediately. With real Tradovate:
- P&L is only known when the exit order fills
- You need to listen to fill events via Tradovate WebSocket (`wss://md.tradovateapi.com/v1/websocket`) or poll `GET /fill/list`
- **For MVP:** place the bracket, return `{ filled: true, entryPrice, pnl: null }` immediately, and update P&L asynchronously when the exit fills

### Testing
1. Add Tradovate demo credentials to `.env`
2. Use the existing "Send Test Signal" button — it fires `{ action: 'buy', symbol: 'MNQ1!' }` through the full pipeline
3. Check your Tradovate demo account for the placed order
4. Verify order appears in Signal Log with actual entry price

---

## User & Product Context

- **Target users:** Prop firm traders (FTMO, Apex, Topstep) who use TradingView for charting
- **Business model:** SaaS subscription ($37–$87/mo) — billing not yet built
- **Design aesthetic:** "JARVIS meets Apple" — dark glassmorphism, neon accents, smooth animations
- **UX principle:** Beginner first. Plain English labels, no jargon on the surface
- **The developer:** Building this as a real product. Prioritize shipping real value fast.

---

## ── SISTER-AGENT PROMPT ─────────────────────────────────────────────────────

> Copy everything below this line and use it as the starting prompt for a new Claude Code session.

---

You are continuing development on **TradeFlow**, a trading automation platform. Read `HANDOFF.md` and the memory files first — they have complete context on everything built so far.

**Your immediate task: Light/Dark Mode Toggle**

The user asked: *"in the settings allow a toggle that can switch the entire software from dark mode to light mode."*

**What to build:**
1. Add `[data-theme="light"]` CSS overrides in `frontend/src/index.css` — the entire design system uses CSS custom properties on `:root`, so overriding them under this selector will recolor everything
2. Create `frontend/src/context/ThemeContext.jsx` — reads/writes `localStorage`, applies `data-theme` to `document.documentElement`. Follow the pattern in `frontend/src/context/AuthContext.jsx`
3. Wrap `frontend/src/App.jsx` with `<ThemeProvider>`
4. Add an "Appearance" section to `frontend/src/pages/Settings.jsx` with a toggle switch (use the existing `.toggle` CSS class)

**Key files to read before touching anything:**
- `frontend/src/index.css` — `:root` block has all the CSS vars you need to override
- `frontend/src/pages/Settings.jsx` — where the toggle goes
- `frontend/src/App.jsx` — wrap with ThemeProvider
- `frontend/src/context/AuthContext.jsx` — pattern to follow for ThemeContext

**How to start servers:**
```bash
cd "Trade Flow/backend" && npm run dev   # port 3001
cd "Trade Flow/frontend" && npm run dev  # port 5173
```

**DO NOT re-add:** HUD corner brackets, blur filters on animations (both removed intentionally — see HANDOFF.md).

---

*(Below is the old Tradovate sister-agent prompt — keep for future reference)*

---

You are being handed a partially-built trading automation platform called **TradeFlow**. Your job is to connect it to its real broker: **Tradovate**.

## What TradeFlow Is

TradeFlow lets traders connect any TradingView indicator to automated trade execution. It runs as a local web app (Express backend + React frontend). TradingView sends a webhook when an indicator fires a signal. TradeFlow receives it, checks risk rules, and places trades on behalf of the user.

The full product spec is in `Claude.MD.md`. Read `HANDOFF.md` for the complete technical context (you're already reading it).

## What Has Already Been Built

Everything works end-to-end except for real broker execution. The pipeline is:

```
TradingView alert → POST /webhook/:webhookId
  → orderEngine.processSignal(algo, signal)
    → kill switch check
    → schedule check
    → fire all active order sets via mockBroker.placeOrder()
    → log result to signal_log
    → broadcast via WebSocket to frontend
```

The frontend has a 3-step indicator wizard that lets users upload Pine Script → get AI-generated setup questions → create their order set → get a modified script to paste into TradingView. The test signal button is already built.

## Your Specific Task

Replace `backend/src/services/mockBroker.js` with real Tradovate API calls.

**The comment in mockBroker.js says exactly:**
> "This is the ONLY file that changes when we wire in a real broker (Tradovate). The interface stays identical."

The interface is:
```javascript
// placeOrder(orderSet, signal) must return:
// { filled: true|false, entryPrice, exitPrice, pnl, orderId }
// orderSet = DB row from order_sets table
// signal   = { action: 'buy'|'sell', symbol: 'MNQ1!', price?: number }
```

## Tradovate API Reference

**Base URLs:**
- Demo: `https://demo.tradovateapi.com/v1`
- Live: `https://live.tradovateapi.com/v1`

**Auth — POST /auth/accesstokenrequest:**
```json
{
  "name": "username",
  "password": "password",
  "appId": "TradeFlow",
  "appVersion": "1.0",
  "cid": 12345,
  "sec": "app_secret"
}
```
Returns `{ accessToken, expirationTime, userId, accountId }`.

**Order placement — POST /order/placeorder:**
```json
{
  "accountId": 789012,
  "symbol": "MNQM5",
  "action": "Buy",
  "orderQty": 1,
  "orderType": "Market"
}
```

**Symbol mapping:** TradingView uses `MNQ1!`. Tradovate uses `MNQM5` (front-month).
Use `GET /contract/find?name=MNQ` to resolve the current front-month contract.
Strip the TradingView suffix: `MNQ1!` → `MNQ`, `ES1!` → `ES`, etc.

**Bracket orders (TP + SL):** Use `POST /order/placeoso` to place entry + take-profit limit + stop loss as a single atomic bracket. This is the cleanest approach — Tradovate manages all legs.

## Files to Work With

| File | What to do |
|------|-----------|
| `backend/src/services/mockBroker.js` | Read this first — it shows the interface to replicate |
| `backend/src/services/orderEngine.js` | Make `_executeOrderSet()` async (currently sync because mockBroker is sync) |
| `backend/src/services/tradovateBroker.js` | **Create this** — the real implementation |
| `backend/.env` | **Add** Tradovate credentials (see required vars below) |
| `backend/src/routes/algos.js` | Reference — shows how `processSignal` is called |

## Required New Env Vars

Add to `backend/.env`:
```
TRADOVATE_USERNAME=
TRADOVATE_PASSWORD=
TRADOVATE_CID=
TRADOVATE_SECRET=
TRADOVATE_APP_ID=TradeFlow
TRADOVATE_MODE=demo
```

## How to Start the Servers

```bash
cd "Trade Flow/backend" && npm run dev   # port 3001
cd "Trade Flow/frontend" && npm run dev  # port 5173
```

## How to Test

1. Add your Tradovate demo credentials to `backend/.env`
2. Start the backend
3. Open the frontend at http://localhost:5173
4. Open any algo → Setup Indicator tab
5. Use the "Send Test Signal" button — it fires `{ action: 'buy', symbol: 'MNQ1!' }` through the full pipeline
6. Check your Tradovate demo account for the placed order

## Key Things NOT to Change

- The `placeOrder(orderSet, signal)` function signature
- `orderEngine.js` logic beyond making `_executeOrderSet` async
- The frontend — it's already built and working
- The kill switch and schedule logic

## Important Context From Previous Sessions

- No HUD corner brackets on the UI — they cause visual artifacts. Do not re-add.
- Neon P&L glow is intentionally subtle — user said don't make it overwhelming.
- recharts is already installed for any charts you might add.
- localtunnel is already handling public webhook URLs — don't touch that.
- The `pine_scripts` table exists in the database (created by the scripts route).

Good luck. The hardest part (the full pipeline) is already done. You're just replacing one service file.
