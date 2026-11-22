import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Optional,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { ERROR_CODES, NotFoundError } from '../../../../shared/domain/errors';
import { StatusError } from '../../../../shared/application/errors';
import { RegisterSchema, RegisterDto } from '../dtos/register.dto';
import { LoginSchema, LoginDto } from '../dtos/login.dto';
import { RefreshTokenSchema, RefreshTokenDto } from '../dtos/refresh-token.dto';
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  type ForgotPasswordDto,
  type ResetPasswordDto,
  type ChangePasswordDto,
} from '../dtos/password-reset.dto';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { Public } from '../../../../shared/interfaces/decorators/public.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import { ApiZodBody } from '../../../../shared/interfaces/swagger/api-zod.decorator';
import { ChangePasswordHandler } from '../../application/commands/change-password.handler';
import { ForgotPasswordHandler } from '../../application/commands/forgot-password.handler';
import { GetSessionByIdHandler } from '../../application/queries/get-session-by-id.handler';
import { GetSessionsHandler } from '../../application/queries/get-sessions.handler';
import { LoginHandler } from '../../application/commands/login.handler';
import { LoginWithGoogleHandler } from '../../application/commands/login-with-google.handler';
import { LogoutHandler } from '../../application/commands/logout.handler';
import { RefreshAccessTokenHandler } from '../../application/commands/refresh-access-token.handler';
import { RegisterHandler } from '../../application/commands/register.handler';
import { ResetPasswordHandler } from '../../application/commands/reset-password.handler';
import { RevokeSessionHandler } from '../../application/commands/revoke-session.handler';
import { ConfigService } from '@nestjs/config';
import {
  buildFrontendRedirectUrl,
  type GoogleCallbackMode,
} from '../google-redirect.util';

/** Tên cookie state CSRF của Google OAuth. */
const GOOGLE_STATE_COOKIE = 'google_oauth_state';

/**
 * Cookie lưu chế độ trả kết quả của callback (`json` | `redirect`).
 *
 * Vì sao cần cookie: `redirect_uri` đăng ký ở Google Cloud Console phải **khớp
 * tuyệt đối** — không thể thêm `?format=json` vào nó. Nên chế độ do frontend chọn
 * ở `GET /auth/google?format=json` được gửi kèm qua cookie, và callback đọc lại.
 */
const GOOGLE_FORMAT_COOKIE = 'google_oauth_format';

/**
 * Xoá cookie state Google OAuth.
 *
 * Phải dùng **cùng thuộc tính** với lúc `res.cookie()` (đặc biệt `path` và `secure`)
 * — nếu lệch thì trình duyệt không xoá cookie cũ, để lại state đã dùng.
 */
function clearGoogleStateCookie(res: Response, req: Request): void {
  res.clearCookie(GOOGLE_STATE_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: req.secure,
    sameSite: 'lax',
  });
  // Xoá luôn cookie chế độ trả kết quả (nếu có) — tránh cookie rác tồn đọng.
  res.clearCookie(GOOGLE_FORMAT_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: req.secure,
    sameSite: 'lax',
  });
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly changePasswordHandler: ChangePasswordHandler,
    private readonly forgotPasswordHandler: ForgotPasswordHandler,
    private readonly loginHandler: LoginHandler,
    private readonly loginWithGoogleHandler: LoginWithGoogleHandler,
    private readonly logoutHandler: LogoutHandler,
    private readonly refreshAccessTokenHandler: RefreshAccessTokenHandler,
    private readonly registerHandler: RegisterHandler,
    private readonly resetPasswordHandler: ResetPasswordHandler,
    private readonly revokeSessionHandler: RevokeSessionHandler,
    private readonly getSessionByIdHandler: GetSessionByIdHandler,
    private readonly getSessionsHandler: GetSessionsHandler,
    /**
     * `ConfigService` là **optional**: chỉ cần cho luồng redirect về frontend
     * (`APP_URL`). Thiếu nó → callback trả JSON (chế độ mặc định) — an toàn.
     */
    @Optional() private readonly config?: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 100, ttl: 3600000 } })
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới (F1.1)' })
  @ApiZodBody(RegisterSchema, 'Thông tin đăng ký tài khoản mới')
  @ApiResponse({ status: 201, description: 'Tài khoản được tạo thành công' })
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto): Promise<{ id: string; email: string; first_name: string; last_name: string; role: "admin" | "analyst"; created_at: Date; }> {
    return this.registerHandler.execute(dto);
  }

  @Public()
  @Throttle({ default: { limit: 100, ttl: 3600000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập hệ thống (F1.2) — hỗ trợ "ghi nhớ đăng nhập"' })
  @ApiZodBody(LoginSchema, 'Thông tin đăng nhập hệ thống')
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về JWT Access Token và Refresh Token',
  })
  async login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto, @Req() req: Request): Promise<{ access_token: string; refresh_token: string; expires_in: number; device_name: string; remember_me: boolean; expires_at: string; user: { id: string; email: string; role: "admin" | "analyst"; }; }> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.loginHandler.execute(dto, ipAddress, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 100, ttl: 3600000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp mới Access Token bằng Refresh Token (F1.3)' })
  @ApiZodBody(RefreshTokenSchema, 'Refresh token dùng để gia hạn access token')
  @ApiResponse({ status: 200, description: 'Cấp mới Access Token thành công' })
  async refresh(@Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto): Promise<{ access_token: string; refresh_token: string; expires_in: number; remember_me: boolean; expires_at: string; }> {
    return this.refreshAccessTokenHandler.execute(dto.refresh_token);
  }

  @Public()
  @Throttle({ default: { limit: 500, ttl: 3600000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AUTH-05: Quên mật khẩu — gửi OTP 6 số (TTL 10 phút)' })
  @ApiZodBody(ForgotPasswordSchema, 'Email nhận mã OTP')
  @ApiResponse({ status: 200, description: 'Thành công' })
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordDto): Promise<{ message: string; }> {
    return this.forgotPasswordHandler.execute(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 100, ttl: 3600000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AUTH-06: Đặt lại mật khẩu bằng OTP' })
  @ApiZodBody(ResetPasswordSchema, 'Email + OTP + mật khẩu mới')
  @ApiResponse({ status: 200, description: 'Thành công' })
  async resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto): Promise<{ message: string; }> {
    return this.resetPasswordHandler.execute(dto.email, dto.otp, dto.new_password);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 500, ttl: 3600000 } })
  @ApiOperation({ summary: 'AUTH-07: Đổi mật khẩu (giữ phiên hiện tại)' })
  @ApiZodBody(ChangePasswordSchema, 'Mật khẩu hiện tại + mật khẩu mới 2 lần nhập')
  @ApiResponse({ status: 200, description: 'Thành công' })
  async changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
  ): Promise<{ message: string; }> {
    return this.changePasswordHandler.execute(
      user.userId,
      user.sessionId,
      dto.current_password,
      dto.new_password,
      dto.confirm_password,
    );
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'AUTH-03: Đăng nhập Google — chuyển hướng tới trang xác thực Google' })
  @ApiResponse({ status: 302, description: 'Chuyển hướng tới Google (chỉ khi đã cấu hình credential)' })
  @ApiResponse({ status: 501, description: 'Chưa cấu hình GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI' })
  async googleStart(
    @Query('format') format: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const state = randomUUID();
    const url = this.loginWithGoogleHandler.buildAuthorizationUrl(state);
    // Lưu state để callback đối chiếu (chống CSRF).
    // `secure` theo `req.secure` — tôn trọng cấu hình `trust proxy` (Cloudflare Tunnel).
    res.cookie(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'lax',
      // `path` phải khớp với lúc `clearCookie` và rõ ràng (không phụ thuộc thư mục URI).
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
    // Lưu chế độ trả kết quả để callback đọc lại (`redirect_uri` của Google
    // phải khớp tuyệt đối nên không thể truyền query).
    if (format === 'json' || format === 'redirect') {
      res.cookie(GOOGLE_FORMAT_COOKIE, format, {
        httpOnly: true,
        secure: req.secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60 * 1000,
      });
    }
    res.redirect(url);
  }

  /**
   * Chế độ trả kết quả của `GET /auth/google/callback`.
   *
   * - `?format=json` → trả JSON envelope (giống hệt `POST /auth/login`).
   * - còn lại → **redirect** về `APP_URL` kèm token trong fragment.
   *
   * Nếu `APP_URL` chưa cấu hình → ép về `json` (không thể redirect, không được
   * làm người dùng mất token).
   */
  private resolveCallbackMode(
    format: string | undefined,
    req?: Request,
  ): GoogleCallbackMode {
    // Ưu tiên query param (dùng trực tiếp khi gọi callback bằng `fetch`).
    if (format === 'json') return 'json';
    if (format === 'redirect') return 'redirect';
    // Đọc cookie chế độ do `GET /auth/google?format=...` thiết lập.
    const cookies = req?.cookies as Record<string, unknown> | undefined;
    const cookieFormat = cookies?.[GOOGLE_FORMAT_COOKIE];
    if (cookieFormat === 'json') return 'json';
    if (cookieFormat === 'redirect') return 'redirect';
    // Mặc định: JSON envelope — khớp `POST /auth/login` và hợp đồng §3.5c.
    return 'json';
  }

  /**
   * Dựng URL redirect về frontend kèm token trong **fragment**.
   *
   * Chỉ dùng `APP_URL` đã cấu hình — KHÔNG nhận URL từ query (chống open redirect).
   * Token đặt trong fragment (`#`) để không bị ghi vào access log của proxy.
   */
  private buildSuccessRedirect(
    result: Record<string, unknown>,
    format: string | undefined,
    req?: Request,
  ): string | null {
    if (this.resolveCallbackMode(format, req) !== 'redirect') return null;
    const accessToken = typeof result['access_token'] === 'string' ? result['access_token'] : '';
    const refreshToken = typeof result['refresh_token'] === 'string' ? result['refresh_token'] : '';
    if (!accessToken) return null;

    const params: Record<string, string> = {
      access_token: accessToken,
      provider: 'google',
    };
    if (refreshToken) params['refresh_token'] = refreshToken;

    return buildFrontendRedirectUrl(this.config?.get<string>('APP_URL'), params);
  }

  /**
   * Dựng URL redirect về frontend kèm **mã lỗi** trong fragment.
   *
   * Chỉ dùng `APP_URL` đã cấu hình (chống open redirect).
   * Trả `null` nếu không thể redirect → caller ném lỗi HTTP bình thường.
   */
  private buildErrorRedirect(
    format: string | undefined,
    code: string,
    message: string,
    req?: Request,
  ): string | null {
    if (this.resolveCallbackMode(format, req) !== 'redirect') return null;
    return buildFrontendRedirectUrl(this.config?.get<string>('APP_URL'), {
      error: code,
      error_description: message,
    });
  }

  /** Rút mã lỗi chuẩn từ exception (hỗ trợ `StatusError` và `DomainError`). */
  private extractErrorCode(err: unknown): string {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code?: unknown }).code;
      if (typeof code === 'string' && code.length > 0) return code;
    }
    return ERROR_CODES.VALIDATION_ERROR;
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'AUTH-03: Google callback — đổi mã lấy token và đăng nhập' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về JWT Access Token và Refresh Token' })
  @ApiResponse({ status: 302, description: 'Đăng nhập thành công — chuyển hướng về frontend kèm token (che do `?format=redirect`)' })
  @ApiResponse({ status: 401, description: 'Mã ủy quyền không hợp lệ hoặc email chưa được xác minh' })
  @ApiResponse({
    status: 409,
    description:
      'Không thể liên kết — định danh Google đã bị một tài khoản khác chiếm',
  })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Query('format') format: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (oauthError) {
      // Hợp đồng Phần 7 §3.4: Google từ chối yêu cầu → **401** với mã
      // `VALIDATION_ERROR` (không phải 400 — đây là lỗi xác thực).
      // Cookie state phải bị xoá dù lỗi (tránh tái sử dụng state cũ).
      clearGoogleStateCookie(res, req);
      const message = `Google từ chối yêu cầu đăng nhập (${oauthError}).`;
      // Chế độ redirect → đưa mã lỗi về frontend, không phải trả JSON lỗi
      // (trình duyệt sẽ hiển thị JSON thay vì quay lại trang đăng nhập).
      const errorRedirect = this.buildErrorRedirect(format, ERROR_CODES.VALIDATION_ERROR, message, req);
      if (errorRedirect) {
        res.redirect(errorRedirect);
        return;
      }
      throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, message);
    }
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const expectedState =
      typeof cookies?.[GOOGLE_STATE_COOKIE] === 'string'
        ? (cookies[GOOGLE_STATE_COOKIE] as string)
        : '';
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    let result: unknown;
    try {
      result = await this.loginWithGoogleHandler.execute(
        code ?? '',
        state ?? '',
        expectedState,
        ipAddress,
        userAgent,
      );
    } catch (err: unknown) {
      // Xoá cookie state kể cả khi lỗi (state sai / lỗi Google / email chưa xác minh).
      clearGoogleStateCookie(res, req);
      // Chế độ redirect → đưa mã lỗi về frontend thay vì trả JSON lỗi.
      const errorRedirect = this.buildErrorRedirect(
        format,
        this.extractErrorCode(err),
        err instanceof Error ? err.message : 'Đăng nhập Google thất bại.',
        req,
      );
      if (errorRedirect) {
        res.redirect(errorRedirect);
        return;
      }
      throw err;
    }
    // Xoá cookie state sau khi dùng (dùng thành công hay lỗi).
    clearGoogleStateCookie(res, req);

    // ── Trả kết quả: JSON envelope (mặc định) hoặc redirect về frontend ──
    //
    // Hợp đồng §3.5c: response phải **giống hệt `POST /auth/login`** → tức là
    // envelope `{ success: true, data: {...} }` do `TransformInterceptor` bọc.
    // Trước đây dùng `res.json(result)` (bypass interceptor) nên trả **raw** →
    // frontend đọc `data.access_token` được `undefined` → không đăng nhập được.
    if (this.resolveCallbackMode(format, req) === 'json') {
      // `res.json` tự bọc theo envelope để khớp `POST /auth/login`.
      res.json({ success: true, data: result });
      return;
    }

    // Chế độ redirect (`?format=redirect`): chuyển hướng về frontend kèm token
    // trong **fragment** (`#`) — fragment không bị ghi vào access log.
    const redirectUrl = this.buildSuccessRedirect(
      result as Record<string, unknown>,
      format,
      req,
    );
    if (redirectUrl) {
      res.redirect(redirectUrl);
      return;
    }

    // Không có `APP_URL` hợp lệ → không thể redirect → trả JSON để không mất token.
    res.json({ success: true, data: result });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất tài khoản và thu hồi session hiện hành (F1.4)' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  async logout(@CurrentUser() user: CurrentUserPayload): Promise<{ message: string; }> {
    return this.logoutHandler.execute(user.sessionId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem danh sách các phiên đăng nhập đang hoạt động (F1.8)' })
  @ApiResponse({ status: 200, description: 'Danh sách các phiên đăng nhập' })
  async getSessions(@CurrentUser() user: CurrentUserPayload): Promise<{ id: string; device_name: string | null; ip_address: string | null; user_agent: string | null; is_revoked: boolean; remember_me: boolean; last_used_at: string | null; expires_at: string; created_at: string | null; }[]> {
    return this.getSessionsHandler.execute(user.userId);
  }

  /**
   * Phiên đăng nhập **hiện tại** (tài nguyên "của chính mình" → `/me` theo hợp đồng §3.5).
   *
   * PHẢI khai báo **TRƯỚC** `@Get('sessions/:id')` — nếu không, NestJS sẽ match chuỗi
   * `me` vào `:id` và trả 404 / lỗi id không hợp lệ.
   */
  @Get('sessions/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết phiên đăng nhập hiện tại (tài nguyên của chính mình)' })
  @ApiResponse({ status: 200, description: 'Chi tiết phiên hiện tại' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên hiện tại (đã thu hồi hoặc hết hạn)' })
  async getCurrentSession(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ id: string; device_name: string | null; ip_address: string | null; user_agent: string | null; is_revoked: boolean; remember_me: boolean; last_used_at: string | null; expires_at: string; created_at: string | null; }> {
    // `sessionId` do JWT mang — không nhận từ client (tránh truy cập phiên của người khác).
    const sessionId = user.sessionId;
    if (!sessionId) {
      throw new NotFoundError('Không tìm thấy phiên đăng nhập hiện tại');
    }
    return this.getSessionByIdHandler.execute(user.userId, sessionId);
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết 1 phiên đăng nhập (chỉ chính user đó)' })
  @ApiResponse({ status: 200, description: 'Chi tiết phiên đăng nhập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên hoặc phiên thuộc user khác' })
  async getSessionById(@CurrentUser() user: CurrentUserPayload, @Param('id') sessionId: string): Promise<{ id: string; device_name: string | null; ip_address: string | null; user_agent: string | null; is_revoked: boolean; remember_me: boolean; last_used_at: string | null; expires_at: string; created_at: string | null; }> {
    return this.getSessionByIdHandler.execute(user.userId, sessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thu hồi phiên đăng nhập từ xa (F1.10)' })
  @ApiResponse({ status: 200, description: 'Thu hồi phiên thành công' })
  async revokeSession(@CurrentUser() user: CurrentUserPayload, @Param('id') sessionId: string): Promise<{ message: string; }> {
    return this.revokeSessionHandler.execute(user.userId, sessionId);
  }
}
