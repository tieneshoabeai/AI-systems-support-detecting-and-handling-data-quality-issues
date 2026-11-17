# 07.03. API MODULE 3 — KHÔNG GIAN LÀM VIỆC (WORKSPACE)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-1, BF-5, UC-3.x).

**Kiểm tra quyền chung cho API-20 → API-23** (gọi tắt là *bước kiểm tra Workspace*):
1. [DB] Tìm Workspace theo `workspaceId` (API-20 → 22: `deleted_at = null`; API-23: `deleted_at ≠ null`).
2. [BE] Không có → `404`.
3. [BE] `ownerId ≠ userId` và người gọi không phải Admin → `403`.

---

### API-18. Tạo Workspace (F3.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/workspaces` | Đã đăng nhập (Data Analyst, Admin) | Bắt buộc | FR-3.1 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Body | `name` | string | ✓ | 3–100 ký tự; không trùng Workspace chưa xóa của chính mình |
| Body | `description` | string | | ≤ 500 ký tự |

**Output — `201 Created`**
```json
{ "workspaceId": "string", "name": "string", "description": "string | null", "ownerId": "string", "projectCount": 0, "createdAt": "ISO-8601" }
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `409` | Trùng tên với Workspace chưa xóa của chính mình |

**Luồng xử lý chính**
1. [FE] Gửi `name`, `description`.
2. [BE] Kiểm tra schema; lấy `ownerId` từ token.
3. [DB] Tìm Workspace `{ ownerId, name, deleted_at: null }`.
4. [DB] Tạo Workspace với `deleted_at = null`.
5. [BE] Trả `201`.

**Luồng lỗi**
- E1 (2) Sai độ dài → `400`.
- E2 (3) hoặc (4) Trùng tên (kể cả do unique index một phần) → `409`.

---

### API-19. Danh sách Workspace (F3.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/workspaces` | Đã đăng nhập | Bắt buộc | FR-3.2 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Query | `page` | integer | | Mặc định 1, ≥ 1 |
| Query | `limit` | integer | | Mặc định 10 |
| Query | `search` | string | | Tìm theo tên |

**Output — `200 OK`**
```json
{
  "data": [ { "workspaceId": "string", "name": "string", "description": "string | null", "projectCount": 2, "updatedAt": "ISO-8601" } ],
  "pagination": { "page": 1, "limit": 10, "totalItems": 12, "totalPages": 2 }
}
```

**Luồng xử lý chính**
1. [BE] Lấy `userId` từ token.
2. [DB] Lọc `ownerId = userId`, `deleted_at = null`, áp `search`.
3. [DB] Đếm tổng và lấy trang hiện tại.
4. [DB] Đếm Project chưa xóa của từng Workspace.
5. [BE] Trả `200`.

**Luồng lỗi**: E1 Tham số phân trang sai → `400`.

---

### API-20. Chi tiết Workspace (F3.3)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/workspaces/:workspaceId` | Chủ sở hữu hoặc Admin | Bắt buộc | FR-3.3 |

**Input**: Path `workspaceId` (string, ✓).

**Output — `200 OK`**
```json
{
  "workspaceId": "string", "name": "string", "description": "string | null", "ownerId": "string",
  "createdAt": "ISO-8601", "updatedAt": "ISO-8601",
  "projects": [ { "projectId": "string", "name": "string", "hasDataset": true, "updatedAt": "ISO-8601" } ]
}
```

**Lỗi riêng**: `404` không tồn tại hoặc đã xóa; `403` không phải chủ sở hữu/Admin.

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Workspace*.
2. [DB] Lấy các Project của Workspace có `deleted_at = null`.
3. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) Không tồn tại → `404`.
- E2 (1) Không có quyền → `403`.

---

### API-21. Cập nhật Workspace (F3.4)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `PATCH` | `/workspaces/:workspaceId` | Chủ sở hữu hoặc Admin | Bắt buộc | FR-3.4 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `workspaceId` | string | ✓ | |
| Body | `name` | string | | 3–100 ký tự |
| Body | `description` | string | | ≤ 500 ký tự |

**Output — `200 OK`**
```json
{ "workspaceId": "string", "name": "string", "description": "string | null", "updatedAt": "ISO-8601" }
```

**Lỗi riêng**: `404`, `403` như API-20; `409` tên mới trùng Workspace chưa xóa khác của chủ sở hữu `[GIẢ ĐỊNH]`.

**Luồng xử lý chính**
1. [BE] Kiểm tra schema.
2. [BE] *Bước kiểm tra Workspace*.
3. [DB] Cập nhật các trường được gửi.
4. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) Sai độ dài → `400`.
- E2 (2) → `404` / `403`.
- E3 (3) Trùng tên → `409`.

---

### API-22. Xóa mềm Workspace (F3.5)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `DELETE` | `/workspaces/:workspaceId` | Chủ sở hữu hoặc Admin | Bắt buộc | FR-3.5 |

**Input**: Path `workspaceId` (string, ✓).

**Output — `200 OK`**
```json
{ "success": true, "message": "Không gian làm việc đã được chuyển vào thùng rác (Soft Delete)" }
```

**Lỗi riêng**: `404`, `403` như API-20.

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Workspace*.
2. [DB] Mở transaction.
3. [DB] Workspace: `deleted_at = now()`, `deletedBy = userId`.
4. [DB] Mọi Project thuộc Workspace: `deleted_at = now()`.
5. [DB] Mọi Dataset thuộc các Project đó: `deleted_at = now()`.
6. [DB] Commit (không xóa vật lý bản ghi nào).
7. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) → `404` / `403`.
- E2 (3–5) Lỗi ghi → rollback transaction, không có bản ghi nào bị đánh dấu → `500`.

---

### API-23. Khôi phục Workspace (F3.6)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/workspaces/:workspaceId/restore` | Chủ sở hữu hoặc Admin | Đề xuất | FR-3.6 |

**Input**: Path `workspaceId` (string, ✓).

**Output — `200 OK`**
```json
{ "success": true, "message": "Khôi phục không gian làm việc thành công" }
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `404` | Không có Workspace đã xóa với id này `[GIẢ ĐỊNH]` |
| `403` | Không phải chủ sở hữu/Admin |
| `409` | Chủ sở hữu đã có Workspace chưa xóa cùng tên (đã chốt: không tự đổi tên) |

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Workspace* (tìm bản ghi đã xóa).
2. [DB] Kiểm tra trùng tên với Workspace đang hoạt động.
3. [DB] Mở transaction.
4. [DB] Workspace và các Project con: `deleted_at = null`. Dataset **không** được khôi phục (đã chốt); các Project được khôi phục có `datasetId = null`, `hasDataset = false` `[GIẢ ĐỊNH hệ quả]`.
5. [DB] Commit.
6. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) → `404` / `403`.
- E2 (2) Trùng tên → `409`.
