export const PROJECT_EVENTS = {
  CREATED: 'project.created',
  DELETED: 'project.deleted',
  MEMBER_ADDED: 'project.member_added',
} as const;

export type ProjectEventName = (typeof PROJECT_EVENTS)[keyof typeof PROJECT_EVENTS];
