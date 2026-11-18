/**
 * CreateSessionHandler — Use case: `createSession()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** dùng `UserSession.create()` — entity tự tính
 * hạn phiên theo chính sách (`rememberMe` → 30 ngày, ngược lại 7 ngày).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type CreateSessionInput,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import type { UserSession } from '../../domain/entities/user-session.entity';
import { UserSession as UserSessionEntity } from '../../domain/entities/user-session.entity';
import { newObjectIdHex } from '../../../../shared/domain/utils/object-id.util';

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
  }): Promise<UserSession> {
    const entity = UserSessionEntity.create({
      id: newObjectIdHex(),
      userId: data.user_id,
      refreshTokenHash: data.refresh_token_hash,
      deviceName: data.device_name,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      rememberMe: data.remember_me === true,
      expiresAt: data.expires_at,
    });
    const input: CreateSessionInput = {
      userId: entity.userId,
      refreshTokenHash: entity.refreshTokenHash,
      deviceName: entity.deviceName,
      ipAddress: entity.ipAddress,
      userAgent: entity.userAgent,
      rememberMe: entity.rememberMe,
      expiresAt: entity.expiresAt,
    };
    return this.users.createSession(input);
  }
}
