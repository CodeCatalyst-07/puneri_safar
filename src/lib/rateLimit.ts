import { NextResponse } from "next/server";
import { jsonError } from "./http";
import { RateLimitExceededError } from "./errors";

export interface RateLimitResult {
  /** Whether the request is permitted */
  allowed: boolean;
  /** Maximum number of tokens/requests permitted in the window */
  limit: number;
  /** Number of remaining tokens available in current window */
  remaining: number;
  /** Milliseconds until full refill / token availability */
  resetMs: number;
}

export interface RateLimiter {
  check(key: string, cost?: number): Promise<RateLimitResult> | RateLimitResult;
  reset(key: string): Promise<void> | void;
}

export interface TokenBucketOptions {
  /** Maximum burst tokens the bucket can hold */
  capacity: number;
  /** Number of tokens refilled during windowMs */
  refillRate: number;
  /** Refill window in milliseconds (default: 60,000ms = 1 minute) */
  windowMs?: number;
  /** Maximum inactive entries before garbage collection (default: 10,000) */
  maxEntries?: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

/**
 * In-memory Token-Bucket rate limiter implementation.
 * Designed with a clean interface allowing drop-in replacement with Redis/Upstash later.
 */
export class TokenBucketRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;

  constructor(options: TokenBucketOptions) {
    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.windowMs = options.windowMs ?? 60_000;
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  check(key: string, cost = 1): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.capacity,
      lastRefill: now,
    };

    // Calculate token refill proportional to elapsed time
    const elapsed = Math.max(0, now - bucket.lastRefill);
    const tokensToAdd = (elapsed / this.windowMs) * this.refillRate;
    const currentTokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);

    if (currentTokens >= cost) {
      const remaining = currentTokens - cost;
      this.buckets.set(key, {
        tokens: remaining,
        lastRefill: now,
      });

      this.cleanupIfNecessary();

      return {
        allowed: true,
        limit: this.capacity,
        remaining: Math.floor(remaining),
        resetMs: 0,
      };
    }

    // Rate limit hit - calculate time needed to refill at least cost tokens
    const needed = cost - currentTokens;
    const resetMs = Math.ceil((needed / this.refillRate) * this.windowMs);

    return {
      allowed: false,
      limit: this.capacity,
      remaining: Math.floor(currentTokens),
      resetMs,
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Simple garbage collection of stale buckets to prevent unbounded memory growth.
   */
  private cleanupIfNecessary(): void {
    if (this.buckets.size <= this.maxEntries) {
      return;
    }

    const now = Date.now();
    const expiryAge = this.windowMs * 2;

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > expiryAge) {
        this.buckets.delete(key);
      }
    }
  }
}

// Default standard API rate limiter (60 requests per minute, burst of 20)
export const defaultApiLimiter = new TokenBucketRateLimiter({
  capacity: 20,
  refillRate: 60,
  windowMs: 60_000,
});

/**
 * Extracts client IP or unique client identifier from HTTP request headers.
 */
export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "anonymous_client";
}

export interface ApplyRateLimitOptions {
  limiter?: RateLimiter;
  cost?: number;
  keyPrefix?: string;
}

/**
 * Helper to apply rate limiting in Next.js App Router API route handlers.
 * Returns standard 429 response if exceeded, or null if allowed.
 */
export async function applyRateLimit(
  request: Request,
  options: ApplyRateLimitOptions = {}
): Promise<{
  response: NextResponse | null;
  headers: Record<string, string>;
}> {
  const limiter = options.limiter ?? defaultApiLimiter;
  const cost = options.cost ?? 1;
  const clientId = getClientIdentifier(request);
  const key = `${options.keyPrefix ?? "api"}:${clientId}`;

  const result = await limiter.check(key, cost);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetMs / 1000).toString(),
  };

  if (!result.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil(result.resetMs / 1000));
    headers["Retry-After"] = retryAfterSec.toString();

    const response = jsonError(
      new RateLimitExceededError("Rate limit exceeded. Please retry after the indicated window."),
      429,
      headers
    );

    return { response, headers };
  }

  return { response: null, headers };
}
