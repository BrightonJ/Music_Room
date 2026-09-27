const { logActivity, clientInfoFromHeaders } = require('../services/activityLog');

// Logs EVERY API call (authenticated or not: register, login, reset...) once the
// response is sent. The route pattern is logged, never the raw URL, so email
// tokens (/verify/:token) never end up in the logs.
function activityLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const path = req.route ? req.route.path : '(unmatched)';
    logActivity({
      userId: req.user ? req.user.userId : null,
      action: `${req.method} /api${path}`,
      ...clientInfoFromHeaders(req.headers),
      metadata: { status: res.statusCode, durationMs: Date.now() - startedAt },
    });
  });
  next();
}

module.exports = { activityLogger };
