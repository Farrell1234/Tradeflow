const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { analyzeScript, generateAlertScript } = require('../services/pineAnalyzer');
const { requireAuth }   = require('../middleware/auth');
const { requireActive } = require('../middleware/requireActive');

router.use(requireAuth);

// POST /scripts/analyze
router.post('/analyze', requireActive, async (req, res) => {
  const { content, filename, algoId } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Script content is required.' });
  }

  if (algoId) {
    const { rows } = await db.query(
      `SELECT id FROM algos WHERE id = $1 AND user_id = $2`,
      [algoId, req.user.id]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Algo not found or access denied.' });
  }

  try {
    const analysis = await analyzeScript(content, req.user.id);
    const result = await db.query(
      `INSERT INTO pine_scripts (algo_id, filename, content, analysis)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [algoId || null, filename || null, content, JSON.stringify(analysis)]
    );
    res.json({ scriptId: result.rows[0].id, ...analysis });
  } catch (err) {
    console.error('[scripts/analyze]', err.message);
    res.status(500).json({ error: err.message || 'Failed to analyze script.' });
  }
});

// PATCH /scripts/:scriptId/config
router.patch('/:scriptId/config', async (req, res) => {
  const { final_config } = req.body;
  try {
    await db.query(
      `UPDATE pine_scripts ps SET final_config = $1
       FROM algos a
       WHERE ps.id = $2 AND ps.algo_id = a.id AND a.user_id = $3`,
      [JSON.stringify(final_config), req.params.scriptId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[scripts/config]', err.message);
    res.status(500).json({ error: 'Failed to save config.' });
  }
});

// POST /scripts/:scriptId/alert-script
router.post('/:scriptId/alert-script', requireActive, async (req, res) => {
  try {
    await db.query(`ALTER TABLE pine_scripts ADD COLUMN IF NOT EXISTS alert_script TEXT`);

    const { rows } = await db.query(
      `SELECT ps.content, ps.analysis, ps.alert_script
       FROM pine_scripts ps
       LEFT JOIN algos a ON a.id = ps.algo_id
       WHERE ps.id = $1 AND (a.user_id = $2 OR ps.algo_id IS NULL)`,
      [req.params.scriptId, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Script not found.' });

    if (rows[0].alert_script) {
      return res.json({ alertScript: rows[0].alert_script });
    }

    const alertScript = await generateAlertScript(rows[0].content, rows[0].analysis, req.user.id);
    await db.query(
      `UPDATE pine_scripts SET alert_script = $1 WHERE id = $2`,
      [alertScript, req.params.scriptId]
    );
    res.json({ alertScript });
  } catch (err) {
    console.error('[scripts/alert-script]', err.message);
    res.status(500).json({ error: 'Failed to generate alert script.' });
  }
});

// GET /scripts/algo/:algoId
router.get('/algo/:algoId', async (req, res) => {
  try {
    const { rows: algos } = await db.query(
      `SELECT id FROM algos WHERE id = $1 AND user_id = $2`,
      [req.params.algoId, req.user.id]
    );
    if (!algos[0]) return res.json(null);

    const result = await db.query(
      `SELECT id, filename, analysis, final_config, alert_script, created_at
       FROM pine_scripts
       WHERE algo_id = $1 AND final_config IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [req.params.algoId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('[scripts/algo]', err.message);
    res.status(500).json({ error: 'Failed to load script.' });
  }
});

module.exports = router;
