# Unit Test Checklist — 20 File Markdown (Không Phải Test Chạy)

Thư mục `src/backend/test/unit_test/` chứa **21 file .md** (1 README + 20 checklist). Đây là **checklist kịch bản cần kiểm tra**, không phải test Jest, không chạy bằng `pnpm test`.

> Phân biệt: `test/unit/` = test chạy được; `test/unit_test/` = mô tả cần kiểm tra cái gì. Cả checklist chưa gắn test vẫn là **khoảng trống chưa kiểm chứng**.

---

## 1. 20 File Checklist (số dòng + checkbox đếm thật bằng `grep -c`)

| File | Dòng | Nhóm kịch bản (checkbox) |
|---|---|---|
| `01_auth.md` (42 dòng) | Tài khoản, token, OTP, Google OAuth | 31 nhóm |
| `02_users.md` (27) | Hồ sơ, session | 16 nhóm |
| `03_authorization.md` (30) | Phân quyền, cách ly tài nguyên | 19 nhóm |
| `04_workspaces.md` (30) | Workspace | 19 nhóm |
| `05_projects.md` (33) | Project | 22 nhóm |
| `06_datasets_import_columns.md` (48) | Import CSV, tên cột, reset | 37 nhóm |
| `07_data_view.md` (32) | Đọc, lọc, sắp xếp, thống kê cột | 21 nhóm |
| `08_analysis_statistics.md` (48) | Thuật toán thống kê, DQ | 37 nhóm |
| `09_analysis_workflows_reports.md` (42) | Cấu hình, chạy, tổng kết, PDF | 31 nhóm |
| `10_ai_grounding_rag.md` (37) | Prompt, grounding, retry, worker, RAG | 26 nhóm |
| `11_issues.md` (28) | Báo cáo sự cố, đính kèm | 17 nhóm |
| `12_notifications.md` (22) | Hộp thư | 11 nhóm |
| `13_feedback.md` (25) | Feedback, chỉ số AI | 14 nhóm |
| `14_realtime_audit_overview.md` (27) | Realtime, audit, overview | 16 nhóm |
| `15_shared_infrastructure.md` (40) | Storage, pagination, crypto, event, transaction | 29 nhóm |
| `16_http_contract_validation.md` (26) | Logic HTTP unit-test được, kiểm tra cấu trúc | 15 nhóm |
| `17_integration_followup.md` (22) | Việc phải làm thêm ngoài unit | 11 nhóm |
| `18_requirement_gaps.md` (23) | Chênh lệch yêu cầu, không tự quyết (GAP-001→GAP-012, GAP-003 đã xử lý 2026-11-19) | 12 nhóm |
| `19_handler_inventory.md` (210 dòng, 107 checkbox) | Liệt kê 107 handler theo mẫu CQRS (61 command + 46 query). **Lưu ý khi đối chiếu code 2026-11-24: `src/` thật chỉ có 87 file `*.handler.ts` (52 command + 35 query)** — 20 handler trong inventory thuộc 5 module chạy bằng Service gộp (Template Simple, ADR-0002) nên không có file handler riêng: `audit` (log), `data-view` (4 query), `feedback` (5 command + 2 query), `notifications` (3 command + 3 query), `overview` (2 query). Đọc file service thật (`audit.service.ts`, `data-view.service.ts`, `feedback.service.ts`, `notifications.service.ts`, `overview.service.ts`) thay vì tìm handler. | Inventory (cần cập nhật) |
| `20_open_decisions.md` (22) | Quyết định còn mở | — |

Tổng 01–18: **384 checkbox** (đếm thật bằng `grep -c '^- \[ \]'`: 01=31, 02=16, 03=19, 04=19, 05=22, 06=37, 07=21, 08=37, 09=31, 10=26, 11=17, 12=11, 13=14, 14=16, 15=29, 16=15, 17=11, 18=12) + file 19 có 107 checkbox. Đây là số kịch bản cần kiểm, không phải số hàm test đã pass.

---

## 2. Cách dùng

- Mỗi checkbox có ID, mức ưu tiên (P0 trước P1), tình huống và kết quả mong đợi sau dấu `→`.
- Tách mỗi giá trị biến/role/trạng thái thành test riêng (password 7/8/100/101 là 4 ca).
- Handler: fake repository/port có kiểm soát (success/null/throw/conflict). Assert cả output/error **và** tác vụ ghi/phát event được phép **và** tác vụ tuyệt đối không được gọi.
- Đồng hồ, random ID, timer, provider/model, network: fake/mock. Hàm thống kê/crypto: thuật toán thật + đáp án độc lập, không mock chính hàm đang test.
- Controller forwarding thuần: không lặp logic handler. Guard/DTO/mapper có logic riêng: test riêng.
- Ca GAP/OPEN/RISK: chưa coi là hành vi đúng. Characterization mô tả code hiện tại, không thay acceptance.

## 3. Điều kiện hoàn tất

Mỗi handler trong `19_handler_inventory.md` được gán test hoặc lý do không áp dụng; P0 có happy/negative/failure; mock không gọi external thật; không ca GAP nào bị đánh dấu pass theo lỗi code; integration báo riêng; ca mở ghi BLOCKED/NOT_IMPLEMENTED có lý do.
