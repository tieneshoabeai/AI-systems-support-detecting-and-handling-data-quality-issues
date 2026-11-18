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
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let StorageService = StorageService_1 = class StorageService {
    config;
    logger = new common_1.Logger(StorageService_1.name);
    s3Client = null;
    bucketName;
    isCloudMode;
    localBasePath;
    maxQuotaBytes;
    warnThreshold;
    constructor(config) {
        this.config = config;
        const endpoint = this.config.get('S3_ENDPOINT');
        const accessKeyId = this.config.get('S3_ACCESS_KEY_ID');
        const secretAccessKey = this.config.get('S3_SECRET_ACCESS_KEY');
        this.bucketName = this.config.get('S3_BUCKET_NAME', 'data-quality-storage');
        this.localBasePath = path.resolve(process.cwd(), 'storage');
        this.maxQuotaBytes = Number(this.config.get('STORAGE_MAX_QUOTA_BYTES', 10737418240));
        this.warnThreshold = Number(this.config.get('STORAGE_WARN_THRESHOLD_RATIO', 0.9));
        if (endpoint && accessKeyId && secretAccessKey) {
            this.s3Client = new client_s3_1.S3Client({
                region: this.config.get('S3_REGION', 'auto'),
                endpoint,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
            this.isCloudMode = true;
            this.logger.log(`StorageService running in CLOUD MODE (Endpoint: ${endpoint}, Bucket: ${this.bucketName})`);
        }
        else {
            this.isCloudMode = false;
            if (!fs.existsSync(this.localBasePath)) {
                fs.mkdirSync(this.localBasePath, { recursive: true });
            }
            this.logger.warn(`StorageService running in LOCAL FALLBACK MODE (Path: ${this.localBasePath})`);
        }
    }
    getCloudStatus() {
        return { isCloudMode: this.isCloudMode, bucketName: this.bucketName };
    }
    async uploadStream(key, stream, contentType = 'application/octet-stream') {
        if (this.isCloudMode && this.s3Client) {
            try {
                const upload = new lib_storage_1.Upload({
                    client: this.s3Client,
                    params: {
                        Bucket: this.bucketName,
                        Key: key,
                        Body: stream,
                        ContentType: contentType,
                    },
                });
                await upload.done();
                return key;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const stack = err instanceof Error ? err.stack : undefined;
                this.logger.error(`Failed to upload to S3/R2: ${msg}`, stack);
                throw err;
            }
        }
        else {
            const filePath = path.join(this.localBasePath, key);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const writeStream = fs.createWriteStream(filePath);
            await new Promise((resolve, reject) => {
                stream.pipe(writeStream);
                writeStream.on('finish', () => resolve());
                writeStream.on('error', (err) => reject(err));
            });
            return key;
        }
    }
    async downloadStream(key) {
        if (this.isCloudMode && this.s3Client) {
            try {
                const response = await this.s3Client.send(new client_s3_1.GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }));
                return response.Body;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const stack = err instanceof Error ? err.stack : undefined;
                this.logger.error(`Failed to download from S3/R2: ${msg}`, stack);
                throw err;
            }
        }
        else {
            const filePath = path.join(this.localBasePath, key);
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found in local storage: ${key}`);
            }
            return fs.createReadStream(filePath);
        }
    }
    async deleteFile(key) {
        if (this.isCloudMode && this.s3Client) {
            try {
                await this.s3Client.send(new client_s3_1.DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }));
                return true;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const stack = err instanceof Error ? err.stack : undefined;
                this.logger.error(`Failed to delete from S3/R2: ${msg}`, stack);
                return false;
            }
        }
        else {
            const filePath = path.join(this.localBasePath, key);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        }
    }
    async fileExists(key) {
        if (this.isCloudMode && this.s3Client) {
            try {
                await this.s3Client.send(new client_s3_1.HeadObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }));
                return true;
            }
            catch (err) {
                const errorObject = typeof err === 'object' && err !== null ? err : {};
                if (errorObject.name === 'NotFound' ||
                    (errorObject.$metadata && typeof errorObject.$metadata === 'object' && errorObject.$metadata.httpStatusCode === 404)) {
                    return false;
                }
                throw err;
            }
        }
        else {
            const filePath = path.join(this.localBasePath, key);
            return fs.existsSync(filePath);
        }
    }
    async getCurrentUsageBytes() {
        if (this.isCloudMode && this.s3Client) {
            try {
                let totalBytes = 0;
                let continuationToken = undefined;
                do {
                    const response = await this.s3Client.send(new client_s3_1.ListObjectsV2Command({
                        Bucket: this.bucketName,
                        ContinuationToken: continuationToken,
                    }));
                    if (response.Contents) {
                        for (const item of response.Contents) {
                            totalBytes += item.Size ?? 0;
                        }
                    }
                    continuationToken = response.NextContinuationToken;
                } while (continuationToken);
                return totalBytes;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`Lỗi khi tính dung lượng S3/R2: ${msg}`);
                return 0;
            }
        }
        else {
            return this.calculateDirectorySize(this.localBasePath);
        }
    }
    calculateDirectorySize(dirPath) {
        if (!fs.existsSync(dirPath))
            return 0;
        let totalBytes = 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                totalBytes += this.calculateDirectorySize(fullPath);
            }
            else if (entry.isFile()) {
                const stat = fs.statSync(fullPath);
                totalBytes += stat.size;
            }
        }
        return totalBytes;
    }
    async checkUploadQuota(incomingBytes) {
        const currentBytes = await this.getCurrentUsageBytes();
        const projectedBytes = currentBytes + incomingBytes;
        const usageRatio = this.maxQuotaBytes > 0 ? projectedBytes / this.maxQuotaBytes : 0;
        const allowed = projectedBytes <= this.maxQuotaBytes;
        const isWarning = usageRatio >= this.warnThreshold;
        if (!allowed) {
            this.logger.error(`[QUOTA BLOCK] Vượt quá hạn mức lưu trữ Cloud 100%! Dự kiến: ${projectedBytes}B / Giới hạn: ${this.maxQuotaBytes}B`);
        }
        else if (isWarning) {
            this.logger.warn(`[QUOTA WARN] Dung lượng lưu trữ đã đạt ${(usageRatio * 100).toFixed(1)}% (>= 90% ngưỡng cảnh báo)! Dự kiến: ${projectedBytes}B / ${this.maxQuotaBytes}B`);
        }
        return {
            allowed,
            isWarning,
            currentBytes,
            maxBytes: this.maxQuotaBytes,
            usageRatio,
        };
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map