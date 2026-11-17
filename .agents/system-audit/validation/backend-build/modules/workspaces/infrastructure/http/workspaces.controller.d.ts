import { WorkspacesService } from '../../application/workspaces.service';
import { CreateWorkspaceDto } from './dtos/create-workspace.dto';
import { UpdateWorkspaceDto } from './dtos/update-workspace.dto';
import { AddMemberDto } from './dtos/add-member.dto';
import { TransferOwnerDto } from './dtos/transfer-owner.dto';
import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
export declare class WorkspacesController {
    private readonly workspacesService;
    constructor(workspacesService: WorkspacesService);
    createWorkspace(user: CurrentUserPayload, dto: CreateWorkspaceDto): Promise<{
        message: string;
        workspace: import("../../domain/ports/workspace.repository.port").WorkspaceRecord;
    }>;
    listWorkspaces(user: CurrentUserPayload, query: Record<string, unknown>): Promise<{
        items: import("../../domain/ports/workspace.repository.port").WorkspaceRecord[];
        total: number;
        page: number;
        limit: number;
    }>;
    getWorkspaceById(id: string): Promise<{
        workspace: import("../../domain/ports/workspace.repository.port").WorkspaceRecord;
    }>;
    updateWorkspace(id: string, dto: UpdateWorkspaceDto): Promise<{
        message: string;
        workspace: import("../../domain/ports/workspace.repository.port").WorkspaceRecord;
    }>;
    deleteWorkspace(id: string): Promise<void>;
    listMembers(id: string): Promise<{
        members: import("../../domain/ports/workspace.repository.port").WorkspaceMemberRecord[];
        total: number;
    }>;
    addMember(id: string, dto: AddMemberDto): Promise<{
        message: string;
        workspace: import("../../domain/ports/workspace.repository.port").WorkspaceRecord;
    }>;
    removeMember(id: string, userId: string): Promise<{
        message: string;
        workspace: import("../../domain/ports/workspace.repository.port").WorkspaceRecord;
    }>;
    transferOwner(id: string, user: CurrentUserPayload, dto: TransferOwnerDto): Promise<{
        message: string;
        workspace: import("../../domain/ports/workspace.repository.port").WorkspaceRecord;
    }>;
    leave(id: string, user: CurrentUserPayload): Promise<{
        left: boolean;
        message: string;
    }>;
}
