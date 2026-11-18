export interface ProjectMemberProps {
    userId: string;
    role: 'owner' | 'member' | 'viewer';
    joinedAt: Date;
}
export interface ProjectProps {
    id: string;
    workspaceId: string;
    name: string;
    hasDataset: boolean;
    members: ProjectMemberProps[];
}
export declare class Project {
    private readonly props;
    private constructor();
    static create(props: ProjectProps): Project;
    get hasDataset(): boolean;
    assertNoActiveDataset(message?: string): void;
    assertCanModerate(projectRole: string | null, workspaceRole: string | null): void;
    assertCanAccess(projectRole: string | null, workspaceRole: string | null): void;
}
