import { Inject, Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectListQuery,
  type ProjectRecord,
  type ProjectRepositoryPort,
  type ProjectStatus,
} from '../domain/ports/project.repository.port';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../workspaces/domain/ports/workspace.repository.port';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../users/domain/ports/user.repository.port';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';

export interface CreateProjectInput { name: string; description?: string }
export interface UpdateProjectInput { name?: string; description?: string }
export interface AddProjectMemberInput { email: string; role?: 'member' | 'viewer' }
export interface UpdateProjectMemberInput { role: 'member' | 'viewer' }
export interface TransferProjectOwnerInput { email: string }

/**
 * PROJECTS — Application orchestrator.
 * Chỉ phụ thuộc domain ports (PROJECT / WORKSPACE / USER), không import infrastructure/schema/mongoose.
 * Trả về ProjectRecord (camelCase, id string). Controller là nơi map ra HTTP response.
 */
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY_PORT) private readonly projects: ProjectRepositoryPort,
    @Inject(WORKSPACE_REPOSITORY_PORT) private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort,
  ) {}

  async createProject(workspaceId: string, userId: string, dto: CreateProjectInput): Promise<ProjectRecord> {
    const ws = await this.workspaces.findById(workspaceId);
    if (!ws) throw new NotFoundException('Không tìm thấy không gian làm việc');
    const dup = await this.projects.findOneByWorkspaceAndName(workspaceId, dto.name.trim());
    if (dup) throw new ConflictException('Tên project đã tồn tại trong workspace');
    const project = await this.projects.create({
      workspaceId,
      name: dto.name.trim(),
      description: dto.description ?? '',
      createdBy: userId,
    });
    this.logger.log(`Tạo Project mới: ${project.name} (ID: ${project.id}) trong Workspace: ${workspaceId}`);
    return project;
  }

  async getProjectsByWorkspace(workspaceId: string): Promise<ProjectRecord[]> {
    const ws = await this.workspaces.findById(workspaceId);
    if (!ws) throw new NotFoundException('Không tìm thấy không gian làm việc');
    return this.projects.findByWorkspace(workspaceId);
  }

  async listProjectsByWorkspace(workspaceId: string, q: ProjectListQuery) {
    const ws = await this.workspaces.findById(workspaceId);
    if (!ws) throw new NotFoundException('Không tìm thấy không gian làm việc');
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 15));
    const { items, total } = await this.projects.findByWorkspacePaged(workspaceId, q);
    return { items, total, page, limit };
  }

  async getProjectById(id: string, touch = false): Promise<ProjectRecord> {
    if (!isObjectIdHex(id)) throw new BadRequestException('ID Dự án không hợp lệ');
    const project = await this.projects.findById(id);
    if (!project) throw new NotFoundException('Không tìm thấy dự án hoặc dự án đã bị xóa');
    if (touch) await this.projects.touchLastAccessed(id).catch(() => undefined);
    return project;
  }

  async updateProject(id: string, dto: UpdateProjectInput): Promise<ProjectRecord> {
    const existing = await this.getProjectById(id);
    if (dto.name && dto.name.trim() !== existing.name) {
      const dup = await this.projects.findOneByWorkspaceAndName(existing.workspaceId, dto.name.trim());
      if (dup && dup.id !== id) throw new ConflictException('Tên project đã tồn tại trong workspace');
    }
    const updated = await this.projects.updateById(id, dto);
    if (!updated) throw new NotFoundException('Không tìm thấy dự án để cập nhật');
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    await this.getProjectById(id);
    const deleted = await this.projects.softDelete(id);
    this.logger.log(`Đã xóa mềm Project ID: ${id}`);
    return deleted;
  }

  async setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean> {
    const p = await this.getProjectById(projectId);
    const ok = await this.projects.setHasDataset(projectId, hasDataset);
    if (hasDataset && p.status === 'not_started') await this.projects.setStatus(projectId, 'in_progress');
    if (!hasDataset && p.status !== 'not_started') await this.projects.setStatus(projectId, 'not_started');
    return ok;
  }

  async markCompleted(projectId: string): Promise<boolean> {
    const p = await this.getProjectById(projectId);
    if (p.status !== 'in_progress') throw new BadRequestException('Chỉ project in_progress mới được lưu hoàn tất (completed)');
    return this.projects.setStatus(projectId, 'completed');
  }

  async resolveUserProjectRole(projectId: string, userId: string, workspaceRole?: 'owner' | 'member' | null): Promise<'owner' | 'member' | 'viewer' | null> {
    if (!isObjectIdHex(projectId)) return null;
    const p = await this.projects.findById(projectId);
    if (!p) return null;
    const m = (p.members || []).find((x) => x.userId === userId);
    if (m) return m.role as 'owner' | 'member' | 'viewer';
    if (workspaceRole === 'member') return 'viewer';
    if (workspaceRole === 'owner') return 'owner';
    return null;
  }

  async addProjectMember(projectId: string, dto: AddProjectMemberInput): Promise<ProjectRecord> {
    const p = await this.getProjectById(projectId);
    const target = await this.users.findByEmail(dto.email.trim().toLowerCase());
    if (!target) throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    if ((p.members || []).some((m) => m.userId === target.id)) throw new ConflictException('Người dùng đã là thành viên project');
    await this.projects.addMember(projectId, { userId: target.id, role: dto.role ?? 'viewer' });
    return this.getProjectById(projectId);
  }

  async updateProjectMemberRole(projectId: string, memberUserId: string, dto: UpdateProjectMemberInput): Promise<ProjectRecord> {
    const p = await this.getProjectById(projectId);
    const m = (p.members || []).find((x) => x.userId === memberUserId);
    if (!m) throw new NotFoundException('Người dùng không thuộc project này');
    if (m.role === 'owner') throw new BadRequestException('Không đổi vai trò Owner tại đây — dùng nhượng quyền (PROJ-11)');
    await this.projects.updateMemberRole(projectId, memberUserId, dto.role);
    return this.getProjectById(projectId);
  }

  async removeProjectMember(projectId: string, memberUserId: string): Promise<ProjectRecord> {
    const p = await this.getProjectById(projectId);
    const m = (p.members || []).find((x) => x.userId === memberUserId);
    if (!m) throw new NotFoundException('Người dùng không thuộc project này');
    if (m.role === 'owner') throw new BadRequestException('Không thể xóa Project Owner — hãy nhượng quyền trước (PROJ-11)');
    await this.projects.removeMember(projectId, memberUserId);
    return this.getProjectById(projectId);
  }

  async transferProjectOwner(projectId: string, actorUserId: string, dto: TransferProjectOwnerInput): Promise<ProjectRecord> {
    const p = await this.getProjectById(projectId);
    const owner = (p.members || []).find((m) => m.role === 'owner');
    if (!owner || owner.userId !== actorUserId) throw new ForbiddenException('Chỉ Project Owner mới được nhượng quyền');
    const target = await this.users.findByEmail(dto.email.trim().toLowerCase());
    if (!target) throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    if (target.id === actorUserId) throw new BadRequestException('Không thể nhượng cho chính mình');
    const isMember = (p.members || []).some((m) => m.userId === target.id);
    if (!isMember) throw new BadRequestException('Chỉ nhượng cho thành viên project');
    const ok = await this.projects.transferOwner(projectId, target.id);
    if (!ok) throw new NotFoundException('Nhượng quyền thất bại');
    this.logger.log(`PROJ-11 transfer owner ${projectId}: ${actorUserId} -> ${target.id}`);
    return this.getProjectById(projectId);
  }
}
