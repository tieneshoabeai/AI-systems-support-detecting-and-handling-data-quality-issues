# Kịch bản unit test toàn bộ backend — v1

Ngày lập: **2026-11-16**. Cập nhật: **2026-11-21**.

Trạng thái tài liệu này: **checklist kịch bản kiểm thử** - mô tả *cần kiểm tra cái gì*, chưa phải báo cáo kết quả chạy.

> Phân biệt quan trọng: checklist này **không phải** báo cáo kết quả test. Kết quả thực thi hiện tại nằm ở [`src/backend/README.md`](../../README.md#52-kết-quả-kiểm-thử-hiện-tại): **1 277 / 1 277 test pass** trên 79 suite, độ phủ câu lệnh 71.03%, độ phủ dòng 72.05%. Các ca trong checklist chưa gắn test vẫn là **khoảng trống chưa kiểm chứng**, không nên coi là đã đạt.

## Phạm vi đã thống nhất

Theo yêu cầu người dùng: bao phủ backend hiện tại và có mục riêng cho chênh lệch với yêu cầu đã bàn. Chỉ tạo Markdown trong `src/test/unit_test/`; không sửa backend, không viết `.spec.ts`, không chạy test, không commit. Các test hiện có ở `src/backend/test/` và `modules/analysis/domain/corr-vif-ai.spec.ts` là nguồn tham khảo, chưa được thực thi hoặc xác nhận pass trong tác vụ này.

Nguồn đối chiếu: cấu trúc 13 module hiện tại; danh mục command/query handler, controller, DTO, domain utils/value objects, repository/mapper, shared services; đọc các nhánh kiểm tra và các luồng trọng điểm import/rename/reset, auth/refresh, analysis/summary/AI, CASL, outbox/inbox và tên test hiện có. Không tuyên bố đã chứng minh toàn bộ hành vi runtime chỉ từ đọc mã. Kế hoạch cũ trong hội thoại chỉ dùng cho mục GAP hoặc yêu cầu đã được xác nhận, không tự xem là tính năng đã triển khai.

## Cách sử dụng

- Mỗi checkbox có ID, mức ưu tiên, tình huống và kết quả mong đợi sau dấu `→`. Mọi checkbox ban đầu chưa thực hiện.
- Tách mỗi giá trị biên/role/trạng thái thành test riêng. Ví dụ password 7/8/100/101 là bốn ca, không phải một ca happy path.
- Đối với handler, fake repository/port trả fixture có kiểm soát. Assert cả output/error lẫn thao tác ghi/phát event được phép và thao tác tuyệt đối không được gọi. Không chỉ assert mock được gọi mà bỏ qua payload, scope và dữ liệu trả về.
- Đồng hồ, random ID, timer, provider/model và network dùng fake/mock phù hợp. Hàm thống kê/crypto đang kiểm tra dùng thuật toán thật với đáp án độc lập; không mock chính hàm đang test.
- “Lưu tên mới”: unit test xác minh tên mới được truyền đúng vào port, handler trả tên đúng, originalName/key không đổi. “MongoDB thực sự lưu và đọc lại tên mới” là integration test, được tách tại INT-002.
- Đối với controller forwarding thuần không cần lặp logic handler. Guard/DTO/mapper có logic riêng thì test riêng.
- P0 ưu tiên trước P1; không có yêu cầu đạt 100% line coverage hay coi coverage cao là chứng minh đúng nghiệp vụ.
- Các ca có GAP/OPEN/RISK chưa được xem là hành vi đang đúng. Characterization mô tả code hiện tại không thay thế acceptance theo yêu cầu. Xem hai tài liệu cuối trước khi chốt expected ở điểm còn tranh luận.

## Tài liệu theo nhóm

- [Auth: tài khoản, token, OTP và Google OAuth](01_auth.md) — 31 nhóm kịch bản.
- [Users: hồ sơ và session](02_users.md) — 16 nhóm kịch bản.
- [Phân quyền và cách ly tài nguyên](03_authorization.md) — 19 nhóm kịch bản.
- [Workspaces](04_workspaces.md) — 19 nhóm kịch bản.
- [Projects](05_projects.md) — 22 nhóm kịch bản.
- [Datasets: Import CSV, tên cột và Reset](06_datasets_import_columns.md) — 37 nhóm kịch bản.
- [Data Views: đọc, lọc, sắp xếp và thống kê cột](07_data_view.md) — 21 nhóm kịch bản.
- [Analysis: thuật toán thống kê và chất lượng dữ liệu](08_analysis_statistics.md) — 37 nhóm kịch bản.
- [Analysis: cấu hình, chạy, Tổng kết và PDF](09_analysis_workflows_reports.md) — 31 nhóm kịch bản.
- [AI: prompt, grounding, retry, worker và RAG](10_ai_grounding_rag.md) — 26 nhóm kịch bản.
- [Issues: báo cáo sự cố và tệp đính kèm](11_issues.md) — 17 nhóm kịch bản.
- [Notifications](12_notifications.md) — 11 nhóm kịch bản.
- [Feedback và chỉ số chất lượng AI](13_feedback.md) — 14 nhóm kịch bản.
- [Realtime, Audit và Overview](14_realtime_audit_overview.md) — 16 nhóm kịch bản.
- [Shared: storage, pagination, crypto, events và transaction](15_shared_infrastructure.md) — 29 nhóm kịch bản.
- [Logic HTTP có thể unit test và kiểm tra cấu trúc](16_http_contract_validation.md) — 15 nhóm kịch bản.
- [Các kiểm tra phải làm thêm ngoài unit test](17_integration_followup.md) — 11 nhóm kịch bản.
- [Chênh lệch yêu cầu: không tự quyết định thay người dùng](18_requirement_gaps.md) — 12 nhóm kịch bản.
- [Inventory command/query handler](19_handler_inventory.md) — đối chiếu từng use case để tránh sót (107 handler).
- [Các quyết định còn mở](20_open_decisions.md).

Tổng: **384 nhóm kịch bản**, gồm **361 nhóm unit/regression**, **11 nhóm integration bổ sung**, **12 nhóm chênh lệch yêu cầu**; inventory có **107 handler** (61 command + 46 query). Đây không phải số hàm test đã viết hoặc số test đã pass.

## Dữ liệu nền nên chuẩn bị

- Hai workspace độc lập A/B, mỗi nơi một Owner; Project Owner khác Workspace Owner; Member và Viewer; user ngoài workspace; admin; user blocked/soft-deleted.
- Dataset rỗng/header-only; tên cột đúng/rỗng/trùng/whitespace; originalName khác name; stable keys; record có missing/invalid/outlier/duplicate, rowIndex không liên tục.
- Run pending/running/succeeded/failed, result fresh/stale, AI job hết/chưa hết retry, report job thuộc project khác, hai version project khác nhau.
- Fake repository có thể success/null/throw/conflict ở từng bước; fake clock quanh TTL và thời hạn lease; storage có thể lỗi trước/sau upload.
- Bộ số nhỏ tính đáp án bằng tay, không dùng chính hàm đang test để tạo expected.

## Điều kiện hoàn tất checklist khi người dùng triển khai

Mỗi handler trong inventory được gắn test hoặc lý do không áp dụng; P0 có happy/negative/failure coverage; mock không gọi external thật; không còn ca GAP được đánh dấu pass theo lỗi code; integration được báo riêng; các ca mở ghi BLOCKED/NOT_IMPLEMENTED có lý do. Không tự tuyên bố toàn backend hoàn thành chỉ từ unit tests.

## Lịch sử

- v1 / 2026-11-16: tạo checklist theo backend hiện tại và tách chênh lệch yêu cầu theo xác nhận người dùng; chỉ tài liệu, không implementation/test execution.
- v2 / 2026-11-21: bổ sung phần trạng thái thực thi test hiện tại và làm rõ ranh giới giữa checklist kịch bản với báo cáo kết quả.
