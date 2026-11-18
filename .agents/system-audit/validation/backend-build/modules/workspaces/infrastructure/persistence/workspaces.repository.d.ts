import { Model } from 'mongoose';
import { IWorkspace } from './workspace.schema';
import { type CreateWorkspaceRecord, type WorkspaceListQuery as DomainListQuery, type WorkspaceMemberRecord, type WorkspaceRecord, type WorkspaceRepositoryPort } from '../../domain/ports/workspace.repository.port';
export interface WorkspaceListQuery extends DomainListQuery {
}
export declare class WorkspacesRepository implements WorkspaceRepositoryPort {
    private readonly workspaceModel;
    constructor(workspaceModel: Model<IWorkspace>);
    private toRecord;
    create(data: CreateWorkspaceRecord): Promise<WorkspaceRecord>;
    findById(id: string): Promise<WorkspaceRecord | null>;
    updateById(id: string, update: {
        name?: string;
        description?: string;
    }, expectedVersion?: number): Promise<WorkspaceRecord | null>;
    softDelete(id: string): Promise<boolean>;
    findByUser(userId: string): Promise<WorkspaceRecord[]>;
    findAllActive(): Promise<WorkspaceRecord[]>;
    findByUserPaged(userId: string, opts?: DomainListQuery): Promise<{
        items: WorkspaceRecord[];
        total: number;
    }>;
    addMember(workspaceId: string, member: WorkspaceMemberRecord): Promise<boolean>;
    removeMember(workspaceId: string, userId: string): Promise<boolean>;
    updateMemberRole(workspaceId: string, userId: string, role: 'owner' | 'member', expectedVersion?: number): Promise<boolean | null>;
    touchLastAccessed(workspaceId: string): Promise<void>;
    addStorageUsed(workspaceId: string, deltaBytes: number): Promise<void>;
    transferOwner(workspaceId: string, newOwnerId: string, expectedVersion: number): Promise<boolean | null>;
}
