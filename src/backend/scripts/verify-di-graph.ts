/**
 * Kiểm tra DI graph của AppModule mà KHÔNG cần kết nối Mongo/Atlas.
 *
 * Mục đích: sau khi đổi token DI (Bước 4 — L3a facade ports), cần chắc chắn
 * mọi module vẫn resolve được dependency đúng (thiếu provider ⇒ app fail lúc boot).
 *
 * Cách làm: stub connection Mongoose (chỉ cần `model()` + `models`), stub storage
 * và không gọi `init()` — Nest sẽ ném lỗi "Nest can't resolve dependencies of ..."
 * ngay ở bước `compile()` nếu còn dependency thiếu.
 *
 * Chạy: pnpm ts-node scripts/verify-di-graph.ts
 */
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppModule } from '../src/app.module';
import { STORAGE_PORT } from '../src/shared/application/ports/storage.port';

async function main(): Promise<void> {
  const mongooseStub = {
    model: () => ({}),
    models: {},
    on: () => undefined,
    once: () => undefined,
    asPromise: () => Promise.resolve(),
    close: async () => undefined,
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getConnectionToken())
    .useValue(mongooseStub)
    .overrideProvider(STORAGE_PORT)
    .useValue({
      uploadStream: async () => 'key',
      downloadStream: async () => undefined,
      deleteFile: async () => true,
      fileExists: async () => false,
      checkUploadQuota: async () => ({ allowed: true, isWarning: false, currentBytes: 0, maxBytes: 0, usageRatio: 0 }),
      getCurrentUsageBytes: async () => 0,
    })
    .compile();

  console.log('✅ DI graph resolve thành công — AppModule có thể boot.');
  await moduleRef.close();
}

main().catch((err: unknown) => {
  console.error('❌ DI graph KHÔNG resolve:');
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
