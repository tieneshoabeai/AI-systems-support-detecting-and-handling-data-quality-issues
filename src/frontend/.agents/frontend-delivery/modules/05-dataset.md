# Module 05 — Dataset, upload và xóa

Trạng thái: plan; owner FE B, reviewer FE A. Nguồn: [audit](00-contract-audit.md), Swagger live; backend `modules/datasets/` controller/service/repository/schema/DTO; Project service. Không code, không upload/xóa dữ liệu thật trong đợt tài liệu.

## 1. Yêu cầu và phạm vi

Một project có tối đa một dataset active theo ingestion service. FE cho xem metadata/schema, chuẩn bị upload, đổi tên và xóa theo quyền server. Upload/xóa có phần lưu ý định cục bộ đã được duyệt; durable draft và server sync triển khai ở hai batch khác nhau, không gộp thành một API success.

Excel/JSON/giới hạn size-row-column chưa được source chứng minh: không bật hỗ trợ dựa chỉ vào extension label. Gate phải được chốt trước code upload production. Không dùng file thật của người dùng làm test mặc định.

## 2. Đặc tả sáu mục

| Mục | Nội dung |
|---|---|
| Đầu vào | projectId, datasetId; file; rename name; delete intent có resource identity và xác nhận tự gửi sau outage |
| Điều kiện | Phiên/quyền hợp lệ; project còn tồn tại và chưa có active dataset khi upload; rename 1–100 theo DTO; file format/limits còn gate |
| Xử lý | Read project dataset/detail/schema; upload multipart một file; server parse/ingest; ACK mới nhận dataset chính thức; draft ghi IndexedDB trước báo saved-local |
| Đầu ra | Metadata/schema theo server; trạng thái local draft tách biệt INGESTING/READY/FAILED của server; lỗi không bị nuốt |
| Xếp loại | Server dataset absent/INGESTING/READY/FAILED; local pending/sending/awaiting-reconciliation/blocked/synced; không cùng một enum |
| Thứ tự | Auth → Project → kiểm tra điều kiện → lưu/send tùy batch → server ACK → update/refetch Project/Dataset/Grid/Lineage đúng scope |

## 3. Contract thực tế

Path sau `/api/v1`; T là source payload bên trong envelope.

| API | Input | T/hành vi static |
|---|---|---|
| POST `/projects/{projectId}/datasets/upload` | multipart file; OpenAPI chưa có body schema; controller Busboy xử lý event file, chưa kiểm field name trong callback | `{ message,dataset }`, service suy tên từ filename; không đọc datasetName form như spec |
| GET `/projects/{projectId}/datasets` | projectId | `{ dataset: document hoặc null }`, null là chưa có, không tự đổi thành 404 |
| GET `/datasets/{id}` | dataset id | `{ dataset }`, invalid id 400, absent/deleted 404 theo source |
| PATCH `/datasets/{id}` | `{ name? }`, string 1–100/trim theo DTO | `{ message,dataset }` |
| DELETE `/datasets/{id}` | dataset id | `{ message }`, soft delete dataset+records, set project.has_dataset false |
| GET `/datasets/{id}/schema` | dataset id | `{ columns }` |

Dataset document: `_id,project_id,workspace_id,name,original_file_name,file_format,file_size_bytes,file_checksum,storage_key,row_count,column_count,columns,current_version,status,deleted_at,created_at,updated_at`. Column `{ name,data_type,original_name,missing_count }`; data_type string/number/boolean/date. Không tự đòi nullRate/nullCount của spec. Chỉ render metadata người dùng cần, không expose storage_key như link tải công khai.

Source ingestion: project.has_dataset guard → quota storage check nếu biết content length → tạo INGESTING → stream hash/upload/CSV parse → schema inference → READY → set has_dataset → outbox lineage. Lỗi catch ghi FAILED; một phần dữ liệu có thể đã được ghi trước khi lỗi, không hứa atomic upload hoặc tự retry tạo dataset mới.

Source nhận diện xlsx/json nhưng parsePromise luôn processCsvStream. Checksum là SHA-256, không phải operation id. Project guard không chứng minh race-free uniqueness giữa request concurrent; không đặt expectation backend dedup nếu chưa test/contract.

## 4. UI/files/cache

- Project dataset region và detail `/datasets/:datasetId`; route entries mỏng; `views/datasets`, `components/datasets`, `hooks/datasets`, `services/datasets`, `types/datasets`, `src/__tests__/datasets`.
- Batch local thêm `repositories/datasets` và operation model dùng chung sync theo owner được chỉ định, không mỗi feature mở DB instance riêng.
- Upload view: chọn file, metadata, gửi/tiến trình nếu thực có callback, lỗi, trạng thái draft/server; không fake timer percent hoàn tất. Form hiện khả năng hỗ trợ thực sau gate format/limit.
- Null dataset: empty region + upload nếu quyền/điều kiện đủ. FAILED/INGESTING không render như READY. Response upload ACK không đồng nghĩa Neo4j graph có ngay.
- Query key account+project dataset, account+dataset detail/schema. Rename ACK update list/detail/scene label; delete ACK hủy query records/stats/lineage, refetch project và bỏ selection đúng dataset. Không invalidate toàn tài khoản không cần thiết.
- Payload identity luôn dataset id thật; local draft có id riêng, không ghi đè thành resource server trước ACK.

## 5. Lưu cục bộ và sync

Chỉ khi Internet còn, API lỗi và access token còn hạn: cho lưu upload Blob + metadata + operation, hoặc delete intent. Xác nhận ban đầu của delete ghi rõ tự gửi khi BE phục hồi; pending có thể hủy. Cả file và operation commit transaction trước thông báo saved-local. Quota/abort fail: báo chưa lưu, không memory fallback giả durable.

Auth hết hạn: về login theo health/consent policy, giữ IndexedDB nhưng khóa truy cập. Chỉ đúng account đã xác thực mới đọc/gửi. Rename chưa được duyệt local queue.

Replay **chưa bật**: backend phải có operation identity/dedup, reconciliation sau timeout, version/resource guard và phản hồi conflict. Health đạt không tự mở gate. Sending/reload/mất ACK phải đối soát; delete→upload cùng project chờ predecessor ACK, không tự gửi lại cả chuỗi.

## 6. Test case dự kiến

| Mã | Nhóm | Input/sự kiện | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| D01 | Thường | GET project dataset null | Empty state, không dataset giả | Absence |
| D02 | Thường | Upload fixture format đã xác nhận, project rỗng | Multipart đúng, server ACK mới chính thức/refetch | Ingestion |
| D03 | Không hợp lệ | Project đã có dataset | Theo source 409, không tự xóa dataset cũ | 1:1 |
| D04 | Không hợp lệ | Không có file | Form chặn; controller nguồn có 400 missing file | Input |
| D05 | Biên | Rename 1/100 và 101 ký tự | Theo DTO; 101 chặn/validation lỗi | Boundary |
| D06 | Đặc biệt | Dataset INGESTING/FAILED | Hiện trạng thái, không ready giả | Server lifecycle |
| D07 | Đặc biệt | Lưu draft rồi reload | Blob/operation còn nếu browser data còn và auth gate đạt | Durability |
| D08 | Đặc biệt | IndexedDB quota/transaction abort | Không saved-local; không operation mồ côi | Atomic local |
| D09 | Đặc biệt | Token hết hạn khi outage | Dừng local action, login, giữ draft | Policy |
| D10 | Đặc biệt | Upload timeout sau BE commit | Await reconciliation, không tự upload mới | Dedup gate |
| D11 | Đặc biệt | Delete pending hủy / request in-flight hủy | Pending không gửi; in-flight không hứa server hủy | Cancel |
| D12 | Đặc biệt | Delete ACK rồi upload thay thế | Revalidate project rồi mới successor | Order |
| D13 | Không hợp lệ | Account B mở draft A | Không đọc/gửi; giữ riêng owner | Isolation |
| D14 | Đặc biệt | Hai tab hoặc hai upload concurrent | Replay dừng nếu gate chưa đạt; expected dedup backend chỉ chốt khi contract có | Concurrency |
| D15 | Không hợp lệ | XLSX/JSON hoặc file vượt giới hạn chưa chốt | Không tự gán supported/HTTP; đánh dấu blocked trước code | Missing requirements |
| D16 | Đặc biệt | Upload ACK, lineage GET 404 | Dataset vẫn hợp lệ; graph hiện chưa khả dụng | Async projection |

File rỗng/header-only, duplicate columns/rows, Unicode, dấu phân cách, malformed CSV, min/max file size/rows/columns phải đặc tả sau parser/limit gate; không bịa expected output. Numeric NaN áp dụng dữ liệu cột ở Visualization, không dùng làm giả file fixture. Chưa thực thi.

## 7. Pseudocode và dò tay

```text
chuẩn bị upload → kiểm tra session/project/input theo rule đã chốt
NẾU online flow được phép: gửi một lần, ACK mới update server state
NẾU outage + token còn hạn + local batch đã có:
  transaction lưu Blob + draft + operation
  commit → saved-local; lỗi → chưa lưu
coordinator chỉ gửi khi backend gate đủ, phiên/quyền/resource còn hợp lệ
timeout/ACK thiếu → chờ đối soát, không tự tạo thao tác mới
delete intent tương tự nhưng confirm auto-send trước commit local
```

Dò tay thường: project rỗng, upload ACK READY → refetch project/dataset, không tự giả graph. Dò tay biên: local transaction abort trước commit → UI chưa lưu, không gửi. Đây là walkthrough, chưa chạy.

## 8. Batch/gate/nghiệm thu

1. Read metadata/schema/absent/server states + DTO/mapper.
2. Online upload/rename/delete sau format/limit, permission và fixtures đã xác nhận.
3. Durable drafts sau quota/schema/migration/retention được duyệt và owner sync/storage được chỉ định.
4. Replay chỉ khi contract backend đủ; không bỏ gate vì FE đã có Dexie.

Reviewer FE A kiểm tra auth/cache/project context và không queue ngoài whitelist; FE B chịu scene/grid adapters. Không cài thêm parser/crypto hoặc sửa BE để che contract thiếu.

## 9. Prompt triển khai và log

```text
CONTEXT: React 19.3.1/TS 6.0.3/Vite 8/Yarn, Dexie đã cài nhưng chưa có repository; FE B owner, FE A review.
TASK: Chỉ implement batch Dataset được duyệt tại mục 8, không tự gộp draft và replay.
INPUT: Sáu endpoint mục 3, fixture format/limits được xác nhận, projectId/account scope. Nếu thiếu upload schema thì đọc controller/service và hỏi, không tự đoán.
CONSTRAINTS: ACK mới server success; local transaction commit mới saved-local; token hết hạn khóa nghiệp vụ; replay gate backend không được bypass; không .env/file thật/token log.
PSEUDOCODE: Mục 7, timeout là kết quả chưa rõ chứ không chắc thất bại.
EXAMPLES: GET dataset null → empty; local abort → chưa lưu; upload ACK + lineage 404 → giữ dataset, graph chưa sẵn sàng.
OUTPUT: Patch theo batch, code trọng tâm/flow, diff, evidence test/runtime tách riêng, assumptions/gates chưa giải quyết.
CRITERIA: D01–D16 liên quan batch; case blocked không được giả pass; không hỗ trợ Excel/JSON chỉ vì extension.
```

Log 1–5: mục 1/2–3/6/7/9. Mã AI, test FE/ingestion, quyết định nhận code: chưa thực hiện. Ghi nhớ source evidence không thay thế runtime contract.
