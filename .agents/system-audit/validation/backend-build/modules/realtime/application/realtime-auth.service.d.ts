import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/application/users.service';
export interface RealtimeClientIdentity {
    userId: string;
    email: string;
    role: string;
}
export declare class RealtimeAuthService {
    private readonly jwtService;
    private readonly config;
    private readonly usersService;
    private readonly logger;
    constructor(jwtService: JwtService, config: ConfigService, usersService: UsersService);
    extractToken(handshake: {
        auth?: Record<string, unknown>;
        query?: Record<string, unknown>;
    }): string | null;
    verifyToken(token: string): Promise<RealtimeClientIdentity>;
}
