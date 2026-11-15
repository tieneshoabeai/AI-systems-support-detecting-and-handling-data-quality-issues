import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AUDIT_REPOSITORY_PORT,
  type AuditChangeInput,
  type AuditRepositoryPort,
  type CreateAuditLogInput,
} from '../domain/ports/audit.repository.port';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(
    @Inject(AUDIT_REPOSITORY_PORT)
    private readonly repo: AuditRepositoryPort,
  ) {}

  async log(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void> {
    try {
      await this.repo.createLog(input, changes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Ghi audit log that bai (best-effort): ${msg}`);
    }
  }
}
