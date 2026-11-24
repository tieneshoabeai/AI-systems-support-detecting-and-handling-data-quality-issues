/**
 * MIGRATION — quét một lần mẫu học lại RAG cũ (đóng OPEN-FB-01).
 *
 * Vì sao cần: mẫu lưu trước Phần 12 v15 có mô tả là `reason` nguyên văn của
 * người dùng và được chèn vào prompt AI của cả workspace (rủi ro prompt
 * injection). Code mới chỉ sinh mẫu theo khuôn nhưng không sửa dữ liệu đã có.
 *
 * Làm gì (Phần 12 v17 §3.24 T1-7…T1-10, Phần 11 v5 mục 3.18):
 *  1. Xoá mềm mọi mẫu còn sống có mô tả **không** theo khuôn.
 *  2. Dựng lại / cập nhật mẫu theo khuôn từ nhận xét còn hiệu lực (≥ 3 người).
 *
 * Cách dùng (theo Phần 11 mục 3.4.2):
 *   pnpm run db:migrate:scrub-few-shot                 # dry-run (mặc định), không ghi
 *   MIGRATION_CONFIRM=yes pnpm run db:migrate:scrub-few-shot -- --apply
 *   pnpm run db:migrate:scrub-few-shot -- --verify     # chỉ đếm, exit 1 nếu còn mẫu sai khuôn
 *
 * In báo cáo JSON ra stdout (không in nội dung mô tả). Chạy lại nhiều lần cho cùng kết quả.
 */
import './lib/load-env';
import mongoose from 'mongoose';
import { FewShotExampleSchema } from '../src/modules/analysis/infrastructure/persistence/few-shot-example.schema';
import { FindingFeedbackSchema } from '../src/modules/feedback/finding-feedback.schema';
import { embeddingDimFromEnv, runFewShotScrub, type FewShotScrubMode } from './lib/few-shot-scrub';

function parseMode(args: readonly string[]): FewShotScrubMode {
  if (args.includes('--apply') && args.includes('--verify')) {
    throw new Error('Chi chon mot trong --apply / --verify');
  }
  if (args.includes('--verify')) return 'verify';
  if (args.includes('--apply')) return 'apply';
  return 'dry-run';
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (mode === 'apply' && process.env.NODE_ENV !== 'production' && process.env.MIGRATION_CONFIRM !== 'yes') {
    throw new Error('--apply can NODE_ENV=production hoac MIGRATION_CONFIRM=yes (Phan 11 muc 3.4.2)');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI chua duoc cau hinh');

  await mongoose.connect(uri);
  try {
    const fewShot = mongoose.model('FewShotExample', FewShotExampleSchema);
    const feedback = mongoose.model('FindingFeedback', FindingFeedbackSchema);
    const report = await runFewShotScrub({
      fewShot,
      feedback,
      mode,
      embeddingDim: embeddingDimFromEnv(process.env.EMBEDDING_DIM),
    });
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (mode !== 'dry-run' && report.remainingNonTemplated > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((err: unknown) => {
  process.stderr.write(`${JSON.stringify({ error: err instanceof Error ? err.message : String(err) })}\n`);
  process.exit(1);
});
