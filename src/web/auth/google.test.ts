import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { hashSessionToken, newSessionToken, parseCookies, serializeCookie } from './cookies.js';
import { createGoogleAuth, profileFromIdToken } from './google.js';

const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const NOW = 1_700_000_000_000;

function idToken(claims: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'RS256' })}.${enc(claims)}.sig`;
}
const goodClaims = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  exp: NOW / 1000 + 600,
  sub: '1122',
  email: 'a@example.com',
  email_verified: true,
  name: 'Ada',
};

describe('profileFromIdToken', () => {
  test('accepts a valid token', () => {
    expect(profileFromIdToken(idToken(goodClaims), CLIENT_ID, NOW)).toEqual({ sub: '1122', email: 'a@example.com', name: 'Ada' });
  });

  test('falls back to the email when the name is missing', () => {
    expect(profileFromIdToken(idToken({ ...goodClaims, name: undefined }), CLIENT_ID, NOW).name).toBe('a@example.com');
  });

  test.each([
    ['wrong issuer', { iss: 'https://evil.example' }],
    ['another audience', { aud: 'other-app' }],
    ['expired', { exp: NOW / 1000 - 1 }],
    ['unverified email', { email_verified: false }],
    ['missing sub', { sub: undefined }],
    ['missing email', { email: undefined }],
  ])('rejects %s', (_label, override) => {
    expect(() => profileFromIdToken(idToken({ ...goodClaims, ...override }), CLIENT_ID, NOW)).toThrow();
  });

  test('rejects garbage', () => {
    expect(() => profileFromIdToken('nonsense', CLIENT_ID, NOW)).toThrow();
    expect(() => profileFromIdToken('a.%%%.c', CLIENT_ID, NOW)).toThrow();
  });
});

describe('google login flow', () => {
  const calls: Array<{ url: string; body: URLSearchParams }> = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body as URLSearchParams });
    return Response.json({ id_token: idToken(goodClaims) });
  }) as unknown as typeof fetch;
  const auth = createGoogleAuth({
    clientId: CLIENT_ID,
    clientSecret: 'secret',
    redirectUri: 'https://app.example/auth/google/callback',
    fetchImpl: fakeFetch,
    now: () => NOW,
  });

  test('start builds a PKCE redirect whose challenge matches the cookie verifier', () => {
    const { url, cookieValue } = auth.start();
    const params = new URL(url).searchParams;
    const [state, verifier] = cookieValue.split('.');
    expect(params.get('state')).toBe(state);
    expect(params.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('redirect_uri')).toBe('https://app.example/auth/google/callback');
    expect(params.get('scope')).toBe('openid email profile');
  });

  test('finish exchanges the code with the verifier and returns the profile', async () => {
    const { cookieValue } = auth.start();
    const state = cookieValue.split('.')[0];
    const profile = await auth.finish('auth-code', state, cookieValue);
    expect(profile.email).toBe('a@example.com');
    expect(calls.at(-1)?.body.get('code_verifier')).toBe(cookieValue.split('.')[1]);
    expect(calls.at(-1)?.body.get('client_secret')).toBe('secret');
  });

  test('finish refuses a missing code, a state mismatch or a missing cookie', async () => {
    const { cookieValue } = auth.start();
    const state = cookieValue.split('.')[0];
    await expect(auth.finish(null, state, cookieValue)).rejects.toThrow();
    await expect(auth.finish('c', 'forged', cookieValue)).rejects.toThrow();
    await expect(auth.finish('c', state, undefined)).rejects.toThrow();
  });

  test('finish fails when Google rejects the code', async () => {
    const rejecting = createGoogleAuth({
      clientId: CLIENT_ID, clientSecret: 's', redirectUri: 'https://x/cb',
      fetchImpl: (async () => new Response('{}', { status: 400 })) as unknown as typeof fetch,
    });
    const { cookieValue } = rejecting.start();
    await expect(rejecting.finish('c', cookieValue.split('.')[0], cookieValue)).rejects.toThrow('rejected');
  });
});

describe('cookies', () => {
  test('parses a Cookie header and ignores the first duplicate shadowing', () => {
    expect(parseCookies('a=1; b=two; a=3')).toEqual({ a: '1', b: 'two' });
    expect(parseCookies(null)).toEqual({});
  });

  test('serializes with HttpOnly and SameSite, adding Secure only in the cloud', () => {
    expect(serializeCookie('s', 'v', { maxAgeSec: 60, secure: false })).toBe('s=v; Path=/; HttpOnly; SameSite=Lax; Max-Age=60');
    expect(serializeCookie('s', 'v', { maxAgeSec: 60, secure: true })).toEndWith('; Secure');
  });

  test('session tokens are unique and stored only as a hash', () => {
    const token = newSessionToken();
    expect(token).not.toBe(newSessionToken());
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
  });
});
