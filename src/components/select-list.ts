import { Container, Input, SelectList, Text, type SelectItem, getEditorKeybindings } from '@mariozechner/pi-tui';
import { PROVIDERS, type Model } from '../utils/model.js';
import type { ApprovalDecision } from '../agent/types.js';
import { selectListTheme, theme } from '../theme.js';
import { t } from '../i18n/index.js';

export class VimSelectList extends SelectList {
  handleInput(keyData: string): void {
    if (keyData === 'j') {
      super.handleInput('\u001b[B');
      return;
    }
    if (keyData === 'k') {
      super.handleInput('\u001b[A');
      return;
    }
    super.handleInput(keyData);
  }
}

class EmptyModelSelector extends Container {
  private readonly onCancel: () => void;

  constructor(providerId: string, onCancel: () => void) {
    super();
    this.onCancel = onCancel;
    this.addChild(new Text(theme.muted(t('select.noModels')), 0, 0));
    this.addChild(new Text(theme.muted(t('select.escBack')), 0, 0));
  }

  handleInput(keyData: string): void {
    const kb = getEditorKeybindings();
    if (kb.matches(keyData, 'selectCancel')) {
      this.onCancel();
    }
  }
}

export function createProviderSelector(
  currentProvider: string | undefined,
  onSelect: (providerId: string | null) => void,
) {
  const items: SelectItem[] = PROVIDERS.map((provider, index) => ({
    value: provider.providerId,
    label: `${index + 1}. ${provider.displayName}${currentProvider === provider.providerId ? ' ✓' : ''}`,
  }));
  const list = new VimSelectList(items, 8, selectListTheme);
  list.onSelect = (item) => onSelect(item.value);
  list.onCancel = () => onSelect(null);
  return list;
}

export function createSearchProviderSelector(
  currentProvider: string,
  onSelect: (providerId: 'exa' | 'perplexity' | 'tavily' | 'langsearch') => void,
  onCancel: () => void,
) {
  const providers: { id: 'exa' | 'perplexity' | 'tavily' | 'langsearch'; displayName: string }[] = [
    { id: 'exa', displayName: 'Exa' },
    { id: 'perplexity', displayName: 'Perplexity' },
    { id: 'tavily', displayName: 'Tavily' },
    { id: 'langsearch', displayName: 'LangSearch' },
  ];
  const items: SelectItem[] = providers.map((provider, index) => ({
    value: provider.id,
    label: `${index + 1}. ${provider.displayName}${currentProvider === provider.id ? ' ✓' : ''}`,
  }));
  const list = new VimSelectList(items, 5, selectListTheme);
  list.onSelect = (item) => onSelect(item.value as 'exa' | 'perplexity' | 'tavily' | 'langsearch');
  list.onCancel = () => onCancel();
  return list;
}

export function createModelSelector(
  models: Model[],
  currentModel: string | undefined,
  onSelect: (modelId: string | null) => void,
  providerId?: string,
) {
  if (models.length === 0) {
    return new EmptyModelSelector(providerId ?? '', () => onSelect(null));
  }
  const items: SelectItem[] = models.map((model, index) => ({
    value: model.id,
    label: `${index + 1}. ${model.displayName}${currentModel === model.id ? ' ✓' : ''}`,
  }));
  const list = new VimSelectList(items, 10, selectListTheme);
  list.onSelect = (item) => onSelect(item.value);
  list.onCancel = () => onSelect(null);
  return list;
}

export function createApprovalSelector(
  onSelect: (decision: ApprovalDecision) => void,
  proposedRule?: string,
) {
  const items: SelectItem[] = [{ value: 'allow-once', label: `1. ${t('approval.yes')}` }];
  if (proposedRule) {
    // bash: offer to persist a rule, and scope the session grant to this query.
    items.push({ value: 'allow-always', label: `2. ${t('approval.always', { rule: proposedRule })}` });
    items.push({ value: 'allow-session', label: `3. ${t('approval.sessionBash')}` });
    items.push({ value: 'deny', label: `4. ${t('approval.no')}` });
  } else {
    items.push({ value: 'allow-session', label: `2. ${t('approval.sessionEdits')}` });
    items.push({ value: 'deny', label: `3. ${t('approval.no')}` });
  }
  const list = new VimSelectList(items, 6, selectListTheme);
  list.onSelect = (item) => onSelect(item.value as ApprovalDecision);
  list.onCancel = () => onSelect('deny');
  return list;
}

export function createApiKeyConfirmSelector(onConfirm: (wantsToSet: boolean) => void) {
  const items: SelectItem[] = [
    { value: 'yes', label: `1. ${t('approval.yes')}` },
    { value: 'no', label: `2. ${t('approval.no')}` },
  ];
  const list = new VimSelectList(items, 4, selectListTheme);
  list.onSelect = (item) => onConfirm(item.value === 'yes');
  list.onCancel = () => onConfirm(false);
  return list;
}

export class ApiKeyInputComponent {
  private readonly input = new Input();
  private readonly masked: boolean;
  onSubmit?: (apiKey: string | null) => void;
  onCancel?: () => void;

  constructor(masked = false) {
    this.masked = masked;
  }

  invalidate() {
    this.input.invalidate();
  }

  render(width: number): string[] {
    const lines = this.input.render(Math.max(10, width - 4));
    const raw = lines[0] ?? '';
    const display = this.masked
      ? `${'*'.repeat(this.input.getValue().length)}${this.input.getValue().length === 0 ? '█' : ''}`
      : raw;
    return [
      `${theme.primary('> ')}${display}`,
      theme.muted(t('select.confirmCancel')),
    ];
  }

  handleInput(keyData: string): void {
    const kb = getEditorKeybindings();
    if (kb.matches(keyData, 'submit')) {
      this.onSubmit?.(this.input.getValue().trim() || null);
      return;
    }
    if (kb.matches(keyData, 'selectCancel')) {
      this.onCancel?.();
      return;
    }
    this.input.handleInput(keyData);
  }

  getValue(): string {
    return this.input.getValue();
  }
}
