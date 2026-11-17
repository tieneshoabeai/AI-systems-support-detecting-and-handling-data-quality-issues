"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LocalInferenceAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalInferenceAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ai_inference_port_1 = require("../../application/ports/ai-inference.port");
let LocalInferenceAdapter = LocalInferenceAdapter_1 = class LocalInferenceAdapter extends ai_inference_port_1.AiInferencePort {
    config;
    engine;
    logger = new common_1.Logger(LocalInferenceAdapter_1.name);
    baseUrl;
    apiKey;
    constructor(config) {
        super();
        this.config = config;
        const raw = (config.get('AI_ENGINE') ?? 'ollama').toLowerCase();
        this.engine = raw === 'vllm' ? 'vllm' : 'ollama';
        this.baseUrl = (config.get('AI_INFERENCE_BASE_URL') ?? '').replace(/\/$/, '');
        this.apiKey = config.get('AI_INFERENCE_API_KEY') ?? undefined;
    }
    async complete(req) {
        if (!this.baseUrl) {
            throw new Error('AI_INFERENCE_BASE_URL chua duoc cau hinh');
        }
        const started = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), req.timeoutMs);
        try {
            const text = this.engine === 'vllm'
                ? await this.callVllm(req.prompt, req.modelId, controller.signal)
                : await this.callOllama(req.prompt, req.modelId, controller.signal);
            const durationMs = Date.now() - started;
            this.logger.log(`AI inference engine=${this.engine} done in ${durationMs}ms (prompt ${req.prompt.length} chars)`);
            return { text, modelId: req.modelId, durationMs };
        }
        catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                throw new Error(`AI inference timeout sau ${req.timeoutMs}ms`);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
    }
    async callVllm(prompt, modelId, signal) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey)
            headers['Authorization'] = `Bearer ${this.apiKey}`;
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
        const data = (await res.json());
        const content = data.choices?.[0]?.message?.content ?? '';
        if (!content)
            throw new Error('vLLM tra ve rong');
        return content;
    }
    async callOllama(prompt, modelId, signal) {
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
        const data = (await res.json());
        if (!data.response)
            throw new Error('Ollama tra ve rong');
        return data.response;
    }
};
exports.LocalInferenceAdapter = LocalInferenceAdapter;
exports.LocalInferenceAdapter = LocalInferenceAdapter = LocalInferenceAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LocalInferenceAdapter);
//# sourceMappingURL=local-inference.adapter.js.map