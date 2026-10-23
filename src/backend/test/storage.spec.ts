import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { StorageService } from '../src/shared/storage/storage.service';

describe('StorageService (Dual-mode Storage)', () => {
  let service: StorageService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: <T = unknown>(key: string, defaultValue?: T): T | string | null => {
              if (key === 'S3_BUCKET_NAME') return 'test-bucket';
              return defaultValue ?? null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should initialize in local fallback mode when S3 credentials are absent', () => {
    const status = service.getCloudStatus();
    expect(status.isCloudMode).toBe(false);
  });

  it('should upload stream, check existence, download stream and delete file', async () => {
    const testKey = 'test_files/sample_dataset.csv';
    const testContent = 'col1,col2\nval1,val2';
    const inputStream = Readable.from([Buffer.from(testContent, 'utf8')]);

    // 1. Upload
    const uploadedKey = await service.uploadStream(testKey, inputStream, 'text/csv');
    expect(uploadedKey).toBe(testKey);

    // 2. Exists
    const exists = await service.fileExists(testKey);
    expect(exists).toBe(true);

    // 3. Download
    const downloadStream = await service.downloadStream(testKey);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      downloadStream.on('data', (c) => chunks.push(c));
      downloadStream.on('end', () => resolve());
      downloadStream.on('error', (err) => reject(err));
    });
    const downloadedContent = Buffer.concat(chunks).toString('utf8');
    expect(downloadedContent).toBe(testContent);

    // 4. Delete
    const deleted = await service.deleteFile(testKey);
    expect(deleted).toBe(true);

    const existsAfterDelete = await service.fileExists(testKey);
    expect(existsAfterDelete).toBe(false);
  });
});
