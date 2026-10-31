import { beforeEach, describe, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { type AccountStore, createAccountStore } from './account-store.js';
import { createCryptoBox } from './crypto-box.js';
import { createDbHistory } from './db-history.js';

const box = createCryptoBox('a-test-secret-that-is-long-enough-1234');
let sql: SQL;
let store: AccountStore;
let clock = 1_000;

beforeEach(async () => {
  sql = new SQL('sqlite://:memory:');
  clock = 1_000;
  store = createAccountStore(sql, box, () => clock);
  await store.migrate();
});

const alice = { sub: 'g-alice', email: 'alice@example.com', name: 'Alice' };
const bob = { sub: 'g-bob', email: 'bob@example.com', name: 'Bob' };

describe('users and sessions', () => {
  test('logging in twice returns the same user and refreshes the profile', async () => {
    const first = await store.upsertUser(alice);
    const again = await store.upsertUser({ ...alice, name: 'Alice B.' });
    expect(again.id).toBe(first.id);
    expect(again.name).toBe('Alice B.');
  });

  test('a session resolves to its user until it expires or is deleted', async () => {
    const user = await store.upsertUser(alice);
    await store.createSession(user.id, 'hash-1', 5_000);
    expect((await store.userForSession('hash-1'))?.email).toBe('alice@example.com');
    clock += 5_001;
    expect(await store.userForSession('hash-1')).toBeNull();

    await store.createSession(user.id, 'hash-2', 5_000);
    await store.deleteSession('hash-2');
    expect(await store.userForSession('hash-2')).toBeNull();
    expect(await store.userForSession('unknown')).toBeNull();
  });
});

describe('api keys', () => {
  test('stores keys encrypted and returns only the last four characters as a hint', async () => {
    const user = await store.upsertUser(alice);
    await store.setKey(user.id, 'openai', 'sk-secret-value-abcd');
    const [row] = await sql`SELECT ciphertext FROM api_keys WHERE user_id = ${user.id}`;
    expect(row.ciphertext).not.toContain('secret-value');
    expect(await store.keyHints(user.id)).toEqual({ openai: 'abcd' });
    expect(await store.loadKeys(user.id)).toEqual({ openai: 'sk-secret-value-abcd' });
  });

  test('replacing, removing and clearing keys', async () => {
    const user = await store.upsertUser(alice);
    await store.setKey(user.id, 'openai', 'sk-first-value-1111');
    await store.setKey(user.id, 'openai', 'sk-second-value-2222');
    await store.setKey(user.id, 'anthropic', 'sk-ant-value-3333');
    expect((await store.loadKeys(user.id)).openai).toBe('sk-second-value-2222');
    await store.removeKey(user.id, 'openai');
    expect(Object.keys(await store.loadKeys(user.id))).toEqual(['anthropic']);
    await store.removeAllKeys(user.id);
    expect(await store.loadKeys(user.id)).toEqual({});
  });

  test('keys never leak between users, even if a ciphertext is copied across', async () => {
    const a = await store.upsertUser(alice);
    const b = await store.upsertUser(bob);
    await store.setKey(a.id, 'openai', 'sk-alice-value-1111');
    expect(await store.loadKeys(b.id)).toEqual({});
    await sql`INSERT INTO api_keys (user_id, slot, ciphertext, last4, updated_at)
      SELECT ${b.id}, slot, ciphertext, last4, updated_at FROM api_keys WHERE user_id = ${a.id}`;
    expect(await store.loadKeys(b.id)).toEqual({});
  });
});

describe('per-user history', () => {
  test('creates, reads, lists and removes a conversation', async () => {
    const user = await store.upsertUser(alice);
    const history = createDbHistory(sql, user.id);
    await history.append('conv-0001', { role: 'user', text: 'Compare NVDA and AMD' }, 10);
    await history.append('conv-0001', { role: 'assistant', text: 'NVDA is higher.', kind: 'answer' }, 20);

    const conv = await history.get('conv-0001');
    expect(conv?.title).toBe('Compare NVDA and AMD');
    expect(conv?.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(conv?.messages[1].kind).toBe('answer');
    expect(conv?.updatedAt).toBe(20);
    expect((await history.list()).map((c) => c.id)).toEqual(['conv-0001']);

    expect(await history.remove('conv-0001')).toBe(true);
    expect(await history.get('conv-0001')).toBeNull();
    expect(await history.remove('conv-0001')).toBe(false);
  });

  test('two users with the same conversation id stay separate', async () => {
    const a = createDbHistory(sql, (await store.upsertUser(alice)).id);
    const b = createDbHistory(sql, (await store.upsertUser(bob)).id);
    await a.append('shared-id-1', { role: 'user', text: 'alice question' });
    expect(await b.get('shared-id-1')).toBeNull();
    expect(await b.list()).toEqual([]);
    await b.append('shared-id-1', { role: 'user', text: 'bob question' });
    expect((await a.get('shared-id-1'))?.messages).toHaveLength(1);
    expect(await b.remove('shared-id-1')).toBe(true);
    expect(await a.get('shared-id-1')).not.toBeNull();
  });

  test('lists most recently updated first and strips NUL characters', async () => {
    const history = createDbHistory(sql, (await store.upsertUser(alice)).id);
    await history.append('conv-old-1', { role: 'user', text: 'old' }, 1);
    await history.append('conv-new-1', { role: 'user', text: 'new\u0000text' }, 2);
    expect((await history.list()).map((c) => c.id)).toEqual(['conv-new-1', 'conv-old-1']);
    expect((await history.get('conv-new-1'))?.messages[0].text).toBe('newtext');
  });
});
