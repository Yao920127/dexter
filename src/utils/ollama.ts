/**
 * Ollama Cloud API utilities
 */

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

/**
 * Fetches models from the Ollama Cloud API
 */
export async function getOllamaCloudModels(): Promise<string[]> {
  try {
    const response = await fetch('https://ollama.com/api/tags');

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return (data?.models ?? [])
      .map((m) => m?.name)
      .filter((n): n is string => typeof n === 'string');
  } catch {
    // Ollama Cloud unreachable
    return [];
  }
}

