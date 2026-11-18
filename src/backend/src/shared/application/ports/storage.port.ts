import type { Readable } from 'stream';

export const STORAGE_PORT = Symbol('StoragePort');

export interface StorageQuotaStatus {
  allowed: boolean;
  isWarning: boolean;
  currentBytes: number;
  maxBytes: number;
  usageRatio: number;
}

export interface StoragePort {
  uploadStream(key: string, stream: Readable, contentType?: string): Promise<string>;
  downloadStream(key: string): Promise<Readable>;
  deleteFile(key: string): Promise<boolean>;
  fileExists(key: string): Promise<boolean>;
  checkUploadQuota(incomingBytes: number): Promise<StorageQuotaStatus>;
  getCurrentUsageBytes(): Promise<number>;
}
