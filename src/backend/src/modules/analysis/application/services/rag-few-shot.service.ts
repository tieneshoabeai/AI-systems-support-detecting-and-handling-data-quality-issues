import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../../domain/ports/analysis.repository.port';
import {
  DEFAULT_MAX_AGE_DAYS,
  DEFAULT_MIN_TRUST_SCORE,
  DEFAULT_TOP_K,
  type FewShotExample,
  embedText,
  rankFewShot,
  renderFewShotBlock,
} from '../../domain/rag-few-shot.util';

/**
 * Phan 12 v8 §3.16.4 — Co che T1: RAG tu nhan xet nguoi dung.
 * Application chi goi qua ANALYSIS_REPOSITORY_PORT, khong cham Mongoose.
 */
@Injectable()
export class RagFewShotService {
  private readonly logger = new Logger(RagFewShotService.name);

  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly repository: AnalysisRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  embeddingDim(): number {
    const dim = this.config.get<number>('EMBEDDING_DIM') ?? 64;
    if (!Number.isFinite(dim) || dim <= 0) return 64;
    return Math.min(Math.floor(dim), 4096);
  }

  embedQueryText(text: string): number[] {
    return embedText(text ?? '', this.embeddingDim());
  }

  buildQueryText(errorType: string, columnTraits: string, description: string): string {
    return `${errorType} | ${columnTraits} | ${description}`;
  }

  async buildFewShotBlockFromText(params: {
    workspaceId: string;
    queryText: string;
    errorType?: string;
    language?: string;
  }): Promise<string> {
    if (!this.config.get<boolean>('AI_RAG_ENABLED')) return '';
    const text = (params.queryText ?? '').trim();
    if (!text) return '';
    return this.buildFewShotBlock({
      workspaceId: params.workspaceId,
      embedding: this.embedQueryText(text),
      errorType: params.errorType,
      language: params.language,
    });
  }

  async buildFewShotBlock(params: {
    workspaceId: string;
    embedding: number[] | null;
    errorType?: string;
    language?: string;
  }): Promise<string> {
    if (!this.config.get<boolean>('AI_RAG_ENABLED')) return '';
    if (!params.embedding || params.embedding.length === 0) return '';

    const topK = this.config.get<number>('AI_RAG_TOP_K') ?? DEFAULT_TOP_K;
    const minTrust =
      this.config.get<number>('AI_RAG_MIN_TRUST_SCORE') ?? DEFAULT_MIN_TRUST_SCORE;
    const maxAgeDays = DEFAULT_MAX_AGE_DAYS;

    try {
      const candidates = await this.repository.findFewShotCandidates({
        workspaceId: params.workspaceId,
        errorType: params.errorType,
        language: params.language ?? 'vi',
        minTrustScore: minTrust,
        maxAgeDays,
        limit: Math.max(topK * 10, 50),
      });

      const mapped: FewShotExample[] = candidates.map((c) => ({
        errorType: c.errorType,
        columnTraits: c.columnTraits ?? '',
        description: c.description,
        label: (c.label as FewShotExample['label']),
        embedding: c.embedding,
        trustScore: c.trustScore,
        language: c.language ?? 'vi',
        createdAt: c.createdAt,
      }));

      const ranked = rankFewShot(mapped, {
        embedding: params.embedding,
        errorType: params.errorType,
        language: params.language ?? 'vi',
        topK,
        minTrustScore: minTrust,
        maxAgeDays,
      });

      if (ranked.length === 0) return '';
      return renderFewShotBlock(ranked);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`RAG few-shot khong tai duoc mau (bo qua, khong chan AI): ${message}`);
      return '';
    }
  }
}
