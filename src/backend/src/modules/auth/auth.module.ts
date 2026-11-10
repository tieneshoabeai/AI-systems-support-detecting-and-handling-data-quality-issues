import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './application/auth.service';
import {
  AUTH_SESSION_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
} from './domain/ports/auth-session.port';
import { AuthController } from './infrastructure/http/auth.controller';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { BcryptHasherAdapter } from './infrastructure/security/bcrypt-hasher.adapter';
import { JwtIssuerAdapter } from './infrastructure/security/jwt-issuer.adapter';
import { UsersAuthLookupAdapter } from './infrastructure/security/users-auth-lookup.adapter';
import { UsersAuthSessionAdapter } from './infrastructure/security/users-auth-session.adapter';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'default_jwt_secret',
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRATION', '15m')) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    BcryptHasherAdapter,
    { provide: PASSWORD_HASHER_PORT, useExisting: BcryptHasherAdapter },
    JwtIssuerAdapter,
    { provide: AUTH_TOKEN_ISSUER_PORT, useExisting: JwtIssuerAdapter },
    UsersAuthLookupAdapter,
    { provide: AUTH_USER_LOOKUP_PORT, useExisting: UsersAuthLookupAdapter },
    UsersAuthSessionAdapter,
    { provide: AUTH_SESSION_PORT, useExisting: UsersAuthSessionAdapter },
  ],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
