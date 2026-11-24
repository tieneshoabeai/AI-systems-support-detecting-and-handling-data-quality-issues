/**
 * OVERVIEW — Types (Template Simple).
 * Return shapes cua 2 query E3/E4 (tach tu handler de controller/service dung chung).
 */

export interface UserOverview {
  totalWorkspaces: number;
  totalProjects: number;
  ownedWorkspaces: number;
  sharedWorkspaces: number;
  myProjects: number;
}

export interface WorkspaceOverview {
  workspaceId: string;
  projectCount: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  memberCount: number;
  storageUsedBytes: number;
  lastAccessedAt: string | null;
}
