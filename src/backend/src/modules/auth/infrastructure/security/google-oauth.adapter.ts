import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify } from 'crypto';
import {
  type GoogleOAuthPort,
  type GoogleProfile,
} from '../../domain/ports/google-oauth.port';
import { DependencyUnavailableError, ERROR_CODES } from '../../../../shared/domain/errors';
import { StatusError } from '../../../../shared/application/errors';

/**
 * Adapter GOOGLE_OAUTH_PORT — gọi trực tiếp endpoint của Google
 * (không thêm thư viện OAuth bên thứ ba).
 *
 * Luồng: Authorization Code + `state` chống CSRF.
 *   1. `buildAuthorizationUrl(state)` → redirect tới `accounts.google.com/o/oauth2/v2/auth`.
 *   2. `exchangeCode(code, state, expectedState)` → POST `oauth2.googleapis.com/token`,
 *      đọc `id_token`, verify chữ ký RS256 bằng JWKS của Google, rút claims.
 *
 * Không có credential → mọi lời gọi ném `DEPENDENCY_UNAVAILABLE` (501) —
 * giữ đúng hành vi của đợt trước (`GET /auth/google` trả 501).
 *
 * Ràng buộc Google: `redirect_uri` phải là HTTPS, trừ `http://localhost`.
 */
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

const SCOPES = ['openid', 'email', 'profile'];

/** Claims tối thiểu cần lấy từ id_token / userinfo. */
interface GoogleClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleOAuthAdapter implements GoogleOAuthPort {
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly redirectUri: string | undefined;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
    this.redirectUri = config.get<string>('GOOGLE_REDIRECT_URI');
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  buildAuthorizationUrl(state: string): string {
    const { clientId, redirectUri } = this.requireConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'select_account',
      state,
    });
    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  async exchangeCode(code: string, state: string, expectedState: string): Promise<GoogleProfile> {
    const { clientId, clientSecret, redirectUri } = this.requireConfig();
    if (!state || state !== expectedState) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
    }
    if (!code) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Thiếu mã ủy quyền từ Google.');
    }

    const tokenRes = await this.postForm(GOOGLE_TOKEN_ENDPOINT, {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const idToken = (tokenRes as { id_token?: string }).id_token;
    const accessToken = (tokenRes as { access_token?: string }).access_token;
    let claims: GoogleClaims | null = null;

    if (idToken) {
      claims = await this.verifyIdToken(idToken);
    } else if (accessToken) {
      claims = await this.fetchUserInfo(accessToken);
    }

    if (!claims) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Không đọc được thông tin tài khoản từ Google.');
    }

    const googleId = claims.sub;
    const email = claims.email;
    if (!googleId || !email) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Không đọc được thông tin tài khoản từ Google.');
    }

    const nameParts = (claims.name ?? '').trim().split(/\s+/);
    const firstName = claims.given_name ?? nameParts[0] ?? 'Google';
    const lastName =
      claims.family_name ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User');

    return {
      googleId,
      email,
      emailVerified: claims.email_verified === true,
      firstName,
      lastName,
      avatarUrl: claims.picture ?? null,
    };
  }

  // ── Nội bộ ────────────────────────────────────────────────────────────

  /**
   * Đọc & kiểm tra 3 biến cấu hình — nếu thiếu thì ném
   * `DEPENDENCY_UNAVAILABLE` với status **501**.
   *
   * Vì sao 501 mà không phải 503 (mặc định của mã)?
   *   - **501** (Not Implemented) — tính năng có, nhưng **chưa cấu hình**
   *     (thiếu `GOOGLE_CLIENT_ID`…). Lỗi do phía vận hành.
   *   - **503** (Service Unavailable) — đã cấu hình, nhưng dịch vụ ngoài
   *     đang không phản hồi. Lỗi phía hạ tầng bên ngoài.
   *
   * Hợp đồng API (Phần 7 §3.4) quy định mã lỗi ổn định và status tách biệt,
   * nên cả hai trường hợp dùng **cùng mã** `DEPENDENCY_UNAVAILABLE` nhưng
   * **khác status** → `StatusError` là lớp thích hợp.
   */
  private requireConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
    const { clientId, clientSecret, redirectUri } = this;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new StatusError(
        501,
        ERROR_CODES.DEPENDENCY_UNAVAILABLE,
        'Đăng nhập Google chưa được cấu hình. Cần GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và GOOGLE_REDIRECT_URI.',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private async postForm(
    url: string,
    body: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      });
    } catch {
      throw new DependencyUnavailableError(
        'Không thể kết nối tới dịch vụ xác thực Google.',
      );
    }
    const text = await res.text();
    if (!res.ok) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Google từ chối mã ủy quyền. Vui lòng thử lại.');
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new DependencyUnavailableError(
        'Phản hồi không hợp lệ từ dịch vụ xác thực Google.',
      );
    }
  }

  /**
   * Xác thực chữ ký `id_token` bằng JWKS của Google.
   *
   * Dùng `crypto.verify` với khóa RSA công khai lấy từ JWKS; kiểm tra `iss`,
   * `aud`, `exp`. KHÔNG log nội dung token.
   */
  private async verifyIdToken(idToken: string): Promise<GoogleClaims> {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Token Google không hợp lệ.');
    }
    const headerB64 = parts[0];
    const payloadB64 = parts[1];
    const signatureB64 = parts[2];
    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Token Google không hợp lệ.');
    }

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'RS256') {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Thuật toán ký token Google không được hỗ trợ.');
    }

    const jwks = await this.fetchJwks();
    const jwk = jwks.keys.find((k) => k.kid === header.kid) ?? jwks.keys[0];
    if (!jwk?.n || !jwk.e) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Không tìm thấy khóa công khai của Google.');
    }

    const publicKey = this.buildRsaPublicKey(jwk.n, jwk.e);
    const signed = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
    const signature = Buffer.from(signatureB64, 'base64url');
    const ok = verify('RSA-SHA256', signed, publicKey, signature);
    if (!ok) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Chữ ký token Google không hợp lệ.');
    }

    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as GoogleClaims & {
      iss?: string;
      aud?: string | string[];
      exp?: number;
    };
    if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Nguồn phát hành token Google không hợp lệ.');
    }
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(this.requireConfig().clientId)) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Token Google không được cấp cho ứng dụng này.');
    }
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Token Google đã hết hạn.');
    }
    return claims;
  }

  private async fetchJwks(): Promise<{ keys: Array<{ kid?: string; n?: string; e?: string }> }> {
    let res: Response;
    try {
      res = await fetch(GOOGLE_JWKS_ENDPOINT);
    } catch {
      throw new DependencyUnavailableError(
        'Không thể lấy khóa công khai từ Google.',
      );
    }
    if (!res.ok) {
      throw new DependencyUnavailableError(
        'Không thể lấy khóa công khai từ Google.',
      );
    }
    return (await res.json()) as { keys: Array<{ kid?: string; n?: string; e?: string }> };
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleClaims> {
    let res: Response;
    try {
      res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new DependencyUnavailableError(
        'Không thể kết nối tới dịch vụ xác thực Google.',
      );
    }
    if (!res.ok) {
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Google từ chối yêu cầu lấy thông tin người dùng.');
    }
    return (await res.json()) as GoogleClaims;
  }

  /** Dựng khóa RSA công khai từ modulus/exponent (JWK) của Google. */
  private buildRsaPublicKey(modulus: string, exponent: string): ReturnType<typeof createPublicKey> {
    const n = Buffer.from(modulus, 'base64url');
    const e = Buffer.from(exponent, 'base64url');
    return createPublicKey({
      key: {
        kty: 'RSA',
        n: n.toString('base64url'),
        e: e.toString('base64url'),
      },
      format: 'jwk',
    });
  }
}
