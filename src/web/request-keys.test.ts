import { afterAll, describe, expect, test } from 'bun:test';
import { installRequestEnv, withRequestKeys } from './request-keys.js';

const originalEnv = process.env;
process.env.DEXTER_TEST_KEY = 'server-secret-value';
installRequestEnv(['DEXTER_TEST_KEY'], true);

afterAll(() => {
  process.env = originalEnv;
});

async function* readLater(): AsyncGenerator<string | undefined> {
  await Promise.resolve();
  yield process.env.DEXTER_TEST_KEY;
}

describe('request-scoped environment', () => {
  test('hides the server value outside a request when server values are hidden', () => {
    expect(process.env.DEXTER_TEST_KEY).toBeUndefined();
    expect('DEXTER_TEST_KEY' in process.env).toBe(false);
  });

  test('exposes the request value through async generators and awaits', async () => {
    const seen = await withRequestKeys({ DEXTER_TEST_KEY: 'user-key-123' }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      const out: Array<string | undefined> = [];
      for await (const v of readLater()) out.push(v);
      return out;
    });
    expect(seen).toEqual(['user-key-123']);
  });

  test('keeps concurrent requests apart', async () => {
    const run = (key: string) =>
      withRequestKeys({ DEXTER_TEST_KEY: key }, async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        return process.env.DEXTER_TEST_KEY;
      });
    expect(await Promise.all([run('key-aaaaaaaa'), run('key-bbbbbbbb')])).toEqual(['key-aaaaaaaa', 'key-bbbbbbbb']);
  });

  test('does not touch variables that are not managed', () => {
    process.env.DEXTER_OTHER = 'visible';
    expect(process.env.DEXTER_OTHER).toBe('visible');
  });
});
