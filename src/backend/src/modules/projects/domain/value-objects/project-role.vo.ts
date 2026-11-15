export const PROJECT_MEMBER_ROLES = ['owner', 'member', 'viewer'] as const;

export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

export function canModerateProject(
  projectRole: string | null,
  workspaceRole: string | null,
): boolean {
  return projectRole === 'owner' || workspaceRole === 'owner';
}

export function canAccessProject(
  projectRole: string | null,
  workspaceRole: string | null,
): boolean {
  return workspaceRole === 'owner' || projectRole === 'owner' || projectRole === 'member';
}
