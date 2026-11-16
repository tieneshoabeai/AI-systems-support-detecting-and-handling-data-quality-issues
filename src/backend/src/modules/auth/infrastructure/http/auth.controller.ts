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
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { RegisterSchema, RegisterDto } from './dtos/register.dto';
import { LoginSchema, LoginDto } from './dtos/login.dto';
import { RefreshTokenSchema, RefreshTokenDto } from './dtos/refresh-token.dto';
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  type ForgotPasswordDto,
  type ResetPasswordDto,
  type ChangePasswordDto,
} from './dtos/password-reset.dto';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { Public } from '../../../../shared/decorators/public.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/decorators/current-user.decorator';
import { ApiZodBody } from '../../../../shared/swagger/api-zod.decorator';
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
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới (F1.1)' })
  @ApiZodBody(RegisterSchema, 'Thông tin đăng ký tài khoản mới')
  @ApiResponse({ status: 201, description: 'Tài khoản được tạo thành công' })
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto): Promise<{ id: string; email: string; first_name: string; last_name: string; role: "admin" | "analyst"; created_at: Date; }> {
    return this.registerHandler.execute(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
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
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp mới Access Token bằng Refresh Token (F1.3)' })
  @ApiZodBody(RefreshTokenSchema, 'Refresh token dùng để gia hạn access token')
  @ApiResponse({ status: 200, description: 'Cấp mới Access Token thành công' })
  async refresh(@Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto): Promise<{ access_token: string; refresh_token: string; expires_in: number; remember_me: boolean; expires_at: string; }> {
    return this.refreshAccessTokenHandler.execute(dto.refresh_token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AUTH-05: Quên mật khẩu — gửi OTP 6 số (TTL 10 phút)' })
  @ApiZodBody(ForgotPasswordSchema, 'Email nhận mã OTP')
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordDto): Promise<{ message: string; }> {
    return this.forgotPasswordHandler.execute(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AUTH-06: Đặt lại mật khẩu bằng OTP' })
  @ApiZodBody(ResetPasswordSchema, 'Email + OTP + mật khẩu mới')
  async resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto): Promise<{ message: string; }> {
    return this.resetPasswordHandler.execute(dto.email, dto.otp, dto.new_password);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'AUTH-07: Đổi mật khẩu (giữ phiên hiện tại)' })
  @ApiZodBody(ChangePasswordSchema, 'Mật khẩu hiện tại + mật khẩu mới 2 lần nhập')
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
  async googleStart(@Req() req: Request, @Res() res: Response): Promise<void> {
    const state = randomUUID();
    const url = this.loginWithGoogleHandler.buildAuthorizationUrl(state);
    // Lưu state để callback đối chiếu (chống CSRF).
    // `secure` theo `req.secure` — tôn trọng cấu hình `trust proxy` (Cloudflare Tunnel).
    res.cookie('google_oauth_state', state, {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'AUTH-03: Google callback — đổi mã lấy token và đăng nhập' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về JWT Access Token và Refresh Token' })
  @ApiResponse({ status: 401, description: 'Mã ủy quyền không hợp lệ hoặc email chưa được xác minh' })
  @ApiResponse({ status: 409, description: 'Email đã có tài khoản — cần đăng nhập bằng mật khẩu để liên kết' })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (oauthError) {
      throw new UnauthorizedException({
        message: `Google từ chối yêu cầu đăng nhập (${oauthError}).`,
        error: 'VALIDATION_ERROR',
      });
    }
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const expectedState = typeof cookies?.google_oauth_state === 'string' ? cookies.google_oauth_state : '';
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.loginWithGoogleHandler.execute(
      code ?? '',
      state ?? '',
      expectedState,
      ipAddress,
      userAgent,
    );
    // Xoá cookie state sau khi dùng (dùng thành công hay lỗi).
    res.clearCookie('google_oauth_state');
    res.json(result);
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
