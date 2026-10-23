import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { WorkspacesRepository } from './workspaces.repository';
import { UsersService } from '../users/users.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { IWorkspace } from './schemas/workspace.schema';
import { CurrentUser } from '../../shared/casl/casl-ability.factory';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly usersService: UsersService
  ) {}

  async createWorkspace(userId: string, dto: CreateWorkspaceDto): Promise<IWorkspace> {
    const userObjectId = new Types.ObjectId(userId);
    const workspace = await this.workspacesRepository.create({
      name: dto.name,
      description: dto.description ?? '',
      owner_id: userObjectId,
      members: [
        {
          user_id: userObjectId,
          role: 'owner',
          joined_at: new Date(),
        },
      ],
    } as Partial<IWorkspace>);

    this.logger.log(`Tạo Workspace mới: ${workspace.name} (ID: ${workspace._id.toString()}) bởi User: ${userId}`);
    return workspace;
  }

  async getWorkspaces(user: CurrentUser): Promise<IWorkspace[]> {
    if (user.role === 'admin') {
      return this.workspacesRepository.findAllActive();
    }
    return this.workspacesRepository.findByUser(user.userId);
  }

  async getWorkspaceById(id: string): Promise<IWorkspace> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID Không gian làm việc không hợp lệ');
    }
    const workspace = await this.workspacesRepository.findById(id);
    if (!workspace) {
      throw new NotFoundException('Không tìm thấy không gian làm việc hoặc đã bị xóa');
    }
    return workspace;
  }

  async updateWorkspace(id: string, dto: UpdateWorkspaceDto): Promise<IWorkspace> {
    await this.getWorkspaceById(id);
    const updated = await this.workspacesRepository.updateById(id, { $set: dto });
    if (!updated) {
      throw new NotFoundException('Không tìm thấy không gian làm việc để cập nhật');
    }
    return updated;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    await this.getWorkspaceById(id);
    const deleted = await this.workspacesRepository.softDelete(id);
    this.logger.log(`Đã xóa mềm Workspace ID: ${id}`);
    return deleted;
  }

  async addMember(workspaceId: string, dto: AddMemberDto): Promise<IWorkspace> {
    const workspace = await this.getWorkspaceById(workspaceId);

    const targetUser = await this.usersService.findByEmail(dto.email);
    if (!targetUser) {
      throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    }

    const targetUserIdStr = targetUser._id.toString();
    const isAlreadyMember = workspace.members.some(
      (m) => m.user_id.toString() === targetUserIdStr
    );

    if (isAlreadyMember) {
      throw new ConflictException('Người dùng này đã là thành viên của không gian làm việc');
    }

    await this.workspacesRepository.addMember(workspaceId, {
      user_id: targetUser._id,
      role: dto.role,
      joined_at: new Date(),
    });

    return this.getWorkspaceById(workspaceId);
  }

  async removeMember(workspaceId: string, memberUserId: string): Promise<IWorkspace> {
    const workspace = await this.getWorkspaceById(workspaceId);

    if (workspace.owner_id.toString() === memberUserId) {
      throw new BadRequestException('Không thể xóa chủ sở hữu chính của không gian làm việc');
    }

    const isMember = workspace.members.some((m) => m.user_id.toString() === memberUserId);
    if (!isMember) {
      throw new NotFoundException('Người dùng không thuộc danh sách thành viên của không gian này');
    }

    await this.workspacesRepository.removeMember(workspaceId, memberUserId);
    return this.getWorkspaceById(workspaceId);
  }

  async resolveUserWorkspaceRole(
    workspaceId: string,
    userId: string
  ): Promise<'owner' | 'editor' | 'viewer' | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    const workspace = await this.workspacesRepository.findById(workspaceId);
    if (!workspace) return null;

    if (workspace.owner_id.toString() === userId) {
      return 'owner';
    }

    const member = workspace.members.find((m) => m.user_id.toString() === userId);
    return member?.role ?? null;
  }
}
