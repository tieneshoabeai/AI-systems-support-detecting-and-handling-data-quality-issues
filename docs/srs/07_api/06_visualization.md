# 07.06. API MODULE 6 — TRỰC QUAN HÓA (VISUALIZATION)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-1, UC-6.x).

**Bước kiểm tra Dataset** (dùng cho mọi API thuộc M6 → M9 có `:datasetId`):
1. [DB] Tìm Dataset theo `datasetId`, `deleted_at = null`.
2. [BE] Không có → `404`.
3. [DB] Lấy Project → Workspace chứa Dataset; [BE] người gọi không phải chủ sở hữu và không phải Admin → `403`.

**Xác định phiên bản** (khi API nhận tham số `version`): không truyền → dùng `dataset.currentVersion`; truyền giá trị không tồn tại trong `dataset_versions` → `404` `[GIẢ ĐỊNH]`.

---

### API-33. Truy vấn Data Grid (F6.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/datasets/:datasetId/query` | Chủ sở hữu Dataset hoặc Admin | Bắt buộc | FR-6.1 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `datasetId` | string | ✓ | |
| Body | `version` | integer | | Mặc định phiên bản hiện hành |
| Body | `page` | integer | ✓ | ≥ 1 |
| Body | `pageSize` | integer | ✓ | 10–200 |
| Body | `sortBy` | string | | Tên cột tồn tại |
| Body | `sortDirection` | enum | | `asc` \| `desc` |
| Body | `searchKeyword` | string | | Tìm toàn cục trên mọi cột |
| Body | `filters` | array | | Mỗi phần tử `{ column, operator, value }` |

Danh sách `operator` hợp lệ spec không liệt kê; tối thiểu gồm `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `isNull`, `isNotNull` `[GIẢ ĐỊNH]`.

**Output — `200 OK`**
```json
{
  "page": 1, "pageSize": 50, "totalMatchingRows": 1180, "totalPages": 24,
  "rows": [ { "_rowId": "string", "name": "An", "age": 21 } ]
}
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `400` | `page < 1`, `pageSize` ngoài 10–200, `sortBy`/`filters.column` không tồn tại, `operator` không hợp lệ |
| `404` | Dataset không tồn tại/đã xóa; `version` không tồn tại |

**Luồng xử lý chính**
1. [FE] Gửi tham số trang, sắp xếp, lọc.
2. [BE] Kiểm tra schema.
3. [BE] *Bước kiểm tra Dataset*; *xác định phiên bản*.
4. [BE] Dựng MongoDB Aggregation: lọc theo Dataset + phiên bản → `filters` → `searchKeyword` → sắp xếp → phân trang (truy vấn tham số hóa, không nối chuỗi).
5. [DB] Chạy truy vấn có chỉ mục (mục tiêu < 100 ms — NFR-PERF-01); đếm `totalMatchingRows`.
6. [BE] Tính `totalPages = ceil(totalMatchingRows / pageSize)`.
7. [BE] Trả `200`.

**Luồng lỗi**
- E1 (2) Tham số sai → `400`.
- E2 (3) → `404` / `403`.
- E3 (5) Không có dòng khớp → `200` với `rows = []`, `totalMatchingRows = 0`.

---

### API-34. Thống kê mô tả cột (F6.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/datasets/:datasetId/columns/:columnName/profile` | Chủ sở hữu Dataset hoặc Admin | Bắt buộc | FR-6.2 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `datasetId` | string | ✓ | |
| Path | `columnName` | string | ✓ | Cột tồn tại ở phiên bản được chọn; mã hóa URL |
| Query | `version` | integer | | Mặc định phiên bản hiện hành |

**Output — `200 OK`**

Cột số:
```json
{
  "columnName": "age", "dataType": "number", "nullCount": 12, "nullRate": 0.01, "uniqueCount": 60,
  "statistics": { "min": 18, "max": 80, "mean": 34.2, "median": 31, "stdDev": 9.8 },
  "histogram": [ { "binRange": "18-24", "frequency": 210 } ]
}
```
Cột chuỗi:
```json
{
  "columnName": "city", "dataType": "string", "nullCount": 4, "uniqueCount": 12,
  "topCategories": [ { "value": "Hà Nội", "count": 400, "percentage": 33.3 } ]
}
```
Số bin của histogram và số phần tử `topCategories` spec không quy định; mặc định 10 `[GIẢ ĐỊNH]`.

**Lỗi riêng**: `404` cột không tồn tại ở phiên bản được chọn `[GIẢ ĐỊNH]`.

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Dataset*; *xác định phiên bản*.
2. [BE] Kiểm tra `columnName` thuộc schema của phiên bản.
3. [BE] ◇ Kiểu cột?
   - Số → [DB] aggregation tính `nullCount`, `uniqueCount`, min/max/mean/median/stdDev, phân bin histogram.
   - Chuỗi → [DB] aggregation đếm rỗng, giá trị duy nhất, nhóm và sắp xếp lấy top giá trị.
4. [BE] Tính `nullRate = nullCount / rowCount`.
5. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) → `404` / `403`.
- E2 (2) Cột không tồn tại → `404`.
