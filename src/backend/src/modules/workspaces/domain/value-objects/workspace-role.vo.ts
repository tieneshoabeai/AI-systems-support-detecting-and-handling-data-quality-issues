export const WORKSPACE_ROLES = ['owner', 'member'] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function isWorkspaceOwner(ownerId: string, userId: string): boolean {
  return ownerId === userId;
}

export function isWorkspaceMember(memberUserIds: string[], userId: string): boolean {
  return memberUserIds.includes(userId);
}

export function resolveWorkspaceRole(
  ownerId: string,
  members: Array<{ userId: string; role: string }>,
  userId: string,
): WorkspaceRole | null {
  if (ownerId === userId) return 'owner';
  const hit = members.find((m) => m.userId === userId);
  if (!hit) return null;
  if (hit.role === 'editor' || hit.role === 'viewer') return 'member';
  return hit.role === 'owner' ? 'owner' : 'member';
}
