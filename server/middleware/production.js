import crypto from 'crypto';

function clientKey(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function requestContext(req, res, next) {
  const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const started = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - started;
    if (res.statusCode >= 500 || durationMs > 2000) {
      console.warn(JSON.stringify({ level: 'warn', requestId, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs }));
    }
  });
  next();
}

export function timeoutMiddleware(timeoutMs) {
  return (req, res, next) => {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) res.status(503).json({ error: 'Request timed out. Please try again.', request_id: req.requestId });
    });
    next();
  };
}

export function createRateLimiter({ windowMs, max, prefix = 'api' }) {
  const buckets = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  }, Math.max(windowMs, 60_000));
  cleanup.unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${prefix}:${clientKey(req)}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    next();
  };
}
