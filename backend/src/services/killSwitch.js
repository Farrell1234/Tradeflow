const db = require('../db');

const PAUSE_DURATIONS = {
  '1h':          60 * 60 * 1000,
  '2h':          2 * 60 * 60 * 1000,
  '4h':          4 * 60 * 60 * 1000,
  'rest_of_day': null, // handled specially — midnight reset
  'manual':      null, // never auto-resumes
};

/**
 * Check if the kill switch is currently blocking new trades.
 * Returns { blocked: bool, reason: string, resumesAt: Date|null }
 */
function checkKillSwitch(algo) {
  if (!algo.kill_switch_triggered_at) {
    return { blocked: false };
  }

  const triggeredAt = new Date(algo.kill_switch_triggered_at);
  const pause = algo.kill_switch_pause;

  if (pause === 'manual') {
    return {
      blocked: true,
      reason: 'Kill switch active — manual reset required',
      resumesAt: null,
    };
  }

  if (pause === 'rest_of_day') {
    // Blocked until midnight in the algo's timezone
    const now = new Date();
    const midnight = _getMidnight(algo.schedule_timezone || 'America/New_York');
    if (now < midnight) {
      return {
        blocked: true,
        reason: `Kill switch active — resumes at midnight`,
        resumesAt: midnight,
      };
    }
    // Past midnight — auto-clear (should have been reset by cron, but handle here too)
    return { blocked: false };
  }

  const durationMs = PAUSE_DURATIONS[pause];
  if (!durationMs) return { blocked: false };

  const resumesAt = new Date(triggeredAt.getTime() + durationMs);
  if (new Date() < resumesAt) {
    return {
      blocked: true,
      reason: `Kill switch active — resumes at ${resumesAt.toLocaleTimeString()}`,
      resumesAt,
    };
  }

  return { blocked: false };
}

/**
 * Trigger the kill switch on an algo.
 */
async function triggerKillSwitch(algoId) {
  await db.query(
    `UPDATE algos SET kill_switch_triggered_at = NOW() WHERE id = $1`,
    [algoId]
  );
}

/**
 * Check daily P&L threshold and trigger kill switch if breached.
 * Call this AFTER updating daily_pnl.
 * Returns true if kill switch was triggered.
 */
async function checkAndTrigger(algo) {
  // daily_pnl is stored as a running total; losses are negative
  if (algo.daily_pnl <= -Math.abs(algo.kill_switch_amount)) {
    await triggerKillSwitch(algo.id);
    return true;
  }
  return false;
}

/**
 * Reset all algos' daily P&L and clear time-based kill switches.
 * Called by the midnight cron job.
 */
async function dailyReset() {
  await db.query(`
    UPDATE algos
    SET
      daily_pnl = 0,
      kill_switch_triggered_at = NULL
    WHERE kill_switch_pause IN ('rest_of_day', '1h', '2h', '4h')
  `);
  console.log('[kill switch] Daily reset complete');
}

function _getMidnight(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const month = parts.find(p => p.type === 'month').value;
  const day   = parts.find(p => p.type === 'day').value;
  const year  = parts.find(p => p.type === 'year').value;

  // Midnight tonight in that timezone
  const midnightStr = `${year}-${month}-${day}T23:59:59`;
  return new Date(new Date(midnightStr).getTime() + 1000);
}

module.exports = { checkKillSwitch, triggerKillSwitch, checkAndTrigger, dailyReset };
