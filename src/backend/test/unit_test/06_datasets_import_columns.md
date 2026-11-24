# Datasets: Import CSV, tên cột và Reset

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/datasets/application; modules/datasets/domain; modules/datasets/infrastructure/http/dtos.
- Cô lập dependency: dataset/project/workspace/storage/outbox ports; stream trong bộ nhớ, không R2/MongoDB thật.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **DS-001 [P1]** File .csv/.CSV hợp lệ → nhận; .xlsx/.xls/đuôi khác → hiện tại từ chối rõ loại file (khác yêu cầu cũ, GAP-001).
- [ ] **DS-002 [P0]** Đuôi CSV nhưng MIME Excel, magic PK/OLE hoặc byte NUL → từ chối trước khi báo READY; không tin extension đơn lẻ.
- [ ] **DS-003 [P1]** Magic bytes bị chia thành nhiều chunk hoặc file ngắn hơn 8 bytes → kiểm tra vẫn chạy, không bỏ lọt nhị phân do kích thước chunk.
- [ ] **DS-004 [P1]** Kích thước tại 50*1024*1024−1, đúng giới hạn, +1 → đúng biên; thiếu/sai contentLength vẫn chặn khi stream thực vượt giới hạn.
- [ ] **DS-005 [P0]** Quota storage/workspace bị vượt → từ chối; không tạo dataset READY hoặc setHasDataset true.
- [ ] **DS-006 [P0]** Project không tồn tại/đã có dataset → từ chối; không upload và không ghi records.
- [ ] **DS-007 [P1]** CSV chỉ header, CSV rỗng, có BOM, CRLF/LF → kiểm tra riêng; thiếu header phải báo rõ, header-only có 0 record nếu contract cho phép.
- [ ] **DS-008 [P1]** 999/1000/1001 cột → đúng giới hạn; không silently truncate cột.
- [ ] **DS-009 [P1]** CSV có dấu phẩy trong quote, quote escaped, newline trong ô → giữ đúng giá trị và số record; không tính newline trong ô như record mới.
- [ ] **DS-010 [P1]** Số ô lệch header, quote chưa đóng, delimiter khác dấu phẩy → không lệch dữ liệu âm thầm; xác nhận chính sách parser nếu chưa được duyệt.
- [ ] **DS-011 [P0]** Header rỗng/trùng → theo yêu cầu phải nhận file và trả columnIssues; thử parser thực trong bộ nhớ để bắt trường hợp parser từ chối trước schema inference (GAP-002).
- [ ] **DS-012 [P1]** Tên 'Tuổi', 'tuổi', ' Tuổi ' → giữ nguyên, không coi trùng; tên chỉ whitespace → warning riêng.
- [ ] **DS-013 [P1]** Ba cột cùng tên, hai cột rỗng, trùng whitespace → mọi cột liên quan có vị trí/ID rõ; không mất giá trị của cột do dùng tên làm key.
- [ ] **DS-014 [P1]** Column keys c0/c1/... → ổn định theo vị trí; originalName giữ nguyên; rename không sửa props của record.
- [ ] **DS-015 [P1]** 499/500/501 sample rows và 4999/5000/5001 record → sample cap đúng, batch flush đúng, batch cuối không mất/nhân đôi record.
- [ ] **DS-016 [P1]** Stream cùng nội dung nhưng chia chunk khác → checksum và byte count giống nhau; rowIndex liên tục theo contract hiện tại.
- [ ] **DS-017 [P0]** Upload, parse, bulk insert hoặc stream lỗi → cleanup storage/records, không báo thành công; lỗi cleanup không che lỗi gốc.
- [ ] **DS-018 [P0]** Update READY thất bại hoặc trả null → không trả dataset INGESTING như thành công; đánh dấu RISK nếu fallback hiện làm vậy.
- [ ] **DS-019 [P0]** SetHasDataset/quota/outbox lỗi sau ghi records → kiểm tra trạng thái thất bại và compensation; project không được kẹt có dataset trong khi dữ liệu bị cleanup.
- [ ] **DS-020 [P1]** Import thành công → checksum thật, row/column count và byte count đúng; event DATASET_INGESTED đúng ID, không chứa dữ liệu ô.
- [ ] **DS-021 [P1]** Suy luận số/boolean/date/string, toàn thiếu, hỗn hợp ngay dưới/đúng/trên tỷ lệ 0.8 → dtype theo thuật toán hiện tại; không thay đổi raw value.
- [ ] **DS-022 [P1]** 'NA', 'null', 'undefined', 'N/A', undefined, 0, false → đối chiếu inference và DQ; khác định nghĩa missing phải ghi GAP-004, không hợp thức hóa.
- [ ] **DS-023 [P0]** Rename một/nhiều cột bằng key hợp lệ → update chứa tên mới, key/index/originalName và record values không đổi.
- [ ] **DS-024 [P1]** Rename xong query schema/Data Views qua port mock trả state mới → hiển thị tên mới; đây chưa chứng minh lưu thật vào database (INT-002).
- [ ] **DS-025 [P0]** Rename thành tên rỗng/trùng → còn issue và phải chặn analysis; sửa hết → bỏ đúng issue, không xóa cảnh báo không liên quan.
- [ ] **DS-026 [P0]** Một rename batch gồm key hợp lệ rồi key không tồn tại → lỗi và không persist thay đổi một phần; input fixture không bị mutate ngoài ý muốn.
- [ ] **DS-027 [P1]** Rename hai cột hoán đổi tên trong cùng batch → đánh giá danh sách tên cuối cùng; không báo trùng do trạng thái trung gian.
- [ ] **DS-028 [P1]** Gửi cùng key nhiều lần → cần quy định reject hay lần cuối thắng tại OPEN-03 trước khi chốt expected.
- [ ] **DS-029 [P0]** Dataset không tồn tại hoặc biến mất lúc update → NotFound; không trả success giả.
- [ ] **DS-030 [P0]** Reset tên đã sửa → name trở lại originalName; header gốc rỗng/trùng phải tái tạo cảnh báo và chặn analysis (GAP-003: hiện code xóa issues).
- [ ] **DS-031 [P1]** Reset lần hai → cùng kết quả, key/records/file gốc không đổi; phạm vi reset toàn sheet theo yêu cầu nằm GAP-005.
- [ ] **DS-032 [P0]** Quyền rename/reset → Owner workspace/Owner project/Member được phép; Viewer bị chặn trước handler; xem SEC.
- [ ] **DS-033 [P1]** Get dataset/schema/by project: ID sai, không tồn tại, đã xóa → lỗi/null đúng query; không đọc dataset project khác.
- [ ] **DS-034 [P0]** Download original: thiếu storageKey hoặc dataset sai → không gọi storage; hợp lệ → đúng key, không trả file đã sửa tên thay original.
- [ ] **DS-035 [P1]** Update metadata → chỉ trường cho phép, giữ schema/record/original file; không biến thành thay file.
- [ ] **DS-036 [P0]** Delete dataset → soft-delete records đúng dataset, cập nhật project/quota theo contract; việc cho import lại sau delete cần GAP-006.
- [ ] **DS-037 [P1]** Map props cN sang originalName với tên trùng → không âm thầm ghi đè ô; xác định output contract tại OPEN-04.
