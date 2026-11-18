"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const storage_service_1 = require("./shared/storage/storage.service");
const public_decorator_1 = require("./shared/decorators/public.decorator");
let AppController = class AppController {
    mongoConnection;
    storageService;
    constructor(mongoConnection, storageService) {
        this.mongoConnection = mongoConnection;
        this.storageService = storageService;
    }
    async getHealth() {
        const mongoStatus = this.mongoConnection.readyState === 1 ? 'connected' : 'disconnected';
        const storageStatus = this.storageService.getCloudStatus();
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                mongodb_atlas: {
                    status: mongoStatus,
                    readyState: this.mongoConnection.readyState,
                },
                storage: {
                    mode: storageStatus.isCloudMode ? 'cloud_s3_r2' : 'local_fallback',
                    bucket: storageStatus.bucketName,
                },
            },
        };
    }
    async getReady() {
        const started = Date.now();
        const mongoOk = this.mongoConnection.readyState === 1;
        const storage = this.storageService.getCloudStatus();
        const ok = mongoOk;
        const body = {
            status: ok ? 'ok' : 'degraded',
            checks: {
                mongodb: { status: mongoOk ? 'ok' : 'fail', readyState: this.mongoConnection.readyState, latencyMs: Date.now() - started },
                storage: { status: 'ok', mode: storage.isCloudMode ? 'cloud_s3_r2' : 'local_fallback' },
            },
            uptimeSeconds: Math.floor(process.uptime()),
            version: '1.1.0',
            timestamp: new Date().toISOString(),
        };
        if (!ok) {
            const { HttpException } = await Promise.resolve().then(() => __importStar(require('@nestjs/common')));
            throw new HttpException(body, 503);
        }
        return body;
    }
};
exports.AppController = AppController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('health'),
    (0, swagger_1.ApiOperation)({ summary: 'Liveness: tiến trình còn sống, không kiểm tra dependency' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Trạng thái hoạt động chi tiết' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getHealth", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('health/ready'),
    (0, swagger_1.ApiOperation)({ summary: 'Readiness v6: Mongo + storage sẵn sàng mới nhận traffic (ngoài /api/v1)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Sẵn sàng' }),
    (0, swagger_1.ApiResponse)({ status: 503, description: 'Chưa sẵn sàng' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getReady", null);
exports.AppController = AppController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, common_1.Controller)(),
    __param(0, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Connection, storage_service_1.StorageService])
], AppController);
//# sourceMappingURL=app.controller.js.map