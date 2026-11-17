"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
const notifications_service_1 = require("../../application/notifications.service");
const list_notifications_query_dto_1 = require("./dtos/list-notifications-query.dto");
const update_preferences_dto_1 = require("./dtos/update-preferences.dto");
let NotificationsController = class NotificationsController {
    notificationsService;
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    async listNotifications(user, query) {
        return this.notificationsService.listForUser(user.userId, query);
    }
    async getUnreadCount(user) {
        return this.notificationsService.countUnread(user.userId);
    }
    async getDetail(user, id) {
        return this.notificationsService.getDetail(user.userId, id);
    }
    async markAsRead(user, id) {
        return this.notificationsService.markAsRead(user.userId, id);
    }
    async updatePreferences(user, dto) {
        return this.notificationsService.updatePreferences(user.userId, dto.notificationsEnabled);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)('notifications'),
    (0, swagger_1.ApiOperation)({ summary: 'NOTIF-01: Trung tâm thông báo của chính mình' }),
    (0, api_zod_decorator_1.ApiZodQuery)(list_notifications_query_dto_1.ListNotificationsQuerySchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(list_notifications_query_dto_1.ListNotificationsQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "listNotifications", null);
__decorate([
    (0, common_1.Get)('notifications/unread-count'),
    (0, swagger_1.ApiOperation)({ summary: 'NOTIF-01: Số thông báo chưa đọc' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Get)('notifications/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'NOTIF-02: Chi tiết thông báo (mở là đánh dấu đã đọc)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Patch)('notifications/:id/read'),
    (0, swagger_1.ApiOperation)({ summary: 'NOTIF-02: Đánh dấu đã đọc' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Patch)('users/me/notification-preferences'),
    (0, swagger_1.ApiOperation)({ summary: 'NOTIF-03: Bật/tắt nhận thông báo' }),
    (0, api_zod_decorator_1.ApiZodBody)(update_preferences_dto_1.UpdateNotificationPreferencesSchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(update_preferences_dto_1.UpdateNotificationPreferencesSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "updatePreferences", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, swagger_1.ApiTags)('Notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map