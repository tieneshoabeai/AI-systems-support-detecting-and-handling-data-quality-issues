/**
 * Chiều vector đặc trưng cho RAG few-shot — **nguồn sự thật duy nhất**.
 *
 * Vì sao cần hằng số riêng (OPEN-FB-02):
 *
 * Trước đây giá trị chiều nằm rải rác ở 4 nơi với 3 mặc định khác nhau:
 *   1. `shared/infrastructure/config/env.validation.ts` → schema `default(1024)`
 *   2. `modules/analysis/application/services/rag-few-shot.service.ts` → `?? 64`
 *   3. `modules/analysis/domain/rag-few-shot.util.ts` (`embedText`) → `dim = 64`
 *   4. `scripts/lib/few-shot-scrub.ts` (`embeddingDimFromEnv`) → `?? 64`
 *
 * Vì `ConfigModule` chạy `validate`, biến `EMBEDDING_DIM` **luôn** tồn tại ở
 * runtime → nhánh `?? 64` ở (2) là fallback **chết**. Nhưng script migration
 * đọc thẳng `process.env` → khi `.env` không khai báo, (4) rơi về 64.
 *
 * Hệ quả: mẫu do migration ghi ra có 64 chiều, còn runtime truy vấn bằng
 * vector 1024 chiều → `cosineSimilarity` lệch chiều → trả `0` → **mọi mẫu
 * RAG do migration tạo ra không bao giờ được chọn**.
 *
 * Giờ đây: mọi nơi (runtime, migration, test) đều lấy từ hằng số này.
 *
 * Lưu ý: `embedText` là **hàm hash nội bộ** (FNV-1a), KHÔNG gọi model
 * embedding nào — nên `EMBEDDING_MODEL` là biến chết, không ảnh hưởng gì.
 * Chiều ở đây chỉ là số phần tử của vector đặc trưng; giá trị hợp lý cho
 * hash feature là 64–256 (1024 chỉ tốn RAM mà không tăng chất lượng xếp hạng).
 *
 * Thuần TypeScript — không phụ thuộc framework (được phép dùng bởi tầng
 * `domain` theo quy tắc CA11).
 */

/**
 * Số chiều vector đặc trưng cho RAG few-shot.
 *
 * Dùng chung cho runtime (`RagFewShotService`), script migration
 * (`db:migrate:scrub-few-shot`) và test — để ba nơi **không thể** lệch nhau.
 */
export const DEFAULT_EMBEDDING_DIM = 64;

/** Trần trên của `EMBEDDING_DIM` — chặn cấp hình sai (vector quá lớn). */
export const MAX_EMBEDDING_DIM = 4096;

/**
 * Chuẩn hoá một giá trị chiều bất kỳ về số chiều hợp lệ.
 *
 * Dùng chung để runtime và migration **luôn** ép theo cùng một quy tắc —
 * tránh trường hợp một bên `Math.floor`, bên kia không.
 */
export function normalizeEmbeddingDim(dim: unknown): number {
  const n = typeof dim === 'number' ? dim : Number(dim);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_EMBEDDING_DIM;
  return Math.min(Math.floor(n), MAX_EMBEDDING_DIM);
}
