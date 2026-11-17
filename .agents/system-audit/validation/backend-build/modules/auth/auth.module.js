"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const users_module_1 = require("../users/users.module");
const auth_service_1 = require("./application/auth.service");
const auth_session_port_1 = require("./domain/ports/auth-session.port");
const auth_controller_1 = require("./infrastructure/http/auth.controller");
const jwt_strategy_1 = require("./infrastructure/auth/jwt.strategy");
const bcrypt_hasher_adapter_1 = require("./infrastructure/security/bcrypt-hasher.adapter");
const jwt_issuer_adapter_1 = require("./infrastructure/security/jwt-issuer.adapter");
const users_auth_lookup_adapter_1 = require("./infrastructure/security/users-auth-lookup.adapter");
const users_auth_session_adapter_1 = require("./infrastructure/security/users-auth-session.adapter");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            users_module_1.UsersModule,
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                useFactory: (config) => ({
                    secret: config.get('JWT_ACCESS_SECRET') || 'default_jwt_secret',
                    signOptions: {
                        expiresIn: (config.get('JWT_ACCESS_EXPIRATION', '15m')),
                    },
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            jwt_strategy_1.JwtStrategy,
            bcrypt_hasher_adapter_1.BcryptHasherAdapter,
            { provide: auth_session_port_1.PASSWORD_HASHER_PORT, useExisting: bcrypt_hasher_adapter_1.BcryptHasherAdapter },
            jwt_issuer_adapter_1.JwtIssuerAdapter,
            { provide: auth_session_port_1.AUTH_TOKEN_ISSUER_PORT, useExisting: jwt_issuer_adapter_1.JwtIssuerAdapter },
            users_auth_lookup_adapter_1.UsersAuthLookupAdapter,
            { provide: auth_session_port_1.AUTH_USER_LOOKUP_PORT, useExisting: users_auth_lookup_adapter_1.UsersAuthLookupAdapter },
            users_auth_session_adapter_1.UsersAuthSessionAdapter,
            { provide: auth_session_port_1.AUTH_SESSION_PORT, useExisting: users_auth_session_adapter_1.UsersAuthSessionAdapter },
        ],
        exports: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy, passport_1.PassportModule],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map