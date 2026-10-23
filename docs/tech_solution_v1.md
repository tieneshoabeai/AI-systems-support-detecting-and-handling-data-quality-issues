# GIẢI PHÁP KỸ THUẬT TOÀN DIỆN (TECH SOLUTION SPECIFICATION) - GIAI ĐOẠN 1
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/tech_solution_v1.md`  
**Phiên bản:** v1.0  
**Giai đoạn áp dụng:** Giai đoạn 1 (Core Platform MVP)  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Tài liệu thiết kế kỹ thuật chính thức phiên bản gốc  

---

## 1. Lịch sử thay đổi (Change Log)

- **Thay đổi gì:** Khởi tạo tài liệu Giải pháp Kỹ thuật (Tech Solution v1.0) sau khi người dùng phê duyệt 9 module và 42 endpoints từ `docs/feature_spec_v4.md`.
- **Lý do:** Hiện thực hóa các yêu cầu nghiệp vụ và hợp đồng API thành kiến trúc kỹ thuật chi tiết: Schema Database, luồng xử lý Backend NestJS, giải pháp ảo hóa dữ liệu Frontend Vite + React, và cấu hình hạ tầng Docker.
- **Ảnh hưởng đến đâu:** Định hình toàn bộ cấu trúc mã nguồn trong thư mục `src/`, các mô hình dữ liệu Mongoose, truy vấn đồ thị Cypher Neo4j, và thiết lập môi trường Docker.

---

## 2. Kiến trúc Tổng thể Hệ thống (System Architecture Overview)

Hệ thống được thiết kế theo mô hình **Modular Monolith** nhằm tối ưu hóa hiệu năng, giảm độ trễ giao tiếp mạng cục bộ (so với microservices) nhưng vẫn đảm bảo tính phân tách ranh giới nghiệp vụ (domain boundaries) rõ ràng giữa các module.

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
|  - Guards: JwtAuthGuard, RolesGuard, ResourceOwnershipGuard (ABAC)                 |
|  - Modules: Auth, Users, Workspaces, Projects, Datasets, Visualization,            |
|             Transformations, Versions, Exports                                    |
|  - Streaming Engine: Busboy / Fast-CSV Parser, Memory-efficient Cursor Streaming   |
+-----------------------------------------------------------------------------------+
                   |                                       |
                   v                                       v
+-----------------------------------+   +-------------------------------------------+
|    PRIMARY STORE (MongoDB 7.0)    |   |     LINEAGE GRAPH STORE (Neo4j 5.x)       |
|  - User Profiles & Sessions       |   |  - Directed Acyclic Graph (DAG)           |
|  - Workspaces & Projects Metadata |   |  - Nodes: Dataset, Version, Transform    |
|  - Datasets & Version Checkpoints |   |  - Edges: DERIVED_FROM, APPLIED_TO        |
|  - DatasetRecords (Normalized)    |   |  - RAM Limit: 1GB (Heap 512M, Cache 256M) |
|  - RAM Limit: 512MB (Cache 256MB) |   +-------------------------------------------+
+-----------------------------------+
```

---

## 3. Thiết kế Cơ sở Dữ liệu Quan hệ & Tài liệu (MongoDB Mongoose Schemas)

Tất cả các bảng (collections) đều tuân thủ nguyên tắc:
- Sử dụng kiểu dữ liệu rõ ràng.
- Đánh chỉ mục (Index) tối ưu hóa theo tần suất truy vấn.
- Soft-delete tích hợp trường `is_deleted: { type: Boolean, default: false }`.
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
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password_hash: { type: String, select: false },
    google_id: { type: String, unique: true, sparse: true, index: true },
    first_name: { type: String, required: true, trim: true, maxlength: 50 },
    last_name: { type: String, required: true, trim: true, maxlength: 50 },
    avatar_url: { type: String, default: null },
    role: { type: String, enum: ['admin', 'analyst'], default: 'analyst', index: true },
    status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },
    password_reset_token_hash: { type: String, default: null, select: false },
    password_reset_expires_at: { type: Date, default: null, select: false },
    is_deleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Hỗ trợ truy vấn Cursor Pagination theo created_at và _id
UserSchema.index({ created_at: -1, _id: -1 });
```

### 3.2. Collection: `user_sessions`
Quản lý các phiên đăng nhập từ xa phục vụ tính năng thu hồi session (F1.8, F1.10).
```typescript
export interface IUserSession extends Document {
  user_id: Schema.Types.ObjectId;
  refresh_token_hash: string;
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
    expires_at: { type: Date, required: true, index: { expires: '7d' } }, // TTL index tự động dọn dẹp phiên hết hạn
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
  is_deleted: boolean;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: null, maxlength: 500 },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    is_deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

WorkspaceSchema.index({ owner_id: 1, is_deleted: 1, created_at: -1 });
```

### 3.4. Collection: `projects`
Dự án trực thuộc Workspace.
```typescript
export interface IProject extends Document {
  workspace_id: Schema.Types.ObjectId;
  name: string;
  description?: string;
  dataset_id?: Schema.Types.ObjectId; // Pointer tới Dataset duy nhất
  has_dataset: boolean;               // Cờ phục vụ kiểm tra ràng buộc 1 Project = 1 Dataset nhanh chóng
  is_deleted: boolean;
  deleted_at?: Date;
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
    is_deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

ProjectSchema.index({ workspace_id: 1, is_deleted: 1 });
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
  row_count: number;
  column_count: number;
  columns: IColumnDefinition[];
  current_version: number; // Con trỏ phiên bản hiện hành
  is_deleted: boolean;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export const DatasetSchema = new Schema<IDataset>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    original_file_name: { type: String, required: true },
    file_format: { type: String, enum: ['csv', 'xlsx', 'json'], required: true },
    file_size_bytes: { type: Number, required: true },
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
    current_version: { type: Number, default: 1, required: true },
    is_deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
```

### 3.6. Collection: `dataset_records` (Lưu trữ Dữ liệu Dòng Bảng)
Được chuẩn hóa theo từng dòng để phục vụ truy vấn phân trang, tìm kiếm theo cột và tính toán phân phối.
```typescript
export interface IDatasetRecord extends Document {
  dataset_id: Schema.Types.ObjectId;
  version: number;
  row_index: number;
  data: Record<string, any>; // Lưu trữ key-value linh hoạt của từng dòng dữ liệu
}

export const DatasetRecordSchema = new Schema<IDatasetRecord>(
  {
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    version: { type: Number, required: true, index: true },
    row_index: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { versionKey: false }
);

// Chỉ mục phức hợp hỗ trợ truy vấn Virtual Grid có sort/filter
DatasetRecordSchema.index({ dataset_id: 1, version: 1, row_index: 1 });
```

### 3.7. Collection: `dataset_versions` (Nhật ký Phiên bản & Biến đổi)
```typescript
export interface ITransformationOperation {
  action: 'DROP_NULL' | 'IMPUTE_VALUE' | 'SANITIZE_STRING' | 'REPLACE_REGEX' | 'RENAME_COLUMN' | 'DROP_COLUMN';
  target_column: string;
  parameters?: Record<string, any>;
}

export interface IDatasetVersion extends Document {
  dataset_id: Schema.Types.ObjectId;
  version_number: number;
  parent_version_number: number | null;
  operations: ITransformationOperation[];
  row_count: number;
  column_count: number;
  created_by: Schema.Types.ObjectId;
  description: string;
  created_at: Date;
}

export const DatasetVersionSchema = new Schema<IDatasetVersion>(
  {
    dataset_id: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    version_number: { type: Number, required: true },
    parent_version_number: { type: Number, default: null },
    operations: [
      {
        action: {
          type: String,
          enum: ['DROP_NULL', 'IMPUTE_VALUE', 'SANITIZE_STRING', 'REPLACE_REGEX', 'RENAME_COLUMN', 'DROP_COLUMN'],
          required: true,
        },
        target_column: { type: String, required: true },
        parameters: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    row_count: { type: Number, required: true },
    column_count: { type: Number, required: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, default: 'Data transformation applied' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

DatasetVersionSchema.index({ dataset_id: 1, version_number: 1 }, { unique: true });
```

---

## 4. Thiết kế Mô hình Đồ thị Nguồn gốc Dữ liệu (Neo4j Cypher Schema)

Để trực quan hóa chuỗi phả hệ biến đổi (Data Lineage DAG) cho Data Analyst, Neo4j lưu trữ cấu trúc quan hệ giữa Dataset, các phiên bản (Versions), và thao tác biến đổi (Transformations).

### 4.1. Nhãn Thực thể (Node Labels)
1. `(:Dataset { id: String, name: String, projectId: String })`
2. `(:DatasetVersion { id: String, versionNumber: Integer, rowCount: Integer, columnCount: Integer, createdAt: String })`
3. `(:Transformation { id: String, action: String, targetColumn: String, detailsJson: String })`

### 4.2. Quan hệ (Relationships)
- `(d:Dataset)-[:HAS_VERSION]->(v:DatasetVersion)`
- `(vChild:DatasetVersion)-[:DERIVED_FROM]->(vParent:DatasetVersion)`
- `(vChild)-[:TRANSFORMED_BY]->(t:Transformation)`
- `(t)-[:APPLIED_ON]->(vParent:DatasetVersion)`

### 4.3. Các câu lệnh Cypher cốt lõi

#### Khởi tạo gốc dữ liệu (Version 1 - Ingestion)
```cypher
MERGE (d:Dataset { id: $datasetId })
ON CREATE SET d.name = $name, d.projectId = $projectId
CREATE (v:DatasetVersion {
  id: $versionId,
  versionNumber: 1,
  rowCount: $rowCount,
  columnCount: $columnCount,
  createdAt: datetime()
})
CREATE (d)-[:HAS_VERSION]->(v);
```

#### Ghi nhận biến đổi tạo phiên bản mới (Lineage Step)
```cypher
MATCH (d:Dataset { id: $datasetId })-[:HAS_VERSION]->(parent:DatasetVersion { versionNumber: $parentVersion })
CREATE (child:DatasetVersion {
  id: $childVersionId,
  versionNumber: $newVersion,
  rowCount: $newRowCount,
  columnCount: $newColumnCount,
  createdAt: datetime()
})
CREATE (t:Transformation {
  id: apoc.create.uuid(),
  action: $action,
  targetColumn: $targetColumn,
  detailsJson: $detailsJson
})
CREATE (d)-[:HAS_VERSION]->(child)
CREATE (child)-[:DERIVED_FROM]->(parent)
CREATE (child)-[:TRANSFORMED_BY]->(t)
CREATE (t)-[:APPLIED_ON]->(parent);
```

#### Truy vấn toàn bộ DAG Lineage cho React Flow (F8.3)
```cypher
MATCH (d:Dataset { id: $datasetId })-[:HAS_VERSION]->(v:DatasetVersion)
OPTIONAL MATCH (v)-[r:DERIVED_FROM]->(parent:DatasetVersion)
OPTIONAL MATCH (v)-[:TRANSFORMED_BY]->(t:Transformation)
RETURN 
  collect(DISTINCT {
    id: v.id,
    versionNumber: v.versionNumber,
    rowCount: v.rowCount,
    columnCount: v.columnCount,
    createdAt: toString(v.createdAt)
  }) AS nodes,
  collect(DISTINCT {
    id: v.id + '->' + parent.id,
    source: parent.id,
    target: v.id,
    action: t.action,
    targetColumn: t.targetColumn
  }) AS edges;
```

---

## 5. Kiến trúc Backend NestJS (Modular Architecture)

### 5.1. Cấu trúc thư mục mã nguồn (`src/`)
```
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── constants/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── ownership.guard.ts
│   ├── interceptors/
│   │   ├── transform-response.interceptor.ts
│   │   └── logging.interceptor.ts
│   └── pipes/
│       └── validation.pipe.ts
├── database/
│   ├── mongodb.module.ts
│   └── neo4j.module.ts
└── modules/
    ├── auth/
    │   ├── controllers/auth.controller.ts
    │   ├── services/auth.service.ts
    │   ├── strategies/jwt.strategy.ts
    │   └── dto/
    ├── users/
    ├── workspaces/
    ├── projects/
    ├── datasets/
    ├── visualizations/
    ├── transformations/
    ├── versions/
    └── exports/
```

### 5.2. Luồng Xác thực & Bảo mật (Security & JWT Lifecycle)
1. **Access Token:** Ký bằng thuật toán `RS256` hoặc `HS256`, thời hạn 15 phút (chứa `userId`, `email`, `role`).
2. **Refresh Token:** Ký thời hạn 7 ngày, lưu mã băm SHA-256 (`refresh_token_hash`) vào `user_sessions`. Khi refresh, hệ thống thực hiện **Token Rotation** (thu hồi refresh token cũ và sinh cặp token mới).
3. **Phân quyền truy cập tài nguyên (ABAC - Attribute-Based Access Control):**
   - Không cho phép người dùng truyền `owner_id` trong body request.
   - `OwnershipGuard` kiểm tra quyền sở hữu bằng cách truy vấn: `Workspace.owner_id === req.user.userId` trước khi cho phép thao tác sửa/xóa Project hay Dataset bên trong.

### 5.3. Cơ chế Streaming Chống Tràn RAM (Memory Management Under 512MB)
- **Khi Ingestion (Upload file lớn 50MB):** Không load toàn bộ file vào buffer RAM bằng `multer.memoryStorage()`. Sử dụng stream parser đọc trực tiếp từ `busboy` ghi thành các batch 1,000 dòng rồi gọi `model.insertMany(batch, { ordered: false })`.
- **Khi Export (Download CSV/XLSX):** Mở MongoDB cursor với batch size 1,000 dòng (`dataset_records.find({ dataset_id, version }).cursor({ batchSize: 1000 })`). Sử dụng Node.js `stream.Transform` để format dữ liệu thành CSV (UTF-8 BOM) và pipe thẳng ra `res` (HTTP response). RAM chiếm dụng tối đa không vượt quá 50MB.

---

## 6. Kiến trúc Frontend (Vite + React + TypeScript)

### 6.1. Cấu trúc thư mục (`client/src/`)
```
client/src/
├── api/                  # Axios instances + API endpoints
├── assets/
├── components/
│   ├── common/           # Buttons, Modal, Toast, Input
│   ├── grid/             # Virtual Data Grid Table
│   ├── charts/           # Column Distribution Charts (Chart.js)
│   └── lineage/          # Neo4j React Flow Graph
├── features/
│   ├── auth/             # Login, Register, Google Button
│   ├── workspace/        # Workspace & Project navigation
│   ├── dataset/          # File upload dropzone, Query filter bar
│   └── transformation/   # Clean data action modal & Dry-run preview
├── hooks/                # useVirtualGrid, useOfflineStatus, useDebounce
├── stores/               # Zustand UI stores (activeFilters, selection)
├── App.tsx
└── main.tsx
```

### 6.2. Giải pháp Virtual Data Grid cho 100,000+ Dòng
- **Vấn đề:** Nếu render 10,000 thẻ `<tr>` hoặc `<div>` lên DOM cùng lúc, trình duyệt sẽ bị đơ (UI Freeze) và tốn hơn 1GB RAM client.
- **Giải pháp:** Sử dụng `@tanstack/react-virtual` kết hợp `@tanstack/react-table`.
  - Chỉ render đúng số lượng dòng hiển thị trên viewport (khoảng 30–40 dòng).
  - Vị trí scroll được tính toán bằng `virtualRow.start` và `totalSize`.
  - Hỗ trợ server-side pagination và debounced filtering (trì hoãn 300ms khi người dùng gõ từ khóa lọc trên header cột).

### 6.3. Giải pháp Xử lý Ngoại tuyến (Graceful Offline Degradation)
- Đăng ký listener `window.addEventListener('offline', ...)` và `window.addEventListener('online', ...)`.
- Khi mất kết nối:
  - Hiển thị thanh thông báo trạng thái màu vàng: *"Mất kết nối máy chủ. Hệ thống đang chuyển sang chế độ Chỉ đọc (Read-only)."*
  - Vô hiệu hóa (disable) các nút hành động ghi: Tạo Workspace, Tải lên Dataset, Thực thi Transform.
  - Cho phép người dùng tiếp tục xem và tìm kiếm trên các trang dữ liệu đã được TanStack Query cache trong bộ nhớ.

---

## 7. Thiết lập Môi trường Triển khai & Cấu hình Giới hạn Tài nguyên (Docker Compose)

Để đảm bảo máy cục bộ (8GB - 16GB RAM) không bị nghẽn hay treo máy, file `docker-compose.yml` bắt buộc áp đặt giới hạn tài nguyên cứng (`mem_limit`, `cpus`).

```yaml
version: '3.8'

services:
  # 1. Reverse Proxy & SSL Termination
  nginx:
    image: nginx:1.25-alpine
    container_name: dqm_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    mem_limit: 128m
    restart: unless-stopped

  # 2. Backend NestJS
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: dqm_backend
    environment:
      - PORT=3000
      - MONGO_URI=mongodb://mongo:27017/data_quality_db
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=strong_secret_password
      - JWT_SECRET=super_jwt_secret_key_change_in_prod
    depends_on:
      - mongo
      - neo4j
    mem_limit: 512m
    restart: unless-stopped

  # 3. Frontend React + Vite (Nginx Static Host)
  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: dqm_frontend
    mem_limit: 128m
    restart: unless-stopped

  # 4. Primary Datastore: MongoDB
  mongo:
    image: mongo:7.0
    container_name: dqm_mongo
    command: ["--wiredTigerCacheSizeGB", "0.25"] # Khống chế WiredTiger Cache tối đa 256MB RAM
    volumes:
      - mongo_data:/data/db
    mem_limit: 512m
    restart: unless-stopped

  # 5. Graph Datastore: Neo4j
  neo4j:
    image: neo4j:5.15-community
    container_name: dqm_neo4j
    environment:
      - NEO4J_AUTH=neo4j/strong_secret_password
      - NEO4J_dbms_memory_heap_initial__size=256m
      - NEO4J_dbms_memory_heap_max__size=512m
      - NEO4J_dbms_memory_pagecache_size=256m
    volumes:
      - neo4j_data:/data
    mem_limit: 1024m # Giới hạn tối đa 1GB RAM cho container Neo4j
    restart: unless-stopped

volumes:
  mongo_data:
  neo4j_data:
```

---

## 8. Đánh giá Điểm yếu, Rủi ro Kỹ thuật & Biện pháp Giảm thiểu

| Rủi ro kỹ thuật | Mức độ | Bản chất & Điểm yếu | Biện pháp kỹ thuật xử lý |
|---|:---:|---|---|
| **1. Kích thước collection `dataset_records` phình to** | Cao | Lưu mỗi dòng thành 1 document trong MongoDB: Với file 200,000 dòng, tạo 200,000 documents. Khi có 5 phiên bản, tổng số documents lên 1,000,000. | - Đánh index chuẩn `{ dataset_id: 1, version: 1, row_index: 1 }`.<br>- Triển khai cơ chế dọn dẹp các phiên bản cũ trung gian không được gắn Checkpoint. |
| **2. Bất đồng bộ giữa MongoDB và Neo4j (Split-Brain State)** | Trung bình | Transaction lưu bản ghi tại MongoDB thành công nhưng câu lệnh Cypher tại Neo4j thất bại (mạng lỗi hoặc Neo4j nghẽn). | - Sử dụng mô hình Outbox Pattern hoặc Saga nhẹ: Ghi log lỗi vào MongoDB nếu Neo4j sync thất bại, cho phép tiến trình Reconciliation chạy lại. |
| **3. Tràn RAM khi tính toán Profile cột số lớn** | Trung bình | Khi người dùng mở xem Profile của cột chứa dữ liệu dạng chuỗi phức tạp trên 500,000 dòng, pipeline aggregation có thể vượt ngưỡng 100MB RAM của MongoDB. | - Thêm cờ `{ allowDiskUse: true }` cho aggregation pipeline tính toán thống kê cột lớn.<br>- Lưu kết quả profile vào trường `columns.$.profile_cache` trong `datasets` để không tính lại nhiều lần. |

---

## 9. Kế hoạch Kiểm thử & Đánh giá (Verification & Testing Plan)

1. **Unit Test (Jest):**
   - Kiểm thử toàn bộ Business Logic của `TransformationsService` (Drop null, Impute mean/median, Regex replace, Rename column).
   - Kiểm thử logic phân quyền `OwnershipGuard` và `RolesGuard`.
2. **E2E Test (Supertest):**
   - Luồng 1: Đăng ký $\to$ Đăng nhập $\to$ Tạo Workspace $\to$ Tạo Project.
   - Luồng 2: Upload Dataset (Kiểm tra chặn 1:1) $\to$ Query Virtual Grid $\to$ Dry-run transform $\to$ Execute transform $\to$ Rollback version.
3. **Performance Test (k6):**
   - Kịch bản: 50 concurrent users gửi request `POST /api/v1/datasets/:id/query` phân trang ảo hóa.
   - Mục tiêu: P95 Latency $< 200\text{ ms}$, tỷ lệ lỗi $0\%$, RAM của Docker container MongoDB không vượt quá 512MB.
