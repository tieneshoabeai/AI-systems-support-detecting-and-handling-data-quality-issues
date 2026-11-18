import { type ProjectListQuery, type ProjectRecord, type ProjectRepositoryPort } from '../domain/ports/project.repository.port';
import { type WorkspaceRepositoryPort } from '../../workspaces/domain/ports/workspace.repository.port';
import { type UserRepositoryPort } from '../../users/domain/ports/user.repository.port';
export interface CreateProjectInput {
    name: string;
    description?: string;
}
export interface UpdateProjectInput {
    name?: string;
    description?: string;
    expectedVersion?: number;
}
export interface AddProjectMemberInput {
    email: string;
    role?: 'member' | 'viewer';
}
export interface UpdateProjectMemberInput {
    role: 'member' | 'viewer';
    expectedVersion: number;
}
export interface TransferProjectOwnerInput {
    email: string;
    expectedVersion: number;
}
export declare class ProjectsService {
    private readonly projects;
    private readonly workspaces;
    private readonly users;
    private readonly logger;
    constructor(projects: ProjectRepositoryPort, workspaces: WorkspaceRepositoryPort, users: UserRepositoryPort);
    createProject(workspaceId: string, userId: string, dto: CreateProjectInput): Promise<ProjectRecord>;
    getProjectsByWorkspace(workspaceId: string): Promise<ProjectRecord[]>;
    listProjectsByWorkspace(workspaceId: string, q: ProjectListQuery): Promise<{
        items: ProjectRecord[];
        total: number;
        page: number;
        limit: number;
    }>;
    getProjectById(id: string, touch?: boolean): Promise<ProjectRecord>;
    updateProject(id: string, dto: UpdateProjectInput): Promise<ProjectRecord>;
    deleteProject(id: string): Promise<boolean>;
    setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean>;
    markCompleted(projectId: string, expectedVersion?: number): Promise<boolean>;
    resolveUserProjectRole(projectId: string, userId: string, workspaceRole?: 'owner' | 'member' | null): Promise<'owner' | 'member' | 'viewer' | null>;
    addProjectMember(projectId: string, dto: AddProjectMemberInput): Promise<ProjectRecord>;
    updateProjectMemberRole(projectId: string, memberUserId: string, dto: UpdateProjectMemberInput): Promise<ProjectRecord>;
    removeProjectMember(projectId: string, memberUserId: string): Promise<ProjectRecord>;
    transferProjectOwner(projectId: string, actorUserId: string, dto: TransferProjectOwnerInput): Promise<ProjectRecord>;
}
