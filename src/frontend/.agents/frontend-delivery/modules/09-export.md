# Module 09 — Export (chờ contract backend)

Trạng thái: **blocked đối với code thực thi**, đã lập plan. Owner/reviewer phải chỉ định trước batch. Nguồn: [audit](00-contract-audit.md), feature_spec_v4 và kiểm kê Swagger/source; snapshot 36 operation chưa có Export API. Không tự gọi URL export từ spec cũ.

## 1. Yêu cầu và phạm vi

Mục tiêu sản phẩm: preview dữ liệu sạch, download phiên bản được chọn hoặc save-as-new vào project đích. Tùy chọn encrypted export trong spec là yêu cầu cần xác nhận contract, không phải năng lực hiện có. Không export dữ liệu page cache như toàn dataset hoặc tự thêm local CSV/encryption vì BE chưa có.

## 2. Đặc tả sáu mục ở mức plan

| Mục | Đã biết / còn thiếu |
|---|---|
| Đầu vào | Mục tiêu có dataset/source version, format, project đích/new name, lựa chọn bảo vệ nếu được duyệt; wire schema chưa có |
| Điều kiện | Quyền đọc/export nguồn và ghi đích; target project còn trống theo nghiệp vụ 1:1; server kiểm tra, FE snapshot không thay quyền |
| Xử lý | Chọn options → preview theo contract → download hoặc confirm save-as-new → server ACK; hiện chưa được gửi request |
| Đầu ra | Download binary/stream + filename/type; save-as-new metadata; preview rows/phạm vi; tất cả cần schema/status thực tế |
| Xếp loại | configuring, previewing, ready, downloading/saving, completed, conflict, failed là nhóm UI đề xuất, không backend enum |
| Thứ tự | Contract trước service; version/options cố định trong request; thay option vô hiệu preview; ACK trước dataset mới; stream completion khác chỉ nhận headers |

Formats csv/xlsx/json, version selector, limit preview, encryption/password transport, tên file, BOM/encoding và empty-data behavior chưa được contract BE xác nhận. Không đặt default hoặc giới hạn mới bằng suy đoán.

## 3. Checklist contract phải có

| Nhóm | Cần BE xác nhận trước code |
|---|---|
| Preview | method/path, input/version semantics, sample count/default/max, row identity, scope, encoding/type |
| Download | content type/disposition, filename Unicode, stream/blob strategy, error envelope khi stream chưa/đã bắt đầu, size/progress/cancel semantics |
| Save-as-new | request/response, quyền nguồn/đích, 1:1 conflict, name validation, idempotency/reconciliation, version mới và lineage timing |
| Encrypted export | Có hỗ trợ thực không; password/key transport, container format, giải mã, fail/cancel; không tự thêm crypto protocol |
| CORS | Header filename/progress nào frontend thực đọc được; không chỉ controller đã set header |
| Version | Snapshot cố định hay current-version động; thay đổi trong lúc xuất; version không tồn tại/rollback |

Nếu spec cũ truyền password trong query, phải review với BE trước dùng vì URL dễ lọt log/history; không tự gửi password bằng URL hoặc phát minh endpoint thay thế. Không thu thập secret để test trong đợt plan.

## 4. UI/files/state/cache dự kiến

- Sau gate, export dialog/region trong dataset view; domain views/components/hooks/services/types export; test `src/__tests__/export/`.
- Service download có response mode riêng, không ép binary qua JSON envelope unwrap. Nếu tương lai stream lỗi cần contract error phân biệt, không tải file JSON lỗi dưới tên CSV.
- Chọn nguồn và đích bằng identity thực, không lọc target eligibility chỉ theo has_dataset cache cũ rồi coi an toàn; server kiểm tra lại khi lưu.
- Download thành công không đồng nghĩa tạo dataset; save-as-new ACK mới invalidate project đích/dataset list và chọn id server trả.
- File Blob/object URL cleanup theo vòng đời nếu strategy dùng Blob được duyệt; không render password/log key hoặc persist export secret trong storage/query cache.
- Cancel request không bảo đảm server đã hủy save-as-new; timeout cần reconciliation trước retry khi có mutation.
- BE outage: module không có offline export đã được duyệt. Giữ options memory nếu view còn mở, không báo download/save thành công và không thêm queue.

## 5. Test case và gate (chưa thực thi)

| Mã | Nhóm | Tình huống | Kết quả hiện tại / khi contract đủ | Lý do |
|---|---|---|---|---|
| E01 | Không hợp lệ | Chưa có API | Không gọi URL suy đoán, không mock success | Contract gate |
| E02 | Thường | Preview theo contract tương lai | Phạm vi/version rõ, không nói là toàn dataset nếu sample | Coverage |
| E03 | Đặc biệt | Đổi version/format sau preview | Preview trước đó không được coi còn hợp lệ | Consistency |
| E04 | Thường | Download binary ACK đầy đủ | Tải đúng type/filename theo contract, cleanup resources | Download |
| E05 | Không hợp lệ | API trả JSON error hoặc stream lỗi giữa chừng | Không báo file hoàn tất; phân loại lỗi đúng | Error mode |
| E06 | Đặc biệt | Người dùng cancel save-as-new confirm | Không gửi mutation | Consent |
| E07 | Đặc biệt | Target đã có dataset hoặc quyền đổi | Server từ chối/conflict theo contract, không dataset giả | 1:1/permission |
| E08 | Đặc biệt | Timeout sau save-as-new có thể commit | Chờ đối soát, không tự nhân đôi | Idempotency |
| E09 | Biên | Empty dataset, Unicode filename, dữ liệu lớn | Expected format/limit phải chốt trước code, hiện blocked | Missing rule |
| E10 | Không hợp lệ | Encrypted export chưa có contract | Không tự thu password hoặc crypto cục bộ | Scope |
| E11 | Đặc biệt | Source chỉ có một cursor page cache | Không local export rồi gọi là full dataset | Data coverage |
| E12 | Đặc biệt | Logout/đổi account trong download/save | Không cập nhật account mới; không lộ resource cũ | Isolation |

Min/max name, format, secret constraints, file encoding, null/type export cần contract trước expected cụ thể. Không ép floating-point rounding vào export khi chưa có quy tắc chuyển đổi. Các case hậu gate chưa chạy, không có HTTP status tự đặt.

## 6. Pseudocode và dò tay

```text
NẾU chưa có contract được xác nhận: blocked; DỪNG
chọn source/version/options theo schema đã duyệt
preview → kiểm tra phạm vi và fingerprint options
download: session gate → gửi request → xử lý binary/error theo contract
save-as-new: confirm → quyền/target gate → gửi đúng một mutation
ACK chính thức → update target cache; timeout → đối soát, không retry mù
cleanup transport/object URL theo strategy đã chốt
```

Dò tay thường ở mức flow: source/options hợp lệ, save-as-new ACK có id mới → refetch project đích, không đổi nguồn. Dò tay biên hiện tại: không có export contract → dừng, không request. Không có fixture binary/data để dò thuật toán format, ghi rõ chưa kiểm chứng.

## 7. Batch/gate/nghiệm thu

1. Chỉ định owner/reviewer và chốt contract download/preview trước.
2. Implement preview + download khi type/header/error/size strategy và permission rõ.
3. Save-as-new sau concurrency/idempotency/target contract; không dùng replay queue Dataset thay cho contract riêng.
4. Encryption chỉ sau một spec bảo mật/transport/container được duyệt; không mặc định thuộc batch download đầu.

Gate chưa đạt thì chỉ clarify, không code. Không sửa BE, cài exporter/crypto lib hoặc thêm functionality ngoài request. Reviewer kiểm tra binary không qua JSON unwrap và UI không báo hoàn tất quá sớm.

## 8. Prompt giai đoạn kế tiếp và log

```text
CONTEXT: React 19.3.1/TypeScript 6.0.3/Vite 8/Yarn; module 09 hiện blocked vì OpenAPI chưa có export endpoints.
TASK: Đối chiếu contract BE mới cho đúng batch export; chỉ sinh code sau khi input/output/gates và batch được duyệt.
INPUT: Checklist mục 3 không phải schema đã có. Không dùng path/query password trong spec cũ làm contract thật.
CONSTRAINTS: Không local-export page cache như toàn dataset; không fake file/success, không offline queue, không tự chọn crypto protocol hoặc lộ secret trong URL/log.
PSEUDOCODE: Mục 6, gate trước mọi request.
EXAMPLES: Contract absent → blocked; JSON error khi download → không tải dưới tên CSV; cancel confirm → không save-as-new.
OUTPUT: Gate thiếu → câu hỏi/phương án chờ xác nhận. Gate đạt + batch duyệt → patch/code trọng tâm, diff, test và runtime evidence tách riêng.
CRITERIA: E01 không được vi phạm; E02–E12 chỉ nghiệm thu sau contract/fixture tương ứng, không giả pass.
```

Log 1–5: yêu cầu mục 1, spec plan mục 2–3, checklist test mục 5, pseudocode mục 6, prompt mục 8. Code/test/export thật/quyết định chấp nhận code: chưa thực hiện. Data-level specification chưa sẵn sàng implementation, không điền giả kết quả AI.
