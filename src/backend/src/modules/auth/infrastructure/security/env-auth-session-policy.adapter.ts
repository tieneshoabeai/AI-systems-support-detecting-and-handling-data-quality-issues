import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDurationMs } from '../../../../shared/domain/utils/duration.util';
import {
  AUTH_SESSION_POLICY_PORT,
  type AuthSessionPolicyPort,
} from '../../domain/ports/auth-session.port';
import {
  REFRESH_TOKEN_TTL_MS,
  REMEMBER_ME_REFRESH_TOKEN_TTL_MS,
} from '../../domain/value-objects/auth-policy.vo';

/**
 * Adapter đọc hạn phiên từ biến môi trường.
 *
 * - `JWT_REFRESH_EXPIRATION` (mặc định `7d`) — phiên thường.
 * - `JWT_REFRESH_REMEMBER_EXPIRATION` (mặc định `30d`) — phiên "ghi nhớ đăng nhập".
 */
@Injectable()
export class EnvAuthSessionPolicyAdapter implements AuthSessionPolicyPort {
  private readonly normalMs: number;
  private readonly rememberMs: number;

  constructor(config: ConfigService) {
    this.normalMs = parseDurationMs(
      config.get<string>('JWT_REFRESH_EXPIRATION'),
      REFRESH_TOKEN_TTL_MS,
    );
    this.rememberMs = parseDurationMs(
      config.get<string>('JWT_REFRESH_REMEMBER_EXPIRATION'),
      REMEMBER_ME_REFRESH_TOKEN_TTL_MS,
    );
  }

  refreshTtlMs(rememberMe: boolean): number {
    return rememberMe ? this.rememberMs : this.normalMs;
  }
}

export { AUTH_SESSION_POLICY_PORT };
