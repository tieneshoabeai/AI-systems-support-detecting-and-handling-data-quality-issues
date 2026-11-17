# 07.05. API MODULE 5 — TẬP DỮ LIỆU (DATASET)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-1, BF-6, UC-5.x). Kiểm tra quyền dùng *Bước kiểm tra Project* tại [04_projects](04_projects.md).

---

### API-30. Tải tệp dữ liệu lên Project (F5.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/projects/:projectId/datasets/upload` | Chủ sở hữu Project hoặc Admin | Bắt buộc | FR-5.1 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Header | `Content-Type` | string | ✓ | `multipart/form-data` |
| Path | `projectId` | string | ✓ | Project chưa xóa, **chưa có Dataset đang hoạt động** |
| Form | `file` | binary | ✓ | `.csv`, `.xlsx`, `.json`; CSV/JSON ≤ 50 MB, XLSX ≤ 20 MB; ≤ 100 cột; ≤ 200.000 dòng |
| Form | `datasetName` | string | | Tên hiển thị; mặc định lấy tên tệp `[GIẢ ĐỊNH]` |

**Output — `201 Created`**
```json
{
  "datasetId": "string", "projectId": "string", "name": "string",
  "fileFormat": "csv | xlsx | json", "fileSizeBytes": 1048576,
  "fileChecksum": "sha256-hex (64 ký tự)",
  "rowCount": 1200, "columnCount": 8, "currentVersion": 1,
  "columns": [ { "name": "age", "dataType": "number", "nullCount": 12, "nullRate": 0.01 } ]
}
```

**Lỗi riêng**

| Mã | Điều kiện | Message |
|---|---|---|
| `409` | Project đã có Dataset chưa xóa | Mỗi Dự án chỉ được chứa 1 Tập dữ liệu duy nhất. Vui lòng xóa tập dữ liệu hiện tại trước khi tải lên tệp mới, hoặc tạo một Dự án mới |
| `400` | Sai định dạng tệp hoặc vượt dung lượng; thiếu `file` | |
| `422` | Vượt 100 cột hoặc 200.000 dòng | |
| `404` | Project không tồn tại hoặc đã xóa | |

**Luồng xử lý chính**
1. [FE] Gửi `multipart/form-data` (nếu mất kết nối, tệp được giữ làm bản nháp IndexedDB — xem BF-6).
2. [BE] *Bước kiểm tra Project*.
3. [DB] Kiểm tra Project chưa có Dataset `deleted_at = null` (ràng buộc **1 Project = 1 Dataset**).
4. [BE] Kiểm tra phần mở rộng/MIME và giới hạn dung lượng theo định dạng trên luồng.
5. [BE] Đọc tệp theo luồng (busboy + parser), đồng thời cập nhật SHA-256 → `fileChecksum`.
6. [BE] JSON lồng nhau → làm phẳng dot-notation (tối đa 3 cấp).
7. [BE] Đếm cột/dòng trong khi đọc; suy luận kiểu dữ liệu và `nullCount`, `nullRate` từng cột.
8. [Storage] Lưu tệp gốc.
9. [DB] Mở transaction:
   - ghi bản ghi vào `dataset_records` theo lô;
   - ghi metadata (kèm `file_checksum`) vào `datasets`;
   - tạo phiên bản v1 trong `dataset_versions`: `parent_hash` = 64 ký tự `0`, tính `version_hash` (SHA-256);
   - cập nhật Project: `datasetId = newDatasetId`, `hasDataset = true`;
   - ghi sự kiện outbox "tạo Dataset/Version".
10. [DB] Commit.
11. [Graph] Worker outbox tạo node `Dataset`, `Version` v1 trong Neo4j (bất đồng bộ).
12. [BE] Trả `201`.

**Luồng lỗi**
- E1 (2) → `404` / `403`.
- E2 (3) Đã có Dataset → `409`, dừng trước khi đọc tệp.
- E3 (4) Sai định dạng / quá dung lượng → hủy luồng → `400`.
- E4 (7) Vượt 100 cột hoặc 200.000 dòng → hủy luồng, không ghi gì → `422`.
- E5 (5) Tệp hỏng, không phân tích được → `400` `[GIẢ ĐỊNH]`.
- E6 (9) Lỗi ghi CSDL → rollback transaction; xóa tệp đã lưu ở bước 8 `[GIẢ ĐỊNH]` → `500`.
- E7 (11) Neo4j không sẵn sàng → sự kiện outbox ở trạng thái chờ, worker thử lại; API vẫn trả `201` (NFR-REL-04).

---

### API-31. Lấy thông tin Dataset của Project (F5.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/projects/:projectId/dataset` | Chủ sở hữu Project hoặc Admin | Bắt buộc | FR-5.2 |

**Input**: Path `projectId` (string, ✓).

**Output — `200 OK`**
```json
{
  "datasetId": "string", "projectId": "string", "name": "string",
  "rowCount": 1200, "columnCount": 8, "currentVersion": 3,
  "columns": [ { "name": "age", "dataType": "number", "nullCount": 12, "nullRate": 0.01 } ],
  "createdAt": "ISO-8601"
}
```

**Lỗi riêng**: `404` Project chưa có Dataset hoặc Dataset đã xóa mềm.

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Project*.
2. [DB] Tìm Dataset của Project có `deleted_at = null`.
3. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) → `404` / `403`.
- E2 (2) Không có Dataset hoạt động → `404`.

---

### API-32. Xóa mềm Dataset của Project (F5.3)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `DELETE` | `/projects/:projectId/dataset` | Chủ sở hữu Project hoặc Admin | Bắt buộc | FR-5.3 |

**Input**: Path `projectId` (string, ✓).

**Output — `200 OK`**
```json
{ "success": true, "message": "Tập dữ liệu đã được xóa mềm khỏi Project thành công" }
```

**Lỗi riêng**: `404` Project không có Dataset đang hoạt động.

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Project*.
2. [DB] Tìm Dataset `deleted_at = null` của Project.
3. [DB] Mở transaction.
4. [DB] Dataset: `deleted_at = now()`.
5. [DB] Project: `datasetId = null`, `hasDataset = false`.
6. [DB] Commit.
7. [BE] Trả `200`. Project được giải phóng, có thể gọi lại API-30.

**Luồng lỗi**
- E1 (1) → `404` / `403`.
- E2 (2) Không có Dataset → `404`.
- E3 (4–5) Lỗi ghi → rollback → `500`.
