/**
 * CreateSessionHandler — Use case: `createSession()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type CreateSessionInput,
  type UserRepositoryPort,
  type UserSessionRecord,
} from '../../domain/ports/user.repository.port';

@Injectable()
export class CreateSessionHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(data: {
    user_id: string;
    refresh_token_hash: string;
    device_name?: string;
    ip_address?: string;
    user_agent?: string;
    remember_me?: boolean;
    expires_at: Date;
  }): Promise<UserSessionRecord> {
    const input: CreateSessionInput = {
      userId: data.user_id,
      refreshTokenHash: data.refresh_token_hash,
      deviceName: data.device_name,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      rememberMe: data.remember_me === true,
      expiresAt: data.expires_at,
    };
    return this.users.createSession(input);
  }
}
