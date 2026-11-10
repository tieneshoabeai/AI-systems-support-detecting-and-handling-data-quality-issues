import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_TOKEN_ISSUER_PORT, type AuthTokenIssuerPort, type AuthTokenPayload } from '../../domain/ports/auth-session.port';

/** JWT issuer adapter (driven) — nơi duy nhất chạm JwtService để sign/verify. */
@Injectable()
export class JwtIssuerAdapter implements AuthTokenIssuerPort {
  constructor(private readonly jwt: JwtService) {}
  sign(payload: AuthTokenPayload): string {
    return this.jwt.sign(payload);
  }
  verify(token: string): AuthTokenPayload {
    return this.jwt.verify(token) as AuthTokenPayload;
  }
}
