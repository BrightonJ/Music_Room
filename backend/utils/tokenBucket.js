// Small token bucket used to rate limit Socket.IO events per connection
// (express-rate-limit only sees HTTP requests).
function createTokenBucket({ capacity, refillPerSecond, enabled = true }) {
  let tokens = capacity;
  let last = Date.now();
  return {
    take() {
      if (!enabled) return true;
      const now = Date.now();
      tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSecond);
      last = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

module.exports = { createTokenBucket };
