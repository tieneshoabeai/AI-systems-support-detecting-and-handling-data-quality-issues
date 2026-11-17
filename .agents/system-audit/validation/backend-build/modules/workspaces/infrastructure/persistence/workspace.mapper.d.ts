import type { IWorkspace, IWorkspaceMember } from './workspace.schema';
import type { WorkspaceMemberRecord, WorkspaceRecord } from '../../domain/ports/workspace.repository.port';
export declare function toMemberRecord(m: IWorkspaceMember): WorkspaceMemberRecord;
export declare function toWorkspaceRecord(doc: IWorkspace): WorkspaceRecord;
export declare function toMemberPersistence(m: WorkspaceMemberRecord): IWorkspaceMember;
