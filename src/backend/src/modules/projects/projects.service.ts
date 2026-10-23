import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ProjectsRepository } from './projects.repository';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { IProject } from './schemas/project.schema';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly workspacesService: WorkspacesService
  ) {}

  async createProject(
    workspaceId: string,
    userId: string,
    dto: CreateProjectDto
  ): Promise<IProject> {
    await this.workspacesService.getWorkspaceById(workspaceId);

    const project = await this.projectsRepository.create({
      workspace_id: new Types.ObjectId(workspaceId),
      name: dto.name,
      description: dto.description ?? '',
      has_dataset: false,
      created_by: new Types.ObjectId(userId),
    } as Partial<IProject>);

    this.logger.log(
      `Tạo Project mới: ${project.name} (ID: ${project._id.toString()}) trong Workspace: ${workspaceId}`
    );
    return project;
  }

  async getProjectsByWorkspace(workspaceId: string): Promise<IProject[]> {
    await this.workspacesService.getWorkspaceById(workspaceId);
    return this.projectsRepository.findByWorkspace(workspaceId);
  }

  async getProjectById(id: string): Promise<IProject> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID Dự án không hợp lệ');
    }
    const project = await this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án hoặc dự án đã bị xóa');
    }
    return project;
  }

  async updateProject(id: string, dto: UpdateProjectDto): Promise<IProject> {
    await this.getProjectById(id);
    const updated = await this.projectsRepository.updateById(id, { $set: dto });
    if (!updated) {
      throw new NotFoundException('Không tìm thấy dự án để cập nhật');
    }
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    await this.getProjectById(id);
    const deleted = await this.projectsRepository.softDelete(id);
    this.logger.log(`Đã xóa mềm Project ID: ${id}`);
    return deleted;
  }

  async setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean> {
    return this.projectsRepository.setHasDataset(projectId, hasDataset);
  }
}
