export const en = {
  // Intro
  'intro.welcome': 'Welcome to Dexter',
  'intro.tagline': 'Your AI assistant for deep financial research.',
  'intro.model': 'Model: ',

  // Hint bar
  'hint.escClear': 'esc again to clear',
  'hint.escExit': 'esc again to exit',
  'hint.interrupt': 'esc to interrupt',
  'hint.queued': '{count} messages queued',
  'hint.queuedOne': '{count} message queued',
  'hint.approve': 'enter to approve · esc to deny',
  'hint.commands': '/ for commands',

  // Slash commands
  'cmd.model': 'Switch LLM provider and model',
  'cmd.search': 'Choose preferred web search provider',
  'cmd.rules': 'Show your research rules',
  'cmd.clear': 'Clear the conversation',
  'cmd.memory': 'Show what Dexter remembers about you',
  'cmd.heartbeat': 'Show your heartbeat monitoring checklist',
  'cmd.history': 'Show recent conversation summaries',
  'cmd.help': 'Show keyboard shortcuts and tips',
  'cmd.language': 'Switch interface language (English / 繁體中文)',

  // Help / slash output
  'help.text': `Keyboard Shortcuts
  esc          Interrupt query / clear input
  ctrl+c       Exit Dexter
  /model       Switch LLM provider and model
  /search      Choose preferred web search provider
  /rules       Show research rules
  /clear       Clear conversation
  /language    Switch interface language
  ↑ / ↓        Navigate input history`,
  'rules.title': 'Research Rules:',
  'rules.none': 'No research rules set. Use "add a rule <text>" to create one.',
  'history.none': 'No conversation history yet.',
  'history.recent': 'Recent conversations:',
  'history.pending': '(pending)',
  'language.switched': 'Language switched to English.',
  'language.usage': 'Usage: /language [en|zh-TW]',

  // Misc
  'error.prefix': 'Error: {message}',
  'common.interrupted': 'Interrupted · What should Dexter do instead?',
  'common.in': ' in {duration}',

  // Working indicator
  'working.approval': 'Waiting for approval...',
  'working.question': 'Waiting for your answer...',
  'working.tokens': 'tokens',

  // Approval prompt
  'approval.required': 'Permission required',
  'approval.question': 'Do you want to allow this?',
  'approval.footer': 'Enter to confirm · esc to deny',
  'approval.emptyCommand': '<empty command>',
  'approval.unknown': '<unknown>',
  'approval.yes': 'Yes',
  'approval.no': 'No',
  'approval.always': 'Yes, and always allow {rule}',
  'approval.sessionBash': 'Yes, allow all bash this query',
  'approval.sessionEdits': 'Yes, allow all edits this session',
  'approval.approved': 'Approved',
  'approval.approvedSession': 'Approved (session)',
  'approval.approvedAlways': 'Approved (always)',
  'approval.denied': 'Denied',
  'approval.deniedWrite': 'User denied write to {path}',
  'approval.deniedEdit': 'User denied edit of {path}',
  'approval.deniedOther': 'User denied {tool} {path}',

  // Tool events / summaries
  'tool.limitWarning': 'Approaching suggested limit',
  'tool.searching': 'Searching...',
  'tool.loadedSkill': 'Loaded {name} skill',
  'tool.receivedItems': 'Received {count} items',
  'tool.done': 'Done',
  'tool.calledOneSource': 'Called 1 data source',
  'tool.calledSources': 'Called {count} data sources',
  'tool.oneSearch': 'Did 1 search',
  'tool.receivedFields': 'Received {count} fields',
  'tool.receivedData': 'Received data',
  'browser.opening': 'Opening {url}',
  'browser.navigating': 'Navigating to {url}',
  'browser.snapshot': 'Reading page structure',
  'browser.read': 'Extracting page text',
  'browser.close': 'Closing browser',
  'answered': 'Answered:',

  // Context management messages
  'context.cleared': 'Context threshold reached - cleared {cleared} old tool results, kept {kept} most recent',
  'context.clearedOne': 'Context threshold reached - cleared {cleared} old tool result, kept {kept} most recent',
  'context.microcompact': 'Microcompact: cleared {cleared} old tool results (~{tokens}K tokens)',
  'context.microcompactOne': 'Microcompact: cleared {cleared} old tool result (~{tokens}K tokens)',
  'context.compacted': 'Context compacted ({pct}% reduction, ~{saved}K tokens saved)',
  'context.compactFailed': 'Compaction failed, falling back to context clearing',

  // Selection screens
  'select.providerTitle': 'Select provider',
  'select.providerDesc': 'Switch between LLM providers. Applies to this session and future sessions.',
  'select.confirmExit': 'Enter to confirm · esc to exit',
  'select.confirmBack': 'Enter to confirm · esc to go back',
  'select.confirmDecline': 'Enter to confirm · esc to decline',
  'select.confirmCancel': 'Enter to confirm · Esc to cancel',
  'select.modelTitle': 'Select model for {provider}',
  'select.modelInputTitle': 'Enter model name for {provider}',
  'select.modelInputDesc': 'Type or paste the model name from openrouter.ai/models',
  'select.modelInputExamples': 'Examples: anthropic/claude-3.5-sonnet, openai/gpt-4-turbo, meta-llama/llama-3-70b',
  'select.apiKeyTitle': 'Set API Key',
  'select.apiKeyAsk': 'Would you like to set your {provider} API key?',
  'select.apiKeyEnter': 'Enter {provider} API Key',
  'select.searchTitle': 'Select web search provider',
  'select.searchDesc': 'Dexter tries your preferred provider first and falls back to the others.',
  'select.noModels': 'No models available.',
  'select.escBack': 'esc to go back',

  // Question prompt
  'q.submitTab': '✔ Submit',
  'q.typeSomething': 'Type something.',
  'q.chat': 'Chat about this',
  'q.typeAnswer': 'Type your answer:',
  'q.saveBack': 'Enter save · Esc back',
  'q.review': 'Review your answers:',
  'q.notAnswered': '— not answered',
  'q.nav': 'Tab/Arrow keys to navigate · Esc to cancel',
  'q.submitReady': 'Enter to submit',
  'q.submitIncomplete': 'Answer all questions to submit',
  'q.toggle': 'Enter/Space to toggle',
  'q.select': 'Enter to select',
} as const;

export type MessageKey = keyof typeof en;
