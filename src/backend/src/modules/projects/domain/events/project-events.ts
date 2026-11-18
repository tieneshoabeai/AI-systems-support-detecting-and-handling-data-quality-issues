export const PROJECT_EVENTS = {
  CREATED: 'project.created',
  DELETED: 'project.deleted',
  MEMBER_ADDED: 'project.member_added',
  /** Project bị xóa mềm → trigger cascade xóa dataset (và file R2) bên trong. */
  DELETED_CASCADE: 'PROJECT_DELETED',
} as const;

export type ProjectEventName = (typeof PROJECT_EVENTS)[keyof typeof PROJECT_EVENTS];
