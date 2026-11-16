/**
 * TransferOwnerHandler — Use case: `transferOwner()`
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
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { Workspace } from '../../domain/entities/workspace.entity';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { TransferWorkspaceOwnerInput } from '../workspaces.types';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

@Injectable()
export class TransferOwnerHandler {
  private readonly logger = new Logger(TransferOwnerHandler.name);
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(
    workspaceId: string,
    actorUserId: string,
    dto: TransferWorkspaceOwnerInput,
  ): Promise<WorkspaceRecord> {
    const workspace = await this.getWorkspaceByIdHandler.execute(workspaceId);
    const targetUser = await this.users.findByEmail(dto.email);
    if (!targetUser)
      throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    const targetId = targetUser.id;
    try {
      Workspace.create({
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        members: workspace.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      }).assertCanTransfer(actorUserId, targetId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (
        message.includes('nhượng quyền') ||
        message.includes('chính mình') ||
        message.includes('thành viên')
      ) {
        if (message.includes('Owner')) throw new ForbiddenException(message);
        throw new BadRequestException(message);
      }
      throw e;
    }
    const ok = await this.workspaces.transferOwner(workspaceId, targetId, dto.expectedVersion);
    if (ok === null) {
      const actual = (await this.getWorkspaceByIdHandler.execute(workspaceId)).version;
      throw new ConflictException({
        message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
        error: 'CONFLICT',
        details: { expectedVersion: dto.expectedVersion, actualVersion: actual },
      } as never);
    }
    if (!ok) throw new NotFoundException('Nhượng quyền thất bại');
    this.logger.log(`WS-09 transfer owner ${workspaceId}: ${actorUserId} -> ${targetId}`);
    return this.getWorkspaceByIdHandler.execute(workspaceId);
  }
}
