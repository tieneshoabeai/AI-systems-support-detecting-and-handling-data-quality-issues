import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_USER_LOOKUP_PORT,
  type AuthUserCreateInput,
  type AuthUserLookup,
  type AuthUserLookupPort,
} from '../../domain/ports/auth-session.port';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../../users/domain/ports/user.repository.port';

/**
 * Adapter AUTH_USER_LOOKUP_PORT -> USER_REPOSITORY_PORT.
 * Auth application không gọi UsersService/UsersRepository trực tiếp.
 */
@Injectable()
export class UsersAuthLookupAdapter implements AuthUserLookupPort {
  constructor(@Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort) {}
  async findByEmail(email: string, includePassword?: boolean): Promise<AuthUserLookup | null> {
    const u = await this.users.findByEmail(email, includePassword);
    if (!u) return null;
    return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, deletedAt: u.deletedAt };
  }
  async findById(id: string): Promise<AuthUserLookup | null> {
    const u = await this.users.findById(id);
    if (!u) return null;
    return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, deletedAt: u.deletedAt };
  }
  async create(data: AuthUserCreateInput): Promise<AuthUserLookup> {
    const u = await this.users.create(data);
    return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, deletedAt: u.deletedAt };
  }
}
