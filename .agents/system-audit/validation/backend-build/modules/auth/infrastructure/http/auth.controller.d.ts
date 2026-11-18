import { Request } from 'express';
import { AuthService } from '../../application/auth.service';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { type ForgotPasswordDto, type ResetPasswordDto, type ChangePasswordDto } from './dtos/password-reset.dto';
import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        role: "admin" | "analyst";
        created_at: Date;
    }>;
    login(dto: LoginDto, req: Request): Promise<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
        device_name: string;
        user: {
            id: string;
            email: string;
            role: "admin" | "analyst";
        };
    }>;
    refresh(dto: RefreshTokenDto): Promise<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    changePassword(user: CurrentUserPayload, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    googleStart(): Promise<void>;
    googleCallback(): Promise<void>;
    logout(user: CurrentUserPayload): Promise<{
        message: string;
    }>;
    getSessions(user: CurrentUserPayload): Promise<import("../../domain/ports/auth-session.port").AuthSessionRecord[]>;
    revokeSession(user: CurrentUserPayload, sessionId: string): Promise<{
        message: string;
    }>;
}
