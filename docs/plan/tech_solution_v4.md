# GIẢI PHÁP KỸ THUẬT TOÀN DIỆN (TECH SOLUTION SPECIFICATION) - GIAI ĐOẠN 1
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/tech_solution_v4.md`  
**Phiên bản:** v4.0  
**Giai đoạn áp dụng:** Giai đoạn 1 (Core Platform MVP)  
**Ngày lập:** 20/10/2026  
**Trạng thái tài liệu:** Tài liệu thiết kế kỹ thuật chính thức tích hợp Kiến trúc Hybrid Cloud Storage (MongoDB Atlas + Neo4j AuraDB + Cloudflare R2 / S3 Storage), Soft Delete (`deleted_at: Date | null`) và Mật mã học (SHA-256 & AES-256-GCM).

---

## 1. Lịch sử thay đổi (Change Log v3.0 ➔ v4.0)

- **Thay đổi gì:**
  1. **Bổ sung Tầng Lưu trữ Tệp Đối tượng (Cloud Object Storage - S3 Compatible):**
     - Tích hợp chuẩn **Cloudflare R2** (hoặc AWS S3) cung cấp **10 GB lưu trữ tệp đám mây miễn phí vĩnh viễn** với **0 đồng phí truyền tải dữ liệu ra ngoài (Zero Egress Fees)**.
     - Phân định rõ trách nhiệm lưu trữ:
       - Tệp tải lên gốc: Lưu tại `raw_files/{dataset_id}_{file_checksum}.csv`.
       - Bản sao lưu dữ liệu theo phiên bản: Lưu tại `snapshots/{dataset_id}_v{version_number}.csv`.
       - Tệp xuất bản sạch mã hóa AES-256-GCM: Lưu tại `exports/{export_id}.enc.csv`.
  2. **Giải phóng Hoàn toàn Dung lượng MongoDB Atlas (512MB):**
     - Loại bỏ GridFS; MongoDB Atlas tuyệt đối không chứa dữ liệu nhị phân của tệp.
     - MongoDB Atlas chỉ lưu trữ Metadata, Users, Workspaces, Projects, Schemas, Rules, Checksum hashes, và các bản ghi đã chuẩn hóa (`dataset_records`) phục vụ phân trang Virtual Grid.
  3. **Thiết kế Storage Adapter Linh hoạt (Strategy Pattern):**
     - Xây dựng `StorageService` với 2 chế độ:
       - **Chế độ Cloud (S3/R2):** Kích hoạt khi có cấu hình `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` trong `.env`.
       - **Chế độ Cục bộ (Local Fallback):** Tự động lưu vào thư mục `./storage/` nếu chưa cấu hình tài khoản đám mây, đảm bảo việc code và test không bị gián đoạn.
  4. **Tích hợp Kiến trúc Bảo mật Kênh truyền Cloudflare TLS 1.3 Cổng 443:**
     - Triển khai **Cloudflare Zero Trust Tunnel (`cloudflared`)** kết nối an toàn từ máy chủ cục bộ tới mạng lưới Cloudflare Edge.
     - Phát hành địa chỉ **HTTPS Cổng 443** có chứng chỉ CA quốc tế hợp lệ 100% (Google Trust Services / DigiCert), hiển thị ổ khóa xanh bảo mật.
     - Cấu hình `trust proxy` trong NestJS nhận diện IP thực (`CF-Connecting-IP`) và mã định danh luồng (`CF-Ray`).
- **Lý do:**
  - Giải quyết dứt điểm giới hạn 512MB của MongoDB Atlas Free Tier mà không vi phạm điều khoản dịch vụ (ToS), đồng thời đảm bảo an toàn thông tin toàn trình (Data in Transit) trên Cổng 443.
- **Ảnh hưởng đến đâu:**
  - Sơ đồ kiến trúc tổng thể, cấu trúc `DatasetSchema` (thêm `storage_key`), module `src/backend/src/core/storage`, cấu hình NestJS `main.ts`, và tài liệu kế hoạch triển khai backend (`docs/backend_implementation_plan_v3.md`).

---

## 2. Kiến trúc Tổng thể Hệ thống (Hybrid Cloud Storage & TLS 1.3 Architecture)

```
+-----------------------------------------------------------------------------------+
|                                CLIENT BROWSER (Vite + React)                       |
|  - Virtual Data Grid (TanStack Virtual + TanStack Table)                          |
|  - State Management: TanStack Query (Server State) + Zustand (UI State)            |
|  - Visualizations: Chart.js (Histogram/Bar) + @xyflow/react (Neo4j Lineage DAG)    |
+-----------------------------------------------------------------------------------+
                                          |
                                          | HTTPS (TLS 1.3 - Port 443 / Cloudflare Tunnel)
                                          v
+-----------------------------------------------------------------------------------+
|                         BACKEND SERVICE (NestJS Modular Monolith)                 |
|  - RAM Cap: 512MB (Node.js heap --max-old-space-size=512)                         |
|  - Modules: Auth, Users, Workspaces, Projects, Datasets, Visualization,            |
|             Transformations, Versions, Exports, AI Engine                         |
|  - Cryptography Engine: SHA-256 Chaining, AES-256-GCM Streaming                   |
|  - Storage Engine: S3 Client SDK (@aws-sdk/client-s3)                              |
+-----------------------------------------------------------------------------------+
        |                                 |                                 |
        | TLS 1.3 (mongodb+srv://)        | HTTPS S3 API (Zero Egress)      | TLS 1.3 (neo4j+s://)
        v                                 v                                 v
+-----------------------+     +-----------------------+     +-----------------------+
|  MONGODB ATLAS        |     |  CLOUDFLARE R2 / S3   |     |  NEO4J AURADB         |
|  (Cloud M0 Free)      |     |  (Object Storage)     |     |  (Cloud Free Tier)    |
|                       |     |                       |     |                       |
| - Users & Sessions    |     | - Raw CSV/Excel Files |     | - Lineage Graph (DAG) |
| - Workspaces/Projects |     | - Version Snapshots   |     | - Version Nodes       |
| - Dataset Metadata    |     | - AES-256 .enc.csv    |     | - Transformation Nodes|
| - Virtual Grid Records|     | - Cap: 10GB Miễn phí  |     | - DERIVED_FROM Edges  |
| - Cap: 512MB          |     | - Zero Egress Fees    |     | - Cap: 200k Nodes     |
+-----------------------+     +-----------------------+     +-----------------------+
```

---

## 3. Thiết kế Lưu trữ Đối tượng (Cloudflare R2 / S3 Storage Specification)

### 3.1. Cấu trúc Cây Thư mục trong Bucket (`data-quality-storage`)
```
data-quality-storage/
├── raw_files/                      # Tệp dữ liệu thô gốc tải lên
│   └── {dataset_id}_{file_checksum}.csv
├── snapshots/                      # Bản chụp dữ liệu đầy đủ theo từng phiên bản
│   ├── {dataset_id}_v1.csv
│   └── {dataset_id}_v2.csv
└── exports/                        # Tệp xuất khẩu đã được làm sạch và mã hóa
    ├── {export_id}_clean.csv
    └── {export_id}_encrypted.enc.csv
```

### 3.2. Cấu hình Biến môi trường (`.env.example`)
```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/data_quality_db?retryWrites=true&w=majority&maxPoolSize=20

# Neo4j AuraDB
NEO4J_URI=neo4j+s://<db-id>.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<your-aura-password>

# Cloudflare R2 / AWS S3 Compatible Storage (10GB Miễn phí)
# Để trống nếu muốn chạy chế độ Local Storage Fallback
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your_r2_access_key_id
S3_SECRET_ACCESS_KEY=your_r2_secret_access_key
S3_BUCKET_NAME=data-quality-storage
S3_REGION=auto

# JWT Authentication
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars
JWT_REFRESH_EXPIRATION=7d

# Google Gemini API
GEMINI_API_KEY=AIzaSy...
```

### 3.3. Hiện thực hóa Storage Service Adapter (`src/backend/src/core/storage/storage.service.ts`)
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

export interface IStorageService {
  uploadStream(key: string, stream: Readable, contentType?: string): Promise<string>;
  downloadStream(key: string): Promise<Readable>;
}

@Injectable()
export class StorageService implements IStorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly isCloudMode: boolean;
  private readonly localBasePath = path.resolve(process.cwd(), 'storage');

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    this.bucketName = this.config.get<string>('S3_BUCKET_NAME', 'data-quality-storage');

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: this.config.get<string>('S3_REGION', 'auto'),
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.isCloudMode = true;
      this.logger.log('StorageService running in CLOUD S3/R2 MODE');
    } else {
      this.isCloudMode = false;
      if (!fs.existsSync(this.localBasePath)) {
        fs.mkdirSync(this.localBasePath, { recursive: true });
      }
      this.logger.warn('StorageService running in LOCAL FALLBACK MODE (Path: ./storage)');
    }
  }

  async uploadStream(key: string, stream: Readable, contentType = 'application/octet-stream'): Promise<string> {
    if (this.isCloudMode && this.s3Client) {
      const parallelUploads3 = new Upload({
        client: this.s3Client,
        params: { Bucket: this.bucketName, Key: key, Body: stream, ContentType: contentType },
      });
      await parallelUploads3.done();
      return key;
    } else {
      const filePath = path.join(this.localBasePath, key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const writeStream = fs.createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        stream.pipe(writeStream).on('finish', resolve).on('error', reject);
      });
      return key;
    }
  }

  async downloadStream(key: string): Promise<Readable> {
    if (this.isCloudMode && this.s3Client) {
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: key })
      );
      return response.Body as Readable;
    } else {
      const filePath = path.join(this.localBasePath, key);
      if (!fs.existsSync(filePath)) throw new Error(`File not found: ${key}`);
      return fs.createReadStream(filePath);
    }
  }
}
```

---

## 4. Thiết kế Cơ sở Dữ liệu Tài liệu (MongoDB Atlas Schemas)

Được tối ưu hóa hoàn toàn: Bổ sung con trỏ `storage_key` để tham chiếu trực tiếp đến file trên Cloudflare R2 / S3.

### 4.1. Collection: `datasets`
```typescript
import { Schema, Document } from 'mongoose';

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
  file_checksum: string;     // SHA-256 fingerprint phục vụ deduplication
  storage_key: string;       // Đường dẫn file thô trên S3/R2 (raw_files/...)
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
    storage_key: { type: String, required: true },
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

### 4.2. Collection: `dataset_versions`
```typescript
export interface IDatasetVersion extends Document {
  dataset_id: Schema.Types.ObjectId;
  version_number: number;
  parent_version_id?: Schema.Types.ObjectId;
  parent_hash: string;
  data_checksum: string;
  rules_hash: string;
  version_hash: string;
  snapshot_storage_key?: string; // Đường dẫn snapshot file trên S3/R2 (snapshots/...)
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
    snapshot_storage_key: { type: String, default: null },
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

## 5. Động cơ Mật mã học (Cryptographic Engine Specification)

1. **SHA-256 Chaining:**
   - Checksum tệp tải lên: Được tính đồng thời trong lúc tệp đang được stream lên Cloudflare R2 / S3. Không đọc lại file từ disk/cloud:
     ```
     HTTP Upload Stream ──┬──> SHA-256 Stream Calculator ──> file_checksum
                          └──> S3 Upload Stream Pipe      ──> storage_key (R2)
     ```
   - Chuỗi băm phiên bản: `version_hash = SHA256(data_checksum + parent_hash + rules_hash)`.
2. **AES-256-GCM Streaming Export:**
   - Dẫn xuất khóa PBKDF2 (100.000 vòng lặp, salt 16B, IV 12B, Auth Tag 16B).
   - Tệp mã hóa sau khi sinh ra có thể stream trực tiếp về client hoặc lưu trữ tạm tại `exports/{export_id}.enc.csv` trên Cloudflare R2 với presigned URL tải về an toàn.

---

## 6. Kiến trúc Bảo mật Kênh truyền Cloudflare TLS 1.3 & Cổng 443 (Transport Layer Security)

Để bảo đảm dữ liệu lưu thông trên mạng Internet được bảo mật tuyệt đối, toàn bộ lưu lượng giữa Client và Backend được bảo vệ qua hạ tầng **Cloudflare TLS 1.3 trên Cổng 443**:

### 6.1. Cơ chế Cloudflare Zero Trust Tunnel (`cloudflared`)
- **Tầng Edge (Cloudflare):** Tiếp nhận yêu cầu HTTPS trên Cổng 443 tại 330+ trung tâm dữ liệu. Chứng chỉ số SSL/TLS do Google Trust Services / DigiCert ký duyệt, hiển thị ổ khóa xanh bảo mật trên mọi trình duyệt.
- **Tầng Kết nối Outbound:** Daemon `cloudflared` trên máy chủ thiết lập 4 kết nối outbound bảo mật mã hóa bằng giao thức QUIC/HTTP2 tới Cloudflare.
- **Không Mở Cổng Firewall:** Máy chủ không cần mở port-forwarding trên router và không yêu cầu quyền `root` Linux để bind cổng đặc quyền 443.

### 6.2. Cấu hình NestJS Engine
1. **Tin tưởng Proxy (`trust proxy`):**
   ```typescript
   app.getHttpAdapter().getInstance().set('trust proxy', 1);
   ```
2. **Nhận diện IP Thực tế của Client:**
   - Ưu tiên trích xuất từ tiêu đề `req.headers['cf-connecting-ip']` thay vì IP của tunnel proxy, phục vụ Rate Limiting, Audit Logging và Auth Guards.
   - Ghi nhận mã định danh `CF-Ray` cho mỗi yêu cầu để đối soát lỗi mạng toàn trình.
3. **Chính sách HSTS (HTTP Strict Transport Security):**
   - Helmet cấu hình tiêu đề `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, cấm tuyệt đối hạ cấp kết nối xuống HTTP.
4. **Hỗ trợ Dynamic Swagger Server:**
   - Swagger OpenAPI tự động nhận diện URL `https://*.trycloudflare.com` trên Cổng 443 để hỗ trợ kiểm thử API trực tiếp qua HTTPS.

---

## 7. Kết luận

Kiến trúc **Hybrid Cloud Storage & Cloudflare TLS 1.3 (v4.0)** đạt được sự cân bằng tối ưu:
- **Chi phí & Giới hạn:** 0 đồng (100% Free Tier hợp lệ: Atlas 512MB + R2 10GB + Aura 200k nodes + Cloudflare Quick Tunnel Cổng 443).
- **RAM máy cục bộ:** Không tốn tài nguyên cho database ($\le 512\text{ MB}$ chỉ dành riêng cho NestJS).
- **Bảo mật Toàn trình:** Mã hóa luồng AES-256-GCM (Data at Rest) kết hợp Cloudflare TLS 1.3 Cổng 443 (Data in Transit).
- **Tính khả thi & Chống nghẽn:** Có cơ chế Local Fallback và Quick Tunnel giúp phát triển, kiểm thử và nghiệm thu đồ án ngay lập tức mà không phụ thuộc vào chi phí mua domain hay cấu hình hạ tầng phức tạp.
