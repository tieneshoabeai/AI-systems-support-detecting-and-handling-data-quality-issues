/**
 * AUTH — Driving port cho đăng nhập Google (OAuth 2.0 Authorization Code).
 *
 * Tầng `application` chỉ biết port này, không biết endpoint/token của Google.
 * Adapter thật (`GoogleOAuthAdapter`) nằm ở `infrastructure/security/`.
 */

export const GOOGLE_OAUTH_PORT = Symbol('GoogleOAuthPort');

/** Hồ sơ Google rút gọn từ `id_token` (claims) hoặc `userinfo` endpoint. */
export interface GoogleProfile {
  /** `sub` — định danh ổn định của tài khoản Google. */
  googleId: string;
  email: string;
  /** Google chỉ xác minh email khi claim này là `true`. */
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface GoogleOAuthPort {
  /** Có cấu hình OAuth đủ dùng hay không (thiếu credential → `DEPENDENCY_UNAVAILABLE`). */
  isConfigured(): boolean;
  /**
   * Dựng URL chuyển hướng tới trang xác thực Google.
   * @param state nonce chống CSRF — sẽ được kiểm tra lại ở `exchangeCode`.
   */
  buildAuthorizationUrl(state: string): string;
  /**
   * Đổi `code` lấy access token + hồ sơ người dùng.
   * Ném lỗi nếu code không hợp lệ, hết hạn, hoặc Google không trả `email_verified`.
   */
  exchangeCode(code: string, state: string, expectedState: string): Promise<GoogleProfile>;
}
