/**
 * Storage client tối giản cho các script CLI (không cần Nest DI).
 *
 * Hỗ trợ 2 chế độ, khớp với `StorageService`:
 *  - **CLOUD**: Cloudflare R2 / S3 (biến `S3_ENDPOINT` + `S3_ACCESS_KEY_ID` +
 *    `S3_SECRET_ACCESS_KEY` có trong `.env`).
 *  - **LOCAL FALLBACK**: thư mục `./storage` trong thư mục gốc backend.
 *
 * Chỉ cần những thao tác script migration cần: `fileExists` + `deleteFile`.
 */
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

export interface CliStorage {
  readonly mode: 'cloud' | 'local';
  readonly bucket: string;
  fileExists(key: string): Promise<boolean>;
  deleteFile(key: string): Promise<boolean>;
}

/** Tạo storage client từ biến môi trường (đọc `.env` trước qua `load-env`). */
export function createCliStorage(env: NodeJS.ProcessEnv = process.env): CliStorage {
  const endpoint = env.S3_ENDPOINT;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  const bucket = env.S3_BUCKET_NAME ?? 'data-quality-storage';

  if (endpoint && accessKeyId && secretAccessKey) {
    const client = new S3Client({
      region: env.S3_REGION ?? 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    return {
      mode: 'cloud',
      bucket,
      async fileExists(key: string): Promise<boolean> {
        try {
          await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          return true;
        } catch (err: unknown) {
          const e = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
          if (e.name === 'NotFound' || e.name === 'NoSuchKey') return false;
          const meta = e.$metadata as { httpStatusCode?: number } | undefined;
          if (meta?.httpStatusCode === 404) return false;
          throw err;
        }
      },
      async deleteFile(key: string): Promise<boolean> {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      },
    };
  }

  // LOCAL FALLBACK
  const basePath = path.resolve(process.cwd(), 'storage');
  return {
    mode: 'local',
    bucket: basePath,
    async fileExists(key: string): Promise<boolean> {
      return fs.existsSync(path.join(basePath, key));
    },
    async deleteFile(key: string): Promise<boolean> {
      const filePath = path.join(basePath, key);
      if (!fs.existsSync(filePath)) return false;
      fs.unlinkSync(filePath);
      return true;
    },
  };
}
