"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const user_schema_1 = require("./infrastructure/persistence/user.schema");
const user_session_schema_1 = require("./infrastructure/persistence/user-session.schema");
const users_service_1 = require("./application/users.service");
const users_controller_1 = require("./infrastructure/http/users.controller");
const admin_users_controller_1 = require("./infrastructure/http/admin-users.controller");
const users_repository_1 = require("./infrastructure/persistence/users.repository");
const user_repository_port_1 = require("./domain/ports/user.repository.port");
let UsersModule = class UsersModule {
};
exports.UsersModule = UsersModule;
exports.UsersModule = UsersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: 'User', schema: user_schema_1.UserSchema },
                { name: 'UserSession', schema: user_session_schema_1.UserSessionSchema },
            ]),
        ],
        controllers: [users_controller_1.UsersController, admin_users_controller_1.AdminUsersController],
        providers: [users_service_1.UsersService, users_repository_1.UsersRepository, { provide: user_repository_port_1.USER_REPOSITORY_PORT, useExisting: users_repository_1.UsersRepository }],
        exports: [users_service_1.UsersService, users_repository_1.UsersRepository, user_repository_port_1.USER_REPOSITORY_PORT, mongoose_1.MongooseModule],
    })
], UsersModule);
//# sourceMappingURL=users.module.js.map