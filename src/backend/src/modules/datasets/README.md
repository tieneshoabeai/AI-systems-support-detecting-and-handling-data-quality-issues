# MODULE `datasets` - Tiep nhan & Luu tru du lieu

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/datasets` (33 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module chiu trách nhiệm **nhap du lieu CSV** va luu tru bat bien. Day la noi quyet dinh chat luong du lieu dau vao cho toan he thong.

> **Nguyen tac bat di bat die:** du lieu dataset la **INSERT-ONLY**. Chi ghi 1 lan luc import. Khong co `deleted_at`, khong co `version_number`, khong update, khong delete tung dong.

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Import CSV | Streaming, phat hien delimiter, suy luan schema, ghi record theo lo |
| Schema & cot | Suy luan kieu du lieu, dem gia tri thieu, danh dau cot PII |
| Findings | Phat hien van de o muc dataset (cot) va muc dong |
| Truy van | Doc record, schema, tai file goc |
| Xoa | Xoa mem dataset + xoa file tren R2 |
| Cascade | Xoa dataset khi project bi xoa |

### 2.2. Cau truc thu muc

```text
datasets/
|-- domain/
|   |-- entities/dataset.entity.ts
|   |-- value-objects/
|   |   |-- column-type.vo.ts        # string | number | boolean | date
|   |   |-- dataset-limits.vo.ts     # gioi han & luat import
|   |   `-- value-coercion.vo.ts     # chuan hoa gia tri theo kieu cot
|   |-- events/dataset-events.ts
|   |-- ports/
|   |   |-- dataset.repository.port.ts
|   |   `-- record-query.port.ts
|   `-- services/
|       |-- csv-delimiter.util.ts    # nhan dien dau phan cach
|       |-- finding.util.ts          # chuan hoa finding
|       `-- pii-heuristic.util.ts    # suy luan cot PII
|-- application/
|   |-- commands/
|   |   |-- ingest-dataset-stream.handler.ts   # handler nhap CSV
|   |   |-- delete-dataset.handler.ts
|   |   |-- cascade-project-datasets.handler.ts
|   |   |-- cascade-dataset-event.subscriber.ts
|   |   `-- map-props-to-original-names.handler.ts
|   |-- queries/                     # 4 query handler
|   |-- services/
|   |   |-- schema-inference.service.ts
|   |   `-- dataset-finding.service.ts
|   `-- policy-loaders/dataset-policy.loader.ts
|-- infrastructure/persistence/
|   |-- dataset.schema.ts            # metadata + columns + findings
|   |-- dataset-record.schema.ts     # dong du lieu (INSERT-ONLY)
|   |-- datasets.repository.ts
|   |-- record-query.repository.ts   # keyset pagination + aggregation
|   `-- dataset.mapper.ts
`-- presentation/
    |-- controllers/datasets.controller.ts
    `-- responses/dataset.response.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Nhap du lieu CSV **mot lan, khong sua, khong xoa** va lam cho moi thu muc dich sau deu co the tin tuyen du lieu goc. Dong thoi tu dong phat hien van de chat luong du lieu ngay khi nhap, thay vi cho nguoi dung phai doi chieu thu cong.

- **Technical Reasoning & Decisions:**

1. **Streaming, khong nap toan bo file vao RAM.** File 500 MB nap vao RAM se gay OOM. Streaming giu muc tieu thu on dinh ~20 MB bat ke file lon bao nhieu. Day la cam ket hieu nang co bang chung.

2. **Bulk insert theo lo (`IMPORT_BATCH_SIZE = 5000`).** Mot lenh insert cho 5000 dong nhanh hon 5000 lenh insert mot. Batch size can bang giua hieu nang va ap luc bo nho.

3. **Key cot bat bien `c0`, `c1`, ... `cN`.** Key nay **khong bao gio doi**, ke ca khi nguoi dung doi ten cot. Gia tri trong `dataset_record.props` luu theo key nay. `map-props-to-original-names.handler.ts` chuyen doi props theo ten goc khi xuat bao cao, de nguoi doc thay dung ten cot trong file CSV goc.

4. **Nhan dien delimiter thay vi gia dinh `,`.** File CSV thuc te hay dung `;` (chau Au) hoac `\t` (TSV). `csv-delimiter.util.ts` dem so lan xuat hien cua moi dau ung vien **ngoai** dau nhay kep, chon dau nhat quan nhat giua cac dong. Delimiter luu vao `dataset.delimiter` va dung lai khi tai file goc.

5. **Suy luan PII tu ten cot + mau gia tri.** Cột chứa PII duoc danh dau `is_pii: true` - frontend che gia tri mac dinh, va `pii-mask.util.ts` cua module `analysis` che PII truoc khi gui cho AI.

6. **Chi lay `SAMPLE_ROWS_CAP = 500` dong de suy luan schema.** Doc ca file de suy luan kieu du lieu la du thua; 500 dong du la du chinh xac va nhanh.

7. **Finding chuan hoa qua `finding.util.ts`.** Cung mot loai finding luon cung hinh dang - quan trong cho UI va cho AI doc.

8. **Ghi dataset metadata trong transaction truoc, ghi record sau.** Neu ghi record that bai, metadata co the con lai - xoa mem dataset la du de don dep, ton tai mot ban ghi rac thoi gian.

- **Generated / Modified Artifacts:**

- `domain/value-objects/dataset-limits.vo.ts` - `MAX_FILE_BYTES` (50 MB), `MAX_COLUMNS` (1000), `IMPORT_BATCH_SIZE` (5000), `SAMPLE_ROWS_CAP` (500), `assertCsvFile`, `assertFileSize`, `assertColumnLimit`, `storageKeyForDataset`.
- `domain/services/csv-delimiter.util.ts` - nhan dien dau phan cach.
- `domain/services/pii-heuristic.util.ts` - suy luan cot PII tu ten + mau gia tri.
- `domain/value-objects/value-coercion.vo.ts` - chuan hoa gia tri theo kieu cot.
- `application/services/schema-inference.service.ts` - suy luan kieu cot, dem thieu, suy luan PII.
- `application/commands/ingest-dataset-stream.handler.ts` - luong nhap chinh.
- `infrastructure/persistence/record-query.repository.ts` - keyset pagination + aggregation (2 giai doan, null sorting).

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `POST` | `/api/v1/projects/:projectId/datasets/upload` | `Action.Create` | Upload CSV (multipart) |
| `GET` | `/api/v1/projects/:projectId/datasets` | `Action.Read` | Danh sach dataset cua project |
| `GET` | `/api/v1/datasets/:id` | `Action.Read` | Chi tiet dataset |
| `DELETE` | `/api/v1/datasets/:id` | `Action.Delete` | Xoa mem dataset + file |
| `GET` | `/api/v1/datasets/:id/file` | `Action.Read` | Tai file CSV goc |
| `GET` | `/api/v1/datasets/:id/schema` | `Action.Read` | Schema & thong ke cot |

> **Khong co route cap nhat cot.** Dataset la **bat bien** sau khi nap: khong co
> `PATCH /datasets/:id`, `PATCH /datasets/:id/columns`, `POST /datasets/:id/columns/reset`
> hay `PATCH /datasets/:id/columns/pii`. Cờ PII duoc **tu suy** tu ten cot boi
> `pii-heuristic.util.ts` (khong bat/tat tay).

> **Xoa dataset — route duy nhat la `DELETE /datasets/:id`.**
> Khong ton tai `DELETE /projects/:projectId/datasets`. Ly do: xoa dataset se
> **go co `hasDataset` cua project** va **tru dung luong da dung cua workspace**
> (ca hai trong cung mot transaction — OPEN-09), nen route dat o root hop hon.
>
> Luong goi phia frontend:
> 1. `GET /api/v1/projects/:projectId/datasets` → lay `dataset.id`
> 2. `DELETE /api/v1/datasets/:id` → xoa mem dataset + giai phong dung luong

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/datasets/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `DatasetsModule` | Nest module |
| `Dataset` entity, `ColumnDefinition` | Domain contract |
| `DATASET_REPOSITORY_PORT` | Port truy van metadata dataset |
| `RECORD_QUERY_PORT` | Port truy van record (keyset + aggregation) |

### 4.3. Su kien domain phat ra

| Event | Khi nao | Muc dich |
|---|---|---|
| `dataset.created` | Nhap thanh cong | Thong bao + audit log |
| `dataset.imported` | Hoan tat ghi record | Thong bao + audit log |
| `DATASET_DELETED` | Xoa dataset | Kich hoat xoa file va cascade |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

- Chi chap nhan duoi `.csv` (`assertCsvFile`).
- File vuot `MAX_FILE_BYTES` (50 MB) bi tu choi **truoc** khi doc bat ky byte nao.
- So cot vuot `MAX_COLUMNS` (1000) bi tu choi.
- **Khong bao gio** `update` hoac `delete` mot `dataset_record` - collection nay la INSERT-ONLY.
- Moi dong goc co **dung mot** record: unique index `{ dataset_id: 1, row_index: 1 }`.
- Key cot bat bien `c{i}` khong doi theo thoi gian, ke ca khi doi ten cot.
- `row_count` va `column_count` phai khop voi so dong / so cot thuc te sau import.
- Storage key luon theo mau `raw_files/{datasetId}.csv`.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| File khong phai CSV | `assertCsvFile` - chi chap nhan `.csv` |
| File qua lon gay OOM | `assertFileSize` + streaming + `ANALYSIS_MAX_ROWS` |
| Doc file cua dataset nguoi khac | Policy loader nap instance + kiem tra `projectId` |
| PII lo | Danh dau `is_pii`, che gia tri mac dinh, che truoc khi gui AI |
| Truy cap truc tiep file goc | Chi qua route co policy, khong lo file truc tiep ra public bucket |
| Xoa file goc con sot | Cascade xoa file trong transaction |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `POST /projects/:projectId/datasets/upload` | `Action.Create` tren `Dataset` |
| `GET /projects/:projectId/datasets` | `Action.Read` |
| `GET /datasets/:id`, `/file`, `/schema` | `Action.Read` + policy loader kiem tra instance |
| `DELETE /datasets/:id` | `Action.Delete` |

> Dataset **khong** co vai tro rieng. Quyen tren dataset suy ra tu quyen tren project chua no (qua `projectId`).
> Dataset bat bien sau khi nap → khong co route cap nhat metadata cot (chi doc + xoa mem + tai file).

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `csv-delimiter.util.ts` nhan dien `;` va `\t` / CSV thuc te khong phai luon dung dau phay / `modules/datasets`
- **v0.9.5** / 2026-11-XX / Bo sung `pii-heuristic.util.ts` tu suy cot PII tu ten cot / Route `PATCH /datasets/:id/columns/pii` bi gỡ (OPEN-03/04) / `modules/datasets`
- **v0.9.0** / 2026-11-XX / Bo sung `dataset-finding.service.ts` sinh finding muc cot va muc dong / Tu dong phat hien van de ngay khi nhap / `modules/datasets`
- **v0.8.0** / 2026-11-XX / Chuyen sang streaming import + bulk insert theo lo 5000 dong / Giu muc tieu thu RAM ~20 MB / `modules/datasets`
- **v0.7.0** / 2026-11-XX / Bo sung cascade xoa dataset khi project bi xoa, boc transaction / Dam bao nhat quan / `modules/datasets`, `modules/projects`
- **v0.1.0** / 2026-11-XX / Tao module, bo cac command sua ten cot / Lam dataset hoan toan chi doc / `modules/datasets`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
