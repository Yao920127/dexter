import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const MIN_SECRET_CHARS = 32;

/**
 * Encrypts small secrets (user API keys) for storage. AES-256-GCM with a key derived from the
 * server's master secret; `context` is authenticated, so a ciphertext copied to another user or
 * key slot fails to decrypt instead of silently working.
 */
export function createCryptoBox(secret: string) {
  if (secret.length < MIN_SECRET_CHARS) {
    throw new Error(`DEXTER_KEY_ENCRYPTION_SECRET must be at least ${MIN_SECRET_CHARS} characters`);
  }
  const key = createHash('sha256').update(secret).digest();
  return {
    encrypt(plaintext: string, context: string): string {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context));
      const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
    },
    /** Returns null when the data was tampered with, bound to another context, or made with another secret. */
    decrypt(payload: string, context: string): string | null {
      try {
        const raw = Buffer.from(payload, 'base64');
        if (raw.length <= IV_BYTES + TAG_BYTES) return null;
        const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
        decipher.setAAD(Buffer.from(context));
        decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
        return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
      } catch {
        return null;
      }
    },
  };
}

export type CryptoBox = ReturnType<typeof createCryptoBox>;
