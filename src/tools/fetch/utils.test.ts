import { describe, expect, test } from 'bun:test';
import { isInternalHost, validateURL } from './utils.js';

describe('validateURL internal-host guard', () => {
  test.each([
    'http://127.0.0.1/admin',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.0.9/',
    'http://100.64.0.1/',
    'http://2130706433/',
    'http://0x7f.0.0.1/',
    'http://[::1]/',
    'http://db.railway.internal/',
    'http://printer.local/',
  ])('rejects %s', (url) => {
    expect(validateURL(url)).toBe(false);
  });

  test.each(['https://www.sec.gov/edgar', 'https://example.com/a?b=c', 'http://8.8.8.8/'])('allows %s', (url) => {
    expect(validateURL(url)).toBe(true);
  });

  test('isInternalHost treats public names as external', () => {
    expect(isInternalHost('investor.apple.com')).toBe(false);
  });
});
