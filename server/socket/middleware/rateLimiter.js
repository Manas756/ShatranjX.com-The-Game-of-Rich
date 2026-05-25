const { RATE_LIMITS } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Per-socket sliding-window rate limits — prevents move spam and room abuse.
 */
class RateLimiter {
  constructor() {
    this._windows = new Map();
    this._banned = new Set();
  }

  _getBucket(socketId, eventKey) {
    const key = `${socketId}:${eventKey}`;
    if (!this._windows.has(key)) {
      this._windows.set(key, []);
    }
    return this._windows.get(key);
  }

  _prune(timestamps, windowMs, now) {
    while (timestamps.length && timestamps[0] <= now - windowMs) {
      timestamps.shift();
    }
  }

  check(socketId, limitKey) {
    if (this._banned.has(socketId)) {
      return { allowed: false, reason: 'banned' };
    }

    const config = RATE_LIMITS[limitKey];
    if (!config) return { allowed: true };

    const now = Date.now();
    const bucket = this._getBucket(socketId, limitKey);
    this._prune(bucket, config.windowMs, now);

    if (bucket.length >= config.max) {
      logger.warn('Rate limit exceeded', { socketId, limitKey, count: bucket.length });
      return { allowed: false, reason: 'rate_limit', retryAfterMs: config.windowMs };
    }

    bucket.push(now);
    return { allowed: true };
  }

  ban(socketId) {
    this._banned.add(socketId);
  }

  unban(socketId) {
    this._banned.delete(socketId);
  }

  clearSocket(socketId) {
    for (const key of this._windows.keys()) {
      if (key.startsWith(`${socketId}:`)) {
        this._windows.delete(key);
      }
    }
    this._banned.delete(socketId);
  }
}

function createRateLimitMiddleware(limiter, limitKey) {
  return (socket, next) => {
    const result = limiter.check(socket.id, limitKey);
    if (!result.allowed) {
      const err = new Error(result.reason);
      err.data = result;
      return next(err);
    }
    next();
  };
}

module.exports = {
  RateLimiter,
  createRateLimitMiddleware,
};
