#!/usr/bin/env bun
import { config } from 'dotenv';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { restoreSessionHistory, runAgentForMessage } from '../gateway/agent-runner.js';
import { dexterPath } from '../utils/paths.js';
import { completedTurns, CONVERSATION_ID_PATTERN, createHistoryStore } from './history-store.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../model/llm.js';
import { checkApiKeyExists, checkApiKeyExistsForProvider, SEARCH_PROVIDERS } from '../utils/env.js';
import { PROVIDERS } from '../utils/model.js';
import { PROVIDERS as PROVIDER_DEFS, resolveProvider } from '../providers.js';
import { installRequestEnv, withRequestKeys } from './request-keys.js';
import { clientIp, createRateLimiter, ownerKeyFrom, redactSecrets, securityHeaders } from './security.js';

config({ quiet: true });

// On Railway (or with DEXTER_CLOUD=1) the server is public: it binds all interfaces, trusts the
// platform proxy, and never uses its own environment's API keys. Locally it stays on loopback.
const CLOUD = Boolean(process.env.RAILWAY_ENVIRONMENT) || process.env.DEXTER_CLOUD === '1';
const PORT = Number((CLOUD ? process.env.PORT : undefined) ?? process.env.DEXTER_WEB_PORT ?? 3000);
const HOSTNAME = CLOUD ? '0.0.0.0' : '127.0.0.1';
const MAX_QUERY_CHARS = 4000;
const MAX_BODY_BYTES = 32_000;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._:\/-]{1,100}$/;
const ZH_TW_REPLY_HINT = '\n\n（請以繁體中文回覆。）';
const MAX_CONCURRENT_RUNS = Number(process.env.DEXTER_MAX_RUNS ?? 8);
const CLIENT_HEADER = 'x-dexter-client';
const LEGACY_HISTORY_DIR = dexterPath('web-history');
// Conversations whose agent run is in flight. Runs outlive the browser connection, so a page
// refresh never loses an answer; the run is only cancelled through /api/chat/stop.
const running = new Map<string, AbortController>();
const ALLOWED_HOSTS = new Set<string>(
  CLOUD
    ? [process.env.RAILWAY_PUBLIC_DOMAIN, ...(process.env.DEXTER_ALLOWED_HOSTS ?? '').split(',')]
        .map((h) => h?.trim().toLowerCase())
        .filter((h): h is string => Boolean(h))
    : [`localhost:${PORT}`, `127.0.0.1:${PORT}`],
);
const SECURITY_HEADERS = securityHeaders(CLOUD);
const pageLimiter = createRateLimiter(300, 10);
const apiLimiter = createRateLimiter(120, 2);
const chatIpLimiter = createRateLimiter(6, 1 / 20);
const chatOwnerLimiter = createRateLimiter(4, 1 / 30);

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
  '/vault.js': { file: 'vault.js', type: 'text/javascript; charset=utf-8' },
};

// The browser only sees the final answer or an error; intermediate research steps stay server-side.
type WebEvent = { type: 'answer'; text: string } | { type: 'error'; message: string };

// Reject requests whose Host/Origin is not this server (DNS rebinding / cross-site POST).
function isAllowedRequest(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return false;
  const origin = req.headers.get('origin');
  if (origin === null) return true;
  try {
    return ALLOWED_HOSTS.has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

function json(body: unknown, status: number, headers?: Record<string, string>): Response {
  return Response.json(body, { status, headers });
}

function limited(retryAfterSec: number): Response {
  return json({ error: 'Too many requests' }, 429, { 'Retry-After': String(retryAfterSec) });
}

interface KeySlot {
  id: string;
  label: string;
  group: 'model' | 'search' | 'data';
  envVar: string;
}

// Only these environment variables can be supplied by a browser.
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
const API_KEY_PATTERN = /^[\x21-\x7E]{8,400}$/; // printable, no whitespace or newlines
installRequestEnv(KEY_SLOTS.map((k) => k.envVar), CLOUD);

// Browsers keep their own keys (encrypted) and send them with each chat request. A locally run
// server may also fall back to keys in its .env; a cloud server never does.
const serverHasKey = (envVar: string): boolean => !CLOUD && checkApiKeyExists(envVar);

function handleGetSettings(): Response {
  const listed = PROVIDERS.find((p) => p.providerId === DEFAULT_PROVIDER)?.models[0]?.id;
  return json(
    {
      provider: DEFAULT_PROVIDER,
      model: listed ?? DEFAULT_MODEL,
      cloud: CLOUD,
      providers: PROVIDERS.map((p) => ({
        id: p.providerId,
        displayName: p.displayName,
        models: p.models,
        serverKey: !CLOUD && checkApiKeyExistsForProvider(p.providerId),
        // Providers without a fixed list (OpenRouter, Ollama Cloud) take a free-form model id.
        freeText: p.models.length === 0,
      })),
    },
    200,
  );
}

function handleGetKeys(): Response {
  return json(
    { keys: KEY_SLOTS.map(({ id, label, group, envVar }) => ({ id, label, group, serverKey: serverHasKey(envVar) })) },
    200,
  );
}

function validSelection(provider: string, model: string): boolean {
  const entry = PROVIDERS.find((p) => p.providerId === provider);
  if (!entry || !MODEL_ID_PATTERN.test(model)) return false;
  // A fixed-list provider must use one of its models; free-text providers must match their routing prefix.
  return entry.models.length > 0
    ? entry.models.some((m) => m.id === model)
    : resolveProvider(model).id === provider;
}

/** Validates the browser-supplied `{ slotId: value }` map and converts it to environment variable names. */
function parseKeys(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [id, secret] of Object.entries(value)) {
    const slot = KEY_SLOTS.find((k) => k.id === id);
    if (!slot || typeof secret !== 'string' || !API_KEY_PATTERN.test(secret)) return null;
    out[slot.envVar] = secret;
  }
  return out;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Each browser owns a private history folder named by a hash of its random client token. */
function ownerFrom(req: Request): string | null {
  return ownerKeyFrom(req.headers.get(CLIENT_HEADER));
}

function storeFor(owner: string) {
  const dir = join(LEGACY_HISTORY_DIR, owner);
  // A local install keeps conversations made before per-browser folders existed: the first browser adopts them.
  if (!CLOUD && !existsSync(dir)) adoptLegacyHistory(LEGACY_HISTORY_DIR, dir);
  return createHistoryStore(dir);
}

function adoptLegacyHistory(from: string, to: string): void {
  if (!existsSync(from)) return;
  const files = readdirSync(from).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return;
  mkdirSync(to, { recursive: true, mode: 0o700 });
  for (const f of files) renameSync(join(from, f), join(to, f));
}

function conversationIdFrom(value: unknown): string | null {
  return typeof value === 'string' && CONVERSATION_ID_PATTERN.test(value) ? value : null;
}

const runKey = (owner: string, id: string): string => `${owner}:${id}`;

function handleListConversations(owner: string): Response {
  const conversations = storeFor(owner)
    .list()
    .map((c) => ({ ...c, running: running.has(runKey(owner, c.id)) }));
  return json({ conversations }, 200);
}

function handleGetConversation(owner: string, id: string): Response {
  const conversation = storeFor(owner).get(id);
  return conversation
    ? json({ conversation, running: running.has(runKey(owner, id)) }, 200)
    : json({ error: 'Not found' }, 404);
}

function handleDeleteConversation(owner: string, id: string): Response {
  running.get(runKey(owner, id))?.abort();
  return storeFor(owner).remove(id) ? json({ ok: true }, 200) : json({ error: 'Not found' }, 404);
}

async function handleStop(owner: string, req: Request): Promise<Response> {
  const id = conversationIdFrom((await readJson(req))?.conversationId);
  if (!id) return json({ error: 'Invalid conversation' }, 400);
  running.get(runKey(owner, id))?.abort();
  return json({ ok: true }, 200);
}

interface Turn {
  owner: string;
  id: string;
  query: string;
  lang: unknown;
  provider: string;
  model: string;
  keys: Record<string, string>;
  abort: AbortController;
}

async function runConversationTurn(turn: Turn): Promise<WebEvent> {
  const { owner, id, query, provider, model, keys, abort } = turn;
  const store = storeFor(owner);
  const sessionKey = `web:${owner}:${id}`;
  const secrets = Object.values(keys);
  // Bring the agent's context back from disk if the server restarted since this conversation began.
  const prior = store.get(id);
  if (prior) restoreSessionHistory(sessionKey, model, completedTurns(prior));
  store.append(id, { role: 'user', text: query });
  const fail = (message: string): WebEvent => {
    const safe = redactSecrets(message, secrets);
    store.append(id, { role: 'assistant', text: safe, kind: 'error' });
    return { type: 'error', message: safe };
  };
  const stopped = (): WebEvent => {
    store.append(id, { role: 'assistant', text: '', kind: 'stopped' });
    return { type: 'error', message: 'stopped' };
  };
  try {
    // The keys exist only inside this call chain; nothing writes them to disk, logs or the environment.
    const answer = await withRequestKeys(keys, () =>
      runAgentForMessage({
        sessionKey,
        query: turn.lang === 'zh-TW' ? `${query}${ZH_TW_REPLY_HINT}` : query,
        model,
        modelProvider: provider,
        channel: 'web',
        signal: abort.signal,
      }),
    );
    if (abort.signal.aborted) return stopped();
    if (!answer) return fail('Dexter returned no answer.');
    store.append(id, { role: 'assistant', text: answer, kind: 'answer' });
    return { type: 'answer', text: answer };
  } catch (error) {
    if (abort.signal.aborted) return stopped();
    return fail(error instanceof Error ? error.message : String(error));
  } finally {
    running.delete(runKey(owner, id));
  }
}

async function handleChat(owner: string, req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body) return json({ error: 'Invalid request' }, 400);
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const id = conversationIdFrom(body.conversationId);
  const provider = typeof body.provider === 'string' ? body.provider : DEFAULT_PROVIDER;
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const keys = parseKeys(body.keys);
  if (!query || query.length > MAX_QUERY_CHARS) return json({ error: 'Invalid query' }, 400);
  if (!id) return json({ error: 'Invalid conversation' }, 400);
  if (!validSelection(provider, model)) return json({ error: 'Invalid provider or model' }, 400);
  if (!keys) return json({ error: 'Invalid key format' }, 400);
  const keyVar = PROVIDER_DEFS.find((p) => p.id === provider)?.apiKeyEnvVar;
  if (keyVar && !keys[keyVar] && !serverHasKey(keyVar)) {
    return json({ error: 'missing_key', provider }, 400);
  }
  const slot = runKey(owner, id);
  if (running.has(slot)) return json({ error: 'This conversation is already running' }, 409);
  if (running.size >= MAX_CONCURRENT_RUNS) return json({ error: 'Server is busy, try again shortly' }, 503, { 'Retry-After': '30' });

  const abort = new AbortController();
  running.set(slot, abort);
  // Started outside the stream: it keeps going (and saves its result) even if the browser disconnects.
  const result = runConversationTurn({ owner, id, query, lang: body.lang, provider, model, keys, abort });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A comment line every 15s keeps proxies from closing a connection that is silent during research.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(ping);
        }
      }, 15_000);
      const event = await result;
      clearInterval(ping);
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        controller.close();
      } catch {
        // The browser already left; the answer is saved and shows up when it reloads.
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  });
}

function withSecurityHeaders(res: Response, pathname: string): Response {
  const headers = new Headers(res.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (pathname.startsWith('/api/') && !headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function route(req: Request, pathname: string, ip: string): Promise<Response> {
  if (pathname.startsWith('/api/')) {
    const gate = apiLimiter.take(ip);
    if (!gate.ok) return limited(gate.retryAfterSec);

    if (req.method === 'GET' && pathname === '/api/settings') return handleGetSettings();
    if (req.method === 'GET' && pathname === '/api/keys') return handleGetKeys();

    const owner = ownerFrom(req);
    if (!owner) return json({ error: 'Missing client id' }, 400);

    if (req.method === 'POST' && pathname === '/api/chat') {
      const byIp = chatIpLimiter.take(ip);
      if (!byIp.ok) return limited(byIp.retryAfterSec);
      const byOwner = chatOwnerLimiter.take(owner);
      if (!byOwner.ok) return limited(byOwner.retryAfterSec);
      return handleChat(owner, req);
    }
    if (req.method === 'POST' && pathname === '/api/chat/stop') return handleStop(owner, req);
    if (req.method === 'GET' && pathname === '/api/conversations') return handleListConversations(owner);
    const conversationMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (conversationMatch) {
      const id = conversationIdFrom(conversationMatch[1]);
      if (!id) return json({ error: 'Invalid conversation' }, 400);
      if (req.method === 'GET') return handleGetConversation(owner, id);
      if (req.method === 'DELETE') return handleDeleteConversation(owner, id);
    }
    return json({ error: 'Not found' }, 404);
  }

  const gate = pageLimiter.take(ip);
  if (!gate.ok) return limited(gate.retryAfterSec);
  const asset = req.method === 'GET' ? STATIC_FILES[pathname] : undefined;
  if (asset) {
    return new Response(Bun.file(join(publicDir, asset.file)), {
      headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-cache' },
    });
  }
  return json({ error: 'Not found' }, 404);
}

const server = Bun.serve({
  port: PORT,
  hostname: HOSTNAME,
  idleTimeout: 0, // research turns can be silent for longer than the default 10s
  maxRequestBodySize: 64 * 1024,
  async fetch(req, srv) {
    const { pathname } = new URL(req.url);
    // Platform health probes carry their own Host header, so they are answered before the host check.
    if (pathname === '/healthz') return withSecurityHeaders(new Response('ok'), pathname);
    let response: Response;
    if (!isAllowedRequest(req)) {
      response = json({ error: 'Forbidden' }, 403);
    } else if (CLOUD && req.headers.get('x-forwarded-proto') === 'http') {
      const url = new URL(req.url);
      response = Response.redirect(`https://${req.headers.get('host')}${url.pathname}${url.search}`, 308);
    } else {
      const ip = clientIp(req, srv.requestIP(req)?.address, CLOUD);
      try {
        response = await route(req, pathname, ip);
      } catch {
        // Never echo internals (or key material) to the browser.
        response = json({ error: 'Internal error' }, 500);
      }
    }
    return withSecurityHeaders(response, pathname);
  },
});

console.log(`Dexter web: http://localhost:${server.port}${CLOUD ? ' (cloud mode)' : ''}`);
