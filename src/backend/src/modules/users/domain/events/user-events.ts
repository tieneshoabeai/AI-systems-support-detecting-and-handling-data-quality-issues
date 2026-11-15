export const USER_EVENTS = {
  CREATED: 'user.created',
  BLOCKED: 'user.blocked',
  UNBLOCKED: 'user.unblocked',
} as const;

export type UserEventName = (typeof USER_EVENTS)[keyof typeof USER_EVENTS];
