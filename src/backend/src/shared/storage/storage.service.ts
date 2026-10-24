import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { IStorageService, StorageQuotaStatus } from './storage.interface';

@Injectable()
export class StorageService implements IStorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly isCloudMode: boolean;
  private readonly localBasePath: string;
  private readonly maxQuotaBytes: number;
  private readonly warnThreshold: number;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    this.bucketName = this.config.get<string>('S3_BUCKET_NAME', 'data-quality-storage');
    this.localBasePath = path.resolve(process.cwd(), 'storage');
    this.maxQuotaBytes = Number(this.config.get<number>('STORAGE_MAX_QUOTA_BYTES', 10737418240));
    this.warnThreshold = Number(this.config.get<number>('STORAGE_WARN_THRESHOLD_RATIO', 0.9));

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: this.config.get<string>('S3_REGION', 'auto'),
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isCloudMode = true;
      this.logger.log(`StorageService running in CLOUD MODE (Endpoint: ${endpoint}, Bucket: ${this.bucketName})`);
    } else {
      this.isCloudMode = false;
      if (!fs.existsSync(this.localBasePath)) {
        fs.mkdirSync(this.localBasePath, { recursive: true });
      }
      this.logger.warn(`StorageService running in LOCAL FALLBACK MODE (Path: ${this.localBasePath})`);
    }
  }

  getCloudStatus(): { isCloudMode: boolean; bucketName: string } {
    return { isCloudMode: this.isCloudMode, bucketName: this.bucketName };
  }

  async uploadStream(key: string, stream: Readable, contentType = 'application/octet-stream'): Promise<string> {
    if (this.isCloudMode && this.s3Client) {
      try {
        const upload = new Upload({
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        this.logger.error(`Failed to upload to S3/R2: ${msg}`, stack);
        throw err;
      }
    } else {
      const filePath = path.join(this.localBasePath, key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(filePath);
      await new Promise<void>((resolve, reject) => {
        stream.pipe(writeStream);
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (err) => reject(err));
      });

      return key;
    }
  }

  async downloadStream(key: string): Promise<Readable> {
    if (this.isCloudMode && this.s3Client) {
      try {
        const response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
        return response.Body as Readable;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        this.logger.error(`Failed to download from S3/R2: ${msg}`, stack);
        throw err;
      }
    } else {
      const filePath = path.join(this.localBasePath, key);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found in local storage: ${key}`);
      }
      return fs.createReadStream(filePath);
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    if (this.isCloudMode && this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        this.logger.error(`Failed to delete from S3/R2: ${msg}`, stack);
        return false;
      }
    } else {
      const filePath = path.join(this.localBasePath, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    }
  }

  async fileExists(key: string): Promise<boolean> {
    if (this.isCloudMode && this.s3Client) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
        return true;
      } catch (err: unknown) {
        const errorObject = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
        if (
          errorObject.name === 'NotFound' ||
          (errorObject.$metadata && typeof errorObject.$metadata === 'object' && (errorObject.$metadata as Record<string, unknown>).httpStatusCode === 404)
        ) {
          return false;
        }
        throw err;
      }
    } else {
      const filePath = path.join(this.localBasePath, key);
      return fs.existsSync(filePath);
    }
  }

  async getCurrentUsageBytes(): Promise<number> {
    if (this.isCloudMode && this.s3Client) {
      try {
        let totalBytes = 0;
        let continuationToken: string | undefined = undefined;
        do {
          const response: ListObjectsV2CommandOutput = await this.s3Client.send(
            new ListObjectsV2Command({
              Bucket: this.bucketName,
              ContinuationToken: continuationToken,
            })
          );
          if (response.Contents) {
            for (const item of response.Contents) {
              totalBytes += item.Size ?? 0;
            }
          }
          continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        return totalBytes;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Lỗi khi tính dung lượng S3/R2: ${msg}`);
        return 0;
      }
    } else {
      return this.calculateDirectorySize(this.localBasePath);
    }
  }

  private calculateDirectorySize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    let totalBytes = 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalBytes += this.calculateDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        totalBytes += stat.size;
      }
    }
    return totalBytes;
  }

  async checkUploadQuota(incomingBytes: number): Promise<StorageQuotaStatus> {
    const currentBytes = await this.getCurrentUsageBytes();
    const projectedBytes = currentBytes + incomingBytes;
    const usageRatio = this.maxQuotaBytes > 0 ? projectedBytes / this.maxQuotaBytes : 0;
    const allowed = projectedBytes <= this.maxQuotaBytes;
    const isWarning = usageRatio >= this.warnThreshold;

    if (!allowed) {
      this.logger.error(
        `[QUOTA BLOCK] Vượt quá hạn mức lưu trữ Cloud 100%! Dự kiến: ${projectedBytes}B / Giới hạn: ${this.maxQuotaBytes}B`
      );
    } else if (isWarning) {
      this.logger.warn(
        `[QUOTA WARN] Dung lượng lưu trữ đã đạt ${(usageRatio * 100).toFixed(1)}% (>= 90% ngưỡng cảnh báo)! Dự kiến: ${projectedBytes}B / ${this.maxQuotaBytes}B`
      );
    }

    return {
      allowed,
      isWarning,
      currentBytes,
      maxBytes: this.maxQuotaBytes,
      usageRatio,
    };
  }
}
