export declare const WORKSPACE_EVENTS: {
    readonly CREATED: 'workspace.created';
    readonly MEMBER_ADDED: 'workspace.member_added';
    readonly MEMBER_REMOVED: 'workspace.member_removed';
    readonly OWNER_TRANSFERRED: 'workspace.owner_transferred';
};
export type WorkspaceEventName = (typeof WORKSPACE_EVENTS)[keyof typeof WORKSPACE_EVENTS];
