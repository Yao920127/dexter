import { createHash, randomBytes } from 'node:crypto';
import type { GoogleProfile } from './account-store.js';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const CODE_PATTERN = /^[\x21-\x7E]{1,2048}$/;

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const b64url = (bytes: Buffer): string => bytes.toString('base64url');

/**
 * Google "authorization code + PKCE" login. `start` returns the redirect URL plus a short-lived
 * cookie value (`state.verifier`); `finish` checks the returned state against that cookie, swaps the
 * code for an ID token over TLS, and validates its claims.
 */
export function createGoogleAuth(config: GoogleConfig) {
  const doFetch = config.fetchImpl ?? fetch;
  const now = config.now ?? Date.now;

  return {
    start(): { url: string; cookieValue: string } {
      const state = b64url(randomBytes(24));
      const verifier = b64url(randomBytes(48));
      const challenge = b64url(createHash('sha256').update(verifier).digest());
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      return { url: `${AUTH_ENDPOINT}?${params}`, cookieValue: `${state}.${verifier}` };
    },

    async finish(code: string | null, state: string | null, cookieValue: string | undefined): Promise<GoogleProfile> {
      const [expectedState, verifier] = (cookieValue ?? '').split('.');
      if (!code || !state || !expectedState || !verifier || state !== expectedState || !CODE_PATTERN.test(code)) {
        throw new Error('Invalid login state');
      }
      const response = await doFetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }),
      });
      if (!response.ok) throw new Error('Google rejected the login');
      const { id_token: idToken } = (await response.json()) as { id_token?: unknown };
      if (typeof idToken !== 'string') throw new Error('Google returned no identity');
      return profileFromIdToken(idToken, config.clientId, now());
    },
  };
}

/**
 * The token comes straight from Google's token endpoint over TLS, so (per OpenID Connect Core §3.1.3.7)
 * its signature need not be re-verified; the claims still are.
 */
export function profileFromIdToken(idToken: string, clientId: string, nowMs: number): GoogleProfile {
  const payload = idToken.split('.')[1];
  if (!payload) throw new Error('Malformed identity token');
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed identity token');
  }
  const { iss, aud, exp, sub, email, email_verified: verified, name } = claims;
  if (typeof iss !== 'string' || !ISSUERS.has(iss)) throw new Error('Wrong token issuer');
  if (aud !== clientId) throw new Error('Token was issued for another app');
  if (typeof exp !== 'number' || exp * 1000 <= nowMs) throw new Error('Identity token expired');
  if (typeof sub !== 'string' || !sub || typeof email !== 'string' || !email) throw new Error('Identity incomplete');
  if (verified !== true) throw new Error('Google email is not verified');
  return { sub, email, name: typeof name === 'string' && name ? name : email };
}
