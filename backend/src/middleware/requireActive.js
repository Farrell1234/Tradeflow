/**
 * Gate API endpoints behind an active subscription.
 * Must be used AFTER requireAuth (which sets req.user).
 * Returns 402 if subscription is canceled or past_due.
 */
function requireActive(req, res, next) {
  const status = req.user?.subscription_status;
  if (status === 'trialing' || status === 'active') {
    return next();
  }
  return res.status(402).json({
    error: 'Subscription required',
    subscription_status: status,
  });
}

module.exports = { requireActive };
