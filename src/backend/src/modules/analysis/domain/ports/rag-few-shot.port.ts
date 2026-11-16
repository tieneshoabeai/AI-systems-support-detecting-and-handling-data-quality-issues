/**
 * ANALYSIS — Facade port (driving port) cho cơ chế RAG few-shot.
 *
 * Vì sao cần (L3a — quy tắc R2):
 * Module `feedback` KHÔNG được import trực tiếp `RagFewShotService`
 * (application service của module `analysis`). Module `analysis` **sở hữu**
 * hợp đồng này, export qua `modules/analysis/index.ts` (public contract — L4/R6)
 * và bind token tới `RagFewShotService` trong `AnalysisModule`.
 *
 * Hợp đồng chỉ gồm các hàm thuần/cục bộ mà `feedback` thực sự cần:
 *   - `embedQueryText`  : vector hoá văn bản truy vấn (cục bộ, deterministic).
 *   - `buildQueryText`   : ghép chuỗi truy vấn chuẩn.
 *   - `buildFewShotBlockFromText` : dựng khối "Các trường hợp đã biết" cho prompt.
 */
export const RAG_FEW_SHOT_PORT = Symbol('RagFewShotPort');

export interface RagFewShotPort {
  /** Vector hoá văn bản truy vấn (embedding cục bộ, không gọi API ngoài). */
  embedQueryText(text: string): number[];
  /** Ghép chuỗi truy vấn chuẩn dùng để tìm mẫu tương tự. */
  buildQueryText(errorType: string, columnTraits: string, description: string): string;
  /** Dựng khối few-shot từ văn bản (rỗng nếu RAG bị tắt). */
  buildFewShotBlockFromText(params: {
    workspaceId: string;
    queryText: string;
    errorType?: string;
    language?: string;
  }): Promise<string>;
}
