"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Lỗi máy chủ nội bộ (Internal Server Error)';
        let code = 'INTERNAL_ERROR';
        let details = undefined;
        const isThrottle = exception?.name === 'ThrottlerException' ||
            ((exception instanceof common_1.HttpException) && exception.getStatus() === common_1.HttpStatus.TOO_MANY_REQUESTS && String(exception.message || '').includes('Throttler'));
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            }
            else if (typeof res === 'object' && res !== null) {
                const resObj = res;
                message = resObj.message ?? message;
                code = resObj.error ?? `HTTP_${status}`;
                details = resObj.details ?? resObj.errors;
                if (Array.isArray(resObj.errors) && code === `HTTP_${status}`) {
                    code = 'VALIDATION_ERROR';
                }
                if (Array.isArray(details) && code === 'VALIDATION_ERROR') {
                    details = { fields: details };
                }
                if (status === common_1.HttpStatus.TOO_MANY_REQUESTS && (isThrottle || code === `HTTP_${status}`)) {
                    code = 'LIMIT_EXCEEDED';
                    if (message === 'ThrottlerException: Too Many Requests' || message === `HTTP_${status}`) {
                        message = 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
                    }
                }
            }
        }
        else if (exception instanceof zod_1.ZodError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            code = 'ZOD_VALIDATION_ERROR';
            message = exception.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
        }
        else if (exception instanceof Error) {
            message = exception.message;
            if ('code' in exception &&
                exception.code === 11000) {
                status = common_1.HttpStatus.CONFLICT;
                code = 'DUPLICATE_RESOURCE';
                message = 'Dữ liệu đã tồn tại trong hệ thống (Duplicate Key Error)';
            }
        }
        const formattedMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);
        if (status >= common_1.HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(`[${request.method}] ${request.url} - Status: ${status} - Error: ${formattedMessage}`, exception instanceof Error ? exception.stack : undefined);
        }
        else if (!request.url.includes('favicon.ico')) {
            this.logger.warn(`[${request.method}] ${request.url} - Status: ${status} - Client Error: ${formattedMessage}`);
        }
        response.status(status).json({
            success: false,
            error: {
                code,
                message,
                ...(details !== undefined ? { details } : {}),
                timestamp: new Date().toISOString(),
                path: request.url,
            },
        });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map