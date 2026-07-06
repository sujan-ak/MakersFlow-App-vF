import type { Request, Response, NextFunction, RequestHandler } from "express";

type Bucket = { count: number; windowStart: number };

/**
 * Simple in-memory sliding-window rate limiter (per IP).
 * For multi-instance deployments swap for a Redis-backed limiter,
 * but this stops basic abuse on a single node with zero dependencies.
 */
export function rateLimit(options?: { windowMs?: number; max?: number }): RequestHandler {
  const windowMs = options?.windowMs ?? 60_000;
  const max = options?.max ?? 60;
  const buckets = new Map<string, Bucket>();

  // Periodic cleanup so the map doesn't grow unbounded
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs) buckets.delete(key);
    }
  }, windowMs).unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ error: "Too many requests. Please slow down." });
      return;
    }
    next();
  };
}
