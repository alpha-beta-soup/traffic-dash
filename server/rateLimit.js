// Limits each client's requests: a bucket of `burst` requests per client address, refilling at
// `perSecond`; when it's empty, 429 with Retry-After. Clients idle long enough for a full bucket
// are forgotten. Behind a proxy, the client's address is only right if Express trusts it (see
// TRUST_PROXY in server/index.js).
const SWEEP = 60_000; // ms between forgetting idle clients

export default function rateLimit({ burst = 300, perSecond = 10, now = Date.now } = {}) {
  const buckets = new Map(); // address -> { tokens, at }
  let swept = now();
  return (req, res, next) => {
    const t = now();
    if (t - swept > SWEEP) {
      for (const [address, bucket] of buckets) if (((t - bucket.at) / 1000) * perSecond >= burst) buckets.delete(address);
      swept = t;
    }
    const bucket = buckets.get(req.ip) ?? { tokens: burst, at: t };
    bucket.tokens = Math.min(burst, bucket.tokens + ((t - bucket.at) / 1000) * perSecond);
    bucket.at = t;
    buckets.set(req.ip, bucket);
    if (bucket.tokens < 1) {
      res.set('Retry-After', String(Math.ceil((1 - bucket.tokens) / perSecond)));
      return res.status(429).json({ error: 'Too many requests' });
    }
    bucket.tokens -= 1;
    return next();
  };
}
