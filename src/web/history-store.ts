import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

const TITLE_MAX_CHARS = 60;
export const MESSAGE_MAX_CHARS = 200_000;
const LIST_LIMIT = 200;

/** `answer` is the model's reply; `error` and `stopped` mark a turn that did not finish. */
export type MessageKind = 'answer' | 'error' | 'stopped';

export interface StoredMessage {
  role: 'user' | 'assistant';
  text: string;
  at: number;
  kind?: MessageKind;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

export type ConversationSummary = Pick<Conversation, 'id' | 'title' | 'createdAt' | 'updatedAt'>;

export function makeTitle(firstQuery: string): string {
  const flat = firstQuery.replace(/\s+/g, ' ').trim();
  return flat.length > TITLE_MAX_CHARS ? `${flat.slice(0, TITLE_MAX_CHARS - 1)}…` : flat;
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<Conversation>;
  return typeof c.id === 'string' && typeof c.title === 'string' && typeof c.updatedAt === 'number' && Array.isArray(c.messages);
}

/**
 * File-per-conversation JSON store. Every update writes a new object and swaps the file in
 * atomically (write temp, rename), so a crash mid-write never leaves a half-written conversation.
 */
export function createHistoryStore(dir: string) {
  const fileFor = (id: string): string => {
    if (!CONVERSATION_ID_PATTERN.test(id)) throw new Error('Invalid conversation id');
    return join(dir, `${id}.json`);
  };

  const write = (conversation: Conversation): void => {
    mkdirSync(dir, { recursive: true });
    const target = fileFor(conversation.id);
    const temp = `${target}.tmp`;
    writeFileSync(temp, JSON.stringify(conversation), { mode: 0o600 });
    renameSync(temp, target);
  };

  const get = (id: string): Conversation | null => {
    const file = fileFor(id);
    if (!existsSync(file)) return null;
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
      return isConversation(parsed) ? parsed : null;
    } catch {
      return null; // a corrupt file is skipped, not fatal
    }
  };

  return {
    get,

    /** Most recently updated first. */
    list(): ConversationSummary[] {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => get(name.slice(0, -'.json'.length)))
        .filter((c): c is Conversation => c !== null)
        .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, LIST_LIMIT);
    },

    /** Appends a message, creating the conversation (titled from its first user message) if needed. */
    append(id: string, message: Omit<StoredMessage, 'at'>, now: number = Date.now()): Conversation {
      const existing = get(id);
      const stored: StoredMessage = { ...message, text: message.text.slice(0, MESSAGE_MAX_CHARS), at: now };
      const next: Conversation = existing
        ? { ...existing, updatedAt: now, messages: [...existing.messages, stored] }
        : { id, title: makeTitle(message.text) || 'Untitled', createdAt: now, updatedAt: now, messages: [stored] };
      write(next);
      return next;
    },

    remove(id: string): boolean {
      const file = fileFor(id);
      if (!existsSync(file)) return false;
      rmSync(file);
      return true;
    },
  };
}

export type HistoryStore = ReturnType<typeof createHistoryStore>;

/** Completed user→assistant pairs, used to rebuild the agent's context after a restart. */
export function completedTurns(conversation: Conversation): Array<{ query: string; answer: string }> {
  const turns: Array<{ query: string; answer: string }> = [];
  const { messages } = conversation;
  for (let i = 0; i < messages.length - 1; i++) {
    const [user, reply] = [messages[i], messages[i + 1]];
    if (user.role === 'user' && reply.role === 'assistant' && reply.kind === 'answer') {
      turns.push({ query: user.text, answer: reply.text });
    }
  }
  return turns;
}
