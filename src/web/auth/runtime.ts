import { SQL } from 'bun';
import { type AccountStore, type User, createAccountStore } from './account-store.js';
import { clearCookie, hashSessionToken, newSessionToken, parseCookies, serializeCookie } from './cookies.js';
import { createCryptoBox } from './crypto-box.js';
import { createDbHistory } from './db-history.js';
import { createGoogleAuth } from './google.js';

const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
const LOGIN_COOKIE_TTL_SEC = 10 * 60;
const REQUIRED_ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DATABASE_URL', 'DEXTER_KEY_ENCRYPTION_SECRET'] as const;

export interface AuthRuntime {
  accounts: AccountStore;
  historyFor(userId: string): ReturnType<typeof createDbHistory>;
  userFrom(req: Request): Promise<User | null>;
  /** Handles /auth/google, /auth/google/callback and /auth/logout; null for any other path. */
  handle(req: Request, pathname: string): Promise<Response | null>;
}

interface RuntimeOptions {
  cloud: boolean;
  port: number;
}

const redirect = (location: string, cookies: string[] = []): Response => {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
};

/**
 * Google login is on only when all four settings exist. Setting some but not all is a mistake worth
 * stopping for, rather than silently serving a server that looks protected but is not.
 */
export async function createAuthRuntime(env: NodeJS.ProcessEnv, { cloud, port }: RuntimeOptions): Promise<AuthRuntime | null> {
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length === REQUIRED_ENV.length) return null;
  if (missing.length > 0) throw new Error(`Google login is half configured; also set: ${missing.join(', ')}`);

  const publicUrl = (
    env.DEXTER_PUBLIC_URL ?? (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${port}`)
  ).replace(/\/+$/, '');

  const sql = new SQL(env.DATABASE_URL as string);
  const accounts = createAccountStore(sql, createCryptoBox(env.DEXTER_KEY_ENCRYPTION_SECRET as string));
  await accounts.migrate();

  const google = createGoogleAuth({
    clientId: env.GOOGLE_CLIENT_ID as string,
    clientSecret: env.GOOGLE_CLIENT_SECRET as string,
    redirectUri: `${publicUrl}/auth/google/callback`,
  });

  const secure = cloud || publicUrl.startsWith('https://');
  const prefix = secure ? '__Host-' : '';
  const SESSION_COOKIE = `${prefix}dexter_session`;
  const LOGIN_COOKIE = `${prefix}dexter_login`;

  const userFrom = async (req: Request): Promise<User | null> => {
    const token = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE];
    return token ? accounts.userForSession(hashSessionToken(token)) : null;
  };

  async function handleCallback(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const cookieValue = parseCookies(req.headers.get('cookie'))[LOGIN_COOKIE];
    const clearLogin = clearCookie(LOGIN_COOKIE, secure);
    if (url.searchParams.get('error')) return redirect('/login?error=denied', [clearLogin]);
    try {
      const profile = await google.finish(url.searchParams.get('code'), url.searchParams.get('state'), cookieValue);
      const user = await accounts.upsertUser(profile);
      const token = newSessionToken();
      await accounts.createSession(user.id, hashSessionToken(token), SESSION_TTL_SEC * 1000);
      return redirect('/app', [serializeCookie(SESSION_COOKIE, token, { maxAgeSec: SESSION_TTL_SEC, secure }), clearLogin]);
    } catch {
      return redirect('/login?error=failed', [clearLogin]);
    }
  }

  return {
    accounts,
    historyFor: (userId) => createDbHistory(sql, userId),
    userFrom,
    async handle(req, pathname) {
      if (req.method === 'GET' && pathname === '/auth/google') {
        const { url, cookieValue } = google.start();
        return redirect(url, [serializeCookie(LOGIN_COOKIE, cookieValue, { maxAgeSec: LOGIN_COOKIE_TTL_SEC, secure })]);
      }
      if (req.method === 'GET' && pathname === '/auth/google/callback') return handleCallback(req);
      if (req.method === 'POST' && pathname === '/auth/logout') {
        const token = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE];
        if (token) await accounts.deleteSession(hashSessionToken(token));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie(SESSION_COOKIE, secure) },
        });
      }
      return null;
    },
  };
}
