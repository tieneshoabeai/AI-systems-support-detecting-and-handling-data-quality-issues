/**
 * UpdateProjectMemberRoleHandler — Use case: `updateProjectMemberRole()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRecord,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { UpdateProjectMemberInput } from '../projects.types';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

@Injectable()
export class UpdateProjectMemberRoleHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(
    projectId: string,
    memberUserId: string,
    dto: UpdateProjectMemberInput,
  ): Promise<ProjectRecord> {
    const p = await this.getProjectByIdHandler.execute(projectId);
    const m = (p.members || []).find((x) => x.userId === memberUserId);
    if (!m) throw new NotFoundException('Người dùng không thuộc project này');
    if (m.role === 'owner')
      throw new BadRequestException(
        'Không đổi vai trò Owner tại đây — dùng nhượng quyền (PROJ-11)',
      );
    const okRole = await this.projects.updateMemberRole(
      projectId,
      memberUserId,
      dto.role,
      dto.expectedVersion,
    );
    if (okRole === null) {
      const actual = (await this.getProjectByIdHandler.execute(projectId)).version;
      throw new ConflictException({
        message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
        error: 'CONFLICT',
        details: { expectedVersion: dto.expectedVersion, actualVersion: actual },
      } as never);
    }
    return this.getProjectByIdHandler.execute(projectId);
  }
}
