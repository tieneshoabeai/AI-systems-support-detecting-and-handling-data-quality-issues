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
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterSchema, RegisterDto } from './dto/register.dto';
import { LoginSchema, LoginDto } from './dto/login.dto';
import { RefreshTokenSchema, RefreshTokenDto } from './dto/refresh-token.dto';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { Public } from '../../shared/decorators/public.decorator';
import { CurrentUser, CurrentUserPayload } from '../../shared/decorators/current-user.decorator';
import { ApiZodBody } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới (F1.1)' })
  @ApiZodBody(RegisterSchema, 'Thông tin đăng ký tài khoản mới')
  @ApiResponse({ status: 201, description: 'Tài khoản được tạo thành công' })
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
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
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp mới Access Token bằng Refresh Token (F1.3)' })
  @ApiZodBody(RefreshTokenSchema, 'Refresh token dùng để gia hạn access token')
  @ApiResponse({ status: 200, description: 'Cấp mới Access Token thành công' })
  async refresh(@Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refresh_token);
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
