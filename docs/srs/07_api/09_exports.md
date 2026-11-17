# 07.09. API MODULE 9 — XUẤT BẢN DỮ LIỆU (EXPORT)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). *Bước kiểm tra Dataset* và *xác định phiên bản*: [06_visualization](06_visualization.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-1, UC-9.x).

---

### API-41. Tải tệp dữ liệu về máy (F9.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/datasets/:datasetId/export/download` | Chủ sở hữu Dataset hoặc Admin | Bắt buộc | FR-9.1 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `datasetId` | string | ✓ | |
| Query | `version` | integer | | Mặc định phiên bản hiện hành |
| Query | `format` | enum | ✓ | `csv` \| `xlsx` \| `json` |
| Query | `encrypt` | boolean | | Mặc định `false` |
| Query | `password` | string | Khi `encrypt = true` | ≥ 8 ký tự |

> Spec đặt `password` trong query string. Mật khẩu trong URL có thể bị ghi vào log truy cập/lịch sử trình duyệt; hệ thống phải che tham số này trong log (NFR-SEC-11). Phương án tốt hơn (header hoặc `POST`) là đề xuất cải tiến, không thay đổi spec.

**Output — `200 OK`** (luồng nhị phân, **không** bọc cấu trúc `{ success, data }`)

| Header | Giá trị |
|---|---|
| `Content-Type` | `text/csv; charset=utf-8` (có BOM) \| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` \| `application/json`; khi mã hóa: `application/octet-stream` |
| `Content-Disposition` | `attachment; filename="{dataset_name}_v{version}.{format}"` (+ `.enc` nếu mã hóa) |

Body: dữ liệu của phiên bản; khi mã hóa, bố cục tệp `.enc` = `salt (16 byte) ‖ IV (12 byte) ‖ ciphertext ‖ authTag (16 byte)` (theo [báo cáo 05, mục 4.3](../../05_core_mechanisms_and_cryptography.md)); khóa dẫn xuất PBKDF2-HMAC-SHA256 100.000 vòng (NFR-SEC-09).

**Lỗi riêng** (trả JSON lỗi chuẩn vì xảy ra trước khi bắt đầu luồng)

| Mã | Điều kiện |
|---|---|
| `400` | `format` thiếu/không hỗ trợ; `encrypt = true` mà thiếu `password` hoặc < 8 ký tự |
| `404` | Dataset/phiên bản không tồn tại |

**Luồng xử lý chính**
1. [FE] Gửi yêu cầu (thường sau API-43).
2. [BE] Kiểm tra query.
3. [BE] *Bước kiểm tra Dataset*; *xác định phiên bản*.
4. [BE] Đặt header `Content-Type`, `Content-Disposition`.
5. [BE] ◇ `encrypt`?
   - Có → sinh salt, IV ngẫu nhiên; dẫn xuất khóa từ `password`; ghi salt + IV ra luồng.
6. [DB] Mở cursor đọc bản ghi phiên bản theo lô 1.000 dòng.
7. [BE] Với mỗi lô: chuyển sang định dạng đích (CSV có BOM ở đầu tệp) → (nếu mã hóa) qua cipher AES-256-GCM → ghi ra response.
8. [BE] Kết thúc: (nếu mã hóa) ghi auth tag; đóng luồng.

**Luồng lỗi**
- E1 (2) → `400`.
- E2 (3) → `404` / `403`.
- E3 (6–7) Lỗi giữa chừng sau khi đã gửi header → hủy kết nối; tệp phía client không hoàn chỉnh (mã hóa: giải mã sẽ thất bại do thiếu auth tag); [FE] cho tải lại.
- E4 Client hủy tải → [BE] đóng cursor, giải phóng tài nguyên.

---

### API-42. Lưu thành Dataset mới (F9.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/datasets/:datasetId/export/save-as-new` | Đọc Dataset nguồn + chủ sở hữu Project đích (hoặc Admin) | Bắt buộc | FR-9.2 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `datasetId` | string | ✓ | Dataset nguồn |
| Body | `version` | integer | | Mặc định phiên bản hiện hành của nguồn |
| Body | `newDatasetName` | string | ✓ | 3–100 ký tự |
| Body | `targetProjectId` | string | ✓ | Project chưa xóa, `hasDataset = false` |

**Output — `201 Created`**
```json
{
  "newDatasetId": "string", "projectId": "string", "name": "string",
  "rowCount": 1180, "currentVersion": 1,
  "message": "Đã lưu dữ liệu sạch thành Dataset mới thành công"
}
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `403` | Không có quyền đọc Dataset nguồn hoặc quyền ghi Project đích |
| `404` | Dataset nguồn / phiên bản / Project đích không tồn tại |
| `409` | Project đích đã có Dataset |

**Luồng xử lý chính**
1. [BE] Kiểm tra schema.
2. [BE] *Bước kiểm tra Dataset* nguồn; *xác định phiên bản*.
3. [DB] Tìm Project đích chưa xóa; [BE] kiểm tra quyền ghi.
4. [BE] Kiểm tra `hasDataset = false` (ràng buộc 1 Project = 1 Dataset).
5. [DB] Mở transaction.
6. [DB] Tạo Dataset mới; sao chép bản ghi của phiên bản nguồn sang `newDatasetId` theo lô.
7. [DB] Tạo phiên bản v1 cho Dataset mới (`parent_hash` = 64 ký tự `0`, tính `version_hash`).
8. [DB] Cập nhật Project đích: `datasetId = newDatasetId`, `hasDataset = true`.
9. [DB] Ghi sự kiện outbox; commit.
10. [Graph] Worker tạo node Dataset/Version mới, kèm quan hệ nguồn gốc tới phiên bản nguồn `[GIẢ ĐỊNH]`.
11. [BE] Trả `201`.

**Luồng lỗi**
- E1 (1) → `400`.
- E2 (2) hoặc (3) → `404` / `403`.
- E3 (4) Project đích đã có Dataset → `409`.
- E4 (6–9) Lỗi ghi → rollback; Project đích giữ nguyên → `500`.

---

### API-43. Xem trước dữ liệu trước khi xuất (F9.3)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/datasets/:datasetId/export/preview` | Chủ sở hữu Dataset hoặc Admin | Đề xuất | FR-9.3 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `datasetId` | string | ✓ | |
| Query | `version` | integer | | Mặc định phiên bản hiện hành |
| Query | `limit` | integer | | Mặc định 20, tối đa 50 |

**Output — `200 OK`**
```json
{ "totalRows": 1180, "previewRows": [ { "_rowId": "string", "name": "An", "age": 21 } ] }
```

**Luồng xử lý chính**
1. [BE] Kiểm tra query.
2. [BE] *Bước kiểm tra Dataset*; *xác định phiên bản*.
3. [DB] Lấy `limit` dòng đầu của phiên bản; lấy `rowCount` của phiên bản → `totalRows`.
4. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) `limit` > 50 hoặc < 1 → `400`.
- E2 (2) → `404` / `403`.
