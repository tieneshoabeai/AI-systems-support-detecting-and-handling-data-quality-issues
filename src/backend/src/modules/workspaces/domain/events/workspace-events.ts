export const WORKSPACE_EVENTS = {
  CREATED: 'workspace.created',
  MEMBER_ADDED: 'workspace.member_added',
  MEMBER_REMOVED: 'workspace.member_removed',
  OWNER_TRANSFERRED: 'workspace.owner_transferred',
  /** Workspace bị xóa mềm → trigger cascade xóa project (và dataset) bên trong. */
  DELETED: 'WORKSPACE_DELETED',
} as const;

export type WorkspaceEventName = (typeof WORKSPACE_EVENTS)[keyof typeof WORKSPACE_EVENTS];
