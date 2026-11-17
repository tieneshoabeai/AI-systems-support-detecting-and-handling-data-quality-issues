# 07.04. API MODULE 4 — DỰ ÁN (PROJECT)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-1, BF-5, UC-4.x).

**Bước kiểm tra Project** (dùng cho API-26 → API-29):
1. [DB] Tìm Project theo `projectId` (API-26 → 28: `deleted_at = null`; API-29: `deleted_at ≠ null`).
2. [BE] Không có → `404`.
3. [DB] Lấy Workspace chứa Project; [BE] người gọi không phải chủ sở hữu Workspace và không phải Admin → `403`.

---

### API-24. Tạo Project (F4.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/workspaces/:workspaceId/projects` | Chủ sở hữu Workspace hoặc Admin | Bắt buộc | FR-4.1 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `workspaceId` | string | ✓ | Workspace chưa xóa |
| Body | `name` | string | ✓ | 3–100 ký tự; không trùng trong cùng Workspace (chưa xóa) |
| Body | `description` | string | | Mô tả mục tiêu phân tích |

**Output — `201 Created`**
```json
{ "projectId": "string", "workspaceId": "string", "name": "string", "description": "string | null", "hasDataset": false, "createdAt": "ISO-8601" }
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `404` | Workspace không tồn tại hoặc đã xóa |
| `403` | Không phải chủ sở hữu Workspace |
| `409` | Trùng tên Project trong Workspace |

**Luồng xử lý chính**
1. [BE] Kiểm tra schema.
2. [DB] Tìm Workspace `deleted_at = null`.
3. [BE] Kiểm tra sở hữu.
4. [DB] Tìm Project `{ workspaceId, name, deleted_at: null }`.
5. [DB] Tạo Project: `deleted_at = null`, `datasetId = null`, `hasDataset = false`.
6. [BE] Trả `201`.

**Luồng lỗi**
- E1 (1) Sai độ dài → `400`.
- E2 (2) → `404`.
- E3 (3) → `403`.
- E4 (4) Trùng tên → `409`.

---

### API-25. Danh sách Project trong Workspace (F4.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/workspaces/:workspaceId/projects` | Chủ sở hữu Workspace hoặc Admin | Bắt buộc | FR-4.2 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `workspaceId` | string | ✓ | |
| Query | `page` | integer | | Mặc định 1 (theo mẫu F3.2, đã chốt) |
| Query | `limit` | integer | | Mặc định 10 (theo mẫu F3.2, đã chốt) |
| Query | `search` | string | | Tìm theo tên |

**Output — `200 OK`**
```json
{
  "data": [ { "projectId": "string", "name": "string", "description": "string | null", "hasDataset": true, "datasetId": "string | null", "updatedAt": "ISO-8601" } ],
  "pagination": { "page": 1, "limit": 10, "totalItems": 3, "totalPages": 1 }
}
```
Trường `pagination` theo mẫu F3.2 — quyết định nhóm (spec F4.2 chỉ ghi `data`).

**Lỗi riêng**: `404` Workspace không tồn tại/đã xóa; `403` không có quyền.

**Luồng xử lý chính**
1. [DB] Tìm Workspace chưa xóa.
2. [BE] Kiểm tra sở hữu.
3. [DB] Lọc Project `workspaceId`, `deleted_at = null`, áp `search`, phân trang.
4. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) → `404`.
- E2 (2) → `403`.

---

### API-26. Chi tiết Project (F4.3)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/projects/:projectId` | Chủ sở hữu hoặc Admin | Bắt buộc | FR-4.3 |

**Input**: Path `projectId` (string, ✓).

**Output — `200 OK`**
```json
{
  "projectId": "string", "workspaceId": "string", "name": "string", "description": "string | null",
  "dataset": { "datasetId": "string", "name": "string", "rowCount": 1200, "columnCount": 8, "currentVersion": 3 }
}
```
`dataset = null` khi Project chưa có Dataset đang hoạt động.

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Project*.
2. [DB] Nếu `datasetId ≠ null` → đọc tóm tắt Dataset chưa xóa.
3. [BE] Trả `200`.

**Luồng lỗi**: E1 (1) → `404` / `403`.

---

### API-27. Cập nhật Project (F4.4)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `PATCH` | `/projects/:projectId` | Chủ sở hữu hoặc Admin | Bắt buộc | FR-4.4 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `projectId` | string | ✓ | |
| Body | `name` | string | | 3–100 ký tự `[GIẢ ĐỊNH theo F4.1]` |
| Body | `description` | string | | |

**Output — `200 OK`**
```json
{ "projectId": "string", "name": "string", "description": "string | null", "updatedAt": "ISO-8601" }
```

**Lỗi riêng**: `409` tên mới trùng Project chưa xóa khác trong Workspace `[GIẢ ĐỊNH]`.

**Luồng xử lý chính**
1. [BE] Kiểm tra schema.
2. [BE] *Bước kiểm tra Project*.
3. [DB] Cập nhật các trường được gửi.
4. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) → `400`.
- E2 (2) → `404` / `403`.
- E3 (3) Trùng tên → `409`.

---

### API-28. Xóa mềm Project (F4.5)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `DELETE` | `/projects/:projectId` | Chủ sở hữu hoặc Admin | Bắt buộc | FR-4.5 |

**Input**: Path `projectId` (string, ✓).

**Output — `200 OK`**
```json
{ "success": true, "message": "Project đã được chuyển vào thùng rác (Soft Delete)" }
```

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Project*.
2. [DB] Mở transaction.
3. [DB] Project: `deleted_at = now()`.
4. [DB] Dataset trực thuộc (nếu có): `deleted_at = now()`.
5. [DB] Commit.
6. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) → `404` / `403`.
- E2 (3–4) Lỗi ghi → rollback → `500`.

---

### API-29. Khôi phục Project (F4.6)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/projects/:projectId/restore` | Chủ sở hữu hoặc Admin | Đề xuất | FR-4.6 |

Spec chỉ liệt kê endpoint trong bảng tổng kết; nội dung đặc tả theo mẫu F3.6 (đã chốt).

**Input**: Path `projectId` (string, ✓).

**Output — `200 OK`**
```json
{ "success": true, "message": "Khôi phục dự án thành công" }
```
Nội dung `message` là `[GIẢ ĐỊNH]`.

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `404` | Không có Project đã xóa với id này |
| `403` | Không phải chủ sở hữu/Admin |
| `409` | Workspace cha đang bị xóa `[GIẢ ĐỊNH]` |
| `409` | Workspace đã có Project chưa xóa cùng tên (đã chốt: không tự đổi tên) |

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Project* (tìm bản ghi đã xóa).
2. [DB] Kiểm tra Workspace cha `deleted_at = null`.
3. [DB] Kiểm tra trùng tên trong Workspace.
4. [DB] Project: `deleted_at = null`.
5. [BE] Trả `200`.

Dataset đã xóa mềm cùng Project **không** được khôi phục (đã chốt, đúng chữ spec F3.6); người dùng tải lại tệp qua API-30.

**Luồng lỗi**
- E1 (1) → `404` / `403`.
- E2 (2) Workspace cha đã xóa → `409`.
- E3 (3) Trùng tên → `409`.
