import type { MessageKey } from './en.js';

export const zhTW: Record<MessageKey, string> = {
  // Intro
  'intro.welcome': '歡迎使用 Dexter',
  'intro.tagline': '您的深度財經研究 AI 助理。',
  'intro.model': '模型：',

  // Hint bar
  'hint.escClear': '再按一次 esc 清除',
  'hint.escExit': '再按一次 esc 離開',
  'hint.interrupt': 'esc 中斷',
  'hint.queued': '{count} 則訊息排隊中',
  'hint.queuedOne': '{count} 則訊息排隊中',
  'hint.approve': 'enter 同意 · esc 拒絕',
  'hint.commands': '輸入 / 查看指令',

  // Slash commands
  'cmd.model': '切換 LLM 供應商與模型',
  'cmd.search': '選擇偏好的網路搜尋供應商',
  'cmd.rules': '顯示研究規則',
  'cmd.clear': '清除對話',
  'cmd.memory': '顯示 Dexter 對您的記憶',
  'cmd.heartbeat': '顯示心跳監控清單',
  'cmd.history': '顯示最近的對話摘要',
  'cmd.help': '顯示快捷鍵與使用提示',
  'cmd.language': '切換介面語言（English / 繁體中文）',

  // Help / slash output
  'help.text': `快捷鍵
  esc          中斷查詢 / 清除輸入
  ctrl+c       離開 Dexter
  /model       切換 LLM 供應商與模型
  /search      選擇偏好的網路搜尋供應商
  /rules       顯示研究規則
  /clear       清除對話
  /language    切換介面語言
  ↑ / ↓        瀏覽輸入歷史`,
  'rules.title': '研究規則：',
  'rules.none': '尚未設定研究規則。輸入「add a rule <內容>」即可新增。',
  'history.none': '目前還沒有對話紀錄。',
  'history.recent': '最近的對話：',
  'history.pending': '（處理中）',
  'language.switched': '介面語言已切換為繁體中文。',
  'language.usage': '用法：/language [en|zh-TW]',

  // Misc
  'error.prefix': '錯誤：{message}',
  'common.interrupted': '已中斷 · 請告訴 Dexter 要改做什麼？',
  'common.in': '，耗時 {duration}',

  // Working indicator
  'working.approval': '等待您的同意...',
  'working.question': '等待您的回答...',
  'working.tokens': 'tokens',

  // Approval prompt
  'approval.required': '需要授權',
  'approval.question': '是否允許此操作？',
  'approval.footer': 'Enter 確認 · esc 拒絕',
  'approval.emptyCommand': '<空指令>',
  'approval.unknown': '<未知>',
  'approval.yes': '是',
  'approval.no': '否',
  'approval.always': '是，並永遠允許 {rule}',
  'approval.sessionBash': '是，本次查詢允許所有 bash',
  'approval.sessionEdits': '是，本次工作階段允許所有編輯',
  'approval.approved': '已同意',
  'approval.approvedSession': '已同意（本次工作階段）',
  'approval.approvedAlways': '已同意（永遠）',
  'approval.denied': '已拒絕',
  'approval.deniedWrite': '使用者拒絕寫入 {path}',
  'approval.deniedEdit': '使用者拒絕編輯 {path}',
  'approval.deniedOther': '使用者拒絕 {tool} {path}',

  // Tool events / summaries
  'tool.limitWarning': '接近建議上限',
  'tool.searching': '搜尋中...',
  'tool.loadedSkill': '已載入 {name} 技能',
  'tool.receivedItems': '取得 {count} 筆項目',
  'tool.done': '完成',
  'tool.calledOneSource': '呼叫 1 個資料來源',
  'tool.calledSources': '呼叫 {count} 個資料來源',
  'tool.oneSearch': '完成 1 次搜尋',
  'tool.receivedFields': '取得 {count} 個欄位',
  'tool.receivedData': '已取得資料',
  'browser.opening': '開啟 {url}',
  'browser.navigating': '前往 {url}',
  'browser.snapshot': '讀取頁面結構',
  'browser.read': '擷取頁面文字',
  'browser.close': '關閉瀏覽器',
  'answered': '已回答：',

  // Context management messages
  'context.cleared': '已達上下文上限 - 清除 {cleared} 筆舊工具結果，保留最近 {kept} 筆',
  'context.clearedOne': '已達上下文上限 - 清除 {cleared} 筆舊工具結果，保留最近 {kept} 筆',
  'context.microcompact': '微壓縮：清除 {cleared} 筆舊工具結果（約 {tokens}K tokens）',
  'context.microcompactOne': '微壓縮：清除 {cleared} 筆舊工具結果（約 {tokens}K tokens）',
  'context.compacted': '上下文已壓縮（減少 {pct}%，節省約 {saved}K tokens）',
  'context.compactFailed': '壓縮失敗，改以清除上下文處理',

  // Selection screens
  'select.providerTitle': '選擇供應商',
  'select.providerDesc': '切換 LLM 供應商，將套用於本次及之後的工作階段。',
  'select.confirmExit': 'Enter 確認 · esc 離開',
  'select.confirmBack': 'Enter 確認 · esc 返回',
  'select.confirmDecline': 'Enter 確認 · esc 略過',
  'select.confirmCancel': 'Enter 確認 · Esc 取消',
  'select.modelTitle': '選擇 {provider} 的模型',
  'select.modelInputTitle': '輸入 {provider} 的模型名稱',
  'select.modelInputDesc': '請輸入或貼上 openrouter.ai/models 上的模型名稱',
  'select.modelInputExamples': '範例：anthropic/claude-3.5-sonnet, openai/gpt-4-turbo, meta-llama/llama-3-70b',
  'select.apiKeyTitle': '設定 API 金鑰',
  'select.apiKeyAsk': '要設定 {provider} 的 API 金鑰嗎？',
  'select.apiKeyEnter': '輸入 {provider} API 金鑰',
  'select.searchTitle': '選擇網路搜尋供應商',
  'select.searchDesc': 'Dexter 會優先使用您偏好的供應商，失敗時再依序改用其他供應商。',
  'select.noModels': '沒有可用的模型。',
  'select.escBack': 'esc 返回',

  // Question prompt
  'q.submitTab': '✔ 送出',
  'q.typeSomething': '自行輸入。',
  'q.chat': '改為聊聊這個問題',
  'q.typeAnswer': '請輸入您的答案：',
  'q.saveBack': 'Enter 儲存 · Esc 返回',
  'q.review': '請確認您的答案：',
  'q.notAnswered': '— 尚未回答',
  'q.nav': 'Tab/方向鍵切換 · Esc 取消',
  'q.submitReady': 'Enter 送出',
  'q.submitIncomplete': '請回答所有問題後才能送出',
  'q.toggle': 'Enter/空白鍵 切換勾選',
  'q.select': 'Enter 選取',
};
