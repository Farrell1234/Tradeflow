const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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

    // 002 — add user_id to algos
    `ALTER TABLE algos ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,

    // 003 — settings table (per-user; replaces single-row approach)
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

    // 004 — index for fast user lookups
    `CREATE INDEX IF NOT EXISTS idx_algos_user_id ON algos(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_signal_log_algo_id ON signal_log(algo_id)`,
    `CREATE INDEX IF NOT EXISTS idx_signal_log_received_at ON signal_log(received_at DESC)`,

    // 005 — advanced trailing stop fields
    `ALTER TABLE order_sets ADD COLUMN IF NOT EXISTS trail_activation_ticks INTEGER DEFAULT 0`,
    `ALTER TABLE order_sets ADD COLUMN IF NOT EXISTS trail_step_ticks INTEGER DEFAULT 0`,
    `ALTER TABLE order_sets ADD COLUMN IF NOT EXISTS trail_lock_ticks INTEGER`,
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
