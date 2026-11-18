"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIssueStatusSchema = exports.AdminListIssuesQuerySchema = exports.ListIssuesQuerySchema = exports.CreateIssueSchema = void 0;
const zod_1 = require("zod");
exports.CreateIssueSchema = zod_1.z.object({
    issueType: zod_1.z.enum(['function_error', 'display_error', 'data_error', 'feature_feedback', 'other']),
    title: zod_1.z.string().trim().min(1, 'Tiêu đề không được để trống').max(200),
    description: zod_1.z.string().trim().min(1, 'Mô tả không được để trống').max(5000),
    workspaceId: zod_1.z.string().min(1).max(100).optional(),
    apiPath: zod_1.z.string().max(200).optional(),
    errorMessage: zod_1.z.string().max(1000).optional(),
    occurredAt: zod_1.z.string().datetime({ offset: true }).optional(),
});
exports.ListIssuesQuerySchema = zod_1.z.object({
    cursor: zod_1.z.string().min(1).max(2000).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
    sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'status']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    status: zod_1.z.enum(['new', 'in_progress', 'resolved', 'closed']).optional(),
});
exports.AdminListIssuesQuerySchema = zod_1.z.object({
    cursor: zod_1.z.string().min(1).max(2000).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
    sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'status', 'severity']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    status: zod_1.z.enum(['new', 'in_progress', 'resolved', 'closed']).optional(),
});
exports.UpdateIssueStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['new', 'in_progress', 'resolved', 'closed']),
    expectedVersion: zod_1.z.number().int().min(1, 'expectedVersion là bắt buộc'),
});
//# sourceMappingURL=create-issue.dto.js.map