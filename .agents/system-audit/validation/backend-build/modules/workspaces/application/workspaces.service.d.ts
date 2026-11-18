import { type WorkspaceListQuery, type WorkspaceRecord, type WorkspaceRepositoryPort } from '../domain/ports/workspace.repository.port';
import { type UserRepositoryPort } from '../../users/domain/ports/user.repository.port';
import type { CurrentUser } from '../../../shared/casl/casl-ability.factory';
export interface CreateWorkspaceInput {
    name: string;
    description?: string;
}
export interface UpdateWorkspaceInput {
    name?: string;
    description?: string;
    expectedVersion?: number;
}
export interface AddWorkspaceMemberInput {
    email: string;
    role?: 'owner' | 'member';
}
export interface TransferWorkspaceOwnerInput {
    email: string;
    expectedVersion: number;
}
export declare class WorkspacesService {
    private readonly workspaces;
    private readonly users;
    private readonly logger;
    constructor(workspaces: WorkspaceRepositoryPort, users: UserRepositoryPort);
    createWorkspace(userId: string, dto: CreateWorkspaceInput): Promise<WorkspaceRecord>;
    getWorkspaces(user: CurrentUser): Promise<WorkspaceRecord[]>;
    listWorkspaces(user: CurrentUser, q: WorkspaceListQuery): Promise<{
        items: WorkspaceRecord[];
        total: number;
        page: number;
        limit: number;
    }>;
    getWorkspaceById(id: string, touch?: boolean): Promise<WorkspaceRecord>;
    updateWorkspace(id: string, dto: UpdateWorkspaceInput): Promise<WorkspaceRecord>;
    deleteWorkspace(id: string): Promise<boolean>;
    addMember(workspaceId: string, dto: AddWorkspaceMemberInput): Promise<WorkspaceRecord>;
    removeMember(workspaceId: string, memberUserId: string): Promise<WorkspaceRecord>;
    transferOwner(workspaceId: string, actorUserId: string, dto: TransferWorkspaceOwnerInput): Promise<WorkspaceRecord>;
    leaveWorkspace(workspaceId: string, userId: string): Promise<{
        left: boolean;
    }>;
    incrementStorageUsed(workspaceId: string, deltaBytes: number): Promise<void>;
    checkWorkspaceUploadQuota(workspaceId: string, incomingBytes: number, quotaBytes: number): Promise<void>;
    resolveUserWorkspaceRole(workspaceId: string, userId: string): Promise<'owner' | 'member' | null>;
}
