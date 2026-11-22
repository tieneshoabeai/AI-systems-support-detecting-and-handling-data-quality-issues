# MODULE `data-view` - Luoi du lieu ao

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/data-view` (15 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module cung cap khac nang **xem va truy van du lieu lon** ma khong bao gio nap toan bo vao RAM. Day la module hien thuc "Luoi du lieu ao" - trai nghiem bang voi hang trieu dong nhung moi trang chi <= 500 dong.

Module nay **chi doc**. No khong co repository rieng - dung `RecordQueryPort` do module `datasets` cung cap. Do dung: truy van ban ghi thuoc ve tang luu tru dataset, con `data-view` chi la lop trinh bay.

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Doc dong | Phan trang keyset theo `(row_index, _id)` |
| Truy van | Loc + sap xep + phan trang to hop |
| Thong ke cot | Count, distinct, min/max, trung binh, histogram, box plot |
| Bieu do | Histogram, box plot, top-N theo nhom |

### 2.2. Cau truc thu muc

```text
data-view/
|-- domain/
|   |-- entities/record-query.entity.ts
|   |-- value-objects/
|   |   |-- record-filter.vo.ts     # 14 toan tu loc
|   |   `-- record-query.vo.ts      # gioi han trang
|-- application/
|   |-- queries/
|   |   |-- get-records.handler.ts      # phan trang
|   |   |-- query-records.handler.ts    # loc + sap xep
|   |   |-- get-column-stats.handler.ts # thong ke cot
|   |   `-- get-chart-data.handler.ts   # du lieu bieu do
|   |-- data-view.types.ts
|   `-- data-view.utils.ts
`-- presentation/
    |-- controllers/data-view.controller.ts
    `-- dtos/  (chart-data.dto, query-records.dto, query-records-body.dto)
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Cho phep nguoi dung xem va loc du lieu hang trieu dong nhu mot bang binh thuong, voi do tre <= 50 ms cho moi lan cuon, ma khong bao gio phai nap du lieu ve Node.

- **Technical Reasoning & Decisions:**

1. **Keyset pagination, khong offset.** `offset=1000000` cua MongoDB phai scan va bo qua 1.000.000 document. Voi nguoi dung nhay toi trang 500.000, offset mat nhieu giay; keyset nhay thang toi vi tri can doc, duoi 50 ms. Cursor chua gia tri sap xep cuoi cung + `_id` de pha the hoan hao khi nhieu gia tri bang nhau.

2. **Gioi han trang 50 / 500.** `DEFAULT_RECORD_LIMIT = 50`, `MAX_RECORD_LIMIT = 500`. `normalizeRecordLimit` chuan hoa: gia tri khong huu han / <= 0 -> 50; > 500 -> 500. Client khong the ep server tra ve mot luc luon du lieu.

3. **Sap xep so & ngay: null o cuoi.** MongoDB sap xep `null` **truoc** moi gia tri khac khi tang dan. Nguoi dung muon xem "nhung nguoi khong cung cap tuoi" o **cuoi** danh sach. Voi hang tram nghin dong thieu gia tri, dau danh sach se toan dong rong - vo dung. `record-query.repository.ts` dung aggregation **hai giai doan** voi co `__sortnull_num` / `__sortnull_date` (0 = hop le, 1 = null).

4. **Chuyen doi kieu an toan.** Chi nhung gia tri thuc su la so moi duoc chuyen. Khong co kiem tra `$type`, MongoDB bien `false` -> `0` va `true` -> `1`, tao ra **histogram gia** cho cot boolean. Dieu kien: `$type` thuoc `double | int | long | decimal | string`.

5. **14 toan tu loc, giai key cot linh hoat.** `resolveColumnKeyPure` uu tien key `c{i}`, sau do ten hien thi, cuoi cung ten goc - frontend co the gui key hoac ten cot.

6. **Moi thong ke chay bang aggregation MongoDB**, khong ke du lieu ve Node de tinh. O voi hang trieu dong, cach nay khac biet giua chay duoc va khong chay duoc.

- **Generated / Modified Artifacts:**

- `domain/value-objects/record-filter.vo.ts` - `RECORD_FILTER_OPERATORS` (14 toan tu), `isValidOperator`, `propsPath`, `resolveColumnKeyPure`.
- `domain/value-objects/record-query.vo.ts` - `DEFAULT_RECORD_LIMIT` (50), `MAX_RECORD_LIMIT` (500), `normalizeRecordLimit`.
- `application/queries/get-records.handler.ts` - phan trang keyset, tra `nextCursor`.
- `application/queries/query-records.handler.ts` - loc + sap xep + phan trang to hop.
- `application/queries/get-column-stats.handler.ts` - thong ke theo kieu cot.
- `application/queries/get-chart-data.handler.ts` - histogram / boxPlot / categoryTopN.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `GET` | `/api/v1/datasets/:datasetId/records` | `Action.Read` | Trang du lieu (keyset) |
| `POST` | `/api/v1/datasets/:datasetId/records/query` | `Action.Read` | Truy van loc + sap xep |
| `GET` | `/api/v1/datasets/:datasetId/columns/:columnKey/stats` | `Action.Read` | Thong ke cot |
| `GET` | `/api/v1/datasets/:datasetId/charts` | `Action.Read` | Du lieu bieu do |

**Query params `GET /records`:** `limit` (mac dinh 50, toi da 500), `cursor`, `sort`, `order` (`asc` | `desc`).

**Body `POST /records/query`:**

```json
{
  "filters": [
    { "columnKey": "c2", "operator": "greaterThan", "value": 18 }
  ],
  "sort": { "columnKey": "c2", "order": "asc" },
  "limit": 50,
  "cursor": "..."
}
```

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/data-view/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `DataViewModule` | Nest module |
| `RecordQuery` entity | Domain contract |
| `RecordFilterOperator`, `RECORD_FILTER_OPERATORS` | Danh muc toan tu loc |

### 4.3. Su kien domain phat ra

> Module nay **khong phat su kien** - no thuan la lop doc du lieu.

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

- `limit` luon nam trong `[1, 500]`; gia tri khong hop le -> 50.
- Cursor **phai** duoc sinh tu chinh API nay - client khong duoc tu chay.
- Toan tu loc phai thuoc `RECORD_FILTER_OPERATORS` - toan tu la duoc `isValidOperator` chan.
- Duong dan thuoc tinh **luon** nam trong `props.c{i}` - khong duoc truy cap truc tiep field khac cua `dataset_record`.
- Gia tri **null** (hoac khong parse duoc) phai sap xep **cuoi** danh sach khi sap xep theo so / ngay.
- Cot boolean **khong** duoc tinh histogram so.
- Moi trang **khong vuot qua** `MAX_RECORD_LIMIT` dong.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Doc dataset nguoi khac | Policy loader cua module `datasets` kiem tra instance |
| Ep server tra ve du lieu lon | `normalizeRecordLimit` chan tren 500 dong |
| Injection qua ten cot | `resolveColumnKeyPure` chi nhan key co trong danh sach; duong dan dung `propsPath` |
| Toan tu loc la | `isValidOperator` chan truoc khi build truy van |
| Lo du lieu qua phan trang | Chi con du lieu thuoc dataset da duoc cap quyen |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `GET /datasets/:datasetId/records` | `Action.Read` tren `Dataset` + policy loader |
| `POST /datasets/:datasetId/records/query` | `Action.Read` |
| `GET /datasets/:datasetId/columns/:columnKey/stats` | `Action.Read` |
| `GET /datasets/:datasetId/charts` | `Action.Read` |

> Module nay **khong** dinh nghia policy loader rieng - no tai su dung loader cua module `datasets` de khong nhan hai noi suat ve quyen.

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `GET /charts` phuc vu histogram, boxPlot, categoryTopN / Cho phep truc tiep ve bieu do ma khong can tinh o client / `modules/data-view`
- **v0.9.0** / 2026-11-XX / Bo sung `get-column-stats.handler.ts` va tien ich `chart-data.util.ts` / Tien hoa thong ke cot theo kieu du lieu / `modules/data-view`
- **v0.8.0** / 2026-11-XX / Chuyen tu offset sang keyset pagination va them gioi han `MAX_RECORD_LIMIT = 500` / Lo do tre tren du lieu lon / `modules/data-view`, `shared/domain/pagination`
- **v0.7.0** / 2026-11-XX / Bo sung `__sortnull_num` / `__sortnull_date` trong aggregation hai giai doan / Gia tri null o cuoi danh sach / `modules/datasets`
- **v0.6.0** / 2026-11-XX / Chan chuyen doi kieu khong an toan: bo sung kiem tra `$type` / Xoa histogram gia cho cot boolean / `modules/datasets`
- **v0.1.0** / 2026-11-XX / Tao module, tach tu `datasets` / Luoi du lieu ao la tang rieng / `modules/data-view`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
