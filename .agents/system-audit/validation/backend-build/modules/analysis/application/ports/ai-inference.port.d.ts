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
export declare abstract class AiInferencePort {
    abstract readonly engine: AiEngine;
    abstract complete(req: InferenceRequest): Promise<InferenceResponse>;
}
export declare function extractJsonObject(text: string): unknown;
