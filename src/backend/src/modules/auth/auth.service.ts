import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { computeSha256Buffer } from '../../shared/crypto/crypto.util';
import { detectDeviceName } from '../../shared/utils/device-detector.util';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {
    this.saltRounds = this.config.get<number>('SALT_ROUNDS', 12);
  }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

    const user = await this.usersService.createUser({
      email: dto.email,
      password_hash: passwordHash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role: dto.role || 'analyst',
    });

    return {
      id: user._id.toString(),
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      created_at: user.created_at,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status === 'blocked') {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // 1. Sinh chuỗi refresh token ngẫu nhiên và băm SHA-256
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = computeSha256Buffer(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 2. Tự động nhận diện tên thiết bị từ tiêu đề HTTP User-Agent
    const resolvedDeviceName = detectDeviceName(userAgent);

    // Lưu session vào database
    const session = await this.usersService.createSession({
      user_id: user._id,
      refresh_token_hash: refreshTokenHash,
      device_name: resolvedDeviceName,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: expiresAt,
    });

    // 3. Sinh Access Token có chứa sessionId
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: session._id.toString(),
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      refresh_token: rawRefreshToken,
      expires_in: 15 * 60, // 15 minutes
      device_name: resolvedDeviceName,
      user: {
        id: user._id.toString(),
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    };
  }

  async refreshAccessToken(rawRefreshToken: string) {
    const refreshTokenHash = computeSha256Buffer(rawRefreshToken);

    // Tìm kiếm session còn hiệu lực và chưa bị thu hồi
    const session = await this.usersService.findSessionByTokenHash(refreshTokenHash);

    if (!session) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc phiên đăng nhập đã hết hạn');
    }

    const user = await this.usersService.findById(session.user_id.toString());
    if (!user || user.status === 'blocked' || user.deleted_at !== null) {
      throw new UnauthorizedException('Tài khoản liên kết không còn hoạt động');
    }

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: session._id.toString(),
    };

    const newAccessToken = this.jwtService.sign(payload);

    return {
      access_token: newAccessToken,
      expires_in: 15 * 60,
    };
  }

  async logout(sessionId?: string) {
    if (sessionId) {
      await this.usersService.revokeSessionById(sessionId);
    }
    return { message: 'Đăng xuất thành công' };
  }

  async getSessions(userId: string) {
    return this.usersService.findActiveSessions(userId);
  }

  async revokeSession(userId: string, sessionId: string) {
    const success = await this.usersService.revokeSession(userId, sessionId);
    if (!success) {
      throw new BadRequestException('Không tìm thấy phiên đăng nhập hoặc phiên đã bị thu hồi trước đó');
    }
    return { message: 'Đã thu hồi phiên đăng nhập thành công' };
  }
}
