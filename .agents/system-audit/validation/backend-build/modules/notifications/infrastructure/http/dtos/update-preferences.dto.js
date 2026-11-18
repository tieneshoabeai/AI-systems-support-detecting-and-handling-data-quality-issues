"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateNotificationPreferencesSchema = void 0;
const zod_1 = require("zod");
exports.UpdateNotificationPreferencesSchema = zod_1.z.object({
    notificationsEnabled: zod_1.z.boolean({ required_error: 'notificationsEnabled là bắt buộc' }),
});
//# sourceMappingURL=update-preferences.dto.js.map