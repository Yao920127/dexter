import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSetting } from './config.js';

// Settings live at the relative path .dexter/settings.json, so each test runs from its own directory.
let originalCwd: string;
let dir: string;

function writeSettings(settings: Record<string, unknown>): void {
  mkdirSync(join(dir, '.dexter'), { recursive: true });
  writeFileSync(join(dir, '.dexter', 'settings.json'), JSON.stringify(settings));
}

beforeEach(() => {
  originalCwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), 'dexter-config-'));
  process.chdir(dir);
});
afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('getSetting after local models were removed', () => {
  test('ignores a saved local Ollama provider', () => {
    writeSettings({ provider: 'ollama' });
    expect(getSetting('provider', 'openai')).toBe('openai');
  });

  test('ignores a saved local Ollama model id', () => {
    writeSettings({ modelId: 'ollama:llama3.1' });
    expect(getSetting('modelId', 'gpt-6-astra')).toBe('gpt-6-astra');
  });

  test('keeps Ollama Cloud selections', () => {
    writeSettings({ provider: 'ollama-cloud', modelId: 'ollama-cloud:llama3.1' });
    expect(getSetting('provider', 'openai')).toBe('ollama-cloud');
    expect(getSetting('modelId', 'gpt-6-astra')).toBe('ollama-cloud:llama3.1');
  });

  test('returns other saved values unchanged', () => {
    writeSettings({ provider: 'anthropic', modelId: 'claude-sonnet-5' });
    expect(getSetting('provider', 'openai')).toBe('anthropic');
    expect(getSetting('modelId', 'x')).toBe('claude-sonnet-5');
  });
});
