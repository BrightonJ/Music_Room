const { ClientError } = require('../utils/errors');

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Express 5 forwards errors thrown in async handlers here
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof ClientError) {
    return res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
}

module.exports = { notFound, errorHandler };
