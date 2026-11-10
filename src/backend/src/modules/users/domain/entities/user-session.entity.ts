import { isSessionExpired } from '../value-objects/session-policy.vo';

export interface UserSessionProps {
  id: string;
  userId: string;
  isRevoked: boolean;
  expiresAt: Date;
}

export class UserSession {
  private constructor(private readonly props: UserSessionProps) {}

  static create(props: UserSessionProps): UserSession {
    return new UserSession({ ...props });
  }

  isActive(now: Date = new Date()): boolean {
    return !this.props.isRevoked && !isSessionExpired(this.props.expiresAt, now);
  }
}
