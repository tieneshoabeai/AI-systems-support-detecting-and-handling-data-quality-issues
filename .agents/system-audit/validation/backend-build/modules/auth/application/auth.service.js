"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const auth_policy_vo_1 = require("../domain/value-objects/auth-policy.vo");
const crypto_util_1 = require("../../../shared/crypto/crypto.util");
const device_detector_util_1 = require("../../../shared/utils/device-detector.util");
const auth_session_port_1 = require("../domain/ports/auth-session.port");
const auth_session_port_2 = require("../domain/ports/auth-session.port");
let AuthService = AuthService_1 = class AuthService {
    users;
    sessions;
    hasher;
    tokens;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(users, sessions, hasher, tokens) {
        this.users = users;
        this.sessions = sessions;
        this.hasher = hasher;
        this.tokens = tokens;
    }
    async register(dto) {
        const email = dto.email.toLowerCase().trim();
        const existing = await this.users.findByEmail(email);
        if (existing) {
            throw new common_1.ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
        }
        const passwordHash = await this.hasher.hash(dto.password);
        const created = await this.users.create({
            email,
            passwordHash,
            firstName: dto.first_name,
            lastName: dto.last_name,
            role: 'analyst',
        });
        return {
            id: created.id,
            email: created.email,
            first_name: dto.first_name,
            last_name: dto.last_name,
            role: created.role,
            created_at: created.createdAt ?? new Date(),
        };
    }
    async login(dto, ipAddress, userAgent) {
        const user = await this.users.findByEmail(dto.email, true);
        if (!user || !user.passwordHash)
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không chính xác');
        if ((0, auth_policy_vo_1.isAccountLocked)(user.status))
            throw new common_1.UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
        const ok = await this.hasher.compare(dto.password, user.passwordHash);
        if (!ok)
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không chính xác');
        const rawRefreshToken = crypto.randomBytes(auth_policy_vo_1.REFRESH_TOKEN_BYTES).toString('hex');
        const refreshTokenHash = (0, crypto_util_1.computeSha256Buffer)(rawRefreshToken);
        const expiresAt = (0, auth_policy_vo_1.refreshTokenExpiry)();
        const resolvedDeviceName = (0, device_detector_util_1.detectDeviceName)(userAgent);
        const session = await this.sessions.createSession({
            userId: user.id,
            refreshTokenHash,
            deviceName: resolvedDeviceName,
            ipAddress,
            userAgent,
            expiresAt,
        });
        const accessToken = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, sessionId: session.id });
        return {
            access_token: accessToken,
            refresh_token: rawRefreshToken,
            expires_in: auth_policy_vo_1.ACCESS_TOKEN_TTL_SECONDS,
            device_name: resolvedDeviceName,
            user: { id: user.id, email: user.email, role: user.role },
        };
    }
    async refreshAccessToken(rawRefreshToken) {
        const refreshTokenHash = (0, crypto_util_1.computeSha256Buffer)(rawRefreshToken);
        const session = await this.sessions.findSessionByTokenHash(refreshTokenHash);
        if (session) {
            const user = await this.users.findById(session.userId);
            if (!user || (0, auth_policy_vo_1.isAccountLocked)(user.status) || user.deletedAt !== null) {
                throw new common_1.UnauthorizedException('Tài khoản liên kết không còn hoạt động');
            }
            await this.sessions.revokeSessionById(session.id).catch(() => undefined);
            const rawNew = crypto.randomBytes(auth_policy_vo_1.REFRESH_TOKEN_BYTES).toString('hex');
            const newHash = (0, crypto_util_1.computeSha256Buffer)(rawNew);
            const created = await this.sessions.createSession({
                userId: session.userId,
                refreshTokenHash: newHash,
                deviceName: session.deviceName ?? undefined,
                ipAddress: session.ipAddress ?? undefined,
                userAgent: session.userAgent ?? undefined,
                expiresAt: (0, auth_policy_vo_1.refreshTokenExpiry)(),
            });
            const newAccessToken = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, sessionId: created.id });
            return { access_token: newAccessToken, refresh_token: rawNew, expires_in: auth_policy_vo_1.ACCESS_TOKEN_TTL_SECONDS };
        }
        try {
            const revoked = await this.sessions.findSessionByTokenHashIncludingRevoked(refreshTokenHash);
            if (revoked) {
                await this.sessions.revokeAllUserSessions(revoked.userId).catch(() => undefined);
                this.logger.warn(`[AUTH-12] Phát hiện tái sử dụng refresh token — đã thu hồi toàn bộ phiên của user ${revoked.userId}.`);
                throw new common_1.UnauthorizedException({ message: 'Phiên đã bị thu hồi do phát hiện tái sử dụng token. Vui lòng đăng nhập lại.', error: 'TOKEN_INVALID' });
            }
        }
        catch (e) {
            if (e instanceof common_1.UnauthorizedException)
                throw e;
        }
        throw new common_1.UnauthorizedException({ message: 'Refresh token không hợp lệ hoặc đã hết hạn', error: 'TOKEN_EXPIRED' });
    }
    async forgotPassword(emailRaw) {
        const email = emailRaw.toLowerCase().trim();
        const neutral = { message: 'Nếu email tồn tại trong hệ thống, mã OTP đã được gửi. Mã có hiệu lực 10 phút.' };
        try {
            const existing = await this.users.findByEmailWithResetSecret(email);
            if (!existing)
                return neutral;
            if ((0, auth_policy_vo_1.isAccountLocked)(existing.status))
                return neutral;
            const now = new Date();
            const windowStart = existing.windowStart ? new Date(existing.windowStart) : null;
            const windowMs = 60 * 60 * 1000;
            let sentCount = existing.sentCount ?? 0;
            let win = windowStart;
            if (!win || now.getTime() - win.getTime() > windowMs) {
                sentCount = 0;
                win = now;
            }
            if (sentCount >= 5) {
                throw new common_1.HttpException({ message: 'Bạn đã gửi OTP quá 5 lần trong 1 giờ. Vui lòng thử lại sau.', error: 'LIMIT_EXCEEDED', details: { retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now.getTime() - (win?.getTime() ?? now.getTime()))) / 1000)) } }, common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
            const otp = String(Math.floor(100000 + Math.random() * 900000));
            const tokenHash = (0, crypto_util_1.computeSha256Buffer)(`otp:${email}:${otp}`);
            const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
            await this.users.setPasswordResetOtp(email, tokenHash, expiresAt, sentCount + 1, win ?? now);
            this.logger.warn(`[AUTH-05] OTP đặt lại mật khẩu cho ${email}: ${otp} (hết hạn 10 phút). Cần cấu hình SMTP để gửi email thật.`);
        }
        catch (e) {
            if (e instanceof common_1.HttpException)
                throw e;
            this.logger.error(`forgotPassword lỗi: ${e.message}`);
        }
        return neutral;
    }
    async resetPassword(emailRaw, otp, newPassword) {
        const email = emailRaw.toLowerCase().trim();
        const st = await this.users.findByEmailWithResetSecret(email);
        if (!st || !st.tokenHash || !st.expiresAt)
            throw new common_1.BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại mã mới.');
        if ((0, auth_policy_vo_1.isAccountLocked)(st.status))
            throw new common_1.UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
        if (new Date() > new Date(st.expiresAt)) {
            await this.users.clearPasswordReset(email);
            throw new common_1.BadRequestException('Mã OTP đã hết hạn (10 phút). Vui lòng gửi lại mã mới.');
        }
        if ((st.attempts ?? 0) >= 3) {
            await this.users.clearPasswordReset(email);
            throw new common_1.BadRequestException('Bạn đã nhập sai OTP quá 3 lần. OTP đã bị vô hiệu hoá, vui lòng gửi lại mã mới.');
        }
        const expect = (0, crypto_util_1.computeSha256Buffer)(`otp:${email}:${otp.trim()}`);
        if (expect !== st.tokenHash) {
            const n = await this.users.incrementResetAttempts(email);
            if (n >= 3) {
                await this.users.clearPasswordReset(email);
                throw new common_1.BadRequestException('Bạn đã nhập sai OTP quá 3 lần. OTP đã bị vô hiệu hoá, vui lòng gửi lại mã mới.');
            }
            throw new common_1.BadRequestException(`Mã OTP không đúng (còn ${3 - n} lần thử).`);
        }
        const hash = await this.hasher.hash(newPassword);
        await this.users.setPasswordHash(st.id, hash);
        await this.users.clearPasswordReset(email);
        await this.sessions.revokeAllUserSessions(st.id);
        this.logger.log(`[AUTH-06] Đặt lại mật khẩu thành công cho ${email}; đã thu hồi toàn bộ phiên.`);
        return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
    }
    async changePassword(userId, currentSessionId, currentPassword, newPassword, confirmPassword) {
        if (newPassword !== confirmPassword)
            throw new common_1.BadRequestException('Hai lần nhập mật khẩu mới không khớp.');
        const u = await this.users.findByIdWithResetSecret(userId);
        if (!u || !u.passwordHash)
            throw new common_1.BadRequestException('Không xác minh được mật khẩu hiện tại.');
        if ((0, auth_policy_vo_1.isAccountLocked)(u.status))
            throw new common_1.UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
        const ok = await this.hasher.compare(currentPassword, u.passwordHash);
        if (!ok)
            throw new common_1.BadRequestException('Mật khẩu hiện tại không đúng.');
        const same = await this.hasher.compare(newPassword, u.passwordHash);
        if (same)
            throw new common_1.BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.');
        const hash = await this.hasher.hash(newPassword);
        await this.users.setPasswordHash(userId, hash);
        try {
            const actives = await this.sessions.findActiveSessions(userId);
            for (const s of actives) {
                if (currentSessionId && s.id === currentSessionId)
                    continue;
                await this.sessions.revokeSession(userId, s.id).catch(() => undefined);
            }
        }
        catch { }
        this.logger.log(`[AUTH-07] Đổi mật khẩu thành công cho user ${userId}; giữ phiên hiện tại.`);
        return { message: 'Đổi mật khẩu thành công.' };
    }
    async logout(sessionId) {
        if (sessionId)
            await this.sessions.revokeSessionById(sessionId);
        return { message: 'Đăng xuất thành công' };
    }
    async getSessions(userId) {
        return this.sessions.findActiveSessions(userId);
    }
    async revokeSession(userId, sessionId) {
        const success = await this.sessions.revokeSession(userId, sessionId);
        if (!success)
            throw new common_1.BadRequestException('Không tìm thấy phiên đăng nhập hoặc phiên đã bị thu hồi trước đó');
        return { message: 'Đã thu hồi phiên đăng nhập thành công' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_session_port_1.AUTH_USER_LOOKUP_PORT)),
    __param(1, (0, common_1.Inject)(auth_session_port_2.AUTH_SESSION_PORT)),
    __param(2, (0, common_1.Inject)(auth_session_port_1.PASSWORD_HASHER_PORT)),
    __param(3, (0, common_1.Inject)(auth_session_port_1.AUTH_TOKEN_ISSUER_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map