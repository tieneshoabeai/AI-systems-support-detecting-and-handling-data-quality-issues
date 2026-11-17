export declare const WORKSPACE_ROLES: readonly ['owner', 'member'];
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export declare function isWorkspaceOwner(ownerId: string, userId: string): boolean;
export declare function isWorkspaceMember(memberUserIds: string[], userId: string): boolean;
export declare function resolveWorkspaceRole(ownerId: string, members: Array<{
    userId: string;
    role: string;
}>, userId: string): WorkspaceRole | null;
