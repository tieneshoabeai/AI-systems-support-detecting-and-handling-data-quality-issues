import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../../projects/application/projects.service';
import { WorkspacesService } from '../../workspaces/application/workspaces.service';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';

export type ProjectAccessMode = 'read' | 'write';
export type ProjectRole = 'owner' | 'member' | 'viewer';

export interface ProjectActor {
  userId: string;
  role?: string;
}

/**
 * Phan 6 v7 muc 3.20–3.21 — kiem vai tro cua nguoi goi trong project cho route analysis/summary/report.
 * - Ngoai project -> 404 (khong lo su ton tai cua tai nguyen).
 * - `write` doi hoi PROJ-MEMBER+; Viewer -> 403.
 * - SYS-ADMIN (`role === 'admin'`) bo qua kiem tra.
 * PoliciesGuard chi kiem tinh subject `Analysis`, khong biet project cu the -> kiem o day.
 */
@Injectable()
export class ProjectAccessService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async assertProjectAccess(
    projectId: string,
    actor: ProjectActor | null | undefined,
    mode: ProjectAccessMode,
    notFoundMessage = 'Không tìm thấy dự án hoặc dự án đã bị xóa',
  ): Promise<ProjectRole | 'admin'> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    if (actor?.role === 'admin') return 'admin';
    if (!actor?.userId) throw new NotFoundException(notFoundMessage);
    const project = await this.projectsService.getProjectById(projectId).catch(() => null);
    if (!project) throw new NotFoundException(notFoundMessage);
    const wsRole = await this.workspacesService.resolveUserWorkspaceRole(String(project.workspaceId), actor.userId);
    const role = await this.projectsService.resolveUserProjectRole(projectId, actor.userId, wsRole);
    if (!role) throw new NotFoundException(notFoundMessage);
    if (mode === 'write' && role === 'viewer') {
      throw new ForbiddenException('Viewer chỉ được xem — không được chạy phân tích, đổi cấu hình, tạo Tổng kết hoặc thử lại AI');
    }
    return role;
  }
}
