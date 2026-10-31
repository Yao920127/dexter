import { randomUUID } from 'node:crypto';
import type { SQL } from 'bun';
import type { CryptoBox } from './crypto-box.js';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

// Portable between PostgreSQL (production) and SQLite (tests). Timestamps are epoch milliseconds.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    user_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    last4 TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, slot)
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS conversations_recent ON conversations (user_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS messages (
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    kind TEXT,
    at BIGINT NOT NULL,
    PRIMARY KEY (user_id, conversation_id, seq)
  )`,
];

const keyContext = (userId: string, slot: string): string => `${userId}:${slot}`;

/** Accounts, login sessions and each user's encrypted API keys. */
export function createAccountStore(sql: SQL, box: CryptoBox, now: () => number = Date.now) {
  return {
    async migrate(): Promise<void> {
      for (const statement of SCHEMA) await sql.unsafe(statement);
    },

    /** Google's `sub` is the identity; email and name are refreshed on every login. */
    async upsertUser(profile: GoogleProfile): Promise<User> {
      await sql`
        INSERT INTO users (id, google_sub, email, name, created_at)
        VALUES (${randomUUID()}, ${profile.sub}, ${profile.email}, ${profile.name}, ${now()})
        ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name`;
      const [row] = await sql`SELECT id, email, name FROM users WHERE google_sub = ${profile.sub}`;
      return { id: row.id, email: row.email, name: row.name };
    },

    async createSession(userId: string, tokenHash: string, ttlMs: number): Promise<void> {
      await sql`DELETE FROM sessions WHERE expires_at < ${now()}`;
      await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${userId}, ${now() + ttlMs})`;
    },

    async userForSession(tokenHash: string): Promise<User | null> {
      const [row] = await sql`
        SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ${tokenHash} AND s.expires_at > ${now()}`;
      return row ? { id: row.id, email: row.email, name: row.name } : null;
    },

    async deleteSession(tokenHash: string): Promise<void> {
      await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
    },

    async setKey(userId: string, slot: string, value: string): Promise<void> {
      const sealed = box.encrypt(value, keyContext(userId, slot));
      await sql`
        INSERT INTO api_keys (user_id, slot, ciphertext, last4, updated_at)
        VALUES (${userId}, ${slot}, ${sealed}, ${value.slice(-4)}, ${now()})
        ON CONFLICT (user_id, slot) DO UPDATE
          SET ciphertext = excluded.ciphertext, last4 = excluded.last4, updated_at = excluded.updated_at`;
    },

    /** `{ slot: last four characters }`, the only part of a key the browser ever sees again. */
    async keyHints(userId: string): Promise<Record<string, string>> {
      const rows = await sql`SELECT slot, last4 FROM api_keys WHERE user_id = ${userId}`;
      return Object.fromEntries(rows.map((r: { slot: string; last4: string }) => [r.slot, r.last4]));
    },

    /** Decrypted keys for one chat run. A row that no longer decrypts is skipped, i.e. treated as unset. */
    async loadKeys(userId: string): Promise<Record<string, string>> {
      const rows = await sql`SELECT slot, ciphertext FROM api_keys WHERE user_id = ${userId}`;
      const out: Record<string, string> = {};
      for (const row of rows as Array<{ slot: string; ciphertext: string }>) {
        const value = box.decrypt(row.ciphertext, keyContext(userId, row.slot));
        if (value !== null) out[row.slot] = value;
      }
      return out;
    },

    async removeKey(userId: string, slot: string): Promise<void> {
      await sql`DELETE FROM api_keys WHERE user_id = ${userId} AND slot = ${slot}`;
    },

    async removeAllKeys(userId: string): Promise<void> {
      await sql`DELETE FROM api_keys WHERE user_id = ${userId}`;
    },
  };
}

export type AccountStore = ReturnType<typeof createAccountStore>;
