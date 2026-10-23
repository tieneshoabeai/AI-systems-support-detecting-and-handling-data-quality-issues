# GIẢI PHÁP KỸ THUẬT TOÀN DIỆN (TECH SOLUTION SPECIFICATION) - GIAI ĐOẠN 1
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/tech_solution_v3.md`  
**Phiên bản:** v3.0  
**Giai đoạn áp dụng:** Giai đoạn 1 (Core Platform MVP)  
**Ngày lập:** 20/10/2026  
**Trạng thái tài liệu:** Tài liệu thiết kế kỹ thuật chính thức tích hợp CSDL Cloud thật (MongoDB Atlas + Neo4j AuraDB), Soft Delete chuẩn hóa (`deleted_at`) và Mật mã học (SHA-256 & AES-256-GCM).

---

## 1. Lịch sử thay đổi (Change Log v2.0 ➔ v3.0)

- **Thay đổi gì:**
  1. **Chuyển đổi Hạ tầng CSDL sang Đám mây (Cloud Managed Databases):**
     - Loại bỏ hoàn toàn container `mongodb` và `neo4j` khỏi Docker cục bộ.
     - Tích hợp dịch vụ đám mây chính thức: **MongoDB Atlas** (M0 Free Tier) cho lưu trữ Document/Metadata và **Neo4j AuraDB** (Free Tier) cho lưu trữ Đồ thị Phả hệ (Data Lineage DAG).
     - Bổ sung cấu hình kết nối bảo mật bắt buộc: giao thức `mongodb+srv://` (TLS 1.3) và `neo4j+s://` (xác thực chứng chỉ hệ thống CA-signed SSL).
  2. **Tối ưu hóa Độ trễ Mạng (Network Latency Optimization) & Batch Processing:**
     - Thiết lập cơ chế kết nối: Connection Pooling (`maxPoolSize: 20`), `serverSelectionTimeoutMS: 10000`, `connectTimeoutMS: 10000`.
     - Quy chuẩn hóa cơ chế ghi dữ liệu hàng loạt: Bắt buộc dùng `bulkWrite` với batch size từ 500 đến 1.000 records khi Ingest dữ liệu hoặc chạy Clean Rules để hạn chế round-trip qua Internet.
     - Gom nhóm câu lệnh Cypher trên Neo4j bằng mệnh đề `UNWIND $batch` truyền mảng tham số trong 1 network call duy nhất.
  3. **Quản trị Tài nguyên & Giới hạn Gói Miễn phí:**
     - Cấu hình kiểm soát trần dung lượng MongoDB Atlas (ngưỡng an toàn $\le 450\text{ MB} / 512\text{ MB}$).
     - Xây dựng cơ chế cảnh báo và xử lý trạng thái tự động tạm dừng (Auto-pause) của Neo4j AuraDB.
     - Giải phóng hoàn toàn $\sim 1.5\text{ GB}$ RAM máy phát triển cục bộ (chỉ duy trì tiến trình NestJS Backend $\le 512\text{ MB}$).
- **Lý do:**
  - Người dùng quyết định lựa chọn kết nối trực tiếp đến các dịch vụ Cơ sở dữ liệu thật trên Cloud (Phương án 2), giải phóng tối đa tài nguyên RAM cho máy phát triển cá nhân.
- **Ảnh hưởng đến đâu:**
  - Sơ đồ kiến trúc tổng thể, cấu trúc biến môi trường `.env`, nhà cung cấp kết nối `MongooseProvider` và `Neo4jService` trong NestJS, chiến lược xử lý dữ liệu dạng bảng lớn và tài liệu kế hoạch triển khai backend (`docs/backend_implementation_plan_v2.md`).

---

## 2. Kiến trúc Tổng thể Hệ thống (System Architecture Overview)

Hệ thống được thiết kế theo mô hình **Modular Monolith** kết hợp với **Cloud Polyglot Persistence**, bảo đảm phân tách nghiệp vụ rõ ràng, không tốn RAM máy local và sẵn sàng mở rộng quy mô.

```
+-----------------------------------------------------------------------------------+
|                                CLIENT BROWSER (Vite + React)                       |
|  - Virtual Data Grid (TanStack Virtual + TanStack Table)                          |
|  - State Management: TanStack Query (Server State) + Zustand (UI State)            |
|  - Visualizations: Chart.js (Histogram/Bar) + @xyflow/react (Neo4j Lineage DAG)    |
|  - Graceful Offline Guard: Service Worker / Network Detection                      |
+-----------------------------------------------------------------------------------+
                                          |
                                          | HTTPS (TLS 1.3 - Port 443 / Cloudflare)
                                          v
+-----------------------------------------------------------------------------------+
|                         REVERSE PROXY (Nginx Container)                          |
|  - Chấm dứt TLS (SSL Termination)                                                |
|  - Giới hạn kích thước tải lên (client_max_body_size: 100M)                        |
|  - Định tuyến: /api/v1/* -> NestJS Backend, /* -> Frontend Static Web             |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         BACKEND SERVICE (NestJS Modular App)                      |
|  - RAM Cap: 512MB (Node.js heap --max-old-space-size=512)                         |
|  - Guards: JwtAuthGuard, RolesGuard, ResourceOwnershipGuard (ABAC)                 |
|  - Modules: Auth, Users, Workspaces, Projects, Datasets, Visualization,            |
|             Transformations, Versions, Exports, AI Engine                         |
|  - Cryptography Engine: SHA-256 Chaining, AES-256-GCM Streaming                   |
|  - Batching Engine: Busboy / Fast-CSV Parser, BulkWrite Chunker (500-1000 rows)    |
+-----------------------------------------------------------------------------------+
                   |                                       |
                   | TLS 1.3 (mongodb+srv://)              | TLS 1.3 (neo4j+s://)
                   v                                       v
+-----------------------------------+   +-------------------------------------------+
|    MONGODB ATLAS (Cloud M0 Free)  |   |     NEO4J AURADB (Cloud Free Tier)        |
|  - User Profiles & Sessions       |   |  - Directed Acyclic Graph (DAG)           |
|  - Workspaces & Projects Metadata |   |  - Nodes: Dataset, Version, Transform    |
|  - Datasets & Version Checkpoints |   |  - Edges: DERIVED_FROM, APPLIED_TO        |
|  - DatasetRecords (Normalized)    |   |  - Limits: 200.000 Nodes / 400.000 Edges  |
|  - Storage Limit: 512MB           |   |  - Auto-pause Policy: 3 days inactivity   |
+-----------------------------------+   +-------------------------------------------+
```

---

## 3. Thiết kế Cơ sở Dữ liệu Tài liệu (MongoDB Atlas Schemas)

Tất cả các collections đều tuân thủ nguyên tắc:
- Soft-delete tích hợp trường duy nhất `deleted_at: { type: Date, default: null, index: true }`.
- Compound Indexes và Partial Filter Expressions: `{ partialFilterExpression: { deleted_at: null } }`.
- Naming convention: Tên collection và field dùng `snake_case`.

### 3.1. Collection: `users`
Lưu trữ định danh người dùng, phương thức xác thực và vai trò quản trị.
```typescript
import { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password_hash?: string;
  google_id?: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  role: 'admin' | 'analyst';
  status: 'active' | 'blocked';
  password_reset_token_hash?: string;
  password_reset_expires_at?: Date;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    password_hash: { type: String, select: false },
    google_id: { type: String, unique: true, sparse: true, index: true },
    first_name: { type: String, required: true, trim: true, maxlength: 50 },
    last_name: { type: String, required: true, trim: true, maxlength: 50 },
    avatar_url: { type: String, default: null },
    role: { type: String, enum: ['admin', 'analyst'], default: 'analyst', index: true },
    status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },
    password_reset_token_hash: { type: String, default: null, select: false },
    password_reset_expires_at: { type: Date, default: null, select: false },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

UserSchema.index({ created_at: -1, _id: -1 });
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
```

### 3.2. Collection: `user_sessions`
Quản lý các phiên đăng nhập từ xa phục vụ tính năng thu hồi session (F1.8, F1.10).
```typescript
export interface IUserSession extends Document {
  user_id: Schema.Types.ObjectId;
  refresh_token_hash: string; // SHA-256 hash của refresh token
  device_name?: string;
  ip_address?: string;
  user_agent?: string;
  is_revoked: boolean;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export const UserSessionSchema = new Schema<IUserSession>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refresh_token_hash: { type: String, required: true, select: false },
    device_name: { type: String, default: 'Unknown Device' },
    ip_address: { type: String, default: null },
    user_agent: { type: String, default: null },
    is_revoked: { type: Boolean, default: false, index: true },
    expires_at: { type: Date, required: true, index: { expires: '7d' } },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

UserSessionSchema.index({ user_id: 1, is_revoked: 1 });
```

### 3.3. Collection: `workspaces`
Không gian làm việc nhóm hoặc cá nhân của Data Analyst.
```typescript
export interface IWorkspace extends Document {
  name: string;
  description?: string;
  owner_id: Schema.Types.ObjectId;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: null, maxlength: 500 },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

WorkspaceSchema.index({ owner_id: 1, deleted_at: 1, created_at: -1 });
WorkspaceSchema.index({ owner_id: 1, name: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
```

### 3.4. Collection: `projects`
Dự án trực thuộc Workspace (Ràng buộc cứng 1 Project = 1 Dataset).
```typescript
export interface IProject extends Document {
  workspace_id: Schema.Types.ObjectId;
  name: string;
  description?: string;
  dataset_id?: Schema.Types.ObjectId;
  has_dataset: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const ProjectSchema = new Schema<IProject>(
  {
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: null, maxlength: 500 },
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', default: null },
    has_dataset: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

ProjectSchema.index({ workspace_id: 1, deleted_at: 1 });
ProjectSchema.index({ workspace_id: 1, name: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
```

### 3.5. Collection: `datasets`
Metadata của tập dữ liệu đang được xử lý trong Project.
```typescript
export interface IColumnDefinition {
  name: string;
  data_type: 'string' | 'number' | 'boolean' | 'date';
  original_name: string;
  missing_count: number;
}

export interface IDataset extends Document {
  project_id: Schema.Types.ObjectId;
  name: string;
  original_file_name: string;
  file_format: 'csv' | 'xlsx' | 'json';
  file_size_bytes: number;
  file_checksum: string; // Mã SHA-256 fingerprint của tệp gốc
  row_count: number;
  column_count: number;
  columns: IColumnDefinition[];
  current_version: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const DatasetSchema = new Schema<IDataset>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    original_file_name: { type: String, required: true },
    file_format: { type: String, enum: ['csv', 'xlsx', 'json'], required: true },
    file_size_bytes: { type: Number, required: true },
    file_checksum: { type: String, required: true, index: true },
    row_count: { type: Number, required: true, default: 0 },
    column_count: { type: Number, required: true, default: 0 },
    columns: [
      {
        name: { type: String, required: true },
        data_type: { type: String, enum: ['string', 'number', 'boolean', 'date'], required: true },
        original_name: { type: String, required: true },
        missing_count: { type: Number, default: 0 },
      },
    ],
    current_version: { type: Number, default: 1 },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

DatasetSchema.index({ project_id: 1, deleted_at: 1 });
DatasetSchema.index({ file_checksum: 1 });
```

### 3.6. Collection: `dataset_records`
Lưu trữ các hàng dữ liệu dạng bảng sau khi chuẩn hóa.
```typescript
export interface IDatasetRecord extends Document {
  dataset_id: Schema.Types.ObjectId;
  version_number: number;
  row_index: number;
  data: Record<string, any>;
  is_flagged: boolean;
  anomaly_score?: number;
  created_at: Date;
  updated_at: Date;
}

export const DatasetRecordSchema = new Schema<IDatasetRecord>(
  {
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    version_number: { type: Number, required: true, index: true },
    row_index: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    is_flagged: { type: Boolean, default: false, index: true },
    anomaly_score: { type: Number, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Hỗ trợ Keyset Pagination cực nhanh qua Internet
DatasetRecordSchema.index({ dataset_id: 1, version_number: 1, row_index: 1 }, { unique: true });
```

### 3.7. Collection: `dataset_versions`
Bản chụp bất biến (Immutable Checkpoint) và Chuỗi Băm Kiểm toán Toàn vẹn (Merkle-like Audit Chaining).
```typescript
export interface IDatasetVersion extends Document {
  dataset_id: Schema.Types.ObjectId;
  version_number: number;
  parent_version_id?: Schema.Types.ObjectId;
  parent_hash: string;
  data_checksum: string;
  rules_hash: string;
  version_hash: string;
  change_summary: {
    rows_added: number;
    rows_modified: number;
    rows_deleted: number;
    rules_applied: string[];
  };
  created_by: Schema.Types.ObjectId;
  created_at: Date;
}

export const DatasetVersionSchema = new Schema<IDatasetVersion>(
  {
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    version_number: { type: Number, required: true },
    parent_version_id: { type: Schema.Types.ObjectId, ref: 'DatasetVersion', default: null },
    parent_hash: { type: String, required: true },
    data_checksum: { type: String, required: true },
    rules_hash: { type: String, required: true },
    version_hash: { type: String, required: true, unique: true },
    change_summary: {
      rows_added: { type: Number, default: 0 },
      rows_modified: { type: Number, default: 0 },
      rows_deleted: { type: Number, default: 0 },
      rules_applied: [{ type: String }],
    },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

DatasetVersionSchema.index({ dataset_id: 1, version_number: 1 }, { unique: true });
DatasetVersionSchema.index({ version_hash: 1 });
```

---

## 4. Thiết kế Đồ thị Phả hệ Dữ liệu (Neo4j AuraDB Cypher Schema)

Để tương thích với gói Neo4j AuraDB Free (giới hạn 200.000 nodes và tự động tạm dừng sau 3 ngày), cấu trúc đồ thị được tối ưu hóa:

### 4.1. Cấu trúc Nodes và Labels
1. `(:Dataset)`: Đại diện cho thực thể tập dữ liệu.
   - Thuộc tính: `id` (String), `name` (String), `created_at` (String ISO8601).
2. `(:Version)`: Đại diện cho một phiên bản bất biến.
   - Thuộc tính: `id` (String), `version_number` (Integer), `version_hash` (String), `data_checksum` (String), `created_at` (String ISO8601).
3. `(:Transformation)`: Đại diện cho hành động làm sạch / quy tắc biến đổi.
   - Thuộc tính: `id` (String), `rule_name` (String), `parameters` (String JSON), `applied_at` (String ISO8601).

### 4.2. Cấu trúc Relationships
1. `(d:Dataset)-[:HAS_VERSION]->(v:Version)`
2. `(v_child:Version)-[:DERIVED_FROM { timestamp: string }]->(v_parent:Version)`
3. `(v_child:Version)-[:TRANSFORMED_BY]->(t:Transformation)-[:APPLIED_TO]->(v_parent:Version)`

### 4.3. Tối ưu hóa Truy vấn Batch Cypher trên AuraDB
Để tránh round-trip qua Internet, mọi thao tác tạo phả hệ được thực hiện bằng một câu Cypher duy nhất kèm tham số:
```cypher
MATCH (d:Dataset { id: $dataset_id })
OPTIONAL MATCH (parent_v:Version { id: $parent_version_id })
CREATE (new_v:Version {
  id: $new_version_id,
  version_number: $version_number,
  version_hash: $version_hash,
  data_checksum: $data_checksum,
  created_at: $created_at
})
CREATE (d)-[:HAS_VERSION]->(new_v)
FOREACH (_ IN CASE WHEN parent_v IS NOT NULL THEN [1] ELSE [] END |
  CREATE (new_v)-[:DERIVED_FROM { timestamp: $created_at }]->(parent_v)
)
FOREACH (r IN $rules |
  CREATE (t:Transformation { id: r.id, rule_name: r.name, parameters: r.params, applied_at: $created_at })
  CREATE (new_v)-[:TRANSFORMED_BY]->(t)
)
```

---

## 5. Cấu hình Kết nối Cloud & Xử lý Độ trễ Mạng (Network Configuration)

### 5.1. Biến môi trường mẫu (`.env.example`)
```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB Atlas (Cloud)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/data_quality_db?retryWrites=true&w=majority&maxPoolSize=20

# Neo4j AuraDB (Cloud)
NEO4J_URI=neo4j+s://<db-id>.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<your-aura-password>

# JWT Authentication
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars
JWT_REFRESH_EXPIRATION=7d

# Google Gemini API
GEMINI_API_KEY=AIzaSy...
```

### 5.2. Tham số kết nối Mongoose cho MongoDB Atlas
```typescript
MongooseModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    uri: config.get<string>('MONGODB_URI'),
    autoIndex: true,
    serverSelectionTimeoutMS: 10000, // Timeout 10s đề phòng mạng quốc tế chập chờn
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20,
    minPoolSize: 5,
  }),
  inject: [ConfigService],
})
```

### 5.3. Tham số kết nối Driver cho Neo4j AuraDB
```typescript
import neo4j, { Driver } from 'neo4j-driver';

const driver: Driver = neo4j.driver(
  configService.get<string>('NEO4J_URI'), // neo4j+s://
  neo4j.auth.basic(
    configService.get<string>('NEO4J_USERNAME'),
    configService.get<string>('NEO4J_PASSWORD')
  ),
  {
    encrypted: 'ENCRYPTION_ON',
    trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES',
    maxConnectionPoolSize: 25,
    connectionTimeout: 10000,
    maxConnectionLifetime: 60 * 60 * 1000, // 1 hour
  }
);
```

### 5.4. Chiến lược Giảm thiểu Tác động của Độ trễ Mạng (Latency Mitigation)
1. **BulkWrite Chunks:** Khi phân tích file 10.000 – 50.000 dòng, NestJS không insert từng record mà gom thành mảng 1.000 records và gọi 1 lệnh `Model.bulkWrite([...], { ordered: false })`.
2. **Lean Queries:** Tất cả các truy vấn đọc phục vụ Virtual Grid đều dùng `.lean()` để loại bỏ overhead của Mongoose Document Hydration.
3. **Cursor Pagination:** Dựa vào `{ row_index: { $gt: last_seen_index } }` để truy vấn trực tiếp trên B-Tree Index, thời gian tìm kiếm tại Atlas là $O(\log N)$, chỉ tốn chi phí truyền gói tin qua mạng.

---

## 6. Động cơ Mật mã học (Cryptographic Engine Specification)

Được giữ nguyên vẹn tính độc lập và an toàn tuyệt đối theo thiết kế v2.0:

1. **SHA-256 Chaining:**
   - Checksum tệp tải lên: `computeSha256Stream(fileStream)`.
   - Băm kiểm toán phiên bản:
     $$\text{version\_hash} = \text{SHA256}(\text{data\_checksum} + \text{parent\_hash} + \text{rules\_hash})$$
2. **AES-256-GCM Streaming Export:**
   - Dẫn xuất khóa: `PBKDF2(password, salt, 100000, 32, 'sha512')`.
   - Định dạng nhị phân gói tin: `[Magic Bytes (8B)][Salt (16B)][IV (12B)][Encrypted Stream Payload][Auth Tag (16B)]`.
   - Không nạp toàn bộ file vào RAM: Pipeline xử lý qua Node.js `Transform` stream ghi trực tiếp ra HTTP response.

---

## 7. Kết luận

Tài liệu `docs/tech_solution_v3.md` hoàn thành việc chuẩn hóa kiến trúc sang **Cloud Managed Databases**:
- Loại bỏ hoàn toàn gánh nặng RAM máy cục bộ.
- Thiết lập đầy đủ các rào chắn kỹ thuật (Connection Pooling, SSL/TLS, Timeout, Bulk Chunker) để xử lý triệt để bài toán độ trễ mạng Internet.
- Giữ vững các nguyên tắc cốt lõi: Soft Delete `deleted_at: Date | null`, Mật mã học SHA-256/AES-256 và Modular Monolith NestJS.
