const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const db       = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');

// ── POST /auth/signup ─────────────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const emailLower = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, subscription_status, trial_ends_at, created_at`,
      [emailLower, password_hash]
    );
    const user  = rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('[auth/signup]', err.message, err.code, err.stack);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
// DEV MODE: any credentials accepted — upserts user on the fly

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const emailLower = email.toLowerCase().trim();

    // Upsert: create user if they don't exist yet
    await db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [emailLower, '$2a$12$devmode']
    );

    const { rows } = await db.query(
      `SELECT id, email, subscription_status, trial_ends_at FROM users WHERE email = $1`,
      [emailLower]
    );

    const token = signToken(rows[0]);
    res.json({ token, user: rows[0] });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, email, subscription_status, trial_ends_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
