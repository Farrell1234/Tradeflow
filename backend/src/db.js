const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// ── Migrations — run idempotently on startup ──────────────────────────────────

async function migrate() {
  const migrations = [
    // 001 — users table
    `CREATE TABLE IF NOT EXISTS users (
      id                     SERIAL PRIMARY KEY,
      email                  TEXT UNIQUE NOT NULL,
      password_hash          TEXT NOT NULL,
      stripe_customer_id     TEXT,
      stripe_subscription_id TEXT,
      subscription_status    TEXT DEFAULT 'trialing',
      trial_ends_at          TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
      created_at             TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 002 — algos table
    `CREATE TABLE IF NOT EXISTS algos (
      id                       SERIAL PRIMARY KEY,
      user_id                  INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name                     TEXT NOT NULL,
      is_active                BOOLEAN DEFAULT true,
      webhook_id               TEXT UNIQUE DEFAULT gen_random_uuid()::text,
      kill_switch_amount       NUMERIC DEFAULT 500,
      kill_switch_pause        TEXT DEFAULT 'rest_of_day',
      kill_switch_triggered_at TIMESTAMPTZ,
      daily_pnl                NUMERIC DEFAULT 0,
      schedule_enabled         BOOLEAN DEFAULT false,
      schedule_start           TEXT,
      schedule_end             TEXT,
      schedule_days            TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
      schedule_timezone        TEXT DEFAULT 'America/New_York',
      created_at               TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 003 — order_sets table
    `CREATE TABLE IF NOT EXISTS order_sets (
      id                      SERIAL PRIMARY KEY,
      algo_id                 INTEGER REFERENCES algos(id) ON DELETE CASCADE,
      name                    TEXT DEFAULT 'Order Set',
      is_active               BOOLEAN DEFAULT true,
      contracts               INTEGER DEFAULT 1,
      entry_type              TEXT DEFAULT 'market',
      limit_offset_ticks      INTEGER DEFAULT 2,
      profit_target_ticks     INTEGER DEFAULT 20,
      stop_type               TEXT DEFAULT 'fixed',
      stop_ticks              INTEGER DEFAULT 20,
      breakeven_enabled       BOOLEAN DEFAULT false,
      breakeven_ticks         INTEGER DEFAULT 10,
      trail_activation_ticks  INTEGER DEFAULT 0,
      trail_step_ticks        INTEGER DEFAULT 0,
      trail_lock_ticks        INTEGER
    )`,

    // 004 — signal_log table
    `CREATE TABLE IF NOT EXISTS signal_log (
      id               SERIAL PRIMARY KEY,
      algo_id          INTEGER REFERENCES algos(id) ON DELETE CASCADE,
      action           TEXT,
      symbol           TEXT,
      status           TEXT,
      error_message    TEXT,
      entry_price      NUMERIC,
      exit_price       NUMERIC,
      pnl              NUMERIC,
      order_sets_fired INTEGER DEFAULT 0,
      received_at      TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 005 — settings table (per-user)
    `CREATE TABLE IF NOT EXISTS settings (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
      anthropic_api_key   TEXT,
      tradovate_username  TEXT,
      tradovate_password  TEXT,
      tradovate_cid       TEXT,
      tradovate_secret    TEXT,
      tradovate_app_id    TEXT DEFAULT 'TradeFlow',
      tradovate_mode      TEXT DEFAULT 'demo',
      broker_mode         TEXT DEFAULT 'mock',
      updated_at          TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id)
    )`,

    // 006 — indexes
    `CREATE INDEX IF NOT EXISTS idx_algos_user_id ON algos(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_signal_log_algo_id ON signal_log(algo_id)`,
    `CREATE INDEX IF NOT EXISTS idx_signal_log_received_at ON signal_log(received_at DESC)`,
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.error('[db] Migration error:', err.message, '\nSQL:', sql.slice(0, 80));
    }
  }
  console.log('[db] Migrations complete');
}

module.exports = pool;
module.exports.migrate = migrate;
