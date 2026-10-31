import { createHash } from 'node:crypto';

/** Headers added to every response. HSTS is cloud-only: it would pin plain-http localhost otherwise. */
export function securityHeaders(cloud: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "style-src-attr 'unsafe-inline'", // a few static pages use style="" attributes
      "font-src https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  if (cloud) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return headers;
}

export interface RateLimiter {
  /** Takes one token for `key`; `retryAfterSec` is set when the bucket is empty. */
  take(key: string): { ok: boolean; retryAfterSec: number };
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const MAX_TRACKED_KEYS = 10_000;

/** In-memory token bucket. Fine for one instance; state is lost on restart, which only loosens limits briefly. */
export function createRateLimiter(
  capacity: number,
  refillPerSec: number,
  now: () => number = Date.now,
): RateLimiter {
  const buckets = new Map<string, Bucket>();
  return {
    take(key) {
      const t = now();
      const prior = buckets.get(key);
      const tokens = prior
        ? Math.min(capacity, prior.tokens + ((t - prior.updatedAt) / 1000) * refillPerSec)
        : capacity;
      if (!prior && buckets.size >= MAX_TRACKED_KEYS) {
        // Drop the oldest entry so a flood of distinct keys cannot grow memory without bound.
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
      if (tokens < 1) {
        buckets.set(key, { tokens, updatedAt: t });
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((1 - tokens) / refillPerSec)) };
      }
      buckets.set(key, { tokens: tokens - 1, updatedAt: t });
      return { ok: true, retryAfterSec: 0 };
    },
  };
}

/**
 * Client address behind a reverse proxy. Takes the right-most X-Forwarded-For entry (the one the
 * trusted proxy appended); a client can forge entries to its left but not that one.
 */
export function clientIp(req: Request, socketIp: string | undefined, behindProxy: boolean): string {
  if (behindProxy) {
    const forwarded = req.headers.get('x-forwarded-for');
    const last = forwarded?.split(',').pop()?.trim();
    if (last) return last;
  }
  return socketIp ?? 'unknown';
}

export const CLIENT_TOKEN_PATTERN = /^[a-f0-9]{32,64}$/;

/** The server only ever stores a hash of the browser's random client token. */
export function ownerKeyFrom(token: string | null): string | null {
  if (!token || !CLIENT_TOKEN_PATTERN.test(token)) return null;
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

const KEY_SHAPES =
  /(sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|xai-[A-Za-z0-9]{12,}|gsk_[A-Za-z0-9]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{16,})/g;
const MIN_SECRET_LENGTH = 8;

/** Removes the request's own keys, and anything shaped like a provider key, before text leaves the server. */
export function redactSecrets(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= MIN_SECRET_LENGTH) out = out.split(secret).join('[redacted]');
  }
  return out.replace(KEY_SHAPES, '[redacted]');
}
