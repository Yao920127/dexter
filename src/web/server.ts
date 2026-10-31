#!/usr/bin/env bun
import { config } from 'dotenv';
import { join } from 'node:path';
import { restoreSessionHistory, runAgentForMessage } from '../gateway/agent-runner.js';
import { dexterPath } from '../utils/paths.js';
import { completedTurns, CONVERSATION_ID_PATTERN, createHistoryStore } from './history-store.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../model/llm.js';
import { getSetting, setSetting } from '../utils/config.js';
import {
  checkApiKeyExists,
  checkApiKeyExistsForProvider,
  saveApiKeyToEnv,
  SEARCH_PROVIDERS,
} from '../utils/env.js';
import { PROVIDERS } from '../utils/model.js';
import { PROVIDERS as PROVIDER_DEFS, resolveProvider } from '../providers.js';

config({ quiet: true });

const PORT = Number(process.env.DEXTER_WEB_PORT ?? 3000);
// The agent can read files and call paid APIs, so the server only listens on loopback.
const HOSTNAME = '127.0.0.1';
const MAX_QUERY_CHARS = 4000;
const MAX_BODY_BYTES = 16_000;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._:\/-]{1,100}$/;
const ZH_TW_REPLY_HINT = '\n\n（請以繁體中文回覆。）';
const store = createHistoryStore(dexterPath('web-history'));
// Conversations whose agent run is in flight. Runs outlive the browser connection, so a page
// refresh never loses an answer; the run is only cancelled through /api/chat/stop.
const running = new Map<string, AbortController>();
const LOCAL_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

const publicDir = join(import.meta.dir, 'public');
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app': { file: 'app.html', type: 'text/html; charset=utf-8' },
  '/newsprint.css': { file: 'newsprint.css', type: 'text/css; charset=utf-8' },
  '/chat.css': { file: 'chat.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/settings': { file: 'settings.html', type: 'text/html; charset=utf-8' },
  '/settings.js': { file: 'settings.js', type: 'text/javascript; charset=utf-8' },
  '/i18n.js': { file: 'i18n.js', type: 'text/javascript; charset=utf-8' },
};

// The browser only sees the final answer or an error; intermediate research steps stay server-side.
type WebEvent = { type: 'answer'; text: string } | { type: 'error'; message: string };

// Reject requests whose Host/Origin is not this loopback server (DNS rebinding / cross-site POST).
function isLocalRequest(req: Request): boolean {
  const host = req.headers.get('host') ?? '';
  if (!LOCAL_HOSTS.has(host)) return false;
  const origin = req.headers.get('origin');
  return origin === null || LOCAL_HOSTS.has(new URL(origin).host);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function currentSelection(): { provider: string; model: string } {
  const provider = getSetting('provider', DEFAULT_PROVIDER) as string;
  const model = getSetting('modelId', null) as string | null;
  const listed = PROVIDERS.find((p) => p.providerId === provider)?.models[0]?.id;
  return { provider, model: model ?? listed ?? DEFAULT_MODEL };
}

function handleGetSettings(): Response {
  return json(
    {
      ...currentSelection(),
      providers: PROVIDERS.map((p) => ({
        id: p.providerId,
        displayName: p.displayName,
        models: p.models,
        hasKey: checkApiKeyExistsForProvider(p.providerId),
        // Providers without a fixed list (OpenRouter, Ollama Cloud) take a free-form model id.
        freeText: p.models.length === 0,
      })),
    },
    200,
  );
}

async function handleSetSettings(req: Request): Promise<Response> {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
  let body: { provider?: unknown; model?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const provider = typeof body.provider === 'string' ? body.provider : '';
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const entry = PROVIDERS.find((p) => p.providerId === provider);
  if (!entry || !MODEL_ID_PATTERN.test(model)) return json({ error: 'Invalid provider or model' }, 400);
  // A fixed-list provider must use one of its models; free-text providers must match their routing prefix.
  const valid = entry.models.length > 0
    ? entry.models.some((m) => m.id === model)
    : resolveProvider(model).id === provider;
  if (!valid) return json({ error: 'Model does not belong to provider' }, 400);
  setSetting('provider', provider);
  setSetting('modelId', model);
  return handleGetSettings();
}

interface KeySlot {
  id: string;
  label: string;
  group: 'model' | 'search' | 'data';
  envVar: string;
}

// Only these environment variables can be written from the browser.
const KEY_SLOTS: KeySlot[] = [
  ...PROVIDER_DEFS.filter((p) => p.apiKeyEnvVar).map((p) => ({
    id: p.id,
    label: p.displayName,
    group: 'model' as const,
    envVar: p.apiKeyEnvVar as string,
  })),
  { id: 'financial-datasets', label: 'Financial Datasets', group: 'data', envVar: 'FINANCIAL_DATASETS_API_KEY' },
  ...Object.entries(SEARCH_PROVIDERS).map(([id, p]) => ({
    id,
    label: p.displayName,
    group: 'search' as const,
    envVar: p.apiKeyEnvVar,
  })),
];
const API_KEY_PATTERN = /^[\x21-\x7E]{8,400}$/; // printable, no whitespace or newlines (the value is written to .env)

// Key values are write-only: the API reports whether each slot is set, never the value.
function handleGetKeys(): Response {
  return json(
    { keys: KEY_SLOTS.map(({ id, label, group, envVar }) => ({ id, label, group, set: checkApiKeyExists(envVar) })) },
    200,
  );
}

async function handleSetKey(req: Request): Promise<Response> {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
  let body: { id?: unknown; value?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const slot = KEY_SLOTS.find((k) => k.id === body.id);
  const value = typeof body.value === 'string' ? body.value.trim() : '';
  if (!slot) return json({ error: 'Unknown key' }, 400);
  if (!API_KEY_PATTERN.test(value)) return json({ error: 'Invalid key format' }, 400);
  if (!saveApiKeyToEnv(slot.envVar, value)) return json({ error: 'Could not save key' }, 500);
  return handleGetKeys();
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function conversationIdFrom(value: unknown): string | null {
  return typeof value === 'string' && CONVERSATION_ID_PATTERN.test(value) ? value : null;
}

function handleListConversations(): Response {
  return json({ conversations: store.list().map((c) => ({ ...c, running: running.has(c.id) })) }, 200);
}

function handleGetConversation(id: string): Response {
  const conversation = store.get(id);
  return conversation ? json({ conversation, running: running.has(id) }, 200) : json({ error: 'Not found' }, 404);
}

function handleDeleteConversation(id: string): Response {
  running.get(id)?.abort();
  return store.remove(id) ? json({ ok: true }, 200) : json({ error: 'Not found' }, 404);
}

async function handleStop(req: Request): Promise<Response> {
  const id = conversationIdFrom((await readJson(req))?.conversationId);
  if (!id) return json({ error: 'Invalid conversation' }, 400);
  running.get(id)?.abort();
  return json({ ok: true }, 200);
}

async function runConversationTurn(
  id: string,
  query: string,
  lang: unknown,
  abort: AbortController,
): Promise<WebEvent> {
  const selection = currentSelection();
  const sessionKey = `web:${id}`;
  // Bring the agent's context back from disk if the server restarted since this conversation began.
  const prior = store.get(id);
  if (prior) restoreSessionHistory(sessionKey, selection.model, completedTurns(prior));
  store.append(id, { role: 'user', text: query });
  try {
    const answer = await runAgentForMessage({
      sessionKey,
      query: lang === 'zh-TW' ? `${query}${ZH_TW_REPLY_HINT}` : query,
      model: selection.model,
      modelProvider: selection.provider,
      channel: 'web',
      signal: abort.signal,
    });
    if (abort.signal.aborted) {
      store.append(id, { role: 'assistant', text: '', kind: 'stopped' });
      return { type: 'error', message: 'stopped' };
    }
    if (!answer) {
      store.append(id, { role: 'assistant', text: 'Dexter returned no answer.', kind: 'error' });
      return { type: 'error', message: 'Dexter returned no answer.' };
    }
    store.append(id, { role: 'assistant', text: answer, kind: 'answer' });
    return { type: 'answer', text: answer };
  } catch (error) {
    if (abort.signal.aborted) {
      store.append(id, { role: 'assistant', text: '', kind: 'stopped' });
      return { type: 'error', message: 'stopped' };
    }
    const message = error instanceof Error ? error.message : String(error);
    store.append(id, { role: 'assistant', text: message, kind: 'error' });
    return { type: 'error', message };
  } finally {
    running.delete(id);
  }
}

async function handleChat(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body) return json({ error: 'Invalid request' }, 400);
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const id = conversationIdFrom(body.conversationId);
  if (!query || query.length > MAX_QUERY_CHARS) return json({ error: 'Invalid query' }, 400);
  if (!id) return json({ error: 'Invalid conversation' }, 400);
  if (running.has(id)) return json({ error: 'This conversation is already running' }, 409);

  const abort = new AbortController();
  running.set(id, abort);
  // Started outside the stream: it keeps going (and saves its result) even if the browser disconnects.
  const result = runConversationTurn(id, query, body.lang, abort);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const event = await result;
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        controller.close();
      } catch {
        // The browser already left; the answer is saved and shows up when it reloads.
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
  });
}

const server = Bun.serve({
  port: PORT,
  hostname: HOSTNAME,
  idleTimeout: 0, // research turns can be silent for longer than the default 10s
  async fetch(req) {
    if (!isLocalRequest(req)) return json({ error: 'Forbidden' }, 403);
    const { pathname } = new URL(req.url);

    if (req.method === 'POST' && pathname === '/api/chat') return handleChat(req);
    if (req.method === 'POST' && pathname === '/api/chat/stop') return handleStop(req);
    if (req.method === 'GET' && pathname === '/api/conversations') return handleListConversations();
    const conversationMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (conversationMatch) {
      const id = conversationIdFrom(conversationMatch[1]);
      if (!id) return json({ error: 'Invalid conversation' }, 400);
      if (req.method === 'GET') return handleGetConversation(id);
      if (req.method === 'DELETE') return handleDeleteConversation(id);
    }
    if (pathname === '/api/keys') {
      if (req.method === 'GET') return handleGetKeys();
      if (req.method === 'POST') return handleSetKey(req);
    }
    if (pathname === '/api/settings') {
      if (req.method === 'GET') return handleGetSettings();
      if (req.method === 'POST') return handleSetSettings(req);
    }

    const asset = req.method === 'GET' ? STATIC_FILES[pathname] : undefined;
    if (asset) {
      return new Response(Bun.file(join(publicDir, asset.file)), { headers: { 'Content-Type': asset.type } });
    }
    return json({ error: 'Not found' }, 404);
  },
});

console.log(`Dexter web: http://localhost:${server.port}`);
