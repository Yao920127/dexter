import { createHash, randomBytes } from 'node:crypto';

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (!(name in out)) out[name] = part.slice(eq + 1).trim();
  }
  return out;
}

interface CookieOptions {
  maxAgeSec: number;
  secure: boolean;
}

/** HttpOnly + SameSite=Lax always; `Secure` (and the `__Host-` name prefix, chosen by the caller) in the cloud. */
export function serializeCookie(name: string, value: string, { maxAgeSec, secure }: CookieOptions): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

export const clearCookie = (name: string, secure: boolean): string =>
  serializeCookie(name, '', { maxAgeSec: 0, secure });

export const newSessionToken = (): string => randomBytes(32).toString('base64url');

/** The database only ever holds this hash, so a leaked table cannot be replayed as logins. */
export const hashSessionToken = (token: string): string => createHash('sha256').update(token).digest('hex');
