# 07.08. API MODULE 8 — PHIÊN BẢN & NGUỒN GỐC (VERSION & LINEAGE)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). *Bước kiểm tra Dataset*: [06_visualization](06_visualization.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-1, UC-8.x).

---

### API-37. Lịch sử phiên bản (F8.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/datasets/:datasetId/versions` | Chủ sở hữu Dataset hoặc Admin | Bắt buộc | FR-8.1 |

**Input**: Path `datasetId` (string, ✓).

**Output — `200 OK`**
```json
{
  "datasetId": "string", "currentVersion": 3,
  "history": [
    { "versionId": "string", "versionNumber": 1, "versionHash": "hex64", "parentHash": "000…0",
      "actionType": null, "targetColumn": null, "rowsAffected": 0, "rowCount": 1200, "createdAt": "ISO-8601" },
    { "versionId": "string", "versionNumber": 2, "versionHash": "hex64", "parentHash": "hex64",
      "actionType": "DROP_NULL_ROWS", "targetColumn": "age", "rowsAffected": 20, "rowCount": 1180, "createdAt": "ISO-8601" }
  ]
}
```
v1 (tạo khi upload) có `actionType = null`, `targetColumn = null` `[GIẢ ĐỊNH]`. Thứ tự `history` theo `versionNumber` tăng dần `[GIẢ ĐỊNH]`.

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Dataset*.
2. [DB] Lấy mọi bản ghi `dataset_versions` của Dataset, sắp xếp theo `versionNumber`.
3. [BE] Trả `200` kèm `currentVersion`.

**Luồng lỗi**: E1 (1) → `404` / `403`.

---

### API-38. Rollback về phiên bản (F8.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/datasets/:datasetId/rollback` | Chủ sở hữu Dataset hoặc Admin | Bắt buộc | FR-8.2 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `datasetId` | string | ✓ | |
| Body | `targetVersionNumber` | integer | ✓ | 1 ≤ target < `currentVersion`; tồn tại trong `dataset_versions` |

**Output — `200 OK`**
```json
{
  "datasetId": "string", "previousVersion": 4, "currentVersion": 2,
  "rowCount": 1180, "columnCount": 8,
  "message": "Hoàn tác thành công về phiên bản chỉ định"
}
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `400` | `targetVersionNumber` < 1 hoặc ≥ `currentVersion` `[GIẢ ĐỊNH mã]` |
| `404` | Phiên bản đích không tồn tại `[GIẢ ĐỊNH mã]` |

**Luồng xử lý chính**
1. [BE] Kiểm tra schema.
2. [BE] *Bước kiểm tra Dataset*.
3. [BE] Kiểm tra `1 ≤ target < currentVersion`.
4. [DB] Tìm phiên bản đích trong `dataset_versions`.
5. [DB] Cập nhật con trỏ `dataset.currentVersion = targetVersionNumber`, `rowCount`, `columnCount` theo phiên bản đích. Không xóa các phiên bản mới hơn.
6. [BE] Trả `200`. Các truy vấn API-33 sau đó trả dữ liệu của phiên bản đích.

**Luồng lỗi**
- E1 (2) → `404` / `403`.
- E2 (3) Ngoài khoảng → `400`.
- E3 (4) Không tồn tại → `404`.

> Lưu ý thiết kế: sau rollback, phép biến đổi tiếp theo (API-35) tạo phiên bản mới có `parent` là phiên bản đích. Cách đánh số phiên bản mới (tiếp nối số lớn nhất hay `target + 1`) spec không quy định `[GIẢ ĐỊNH: tiếp nối số lớn nhất để không ghi đè lịch sử]`.

---

### API-39. Đồ thị lineage (F8.3)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/datasets/:datasetId/lineage` | Chủ sở hữu Dataset hoặc Admin | Đề xuất | FR-8.3 |

**Input**: Path `datasetId` (string, ✓).

**Output — `200 OK`** (định dạng cho React Flow)
```json
{
  "nodes": [ { "id": "string", "version": 1, "label": "v1 - Upload", "rowCount": 1200, "versionHash": "hex64" } ],
  "edges": [ { "source": "string", "target": "string", "action": "DROP_NULL_ROWS" } ]
}
```

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Dataset* (trên MongoDB).
2. [Graph] Chạy truy vấn Cypher tham số hóa (`$datasetId`) lấy mọi node phiên bản và cạnh biến đổi.
3. [BE] Ánh xạ kết quả sang `nodes[]`, `edges[]`.
4. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) → `404` / `403`.
- E2 (2) Neo4j không phản hồi → `503` `[GIẢ ĐỊNH]`; [FE] cho thử lại.
- E3 (2) Outbox chưa đồng bộ kịp → trả đồ thị hiện có (thiếu phiên bản mới nhất) `[GIẢ ĐỊNH]`.

---

### API-40. Kiểm tra toàn vẹn chuỗi phiên bản (F8.4)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/datasets/:datasetId/versions/verify-integrity` | Chủ sở hữu Dataset hoặc Admin | Đề xuất | FR-8.4 |

**Input**: Path `datasetId` (string, ✓). Không có body.

**Output — `200 OK`**
```json
{ "datasetId": "string", "isChainValid": false, "totalVersionsChecked": 4, "brokenVersion": 3, "message": "string" }
```
Chuỗi hợp lệ → `isChainValid = true`, `brokenVersion = null`.

**Luồng xử lý chính**
1. [BE] *Bước kiểm tra Dataset*.
2. [DB] Lấy các phiên bản v1 → `currentVersion` theo thứ tự.
3. [BE] Với từng phiên bản `n`:
   1. [DB] Tính lại `data_checksum` từ dữ liệu của phiên bản `n`.
   2. [BE] Tính `SHA256(parent_hash + version_number + operations_json + data_checksum)`.
   3. [BE] ◇ Khớp `version_hash` đã lưu **và** `parent_hash` = `version_hash` của phiên bản `n−1`?
      - Không → `brokenVersion = n`, dừng vòng lặp.
4. [BE] Trả `200` với kết quả (luôn `200` kể cả khi chuỗi bị đứt).

**Luồng lỗi**: E1 (1) → `404` / `403`.

> Công thức băm theo spec F8.4; báo cáo 05 và README ghi công thức 3 thành phần — xem ghi chú tại [04_yeu-cau-chuc-nang](../04_yeu-cau-chuc-nang.md#m8-phiên-bản--nguồn-gốc).
