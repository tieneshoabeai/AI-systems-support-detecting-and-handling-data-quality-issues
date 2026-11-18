/**
 * TransferOwnerHandler — Use case: `transferOwner()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trước đây handler phải **đoán** lỗi bằng
 * cách bắt `Error` rồi dò chuỗi message (`message.includes('nhượng quyền')`).
 * Nay entity tự ném `ForbiddenError` / `ValidationError` với mã lỗi ổn định —
 * không còn phụ thuộc vào nội dung message tiếng Việt.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import type { Workspace } from '../../domain/entities/workspace.entity';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { TransferWorkspaceOwnerInput } from '../workspaces.types';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';
import { ConflictError, NotFoundError } from '../../../../shared/domain/errors';

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
  ): Promise<Workspace> {
    const workspace = await this.getWorkspaceByIdHandler.execute(workspaceId);
    const targetUser = await this.users.findByEmail(dto.email);
    if (!targetUser)
      throw new NotFoundError(`Không tìm thấy người dùng với email: ${dto.email}`);
    const targetId = targetUser.id;

    // Entity tự kiểm tra invariant → ném ForbiddenError / ValidationError.
    workspace.transferOwnershipTo(actorUserId, targetId);

    const ok = await this.workspaces.transferOwner(workspaceId, targetId, dto.expectedVersion);
    if (ok === null) {
      const actual = (await this.getWorkspaceByIdHandler.execute(workspaceId)).version;
      throw new ConflictError(
        'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
        { expectedVersion: dto.expectedVersion, actualVersion: actual },
      );
    }
    if (!ok) throw new NotFoundError('Nhượng quyền thất bại');
    this.logger.log(`WS-09 transfer owner ${workspaceId}: ${actorUserId} -> ${targetId}`);
    return this.getWorkspaceByIdHandler.execute(workspaceId);
  }
}
