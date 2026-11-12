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
  HttpException,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../../application/auth.service';
import { RegisterSchema, RegisterDto } from './dtos/register.dto';
import { LoginSchema, LoginDto } from './dtos/login.dto';
import { RefreshTokenSchema, RefreshTokenDto } from './dtos/refresh-token.dto';
import { ForgotPasswordSchema, ResetPasswordSchema, ChangePasswordSchema, type ForgotPasswordDto, type ResetPasswordDto, type ChangePasswordDto } from './dtos/password-reset.dto';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { Public } from '../../../../shared/decorators/public.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ApiZodBody } from '../../../../shared/swagger/api-zod.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới (F1.1)' })
  @ApiZodBody(RegisterSchema, 'Thông tin đăng ký tài khoản mới')
  @ApiResponse({ status: 201, description: 'Tài khoản được tạo thành công' })
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập hệ thống (F1.2)' })
  @ApiZodBody(LoginSchema, 'Thông tin đăng nhập hệ thống')
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về JWT Access Token và Refresh Token' })
  async login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp mới Access Token bằng Refresh Token (F1.3)' })
  @ApiZodBody(RefreshTokenSchema, 'Refresh token dùng để gia hạn access token')
  @ApiResponse({ status: 200, description: 'Cấp mới Access Token thành công' })
  async refresh(@Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refresh_token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AUTH-05: Quên mật khẩu — gửi OTP 6 số (TTL 10 phút)' })
  @ApiZodBody(ForgotPasswordSchema, 'Email nhận mã OTP')
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AUTH-06: Đặt lại mật khẩu bằng OTP' })
  @ApiZodBody(ResetPasswordSchema, 'Email + OTP + mật khẩu mới')
  async resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otp, dto.new_password);
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
  ) {
    return this.authService.changePassword(user.userId, user.sessionId, dto.current_password, dto.new_password, dto.confirm_password);
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'AUTH-03: Đăng nhập Google — chuyển sang Đợt 2 (chưa khả dụng)' })
  async googleStart() {
    throw new HttpException(
      { message: 'Đăng nhập Google (AUTH-03) thuộc Đợt 2, chưa khả dụng ở Đợt 1. Cần GOOGLE_CLIENT_ID/SECRET + HTTPS redirect URI.', error: 'DEPENDENCY_UNAVAILABLE' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'AUTH-03: Google callback — chuyển sang Đợt 2 (chưa khả dụng)' })
  async googleCallback() {
    throw new HttpException(
      { message: 'Đăng nhập Google (AUTH-03) thuộc Đợt 2, chưa khả dụng ở Đợt 1.', error: 'DEPENDENCY_UNAVAILABLE' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất tài khoản và thu hồi session hiện hành (F1.4)' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  async logout(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.logout(user.sessionId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem danh sách các phiên đăng nhập đang hoạt động (F1.8)' })
  @ApiResponse({ status: 200, description: 'Danh sách các phiên đăng nhập' })
  async getSessions(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getSessions(user.userId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thu hồi phiên đăng nhập từ xa (F1.10)' })
  @ApiResponse({ status: 200, description: 'Thu hồi phiên thành công' })
  async revokeSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') sessionId: string
  ) {
    return this.authService.revokeSession(user.userId, sessionId);
  }
}
