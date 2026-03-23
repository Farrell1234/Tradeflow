# TradeFlow — CLAUDE.md
> This file contains all context for building TradeFlow. Read this entire file before writing any code or making any decisions.

---

## What is TradeFlow?

TradeFlow is a web-based trade automation platform. It is the "Shopify of trading algorithms." The core promise is simple: any trader — even a beginner with zero coding knowledge — can take any TradingView indicator they already use and turn it into a fully automated trading algorithm that executes live trades on their behalf.

The product solves one specific problem that every retail trader faces: **psychology**. Traders lose money because of fear, greed, hesitation, and revenge trading. TradeFlow removes the human from the execution entirely. If you have an indicator you trust, TradeFlow gives you the machine that executes it without emotion.

**Primary target customer:** Prop firm traders. These are traders who are funded by a firm (like FTMO, Apex, Topstep) and trade with firm capital. They have strict rules — max daily loss limits, consistency requirements — and they cannot afford emotional trading. They already have TradingView open. They already have capital. They just need the automation layer.

**The business model has two layers:**
1. Monthly subscription revenue from retail traders paying to use the platform
2. Crowdsourced alpha — because TradeFlow owns the platform, it can see which algorithms are actually profitable across all users. The best performing strategies get identified and traded internally.

---

## The Tech Stack

- **Frontend:** React web app (clean, minimal, beginner-friendly UI)
- **Backend:** Node.js with Express
- **Database:** PostgreSQL (user accounts, algo configs, trade logs)
- **Broker integration:** Tradovate REST API + WebSocket
- **Signal source:** TradingView webhooks
- **Hosting:** Railway
- **Payments:** Stripe
- **Future:** iOS app (React Native), NinjaTrader support

---

## How the System Works — End to End

```
TradingView indicator fires alert
        ↓
POST request sent to user's unique webhook URL
        ↓
TradeFlow webhook receiver parses the JSON payload
        ↓
Risk engine checks: kill switch triggered? Outside schedule? 
        ↓
If cleared: all active order sets execute simultaneously on Tradovate
        ↓
Each order set manages itself independently (TP, SL, trail, breakeven)
        ↓
Trade result logged to dashboard in real time
```

### Webhook Payload Format
TradingView sends a JSON body when an alert fires. The standard payload format TradeFlow expects:

```json
{
  "symbol": "MNQ1!",
  "action": "buy",
  "qty": 1
}
```

Every user gets a unique webhook URL: `https://tradeflow.app/webhook/{user_id}/{algo_id}`

This means multiple algos per user are supported — each algo has its own URL, its own settings, and its own order sets.

---

## Tradovate Integration

Tradovate is the broker. TradeFlow connects to Tradovate on behalf of the user using their API credentials.

### Authentication Flow
1. User enters their Tradovate API credentials in TradeFlow settings (username, password, app ID, app secret)
2. TradeFlow calls `POST /auth/accesstokenrequest` to get an access token
3. Token is stored securely and refreshed automatically
4. All order placement calls use this token in the Authorization header

### Order Placement
- Endpoint: `POST /order/placeorder`
- Required fields: accountId, symbol, action (Buy/Sell), orderQty, orderType (Market or Limit)
- For limit orders: price field required
- For stop orders: stopPrice field required

### Tradovate Environments
- Demo: `https://demo.tradovateapi.com/v1`
- Live: `https://live.tradovateapi.com/v1`

Users should always start on demo. The environment is a setting in their TradeFlow account.

---

## Core Features — Full Specification

### 1. Dashboard
The main screen. Shows all of the user's algos as cards. This is the first thing a user sees when they log in.

Each algo card displays:
- Algo name
- Status badge: Live (green) / Paused (yellow) / Kill switch triggered (red)
- Today's P&L
- Number of trades taken today
- Last signal received timestamp
- Quick toggle to pause/resume the algo

The dashboard also shows a global summary at the top:
- Total P&L across all algos today
- Total trades today
- Number of algos currently live

**Design principle: a beginner should understand everything on this screen in 30 seconds. No jargon, no complexity on the surface.**

---

### 2. Algo Setup

Each algo has:
- A name (user defined)
- A unique webhook URL (auto-generated)
- A connected Tradovate account
- A schedule (optional)
- A kill switch (required)
- One or more order sets

#### Webhook URL
Auto-generated when the algo is created. Displayed prominently with a one-click copy button. Simple instructions shown inline: "Paste this URL into your TradingView alert webhook field."

#### Tradovate Account Connection
User enters:
- Tradovate username
- Tradovate password
- App ID
- App secret
- Demo or live toggle

TradeFlow tests the connection and shows a green "Connected" badge when successful.

---

### 3. Kill Switch

When the algo's total loss for the day exceeds the threshold, the kill switch triggers and the algo stops accepting new signals.

Settings:
- **Max loss amount** — dollar amount (e.g. $500). When daily loss hits this number, algo pauses.
- **Pause duration** — how long the algo stays paused after the kill switch triggers:
  - 1 hour
  - 2 hours
  - 4 hours
  - Rest of day (resets at midnight)
  - Manual reset only (stays off until user manually turns it back on)

When kill switch is triggered:
- Algo card turns red on dashboard
- Badge shows "Kill switch — resumes at [time]" or "Kill switch — manual reset required"
- Any incoming webhook signals during this period are ignored and logged as "blocked by kill switch"
- Existing open trades are NOT closed — only new entries are blocked

Daily reset: P&L counter resets at midnight local time (user's timezone).

---

### 4. Scheduling

Optional feature per algo. When enabled, the algo only accepts new trade signals during the defined time window.

Settings:
- **Enable/disable toggle**
- **Start time** (e.g. 9:30 AM)
- **End time** (e.g. 11:30 AM)
- **Timezone** (default to user's local timezone)
- **Days active** (checkboxes: Mon, Tue, Wed, Thu, Fri — default all checked)

Outside of the schedule window, incoming signals are ignored and logged as "blocked by schedule."

---

### 5. Order Sets

This is the core trading logic. One algo can have multiple order sets. When a signal fires, ALL active order sets execute simultaneously from the same entry point.

**Example:**
Signal fires → BUY MNQ
- Order set 1: 1 contract, market entry, 20 tick TP, 20 tick fixed SL → quick scalp
- Order set 2: 1 contract, market entry, 40 tick TP, trailing 20 tick SL → runner

Both open at the same time from the same entry. They manage themselves independently.

#### Per Order Set Settings:

**Contracts**
- Number of contracts for this order set (integer, minimum 1)

**Entry Type**
- Market — enters immediately at market price when signal fires
- Limit — enters at a specified price offset from signal price (e.g. 2 ticks better than current price)

**Profit Target**
- Fixed ticks from entry (e.g. 20 ticks)
- This becomes the take profit order placed immediately upon entry

**Stop Loss**
Two modes (user selects one):

*Fixed stop loss:*
- Set X ticks from entry
- Stop does not move
- Example: 20 tick fixed stop

*Trailing stop loss:*
- Set X ticks trail distance
- As price moves in favor, stop follows at X ticks distance
- If price reverses X ticks from its best point, stop is hit
- Example: 20 tick trail — if price moves 30 ticks in favor, stop is now 10 ticks in profit

**Breakeven**
- Optional toggle per order set
- When enabled: set X ticks
- When price moves X ticks in favor, stop loss automatically moves to entry price (breakeven)
- Breakeven triggers before trailing stop logic if both are enabled
- Example: breakeven at 10 ticks — once price is 10 ticks profitable, stop moves to entry, trader cannot lose on this position

**Order Set Status**
- Each order set can be individually enabled or disabled without deleting it
- Disabled order sets are skipped when a signal fires

---

### 6. Signal Log

Per algo, a running log of every signal received and what happened:

Each log entry shows:
- Timestamp
- Signal received (BUY or SELL)
- Symbol
- Status: Executed / Blocked by kill switch / Blocked by schedule / Error
- For executed trades: entry price, exit price, P&L, which order sets fired

---

### 7. Performance Tracking

Per algo metrics:
- Total trades
- Win rate
- Average winner (ticks and dollars)
- Average loser (ticks and dollars)
- Profit factor
- Best day
- Worst day
- Equity curve (simple line chart)

Global across all algos:
- Total P&L all time
- Best performing algo
- Most active algo

---

## User Onboarding Flow

This must be as simple as possible. Four steps:

**Step 1 — Create account**
Email and password. That's it.

**Step 2 — Connect Tradovate**
Enter API credentials. Test connection. Show green checkmark when connected. Recommend starting on demo.

**Step 3 — Create your first algo**
Give it a name. Webhook URL is auto-generated and shown immediately with copy button and TradingView setup instructions.

**Step 4 — Set up your order set**
Guided form: contracts, entry type, profit target, stop loss. Sensible defaults pre-filled so beginners can just hit save.

After step 4: dashboard loads with their first algo card showing as Live.

Total time target: under 5 minutes from signup to first algo live.

---

## UI/UX Principles

These principles govern every design and product decision:

1. **Beginner first.** If a beginner trader cannot understand a feature in 30 seconds, it needs to be simplified or hidden behind an "advanced" toggle.

2. **Shopify standard.** Every UI decision should be benchmarked against Shopify's simplicity. Complex functionality, dead simple surface.

3. **Everything at a glance.** Traders should be able to open the dashboard and know the full status of all their algos in under 10 seconds without clicking anything.

4. **No jargon on the surface.** Labels like "webhook endpoint" become "your signal URL." Labels like "order qty" become "contracts." Technical terms live in tooltips, not in the main UI.

5. **Mobile aware.** The web app should be fully functional on mobile browsers even before the iOS app is built. Responsive design from day one.

6. **Speed.** Real-time updates. Signal log updates the moment a webhook fires. No refresh required.

---

## Build Roadmap

### ✅ V1 — Core pipe (COMPLETE)
- [x] Node.js Express server with webhook receiver endpoint
- [x] MockBroker order simulation (Tradovate integration is next)
- [x] Market entry, fixed TP, fixed SL, trailing SL, breakeven per order set
- [x] Kill switch (dollar threshold + pause duration options)
- [x] Dashboard (algo cards, signal log, real-time P&L)
- [x] Multiple order sets per algo
- [x] Scheduling (time-based restrictions with timezone)
- [x] Real-time WebSocket updates
- [x] JARVIS-level UI (glassmorphism, 3D tilt, neon glow, sonar dots, particles)
- [ ] User accounts (email/password auth) — not yet built
- [ ] Stripe billing — not yet built
- [ ] Deploy to Railway — not yet done

### ✅ V1.5 — Complete
- [x] **Pine Script Upload + AI Analysis** — 3-step wizard: upload → AI questions → create order set → modified script for TradingView
- [x] **AI-generated setup questions** — Claude writes 6 personalised questions based on the actual indicator, creates order set from answers
- [x] **localtunnel public URL** — backend auto-creates HTTPS tunnel on startup; frontend fetches and displays the public webhook URL
- [x] **Test signal button** — fire a fake signal through the full pipeline to verify TradingView connection

### 🔄 V2 — In Progress / Immediate Next
Goal: real broker execution, user accounts, billing.

- [ ] **Real Tradovate integration (replace mockBroker.js)** ← TOP PRIORITY — see HANDOFF.md for full spec
- [ ] Railway deployment — permanent HTTPS URL (replaces localtunnel)
- [ ] User accounts (email/password auth)
- [ ] Stripe billing ($37–$87/month tiers)
- [ ] Performance tracking and equity curve page
- [ ] Scheduling UI (backend done, just needs frontend wiring)

### V3 — Build the moat
Goal: crowdsourced alpha layer, community, mobile.

- [ ] Leaderboard (top performing algos across all users, anonymized)
- [ ] Inner circle — internal tracking of best strategies
- [ ] iOS app (React Native)
- [ ] NinjaTrader support
- [ ] Advanced analytics

> **See HANDOFF.md for full technical context, current codebase state, and detailed spec for the Pine Script feature.**

---

## Competitive Positioning

**Main competitor:** Shark Indicators
- Desktop software only (must download and install)
- NinjaTrader only — does not support Tradovate
- Outdated UI, not beginner friendly
- No web dashboard, no mobile
- No community or leaderboard layer
- Does not support any TradingView indicator — requires their proprietary indicators

**TradeFlow advantages:**
- Web-based — nothing to download
- Tradovate support from day one
- Works with ANY TradingView indicator via webhooks
- Built for beginners, usable by professionals
- Community layer and leaderboard (V3)
- Built with AI-assisted development — ships 10x faster

---

## Pricing Strategy (Placeholder)

- **Starter:** $37/month — 1 algo, 2 order sets, Tradovate demo only
- **Pro:** $67/month — unlimited algos, unlimited order sets, live trading
- **Elite:** $87/month — Pro + performance analytics + leaderboard access

---

## Key Technical Decisions

**Why webhooks and not a direct TradingView integration?**
TradingView does not offer a public API for reading chart data or indicator values in real time. Webhooks are the only supported bridge. This is fine — it means setup is a one-time 2-minute process for the user (set up an alert, paste the URL) and from that point the pipe is fully automatic.

**Why Tradovate first?**
Tradovate has a modern REST + WebSocket API, supports retail futures traders, and is the platform most prop firm traders use. NinjaTrader will be added in V2/V3 but Tradovate is the faster, cleaner integration to start.

**Why Railway for hosting?**
Fast to deploy, handles Node.js natively, gives a live public HTTPS URL immediately (required for TradingView webhooks), scales easily, low cost to start.

**Why Node.js?**
Fast enough for webhook processing, massive ecosystem, easy to hire for, Claude Code works extremely well with it.

---

## Notes for Claude Code Sessions

- Always prioritize simplicity over cleverness
- Every user-facing string should be plain English, no technical jargon
- All dollar amounts displayed with 2 decimal places
- All times displayed in user's local timezone
- Webhook processing must be fast — target under 200ms from receipt to order placed
- All Tradovate API calls must have error handling with clear error messages stored in the signal log
- Never expose raw API errors to the user — translate them to plain English
- The kill switch check must happen BEFORE any order is placed, never after
- Order sets execute in parallel, not sequentially
- Demo mode and live mode must be visually distinct — large banner or badge when in demo mode so users never confuse the two
