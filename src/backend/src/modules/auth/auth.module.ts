import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import {
  AUTH_SESSION_POLICY_PORT,
  AUTH_SESSION_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
} from './domain/ports/auth-session.port';
import { AuthController } from './infrastructure/http/auth.controller';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { BcryptHasherAdapter } from './infrastructure/security/bcrypt-hasher.adapter';
import { EnvAuthSessionPolicyAdapter } from './infrastructure/security/env-auth-session-policy.adapter';
import { JwtIssuerAdapter } from './infrastructure/security/jwt-issuer.adapter';
import { UsersAuthLookupAdapter } from './infrastructure/security/users-auth-lookup.adapter';
import { UsersAuthSessionAdapter } from './infrastructure/security/users-auth-session.adapter';
import { ChangePasswordHandler } from './application/commands/change-password.handler';
import { ForgotPasswordHandler } from './application/commands/forgot-password.handler';
import { GetSessionByIdHandler } from './application/queries/get-session-by-id.handler';
import { GetSessionsHandler } from './application/queries/get-sessions.handler';
import { LoginHandler } from './application/commands/login.handler';
import { LoginWithGoogleHandler } from './application/commands/login-with-google.handler';
import { GOOGLE_OAUTH_PORT } from './domain/ports/google-oauth.port';
import { GoogleOAuthAdapter } from './infrastructure/security/google-oauth.adapter';
import { LogoutHandler } from './application/commands/logout.handler';
import { RefreshAccessTokenHandler } from './application/commands/refresh-access-token.handler';
import { RegisterHandler } from './application/commands/register.handler';
import { ResetPasswordHandler } from './application/commands/reset-password.handler';
import { RevokeSessionHandler } from './application/commands/revoke-session.handler';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'default_jwt_secret',
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_ACCESS_EXPIRATION',
            '15m',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    ChangePasswordHandler,
    ForgotPasswordHandler,
    LoginHandler,
    LoginWithGoogleHandler,
    LogoutHandler,
    RefreshAccessTokenHandler,
    RegisterHandler,
    ResetPasswordHandler,
    RevokeSessionHandler,
    GetSessionByIdHandler,
    GetSessionsHandler,
    JwtStrategy,
    BcryptHasherAdapter,
    { provide: PASSWORD_HASHER_PORT, useExisting: BcryptHasherAdapter },
    JwtIssuerAdapter,
    { provide: AUTH_TOKEN_ISSUER_PORT, useExisting: JwtIssuerAdapter },
    UsersAuthLookupAdapter,
    { provide: AUTH_USER_LOOKUP_PORT, useExisting: UsersAuthLookupAdapter },
    UsersAuthSessionAdapter,
    { provide: AUTH_SESSION_PORT, useExisting: UsersAuthSessionAdapter },
    EnvAuthSessionPolicyAdapter,
    { provide: AUTH_SESSION_POLICY_PORT, useExisting: EnvAuthSessionPolicyAdapter },
    GoogleOAuthAdapter,
    { provide: GOOGLE_OAUTH_PORT, useExisting: GoogleOAuthAdapter },
  ],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
