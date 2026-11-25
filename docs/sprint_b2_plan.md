# KẾ HOẠCH TRIỂN KHAI CHI TIẾT SPRINT B2 (SPRINT B2 PLAN)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
**Tập tin:** `docs/sprint_b2_plan.md`  
**Phiên bản:** v1.0  
**Giai đoạn:** Sprint B2 - Workspaces, Projects, Datasets Streaming Ingestion & Virtual Grid API  
**Mục tiêu:** Xây dựng hoàn chỉnh 4 module cốt lõi, tuân thủ nguyên tắc Zero Any Policy, Dual-mode Storage (Cloudflare R2 + Local Fallback), R2 Quota Guard (90% Soft Alert, 100% Hard Block), và Virtual Grid Cursor Pagination.

---

## 1. Mục tiêu & 3 Câu hỏi Cốt lõi (Rule 1)
- **Đang làm gì?** Hiện thực hóa 4 Modules nghiệp vụ Backend (`workspaces`, `projects`, `datasets`, `data-view`) với 17 RESTful Endpoints.
- **Cho ai?** Cho dự án Nền tảng Quản lý & Giám sát Chất lượng Dữ liệu AI và người dùng kiểm thử.
- **Để làm gì?** Tiếp nhận tập dữ liệu lớn qua luồng Streaming Busboy, lưu trữ file trên Cloudflare R2 (hoặc Local Storage), băm SHA-256 xác thực toàn vẹn, nhận diện Schema Tầng 0, gom lô `bulkWrite` vào MongoDB Atlas, và cung cấp API phân trang Virtual Grid đạt tốc độ $\le 50\text{ ms}$.

---

## 2. Chi tiết 4 Modules Nghiệp vụ

### Module 1: Workspaces (`src/backend/src/modules/workspaces/`)
- **Nghiệp vụ (F2.1 $\to$ F2.7):**
  - `POST /api/v1/workspaces`: Tạo không gian làm việc mới (người tạo tự động trở thành `owner`).
  - `GET /api/v1/workspaces`: Liệt kê các Workspace người dùng đang tham gia (Admin xem toàn bộ).
  - `GET /api/v1/workspaces/:id`: Xem chi tiết thông tin và danh sách thành viên.
  - `PATCH /api/v1/workspaces/:id`: Cập nhật tên, mô tả Workspace (yêu cầu quyền `owner` hoặc `admin`).
  - `DELETE /api/v1/workspaces/:id`: Xóa mềm Workspace (`deleted_at = now`), tự động cascade soft-delete các Projects bên trong.
  - `POST /api/v1/workspaces/:id/members`: Thêm thành viên mới theo Email với vai trò `owner`, `editor`, hoặc `viewer`.
  - `DELETE /api/v1/workspaces/:id/members/:userId`: Xóa thành viên khỏi Workspace (không cho phép xóa Owner sáng lập).
- **Phân quyền CASL:**
  - Bảo vệ qua `JwtAuthGuard` + `PoliciesGuard`.
- **Cấu trúc lưu trữ:**
  - Collection: `workspaces`
  - Các trường: `name`, `description`, `owner_id`, `members: [{ user_id, role, joined_at }]`, `deleted_at`, `created_at`, `updated_at`.

---

### Module 2: Projects (`src/backend/src/modules/projects/`)
- **Nghiệp vụ (F3.1 $\to$ F3.5):**
  - `POST /api/v1/workspaces/:workspaceId/projects`: Tạo dự án mới trong Workspace.
  - `GET /api/v1/workspaces/:workspaceId/projects`: Danh sách các dự án trong Workspace.
  - `GET /api/v1/projects/:id`: Chi tiết dự án.
  - `PATCH /api/v1/projects/:id`: Cập nhật thông tin dự án.
  - `DELETE /api/v1/projects/:id`: Xóa mềm dự án (cascade soft-delete Dataset liên kết).
- **Ràng buộc Nghiệp vụ Cốt lõi (1 Project = 1 Dataset):**
  - `ProjectSchema` chứa trường `has_dataset: boolean` (mặc định: `false`).
  - Khi tạo Dataset mới: kiểm tra `has_dataset === false`. Nếu đã có Dataset (`true`), trả về lỗi `HTTP 409 Conflict: Mỗi Project chỉ được phép liên kết tối đa 1 Dataset hoạt động`.
  - Khi Dataset được tạo thành công: cập nhật `has_dataset = true`.
  - Khi xóa mềm Dataset: cập nhật `has_dataset = false` để cho phép tái sử dụng Project.

---

### Module 3: Datasets Streaming Ingestion (`src/backend/src/modules/datasets/`)
- **Nghiệp vụ (F4.1 $\to$ F4.6):**
  - `POST /api/v1/projects/:projectId/datasets/upload` (F4.1): Tiếp nhận file tải lên qua luồng Stream đa nhánh.
  - `GET /api/v1/projects/:projectId/datasets` (F4.2): Lấy Dataset của Project.
  - `GET /api/v1/datasets/:id` (F4.3): Xem chi tiết Dataset (schema, row_count, storage_key, file_checksum, status).
  - `PATCH /api/v1/datasets/:id` (F4.4): Đổi tên, mô tả Dataset.
  - `DELETE /api/v1/datasets/:id` (F4.5): Xóa mềm Dataset, cập nhật lại `project.has_dataset = false`.
  - `GET /api/v1/datasets/:id/schema` (F4.6): Xem cấu trúc cột và kiểu dữ liệu suy luận.
- **Quy trình Streaming Ingestion T-Pipe:**
  ```
  Client HTTP Upload Stream (Busboy)
          │
          ├──> Nhánh 1: Crypto Hash SHA-256 (tính toán đồng thời file_checksum)
          │
          ├──> Nhánh 2: StorageService.uploadStream() ──> Cloudflare R2 ('raw_files/{id}_{checksum}.csv')
          │
          └──> Nhánh 3: fast-csv Parser
                │
                ├── [500 dòng đầu] ──> Schema Inference Tầng 0 (string, number, boolean, date)
                │
                └── [Mỗi 1.000 dòng] ──> DatasetRecordModel.bulkWrite(insertMany) ──> MongoDB Atlas
  ```
- **R2 Storage Quota Guard (Kiểm soát Hạn mức):**
  - Kiểm tra dung lượng lưu trữ trước và trong khi upload.
  - Khi dung lượng đạt **90%** (9GB / 10GB): Kích hoạt cảnh báo hệ thống qua `ntfy.sh` và ghi log cảnh báo.
  - Khi dung lượng đạt **100%** (10GB): Chặn đứng tức thì, từ chối ghi file với mã lỗi `HTTP 413 Payload Too Large / Storage Quota Exceeded` để bảo vệ thẻ tín dụng.
- **Đồng bộ Đồ thị Outbox Event:**
  - Ghi sự kiện `DATASET_INGESTED` vào bảng `outbox_events` để đồng bộ node sang Neo4j AuraDB.

---

### Module 4: Virtual Grid API (`src/backend/src/modules/data-view/`)
- **Nghiệp vụ (F5.1 $\to$ F5.3):**
  - `GET /api/v1/datasets/:id/records` (F5.1):
    - Phân trang Keyset/Cursor Pagination với `CursorCodec`.
    - Hỗ trợ lọc theo trường dữ liệu và sắp xếp tăng/giảm theo cột.
    - Truy vấn MongoDB Atlas: `{ dataset_id, row_index: { $gt: lastIndex }, deleted_at: null }`, dùng `.lean()` đảm bảo thời gian phản hồi $\le 50\text{ ms}$.
    - Trả về payload cấu trúc: `{ items, next_cursor, has_more, total_count }`.
  - `PATCH /api/v1/datasets/:id/records/:rowIndex` (F5.2):
    - In-place Cell Edit: Chỉnh sửa giá trị của một hoặc nhiều cột tại dòng chỉ định.
  - `GET /api/v1/datasets/:id/columns/:columnName/stats` (F5.3):
    - Thống kê cột qua MongoDB Aggregation Pipeline: tính Null count, Min, Max, Average và phân bổ dữ liệu thành Histogram 10 khoảng.

---

## 3. Tiêu chuẩn Kỹ thuật Bắt buộc
1. **Quy tắc Zero Any (Mục 13):** Tuyệt đối không dùng kiểu `any` (`: any`, `as any`, `<any>`). Test suite `test/zero-any.spec.ts` sẽ tự động quét và chặn mọi vi phạm.
2. **Xác thực dữ liệu (Zod 100%):** Dùng `ZodValidationPipe` và các Decorator Swagger tự sinh `@ApiZodBody`, `@ApiZodQuery`.
3. **Bảo mật Zero-Trust:** Mọi route đều được bảo vệ bởi `JwtAuthGuard`, `PoliciesGuard`, kiểm tra quyền sở hữu tài nguyên.

---

## 4. Kế hoạch Kiểm thử & Đánh giá (Verification Plan)
1. **Kiểm tra kiểu tĩnh:** `pnpm run type-check` (0 lỗi).
2. **Kiểm tra biên dịch:** `pnpm run build` (Exit code 0).
3. **Kiểm thử tự động:** Viết 4 bộ test suites mới:
   - `test/workspaces.spec.ts`
   - `test/projects.spec.ts`
   - `test/datasets-ingestion.spec.ts`
   - `test/data-view.spec.ts`
   Đảm bảo toàn bộ **11/11 Test Suites PASS 100%**.
4. **Kiểm thử trực tiếp trên Live Database:**
   - Tạo Workspace, tạo Project, upload CSV thực tế, kiểm tra Checksum SHA-256, Schema và Virtual Grid records.
