const { verifySession } = require('../services/session');
const { userLimiter } = require('../utils/rateLimiters');

async function authenticateToken(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const session = await verifySession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or revoked, please log in again' });
  }
  req.user = { userId: session.userId, deviceRowId: session.deviceId };
  next();
}

// Authentication + per-account rate limit
const requireAuth = [authenticateToken, userLimiter];

module.exports = { authenticateToken, requireAuth };
