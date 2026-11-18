import { JwtService } from '@nestjs/jwt';
import { type AuthTokenIssuerPort, type AuthTokenPayload } from '../../domain/ports/auth-session.port';
export declare class JwtIssuerAdapter implements AuthTokenIssuerPort {
    private readonly jwt;
    constructor(jwt: JwtService);
    sign(payload: AuthTokenPayload): string;
    verify(token: string): AuthTokenPayload;
}
