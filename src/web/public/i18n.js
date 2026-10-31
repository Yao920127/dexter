// English is the markup's own text; this file only holds the Traditional Chinese layer.
// Elements opt in with data-i18n (text) or data-i18n-placeholder; scripts use window.t(key).
(() => {
  const ZH = {
    'doc.home': 'Dexter · 自主金融研究代理',
    'doc.app': 'Dexter · 研究台',
    'nav.tagline': '自主金融研究',
    'nav.capabilities': '核心能力', 'nav.start': '開始使用', 'nav.questions': '常見問題',
    'nav.desk': '研究台', 'nav.overview': '總覽', 'nav.desk.label': '研究台',
    'home.overview': '總覽',
    'home.title': '把複雜的金融問題，變成清楚、逐步的研究。',
    'home.deck': 'Dexter 會規劃工作、取得即時市場資料、檢查自己的結果，並反覆修正，直到得出有資料佐證、有把握的答案。就像 Claude Code，但專為金融研究打造。',
    'home.open': '立即使用', 'home.cta': '開啟研究台', 'home.github': '前往 GitHub',
    'home.where': '可在終端機、這個瀏覽器，或透過 WhatsApp 使用。',
    'fact.runtime': '執行環境', 'fact.models': '模型', 'fact.data': '市場資料', 'fact.license': '授權',
    'fact.models.v': 'OpenAI、Anthropic、Google、xAI、DeepSeek、OpenRouter',
    'cap.label': '核心能力', 'cap.title': '它能做什麼',
    'cap.1.t': '智慧任務規劃', 'cap.1.d': '自動把複雜問題拆解成結構化的研究步驟。',
    'cap.2.t': '自主執行', 'cap.2.d': '挑選並執行合適的工具來取得金融資料。',
    'cap.3.t': '自我驗證', 'cap.3.d': '檢查自己的工作，反覆修正直到任務完成。',
    'cap.4.t': '即時金融資料', 'cap.4.d': '損益表、資產負債表與現金流量表。',
    'cap.5.t': '安全機制', 'cap.5.d': '內建迴圈偵測與步數上限，避免失控執行。',
    'how.label': '運作方式', 'how.title': '研究計畫，執行並驗證。',
    'how.body': 'Dexter 會把複雜的金融問題拆成步驟，用即時市場資料逐步執行，檢視取得的結果，並持續修正直到答案站得住腳。若偵測到原地打轉或達到步數上限，迴圈會自行停止。',
    'how.i.label': '檢視每一步', 'how.i.title': '沒有黑箱。',
    'how.i.body': '每一次工具呼叫都會記錄到 scratchpad 檔案：原始問題、每次呼叫的參數與原始結果，以及代理的推理。你可以清楚看到它取得了什麼資料、如何解讀。',
    'how.w.label': '其他管道', 'how.w.title': '在 WhatsApp 提問。',
    'how.w.body': '把手機連結到閘道，傳訊息給自己，Dexter 就會在同一個對話中回覆。',
    'step.1.t': '安裝', 'step.1.d': '複製儲存庫，並用 Bun 安裝相依套件。',
    'step.2.t': '設定', 'step.2.d': '複製範例環境檔並填入你的 API key。',
    'step.3.t': '執行', 'step.3.d': '使用終端機，或在本機啟動這個網頁。',
    'faq.label': '常見問題', 'faq.title': '開始之前。',
    'faq.intro': '前置需求：Bun、模型供應商的 key，以及 Financial Datasets 的 key。Exa key 為選用，用於網頁搜尋。',
    'faq.1.q': '我需要哪些 API key？', 'faq.1.a': '需要 OpenAI API key（其他供應商為選用）與 Financial Datasets API key。Exa API key 為選用，可啟用網頁搜尋。',
    'faq.2.q': '可以使用其他模型供應商嗎？', 'faq.2.a': '可以。除了 OpenAI，Dexter 也支援 Anthropic、Google、xAI、Moonshot、DeepSeek、OpenRouter 與 Ollama Cloud。選一個並在設定頁加入它的 key 即可。',
    'faq.3.q': '這是投資建議嗎？', 'faq.3.a': '不是。Dexter 僅供教育、娛樂與資訊用途。輸出可能有誤、不完整或已過時。投資決策前請諮詢合格的財務顧問。',
    'faq.4.q': '如何除錯一筆結果？', 'faq.4.a': '開啟 .dexter/scratchpad/ 中最新的檔案。每一行都是 JSON 紀錄，包含問題、每次工具結果與代理的推理步驟。',
    'faq.cta': '向 Dexter 提問',
    'disc.title': '免責聲明。',
    'disc.body': '本專案僅供教育、娛樂與資訊用途，不構成財務、投資、稅務或法律建議，也不保證準確性；作者與貢獻者不對任何財務損失或損害負責。過去的表現不代表未來的結果。',
    'foot.product': '產品', 'foot.project': '專案', 'foot.data': '資料', 'foot.license': '授權', 'foot.mit': 'MIT 授權',
    'app.ready': '就緒', 'app.title': '提出一個金融研究問題。',
    'app.lead': 'Dexter 會規劃步驟、取得即時資料，並在過程中展示它的工作。',
    'app.label': '你的問題',
    'app.placeholder': '問一個金融研究問題…',
    'app.hint': 'Enter 送出 · Shift+Enter 換行',
    'app.send': '送出問題', 'app.stop': '停止', 'app.new': '新對話',
    'app.try': '試著問', 'app.s1': '整理蘋果過去五年的損益表。', 'app.s2': '比較 NVDA 與 AMD 的營業利益率。',
    'app.s3': '特斯拉最新的 10-K 有什麼變化？',
    'app.note': '僅供教育與資訊用途，不構成財務建議；輸出可能有誤或已過時。',
    'set.label': '設定', 'set.provider': '供應商', 'set.model': '模型', 'set.saved': '已儲存。',
    'set.nokey': '尚未設定此供應商的 API key（請在 .env 中設定）。', 'set.key': 'API key 已設定。',
    'set.shared': '此設定與終端機版共用。',
    'run.q': '問題', 'run.working': '處理中…', 'run.thinking': '思考', 'run.tool': '工具', 'run.done': '完成',
    'run.error': '錯誤', 'run.denied': '拒絕', 'run.stopped': '已停止。', 'run.failed': '請求失敗',
    'doc.settings': 'Dexter · 設定', 'nav.settings': '設定',
    'set.model.label': '模型', 'set.model.title': '選擇模型。',
    'key.label': 'API KEY', 'key.title': '連接你的服務。',
    'key.note': 'Key 會加密後只儲存在這個瀏覽器，伺服器不會保存。它只會隨提問透過 HTTPS 傳送，且僅供該次請求使用。儲存後只顯示最後四個字元。',
    'key.unavailable': '此瀏覽器無法安全儲存 Key（需要 HTTPS 或 localhost）。',
    'key.forget': '清除此瀏覽器中我的所有資料', 'key.forget.done': '已清除。', 'key.forget.confirm': '要清除此瀏覽器中的 API key、設定與對話指標嗎？伺服器上的對話紀錄將無法再從這個瀏覽器存取。',
    'set.local': '你的選擇只會記在這個瀏覽器。',
    'key.forget.account.confirm': '要移除帳號中儲存的所有 API key 嗎？你的對話紀錄會保留。',
    'key.group.model': '模型供應商', 'key.group.data': '金融資料', 'key.group.search': '網頁搜尋',
    'key.set': '已加密儲存', 'key.server': '伺服器已設定', 'key.unset': '未設定', 'key.save': '儲存', 'key.remove': '移除',
    'run.nokey': '尚未設定此供應商的 API key。請先到設定頁輸入。', 'run.limited': '請求太頻繁，請稍後再試。', 'run.serverbusy': '伺服器忙碌中，請稍後再試。',
    'key.paste': '貼上 API key', 'key.replace': '貼上新的 key 以取代', 'key.invalid': 'Key 格式不正確（不可含空白或換行）。',
    'hist.title': '歷史對話', 'hist.search': '搜尋對話', 'hist.today': '今天', 'hist.yesterday': '昨天', 'hist.week': '過去 7 天', 'hist.older': '更早', 'hist.none': '找不到符合的對話。',
    'side.label': '側邊欄', 'side.collapse': '收合側邊欄', 'side.expand': '展開側邊欄', 'side.open': '開啟側邊欄', 'side.close': '關閉側邊欄', 'hist.close': '關閉', 'hist.empty': '還沒有對話紀錄。',
    'hist.delete': '刪除對話', 'hist.confirm': '要刪除這則對話嗎？刪除後無法復原。',
    'run.interrupted': '這次回覆被中斷了（伺服器可能重新啟動過）。', 'run.busy': '這個對話仍在處理中，請稍候。',
    'doc.login': 'Dexter · 登入',
    'login.label': '登入', 'login.title': '登入以開始研究。',
    'login.body': '使用 Google 帳號登入。你的 API key 與對話紀錄會綁定在這個帳號，換裝置也看得到。',
    'login.cta': '使用 Google 登入',
    'login.err.denied': '登入已取消。', 'login.err.failed': '登入失敗，請再試一次。',
    'acct.logout': '登出',
    'key.note.account': 'Key 會加密後綁定在你的 Google 帳號，換裝置登入也能使用。它不會回傳到瀏覽器；儲存後只顯示最後四個字元。',
    'key.set.account': '已加密存於帳號',
    'key.forget.account': '移除我帳號中的所有 API key',
    'lang.switch': 'English',
  };
  const EN_RUNTIME = {
    'run.q': 'Question', 'run.working': 'Working…', 'run.thinking': 'Thinking', 'run.tool': 'Tool', 'run.done': 'Done',
    'run.error': 'Error', 'run.denied': 'Denied', 'run.stopped': 'Stopped.', 'run.failed': 'Request failed',
    'set.saved': 'Saved.', 'set.nokey': 'No API key set for this provider (add it to .env).', 'set.key': 'API key is set.',
    'app.send': 'Submit question', 'app.stop': 'Stop',
    'key.set': 'Encrypted in this browser', 'key.server': 'Set on server', 'key.unset': 'Not set', 'key.save': 'Save', 'key.remove': 'Remove',
    'key.forget.done': 'Cleared.', 'key.forget.confirm': 'Remove API keys, settings and the conversation pointer from this browser? Conversations on the server will no longer be reachable from here.',
    'run.nokey': 'No API key is set for this provider. Add one in Settings first.', 'run.limited': 'Too many requests. Please wait a moment.', 'run.serverbusy': 'The server is busy. Please try again shortly.',
    'key.paste': 'Paste API key', 'key.replace': 'Paste a new key to replace', 'key.invalid': 'Invalid key format (no spaces or line breaks).',
    'key.group.model': 'Model providers', 'key.group.data': 'Financial data', 'key.group.search': 'Web search',
    'hist.today': 'Today', 'hist.yesterday': 'Yesterday', 'hist.week': 'Previous 7 days', 'hist.older': 'Older', 'hist.none': 'No matching conversations.',
    'side.collapse': 'Collapse sidebar', 'side.expand': 'Expand sidebar', 'side.close': 'Close sidebar',
    'hist.delete': 'Delete conversation', 'hist.confirm': 'Delete this conversation? This cannot be undone.',
    'run.interrupted': 'This reply was interrupted (the server may have restarted).', 'run.busy': 'This conversation is still working. Please wait.',
    'key.set.account': 'Encrypted in your account',
    'key.forget.account.confirm': 'Remove every API key saved in your account? Your conversations are kept.',
    'lang.switch': '繁體中文',
  };

  let lang = localStorage.getItem('dexter-lang');
  if (lang !== 'en' && lang !== 'zh-TW') lang = navigator.language.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';

  window.getLang = () => lang;
  window.t = (key) => (lang === 'zh-TW' ? ZH[key] : EN_RUNTIME[key]) ?? EN_RUNTIME[key] ?? key;

  function apply() {
    document.documentElement.lang = lang;
    for (const el of document.querySelectorAll('[data-i18n]')) {
      if (el.dataset.en === undefined) el.dataset.en = el.textContent;
      el.textContent = lang === 'zh-TW' ? ZH[el.dataset.i18n] ?? el.dataset.en : el.dataset.en;
    }
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
      if (el.dataset.enPlaceholder === undefined) el.dataset.enPlaceholder = el.placeholder;
      el.placeholder = lang === 'zh-TW' ? ZH[el.dataset.i18nPlaceholder] ?? el.dataset.enPlaceholder : el.dataset.enPlaceholder;
    }
    for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', window.t(el.dataset.i18nAria));
    for (const btn of document.querySelectorAll('[data-lang-toggle]')) (btn.querySelector('[data-lang-label]') || btn).textContent = window.t('lang.switch');
    window.dispatchEvent(new CustomEvent('langchange'));
  }

  window.setLang = (next) => {
    lang = next;
    localStorage.setItem('dexter-lang', next);
    apply();
  };
  document.addEventListener('DOMContentLoaded', () => {
    for (const btn of document.querySelectorAll('[data-lang-toggle]')) {
      btn.addEventListener('click', () => window.setLang(lang === 'zh-TW' ? 'en' : 'zh-TW'));
    }
    apply();
  });
})();
