import { Model } from 'mongoose';
import { IProject } from './project.schema';
import { type AddProjectMemberRecord, type CreateProjectRecord, type ProjectListQuery, type ProjectMemberRole, type ProjectRecord, type ProjectRepositoryPort, type ProjectStatus } from '../../domain/ports/project.repository.port';
export declare class ProjectsRepository implements ProjectRepositoryPort {
    private readonly model;
    constructor(model: Model<IProject>);
    create(data: CreateProjectRecord): Promise<ProjectRecord>;
    findById(id: string): Promise<ProjectRecord | null>;
    findOneByWorkspaceAndName(workspaceId: string, name: string): Promise<ProjectRecord | null>;
    findByWorkspace(workspaceId: string): Promise<ProjectRecord[]>;
    findByWorkspacePaged(workspaceId: string, opts?: ProjectListQuery): Promise<{
        items: ProjectRecord[];
        total: number;
    }>;
    updateById(id: string, update: {
        name?: string;
        description?: string;
    }, expectedVersion?: number): Promise<ProjectRecord | null>;
    softDelete(id: string): Promise<boolean>;
    setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean>;
    markCompleted(projectId: string, expectedVersion: number): Promise<boolean | null>;
    setStatus(projectId: string, status: ProjectStatus): Promise<boolean>;
    touchLastAccessed(projectId: string): Promise<void>;
    addMember(projectId: string, member: AddProjectMemberRecord): Promise<boolean>;
    removeMember(projectId: string, userId: string): Promise<boolean>;
    updateMemberRole(projectId: string, userId: string, role: ProjectMemberRole, expectedVersion?: number): Promise<boolean | null>;
    transferOwner(projectId: string, newOwnerId: string, expectedVersion?: number): Promise<boolean | null>;
}
