import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceListQuery,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../domain/ports/workspace.repository.port';
import { Workspace } from '../domain/entities/workspace.entity';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../users/domain/ports/user.repository.port';
import type { CurrentUser } from '../../../shared/casl/casl-ability.factory';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';

export interface CreateWorkspaceInput { name: string; description?: string }
export interface UpdateWorkspaceInput { name?: string; description?: string }
export interface AddWorkspaceMemberInput { email: string; role?: 'owner' | 'member' }
export interface TransferWorkspaceOwnerInput { email: string }

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async createWorkspace(userId: string, dto: CreateWorkspaceInput): Promise<WorkspaceRecord> {
    const workspace = await this.workspaces.create({
      name: dto.name,
      description: dto.description ?? '',
      ownerId: userId,
    });
    this.logger.log(`Tạo Workspace mới: ${workspace.name} (ID: ${workspace.id}) bởi User: ${userId}`);
    return workspace;
  }

  async getWorkspaces(user: CurrentUser): Promise<WorkspaceRecord[]> {
    if (user.role === 'admin') return this.workspaces.findAllActive();
    return this.workspaces.findByUser(user.userId);
  }

  async listWorkspaces(user: CurrentUser, q: WorkspaceListQuery): Promise<{ items: WorkspaceRecord[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 15));
    if (user.role === 'admin') {
      const all = await this.workspaces.findAllActive();
      let items = all;
      if (q.search?.trim()) {
        const s = q.search.trim().toLowerCase();
        items = items.filter((w) => w.name.toLowerCase().includes(s));
      }
      if (q.role === 'owner') items = items.filter((w) => w.ownerId === user.userId);
      if (q.role === 'member') items = items.filter((w) => w.ownerId !== user.userId);
      const sort = q.sort || 'last_accessed';
      items = [...items].sort((a, b) => {
        if (sort === 'name_asc') return a.name.localeCompare(b.name);
        if (sort === 'name_desc') return b.name.localeCompare(a.name);
        const av = sort === 'updated' ? a.updatedAt?.getTime() ?? 0 : (a.lastAccessedAt?.getTime() ?? a.updatedAt?.getTime() ?? 0);
        const bv = sort === 'updated' ? b.updatedAt?.getTime() ?? 0 : (b.lastAccessedAt?.getTime() ?? b.updatedAt?.getTime() ?? 0);
        return bv - av;
      });
      const total = items.length;
      return { items: items.slice((page - 1) * limit, page * limit), total, page, limit };
    }
    const { items, total } = await this.workspaces.findByUserPaged(user.userId, q);
    return { items, total, page, limit };
  }

  async getWorkspaceById(id: string, touch = false): Promise<WorkspaceRecord> {
    if (!isObjectIdHex(id)) throw new BadRequestException('ID Không gian làm việc không hợp lệ');
    const workspace = await this.workspaces.findById(id);
    if (!workspace) throw new NotFoundException('Không tìm thấy không gian làm việc hoặc đã bị xóa');
    if (touch) await this.workspaces.touchLastAccessed(id).catch(() => undefined);
    return workspace;
  }

  async updateWorkspace(id: string, dto: UpdateWorkspaceInput): Promise<WorkspaceRecord> {
    await this.getWorkspaceById(id);
    const updated = await this.workspaces.updateById(id, dto);
    if (!updated) throw new NotFoundException('Không tìm thấy không gian làm việc để cập nhật');
    return updated;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    await this.getWorkspaceById(id);
    const deleted = await this.workspaces.softDelete(id);
    this.logger.log(`Đã xóa mềm Workspace ID: ${id}`);
    return deleted;
  }

  async addMember(workspaceId: string, dto: AddWorkspaceMemberInput): Promise<WorkspaceRecord> {
    const workspace = await this.getWorkspaceById(workspaceId);
    const targetUser = await this.users.findByEmail(dto.email);
    if (!targetUser) throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    const targetUserIdStr = targetUser.id;
    if (workspace.members.some((m) => m.userId === targetUserIdStr)) {
      throw new ConflictException('Người dùng này đã là thành viên của không gian làm việc');
    }
    await this.workspaces.addMember(workspaceId, { userId: targetUserIdStr, role: dto.role ?? 'member', joinedAt: new Date() });
    return this.getWorkspaceById(workspaceId);
  }

  async removeMember(workspaceId: string, memberUserId: string): Promise<WorkspaceRecord> {
    const workspace = await this.getWorkspaceById(workspaceId);
    if (workspace.ownerId === memberUserId) {
      throw new BadRequestException('Không thể xóa chủ sở hữu chính của không gian làm việc');
    }
    if (!workspace.members.some((m) => m.userId === memberUserId)) {
      throw new NotFoundException('Người dùng không thuộc danh sách thành viên của không gian này');
    }
    await this.workspaces.removeMember(workspaceId, memberUserId);
    return this.getWorkspaceById(workspaceId);
  }

  async transferOwner(workspaceId: string, actorUserId: string, dto: TransferWorkspaceOwnerInput): Promise<WorkspaceRecord> {
    const workspace = await this.getWorkspaceById(workspaceId);
    const targetUser = await this.users.findByEmail(dto.email);
    if (!targetUser) throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    const targetId = targetUser.id;
    try {
      Workspace.create({
        id: workspace.id, name: workspace.name, ownerId: workspace.ownerId,
        members: workspace.members.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt })),
      }).assertCanTransfer(actorUserId, targetId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('nhượng quyền') || message.includes('chính mình') || message.includes('thành viên')) {
        if (message.includes('Owner')) throw new ForbiddenException(message);
        throw new BadRequestException(message);
      }
      throw e;
    }
    const ok = await this.workspaces.transferOwner(workspaceId, targetId);
    if (!ok) throw new NotFoundException('Nhượng quyền thất bại');
    this.logger.log(`WS-09 transfer owner ${workspaceId}: ${actorUserId} -> ${targetId}`);
    return this.getWorkspaceById(workspaceId);
  }

  async leaveWorkspace(workspaceId: string, userId: string): Promise<{ left: boolean }> {
    const workspace = await this.getWorkspaceById(workspaceId);
    if (workspace.ownerId === userId) throw new BadRequestException('Workspace Owner phải nhượng quyền trước khi rời (WS-09)');
    if (!workspace.members.some((m) => m.userId === userId)) throw new NotFoundException('Bạn không phải thành viên workspace này');
    await this.workspaces.removeMember(workspaceId, userId);
    return { left: true };
  }

  async incrementStorageUsed(workspaceId: string, deltaBytes: number): Promise<void> {
    await this.workspaces.addStorageUsed(workspaceId, deltaBytes).catch(() => undefined);
  }

  async checkWorkspaceUploadQuota(workspaceId: string, incomingBytes: number, quotaBytes: number): Promise<void> {
    const ws = await this.getWorkspaceById(workspaceId);
    const used = ws.storageUsedBytes ?? 0;
    if (used + incomingBytes > quotaBytes) {
      throw new PayloadTooLargeException(`Vượt quota workspace (O24): đã dùng ${used}B + thêm ${incomingBytes}B > giới hạn ${quotaBytes}B`);
    }
  }

  async resolveUserWorkspaceRole(workspaceId: string, userId: string): Promise<'owner' | 'member' | null> {
    if (!isObjectIdHex(workspaceId)) return null;
    const workspace = await this.workspaces.findById(workspaceId);
    if (!workspace) return null;
    if (workspace.ownerId === userId) return 'owner';
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) return null;
    if ((member.role as string) === 'editor' || (member.role as string) === 'viewer') return 'member';
    return member.role as 'owner' | 'member';
  }
}
