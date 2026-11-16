/**
 * CreateProjectHandler — Use case: `createProject()`
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
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRecord,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../../../workspaces';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { CreateProjectInput } from '../projects.types';

@Injectable()
export class CreateProjectHandler {
  private readonly logger = new Logger(CreateProjectHandler.name);
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(
    workspaceId: string,
    userId: string,
    dto: CreateProjectInput,
  ): Promise<ProjectRecord> {
    const ws = await this.workspaces.findById(workspaceId);
    if (!ws) throw new NotFoundException('Không tìm thấy không gian làm việc');
    const dup = await this.projects.findOneByWorkspaceAndName(workspaceId, dto.name.trim());
    if (dup) throw new ConflictException('Tên project đã tồn tại trong workspace');

    // F1/F2 — Nếu chỉ định Project Owner thì phải là thành viên của workspace.
    let ownerId = userId;
    if (dto.owner_id && dto.owner_id !== userId) {
      const isWorkspaceMember =
        ws.ownerId === dto.owner_id || ws.members.some((m) => m.userId === dto.owner_id);
      if (!isWorkspaceMember) {
        throw new BadRequestException({
          message:
            'owner_id không hợp lệ — Project Owner phải là thành viên của không gian làm việc',
          error: 'VALIDATION_ERROR',
        } as never);
      }
      const ownerUser = await this.users.findById(dto.owner_id);
      if (!ownerUser) {
        throw new BadRequestException({
          message: 'owner_id không tồn tại trong hệ thống',
          error: 'VALIDATION_ERROR',
        } as never);
      }
      ownerId = dto.owner_id;
    }

    const project = await this.projects.create({
      workspaceId,
      name: dto.name.trim(),
      description: dto.description ?? '',
      createdBy: userId,
      ownerId,
    });
    this.logger.log(
      `Tạo Project mới: ${project.name} (ID: ${project.id}) trong Workspace: ${workspaceId} — owner=${ownerId}`,
    );
    return project;
  }
}
