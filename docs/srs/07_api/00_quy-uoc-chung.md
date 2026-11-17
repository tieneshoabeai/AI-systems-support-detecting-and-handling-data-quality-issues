# 07.00. QUY ƯỚC CHUNG CHO ĐẶC TẢ API

**Nguồn:** [feature_spec_v4](../../feature_spec_v4.md) (endpoint, input/output), mã nguồn backend `src/backend/src/shared` (cấu trúc phản hồi chung, do spec không định nghĩa).

## 1. Thông tin chung

| Mục | Giá trị |
|---|---|
| Base URL | `https://<host>/api/v1` (riêng `GET /health` không có tiền tố) |
| Định dạng | JSON (`Content-Type: application/json`), trừ upload (`multipart/form-data`) và download (luồng nhị phân) |
| Xác thực | `Authorization: Bearer <accessToken>` cho mọi API trừ API-01 → API-06 |
| Tài liệu tương tác | Swagger UI tại `/api/v1/docs` |

## 2. Cấu trúc phản hồi

**Thành công** — dữ liệu đầu ra mô tả trong từng API nằm trong trường `data`:
```json
{ "success": true, "data": { "...": "dữ liệu đầu ra của API" } }
```

**Lỗi**:
```json
{
  "success": false,
  "error": {
    "code": "HTTP_409",
    "message": "Mỗi Dự án chỉ được chứa 1 Tập dữ liệu duy nhất...",
    "timestamp": "2026-11-17T08:00:00.000Z",
    "path": "/api/v1/projects/p1/datasets/upload"
  }
}
```
Lỗi kiểm tra dữ liệu (`400`) có `message` là mảng `[{ "field": "email", "message": "..." }]`.

**Tải tệp (API-41)** trả luồng nhị phân trực tiếp, không bọc trong cấu trúc trên.

## 3. Mã lỗi dùng chung

Áp dụng cho mọi API liên quan, không nhắc lại trong bảng lỗi của từng API:

| Mã | Điều kiện | Áp dụng |
|---|---|---|
| `400` | Dữ liệu đầu vào sai định dạng/ràng buộc | Mọi API có input |
| `401` | Thiếu, sai hoặc hết hạn access token; phiên đã bị thu hồi | Mọi API cần đăng nhập |
| `403` | Không có quyền trên tài nguyên (không phải chủ sở hữu, không phải Admin) | Mọi API thao tác tài nguyên |
| `429` | Vượt giới hạn tần suất (5 req/phút/IP với nhóm xác thực; 100 req/phút/người dùng với API khác) — NFR-SEC-13 | Mọi API |
| `500` | Lỗi máy chủ không lường trước; không trả chi tiết nội bộ | Mọi API |

## 4. Mẫu đặc tả một API

```
### API-nn. <Tên> (F<m>.<n>)
| Method | Path | Quyền | Ưu tiên | FR |
Input: bảng (vị trí, trường, kiểu, bắt buộc, ràng buộc)
Output: mã HTTP + JSON trong data
Lỗi riêng: bảng (mã, điều kiện, message)
Luồng xử lý chính: bước đánh số theo làn [FE] / [BE] / [DB] / [Graph] / [Storage]
Luồng lỗi: E<k> (tại bước n) điều kiện → mã HTTP → kết thúc
```
Vị trí input: `Path`, `Query`, `Header`, `Body`, `Form`. `[GIẢ ĐỊNH]` = nội dung nhóm bổ sung, spec không ghi.

## 5. Danh mục file

| File | Module | API |
|---|---|---|
| [01_auth.md](01_auth.md) | M1 Xác thực | API-01 → API-10 |
| [02_users.md](02_users.md) | M2 Người dùng | API-11 → API-17 |
| [03_workspaces.md](03_workspaces.md) | M3 Workspace | API-18 → API-23 |
| [04_projects.md](04_projects.md) | M4 Project | API-24 → API-29 |
| [05_datasets.md](05_datasets.md) | M5 Dataset | API-30 → API-32 |
| [06_visualization.md](06_visualization.md) | M6 Trực quan hóa | API-33 → API-34 |
| [07_transformations.md](07_transformations.md) | M7 Biến đổi | API-35 → API-36 |
| [08_versions-lineage.md](08_versions-lineage.md) | M8 Phiên bản & nguồn gốc | API-37 → API-40 |
| [09_exports.md](09_exports.md) | M9 Xuất bản | API-41 → API-43 |
