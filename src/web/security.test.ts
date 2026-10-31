import { describe, expect, test } from 'bun:test';
import { clientIp, createRateLimiter, ownerKeyFrom, redactSecrets, securityHeaders } from './security.js';

describe('securityHeaders', () => {
  test('forbids framing, sniffing and third-party scripts', () => {
    const h = securityHeaders(false);
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Content-Security-Policy']).toContain("script-src 'self'");
    expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  test('sends HSTS only in cloud mode', () => {
    expect(securityHeaders(false)['Strict-Transport-Security']).toBeUndefined();
    expect(securityHeaders(true)['Strict-Transport-Security']).toContain('max-age=');
  });
});

describe('createRateLimiter', () => {
  test('rejects once the bucket is empty and reports a retry delay', () => {
    let now = 0;
    const limiter = createRateLimiter(2, 1, () => now);
    expect(limiter.take('a').ok).toBe(true);
    expect(limiter.take('a').ok).toBe(true);
    const blocked = limiter.take('a');
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  test('refills over time and tracks keys independently', () => {
    let now = 0;
    const limiter = createRateLimiter(1, 1, () => now);
    expect(limiter.take('a').ok).toBe(true);
    expect(limiter.take('a').ok).toBe(false);
    expect(limiter.take('b').ok).toBe(true);
    now = 1500;
    expect(limiter.take('a').ok).toBe(true);
  });
});

describe('clientIp', () => {
  const req = (xff?: string) => new Request('http://x', { headers: xff ? { 'x-forwarded-for': xff } : {} });

  test('uses the right-most forwarded entry so a forged left entry is ignored', () => {
    expect(clientIp(req('6.6.6.6, 203.0.113.9'), '10.0.0.1', true)).toBe('203.0.113.9');
  });

  test('ignores forwarding headers when not behind a proxy', () => {
    expect(clientIp(req('6.6.6.6'), '127.0.0.1', false)).toBe('127.0.0.1');
  });
});

describe('ownerKeyFrom', () => {
  test('hashes a valid token and rejects malformed ones', () => {
    const token = 'a'.repeat(32);
    const key = ownerKeyFrom(token);
    expect(key).toMatch(/^[a-f0-9]{32}$/);
    expect(key).not.toContain(token);
    expect(ownerKeyFrom('../etc/passwd')).toBeNull();
    expect(ownerKeyFrom(null)).toBeNull();
    expect(ownerKeyFrom('abc')).toBeNull();
  });
});

describe('redactSecrets', () => {
  test('removes the request keys wherever they appear', () => {
    const out = redactSecrets('401: bad key hunter2hunter2 for user', ['hunter2hunter2']);
    expect(out).not.toContain('hunter2hunter2');
    expect(out).toContain('[redacted]');
  });

  test('removes provider-shaped keys the caller did not supply', () => {
    const out = redactSecrets('Incorrect API key provided: sk-proj-abcdef1234567890XYZ');
    expect(out).not.toContain('sk-proj');
  });

  test('leaves ordinary text alone', () => {
    expect(redactSecrets('Revenue grew 12% year over year.')).toBe('Revenue grew 12% year over year.');
  });
});
