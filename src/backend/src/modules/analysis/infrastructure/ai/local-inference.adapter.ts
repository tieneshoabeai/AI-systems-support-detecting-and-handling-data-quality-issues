import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiInferencePort, InferenceRequest, InferenceResponse } from '../../application/ports/ai-inference.port';

type Engine = 'vllm' | 'ollama';

/**
 * Adapter suy luan cuc bo: vLLM (OpenAI-compatible) cho prod, Ollama cho dev.
 * Khong log prompt (chua du lieu che PII nhung van nhay cam); chi log do dai + duration.
 */
@Injectable()
export class LocalInferenceAdapter extends AiInferencePort {
  readonly engine: Engine;
  private readonly logger = new Logger(LocalInferenceAdapter.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    super();
    const raw = (config.get<string>('AI_ENGINE') ?? 'ollama').toLowerCase();
    this.engine = raw === 'vllm' ? 'vllm' : 'ollama';
    this.baseUrl = (config.get<string>('AI_INFERENCE_BASE_URL') ?? '').replace(/\/$/, '');
    this.apiKey = config.get<string>('AI_INFERENCE_API_KEY') ?? undefined;
  }

  async complete(req: InferenceRequest): Promise<InferenceResponse> {
    if (!this.baseUrl) {
      throw new Error('AI_INFERENCE_BASE_URL chua duoc cau hinh');
    }
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      const text =
        this.engine === 'vllm'
          ? await this.callVllm(req.prompt, req.modelId, controller.signal)
          : await this.callOllama(req.prompt, req.modelId, controller.signal);
      const durationMs = Date.now() - started;
      this.logger.log(`AI inference engine=${this.engine} done in ${durationMs}ms (prompt ${req.prompt.length} chars)`);
      return { text, modelId: req.modelId, durationMs };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`AI inference timeout sau ${req.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async callVllm(prompt: string, modelId: string | null, signal: AbortSignal): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: modelId ?? 'default',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`vLLM HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('vLLM tra ve rong');
    return content;
  }

  private async callOllama(prompt: string, modelId: string | null, signal: AbortSignal): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: modelId ?? 'qwen3:8b',
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
    const data = (await res.json()) as { response?: string };
    if (!data.response) throw new Error('Ollama tra ve rong');
    return data.response;
  }
}
