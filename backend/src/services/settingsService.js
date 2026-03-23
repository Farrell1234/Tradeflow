/**
 * settingsService.js
 * Per-user credential storage. Each user has one row in the settings table.
 * Falls back to process.env for any null field (so .env still works as seed).
 */

const db = require('../db');

async function init() {} // Table created by db.migrate()

// ── Read ──────────────────────────────────────────────────────────────────────

async function getSettings(userId) {
  if (userId) {
    const { rows: [row] } = await db.query(
      'SELECT * FROM settings WHERE user_id = $1',
      [userId]
    );
    return _merge(row || {});
  }
  return _merge({});
}

function _merge(row) {
  return {
    anthropic_api_key:  row.anthropic_api_key  || process.env.ANTHROPIC_API_KEY  || null,
    tradovate_username: row.tradovate_username  || process.env.TRADOVATE_USERNAME || null,
    tradovate_password: row.tradovate_password  || process.env.TRADOVATE_PASSWORD || null,
    tradovate_cid:      row.tradovate_cid       || process.env.TRADOVATE_CID      || null,
    tradovate_secret:   row.tradovate_secret    || process.env.TRADOVATE_SECRET   || null,
    tradovate_app_id:   row.tradovate_app_id    || process.env.TRADOVATE_APP_ID   || 'TradeFlow',
    tradovate_mode:     row.tradovate_mode      || process.env.TRADOVATE_MODE     || 'demo',
    broker_mode:        row.broker_mode         || process.env.BROKER             || 'mock',
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

const ALLOWED_FIELDS = [
  'anthropic_api_key', 'tradovate_username', 'tradovate_password',
  'tradovate_cid', 'tradovate_secret', 'tradovate_app_id',
  'tradovate_mode', 'broker_mode',
];

async function updateSettings(userId, patch) {
  // Ensure the row exists first
  await db.query(
    `INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const sets = [];
  const vals = [];
  let i = 1;

  for (const key of ALLOWED_FIELDS) {
    if (key in patch && patch[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      vals.push(patch[key] || null);
    }
  }

  if (sets.length > 0) {
    sets.push(`updated_at = NOW()`);
    vals.push(userId);
    await db.query(
      `UPDATE settings SET ${sets.join(', ')} WHERE user_id = $${i}`,
      vals
    );
  }

  return getSettings(userId);
}

module.exports = { init, getSettings, updateSettings };
