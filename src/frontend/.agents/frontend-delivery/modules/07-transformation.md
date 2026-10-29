# Module 07 — Transformation (chờ contract backend)

Trạng thái: **blocked đối với code thực thi**, đã lập plan. Owner/reviewer phải được chỉ định trước batch; không tự gán FE B vì có dataset. Nguồn: [audit](00-contract-audit.md), feature_spec_v4 và kiểm kê Swagger/source backend. Không có transformation endpoint trong snapshot 36 operation.

## 1. Yêu cầu và ranh giới

Mục tiêu sản phẩm: chuẩn bị phép làm sạch, xem trước tác động, xác nhận rồi thực thi để nhận phiên bản chính thức. Đây là mục tiêu từ spec, **không phải năng lực backend đã có**. Cell edit trực tuyến ở Visualization không thay thế transformation/versioning.

Danh mục mục tiêu từ spec: DROP_NULL_ROWS, IMPUTE_VALUE, SANITIZE_STRING, REPLACE_REGEX, DROP_COLUMN, RENAME_COLUMN. Chỉ dùng làm checklist trao đổi, không tự tạo enum API runtime hoặc payload parameters. Dry-run chưa có API; không chạy cục bộ rồi gọi là kết quả preview của server.

## 2. Đặc tả sáu mục ở mức plan

| Mục | Đã biết / còn thiếu |
|---|---|
| Đầu vào | Dataset/resource context và lựa chọn action/cột là mục tiêu UI; schema parameters, version identity, null semantics, regex engine/flags chưa chốt với BE |
| Điều kiện | Có quyền thực thi và dataset/version hợp lệ; điều kiện theo từng action cần contract BE, không chỉ token còn hạn |
| Xử lý | Draft công thức → validation → dry-run theo contract → xác nhận → execute → server ACK; hiện dừng trước gọi API |
| Đầu ra | Mục tiêu có before/after/affected rows và version; tên trường/đơn vị/chính xác hay ước tính chưa có contract thực tế |
| Xếp loại | Giai đoạn UI đề xuất: configuring, previewing, preview-ready, applying, conflict, failed, completed; không phải backend enum đã có |
| Thứ tự | Có contract trước DTO/service, preview phải gắn đúng recipe/version; thay input sau preview phải hủy hiệu lực preview; ACK trước version chính thức |

Không có request/response fixture hoặc expected HTTP cho execute/dry-run. Không dùng path trong spec cũ làm URL tích hợp khi đã thống nhất backend là chuẩn.

## 3. Checklist contract cần BE xác nhận

| Action mục tiêu | Quyết định phải có trước implementation |
|---|---|
| DROP_NULL_ROWS | Null là null/missing/empty/whitespace nào; target một/nhiều cột; all/any; ảnh hưởng row identity |
| IMPUTE_VALUE | Giá trị literal hay strategy; type coercion; chỉ ô null hay cả empty; dữ liệu date/boolean |
| SANITIZE_STRING | Trim/case/Unicode/locale; cột không phải string; thứ tự các bước |
| REPLACE_REGEX | Regex engine/flags, validation, giới hạn thời gian/độ dài, replacement syntax; invalid pattern không silent failure |
| DROP_COLUMN | Cột cuối cùng, identity/reserved field, dependency recipe/scene/profile |
| RENAME_COLUMN | Tên trùng, whitespace/dot/reserved names, downstream mappings sau rename |

Chung: method/path, request schema, permission model, response envelope, version concurrency, idempotency/ambiguous ACK, dry-run phạm vi/sample-selection/TTL, operation status nếu async, cancellation, failure atomicity và lineage timing. Không tự đặt các thông số này trong FE.

## 4. UI/files/state và tích hợp dự kiến

- Sau gate, bổ sung region transformation trong dataset view hoặc route được duyệt riêng; không đăng ký route giả thực thi trước.
- Domain files: views/components/hooks/services/types transformations; test `src/__tests__/transformations/`. Tên file batch cụ thể chốt sau schema; không tạo skeleton method trả mock success.
- Recipe draft trước mắt là ý định thiết kế; persistence IndexedDB và offline transformation **chưa được duyệt**. Không tự thêm whitelist.
- Preview panel phải hiện phạm vi mẫu/ước tính khi server quy định; không gọi 10 hàng là toàn dataset chỉ vì spec cũ nói vậy.
- Execute success sau ACK: invalidate dataset/schema/records/stats/version/lineage trong account/resource scope; graph projection có thể chậm, không giả graph mới.
- Conflict: giữ recipe, dừng apply, yêu cầu người dùng kiểm tra version/preview mới; không tự rebase hoặc last-write-wins.
- Column rename/drop phải cập nhật hoặc báo mapping 3D không còn hợp lệ theo policy sau này, không tự chuyển sang cột bất kỳ.

## 5. Test case và gate (chưa thực thi)

| Mã | Nhóm | Tình huống | Kết quả ở giai đoạn hiện tại / sau contract | Lý do |
|---|---|---|---|---|
| T01 | Không hợp lệ | Chưa có execute/dry-run API | Không gửi endpoint suy đoán, không success giả | Contract gate |
| T02 | Thường | Recipe hợp lệ + preview ACK theo contract tương lai | Hiện before/after/phạm vi đúng payload đã chốt | Preview |
| T03 | Đặc biệt | Thay target/parameter sau preview | Preview cũ không được dùng để apply | Consistency |
| T04 | Không hợp lệ | Regex invalid | Lỗi validation theo contract, không gọi là completed | Rule |
| T05 | Biên | Empty dataset / không có ô null / một cột cuối | Expected dữ liệu phải chốt theo action; hiện case blocked | Missing semantics |
| T06 | Đặc biệt | Người dùng hủy confirm | Không execute | Consent |
| T07 | Đặc biệt | Version đổi sau preview | Conflict handling theo contract; không tự retry apply | Concurrency |
| T08 | Đặc biệt | Timeout sau execute có thể đã commit | Giữ recipe, đối soát; không tạo version thứ hai | Idempotency |
| T09 | Không hợp lệ | 401/403/BE outage | Auth/denied/error; không local transformation giả | Boundary |
| T10 | Đặc biệt | NaN/Infinity/type sai/null/Unicode/trùng tên cột | Chốt expected theo action trước code, không tự coerce | Data fidelity |
| T11 | Thường | Execute ACK chính thức | Invalidate đúng resource, không toàn account; lineage pending riêng | Integration |

T02–T11 là checklist nghiệm thu sau khi có contract, không phải phép biến đổi đã được đặc tả đầy đủ. Không bịa kết quả numeric hoặc HTTP. Biên min/max cụ thể chờ schema parameters.

## 6. Pseudocode và dò tay

```text
NẾU chưa có contract đã xác nhận: báo blocked; DỪNG
chọn recipe và validate theo action schema
dry-run theo contract, lưu fingerprint recipe+version cùng preview
NẾU recipe/version đổi: vô hiệu preview
confirm apply → session/quyền/version gate → execute
ACK → refetch resource/version/lineage; lỗi/conflict → giữ recipe, dừng
timeout → đối soát, không auto tạo mutation mới
```

Dò tay thường ở mức flow: có contract + preview đúng recipe + đồng ý → gửi execute; dữ liệu đầu ra chưa có fixture nên chưa tính tay. Dò tay biên hiện tại: contract absent → dừng ngay, không gọi API. Không tuyên bố đã chứng minh thuật toán.

## 7. Batch và nghiệm thu

1. Chỉ định owner/reviewer; thống nhất contract và test fixture cho từng action với BE.
2. Duyệt spec action một batch một lần; validation/preview UI trước execute.
3. Execute/version conflict/idempotency sau backend gate; integration/cache/3D mapping.

Nếu còn thiếu rule ở mục 3, chỉ tiếp tục đọc/clarify, không sinh code. Backend không nằm trong batch này. Không thêm cơ chế crypto/AI/số phức để thay contract cleaning.

## 8. Prompt cho giai đoạn kế tiếp và log

```text
CONTEXT: Project React 19.3.1/TS 6.0.3/Vite 8/Yarn; module 07 hiện blocked vì Swagger chưa có transformation API.
TASK: Trước hết đối chiếu contract mới từ BE và cập nhật spec một action; chỉ sinh code sau người dùng duyệt batch có input/output đầy đủ.
INPUT: Mục 3 là checklist câu hỏi, không phải schema; không dùng endpoint/spec cũ làm API thật.
CONSTRAINTS: Không mock success, không local execute/offline queue, không tự định regex/null/version semantics hoặc thêm dependency.
PSEUDOCODE: Mục 6, gate trước mọi request.
EXAMPLES: Contract absent → báo blocked, không request. Recipe đổi sau preview → preview cũ vô hiệu, không apply.
OUTPUT: Nếu gate chưa đạt: câu hỏi/phương án có đánh dấu chờ xác nhận. Nếu đã đạt và batch được duyệt: patch/code trọng tâm, diff, test evidence và giới hạn.
CRITERIA: T01 không được vi phạm; các case còn lại chỉ nghiệm thu sau schema/fixture được xác nhận, không giả pass.
```

Log: bước 1 yêu cầu mục 1; 2 spec plan mục 2–3; 3 checklist test mục 5; 4 pseudocode mục 6; 5 prompt mục 8. Bước 6–8 code/test/chấp nhận code chưa thực hiện. Thuật toán data-level còn thiếu nên đặc tả chưa sẵn sàng implementation; không ghi log như đã hoàn tất.
