import type { SQL } from 'bun';
import {
  type Conversation,
  type ConversationSummary,
  MESSAGE_MAX_CHARS,
  type StoredMessage,
  makeTitle,
} from '../history-store.js';

const LIST_LIMIT = 200;

// PostgreSQL text cannot hold NUL, and a model answer could in principle contain one.
const clean = (text: string): string => text.replaceAll('\u0000', '').slice(0, MESSAGE_MAX_CHARS);

export interface HistoryStoreAsync {
  get(id: string): Promise<Conversation | null>;
  list(): Promise<ConversationSummary[]>;
  append(id: string, message: Omit<StoredMessage, 'at'>, now?: number): Promise<void>;
  remove(id: string): Promise<boolean>;
}

/** One user's conversations. Every query carries `user_id`, so a user can only ever reach their own rows. */
export function createDbHistory(sql: SQL, userId: string): HistoryStoreAsync {
  return {
    async get(id) {
      const [conv] = await sql`
        SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ${userId} AND id = ${id}`;
      if (!conv) return null;
      const rows = await sql`
        SELECT role, text, kind, at FROM messages
        WHERE user_id = ${userId} AND conversation_id = ${id} ORDER BY seq`;
      const messages: StoredMessage[] = rows.map(
        (m: { role: StoredMessage['role']; text: string; kind: StoredMessage['kind'] | null; at: string | number }) => ({
          role: m.role,
          text: m.text,
          at: Number(m.at),
          ...(m.kind ? { kind: m.kind } : {}),
        }),
      );
      return { id: conv.id, title: conv.title, createdAt: Number(conv.created_at), updatedAt: Number(conv.updated_at), messages };
    },

    async list() {
      const rows = await sql`
        SELECT id, title, created_at, updated_at FROM conversations
        WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT ${LIST_LIMIT}`;
      return rows.map((r: { id: string; title: string; created_at: string | number; updated_at: string | number }) => ({
        id: r.id,
        title: r.title,
        createdAt: Number(r.created_at),
        updatedAt: Number(r.updated_at),
      }));
    },

    async append(id, message, now = Date.now()) {
      const text = clean(message.text);
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO conversations (user_id, id, title, created_at, updated_at)
          VALUES (${userId}, ${id}, ${makeTitle(text) || 'Untitled'}, ${now}, ${now})
          ON CONFLICT (user_id, id) DO UPDATE SET updated_at = excluded.updated_at`;
        await tx`
          INSERT INTO messages (user_id, conversation_id, seq, role, text, kind, at)
          SELECT ${userId}, ${id}, COALESCE(MAX(seq) + 1, 0), ${message.role}, ${text}, ${message.kind ?? null}, ${now}
          FROM messages WHERE user_id = ${userId} AND conversation_id = ${id}`;
      });
    },

    async remove(id) {
      const removed = await sql.begin(async (tx) => {
        await tx`DELETE FROM messages WHERE user_id = ${userId} AND conversation_id = ${id}`;
        return tx`DELETE FROM conversations WHERE user_id = ${userId} AND id = ${id}`;
      });
      return removed.count > 0;
    },
  };
}
