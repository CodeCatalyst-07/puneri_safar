import { describe, it, expect } from "vitest";
import { TokenBucketRateLimiter, applyRateLimit } from "@/lib/rateLimit";

describe("TokenBucketRateLimiter", () => {
  it("allows requests within capacity and tracks remaining tokens", () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 3,
      refillRate: 1,
      windowMs: 60_000,
    });

    const res1 = limiter.check("user-1");
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = limiter.check("user-1");
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = limiter.check("user-1");
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);

    // 4th request exceeds burst capacity
    const res4 = limiter.check("user-1");
    expect(res4.allowed).toBe(false);
    expect(res4.resetMs).toBeGreaterThan(0);
  });

  it("isolates rate limit buckets between different keys", () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillRate: 1,
      windowMs: 60_000,
    });

    const resA = limiter.check("client-A");
    expect(resA.allowed).toBe(true);

    // client-A is now exhausted
    const resA2 = limiter.check("client-A");
    expect(resA2.allowed).toBe(false);

    // client-B should still have capacity
    const resB = limiter.check("client-B");
    expect(resB.allowed).toBe(true);
  });

  it("resets tokens when reset is explicitly invoked", () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillRate: 1,
      windowMs: 60_000,
    });

    limiter.check("client-1");
    expect(limiter.check("client-1").allowed).toBe(false);

    limiter.reset("client-1");
    expect(limiter.check("client-1").allowed).toBe(true);
  });
});

describe("applyRateLimit Helper", () => {
  it("attaches rate limit headers and passes through when allowed", async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRate: 5,
      windowMs: 60_000,
    });

    const req = new Request("https://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.195" },
    });

    const { response, headers } = await applyRateLimit(req, { limiter });

    expect(response).toBeNull();
    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("4");
  });

  it("returns 429 response when rate limit is exceeded", async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillRate: 1,
      windowMs: 60_000,
    });

    const req = new Request("https://localhost/api/test", {
      headers: { "x-real-ip": "198.51.100.42" },
    });

    // 1st request
    await applyRateLimit(req, { limiter });

    // 2nd request should trigger 429
    const { response, headers } = await applyRateLimit(req, { limiter });

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(headers["Retry-After"]).toBeDefined();

    const data = await response?.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
