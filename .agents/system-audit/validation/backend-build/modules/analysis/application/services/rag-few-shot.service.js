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
var RagFewShotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagFewShotService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const analysis_repository_port_1 = require("../../domain/ports/analysis.repository.port");
const rag_few_shot_util_1 = require("../../domain/rag-few-shot.util");
let RagFewShotService = RagFewShotService_1 = class RagFewShotService {
    repository;
    config;
    logger = new common_1.Logger(RagFewShotService_1.name);
    constructor(repository, config) {
        this.repository = repository;
        this.config = config;
    }
    embeddingDim() {
        const dim = this.config.get('EMBEDDING_DIM') ?? 64;
        if (!Number.isFinite(dim) || dim <= 0)
            return 64;
        return Math.min(Math.floor(dim), 4096);
    }
    embedQueryText(text) {
        return (0, rag_few_shot_util_1.embedText)(text ?? '', this.embeddingDim());
    }
    buildQueryText(errorType, columnTraits, description) {
        return `${errorType} | ${columnTraits} | ${description}`;
    }
    async buildFewShotBlockFromText(params) {
        if (!this.config.get('AI_RAG_ENABLED'))
            return '';
        const text = (params.queryText ?? '').trim();
        if (!text)
            return '';
        return this.buildFewShotBlock({
            workspaceId: params.workspaceId,
            embedding: this.embedQueryText(text),
            errorType: params.errorType,
            language: params.language,
        });
    }
    async buildFewShotBlock(params) {
        if (!this.config.get('AI_RAG_ENABLED'))
            return '';
        if (!params.embedding || params.embedding.length === 0)
            return '';
        const topK = this.config.get('AI_RAG_TOP_K') ?? rag_few_shot_util_1.DEFAULT_TOP_K;
        const minTrust = this.config.get('AI_RAG_MIN_TRUST_SCORE') ?? rag_few_shot_util_1.DEFAULT_MIN_TRUST_SCORE;
        const maxAgeDays = rag_few_shot_util_1.DEFAULT_MAX_AGE_DAYS;
        try {
            const candidates = await this.repository.findFewShotCandidates({
                workspaceId: params.workspaceId,
                errorType: params.errorType,
                language: params.language ?? 'vi',
                minTrustScore: minTrust,
                maxAgeDays,
                limit: Math.max(topK * 10, 50),
            });
            const mapped = candidates.map((c) => ({
                errorType: c.errorType,
                columnTraits: c.columnTraits ?? '',
                description: c.description,
                label: c.label,
                embedding: c.embedding,
                trustScore: c.trustScore,
                language: c.language ?? 'vi',
                createdAt: c.createdAt,
            }));
            const ranked = (0, rag_few_shot_util_1.rankFewShot)(mapped, {
                embedding: params.embedding,
                errorType: params.errorType,
                language: params.language ?? 'vi',
                topK,
                minTrustScore: minTrust,
                maxAgeDays,
            });
            if (ranked.length === 0)
                return '';
            return (0, rag_few_shot_util_1.renderFewShotBlock)(ranked);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`RAG few-shot khong tai duoc mau (bo qua, khong chan AI): ${message}`);
            return '';
        }
    }
};
exports.RagFewShotService = RagFewShotService;
exports.RagFewShotService = RagFewShotService = RagFewShotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(analysis_repository_port_1.ANALYSIS_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], RagFewShotService);
//# sourceMappingURL=rag-few-shot.service.js.map