import { getSetting, setSetting } from '../utils/config.js';
import { en, type MessageKey } from './en.js';
import { zhTW } from './zh-TW.js';

export type Language = 'en' | 'zh-TW';
export type { MessageKey };

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh-TW', label: '繁體中文' },
];

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = {
  en,
  'zh-TW': zhTW,
};

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'zh-TW';
}

/** Accepts common aliases such as "zh", "zh-tw", "zh_TW", "中文". */
export function parseLanguage(input: string | undefined | null): Language | null {
  if (!input) return null;
  const v = input.trim().toLowerCase().replace('_', '-');
  if (v === 'en' || v.startsWith('en-') || v === 'english') return 'en';
  if (v === 'zh' || v.startsWith('zh-') || v === '中文' || v === '繁體中文' || v === 'chinese') return 'zh-TW';
  return null;
}

let current: Language | null = null;

/** Order: persisted setting → DEXTER_LANG env → English (original behavior). */
export function getLanguage(): Language {
  if (current) return current;
  const saved = getSetting<string | undefined>('language', undefined);
  current = (isLanguage(saved) ? saved : parseLanguage(process.env.DEXTER_LANG)) ?? 'en';
  return current;
}

export function setLanguage(language: Language): void {
  current = language;
  setSetting('language', language);
}

export function toggleLanguage(): Language {
  const next: Language = getLanguage() === 'en' ? 'zh-TW' : 'en';
  setLanguage(next);
  return next;
}

/** Terminal display width: CJK / fullwidth characters occupy two columns. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6);
    width += wide ? 2 : 1;
  }
  return width;
}

/** Translate a key; `{name}` placeholders are replaced from params. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = DICTIONARIES[getLanguage()][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

/** Appended to the system prompt so model answers follow the UI language. */
export function getLanguagePromptHint(): string {
  return getLanguage() === 'zh-TW'
    ? '\n\n## Language\n\nRespond in Traditional Chinese (繁體中文) unless the user writes in another language. Keep tickers, tool names, and numbers unchanged.'
    : '';
}
