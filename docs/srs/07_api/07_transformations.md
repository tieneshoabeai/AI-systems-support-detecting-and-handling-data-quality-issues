# 07.07. API MODULE 7 — BIẾN ĐỔI DỮ LIỆU (TRANSFORMATION)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). *Bước kiểm tra Dataset*: [06_visualization](06_visualization.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-1, UC-7.x).

## Input dùng chung cho API-35 và API-36

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `datasetId` | string | ✓ | |
| Body | `currentVersion` | integer | ✓ | Phiên bản client đang thao tác; phải bằng `dataset.currentVersion` |
| Body | `actionType` | enum | ✓ | Một trong 6 giá trị dưới đây |
| Body | `targetColumn` | string | ✓ | Cột tồn tại ở phiên bản hiện hành |
| Body | `parameters` | object | | Tham số theo `actionType` |

| `actionType` | Ý nghĩa (spec) | `parameters` gợi ý `[GIẢ ĐỊNH]` |
|---|---|---|
| `DROP_NULL_ROWS` | Xóa dòng có ô trống ở `targetColumn` | không cần |
| `IMPUTE_VALUE` | Điền giá trị vào ô trống | `{ strategy: "constant" \| "mean" \| "median" \| "mode", value? }` |
| `SANITIZE_STRING` | Cắt khoảng trắng, đổi hoa/thường | `{ trim: boolean, case?: "upper" \| "lower" \| "title" }` |
| `REPLACE_REGEX` | Tìm và thay thế theo chuỗi / regex | `{ pattern: string, replacement: string, isRegex: boolean, flags? }` |
| `DROP_COLUMN` | Xóa cột | không cần |
| `RENAME_COLUMN` | Đổi tên cột | `{ newName: string }` (không trùng cột khác) |

Spec chỉ ghi "tham số chi tiết theo từng `actionType`"; cấu trúc `parameters` ở bảng trên do nhóm đề xuất, cần đối chiếu Zod DTO khi cài đặt.

---

### API-35. Thực thi biến đổi (F7.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/datasets/:datasetId/transformations` | Chủ sở hữu Dataset hoặc Admin | Bắt buộc | FR-7.1 |

**Input**: bảng dùng chung ở trên.

**Output — `200 OK`**
```json
{
  "datasetId": "string", "previousVersion": 3, "newVersion": 4,
  "actionExecuted": "IMPUTE_VALUE", "rowsAffected": 120, "newRowCount": 1180,
  "message": "string", "updatedAt": "ISO-8601"
}
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `409` | `currentVersion` khác `dataset.currentVersion` (khóa lạc quan) |
| `400` | `actionType` không hợp lệ; `targetColumn` không tồn tại; `parameters` sai (vd. regex không biên dịch được, `newName` trùng) |

**Luồng xử lý chính**
1. [FE] Gửi yêu cầu kèm `currentVersion` đang hiển thị (thường sau API-36).
2. [BE] Kiểm tra schema, `actionType`, `parameters`.
3. [BE] *Bước kiểm tra Dataset*.
4. [BE] So `currentVersion` với `dataset.currentVersion`.
5. [DB] Mở transaction.
6. [DB] Áp phép biến đổi lên `dataset_records` bằng Bulk Write → `rowsAffected`.
7. [DB] Tạo bản ghi `dataset_versions` mới: `versionNumber = currentVersion + 1`, lưu công thức biến đổi (`actionType`, `targetColumn`, `parameters`), `parent_hash` = `version_hash` phiên bản trước, `version_hash = SHA256(parent_hash + version_number + operations_json + data_checksum)`.
8. [DB] Cập nhật `dataset.currentVersion = newVersion`, `rowCount`; điều kiện cập nhật kèm `currentVersion` cũ để chặn ghi đồng thời.
9. [DB] Ghi sự kiện outbox "tạo phiên bản".
10. [DB] Commit.
11. [Graph] Worker outbox tạo node phiên bản mới và cạnh `(v_old)-[:TRANSFORMED_BY]->(v_new)` (bất đồng bộ).
12. [BE] Trả `200`.

> Tên cạnh theo spec là `TRANSFORMED_BY`; mã nguồn lineage hiện dùng mô hình node `Transformation` với cạnh `DERIVED_FROM` / `APPLIED_TO`. Hai cách biểu diễn tương đương về ngữ nghĩa; khi vẽ hình dùng theo spec.

**Luồng lỗi**
- E1 (2) Tham số sai → `400`.
- E2 (3) → `404` / `403`.
- E3 (4) hoặc (8) Lệch phiên bản → `409`; [FE] tải lại phiên bản mới nhất.
- E4 (6–9) Lỗi giữa chừng → rollback transaction; dữ liệu và `currentVersion` giữ nguyên → `500`.
- E5 (11) Neo4j không sẵn sàng → outbox thử lại; API vẫn trả `200`.

---

### API-36. Chạy thử biến đổi (F7.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/datasets/:datasetId/transformations/dry-run` | Chủ sở hữu Dataset hoặc Admin | Đề xuất | FR-7.2 |

**Input**: giống API-35.

**Output — `200 OK`**
```json
{
  "sampleBefore": [ { "_rowId": "string", "age": null } ],
  "sampleAfter":  [ { "_rowId": "string", "age": 31 } ],
  "estimatedRowsAffected": 120
}
```

**Lỗi riêng**: `400` như API-35; `409` khi `currentVersion` lệch `[GIẢ ĐỊNH]` (để kết quả xem trước khớp dữ liệu sẽ áp dụng).

**Luồng xử lý chính**
1. [BE] Kiểm tra schema.
2. [BE] *Bước kiểm tra Dataset*; so `currentVersion`.
3. [DB] Lấy 10 dòng mẫu của phiên bản hiện hành (ưu tiên dòng bị tác động) `[GIẢ ĐỊNH cách chọn mẫu]`.
4. [BE] Áp phép biến đổi **trong bộ nhớ** lên mẫu → `sampleAfter`.
5. [DB] Đếm số dòng thỏa điều kiện tác động trên toàn Dataset → `estimatedRowsAffected`.
6. [BE] Trả `200`. Không ghi dữ liệu, không tạo phiên bản, không ghi outbox.

**Luồng lỗi**
- E1 (1) → `400`.
- E2 (2) → `404` / `403` / `409`.
