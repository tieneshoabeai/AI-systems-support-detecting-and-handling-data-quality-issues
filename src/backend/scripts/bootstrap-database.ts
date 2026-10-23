/**
 * Reset độc lập hoặc toàn bộ CSDL (MongoDB Atlas, Neo4j AuraDB, Cloudflare R2) + Bắn ntfy.sh cảnh báo.
 *
 * Cách dùng:
 *   CONFIRM_RESET=DROP_ALL_DATA TARGET=all pnpm run db:bootstrap
 *   CONFIRM_RESET=DROP_ALL_DATA TARGET=mongo pnpm run db:bootstrap
 *   CONFIRM_RESET=DROP_ALL_DATA TARGET=neo4j pnpm run db:bootstrap
 *   CONFIRM_RESET=DROP_ALL_DATA TARGET=storage pnpm run db:bootstrap
 *
 * Hoặc qua các script rút gọn trong package.json:
 *   CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:all
 *   CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:mongo
 *   CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:neo4j
 *   CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:storage
 */
import './lib/load-env';
import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ListObjectsV2CommandOutput,
  _Object,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { seedMongoData, seedNeo4jData } from './seed-initial-data';
import { sendPushNotification } from './lib/ntfy-notifier';

type ResetTarget = 'all' | 'mongo' | 'neo4j' | 'storage';

function parseTarget(): ResetTarget {
  // Ưu tiên đọc biến môi trường TARGET hoặc đối số dòng lệnh --target=...
  const envTarget = process.env.TARGET?.toLowerCase().trim();
  const cliArg = process.argv.find((arg) => arg.startsWith('--target='));
  const argTarget = cliArg ? cliArg.split('=')[1]?.toLowerCase().trim() : undefined;

  const target = envTarget || argTarget || 'all';
  if (target === 'mongo' || target === 'neo4j' || target === 'storage' || target === 'all') {
    return target;
  }

  console.warn(`[Cảnh báo] Mục tiêu reset "${target}" không hợp lệ. Sử dụng mặc định: "all"`);
  return 'all';
}

async function resetMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI chưa được cấu hình trong .env');
  }

  console.log('Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Không thể kết nối đến MongoDB');
  }

  const dbName = db.databaseName;
  console.log(`\n[Cảnh Báo] Đang xóa sạch cơ sở dữ liệu MongoDB "${dbName}"...`);
  await db.dropDatabase();
  console.log(`[Thành công] Đã xóa toàn bộ collections trên database "${dbName}".`);

  console.log('Đang tái khởi tạo tài khoản Quản trị viên và Workspace mặc định trên MongoDB...');
  await seedMongoData(db);
  await mongoose.disconnect();
}

async function resetNeo4j(): Promise<void> {
  const neo4jUri = process.env.NEO4J_URI;
  const neo4jUser = process.env.NEO4J_USERNAME;
  const neo4jPass = process.env.NEO4J_PASSWORD;

  if (!neo4jUri || !neo4jUser || !neo4jPass) {
    console.warn('[Neo4j AuraDB] Bỏ qua: thiếu cấu hình kết nối trong .env');
    return;
  }

  console.log('Đang kết nối tới Neo4j AuraDB...');
  const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPass));
  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });

  try {
    console.log('\n[Cảnh Báo] Đang dọn sạch toàn bộ đồ thị trên Neo4j AuraDB...');
    await session.run(`MATCH (n) DETACH DELETE n`);
    console.log('[Neo4j AuraDB] Đã xóa toàn bộ nodes và relationships cũ.');
  } finally {
    await session.close();
    await driver.close();
  }

  console.log('Đang tái tạo Constraints và Node Quản trị viên & Workspace trên Neo4j AuraDB...');
  const defaultOrgId = process.env.ORGANIZATION_ID?.trim() ?? '556d6a37bcf86cd799439013';
  const email = (process.env.OWNER_EMAIL ?? 'admin@shool.local').toLowerCase().trim();
  await seedNeo4jData({
    userId: '000000000000000000000001',
    email,
    workspaceId: defaultOrgId,
  });
}

async function resetStorage(): Promise<void> {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucketName = process.env.S3_BUCKET_NAME ?? 'ai-system-data-quality';

  if (endpoint && accessKeyId && secretAccessKey) {
    console.log(`\n[Storage] Đang dọn sạch Cloudflare R2 bucket "${bucketName}"...`);
    const s3 = new S3Client({
      region: process.env.S3_REGION ?? 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    let continuationToken: string | undefined = undefined;
    let deletedCount = 0;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      });
      const listRes: ListObjectsV2CommandOutput = await s3.send(listCommand);

      const objects: _Object[] | undefined = listRes.Contents;
      if (objects && objects.length > 0) {
        const toDelete = objects
          .map((o: _Object) => (o.Key ? { Key: o.Key } : null))
          .filter((k): k is { Key: string } => k !== null);

        if (toDelete.length > 0) {
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: bucketName,
              Delete: { Objects: toDelete },
            })
          );
          deletedCount += toDelete.length;
        }
      }

      continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);

    console.log(`[Storage] Đã xóa ${deletedCount} tệp trong Cloudflare R2 bucket "${bucketName}".`);
  } else {
    const localDir = path.resolve(process.cwd(), 'storage');
    console.log(`\n[Storage] Đang dọn sạch thư mục lưu trữ cục bộ: ${localDir}`);
    if (fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true });
      fs.mkdirSync(localDir, { recursive: true });
    }
    console.log(`[Storage] Đã dọn sạch thư mục lưu trữ cục bộ.`);
  }
}

async function main(): Promise<void> {
  const target = parseTarget();

  if (process.env.CONFIRM_RESET !== 'DROP_ALL_DATA') {
    throw new Error(
      `\n[Từ chối thực thi] Thao tác này sẽ XÓA SẠCH cơ sở dữ liệu mục tiêu: [${target.toUpperCase()}].\n` +
      `Để xác nhận, vui lòng chạy lệnh kèm cờ xác thực:\n` +
      `  CONFIRM_RESET=DROP_ALL_DATA TARGET=${target} pnpm run db:bootstrap\n\n` +
      `Hoặc dùng các script chuyên biệt:\n` +
      `  CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:mongo\n` +
      `  CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:neo4j\n` +
      `  CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:storage\n` +
      `  CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:all\n`
    );
  }

  console.log(`\n======================================================`);
  console.log(`[BẮT ĐẦU RESET DATABASE] Mục tiêu: ${target.toUpperCase()}`);
  console.log(`Thời gian: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  if (target === 'mongo') {
    console.warn(`[Cảnh Báo Tính Toàn Vẹn] Bạn đang chỉ reset MongoDB Atlas.`);
    console.warn(`Các Node Dataset/Version cũ trên Neo4j AuraDB có thể trở thành mồ côi (Orphan Nodes) nếu không được đồng bộ!\n`);
    await resetMongo();
  } else if (target === 'neo4j') {
    console.warn(`[Cảnh Báo Tính Toàn Vẹn] Bạn đang chỉ reset Neo4j AuraDB.`);
    console.warn(`Dữ liệu Datasets/Versions trên MongoDB Atlas sẽ tạm mất liên kết đồ thị cho đến khi được đồng bộ lại qua Outbox Worker!\n`);
    await resetNeo4j();
  } else if (target === 'storage') {
    console.warn(`[Cảnh Báo] Toàn bộ tệp snapshots và raw_files trên Storage sẽ bị xóa vĩnh viễn!\n`);
    await resetStorage();
  } else {
    // target === 'all'
    await resetMongo();
    await resetNeo4j();
    await resetStorage();
  }

  const targetComponentMap: Record<ResetTarget, { name: string; targetId: string }> = {
    all: { name: 'Full Infrastructure (MongoDB Atlas + Neo4j AuraDB + Cloudflare R2)', targetId: 'INFRASTRUCTURE_ALL' },
    mongo: { name: 'Document Store (MongoDB Atlas)', targetId: 'DATABASE_MONGODB' },
    neo4j: { name: 'Graph Store (Neo4j AuraDB)', targetId: 'DATABASE_NEO4J' },
    storage: { name: 'Object Storage (Cloudflare R2)', targetId: 'STORAGE_R2' },
  };

  const comp = targetComponentMap[target];
  const actorEmail = (process.env.OWNER_EMAIL ?? 'admin@shool.local').toLowerCase().trim();
  const timestampIso = new Date().toISOString();

  console.log(`\n[Hoàn tất] Tái khởi tạo thành công cấu phần: ${comp.name}.`);

  // Gửi thông báo Audit Log chuẩn giám sát hạ tầng (SRE / Observability)
  const notified = await sendPushNotification({
    title: `[AUDIT P0] Infrastructure Reset: ${comp.targetId}`,
    message:
      `[SECURITY & INFRASTRUCTURE AUDIT EVENT]\n` +
      `- Event Type: DATABASE_REINITIALIZATION\n` +
      `- Severity: CRITICAL (P0)\n` +
      `- Component: ${comp.name}\n` +
      `- Target Identifier: ${comp.targetId}\n` +
      `- Operator: ${actorEmail} (Role: SYSTEM_ADMINISTRATOR)\n` +
      `- Timestamp UTC: ${timestampIso}\n` +
      `- Status: EXECUTION_SUCCESSFUL\n` +
      `- Impact: Existing data state purged; baseline bootstrap state re-established.`,
    priority: 'urgent',
    tags: ['database', 'security'],
  });

  if (notified) {
    console.log(`[ntfy.sh] Đã gửi thông báo Audit Event tới topic "${process.env.NTFY_TOPIC}" thành công.`);
  } else {
    console.log(`[ntfy.sh] Bỏ qua thông báo (NTFY_ENABLED=false hoặc topic chưa cấu hình).`);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
});
