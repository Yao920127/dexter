const $ = (id) => document.getElementById(id);
const form = $('ask'), input = $('query'), turns = $('turns'), empty = $('empty');
const sendBtn = $('send'), samples = $('samples'), page = document.body, scroller = $('scroller');

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const urlId = new URLSearchParams(location.search).get('c');
const savedId = localStorage.getItem('dexter-conversation');
let conversationId = [urlId, savedId].find((v) => v && ID_PATTERN.test(v)) || crypto.randomUUID();
let controller = null;   // set while this tab is streaming a reply
let pollTimer = null;    // set while waiting for a reply that is running on the server

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Minimal, safe markdown: input is escaped first, then a small set of constructs is re-introduced.
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');
}
function markdown(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    let m;
    if (!line.trim()) { i++; continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      const head = cells(line); i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push('<table><thead><tr>' + head.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line), items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(inline(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '')));
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>` + items.map((t) => `<li>${t}</li>`).join('') + `</${tag}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('');
}

// ---- Conversation ----
function setActive(id) {
  conversationId = id;
  localStorage.setItem('dexter-conversation', id);
  const url = new URL(location.href);
  url.searchParams.set('c', id);
  history.replaceState(null, '', url);
}

const startedView = (started) => page.classList.toggle('started', started);
const scrollToEnd = () => { scroller.scrollTop = scroller.scrollHeight; };

function userBubble(text) {
  const me = document.createElement('p');
  me.className = 'me'; me.textContent = text;
  return me;
}
function replyBlock() {
  const reply = document.createElement('div');
  reply.className = 'reply';
  const who = document.createElement('p');
  who.className = 'label red'; who.textContent = 'Dexter';
  const answer = document.createElement('div');
  answer.className = 'answer';
  reply.append(who, answer);
  return { reply, answer };
}
function fill(answer, message) {
  if (!message) { answer.innerHTML = `<p class="pending">${esc(t('run.working'))}</p>`; return; }
  if (message.kind === 'answer') answer.innerHTML = markdown(message.text);
  else if (message.kind === 'stopped') answer.innerHTML = `<p class="pending">${esc(t('run.stopped'))}</p>`;
  else answer.innerHTML = `<p class="pending">${esc(message.text)}</p>`;
}

// Draws a stored conversation. A trailing user message with no reply is either still running on the
// server (we poll for it) or was cut off by a server restart.
function renderConversation(conversation, isRunning) {
  turns.replaceChildren();
  const msgs = conversation ? conversation.messages : [];
  startedView(msgs.length > 0);
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role !== 'user') continue;
    const el = document.createElement('article');
    el.className = 'turn';
    const { reply, answer } = replyBlock();
    const next = msgs[i + 1] && msgs[i + 1].role === 'assistant' ? msgs[i + 1] : null;
    if (next) fill(answer, next);
    else if (isRunning) fill(answer, null);
    else fill(answer, { kind: 'error', text: t('run.interrupted') });
    el.append(userBubble(msgs[i].text), reply);
    turns.appendChild(el);
  }
  scrollToEnd();
}

function stopPolling() { clearTimeout(pollTimer); pollTimer = null; }
function pollUntilDone(id) {
  stopPolling();
  pollTimer = setTimeout(async () => {
    if (id !== conversationId) return;
    try {
      const data = await (await Dexter.api(`/api/conversations/${id}`)).json();
      if (id !== conversationId) return;
      renderConversation(data.conversation, data.running);
      setRunning(data.running);
      if (data.running) pollUntilDone(id); else loadHistory();
    } catch { pollUntilDone(id); }
  }, 2000);
}

async function openConversation(id) {
  stopPolling();
  if (controller) controller.abort(); // leave the stream; the server finishes and saves the reply
  setActive(id);
  let data = null;
  try {
    const res = await Dexter.api(`/api/conversations/${id}`);
    if (res.ok) data = await res.json();
  } catch { /* fall through to an empty conversation */ }
  controller = null;
  renderConversation(data && data.conversation, Boolean(data && data.running));
  setRunning(Boolean(data && data.running));
  if (data && data.running) pollUntilDone(id);
  highlightHistory();
  closeDrawer();
  input.focus();
}

function setRunning(running) {
  sendBtn.textContent = running ? '■' : '↑';
  sendBtn.dataset.running = running ? '1' : '';
  sendBtn.setAttribute('aria-label', t(running ? 'app.stop' : 'app.send'));
}
window.addEventListener('langchange', () => { setRunning(sendBtn.dataset.running === '1'); renderHistory(); syncCollapseLabel(); });

async function ask(query) {
  startedView(true);
  const el = document.createElement('article');
  el.className = 'turn';
  const { reply, answer } = replyBlock();
  fill(answer, null);
  el.append(userBubble(query), reply);
  turns.appendChild(el);
  scrollToEnd();

  const id = conversationId;
  setActive(id);
  controller = new AbortController();
  setRunning(true);
  try {
    const choice = await currentChoice();
    const res = await Dexter.api('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, conversationId: id, lang: getLang(), provider: choice.provider, model: choice.model, keys: await Dexter.all() }),
      signal: controller.signal,
    });
    if (res.status === 409) throw new Error(t('run.busy'));
    if (res.status === 429) throw new Error(t('run.limited'));
    if (res.status === 503) throw new Error(t('run.serverbusy'));
    if (res.status === 400 && (await res.clone().json().catch(() => ({}))).error === 'missing_key') throw new Error(t('run.nokey'));
    if (!res.ok || !res.body) throw new Error(`${t('run.failed')} (${res.status})`);
    loadHistory(); // the conversation now exists on the server
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
        if (!chunk.startsWith('data: ')) continue;
        const ev = JSON.parse(chunk.slice(6));
        if (id !== conversationId) continue; // the user switched away; the reply is saved server-side
        if (ev.type === 'answer') fill(answer, { kind: 'answer', text: ev.text });
        else fill(answer, ev.message === 'stopped' ? { kind: 'stopped' } : { kind: 'error', text: ev.message });
        scrollToEnd();
      }
    }
  } catch (err) {
    if (!(err && err.name === 'AbortError') && id === conversationId) fill(answer, { kind: 'error', text: String(err.message || err) });
  } finally {
    if (id === conversationId) { controller = null; setRunning(false); input.focus(); }
    loadHistory();
  }
}

function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 220)}px`;
}
input.addEventListener('input', autosize);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (sendBtn.dataset.running === '1') { // the send button doubles as stop while a reply is running
    Dexter.api('/api/chat/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId }) });
    return;
  }
  const q = input.value.trim();
  if (!q) return;
  input.value = ''; autosize();
  ask(q);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (sendBtn.dataset.running !== '1') form.requestSubmit(); }
});
samples.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) { input.value = btn.textContent.trim(); autosize(); input.focus(); }
});

const newConversation = () => openConversation(crypto.randomUUID());
$('new-chat').addEventListener('click', newConversation);
$('new-chat-top').addEventListener('click', newConversation);

// ---- Sidebar: history list, search, collapse / drawer ----
const appEl = $('app'), sidebar = $('sidebar'), scrim = $('scrim'), collapseBtn = $('collapse');
const listEl = $('history-list'), emptyNote = $('history-empty'), searchEl = $('search');
const isDrawer = () => matchMedia('(max-width: 900px)').matches;
let conversations = [];

const DAY = 86400000;
function groupOf(ms) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  if (ms >= startOfToday) return 'hist.today';
  if (ms >= startOfToday - DAY) return 'hist.yesterday';
  if (ms >= startOfToday - 7 * DAY) return 'hist.week';
  return 'hist.older';
}

function renderHistory() {
  const q = searchEl.value.trim().toLowerCase();
  const shown = q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations;
  emptyNote.hidden = shown.length > 0;
  emptyNote.textContent = t(conversations.length ? 'hist.none' : 'hist.empty');
  const nodes = [];
  let lastGroup = null, ul = null;
  for (const c of shown) {
    const g = groupOf(c.updatedAt);
    if (g !== lastGroup) {
      const label = document.createElement('p');
      label.className = 'label group-label'; label.textContent = t(g);
      ul = document.createElement('ul'); ul.className = 'histlist';
      nodes.push(label, ul); lastGroup = g;
    }
    const li = document.createElement('li');
    li.dataset.id = c.id;
    const open = document.createElement('button');
    open.type = 'button'; open.className = 'histitem'; open.textContent = c.title; open.title = c.title;
    open.addEventListener('click', () => (c.id !== conversationId ? openConversation(c.id) : closeDrawer()));
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'histdel'; del.textContent = '×';
    del.setAttribute('aria-label', `${t('hist.delete')}: ${c.title}`);
    del.addEventListener('click', () => removeConversation(c));
    li.append(open, del);
    ul.appendChild(li);
  }
  listEl.replaceChildren(...nodes);
  highlightHistory();
}
function highlightHistory() {
  for (const li of listEl.querySelectorAll('li')) {
    const active = li.dataset.id === conversationId;
    li.classList.toggle('active', active);
    if (active) li.firstChild.setAttribute('aria-current', 'true'); else li.firstChild.removeAttribute('aria-current');
  }
}
async function loadHistory() {
  try {
    conversations = (await (await Dexter.api('/api/conversations')).json()).conversations;
    renderHistory();
  } catch { /* the list keeps its previous contents */ }
}
async function removeConversation(c) {
  if (!confirm(`${t('hist.confirm')}\n\n${c.title}`)) return;
  const res = await Dexter.api(`/api/conversations/${c.id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) return;
  if (c.id === conversationId) await openConversation(crypto.randomUUID());
  loadHistory();
}
searchEl.addEventListener('input', renderHistory);

// Desktop: collapse to an icon rail (remembered). Narrow screens: the same button closes the drawer.
function setCollapsed(collapsed) {
  appEl.classList.toggle('collapsed', collapsed);
  localStorage.setItem('dexter-side-collapsed', collapsed ? '1' : '');
  syncCollapseLabel();
}
function syncCollapseLabel() {
  const collapsed = appEl.classList.contains('collapsed') && !isDrawer();
  const label = t(isDrawer() ? 'side.close' : collapsed ? 'side.expand' : 'side.collapse');
  collapseBtn.setAttribute('aria-label', label);
  collapseBtn.setAttribute('aria-expanded', String(!collapsed));
}
function openDrawer() { sidebar.classList.add('open'); scrim.hidden = false; collapseBtn.focus(); }
function closeDrawer() { sidebar.classList.remove('open'); scrim.hidden = true; }
collapseBtn.addEventListener('click', () => {
  if (isDrawer()) { closeDrawer(); $('open-side').focus(); } else setCollapsed(!appEl.classList.contains('collapsed'));
});
$('open-side').addEventListener('click', openDrawer);
scrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sidebar.classList.contains('open')) { closeDrawer(); $('open-side').focus(); } });
// In the collapsed rail the search field is hidden, so tapping its icon expands the sidebar first.
$('search-row').addEventListener('click', () => {
  if (appEl.classList.contains('collapsed') && !isDrawer()) { setCollapsed(false); searchEl.focus(); }
});
matchMedia('(max-width: 900px)').addEventListener('change', () => { closeDrawer(); syncCollapseLabel(); });

if (localStorage.getItem('dexter-side-collapsed')) appEl.classList.add('collapsed');
syncCollapseLabel();

// The provider/model pair lives in this browser (set on the settings page); the server supplies the catalogue.
let catalogue = null;
async function currentChoice() {
  catalogue = catalogue || (await (await fetch('/api/settings')).json());
  const saved = Dexter.getSelection();
  const valid = saved && catalogue.providers.some((p) => p.id === saved.provider);
  return valid ? saved : { provider: catalogue.provider, model: catalogue.model };
}
function showModelName() {
  currentChoice().then((c) => {
    const p = catalogue.providers.find((x) => x.id === c.provider);
    const m = p && p.models.find((x) => x.id === c.model);
    $('model-name').textContent = `${p ? p.displayName : c.provider} · ${m ? m.displayName : c.model}`;
  }).catch(() => {});
}
showModelName();

loadHistory();
openConversation(conversationId);
