export interface WorkspaceMemberProps {
    userId: string;
    role: 'owner' | 'member';
    joinedAt: Date;
}
export interface WorkspaceProps {
    id: string;
    name: string;
    ownerId: string;
    members: WorkspaceMemberProps[];
}
export declare class Workspace {
    private readonly props;
    private constructor();
    static create(props: WorkspaceProps): Workspace;
    isOwner(userId: string): boolean;
    isMember(userId: string): boolean;
    assertActorIsOwner(actorUserId: string, message?: string): void;
    assertCanRemoveMember(targetUserId: string): void;
    assertCanTransfer(actorUserId: string, targetUserId: string): void;
    assertCanLeave(userId: string): void;
}
