const db = require('../db');
const settingsService = require('./settingsService');
const killSwitch = require('./killSwitch');
const { broadcast } = require('../ws');

/**
 * Main entry point. Called by the webhook route.
 * Runs all checks, fires order sets in parallel, logs results.
 *
 * @param {Object} algo   - full algo row from DB
 * @param {Object} signal - { action, symbol, price? }
 */
async function processSignal(algo, signal, userId) {
  const now = new Date();

  // ── 1. Kill switch check ─────────────────────────────────────────────
  const ks = killSwitch.checkKillSwitch(algo);
  if (ks.blocked) {
    await _logSignal(algo.id, signal, 'blocked_kill_switch', { errorMessage: ks.reason });
    broadcast(algo.id, { type: 'signal', algoId: algo.id }, userId);
    return { status: 'blocked_kill_switch', reason: ks.reason };
  }

  // ── 2. Schedule check ────────────────────────────────────────────────
  if (algo.schedule_enabled) {
    const scheduleBlocked = _checkSchedule(algo, now);
    if (scheduleBlocked) {
      await _logSignal(algo.id, signal, 'blocked_schedule', {
        errorMessage: 'Outside trading schedule',
      });
      broadcast(algo.id, { type: 'signal', algoId: algo.id }, userId);
      return { status: 'blocked_schedule' };
    }
  }

  // ── 3. Get active order sets ─────────────────────────────────────────
  const { rows: orderSets } = await db.query(
    `SELECT * FROM order_sets WHERE algo_id = $1 AND is_active = true`,
    [algo.id]
  );

  if (orderSets.length === 0) {
    await _logSignal(algo.id, signal, 'error', { errorMessage: 'No active order sets' });
    return { status: 'error', reason: 'No active order sets' };
  }

  // ── 4. Fire all order sets in parallel ───────────────────────────────
  const results = await Promise.all(
    orderSets.map(os => _executeOrderSet(os, signal, userId))
  );

  // ── 5. Aggregate P&L from all fills ─────────────────────────────────
  const totalPnl = results.reduce((sum, r) => sum + (r.pnl || 0), 0);
  const firstFill = results.find(r => r.filled);

  // ── 6. Log to signal_log ─────────────────────────────────────────────
  await _logSignal(algo.id, signal, 'executed', {
    entryPrice: firstFill?.entryPrice,
    exitPrice: firstFill?.exitPrice,
    pnl: totalPnl,
    orderSetsFired: results.filter(r => r.filled).length,
  });

  // ── 7. Update daily P&L ──────────────────────────────────────────────
  const { rows: [updated] } = await db.query(
    `UPDATE algos SET daily_pnl = daily_pnl + $1 WHERE id = $2 RETURNING *`,
    [totalPnl, algo.id]
  );

  // ── 8. Re-check kill switch threshold ────────────────────────────────
  const triggered = await killSwitch.checkAndTrigger(updated);

  // ── 9. Broadcast real-time update ────────────────────────────────────
  broadcast(algo.id, {
    type: 'signal',
    algoId: algo.id,
    pnl: updated.daily_pnl,
    killSwitchTriggered: triggered,
  }, userId);

  return {
    status: 'executed',
    ordersFired: results.filter(r => r.filled).length,
    totalPnl,
  };
}

async function _executeOrderSet(orderSet, signal, userId) {
  try {
    const { broker_mode } = await settingsService.getSettings(userId);
    const brokerImpl = broker_mode === 'tradovate'
      ? require('./tradovateBroker')
      : require('./mockBroker');
    const result = await brokerImpl.placeOrder(orderSet, signal);
    return result;
  } catch (err) {
    console.error(`[orderEngine] Order set ${orderSet.id} failed:`, err.message);
    return { filled: false, pnl: 0, error: err.message };
  }
}

async function _logSignal(algoId, signal, status, opts = {}) {
  await db.query(
    `INSERT INTO signal_log
      (algo_id, action, symbol, status, error_message, entry_price, exit_price, pnl, order_sets_fired)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      algoId,
      signal.action,
      signal.symbol,
      status,
      opts.errorMessage || null,
      opts.entryPrice || null,
      opts.exitPrice || null,
      opts.pnl || null,
      opts.orderSetsFired || 0,
    ]
  );
}

function _checkSchedule(algo, now) {
  const tz = algo.schedule_timezone || 'America/New_York';

  // Day of week in algo's timezone
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .format(now);

  const activeDays = algo.schedule_days || ['Mon','Tue','Wed','Thu','Fri'];
  if (!activeDays.includes(dayName)) return true; // blocked

  // Time in algo's timezone
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);

  const [hh, mm] = timeStr.split(':').map(Number);
  const currentMinutes = hh * 60 + mm;

  const [startH, startM] = (algo.schedule_start || '00:00').split(':').map(Number);
  const [endH,   endM]   = (algo.schedule_end   || '23:59').split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes   = endH   * 60 + endM;

  return currentMinutes < startMinutes || currentMinutes > endMinutes;
}

module.exports = { processSignal };
