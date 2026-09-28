const rateLimit = require('express-rate-limit');

const disabled = process.env.RATE_LIMIT_DISABLED === '1';
const passThrough = (req, res, next) => next();

function limiter(options) {
  if (disabled) return passThrough;
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    ...options,
  });
}

// Login / email target key: the identifier (email or username) or the email field
const emailKey = (req) => {
  const value = req.body?.identifier ?? req.body?.email;
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

// Anti-flood only, per IP. Generous on purpose: at a party every guest on the
// venue Wi-Fi shares the same public IP.
const globalLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 3000 });

// Per authenticated account (applied after authentication)
const userLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  keyGenerator: (req) => `user:${req.user.userId}`,
});

// Brute force protection: only FAILED attempts count, per IP + identifier (email or username)
const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${req.ip}:${emailKey(req)}`,
  message: { error: 'Too many failed attempts, please try again in 15 minutes' },
});

const registerLimiter = limiter({ windowMs: 60 * 60 * 1000, limit: 20 });

// Emails (activation, password reset): per target address and per IP
const emailTargetLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `mail:${emailKey(req)}`,
});
const emailIpLimiter = limiter({ windowMs: 60 * 60 * 1000, limit: 30 });

const resetLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 20 });

module.exports = {
  globalLimiter,
  userLimiter,
  loginLimiter,
  registerLimiter,
  emailLimiters: [emailIpLimiter, emailTargetLimiter],
  resetLimiter,
};
