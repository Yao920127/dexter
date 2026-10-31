// Browser-side storage for the visitor's own API keys. Keys are encrypted with AES-GCM using a key
// the browser generates as non-extractable (script can use it but never read it) and keeps in IndexedDB.
// The server never stores keys; they are sent only with a chat request, over HTTPS.
(() => {
  const DB_NAME = 'dexter-vault', STORE = 'kv', WRAP_KEY = 'wrap-key', SECRET_PREFIX = 'secret:';
  const available = Boolean(window.crypto && crypto.subtle && window.indexedDB);

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function run(mode, work) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        let result;
        Promise.resolve(work(tx.objectStore(STORE))).then((r) => { result = r; }, reject);
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

  async function wrapKey() {
    const existing = await run('readonly', (s) => req(s.get(WRAP_KEY)));
    if (existing) return existing;
    const fresh = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    // Two tabs may race; the first writer wins and both then read the same key back.
    return run('readwrite', async (s) => {
      const current = await req(s.get(WRAP_KEY));
      if (current) return current;
      await req(s.put(fresh, WRAP_KEY));
      return fresh;
    });
  }
  const aad = (slot) => new TextEncoder().encode(`dexter-key:${slot}`); // binds a ciphertext to its slot

  async function save(slot, value) {
    if (!available) throw new Error('vault-unavailable');
    const key = await wrapKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(slot) }, key, new TextEncoder().encode(value));
    await run('readwrite', (s) => req(s.put({ iv, ct, last4: value.slice(-4) }, SECRET_PREFIX + slot)));
  }
  async function remove(slot) {
    if (available) await run('readwrite', (s) => req(s.delete(SECRET_PREFIX + slot)));
  }
  // Only the last four characters are kept readable, so the settings page can show "••••abcd".
  async function hints() {
    if (!available) return {};
    return run('readonly', async (s) => {
      const keys = await req(s.getAllKeys()), out = {};
      for (const k of keys) {
        if (typeof k !== 'string' || !k.startsWith(SECRET_PREFIX)) continue;
        const entry = await req(s.get(k));
        if (entry) out[k.slice(SECRET_PREFIX.length)] = entry.last4;
      }
      return out;
    });
  }
  async function all() {
    if (!available) return {};
    const key = await wrapKey();
    const entries = await run('readonly', async (s) => {
      const out = [];
      for (const k of await req(s.getAllKeys())) {
        if (typeof k === 'string' && k.startsWith(SECRET_PREFIX)) out.push([k.slice(SECRET_PREFIX.length), await req(s.get(k))]);
      }
      return out;
    });
    const secrets = {};
    for (const [slot, e] of entries) {
      try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: e.iv, additionalData: aad(slot) }, key, e.ct);
        secrets[slot] = new TextDecoder().decode(plain);
      } catch { /* unreadable entry (e.g. the browser lost its key): treat as not set */ }
    }
    return secrets;
  }
  async function wipe() {
    if (!available) return;
    await run('readwrite', (s) => req(s.clear()));
  }

  // A random per-browser token. The server keeps only its hash, and uses it to separate histories.
  function clientToken() {
    let token = localStorage.getItem('dexter-client');
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('dexter-client', token);
    }
    return token;
  }
  function api(path, init = {}) {
    return fetch(path, { ...init, headers: { ...(init.headers || {}), 'X-Dexter-Client': clientToken() } });
  }

  function getSelection() {
    try {
      const v = JSON.parse(localStorage.getItem('dexter-selection') || 'null');
      return v && typeof v.provider === 'string' && typeof v.model === 'string' ? v : null;
    } catch { return null; }
  }
  const setSelection = (provider, model) => localStorage.setItem('dexter-selection', JSON.stringify({ provider, model }));

  // Removes everything this site keeps in the browser: keys, identity, selection and the conversation pointer.
  async function forgetEverything() {
    await wipe();
    for (const k of ['dexter-client', 'dexter-selection', 'dexter-conversation']) localStorage.removeItem(k);
  }

  window.Dexter = { available, save, remove, hints, all, wipe, clientToken, api, getSelection, setSelection, forgetEverything };
})();
