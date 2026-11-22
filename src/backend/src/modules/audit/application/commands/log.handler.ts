/**
 * LogHandler — Use case: `log()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AUDIT_REPOSITORY_PORT,
  type AuditChangeInput,
  type AuditRepositoryPort,
  type CreateAuditLogInput,
} from '../../domain/ports/audit.repository.port';

@Injectable()
export class LogHandler {
  private readonly logger = new Logger(LogHandler.name);
  constructor(
    @Inject(AUDIT_REPOSITORY_PORT)
    private readonly repo: AuditRepositoryPort,
  ) {}

  /**
   * Ghi audit log.
   *
   * **OPEN-09 — audit log là BEST-EFFORT (khác outbox).** Lý do:
   * 1. Audit log được ghi ở **tầng controller**, *sau khi* mutation đã commit
   *    ⇒ không thể rollback thao tác chính (nó đã xảy ra).
   * 2. Nếu ghi audit thất bại ⇒ báo lỗi cho người dùng sẽ gây hiểu nhầm
   *    ("thao tác thất bại" trong khi thực tế đã thành công).
   *
   * Đây là quyết định **cố ý**, khác với outbox: outbox là *điều kiện cần* cho
   * tính đúng của nghiệp vụ (cascade xoá), còn audit log chỉ là *hậu kiểm*.
   *
   * Lỗi vẫn được log lại để cảnh báo vận hành.
   */
  async execute(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void> {
    try {
      await this.repo.createLog(input, changes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Ghi audit log that bai (best-effort): ${msg}`);
    }
  }
}
