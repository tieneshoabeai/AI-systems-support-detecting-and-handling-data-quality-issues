export declare const USER_EVENTS: {
    readonly CREATED: 'user.created';
    readonly BLOCKED: 'user.blocked';
    readonly UNBLOCKED: 'user.unblocked';
};
export type UserEventName = (typeof USER_EVENTS)[keyof typeof USER_EVENTS];
