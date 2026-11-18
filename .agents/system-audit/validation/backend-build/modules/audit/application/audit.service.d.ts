import { type AuditChangeInput, type AuditRepositoryPort, type CreateAuditLogInput } from '../domain/ports/audit.repository.port';
export declare class AuditService {
    private readonly repo;
    private readonly logger;
    constructor(repo: AuditRepositoryPort);
    log(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void>;
}
