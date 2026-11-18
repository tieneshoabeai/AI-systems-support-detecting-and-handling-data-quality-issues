export declare const PROJECT_MEMBER_ROLES: readonly ['owner', 'member', 'viewer'];
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];
export declare function canModerateProject(projectRole: string | null, workspaceRole: string | null): boolean;
export declare function canAccessProject(projectRole: string | null, workspaceRole: string | null): boolean;
