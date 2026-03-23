const express = require('express');
const router = express.Router();
const db = require('../db');
const orderEngine = require('../services/orderEngine');

/**
 * POST /webhook/:webhookId
 *
 * TradingView sends:
 *   { "symbol": "MNQ1!", "action": "buy" }            ← market order
 *   { "symbol": "MNQ1!", "action": "buy", "price": 19450.25 }  ← limit at signal price
 */
router.post('/:webhookId', async (req, res) => {
  const start = Date.now();
  const { webhookId } = req.params;
  const body = req.body;

  // ── Validate payload ─────────────────────────────────────────────────
  const action = (body.action || '').toLowerCase();
  const symbol = (body.symbol || '').trim().toUpperCase();

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol in payload' });
  }
  if (!['buy', 'sell'].includes(action)) {
    return res.status(400).json({ error: 'action must be "buy" or "sell"' });
  }

  const signal = {
    action,
    symbol,
    price: body.price ? parseFloat(body.price) : null,
  };

  // ── Look up algo by webhook_id ────────────────────────────────────────
  const { rows } = await db.query(
    `SELECT * FROM algos WHERE webhook_id = $1`,
    [webhookId]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Algo not found' });
  }

  const algo = rows[0];

  if (!algo.is_active) {
    return res.status(200).json({ status: 'paused', message: 'Algo is paused' });
  }

  // ── Process signal ───────────────────────────────────────────────────
  try {
    const result = await orderEngine.processSignal(algo, signal, algo.user_id);
    const ms = Date.now() - start;
    console.log(`[webhook] ${symbol} ${action} → ${result.status} (${ms}ms)`);
    return res.json({ ...result, ms });
  } catch (err) {
    console.error('[webhook] Error processing signal:', err);
    return res.status(500).json({ error: 'Internal error processing signal' });
  }
});

module.exports = router;
