"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_STATUSES = void 0;
exports.isProjectCompleted = isProjectCompleted;
exports.PROJECT_STATUSES = ['not_started', 'in_progress', 'completed'];
function isProjectCompleted(status) {
    return status === 'completed';
}
//# sourceMappingURL=project-status.vo.js.map