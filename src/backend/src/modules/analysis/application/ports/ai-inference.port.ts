export type AiEngine = 'vllm' | 'ollama';

export interface InferenceRequest {
  prompt: string;
  timeoutMs: number;
  modelId: string | null;
}

export interface InferenceResponse {
  text: string;
  modelId: string | null;
  durationMs: number;
}

export abstract class AiInferencePort {
  abstract readonly engine: AiEngine;
  abstract complete(req: InferenceRequest): Promise<InferenceResponse>;
}

/**
 * Tanh JSON object dau tien khoi text model tra ve (model co the kem prose).
 * Tra null khi khong tim duoc JSON parse duoc.
 */
export function extractJsonObject(text: string): unknown {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      // roi xuong quet sau hon
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}
