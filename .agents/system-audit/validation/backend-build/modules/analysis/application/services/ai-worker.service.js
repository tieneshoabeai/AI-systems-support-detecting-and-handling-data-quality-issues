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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AiWorkerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiWorkerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const analysis_repository_port_1 = require("../../domain/ports/analysis.repository.port");
const analysis_service_1 = require("../analysis.service");
const ai_inference_port_1 = require("../ports/ai-inference.port");
const DEFAULT_MAX_ATTEMPTS = 2;
const LEASE_TIMEOUT_MS = 600000;
let AiWorkerService = AiWorkerService_1 = class AiWorkerService {
    repository;
    analysisService;
    inference;
    config;
    logger = new common_1.Logger(AiWorkerService_1.name);
    timer = null;
    busy = false;
    constructor(repository, analysisService, inference, config) {
        this.repository = repository;
        this.analysisService = analysisService;
        this.inference = inference;
        this.config = config;
    }
    onModuleInit() {
        const mode = (this.config.get('WORKER_MODE') ?? 'all').toLowerCase();
        if (mode === 'api') {
            this.logger.log('AI worker tat trong API process (WORKER_MODE=api) - worker rieng dam nhan');
            return;
        }
        const enabled = this.config.get('AI_WORKER_ENABLED') ?? false;
        if (!enabled) {
            this.logger.log('AI worker tat (AI_WORKER_ENABLED != true). Job corr-v1 cho ingest thu cong.');
            return;
        }
        const interval = this.config.get('AI_WORKER_INTERVAL_MS') ?? 10000;
        this.logger.log(`AI worker bat, poll moi ${interval}ms`);
        this.timer = setInterval(() => {
            void this.tick().catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`AI worker tick loi: ${msg}`);
            });
        }, interval);
        const t = this.timer;
        if (typeof t.unref === 'function' && (this.config.get('NODE_ENV') === 'test')) {
            t.unref();
        }
    }
    async tick() {
        if (this.busy)
            return;
        this.busy = true;
        try {
            await this.repository.skipStaleJobs(LEASE_TIMEOUT_MS);
            const job = await this.repository.claimPendingJob(LEASE_TIMEOUT_MS);
            if (!job)
                return;
            await this.processJob(job.id);
        }
        finally {
            this.busy = false;
        }
    }
    async processJob(jobId) {
        const timeoutMs = this.config.get('AI_TIMEOUT_MS') ??
            this.config.get('AI_JOB_TIMEOUT_MS') ??
            180000;
        const job = await this.repository.findJobById(jobId);
        if (!job)
            return;
        const started = Date.now();
        await this.repository.updateJobById(jobId, {
            status: 'running',
            startedAt: new Date(),
            started_at: new Date(),
            heartbeatAt: new Date(),
            heartbeat_at: new Date(),
            leaseExpiresAt: new Date(Date.now() + LEASE_TIMEOUT_MS),
            lease_expires_at: new Date(Date.now() + LEASE_TIMEOUT_MS),
            error: null,
        });
        const heartbeat = setInterval(() => {
            void this.repository
                .heartbeatJob(jobId, LEASE_TIMEOUT_MS)
                .catch(() => undefined);
        }, Math.floor(LEASE_TIMEOUT_MS / 3));
        try {
            const prompt = await this.analysisService.buildPromptForJob(jobId);
            const out = await this.inference.complete({
                prompt,
                timeoutMs,
                modelId: job.modelId ?? this.config.get('AI_MODEL_ID') ?? null,
            });
            const raw = (0, ai_inference_port_1.extractJsonObject)(out.text);
            if (raw === null) {
                throw new Error('AI tra ve khong phai JSON object');
            }
            await this.analysisService.ingestAiResult(jobId, raw, out.modelId ?? job.modelId ?? undefined);
            await this.repository.updateJobById(jobId, {
                finishedAt: new Date(),
                finished_at: new Date(),
                durationMs: Date.now() - started,
                duration_ms: Date.now() - started,
                heartbeatAt: new Date(),
                heartbeat_at: new Date(),
                leaseExpiresAt: null,
                lease_expires_at: null,
            });
            this.logger.log(`AI job ${jobId} succeeded in ${Date.now() - started}ms`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const retryable = /timeout|HTTP 5|ECONN|ENOTFOUND|AI tra ve/i.test(message);
            const attempt = (job.attempt ?? 0) + 1;
            const maxAttempts = (this.config.get('AI_MAX_RETRIES') ?? DEFAULT_MAX_ATTEMPTS) + 1;
            const exhausted = attempt >= maxAttempts;
            await this.repository.updateJobById(jobId, {
                status: exhausted ? 'failed' : 'pending',
                attempt,
                finishedAt: exhausted ? new Date() : null,
                finished_at: exhausted ? new Date() : null,
                durationMs: exhausted ? Date.now() - started : null,
                duration_ms: exhausted ? Date.now() - started : null,
                error: { code: exhausted ? 'AI_FAILED' : 'AI_RETRY', message, retryable },
            });
            if (/JSON/i.test(message)) {
                try {
                    await this.analysisService.ingestAiResult(jobId, {}, job.modelId ?? undefined);
                }
                catch {
                }
            }
            this.logger.warn(`AI job ${jobId} loi (attempt ${attempt}): ${message}`);
        }
        finally {
            clearInterval(heartbeat);
        }
    }
};
exports.AiWorkerService = AiWorkerService;
exports.AiWorkerService = AiWorkerService = AiWorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(analysis_repository_port_1.ANALYSIS_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object, analysis_service_1.AnalysisService, ai_inference_port_1.AiInferencePort, config_1.ConfigService])
], AiWorkerService);
//# sourceMappingURL=ai-worker.service.js.map