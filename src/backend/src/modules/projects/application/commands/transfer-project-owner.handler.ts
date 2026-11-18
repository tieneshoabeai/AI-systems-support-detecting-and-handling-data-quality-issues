/**
 * TransferProjectOwnerHandler — Use case: `transferProjectOwner()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** toàn bộ quy tắc nhượng quyền nằm trong
 * entity `Project.transferOwnershipTo()`:
 *   - Chỉ Owner hiện tại được nhượng → `ForbiddenError`.
 *   - Không nhượng cho chính mình → `ValidationError`.
 *   - Mục tiêu phải là thành viên → `ValidationError`.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import type { Project } from '../../domain/entities/project.entity';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { TransferProjectOwnerInput } from '../projects.types';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';
import { ConflictError, NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class TransferProjectOwnerHandler {
  private readonly logger = new Logger(TransferProjectOwnerHandler.name);
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(
    projectId: string,
    actorUserId: string,
    dto: TransferProjectOwnerInput,
  ): Promise<Project> {
    const project = await this.getProjectByIdHandler.execute(projectId);
    const target = await this.users.findByEmail(dto.email.trim().toLowerCase());
    if (!target) throw new NotFoundError(`Không tìm thấy người dùng với email: ${dto.email}`);

    // Entity tự kiểm tra invariant → ném ForbiddenError / ValidationError.
    project.transferOwnershipTo(actorUserId, target.id);

    const ok = await this.projects.transferOwner(projectId, target.id, dto.expectedVersion);
    if (ok === null) {
      const actual = (await this.getProjectByIdHandler.execute(projectId)).version;
      throw new ConflictError(
        'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
        { expectedVersion: dto.expectedVersion, actualVersion: actual },
      );
    }
    if (!ok) throw new NotFoundError('Nhượng quyền thất bại');
    this.logger.log(`PROJ-11 transfer owner ${projectId}: ${actorUserId} -> ${target.id}`);
    return this.getProjectByIdHandler.execute(projectId);
  }
}
