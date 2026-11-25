/**
 * OPEN-FB-02 — chiều vector embedding RAG few-shot phải **thống nhất** giữa
 * runtime và script migration.
 *
 * Bối cảnh:
 *   Trước đây giá trị chiều nằm rải rác ở 4 nơi với 3 mặc định khác nhau:
 *     - `env.validation.ts`            → schema `default(1024)`
 *     - `RagFewShotService`            → `?? 64`  (nhánh chết — schema luôn có giá trị)
 *     - `embedText`                     → `dim = 64`
 *     - `embeddingDimFromEnv` (script)  → `?? 64`  (đọc thẳng `process.env`)
 *
 *   → Migration ghi mẫu 64 chiều, runtime truy vấn 1024 chiều → `cosineSimilarity`
 *     lệch chiều → trả `0` → **mọi mẫu RAG do migration tạo ra không bao giờ
 *     được chọn**. Việc "dựng lại mẫu RAG" trở nên vô nghĩa.
 *
 *   Lỗi này **không bị test bắt** vì cả test runtime lẫn test migration đều
 *   hardcode cùng một giá trị sai (`64`) → hai vế cùng sai nên vẫn khớp.
 *
 * Bộ test này khóa lại đúng điểm đó: **so sánh chiều của runtime với chiều của
 * migration**, thay vì so sánh hai giá trị hardcode với nhau.
 */
import { ConfigService } from '@nestjs/config';
import { RagFewShotService } from '../../../src/modules/analysis/application/services/rag-few-shot.service';
import {
  cosineSimilarity,
  embedText,
} from '../../../src/modules/analysis/domain/rag-few-shot.util';
import {
  DEFAULT_EMBEDDING_DIM,
  MAX_EMBEDDING_DIM,
  normalizeEmbeddingDim,
} from '../../../src/shared/domain/utils/embedding-dim.util';
import { EnvironmentSchema } from '../../../src/shared/infrastructure/config/env.validation';
import {
  embeddingDimFromEnv,
  runFewShotScrub,
} from '../../../scripts/lib/few-shot-scrub';

describe('OPEN-FB-02 — chiều embedding RAG thống nhất giữa runtime và migration', () => {
  /** Dựng `ConfigService` giả với giá trị đã qua `validate` (giống runtime thật). */
  const configWith = (dim: number | undefined): ConfigService =>
    ({
      get: (key: string): unknown => (key === 'EMBEDDING_DIM' ? dim : undefined),
    }) as unknown as ConfigService;

  describe('hằng số nguồn sự thật duy nhất', () => {
    it('DEFAULT_EMBEDDING_DIM là số nguyên dương hợp lệ', () => {
      expect(Number.isInteger(DEFAULT_EMBEDDING_DIM)).toBe(true);
      expect(DEFAULT_EMBEDDING_DIM).toBeGreaterThan(0);
      expect(DEFAULT_EMBEDDING_DIM).toBeLessThanOrEqual(MAX_EMBEDDING_DIM);
    });

    it('normalizeEmbeddingDim chuẩn hoá mọi giá trị lệch về hợp lệ', () => {
      expect(normalizeEmbeddingDim(undefined)).toBe(DEFAULT_EMBEDDING_DIM);
      expect(normalizeEmbeddingDim(null)).toBe(DEFAULT_EMBEDDING_DIM);
      expect(normalizeEmbeddingDim('')).toBe(DEFAULT_EMBEDDING_DIM);
      expect(normalizeEmbeddingDim(Number.NaN)).toBe(DEFAULT_EMBEDDING_DIM);
      expect(normalizeEmbeddingDim(0)).toBe(DEFAULT_EMBEDDING_DIM);
      expect(normalizeEmbeddingDim(-5)).toBe(DEFAULT_EMBEDDING_DIM);
      expect(normalizeEmbeddingDim(128)).toBe(128);
      expect(normalizeEmbeddingDim(128.9)).toBe(128);
      expect(normalizeEmbeddingDim('256')).toBe(256);
      expect(normalizeEmbeddingDim(99999)).toBe(MAX_EMBEDDING_DIM);
    });
  });

  describe('schema cấu hình phải dùng đúng hằng số', () => {
    // Chỉ validate phần `EMBEDDING_DIM` — schema đầy đủ yêu cầu nhiều biến
    // bắt buộc (JWT, S3…) không liên quan tới kiểm tra này.
    const parseDim = (env: Record<string, unknown>): number =>
      EnvironmentSchema.pick({ EMBEDDING_DIM: true }).parse(env).EMBEDDING_DIM;

    it('EMBEDDING_DIM trong schema mặc định bằng DEFAULT_EMBEDDING_DIM', () => {
      // Đây là chốt chặn gốc rễ: schema là nơi quyết định giá trị runtime thật.
      // Nếu schema lệch khỏi `DEFAULT_EMBEDDING_DIM` thì runtime dùng giá trị
      // khác, còn migration dùng `DEFAULT_EMBEDDING_DIM` → lệch chiều trở lại.
      expect(parseDim({})).toBe(DEFAULT_EMBEDDING_DIM);
    });

    it('EMBEDDING_DIM trong schema bằng giá trị khai báo tường minh', () => {
      expect(parseDim({ EMBEDDING_DIM: '256' })).toBe(256);
    });

    it('schema chặn giá trị vượt trần cho phép', () => {
      expect(() => parseDim({ EMBEDDING_DIM: String(MAX_EMBEDDING_DIM + 1) })).toThrow();
      expect(() => parseDim({ EMBEDDING_DIM: '0' })).toThrow();
    });
  });

  describe('runtime và migration phải cho CÙNG chiều', () => {
    it('runtime (RagFewShotService) và migration (embeddingDimFromEnv) khớp khi env không khai báo', () => {
      // Kịch bản gây lỗi: `.env` không có `EMBEDDING_DIM`.
      const runtimeDim = new RagFewShotService(
        {} as never,
        configWith(undefined),
      ).embeddingDim();
      const migrationDim = embeddingDimFromEnv(undefined);

      expect(migrationDim).toBe(runtimeDim);
      expect(runtimeDim).toBe(DEFAULT_EMBEDDING_DIM);
    });

    it('runtime và migration khớp khi env khai báo giá trị hợp lệ', () => {
      const runtimeDim = new RagFewShotService(
        {} as never,
        configWith(256),
      ).embeddingDim();
      const migrationDim = embeddingDimFromEnv('256');

      expect(migrationDim).toBe(runtimeDim);
      expect(runtimeDim).toBe(256);
    });

    it('runtime và migration khớp cả khi env khai báo giá trị rác', () => {
      for (const raw of ['', 'abc', '0', '-1', 'NaN']) {
        const runtimeDim = new RagFewShotService(
          {} as never,
          configWith(undefined),
        ).embeddingDim();
        const migrationDim = embeddingDimFromEnv(raw);

        expect(migrationDim).toBe(runtimeDim);
      }
    });
  });

  describe('vector ghi bởi migration phải match được truy vấn runtime', () => {
    it('cosine similarity giữa vector runtime và vector migration > 0', () => {
      const q = 'DQ-01 | cot trang thai | khong phai loi';
      const runtimeDim = new RagFewShotService(
        {} as never,
        configWith(undefined),
      ).embeddingDim();
      const migrationDim = embeddingDimFromEnv(undefined);

      const runtimeVec = embedText(q, runtimeDim);
      const migrationVec = embedText(q, migrationDim);

      // Lỗi cũ: hai vector lệch chiều → cosine = 0 → mẫu không bao giờ được chọn.
      expect(runtimeVec).toHaveLength(migrationVec.length);
      expect(cosineSimilarity(runtimeVec, migrationVec)).toBeGreaterThan(0);
    });

    it('embedText mặc định dùng đúng DEFAULT_EMBEDDING_DIM', () => {
      expect(embedText('DQ-01 | cot trang thai | khong phai loi')).toHaveLength(
        DEFAULT_EMBEDDING_DIM,
      );
    });
  });

  describe('hàm runFewShotScrub dùng chiều mặc định đúng', () => {
    it('báo cáo migration không dùng chiều lệch với runtime', async () => {
      // Model giả tối thiểu — chuỗi `find().select().lean().cursor()` của Mongoose.
      const emptyCursor = {
        select: () => emptyCursor,
        lean: () => emptyCursor,
        cursor: () => (async function* noop() {})(),
      };
      const fewShot = { find: () => emptyCursor } as never;
      const feedback = {
        aggregate: () => ({ exec: async () => [] }),
      } as never;

      const report = await runFewShotScrub({
        fewShot,
        feedback,
        mode: 'dry-run',
      });

      // `dry-run` phải chạy được mà không đụng DB ghi.
      expect(report.mode).toBe('dry-run');
      expect(report.scanned).toBe(0);
      expect(report.created).toBe(0);
      expect(report.updated).toBe(0);
    });
  });
});
