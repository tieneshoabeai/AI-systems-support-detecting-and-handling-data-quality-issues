# Module `datasets` — Nhập CSV, Lược Đồ, Bản Ghi

Sở hữu toàn bộ dữ liệu thô: collection `datasets` (metadata) + `dataset_records` (từng dòng) + tệp CSV gốc trên Storage. Là nguồn thật cho `data-view` (đọc bản ghi qua `RECORD_QUERY_PORT`) và `analysis` (quét toàn bộ bản ghi). Một dự án tối đa một dataset.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/datasets/`
- Loại kiến trúc: CQRS đầy đủ, 33 tệp `.ts`.
- Sở hữu: `datasets`, `dataset_records`, tệp CSV gốc.
- Cung cấp: `DATASET_REPOSITORY_PORT`, `RECORD_QUERY_PORT`, `DatasetPolicyLoader`, `stableColumnKey`, các hằng giới hạn.
- Phụ thuộc: `projects` + `workspaces` (kiểm tra quyền, trừ quota), `shared` (Storage, Outbox).

## 2. Cây thư mục đầy đủ

```text
datasets/
├── domain/
│   ├── entities/dataset.entity.ts                 # Dataset (projectId, name, columns c0..cN, status, storageKey)
│   ├── value-objects/column-type.vo.ts            # COLUMN_DATA_TYPES, stableColumnKey c{i}
│   ├── value-objects/dataset-limits.vo.ts         # MAX_FILE_BYTES 50MB, MAX_COLUMNS 1000, IMPORT_BATCH_SIZE
│   ├── value-objects/value-coercion.vo.ts         # Ép kiểu chuỗi CSV -> số/ngày/boolean
│   ├── services/csv-delimiter.util.ts             # Tự phát hiện dấu phân cách , ; \t |
│   ├── services/pii-heuristic.util.ts             # Nhận diện email/phone/CCCD gợi ý is_pii
│   ├── services/finding.util.ts                   # makeFinding (DQ-01..DQ-05)
│   ├── ports/dataset.repository.port.ts           # CRUD dataset
│   ├── ports/record-query.port.ts                 # listAllRecords/list/query/stats (cho data-view + analysis)
│   └── events/dataset-events.ts                   # DATASET_INGESTED/DELETED
├── application/
│   ├── commands/
│   │   ├── ingest-dataset-stream.handler.ts       # Upload streaming busboy + fast-csv, suy luận schema
│   │   ├── delete-dataset.handler.ts              # Xóa mềm + gỡ cờ hasDataset + trừ quota (1 transaction)
│   │   ├── cascade-project-datasets.handler.ts    # Xóa dataset khi PROJECT_DELETED
│   │   ├── cascade-dataset-event.subscriber.ts    # Đăng ký lắng nghe event vào registry shared
│   │   └── map-props-to-original-names.handler.ts # Đổi props.cN -> tên gốc cho hiển thị
│   ├── queries/
│   │   ├── get-dataset-by-id / get-dataset-by-project-id
│   │   ├── get-dataset-schema (trả columns c0..cN + kiểu + is_pii)
│   │   └── download-dataset-file (trả stream CSV gốc)
│   ├── services/schema-inference.service.ts       # Suy luận kiểu cột từ mẫu (số/ngày/chuỗi, distinct, null)
│   ├── services/dataset-finding.service.ts        # Quét finding ban đầu sau ingest
│   ├── policy-loaders/dataset-policy.loader.ts    # Nạp dataset cho @PolicyResource (chống IDOR)
│   └── datasets.types.ts | datasets.utils.ts      # Kiểu + assertCsvFile/assertMagicBytes/newHexId
├── infrastructure/persistence/
│   ├── dataset.schema.ts                          # Schema Dataset (columns, storage_key, fingerprint)
│   ├── dataset-record.schema.ts                   # Schema DatasetRecord (dataset_id, row_index, props Map cN->giá trị)
│   ├── datasets.repository.ts                     # Hiện thực DATASET_REPOSITORY_PORT
│   └── record-query.repository.ts                 # Hiện thực RECORD_QUERY_PORT (keyset, không skip)
├── presentation/
│   ├── controllers/datasets.controller.ts         # @Controller() bare, 6 route đường dẫn đầy đủ
│   └── responses/dataset.response.ts              # Ẩn storageKey, đổi props sang tên gốc
├── datasets.module.ts
└── index.ts
```

## 3. Tầng domain chi tiết

- `dataset.entity.ts`: trạng thái `INGESTING -> READY | FAILED`. `Dataset.create()` kiểm tra chỉ `.csv`, có header, số cột trong giới hạn. `markReady(schema)` khóa lược đồ, `markFailed(reason)` ghi lỗi.
- `column-type.vo.ts`: khóa cột bất biến `c{i}` (`stableColumnKey`), không bao giờ dùng tên hiển thị làm khóa. Đổi tên cột chỉ đổi `originalName`, fingerprint đổi theo.
- `dataset-limits.vo.ts`: `MAX_FILE_BYTES` (50MB), `MAX_COLUMNS` (1000), `IMPORT_BATCH_SIZE` (chèn theo lô), `SAMPLE_ROWS_CAP`, `storageKeyForDataset()`, `assertCsvFile/assertFileSize/assertColumnLimit`.
- `csv-delimiter.util.ts`: đọc vài KB đầu, đếm `, ; \t |`, chọn dấu cho nhiều cột nhất.
- `pii-heuristic.util.ts`: regex email/phone/CCCD + tên cột gợi ý (email, phone, cccd) để đánh dấu `is_pii`, sau đó `analysis` che `***` khi đưa vào prompt AI.
- `record-query.port.ts`: `listAllRecords` (analysis quét), `query` (data-view keyset), `columnStats`, `columnValues`. Mọi phân trang đều keyset, không `skip`.

## 4. Tầng application chi tiết

- `IngestDatasetStreamHandler`: nhận stream busboy, lưu tệp gốc qua Storage (S3/R2 hoặc local), parse `fast-csv` theo lô, ép kiểu (`value-coercion`), suy luận schema, tính fingerprint, gọi `set-has-dataset` của projects, cộng `storage_used` của workspace, kiểm tra quota trước. Ràng buộc 1 project = 1 dataset: project đã có dataset thì từ chối upload thứ hai.
- `DeleteDatasetHandler`: xóa mềm dataset + xóa `dataset_records` + xóa tệp R2 + gỡ cờ `hasDataset` + trừ quota — tất cả trong cùng một transaction (`MongooseTransactionService.withTransaction`), không bao giờ dở dang.
- `CascadeProjectDatasetsHandler`: nhận `PROJECT_DELETED`, tự xóa dữ liệu của mình (vì `datasets -> projects` nên `projects` không được gọi ngược, tránh chu trình CA9).
- `SchemaInferenceService`: quét mẫu, quyết định kiểu cột, tỉ lệ null, distinct, gợi ý PII.
- `DatasetFindingService`: sinh finding ban đầu (thiếu, sai kiểu, trùng) để `analysis` kế thừa.

## 5. Route đầy đủ (`@Controller()` bare)

| Phương thức | Đường dẫn đầy đủ | Bảo vệ | Mô tả |
|---|---|---|---|
| POST | `/api/v1/projects/:projectId/datasets/upload` | JWT + `can(Create, Dataset)` + ProjectScope | Streaming upload CSV duy nhất (F4.1, multipart, 201). |
| GET | `/api/v1/projects/:projectId/datasets` | JWT + PolicyResource | Thông tin dataset của dự án (F4.2). |
| GET | `/api/v1/datasets/:id` | JWT + DatasetPolicyLoader | Chi tiết dataset, ẩn `storage_key` (F4.3). |
| GET | `/api/v1/datasets/:id/schema` | JWT + DatasetPolicyLoader | Lược đồ với khóa ổn định `c0..cN` (F4.6). |
| GET | `/api/v1/datasets/:id/file` | JWT + DatasetPolicyLoader | Tải tệp gốc `.csv`, stream trực tiếp, có audit log (FILE-01). |
| DELETE | `/api/v1/datasets/:id` | JWT + DatasetPolicyLoader | Xóa mềm + giải phóng dự án (F4.5, 204). |

## 6. Bất biến

- Chỉ nhận `.csv` (kiểm tra đuôi + magic bytes), có header, tối đa 50MB / 1000 cột.
- Khóa cột `c{i}` bất biến; đổi tên không đổi khóa.
- Ẩn `storageKey` ở mọi phản hồi JSON, chỉ lộ khi tải tệp.
- Upload ép kiểu + dọn bản ghi mồ côi (`db:migrate:coerce`).

## 7. Test liên quan

`test/unit/datasets/` (10 tệp: delimiter, PII, findings, ingestion, wave4, chart...), `test/e2e/dataset-dataview.e2e-spec.ts`, `test/integration/record-query.spec.ts`.
