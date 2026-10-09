/**
 * @file src/lib/googleFetch.ts
 * Resilient fetch wrapper for Google Maps, Places, Routes, and Weather APIs.
 *
 * FEATURES:
 * - 8s timeout with AbortController
 * - Exactly one retry on 5xx or 429 with short backoff (500ms)
 * - In-memory TTL cache keyed by request
 * - Typed Result { ok: true, data: T } | { ok: false, reason: string } (never throws)
 * - Detects demo key limitations and returns "feature unavailable with current key"
 */

import { logger } from "./logger";

export type GoogleApiResult<T> = { ok: true; data: T } | { ok: false; reason: string };

export interface GoogleFetchOptions {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  ttlMs?: number;
  skipCache?: boolean;
}

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const CACHE_MAX_ENTRIES = 500;
const requestCache = new Map<string, CacheEntry>();

/**
 * Builds deterministic cache key for request.
 */
function buildCacheKey(options: GoogleFetchOptions): string {
  const method = options.method ?? "GET";
  const bodyStr = options.body ? JSON.stringify(options.body) : "";
  const headerKeys = options.headers ? Object.keys(options.headers).sort() : [];
  const headerStr = headerKeys.map((k) => `${k}:${options.headers![k]}`).join(";");
  return `${method}:${options.url}:${headerStr}:${bodyStr}`;
}

/**
 * Evicts expired entries or trims cache when size exceeds limit.
 */
function pruneCache(): void {
  const now = Date.now();
  for (const [key, entry] of requestCache.entries()) {
    if (now >= entry.expiresAt) {
      requestCache.delete(key);
    }
  }

  if (requestCache.size > CACHE_MAX_ENTRIES) {
    // Delete oldest entries
    const iter = requestCache.keys();
    for (let i = 0; i < 50; i++) {
      const next = iter.next();
      if (next.done) break;
      requestCache.delete(next.value);
    }
  }
}

/**
 * Executes resilient HTTP fetch against Google Web APIs.
 */
export async function googleFetch<T>(options: GoogleFetchOptions): Promise<GoogleApiResult<T>> {
  const cacheKey = buildCacheKey(options);

  // 1. Check TTL cache if enabled
  if (!options.skipCache && (options.ttlMs ?? 0) > 0) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return { ok: true, data: cached.data as T };
    }
  }

  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  let body: string | undefined;
  if (options.body) {
    body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  const TIMEOUT_MS = 8000;
  const RETRY_BACKOFF_MS = 500;

  async function performAttempt(): Promise<{ res?: Response; error?: Error }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(options.url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return { res };
    } catch (err) {
      clearTimeout(timer);
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  // Attempt 1
  let { res, error } = await performAttempt();

  // Retry once on 5xx or 429
  if (res && (res.status === 429 || res.status >= 500)) {
    await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    const retryAttempt = await performAttempt();
    if (retryAttempt.res) {
      res = retryAttempt.res;
      error = undefined;
    } else if (retryAttempt.error) {
      error = retryAttempt.error;
    }
  }

  // Handle network / timeout errors
  if (error) {
    if (error.name === "AbortError" || error.message.includes("abort")) {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "network_error" };
  }

  if (!res) {
    return { ok: false, reason: "network_error" };
  }

  // Handle HTTP status codes
  if (!res.ok) {
    let errorText = "";
    try {
      errorText = await res.text();
    } catch {
      // ignore
    }

    if (res.status === 429) {
      return { ok: false, reason: "rate_limited" };
    }

    if (res.status === 403) {
      const lower = errorText.toLowerCase();
      if (
        lower.includes("demo") ||
        lower.includes("not authorized") ||
        lower.includes("api key") ||
        lower.includes("billing") ||
        lower.includes("disabled") ||
        lower.includes("permission")
      ) {
        return { ok: false, reason: "feature unavailable with current key" };
      }
      return { ok: false, reason: "forbidden" };
    }

    if (res.status === 404) {
      return { ok: false, reason: "not_found" };
    }

    return {
      ok: false,
      reason: `HTTP_${res.status}: ${errorText ? errorText.slice(0, 150) : res.statusText}`,
    };
  }

  // Parse JSON
  try {
    const data = (await res.json()) as T;

    // Cache on success
    if ((options.ttlMs ?? 0) > 0) {
      pruneCache();
      requestCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + options.ttlMs!,
      });
    }

    return { ok: true, data };
  } catch (parseErr) {
    logger.warn("Malformed JSON response from Google API", { url: options.url, parseErr });
    return { ok: false, reason: "malformed_response" };
  }
}

/**
 * Resets the in-memory cache (primarily for unit tests).
 */
export function clearGoogleFetchCache(): void {
  requestCache.clear();
}
