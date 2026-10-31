import { PROVIDERS as PROVIDER_DEFS } from '@/providers';

export interface Model {
  id: string;
  displayName: string;
}

interface Provider {
  displayName: string;
  providerId: string;
  models: Model[];
}

const PROVIDER_MODELS: Record<string, Model[]> = {
  openai: [
    { id: 'gpt-6-astra', displayName: 'GPT 6 Astra' },
    { id: 'gpt-6.1-sol', displayName: 'GPT 6.1 Sol' },
    { id: 'gpt-6.1-terra', displayName: 'GPT 6.1 Terra' },
    { id: 'gpt-6-luna', displayName: 'GPT 6 Luna' },
  ],
  anthropic: [
    { id: 'claude-sonnet-5-5', displayName: 'Sonnet 5.5' },
    { id: 'claude-opus-5-5', displayName: 'Opus 5.5' },
    { id: 'claude-fable-5-1', displayName: 'Fable 5.1' },
    { id: 'claude-haiku-5-5', displayName: 'Haiku 5.5' },
  ],
  google: [
    { id: 'gemini-4-argon', displayName: 'Gemini 4 Argon' },
    { id: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.6-flash', displayName: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash-Lite' },
  ],
  xai: [
    { id: 'grok-4.7', displayName: 'Grok 4.7' },
    { id: 'grok-4.6', displayName: 'Grok 4.6' },
    { id: 'grok-4.5', displayName: 'Grok 4.5' },
  ],
  moonshot: [
    { id: 'kimi-k3.1-pro', displayName: 'Kimi K3.1 Pro' },
    { id: 'kimi-k3.1-pro-highspeed', displayName: 'Kimi K3.1 Pro Highspeed' },
    { id: 'kimi-k3', displayName: 'Kimi K3' },
  ],
  deepseek: [
    { id: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro' },
    { id: 'deepseek-flash', displayName: 'DeepSeek V4.1 Flash' },
  ],
};

export const PROVIDERS: Provider[] = PROVIDER_DEFS.map((provider) => ({
  displayName: provider.displayName,
  providerId: provider.id,
  models: PROVIDER_MODELS[provider.id] ?? [],
}));

export function getModelsForProvider(providerId: string): Model[] {
  const provider = PROVIDERS.find((entry) => entry.providerId === providerId);
  return provider?.models ?? [];
}

export function getModelIdsForProvider(providerId: string): string[] {
  return getModelsForProvider(providerId).map((model) => model.id);
}

export function getDefaultModelForProvider(providerId: string): string | undefined {
  const models = getModelsForProvider(providerId);
  return models[0]?.id;
}

export function getModelDisplayName(modelId: string): string {
  const normalizedId = modelId.replace(/^(ollama-cloud|openrouter):/, '');

  for (const provider of PROVIDERS) {
    const model = provider.models.find((entry) => entry.id === normalizedId || entry.id === modelId);
    if (model) {
      return model.displayName;
    }
  }

  return normalizedId;
}
