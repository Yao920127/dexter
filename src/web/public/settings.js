const $ = (id) => document.getElementById(id);
const providerSel = $('provider'), modelSel = $('model'), modelText = $('model-text'), status = $('set-status');
let providers = [];

// ---- Provider / model ----
function renderModels(providerId, selected) {
  const p = providers.find((x) => x.id === providerId);
  const free = !p || p.freeText;
  modelSel.hidden = free; modelText.hidden = !free;
  modelSel.replaceChildren(...(p ? p.models : []).map((m) => new Option(m.displayName, m.id, false, m.id === selected)));
  modelText.value = free ? selected || '' : '';
  status.textContent = ''; status.classList.remove('warn');
}
async function saveModel() {
  const free = !modelText.hidden;
  const res = await fetch('/api/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerSel.value, model: free ? modelText.value : modelSel.value }),
  });
  const data = await res.json();
  if (res.ok) { providers = data.providers; status.textContent = t('set.saved'); status.classList.remove('warn'); }
  else { status.textContent = data.error; status.classList.add('warn'); }
}
async function loadModel() {
  const data = await (await fetch('/api/settings')).json();
  providers = data.providers;
  providerSel.replaceChildren(...providers.map((p) => new Option(p.displayName, p.id, false, p.id === data.provider)));
  renderModels(data.provider, data.model);
}
providerSel.addEventListener('change', () => {
  const p = providers.find((x) => x.id === providerSel.value);
  renderModels(providerSel.value, p && p.models[0] ? p.models[0].id : '');
  if (p && !p.freeText) saveModel();
});
modelSel.addEventListener('change', saveModel);
modelText.addEventListener('change', () => modelText.value.trim() && saveModel());

// ---- API keys (write-only: the server reports set / not set, never the value) ----
const GROUPS = [['model', 'key.group.model'], ['data', 'key.group.data'], ['search', 'key.group.search']];
let keys = [];

function renderKeys() {
  const root = $('keys');
  root.replaceChildren();
  for (const [group, labelKey] of GROUPS) {
    const rows = keys.filter((k) => k.group === group);
    if (!rows.length) continue;
    const h = document.createElement('p');
    h.className = 'label red'; h.textContent = t(labelKey);
    root.appendChild(h);
    for (const k of rows) root.appendChild(keyRow(k));
  }
}
function keyRow(k) {
  const form = document.createElement('form');
  form.className = 'keyrow';
  const name = document.createElement('span');
  name.className = 'keyname'; name.textContent = k.label;
  const state = document.createElement('span');
  state.className = 'label' + (k.set ? '' : ' red'); state.textContent = k.set ? t('key.set') : t('key.unset');
  const input = document.createElement('input');
  input.type = 'password'; input.autocomplete = 'off'; input.spellcheck = false; input.required = true;
  input.placeholder = k.set ? t('key.replace') : t('key.paste');
  input.setAttribute('aria-label', k.label);
  const btn = document.createElement('button');
  btn.type = 'submit'; btn.className = 'btn'; btn.textContent = t('key.save');
  const msg = document.createElement('span');
  msg.className = 'note'; msg.setAttribute('role', 'status');
  form.append(name, state, input, btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const res = await fetch('/api/keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: k.id, value: input.value }),
    });
    const data = await res.json();
    btn.disabled = false;
    if (res.ok) { keys = data.keys; input.value = ''; renderKeys(); }
    else { msg.textContent = res.status === 400 ? t('key.invalid') : data.error; msg.classList.add('warn'); }
  });
  return form;
}
async function loadKeys() {
  keys = (await (await fetch('/api/keys')).json()).keys;
  renderKeys();
}

window.addEventListener('langchange', renderKeys);
loadModel().catch(() => {});
loadKeys().catch(() => {});
