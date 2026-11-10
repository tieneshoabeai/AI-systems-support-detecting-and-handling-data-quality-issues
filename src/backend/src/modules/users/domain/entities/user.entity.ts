import { canUserLogin, normalizeEmail, type UserRole, type UserStatus } from '../value-objects/user-role.vo';

export interface UserProps {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  deletedAt: Date | null;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    return new User({ ...props, email: normalizeEmail(props.email) });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  canLogin(): boolean {
    return canUserLogin(this.props.status, this.props.deletedAt);
  }

  isAdmin(): boolean {
    return this.props.role === 'admin';
  }
}
