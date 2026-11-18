import { type UserRole, type UserStatus } from '../value-objects/user-role.vo';
export interface UserProps {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    deletedAt: Date | null;
}
export declare class User {
    private readonly props;
    private constructor();
    static create(props: UserProps): User;
    get id(): string;
    get email(): string;
    get role(): UserRole;
    get status(): UserStatus;
    canLogin(): boolean;
    isAdmin(): boolean;
}
