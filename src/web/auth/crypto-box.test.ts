import { describe, expect, test } from 'bun:test';
import { createCryptoBox } from './crypto-box.js';

const SECRET = 'a-test-secret-that-is-long-enough-1234';

describe('crypto box', () => {
  test('round-trips a secret', () => {
    const box = createCryptoBox(SECRET);
    const sealed = box.encrypt('sk-abc123456789', 'user1:openai');
    expect(sealed).not.toContain('sk-abc');
    expect(box.decrypt(sealed, 'user1:openai')).toBe('sk-abc123456789');
  });

  test('uses a fresh iv so equal inputs differ', () => {
    const box = createCryptoBox(SECRET);
    expect(box.encrypt('same-value-1', 'c')).not.toBe(box.encrypt('same-value-1', 'c'));
  });

  test('refuses a ciphertext moved to another user or slot', () => {
    const box = createCryptoBox(SECRET);
    const sealed = box.encrypt('sk-abc123456789', 'user1:openai');
    expect(box.decrypt(sealed, 'user2:openai')).toBeNull();
    expect(box.decrypt(sealed, 'user1:anthropic')).toBeNull();
  });

  test('refuses tampered data and a different master secret', () => {
    const box = createCryptoBox(SECRET);
    const sealed = box.encrypt('sk-abc123456789', 'c');
    const flipped = Buffer.from(sealed, 'base64');
    flipped[flipped.length - 1] ^= 1;
    expect(box.decrypt(flipped.toString('base64'), 'c')).toBeNull();
    expect(createCryptoBox(`${SECRET}x`).decrypt(sealed, 'c')).toBeNull();
    expect(box.decrypt('not-base64!!', 'c')).toBeNull();
  });

  test('rejects a short master secret', () => {
    expect(() => createCryptoBox('short')).toThrow('at least 32');
  });
});
