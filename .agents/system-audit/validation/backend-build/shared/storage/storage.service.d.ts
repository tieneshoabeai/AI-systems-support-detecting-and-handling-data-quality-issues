import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { IStorageService, StorageQuotaStatus } from './storage.interface';
import type { StoragePort } from '../ports/storage.port';
export declare class StorageService implements IStorageService, StoragePort {
    private readonly config;
    private readonly logger;
    private readonly s3Client;
    private readonly bucketName;
    private readonly isCloudMode;
    private readonly localBasePath;
    private readonly maxQuotaBytes;
    private readonly warnThreshold;
    constructor(config: ConfigService);
    getCloudStatus(): {
        isCloudMode: boolean;
        bucketName: string;
    };
    uploadStream(key: string, stream: Readable, contentType?: string): Promise<string>;
    downloadStream(key: string): Promise<Readable>;
    deleteFile(key: string): Promise<boolean>;
    fileExists(key: string): Promise<boolean>;
    getCurrentUsageBytes(): Promise<number>;
    private calculateDirectorySize;
    checkUploadQuota(incomingBytes: number): Promise<StorageQuotaStatus>;
}
