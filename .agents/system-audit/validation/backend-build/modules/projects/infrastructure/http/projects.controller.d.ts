import { ProjectsService } from '../../application/projects.service';
import { CreateProjectDto } from './dtos/create-project.dto';
import { UpdateProjectDto } from './dtos/update-project.dto';
import { AddProjectMemberDto, UpdateProjectMemberDto, TransferProjectOwnerDto, MarkCompletedDto } from './dtos/project-member.dto';
import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    createProject(workspaceId: string, user: CurrentUserPayload, dto: CreateProjectDto): Promise<{
        message: string;
        project: import("../../domain/ports/project.repository.port").ProjectRecord;
    }>;
    listByWorkspace(workspaceId: string, query: Record<string, unknown>): Promise<{
        items: import("../../domain/ports/project.repository.port").ProjectRecord[];
        total: number;
        page: number;
        limit: number;
    }>;
    getProjectById(id: string): Promise<{
        project: import("../../domain/ports/project.repository.port").ProjectRecord;
    }>;
    updateProject(id: string, dto: UpdateProjectDto): Promise<{
        message: string;
        project: import("../../domain/ports/project.repository.port").ProjectRecord;
    }>;
    deleteProject(id: string): Promise<void>;
    markCompleted(id: string, dto: MarkCompletedDto): Promise<{
        project: import("../../domain/ports/project.repository.port").ProjectRecord;
    }>;
    listMembers(id: string): Promise<{
        members: import("../../domain/ports/project.repository.port").ProjectMemberRecord[];
        total: number;
    }>;
    addMember(id: string, dto: AddProjectMemberDto): Promise<{
        message: string;
        project: import("../../domain/ports/project.repository.port").ProjectRecord;
    }>;
    updateMember(id: string, userId: string, dto: UpdateProjectMemberDto): Promise<{
        message: string;
        project: import("../../domain/ports/project.repository.port").ProjectRecord;
    }>;
    removeMember(id: string, userId: string): Promise<{
        message: string;
        project: import("../../domain/ports/project.repository.port").ProjectRecord;
    }>;
    transferOwner(id: string, user: CurrentUserPayload, dto: TransferProjectOwnerDto): Promise<{
        message: string;
        project: import("../../domain/ports/project.repository.port").ProjectRecord;
    }>;
}
