const express = require('express');
const router  = express.Router();
const Stripe  = require('stripe');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');
const { signToken }   = require('../middleware/auth');

// ── POST /billing/create-checkout ────────────────────────────────────────────

router.post('/create-checkout', requireAuth, async (req, res) => {
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { rows: [user] } = await db.query(
      `SELECT * FROM users WHERE id = $1`, [req.user.id]
    );

    // Create or reuse Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await db.query(
        `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, req.user.id]
      );
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${frontendUrl}/billing?success=1`,
      cancel_url:  `${frontendUrl}/billing?canceled=1`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing/create-checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /billing/portal ──────────────────────────────────────────────────────

router.post('/portal', requireAuth, async (req, res) => {
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { rows: [user] } = await db.query(
      `SELECT * FROM users WHERE id = $1`, [req.user.id]
    );

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${frontendUrl}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing/portal]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /billing/status ───────────────────────────────────────────────────────

router.get('/status', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await db.query(
      `SELECT subscription_status, trial_ends_at, stripe_subscription_id FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json({
      subscription_status: user.subscription_status,
      trial_ends_at:       user.trial_ends_at,
      has_subscription:    !!user.stripe_subscription_id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /billing/webhook (raw body) ─────────────────────────────────────────

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig    = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[billing/webhook] Invalid signature:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const obj = event.data.object;

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const status = obj.status === 'active' ? 'active'
                     : obj.status === 'trialing' ? 'trialing'
                     : obj.status === 'past_due' ? 'past_due'
                     : 'canceled';
        await db.query(
          `UPDATE users SET subscription_status = $1, stripe_subscription_id = $2
           WHERE stripe_customer_id = $3`,
          [status, obj.id, obj.customer]
        );
        break;
      }
      case 'customer.subscription.deleted': {
        await db.query(
          `UPDATE users SET subscription_status = 'canceled' WHERE stripe_customer_id = $1`,
          [obj.customer]
        );
        break;
      }
      case 'invoice.payment_failed': {
        await db.query(
          `UPDATE users SET subscription_status = 'past_due' WHERE stripe_customer_id = $1`,
          [obj.customer]
        );
        break;
      }
      case 'invoice.payment_succeeded': {
        await db.query(
          `UPDATE users SET subscription_status = 'active' WHERE stripe_customer_id = $1`,
          [obj.customer]
        );
        break;
      }
    }
  } catch (err) {
    console.error('[billing/webhook] DB update failed:', err.message);
    return res.status(500).send('DB error');
  }

  res.json({ received: true });
});

module.exports = router;
