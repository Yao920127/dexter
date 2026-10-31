import { describe, expect, test } from 'bun:test';
import { en } from './en.js';
import { zhTW } from './zh-TW.js';
import { displayWidth, parseLanguage } from './index.js';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('i18n dictionaries', () => {
  test('zh-TW has exactly the same keys as en', () => {
    expect(Object.keys(zhTW).sort()).toEqual(Object.keys(en).sort());
  });

  test('placeholders match between languages', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(zhTW[key])).toBe(placeholders(en[key]));
    }
  });

  test('parseLanguage accepts common aliases', () => {
    expect(parseLanguage('zh')).toBe('zh-TW');
    expect(parseLanguage('zh_tw')).toBe('zh-TW');
    expect(parseLanguage('EN')).toBe('en');
    expect(parseLanguage('fr')).toBeNull();
  });

  test('displayWidth counts CJK as two columns', () => {
    expect(displayWidth('abc')).toBe(3);
    expect(displayWidth('歡迎')).toBe(4);
  });
});

