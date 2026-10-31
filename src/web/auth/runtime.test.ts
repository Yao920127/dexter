import { describe, expect, test } from 'bun:test';
import { createAuthRuntime } from './runtime.js';

const base = {
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  DATABASE_URL: 'sqlite://:memory:',
  DEXTER_KEY_ENCRYPTION_SECRET: 'a-test-secret-that-is-long-enough-1234',
};
const options = { cloud: false, port: 3000 };

describe('createAuthRuntime', () => {
  test('stays off when nothing is configured', async () => {
    expect(await createAuthRuntime({}, options)).toBeNull();
  });

  test('refuses a half-configured server and names what is missing', async () => {
    await expect(createAuthRuntime({ GOOGLE_CLIENT_ID: 'id' }, options)).rejects.toThrow('DATABASE_URL');
  });

  test('redirects /auth/google to Google with a login cookie', async () => {
    const runtime = await createAuthRuntime(base, options);
    const res = await runtime!.handle(new Request('http://localhost:3000/auth/google'), '/auth/google');
    expect(res?.status).toBe(302);
    const location = new URL(res!.headers.get('location')!);
    expect(location.host).toBe('accounts.google.com');
    expect(location.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/google/callback');
    expect(res!.headers.get('set-cookie')).toContain('dexter_login=');
    expect(res!.headers.get('set-cookie')).toContain('HttpOnly');
  });

  test('uses __Host- Secure cookies on the cloud public domain', async () => {
    const runtime = await createAuthRuntime({ ...base, RAILWAY_PUBLIC_DOMAIN: 'dexter.example.app' }, { cloud: true, port: 3000 });
    const res = await runtime!.handle(new Request('https://dexter.example.app/auth/google'), '/auth/google');
    expect(res!.headers.get('set-cookie')).toStartWith('__Host-dexter_login=');
    expect(res!.headers.get('set-cookie')).toContain('Secure');
    expect(new URL(res!.headers.get('location')!).searchParams.get('redirect_uri')).toBe(
      'https://dexter.example.app/auth/google/callback',
    );
  });

  test('a callback without a matching login cookie sends the user back to the login page', async () => {
    const runtime = await createAuthRuntime(base, options);
    const req = new Request('http://localhost:3000/auth/google/callback?code=x&state=forged');
    const res = await runtime!.handle(req, '/auth/google/callback');
    expect(res?.headers.get('location')).toBe('/login?error=failed');
    expect(await runtime!.userFrom(req)).toBeNull();
  });

  test('a valid session cookie resolves to its user, and logout invalidates it', async () => {
    const runtime = await createAuthRuntime(base, options);
    const user = await runtime!.accounts.upsertUser({ sub: 's', email: 'a@example.com', name: 'A' });
    const { hashSessionToken } = await import('./cookies.js');
    await runtime!.accounts.createSession(user.id, hashSessionToken('tok'), 60_000);
    const authed = () => new Request('http://localhost:3000/api/me', { headers: { cookie: 'dexter_session=tok' } });
    expect((await runtime!.userFrom(authed()))?.email).toBe('a@example.com');

    const out = await runtime!.handle(new Request('http://localhost:3000/auth/logout', { method: 'POST', headers: { cookie: 'dexter_session=tok' } }), '/auth/logout');
    expect(out?.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await runtime!.userFrom(authed())).toBeNull();
  });

  test('ignores unrelated paths', async () => {
    const runtime = await createAuthRuntime(base, options);
    expect(await runtime!.handle(new Request('http://localhost:3000/x'), '/x')).toBeNull();
  });
});
