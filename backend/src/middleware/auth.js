const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'tradeflow-dev-secret';

/**
 * Verify JWT from Authorization header, attach req.user.
 * Returns 401 if token is missing or invalid.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload; // { id, email, subscription_status }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, subscription_status: user.subscription_status },
    SECRET,
    { expiresIn: '30d' }
  );
}

module.exports = { requireAuth, signToken };
