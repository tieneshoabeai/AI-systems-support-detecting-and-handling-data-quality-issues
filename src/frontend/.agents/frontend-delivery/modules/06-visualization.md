# Module 06 — Data Grid, thống kê và ranh giới dữ liệu 3D

Trạng thái: plan, chưa implementation/test nghiệp vụ. Owner FE B, reviewer FE A. Nguồn: [audit](00-contract-audit.md), [Dataset](05-dataset.md), Swagger live; backend `modules/data-view/` và `shared/pagination/cursor-paginated.response.ts`, dataset-record schema.

## 1. Yêu cầu

Xem record theo cursor, chọn cột xem thống kê, sửa ô trực tuyến theo API thật; giữ identity để selection có thể liên kết scene 3D. Không tạo search/filter/sort/version selector mà backend chưa hỗ trợ. 3D mapping chỉ thiết kế ranh giới, chưa chọn X/Y/Z/normalize/sampling.

## 2. Đặc tả sáu mục

| Mục | Nội dung |
|---|---|
| Đầu vào | datasetId; cursor?, limit?, sort_field?, sort_order? theo DTO; columnName; rowIndex và `{ field,value }` khi edit |
| Điều kiện | Dataset/resource quyền hợp lệ; limit integer 1–200 mặc định 50; row identity từ response; field không rỗng; không hứa backend validate cell theo column type |
| Xử lý | Fetch cursor page → map record → render; profile GET riêng; cell PATCH một lần sau validate đã chốt, ACK rồi refetch records/stats |
| Đầu ra | Cursor T `{ items,next_cursor,has_more,total_count? }`; edit `{ message,record }`; stats `{ stats }` |
| Xếp loại | Loading-first/loading-next/empty/ready/read-error; editing/saving/save-error; profile unavailable/error riêng |
| Thứ tự | Dataset scope trước request; cursor mới theo next_cursor, không tự giải mã; đổi dataset reset query/selection; edit ACK trước giá trị chính thức |

## 3. Contract và giới hạn source

| API sau `/api/v1` | Request | T/source |
|---|---|---|
| GET `/datasets/{datasetId}/records` | cursor optional string; limit integer 1–200 default 50; sort_field optional; sort_order asc/desc default asc | Cursor response; service hiện sort row_index tăng dần và filter row_index > cursor |
| PATCH `/datasets/{datasetId}/records/{rowIndex}` | ParseInt path; body field string trim min1, value unknown | record document, service `$set data.field`; không có If-Match/version guard đã dùng |
| GET `/datasets/{datasetId}/columns/{columnName}/stats` | datasetId/columnName, không version query | stats column_name,total_records,null_count,missing_ratio,histogram; numeric có min/max/average |

Record document `_id,dataset_id,row_index,data,version_number,deleted_at,created_at,updated_at`; cell values nằm trong `data`, không nằm ngay record root. Giữ `_id` và datasetId/row_index làm identity; không dùng index của mảng trang làm rowIndex API. Column name trong URL phải encode, không nối string thô.

Không dùng total_count để suy ra jump-to-page khi cursor không có API phù hợp. Không bật sort tùy cột dù Swagger có query field. Không gọi `/query` hoặc `/profile` từ spec cũ. Stats không có median/stdDev/topCategories; không render số giả cho field vắng.

Stats service có logic xử lý null/zero/empty và range histogram cần fixture runtime xác nhận; data profile không tự coi là ground truth tính lại ở FE. Column không tồn tại chưa có guard rõ trong service đã đọc: status/UX cần contract test, không đoán luôn 404.

## 4. UI, files và state

- View grid/profile trong dataset detail, entry tái sử dụng resource route; `views/visualization`, `components/visualization`, `hooks/visualization`, `services/visualization`, `types/visualization`; test `src/__tests__/visualization/`.
- Query records theo account/dataset/limit/cursor chain; next không có cursor thì dừng. Query profile thêm column. Khi đổi scope cancel/ignore response cũ.
- Chọn cột và chọn record giữ id, không copy toàn data vào state scene. Cell draft chỉ memory; BE outage không queue edit. Session hết hạn pause action qua Auth.
- Sau edit ACK invalidate records và stats cột liên quan trong cùng dataset; nếu đổi account trong lúc gửi, không ghi cache mới. Response timeout giữ trạng thái chưa xác nhận; retry ghi phải được người dùng quyết định sau đối chiếu.
- Không dùng body min-width hoặc bảng rộng để làm scene/DOM không truy cập được; grid cần loading/empty/error rõ, keyboard editor khi được triển khai. Virtualization library/performance limits chốt trước batch, không cài thêm tự động.

## 5. Ranh giới data 3D và math

Input scene là tập điểm/objects đã chuẩn bị, có source identity/phạm vi và selection callback. Backend record response không được tự đẩy vào X/Y/Z bằng ba cột đầu. Người dùng chưa chốt axis mapping, missing values, type conversion, scaling, sampling, max points, full-data strategy; tất cả là gate trước code scene dữ liệu.

Module này không biến số phức thành thuật toán phát hiện bất thường. Motion dùng math độc lập: complex/quỹ đạo mặt phẳng, vector/vị trí, Quaternion/quay; graphics không gọi API hay Dexie. Dữ liệu page đã tải chỉ là phạm vi page, không gọi là toàn dataset hoặc tính stats toàn dataset từ nó.

## 6. Test case dự kiến

| Mã | Nhóm | Input/sự kiện | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| V01 | Thường | First page 50 items, has_more true | Render data đúng; next gửi cursor từ server | Cursor |
| V02 | Biên | limit 1/200 và 0/201 | Biên hợp lệ theo DTO; ngoài biên validation | Boundary |
| V03 | Đặc biệt | items [], next_cursor null, has_more false | Empty/stop, không loop fetch | Empty |
| V04 | Thường | Edit record row_index 75 trong page thứ hai | PATCH path 75, không index local 0 | Identity |
| V05 | Thường | Profile numeric ACK | Render chỉ min/max/average/histogram có thật | Field accuracy |
| V06 | Không hợp lệ | Field rỗng / rowIndex không integer | Chặn/hiện lỗi, không ghi UI thành công | Input |
| V07 | Đặc biệt | Cell null, false, 0, empty string, Unicode | Giữ đúng giá trị/type, không `value || fallback` | Data fidelity |
| V08 | Đặc biệt | Column name có khoảng trắng/dấu chấm | URL encode và field identity đúng | Encoding |
| V09 | Đặc biệt | Đổi dataset trong lúc profile/records đang tải | Không render kết quả resource cũ | Race |
| V10 | Không hợp lệ | 401/403/404 hoặc timeout edit | Session/denied/not-found/save-error; không queue/retry ngầm | Failure |
| V11 | Đặc biệt | Request sort_field nhưng service chưa hỗ trợ | UI chưa expose sort server, không hứa sort toàn bộ | Source gap |
| V12 | Đặc biệt | Duplicate identity giữa cursor pages | Không tạo hàng id giả; flag inconsistency, không count hai lần | Pagination consistency |
| V13 | Đặc biệt | Một phần page đưa sang scene | Phạm vi tải được giữ; không gắn nhãn toàn dataset | 3D boundary |
| V14 | Biên | Tất cả số bằng nhau/0/null profile | Đối chiếu fixture BE; không tự sửa/ước lượng bin | Profile gate |

Invalid column/NaN/Infinity/object values cần được chốt policy edit trước production: `unknown` không đủ để FE tự chọn coercion. Case V14 là gate contract nếu BE trả kết quả chưa rõ, không tự điền số mong đợi. Chưa test runtime.

## 7. Pseudocode và dò tay

```text
load(datasetId, cursor):
  kiểm tra session/scope; GET records; map items.data + identity
  NẾU ACK còn đúng dataset/account: render page và next_cursor
  next chỉ gọi khi has_more và cursor hợp lệ
selectColumn(name): GET encoded name stats; render theo payload có thật
saveCell(record, field, draft):
  kiểm tra phiên/validation đã chốt
  PATCH record.row_index, body field/value đúng type
  ACK → refetch records/stats; lỗi → giữ draft và báo chưa xác nhận
```

Dò tay thường: trang 2 item row_index=75 → sửa value=0 → PATCH /75 giữ số 0. Dò tay biên: items=[]/has_more=false → empty và không gọi next. Không phải FE execution.

## 8. Batch/gate/nghiệm thu

1. Cursor read + DTO mapper, identity, empty/error.
2. Profile + source coverage tests, fixtures numeric/non-numeric/null/zero.
3. Online edit sau policy value/field/permission rõ; không promised conflict-safe vì BE chưa có guard.
4. 3D adapter/scene chỉ sau mapping/performance/selection spec được duyệt.

FE A review session/shared query, FE B sở hữu grid/scene boundary. Không tự thêm chart/virtualization package hoặc replace backend stats. Response fixture/permission runtime vẫn cần xác nhận.

## 9. Prompt triển khai và log

```text
CONTEXT: React 19.3.1/TypeScript 6.0.3/Vite 8/Yarn; Query server state, Three/Fiber cho scene khi được duyệt.
TASK: Triển khai đúng batch mục 8 đã được duyệt, không tự mở rộng data mapping hoặc offline edit.
INPUT: Contract mục 3, record.data + row_index, cursor response, stats DTO; fixture được xác nhận.
CONSTRAINTS: Không sort/filter/version API giả; không biến null/false/0 thành missing; encode columnName; account/resource scope; không mutation retry/If-Match giả.
PSEUDOCODE: Mục 7; scene nhận model, không gọi API.
EXAMPLES: Row 75 ở page2 → PATCH /75, value 0; empty final page → dừng next; profile thiếu median → không render số giả.
OUTPUT: Patch file đã duyệt, code trọng tâm và walkthrough một record, diff, static/test/runtime evidence riêng.
CRITERIA: V01–V14 liên quan batch; case profile/3D blocked không giả pass.
```

Log 1–5 ở mục 1/2–3/6/7/9. Mã AI, FE tests/runtime data và quyết định nhận code: chưa thực hiện. Case chưa có policy phải giữ gate, không suy đoán expected output.
