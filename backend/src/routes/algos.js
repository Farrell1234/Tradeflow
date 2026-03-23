const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { processSignal } = require('../services/orderEngine');
const settingsService   = require('../services/settingsService');
const { requireAuth }   = require('../middleware/auth');
const { requireActive } = require('../middleware/requireActive');

// All algo routes require authentication
router.use(requireAuth);

// ── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES = {
  scalper: {
    kill_switch_amount: 200,
    order_set: { name: 'Scalper Set', contracts: 1, entry_type: 'market', profit_target_ticks: 6, stop_type: 'fixed', stop_ticks: 4, breakeven_enabled: false, breakeven_ticks: 0 },
  },
  trend: {
    kill_switch_amount: 600,
    order_set: { name: 'Trend Set', contracts: 1, entry_type: 'market', profit_target_ticks: 40, stop_type: 'trailing', stop_ticks: 15, breakeven_enabled: true, breakeven_ticks: 12 },
  },
  breakout: {
    kill_switch_amount: 400,
    order_set: { name: 'Breakout Set', contracts: 1, entry_type: 'market', profit_target_ticks: 25, stop_type: 'fixed', stop_ticks: 12, breakeven_enabled: false, breakeven_ticks: 0 },
  },
  reversal: {
    kill_switch_amount: 300,
    order_set: { name: 'Reversal Set', contracts: 1, entry_type: 'limit_signal', limit_offset_ticks: 1, profit_target_ticks: 15, stop_type: 'fixed', stop_ticks: 8, breakeven_enabled: true, breakeven_ticks: 7 },
  },
};

// ── GET /algos — list user's algos with today's signal count ──────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        a.*,
        COUNT(s.id) FILTER (WHERE s.received_at >= CURRENT_DATE) AS trades_today,
        MAX(s.received_at) AS last_signal_at
      FROM algos a
      LEFT JOIN signal_log s ON s.algo_id = a.id
      WHERE a.user_id = $1
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch algos' });
  }
});

// ── GET /algos/recent-signals — last 20 signals across all user algos ────────
router.get('/recent-signals', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.algo_id, s.action, s.symbol, s.pnl, s.status, s.received_at,
              a.name AS algo_name
       FROM signal_log s
       JOIN algos a ON a.id = s.algo_id
       WHERE a.user_id = $1
       ORDER BY s.received_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recent signals' });
  }
});

// ── GET /algos/:id — single algo (must belong to user) ───────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*,
        COUNT(s.id) FILTER (WHERE s.received_at >= CURRENT_DATE) AS trades_today,
        MAX(s.received_at) AS last_signal_at
       FROM algos a
       LEFT JOIN signal_log s ON s.algo_id = a.id
       WHERE a.id = $1 AND a.user_id = $2
       GROUP BY a.id`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Algo not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch algo' });
  }
});

// ── POST /algos/stop-all — emergency stop all algos ───────────────────────────
router.post('/stop-all', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE algos SET is_active = false WHERE user_id = $1 RETURNING id`,
      [req.user.id]
    );
    res.json({ stopped: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to stop algos' });
  }
});

// ── POST /algos — create algo ─────────────────────────────────────────────────
router.post('/', requireActive, async (req, res) => {
  const {
    name,
    template,
    kill_switch_amount = template && TEMPLATES[template] ? TEMPLATES[template].kill_switch_amount : 500,
    kill_switch_pause  = 'rest_of_day',
    schedule_enabled   = false,
    schedule_start,
    schedule_end,
    schedule_days,
    schedule_timezone  = 'America/New_York',
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Require both API keys to be configured before creating algos
  try {
    const s = await settingsService.getSettings(req.user.id);
    if (!s.anthropic_api_key) {
      return res.status(403).json({ error: 'setup_required', message: 'Add your Anthropic API key in Settings before creating algos.' });
    }
    if (!s.tradovate_username || !s.tradovate_password) {
      return res.status(403).json({ error: 'setup_required', message: 'Add your Tradovate credentials in Settings before creating algos.' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify settings' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO algos
        (user_id, name, kill_switch_amount, kill_switch_pause, schedule_enabled,
         schedule_start, schedule_end, schedule_days, schedule_timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, name, kill_switch_amount, kill_switch_pause, schedule_enabled,
       schedule_start || null, schedule_end || null,
       schedule_days || ['Mon','Tue','Wed','Thu','Fri'],
       schedule_timezone]
    );
    const algo = rows[0];

    // Seed order set from template
    if (template && TEMPLATES[template]) {
      const os = TEMPLATES[template].order_set;
      await db.query(
        `INSERT INTO order_sets
          (algo_id, name, contracts, entry_type, limit_offset_ticks,
           profit_target_ticks, stop_type, stop_ticks, breakeven_enabled, breakeven_ticks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [algo.id, os.name, os.contracts, os.entry_type, os.limit_offset_ticks || 2,
         os.profit_target_ticks, os.stop_type, os.stop_ticks, os.breakeven_enabled, os.breakeven_ticks]
      );
    }

    res.status(201).json(algo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create algo' });
  }
});

// ── PUT /algos/:id — update algo settings ────────────────────────────────────
router.put('/:id', async (req, res) => {
  const fields = [
    'name', 'is_active', 'kill_switch_amount', 'kill_switch_pause',
    'schedule_enabled', 'schedule_start', 'schedule_end',
    'schedule_days', 'schedule_timezone',
  ];
  const updates = [];
  const values  = [];
  let i = 1;

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${i++}`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  // Ownership check via WHERE user_id
  values.push(req.params.id, req.user.id);
  try {
    const { rows } = await db.query(
      `UPDATE algos SET ${updates.join(', ')} WHERE id = $${i} AND user_id = $${i+1} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Algo not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update algo' });
  }
});

// ── DELETE /algos/:id ─────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM algos WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete algo' });
  }
});

// ── POST /algos/:id/duplicate ─────────────────────────────────────────────────
router.post('/:id/duplicate', requireActive, async (req, res) => {
  try {
    const { rows: [orig] } = await db.query(
      `SELECT * FROM algos WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!orig) return res.status(404).json({ error: 'Algo not found' });

    const { rows: [clone] } = await db.query(
      `INSERT INTO algos
        (user_id, name, kill_switch_amount, kill_switch_pause, schedule_enabled,
         schedule_start, schedule_end, schedule_days, schedule_timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, orig.name + ' (copy)', orig.kill_switch_amount, orig.kill_switch_pause,
       orig.schedule_enabled, orig.schedule_start, orig.schedule_end,
       orig.schedule_days, orig.schedule_timezone]
    );

    // Clone all order sets
    const { rows: orderSets } = await db.query(
      `SELECT * FROM order_sets WHERE algo_id = $1`, [orig.id]
    );
    for (const os of orderSets) {
      await db.query(
        `INSERT INTO order_sets
          (algo_id, name, contracts, entry_type, limit_offset_ticks,
           profit_target_ticks, stop_type, stop_ticks, breakeven_enabled, breakeven_ticks,
           trail_activation_ticks, trail_step_ticks, trail_lock_ticks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [clone.id, os.name, os.contracts, os.entry_type, os.limit_offset_ticks,
         os.profit_target_ticks, os.stop_type, os.stop_ticks, os.breakeven_enabled, os.breakeven_ticks,
         os.trail_activation_ticks || 0, os.trail_step_ticks || 0, os.trail_lock_ticks || null]
      );
    }

    res.status(201).json(clone);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to duplicate algo' });
  }
});

// ── POST /algos/:id/reset-kill-switch ────────────────────────────────────────
router.post('/:id/reset-kill-switch', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE algos SET kill_switch_triggered_at = NULL
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Algo not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset kill switch' });
  }
});

// ══ ORDER SETS ════════════════════════════════════════════════════════════════

router.get('/:id/order-sets', async (req, res) => {
  try {
    // Ownership: join through algos
    const { rows } = await db.query(
      `SELECT os.* FROM order_sets os
       JOIN algos a ON a.id = os.algo_id
       WHERE os.algo_id = $1 AND a.user_id = $2
       ORDER BY os.id ASC`,
      [req.params.id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order sets' });
  }
});

router.post('/:id/order-sets', requireActive, async (req, res) => {
  // Verify algo ownership first
  const { rows: algos } = await db.query(
    `SELECT id FROM algos WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!algos[0]) return res.status(404).json({ error: 'Algo not found' });

  const {
    name                    = 'Order Set',
    contracts               = 1,
    entry_type              = 'market',
    limit_offset_ticks      = 2,
    profit_target_ticks     = 20,
    stop_type               = 'fixed',
    stop_ticks              = 20,
    breakeven_enabled       = false,
    breakeven_ticks         = 10,
    trail_activation_ticks  = 0,
    trail_step_ticks        = 0,
    trail_lock_ticks        = null,
  } = req.body;

  try {
    const { rows } = await db.query(
      `INSERT INTO order_sets
        (algo_id, name, contracts, entry_type, limit_offset_ticks,
         profit_target_ticks, stop_type, stop_ticks, breakeven_enabled, breakeven_ticks,
         trail_activation_ticks, trail_step_ticks, trail_lock_ticks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.params.id, name, contracts, entry_type, limit_offset_ticks,
       profit_target_ticks, stop_type, stop_ticks, breakeven_enabled, breakeven_ticks,
       trail_activation_ticks, trail_step_ticks, trail_lock_ticks]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order set' });
  }
});

router.put('/:algoId/order-sets/:id', async (req, res) => {
  const fields = [
    'name', 'is_active', 'contracts', 'entry_type', 'limit_offset_ticks',
    'profit_target_ticks', 'stop_type', 'stop_ticks',
    'breakeven_enabled', 'breakeven_ticks',
    'trail_activation_ticks', 'trail_step_ticks', 'trail_lock_ticks',
  ];
  const updates = [];
  const values  = [];
  let i = 1;

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${i++}`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);

  try {
    const { rows } = await db.query(
      `UPDATE order_sets SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order set not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order set' });
  }
});

router.delete('/:algoId/order-sets/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM order_sets WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order set' });
  }
});

// ══ SIGNAL LOG ════════════════════════════════════════════════════════════════

router.get('/:id/signals', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.* FROM signal_log s
       JOIN algos a ON a.id = s.algo_id
       WHERE s.algo_id = $1 AND a.user_id = $2
       ORDER BY s.received_at DESC LIMIT 50`,
      [req.params.id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// ══ ANALYTICS ════════════════════════════════════════════════════════════════

router.get('/:id/analytics', async (req, res) => {
  try {
    // Verify ownership
    const { rows: algos } = await db.query(
      `SELECT id FROM algos WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!algos[0]) return res.status(404).json({ error: 'Algo not found' });

    // Aggregate stats from signal_log
    const { rows: [stats] } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'executed')                           AS total_trades,
        COUNT(*) FILTER (WHERE status = 'executed' AND pnl > 0)               AS wins,
        COUNT(*) FILTER (WHERE status = 'executed' AND pnl <= 0)              AS losses,
        COALESCE(SUM(pnl) FILTER (WHERE status = 'executed'), 0)              AS total_pnl,
        COALESCE(AVG(pnl) FILTER (WHERE status = 'executed' AND pnl > 0), 0) AS avg_win,
        COALESCE(AVG(pnl) FILTER (WHERE status = 'executed' AND pnl < 0), 0) AS avg_loss,
        COALESCE(SUM(pnl) FILTER (WHERE status = 'executed' AND pnl > 0), 0) AS gross_profit,
        COALESCE(ABS(SUM(pnl) FILTER (WHERE status = 'executed' AND pnl < 0)), 0) AS gross_loss
      FROM signal_log
      WHERE algo_id = $1
    `, [req.params.id]);

    const totalTrades  = parseInt(stats.total_trades) || 0;
    const wins         = parseInt(stats.wins) || 0;
    const winRate      = totalTrades > 0 ? wins / totalTrades : 0;
    const grossProfit  = parseFloat(stats.gross_profit) || 0;
    const grossLoss    = parseFloat(stats.gross_loss) || 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

    // Daily P&L
    const { rows: daily } = await db.query(`
      SELECT
        DATE(received_at AT TIME ZONE 'America/New_York') AS date,
        COALESCE(SUM(pnl), 0) AS pnl
      FROM signal_log
      WHERE algo_id = $1 AND status = 'executed'
      GROUP BY 1
      ORDER BY 1 ASC
    `, [req.params.id]);

    // Max drawdown (running peak calculation)
    let peak = 0, runningPnl = 0, maxDrawdown = 0;
    for (const day of daily) {
      runningPnl += parseFloat(day.pnl);
      if (runningPnl > peak) peak = runningPnl;
      const drawdown = runningPnl - peak;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }

    res.json({
      totalTrades,
      winRate:      parseFloat(winRate.toFixed(4)),
      avgWin:       parseFloat(parseFloat(stats.avg_win).toFixed(2)),
      avgLoss:      parseFloat(parseFloat(stats.avg_loss).toFixed(2)),
      totalPnl:     parseFloat(parseFloat(stats.total_pnl).toFixed(2)),
      maxDrawdown:  parseFloat(maxDrawdown.toFixed(2)),
      profitFactor: profitFactor === Infinity ? null : parseFloat(profitFactor.toFixed(2)),
      dailyPnl:     daily.map(d => ({ date: d.date, pnl: parseFloat(parseFloat(d.pnl).toFixed(2)) })),
    });
  } catch (err) {
    console.error('[analytics]', err.message);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

// ══ TEST SIGNAL ═══════════════════════════════════════════════════════════════

router.post('/:id/test-signal', requireActive, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM algos WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Algo not found.' });
    const { action = 'buy', symbol = 'TEST', price = null } = req.body;
    const result = await processSignal(rows[0], { action, symbol, price }, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[test-signal]', err.message);
    res.status(500).json({ error: err.message || 'Test signal failed.' });
  }
});

module.exports = router;
