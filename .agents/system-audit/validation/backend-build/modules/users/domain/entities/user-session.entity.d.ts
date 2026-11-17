export interface UserSessionProps {
    id: string;
    userId: string;
    isRevoked: boolean;
    expiresAt: Date;
}
export declare class UserSession {
    private readonly props;
    private constructor();
    static create(props: UserSessionProps): UserSession;
    isActive(now?: Date): boolean;
}
