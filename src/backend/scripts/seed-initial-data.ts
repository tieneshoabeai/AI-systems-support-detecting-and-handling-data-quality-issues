/**
 * Seed Quản trị viên khởi đầu và Workspace mặc định vào MongoDB Atlas & Neo4j AuraDB.
 *
 * Cách dùng:
 *   pnpm run db:seed
 *
 * Biến môi trường: MONGODB_URI, ORGANIZATION_ID, OWNER_EMAIL, OWNER_PASSWORD
 */
import './lib/load-env';
import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';

export interface SeedInitialDataOptions {
  seedMongo?: boolean;
  seedNeo4j?: boolean;
}

/**
 * Seed Quản trị viên và Workspace mặc định vào MongoDB Atlas.
 */
export async function seedMongoData(db: mongoose.mongo.Db): Promise<{ userId: string; workspaceId: string; email: string }> {
  const organizationIdRaw = process.env.ORGANIZATION_ID?.trim();
  const email = (process.env.OWNER_EMAIL ?? 'admin@shool.local').toLowerCase().trim();
  const password = process.env.OWNER_PASSWORD ?? 'Admin@123';

  // Xác thực và chuẩn hóa ObjectId 24 ký tự hex cho Workspace / Organization
  let orgObjectId: mongoose.Types.ObjectId;
  if (organizationIdRaw && mongoose.Types.ObjectId.isValid(organizationIdRaw)) {
    orgObjectId = new mongoose.Types.ObjectId(organizationIdRaw);
  } else {
    orgObjectId = new mongoose.Types.ObjectId();
    console.warn(`[Cảnh báo] ORGANIZATION_ID không hợp lệ hoặc thiếu. Tự động sinh ID mới: ${orgObjectId.toHexString()}`);
  }

  const usersCollection = db.collection('users');
  const workspacesCollection = db.collection('workspaces');
  const now = new Date();

  // 1. Tạo hoặc cập nhật tài khoản Quản trị viên (Admin)
  const passwordHash = await bcrypt.hash(password, 12);
  let adminUser = await usersCollection.findOne({ email, deleted_at: null });

  if (!adminUser) {
    const newUserId = new mongoose.Types.ObjectId();
    await usersCollection.insertOne({
      _id: newUserId,
      email,
      password_hash: passwordHash,
      first_name: 'System',
      last_name: 'Admin',
      role: 'admin',
      status: 'active',
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    adminUser = await usersCollection.findOne({ _id: newUserId });
  } else {
    await usersCollection.updateOne(
      { _id: adminUser._id },
      {
        $set: {
          password_hash: passwordHash,
          role: 'admin',
          status: 'active',
          updated_at: now,
        },
      }
    );
  }

  const userId = adminUser!._id.toString();

  // 2. Tạo hoặc cập nhật Workspace / Organization mặc định
  await workspacesCollection.updateOne(
    { _id: orgObjectId },
    {
      $set: {
        name: 'Default Workspace',
        description: 'Không gian làm việc mặc định cho Nền tảng Giám sát & Quản lý Chất lượng Dữ liệu AI',
        owner_id: adminUser!._id,
        members: [
          {
            user_id: adminUser!._id,
            role: 'owner',
            joined_at: now,
          },
        ],
        deleted_at: null,
        updated_at: now,
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true }
  );

  console.log(`\n======================================================`);
  console.log(`[Seed MongoDB Thành Công]`);
  console.log(`  - Database:     ${db.databaseName}`);
  console.log(`  - Admin User:   ${email} (ID: ${userId})`);
  console.log(`  - Workspace:    Default Workspace (ID: ${orgObjectId.toHexString()})`);
  console.log(`  - Quyền hạn:    System Administrator & Workspace Owner`);
  console.log(`======================================================\n`);

  return { userId, workspaceId: orgObjectId.toHexString(), email };
}

/**
 * Khởi tạo Schema, ràng buộc Uniqueness và Node gốc trên Neo4j AuraDB.
 */
export async function seedNeo4jData(params: { userId: string; email: string; workspaceId: string }): Promise<void> {
  const neo4jUri = process.env.NEO4J_URI;
  const neo4jUser = process.env.NEO4J_USERNAME;
  const neo4jPass = process.env.NEO4J_PASSWORD;

  if (!neo4jUri || !neo4jUser || !neo4jPass) {
    console.warn('[Neo4j AuraDB] Bỏ qua seed: thiếu cấu hình NEO4J_URI, NEO4J_USERNAME hoặc NEO4J_PASSWORD');
    return;
  }

  try {
    console.log('Đang khởi tạo Schema & Node gốc trên Neo4j AuraDB...');
    const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPass));
    const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });

    try {
      // Tạo các ràng buộc Uniqueness Constraints cho Graph
      await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (w:Workspace) REQUIRE w.id IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (d:Dataset) REQUIRE d.id IS UNIQUE`);

      // Đồng bộ Node User và Node Workspace
      await session.run(
        `
        MERGE (u:User { id: $userId })
        SET u.email = $email, u.role = 'admin', u.updatedAt = datetime()
        MERGE (w:Workspace { id: $workspaceId })
        SET w.name = 'Default Workspace', w.updatedAt = datetime()
        MERGE (u)-[:OWNS]->(w)
        `,
        {
          userId: params.userId,
          email: params.email,
          workspaceId: params.workspaceId,
        }
      );

      console.log('[Neo4j AuraDB] Đã tạo ràng buộc chỉ mục và Node Admin & Workspace thành công.');
    } finally {
      await session.close();
      await driver.close();
    }
  } catch (neoErr: unknown) {
    const msg = neoErr instanceof Error ? neoErr.message : String(neoErr);
    console.warn(`[Neo4j AuraDB Warning] Không thể seed sang Neo4j: ${msg}`);
  }
}

/**
 * Seed tổng hợp cho cả MongoDB và Neo4j (hỗ trợ tùy chọn bật/tắt từng target).
 */
export async function seedInitialData(
  db?: mongoose.mongo.Db,
  options: SeedInitialDataOptions = { seedMongo: true, seedNeo4j: true }
): Promise<{ userId: string; workspaceId: string }> {
  let userId = '';
  let workspaceId = process.env.ORGANIZATION_ID?.trim() ?? '';
  let email = (process.env.OWNER_EMAIL ?? 'admin@shool.local').toLowerCase().trim();

  if (options.seedMongo !== false) {
    if (!db) {
      throw new Error('Database instance MongoDB Db là bắt buộc khi seedMongo=true');
    }
    const mongoRes = await seedMongoData(db);
    userId = mongoRes.userId;
    workspaceId = mongoRes.workspaceId;
    email = mongoRes.email;
  }

  if (options.seedNeo4j !== false) {
    await seedNeo4jData({ userId, email, workspaceId });
  }

  return { userId, workspaceId };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI chưa được cấu hình trong .env');
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Không thể kết nối đến cơ sở dữ liệu MongoDB');
  }

  await seedInitialData(db);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
