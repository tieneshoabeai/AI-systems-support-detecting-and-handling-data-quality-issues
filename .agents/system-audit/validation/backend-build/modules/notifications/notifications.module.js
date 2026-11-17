"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const notification_schema_1 = require("./infrastructure/persistence/notification.schema");
const notifications_repository_1 = require("./infrastructure/persistence/notifications.repository");
const notification_repository_port_1 = require("./domain/ports/notification.repository.port");
const notifications_service_1 = require("./application/notifications.service");
const notifications_controller_1 = require("./infrastructure/http/notifications.controller");
const users_module_1 = require("../users/users.module");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: 'Notification', schema: notification_schema_1.NotificationSchema }]),
            users_module_1.UsersModule,
        ],
        controllers: [notifications_controller_1.NotificationsController],
        providers: [
            notifications_repository_1.NotificationsRepository,
            { provide: notification_repository_port_1.NOTIFICATION_REPOSITORY_PORT, useExisting: notifications_repository_1.NotificationsRepository },
            notifications_service_1.NotificationsService,
        ],
        exports: [notifications_service_1.NotificationsService, notifications_repository_1.NotificationsRepository, notification_repository_port_1.NOTIFICATION_REPOSITORY_PORT],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map