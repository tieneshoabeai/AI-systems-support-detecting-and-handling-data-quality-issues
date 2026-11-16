/**
 * TransferProjectOwnerHandler — Use case: `transferProjectOwner()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { TransferProjectOwnerInput } from '../projects.types';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';

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
  ): Promise<ProjectRecord> {
    const p = await this.getProjectByIdHandler.execute(projectId);
    const owner = (p.members || []).find((m) => m.role === 'owner');
    if (!owner || owner.userId !== actorUserId)
      throw new ForbiddenException('Chỉ Project Owner mới được nhượng quyền');
    const target = await this.users.findByEmail(dto.email.trim().toLowerCase());
    if (!target) throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    if (target.id === actorUserId) throw new BadRequestException('Không thể nhượng cho chính mình');
    const isMember = (p.members || []).some((m) => m.userId === target.id);
    if (!isMember) throw new BadRequestException('Chỉ nhượng cho thành viên project');
    const ok = await this.projects.transferOwner(projectId, target.id, dto.expectedVersion);
    if (ok === null) {
      const actual = (await this.getProjectByIdHandler.execute(projectId)).version;
      throw new ConflictException({
        message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
        error: 'CONFLICT',
        details: { expectedVersion: dto.expectedVersion, actualVersion: actual },
      } as never);
    }
    if (!ok) throw new NotFoundException('Nhượng quyền thất bại');
    this.logger.log(`PROJ-11 transfer owner ${projectId}: ${actorUserId} -> ${target.id}`);
    return this.getProjectByIdHandler.execute(projectId);
  }
}
