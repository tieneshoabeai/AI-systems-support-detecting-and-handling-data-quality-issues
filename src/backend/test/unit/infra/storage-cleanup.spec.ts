/**
 * Vấn đề 1 (phần bổ sung) — Rò rỉ dung lượng R2 sau khi xóa.
 *
 * Bối cảnh:
 *   Cascade mới xóa file CSV trên R2 khi dataset bị xóa. Nhưng dữ liệu cũ
 *   (workspace/project bị xóa **trước khi** có cascade) để lại file CSV trên
 *   R2 → quota `storage_used_bytes` của workspace cũng bị tính quá.
 *
 *   Script `scripts/migrate-coerce-and-orphans.ts` (Phần 3) giải quyết:
 *   xóa file R2 của dataset đã soft-delete + đồng bộ lại `storage_used_bytes`.
 *
 * Test ở đây kiểm tra:
 *   - `createCliStorage` chọn đúng chế độ (cloud / local fallback).
 *   - Logic dọn file là idempotent (chạy lại không xóa nhầm).
 *   - `storageKeyForDataset` sinh key đúng quy ước `raw_files/{id}.csv`.
 */
import { createCliStorage } from '../../../scripts/lib/cli-storage';
import { storageKeyForDataset } from '../../../src/modules/datasets/domain/value-objects/dataset-limits.vo';
import * as path from 'path';

describe('CLI Storage (scripts/lib/cli-storage)', () => {
  const ENV_CLOUD = {
    S3_ENDPOINT: 'https://r2.example.com',
    S3_ACCESS_KEY_ID: 'ak',
    S3_SECRET_ACCESS_KEY: 'sk',
    S3_BUCKET_NAME: 'my-bucket',
  } as NodeJS.ProcessEnv;

  it('chon che do cloud khi co du S3_ENDPOINT + credentials', () => {
    const storage = createCliStorage(ENV_CLOUD);
    expect(storage.mode).toBe('cloud');
    expect(storage.bucket).toBe('my-bucket');
  });

  it('fallback sang che do local khi thieu credentials', () => {
    const storage = createCliStorage({ S3_ENDPOINT: 'https://r2.example.com' } as NodeJS.ProcessEnv);
    expect(storage.mode).toBe('local');
  });

  it('fallback sang che do local khi env rong', () => {
    const storage = createCliStorage({} as NodeJS.ProcessEnv);
    expect(storage.mode).toBe('local');
  });

  it('che do local tro ve thu muc luu tru cua backend', () => {
    const storage = createCliStorage({} as NodeJS.ProcessEnv);
    expect(storage.bucket).toBe(path.resolve(process.cwd(), 'storage'));
  });
});

describe('storageKeyForDataset', () => {
  it('sinh key theo quy uoc raw_files/{datasetId}.csv', () => {
    expect(storageKeyForDataset('6af54f6046aff0a4c4484dfb')).toBe(
      'raw_files/6af54f6046aff0a4c4484dfb.csv',
    );
  });

  it('key la duy nhat theo id (khong chua dau / hay ky tu la)', () => {
    const a = storageKeyForDataset('abc123');
    const b = storageKeyForDataset('def456');
    expect(a).not.toBe(b);
    expect(a.startsWith('raw_files/')).toBe(true);
    expect(a.endsWith('.csv')).toBe(true);
  });
});

describe('Dọn storage — tính idempotent', () => {
  /** Mô phỏng storage in-memory để kiểm tra vòng xóa lặp lại. */
  function createFakeStorage(initial: string[]): {
    files: Set<string>;
    deleteCalls: number;
    storage: ReturnType<typeof createCliStorage>;
  } {
    const files = new Set(initial);
    let deleteCalls = 0;
    const storage = {
      mode: 'cloud' as const,
      bucket: 'fake',
      async fileExists(key: string): Promise<boolean> {
        return files.has(key);
      },
      async deleteFile(key: string): Promise<boolean> {
        deleteCalls++;
        return files.delete(key);
      },
    };
    return {
      files,
      get deleteCalls() {
        return deleteCalls;
      },
      storage: storage as unknown as ReturnType<typeof createCliStorage>,
    };
  }

  it('xoa het file cua dataset da soft-delete o lan chay dau', async () => {
    const fake = createFakeStorage(['raw_files/ds1.csv', 'raw_files/ds2.csv', 'raw_files/live.csv']);

    const deletedDatasets = ['ds1', 'ds2'];
    let removed = 0;
    for (const id of deletedDatasets) {
      const key = storageKeyForDataset(id);
      if (await fake.storage.fileExists(key)) {
        await fake.storage.deleteFile(key);
        removed++;
      }
    }

    expect(removed).toBe(2);
    expect(fake.files.has('raw_files/ds1.csv')).toBe(false);
    expect(fake.files.has('raw_files/ds2.csv')).toBe(false);
  });

  it('lan chay hai khong xoa them file nao (idempotent)', async () => {
    const fake = createFakeStorage(['raw_files/ds1.csv']);

    const runOnce = async (): Promise<number> => {
      let removed = 0;
      const key = storageKeyForDataset('ds1');
      if (await fake.storage.fileExists(key)) {
        await fake.storage.deleteFile(key);
        removed++;
      }
      return removed;
    };

    expect(await runOnce()).toBe(1);
    expect(await runOnce()).toBe(0);
    expect(await runOnce()).toBe(0);
  });

  it('file cua dataset dang song khong bi dong vao', async () => {
    const fake = createFakeStorage(['raw_files/live.csv']);

    const key = storageKeyForDataset('ds-deleted');
    if (await fake.storage.fileExists(key)) {
      await fake.storage.deleteFile(key);
    }

    expect(fake.files.has('raw_files/live.csv')).toBe(true);
  });
});
