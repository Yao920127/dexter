import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { completedTurns, createHistoryStore } from './history-store.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dexter-history-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const ID = 'conv-0001-aaaa';

describe('history store', () => {
  test('creates a conversation titled from its first user message', () => {
    const store = createHistoryStore(dir);
    const c = store.append(ID, { role: 'user', text: 'Compare NVDA and AMD margins' }, 1000);
    expect(c.title).toBe('Compare NVDA and AMD margins');
    expect(store.get(ID)?.messages).toHaveLength(1);
  });

  test('keeps earlier messages when appending and does not mutate the previous value', () => {
    const store = createHistoryStore(dir);
    const first = store.append(ID, { role: 'user', text: 'hello there' }, 1);
    const second = store.append(ID, { role: 'assistant', text: 'hi', kind: 'answer' }, 2);
    expect(first.messages).toHaveLength(1);
    expect(second.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(second.updatedAt).toBe(2);
    expect(second.createdAt).toBe(1);
  });

  test('survives creating a new store instance (i.e. a restart)', () => {
    createHistoryStore(dir).append(ID, { role: 'user', text: 'persist me' });
    expect(createHistoryStore(dir).get(ID)?.messages[0]?.text).toBe('persist me');
  });

  test('lists most recently updated first', () => {
    const store = createHistoryStore(dir);
    store.append('conv-old-0001', { role: 'user', text: 'old' }, 1);
    store.append('conv-new-0001', { role: 'user', text: 'new' }, 5);
    store.append('conv-old-0001', { role: 'assistant', text: 'x', kind: 'answer' }, 9);
    expect(store.list().map((c) => c.id)).toEqual(['conv-old-0001', 'conv-new-0001']);
  });

  test('truncates long titles', () => {
    const store = createHistoryStore(dir);
    expect(store.append(ID, { role: 'user', text: 'a'.repeat(200) }).title.length).toBeLessThanOrEqual(60);
  });

  test('removes a conversation and reports whether it existed', () => {
    const store = createHistoryStore(dir);
    store.append(ID, { role: 'user', text: 'bye now' });
    expect(store.remove(ID)).toBe(true);
    expect(store.get(ID)).toBeNull();
    expect(store.remove(ID)).toBe(false);
  });

  test('rejects ids that could escape the directory', () => {
    const store = createHistoryStore(dir);
    expect(() => store.get('../../etc/passwd')).toThrow();
    expect(() => store.append('a/b', { role: 'user', text: 'x' })).toThrow();
  });

  test('skips corrupt files instead of failing the whole list', () => {
    const store = createHistoryStore(dir);
    store.append(ID, { role: 'user', text: 'good one' });
    writeFileSync(join(dir, 'broken-file-01.json'), '{not json');
    expect(store.list().map((c) => c.id)).toEqual([ID]);
    expect(store.get('broken-file-01')).toBeNull();
  });

  test('completedTurns only returns user turns that received an answer', () => {
    const store = createHistoryStore(dir);
    store.append(ID, { role: 'user', text: 'q1 question' });
    store.append(ID, { role: 'assistant', text: 'a1', kind: 'answer' });
    store.append(ID, { role: 'user', text: 'q2 question' });
    store.append(ID, { role: 'assistant', text: 'oops', kind: 'error' });
    const c = store.append(ID, { role: 'user', text: 'q3 question' });
    expect(completedTurns(c)).toEqual([{ query: 'q1 question', answer: 'a1' }]);
  });
});
