const express = require('express');
const router  = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const axios     = require('axios');
const settingsService = require('../services/settingsService');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskKey(val) {
  if (!val) return null;
  if (val.length <= 8) return '••••••••';
  return val.slice(0, 6) + '••••••••••••' + val.slice(-4);
}

function maskSettings(s) {
  return {
    broker_mode:        s.broker_mode,
    tradovate_mode:     s.tradovate_mode,
    tradovate_app_id:   s.tradovate_app_id,
    tradovate_username: s.tradovate_username,
    tradovate_cid:      s.tradovate_cid,
    anthropic_api_key:  maskKey(s.anthropic_api_key),
    tradovate_password: s.tradovate_password ? '••••••••' : null,
    tradovate_secret:   maskKey(s.tradovate_secret),
  };
}

const MASKED_SENTINEL = '••';
function isMasked(val) {
  return typeof val === 'string' && val.startsWith(MASKED_SENTINEL);
}

// ── GET /settings ─────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const s = await settingsService.getSettings(req.user.id);
    res.json(maskSettings(s));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /settings ─────────────────────────────────────────────────────────────

router.put('/', async (req, res) => {
  try {
    const patch = {};
    const body  = req.body;

    const plain = ['broker_mode', 'tradovate_mode', 'tradovate_app_id', 'tradovate_username', 'tradovate_cid'];
    for (const k of plain) {
      if (k in body) patch[k] = body[k] || null;
    }

    const sensitive = ['anthropic_api_key', 'tradovate_password', 'tradovate_secret'];
    for (const k of sensitive) {
      if (k in body && body[k] !== null && !isMasked(body[k])) {
        patch[k] = body[k] || null;
      }
    }

    const updated = await settingsService.updateSettings(req.user.id, patch);
    res.json(maskSettings(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /settings/test-anthropic ────────────────────────────────────────────

router.post('/test-anthropic', async (req, res) => {
  try {
    const s = await settingsService.getSettings(req.user.id);
    if (!s.anthropic_api_key) {
      return res.json({ ok: false, error: 'No Anthropic API key configured' });
    }
    const client = new Anthropic({ apiKey: s.anthropic_api_key });
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }],
    });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ── POST /settings/test-tradovate ────────────────────────────────────────────

router.post('/test-tradovate', async (req, res) => {
  try {
    const s = await settingsService.getSettings(req.user.id);
    if (!s.tradovate_username || !s.tradovate_password) {
      return res.json({ ok: false, error: 'Username and password are required' });
    }
    const baseUrl = s.tradovate_mode === 'live'
      ? 'https://live.tradovateapi.com/v1'
      : 'https://demo.tradovateapi.com/v1';

    const response = await axios.post(`${baseUrl}/auth/accesstokenrequest`, {
      name:       s.tradovate_username,
      password:   s.tradovate_password,
      appId:      s.tradovate_app_id || 'TradeFlow',
      appVersion: '1.0',
      cid:        parseInt(s.tradovate_cid, 10) || 0,
      sec:        s.tradovate_secret || '',
    });

    res.json({ ok: true, accountId: response.data.accountId });
  } catch (err) {
    const msg = err.response?.data?.errorText || err.response?.data?.p || err.message;
    res.json({ ok: false, error: msg });
  }
});

module.exports = router;
