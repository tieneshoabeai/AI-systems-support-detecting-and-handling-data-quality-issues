import { ConfigService } from '@nestjs/config';
import { AiInferencePort, InferenceRequest, InferenceResponse } from '../../application/ports/ai-inference.port';
type Engine = 'vllm' | 'ollama';
export declare class LocalInferenceAdapter extends AiInferencePort {
    private readonly config;
    readonly engine: Engine;
    private readonly logger;
    private readonly baseUrl;
    private readonly apiKey;
    constructor(config: ConfigService);
    complete(req: InferenceRequest): Promise<InferenceResponse>;
    private callVllm;
    private callOllama;
}
export {};
