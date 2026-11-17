export declare const PROJECT_EVENTS: {
    readonly CREATED: 'project.created';
    readonly DELETED: 'project.deleted';
    readonly MEMBER_ADDED: 'project.member_added';
};
export type ProjectEventName = (typeof PROJECT_EVENTS)[keyof typeof PROJECT_EVENTS];
