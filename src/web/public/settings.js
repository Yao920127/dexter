const $ = (id) => document.getElementById(id);
const providerSel = $('provider'), modelSel = $('model'), modelText = $('model-text'), status = $('set-status');
let providers = [];
let defaults = { provider: '', model: '' };

// ---- Provider / model (remembered in this browser only) ----
function renderModels(providerId, selected) {
  const p = providers.find((x) => x.id === providerId);
  const free = !p || p.freeText;
  modelSel.hidden = free; modelText.hidden = !free;
  modelSel.replaceChildren(...(p ? p.models : []).map((m) => new Option(m.displayName, m.id, false, m.id === selected)));
  modelText.value = free ? selected || '' : '';
  status.textContent = ''; status.classList.remove('warn');
}
function saveModel() {
  const free = !modelText.hidden;
  const model = (free ? modelText.value : modelSel.value).trim();
  if (!model) return;
  Dexter.setSelection(providerSel.value, model);
  status.textContent = t('set.saved'); status.classList.remove('warn');
}
async function loadModel() {
  const data = await (await fetch('/api/settings')).json();
  providers = data.providers;
  defaults = { provider: data.provider, model: data.model };
  const chosen = Dexter.getSelection() || defaults;
  const provider = providers.some((p) => p.id === chosen.provider) ? chosen.provider : defaults.provider;
  providerSel.replaceChildren(...providers.map((p) => new Option(p.displayName, p.id, false, p.id === provider)));
  renderModels(provider, provider === chosen.provider ? chosen.model : defaults.model);
}
providerSel.addEventListener('change', () => {
  const p = providers.find((x) => x.id === providerSel.value);
  renderModels(providerSel.value, p && p.models[0] ? p.models[0].id : '');
  if (p && !p.freeText) saveModel();
});
modelSel.addEventListener('change', saveModel);
modelText.addEventListener('change', saveModel);

// ---- API keys: encrypted in this browser. The page only ever shows the last four characters. ----
const GROUPS = [['model', 'key.group.model'], ['data', 'key.group.data'], ['search', 'key.group.search']];
const API_KEY_PATTERN = /^[\x21-\x7E]{8,400}$/;
let slots = [];
let hints = {};

const mask = (last4) => `••••••••${last4}`;

function renderKeys() {
  const root = $('keys');
  root.replaceChildren();
  for (const [group, labelKey] of GROUPS) {
    const rows = slots.filter((k) => k.group === group);
    if (!rows.length) continue;
    const h = document.createElement('p');
    h.className = 'label red'; h.textContent = t(labelKey);
    root.appendChild(h);
    for (const k of rows) root.appendChild(keyRow(k));
  }
}
function keyRow(k) {
  const stored = hints[k.id];
  const form = document.createElement('form');
  form.className = 'keyrow';
  const name = document.createElement('span');
  name.className = 'keyname'; name.textContent = k.label;
  const state = document.createElement('span');
  const isSet = Boolean(stored) || k.serverKey;
  state.className = 'label' + (isSet ? '' : ' red');
  state.textContent = stored ? `${t('key.set')} ${mask(stored)}` : k.serverKey ? t('key.server') : t('key.unset');
  const input = document.createElement('input');
  input.type = 'password'; input.autocomplete = 'off'; input.spellcheck = false; input.required = true;
  input.setAttribute('autocapitalize', 'off'); input.name = `dexter-${k.id}`;
  input.placeholder = stored ? t('key.replace') : t('key.paste');
  input.setAttribute('aria-label', k.label);
  const btn = document.createElement('button');
  btn.type = 'submit'; btn.className = 'btn'; btn.textContent = t('key.save');
  const msg = document.createElement('span');
  msg.className = 'note'; msg.setAttribute('role', 'status');
  form.append(name, state, input, btn);
  if (stored) {
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn'; del.textContent = t('key.remove');
    del.setAttribute('aria-label', `${t('key.remove')} ${k.label}`);
    del.addEventListener('click', async () => { await Dexter.remove(k.id); await refreshHints(); });
    form.append(del);
  }
  form.append(msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!API_KEY_PATTERN.test(value)) { msg.textContent = t('key.invalid'); msg.classList.add('warn'); return; }
    btn.disabled = true;
    try {
      await Dexter.save(k.id, value);
      input.value = ''; // the plaintext leaves the page as soon as it is encrypted
      await refreshHints();
    } catch { msg.textContent = t('key.unavailable'); msg.classList.add('warn'); }
    btn.disabled = false;
  });
  return form;
}
async function refreshHints() {
  hints = await Dexter.hints();
  renderKeys();
}
async function loadKeys() {
  if (!Dexter.available) $('vault-warn').hidden = false;
  slots = (await (await fetch('/api/keys')).json()).keys;
  await refreshHints();
}

$('forget').addEventListener('click', async () => {
  if (!confirm(t('key.forget.confirm'))) return;
  await Dexter.forgetEverything();
  $('forget-status').textContent = t('key.forget.done');
  await refreshHints();
});

window.addEventListener('langchange', renderKeys);
loadModel().catch(() => {});
loadKeys().catch(() => {});
