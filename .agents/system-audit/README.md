# Báo cáo audit Frontend và luồng FE–API

Cập nhật **19/11/2026**: HEAD `f017663` + working tree FE; tích hợp chọn lọc `TaiFE@48d1ba6`. Báo cáo chỉ mô tả FE và HTTP boundary, không audit nội bộ BE. Không công bố cấu hình môi trường hay credential.

## Cách đọc

| Chương | Nội dung |
|---|---|
| [I. Tổng quan](01-project-overview.md) | Phạm vi, stack, bootstrap |
| [II. Design System](02-design-system.md) | Token, component, accessibility |
| [III. User Flow](03-user-flow.md) | Auth, management, Dataset, issues |
| [IV. Kiến trúc](04-system-architecture.md) | Provider theo route, state, persistence |
| [V. Technical Workflow](05-technical-workflow.md) | Caller → HTTP → mapping → UI |
| [VI. Kiểm thử](06-software-testing.md) | Kết quả và thời điểm thực chạy |
| [VII. Triển khai](07-deployment.md) | Build FE và hosting boundary |
| [VIII. Security/Performance](08-security-performance.md) | Giới hạn token, contract và đo lường |
| [IX. Đánh giá](09-results-evaluation.md) | Findings đã xử lý và rủi ro còn lại |

## Trạng thái hiện hành

- SOURCE: Google login/callback, xóa tài khoản, Dataset detail/records/PII/delete, hoàn thành project, bổ sung issue và profile phone/bio có caller/UI.
- Health root path đã được client xử lý; members được đọc nhiều trang cursor và có chống cursor lặp.
- Processing landing dùng dữ liệu recent theo cursor; project detail có provider theo projectId. Management giữ scope riêng; không mô tả mọi route cùng tải một danh sách.
- Build/typecheck: PASS. Vitest auth/management/foundation: **402 PASS / 26 file**. Sau bổ sung hai ca issue, riêng connected-api: **13 PASS / 1 file**. Hai lượt trùng scope, không cộng.
- Lint phạm vi mới: không có error khi loại file provider test; file `management-data-provider.test.tsx` còn **6 require-await errors**. Có warning migration/indent; không khẳng định full lint sạch.
- E2E API thật trước đợt ghép mới: **6 PASS / 1 FAIL**; lifecycle lặp riêng ba lần đều fail. Cleanup đã chuyển sang fixture nhưng chưa chạy lại; tài nguyên thử còn lại chưa xác nhận dọn xong.
- Không dùng kết quả E2E cũ để nghiệm thu API mới. Google provider thật, PII, hoàn thành project, bổ sung issue và xóa tài khoản thật: **UNVERIFIED**.
- OpenAPI hiện có **66 path / 86 operation**; cả 86 thiếu content trực tiếp cho response 2xx. Generated request aliases có consumer; response vẫn cần mapping/runtime guards.
- Coverage mới, WebGL/a11y/performance thực và hosting production: **UNVERIFIED**.

SOURCE = có implementation; MOCK-TESTED = chạy với transport/port giả; LIVE-TESTED = đã quan sát ca cụ thể với server thật; PARTIAL/FAIL/UNVERIFIED không thay bằng PASS toàn hệ thống.

## Hồ sơ bằng chứng

[Kiểm chứng cập nhật](audit/frontend-api-revalidation.md) · [API inventory](audit/api-inventory.md) · [Swagger ledger](audit/swagger-operation-ledger.md) · [Testing results](audit/testing-results.md) · [Security findings](audit/security-findings.md) · [File traceability](audit/file-traceability.md) · [Final review](audit/final-review.md) · [Diagrams](diagrams/README.md) · [Slides](report.html).

Các artifact `validation/` của snapshot cũ chỉ là lịch sử. Đợt cập nhật này chỉ sửa tài liệu, không sửa source, không chạy mutation lên BE.
