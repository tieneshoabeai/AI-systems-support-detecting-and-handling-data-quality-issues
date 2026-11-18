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

  async execute(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void> {
    try {
      await this.repo.createLog(input, changes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Ghi audit log that bai (best-effort): ${msg}`);
    }
  }
}
