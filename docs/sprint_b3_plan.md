# KẾ HOẠCH TRIỂN KHAI CHI TIẾT SPRINT B3 (SPRINT B3 PLAN)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/sprint_b3_plan.md`  
**Phiên bản:** v1.0  
**Giai đoạn:** Sprint B3 - Đồ thị Phả hệ Neo4j AuraDB, Quản lý Phiên bản Merkle, Động cơ Làm sạch Xác định Tầng 1 & Xuất Dữ liệu Mã hóa Luồng  
**Mục tiêu:** Xây dựng hoàn chỉnh 4 module tiếp theo, kết nối đồ thị DAG trên Neo4j AuraDB bằng Outbox Worker, chuỗi băm Merkle chống giả mạo, snapshot tệp trên R2, động cơ làm sạch xác định 4 nhóm luật, và xuất file bảo mật AES-256-GCM.

---

## 1. Mục tiêu & 3 Câu hỏi Cốt lõi (Rule 1)
- **Đang làm gì?** Hiện thực hóa 4 Modules nghiệp vụ Backend (`lineage`, `versions`, `clean-rules`, `exports`) với 14 RESTful Endpoints mới.
- **Cho ai?** Cho dự án Nền tảng Giám sát & Quản lý Chất lượng Dữ liệu AI, đội ngũ phân tích dữ liệu và người dùng kiểm thử.
- **Để làm gì?** 
  1. Truy vết nguồn gốc dữ liệu (Data Lineage DAG) trực quan trên Neo4j AuraDB để phân tích nguyên nhân gốc (Root-cause) và mức độ ảnh hưởng (Downstream Impact).
  2. Bảo toàn tính toàn vẹn tuyệt đối qua chuỗi băm Merkle `version_hash = SHA256(data_checksum + parent_hash + rules_hash)` và lưu trữ snapshots tệp trên Cloudflare R2.
  3. Làm sạch dữ liệu xác định qua 4 nhóm luật chuẩn hóa (Null, Standardize, Deduplicate, Regex) với cơ chế dry-run xem trước trên 100 dòng mẫu.
  4. Xuất khẩu dữ liệu dạng luồng tiêu thụ ít RAM ($\le 20\text{ MB}$) và hỗ trợ mã hóa luồng AES-256-GCM bằng mật khẩu người dùng.

---

## 2. Chi tiết 4 Modules Nghiệp vụ trong Sprint B3

### Module 1: Đồ thị Phả hệ Neo4j AuraDB (`src/backend/src/modules/lineage/`)
- **Nghiệp vụ (F8.1 $\to$ F8.4):**
  - `GET /api/v1/datasets/:id/lineage` (F8.1): Xuất toàn bộ đồ thị DAG của Dataset gồm Nodes và Edges định dạng chuẩn để React Flow (`@xyflow/react`) hiển thị.
  - `GET /api/v1/datasets/:id/lineage/upstream` (F8.2): Phân tích nguyên nhân gốc rễ (Root-cause Analysis), truy vết ngược chuỗi biến đổi từ phiên bản hiện tại về phiên bản gốc.
  - `GET /api/v1/datasets/:id/lineage/downstream` (F8.3): Phân tích mức độ ảnh hưởng (Downstream Impact), xác định các phiên bản, mô hình, và tệp xuất bị ảnh hưởng nếu một phiên bản dữ liệu bị chỉnh sửa.
  - `POST /api/v1/datasets/:id/lineage/verify` (F8.4): Đối soát tính toàn vẹn (Integrity Verification) giữa chuỗi băm Merkle lưu trên MongoDB Atlas và cấu trúc đồ thị trên Neo4j AuraDB để phát hiện hành vi giả mạo dữ liệu.
- **Mô hình Dữ liệu Đồ thị Neo4j:**
  - Nodes:
    - `(:Dataset { id, name, project_id, workspace_id })`
    - `(:DatasetVersion { id, version_number, version_hash, data_checksum, rules_hash })`
    - `(:Transformation { id, rule_type, description, created_at })`
  - Edges:
    - `(:DatasetVersion)-[:BELONGS_TO]->(:Dataset)`
    - `(:DatasetVersion)-[:DERIVED_FROM]->(:DatasetVersion)`
    - `(:Transformation)-[:PRODUCED]->(:DatasetVersion)`
- **Đồng bộ Bất đồng bộ qua Outbox Worker (`outbox-processor.worker.ts`):**
  - Quét định kỳ bảng `outbox_events` trên MongoDB Atlas với trạng thái `PENDING`.
  - Thực thi các câu lệnh Cypher tham số hóa (`UNWIND $batch`, parameterized queries) sang Neo4j AuraDB.
  - Đánh dấu `PROCESSED` khi thành công hoặc `FAILED` kèm tăng `retry_count` (tối đa 5 lần).

---

### Module 2: Quản lý Phiên bản Dữ liệu Merkle (`src/backend/src/modules/versions/`)
- **Nghiệp vụ (F7.1 $\to$ F7.5):**
  - `POST /api/v1/datasets/:id/versions` (F7.1): Tạo phiên bản mới thủ công hoặc sau khi áp dụng luật làm sạch.
  - `GET /api/v1/datasets/:id/versions` (F7.2): Liệt kê lịch sử tất cả các phiên bản của Dataset.
  - `GET /api/v1/datasets/:id/versions/:versionNumber`: Xem chi tiết 1 phiên bản cụ thể.
  - `POST /api/v1/datasets/:id/versions/:versionNumber/rollback` (F7.3): Khôi phục dữ liệu về trạng thái của phiên bản cũ từ tệp snapshot trên Cloudflare R2.
  - `GET /api/v1/datasets/:id/versions/diff` (F7.4): So sánh khác biệt giữa 2 phiên bản (số dòng thêm/sửa/xóa, các luật đã áp dụng).
- **Cấu trúc Merkle Version Hash:**
  - `data_checksum`: Mã băm SHA-256 của toàn bộ dữ liệu tại thời điểm commit.
  - `parent_hash`: Mã băm `version_hash` của phiên bản cha (phiên bản v1 dùng `0000000000000000000000000000000000000000000000000000000000000000`).
  - `rules_hash`: Mã băm SHA-256 của các luật biến đổi được áp dụng.
  - `version_hash`: $\text{SHA256}(\text{data\_checksum} + \text{parent\_hash} + \text{rules\_hash})$.
- **Lưu trữ Snapshot Tệp:**
  - Tự động sinh tệp CSV snapshot và lưu lên Cloudflare R2 tại `snapshots/{dataset_id}_v{version_number}.csv`.
  - Giải phóng hoàn toàn gánh nặng dung lượng 512MB của MongoDB Atlas.

---

### Module 3: Động cơ Làm sạch Xác định - Tầng 1 (`src/backend/src/modules/clean-rules/`)
- **Nghiệp vụ (F6.1 $\to$ F6.3):**
  - `POST /api/v1/datasets/:id/rules/preview` (F6.1): Dry-run chạy thử danh sách luật trên 100 dòng mẫu đầu tiên, trả về dữ liệu trước và sau khi làm sạch mà **tuyệt đối không ghi đè vào CSDL thật**.
  - `POST /api/v1/datasets/:id/rules/apply` (F6.2): Áp dụng hàng loạt danh sách luật trên toàn bộ dữ liệu qua `bulkWrite` trên Atlas, sau đó tự động kích hoạt tạo `DatasetVersion` mới lưu snapshot tệp lên R2.
  - `GET /api/v1/datasets/:id/rules` (F6.3): Lấy danh sách các luật đã lưu của Dataset.
- **4 Nhóm Luật Làm sạch Xác định (`RuleExecutorService`):**
  1. **Null Handling:** `DROP_ROW` (xóa dòng thiếu), `FILL_DEFAULT` (điền giá trị mặc định), `FILL_MEAN` / `FILL_MEDIAN` (điền giá trị trung bình/trung vị).
  2. **Standardization:** `UPPERCASE`, `LOWERCASE`, `TRIM_WHITESPACE`, `DATE_FORMAT` (chuẩn hóa về YYYY-MM-DD).
  3. **Deduplication:** `DROP_DUPLICATES` theo danh sách các cột định danh (Composite Key).
  4. **Regex Validation:** `REPLACE_PATTERN` (thay thế chuỗi khớp mẫu regex), `FILTER_PATTERN` (chỉ giữ lại bản ghi khớp mẫu).

---

### Module 4: Xuất Dữ liệu Bảo mật (`src/backend/src/modules/exports/`)
- **Nghiệp vụ (F9.1 $\to$ F9.2):**
  - `GET /api/v1/datasets/:id/export/csv` (F9.1): Xuất dữ liệu sạch dạng luồng (Streaming CSV) trực tiếp từ MongoDB Cursor sang HTTP Response, đảm bảo mức chiếm dụng RAM $\le 20\text{ MB}$.
  - `POST /api/v1/datasets/:id/export/secure` (F9.2): Xuất dữ liệu mã hóa luồng AES-256-GCM bảo vệ bằng mật khẩu của người dùng, lưu bản sao mã hóa tại `exports/{export_id}.enc.csv` trên Cloudflare R2 và stream luồng tải về an toàn.
- **Tiêu chuẩn Mật mã học:**
  - Dẫn xuất khóa PBKDF2 (100.000 vòng lặp, SHA-512, Salt 16B, IV 12B).
  - Xác thực toàn vẹn bằng GCM Authentication Tag 16B.

---

## 3. Tiêu chuẩn Kỹ thuật Bắt buộc
1. **Zero Any Policy (Mục 13):** Tuyệt đối không dùng kiểu `any`. Kiểm thử kiến trúc `test/zero-any.spec.ts` tự động phát hiện và chặn vi phạm.
2. **Parameterized Cypher:** 100% câu truy vấn Neo4j sử dụng tham số `$param`, tuyệt đối không cộng chuỗi Cypher (Rule 6 Bảo mật).
3. **Zod Validation & Swagger UI:** 100% DTOs định nghĩa qua Zod Schema và tài liệu hóa tự động qua `@ApiZodBody`, `@ApiZodQuery`.

---

## 4. Kế hoạch Kiểm thử & Đánh giá (Verification Plan)
1. **Kiểm tra kiểu dữ liệu tĩnh:** `pnpm run type-check` (0 lỗi).
2. **Kiểm tra biên dịch:** `pnpm run build` (Exit code 0).
3. **Bộ kiểm thử tự động Jest:**
   - `test/lineage.spec.ts` (Kiểm thử DAG traversal, Cypher queries, outbox worker)
   - `test/versions.spec.ts` (Kiểm thử Merkle hash, commit snapshot, rollback)
   - `test/clean-rules.spec.ts` (Kiểm thử 4 nhóm luật làm sạch và dry-run preview)
   - `test/exports.spec.ts` (Kiểm thử streaming CSV export và AES-256-GCM encryption)
   Kỳ vọng: Toàn bộ **15/15 Test Suites PASS 100%**.
4. **Kiểm tra Live Integration:**
   - Đồng bộ thử nghiệm Node và Edge lên Neo4j AuraDB.
   - Commit version, kiểm tra snapshot lưu trên Cloudflare R2.
   - Thử nghiệm giải mã tệp export `.enc.csv` bằng password chính xác.
