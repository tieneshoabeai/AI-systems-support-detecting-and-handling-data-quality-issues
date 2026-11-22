# Kế hoạch audit và báo cáo Frontend

## Đợt cập nhật đã duyệt — 19/11/2026

Người dùng xác nhận cập nhật audit/inventory/testing/slide theo FE local sau ghép TaiFE; không tạo checkpoint vì người dùng đã tự sao lưu. Chỉ sửa tài liệu trong .agents/system-audit, không sửa sản phẩm, không chạy mutation lên BE. Giữ 31 slide và điều hướng hiện có; kiểm tra nội dung, links, layout và mở review sau sửa.

Snapshot hiện hành: HEAD f017663 + working tree. Hồ sơ mới: audit/frontend-api-revalidation.md. Kế hoạch và số liệu 17/11 bên dưới là lịch sử, không thay thế revalidation mới.

Ngày cập nhật: 17/11/2026. Source đối chiếu bổ sung: HEAD `fef6bab` và working tree tại thời điểm kiểm tra. Phạm vi này thay thế phạm vi full-stack ban đầu theo xác nhận của người dùng.

## 1. Mục tiêu và ranh giới

Giải thích bằng tiếng Việt cách frontend được tổ chức, nhận thao tác, kiểm tra dữ liệu, quản lý phiên/state, gọi API và render kết quả. Mọi đường dẫn bằng chứng tính từ repository gốc.

Trong phạm vi:

- Toàn bộ kiến trúc FE, router, providers, components, hooks, services/stores, types, API client, local persistence, graphics và design system.
- Luồng FE → HTTP endpoint của BE → response/error → state → UI, bao gồm JSON, multipart và Blob.
- Swagger snapshot và chuỗi sinh type; phân biệt generated contract với DTO viết tay và kiểm tra dữ liệu lúc chạy.
- Testing, build, security và performance ở phía FE.

Ngoài phạm vi báo cáo:

- Kiến trúc/nội bộ BE; controller → service → repository của BE.
- Database, storage server, worker, AI inference server, infrastructure và triển khai BE.
- Coverage, unit/integration tests và load testing của BE.

BE chỉ là bên cung cấp hợp đồng API. Không dùng tên endpoint làm bằng chứng rằng UI đã gọi endpoint đó. Không coi mock test pass là kết nối server thật đã hoạt động.

## 2. Quy tắc bằng chứng

- Phân biệt: đã nối ở source, đã kiểm thử với transport mock, đã kiểm thử server thật, chỉ có generated type, chỉ có demo, chưa nối.
- Dùng `NOT FOUND` khi không tìm thấy; `UNVERIFIED` khi chưa xác minh được.
- Không đọc/ghi nội dung `.env` vào báo cáo; chỉ mô tả tên cấu hình từ source khi cần.
- Không sửa source, dependency, cấu hình hoặc generated types; không chạy generator trong nhiệm vụ audit này.
- Chỉ dùng patch/edit cho tài liệu do AI viết. Không commit/reset/revert thay đổi của người dùng.
- Các artifact kiểm tra và tài liệu đặt tại `.agents/system-audit/`.
- Kết quả kiểm tra cũ phải ghi rõ thuộc phiên bản cũ; không dùng lại coverage/build cũ như kết quả của source mới.

## 3. Trạng thái các phase

| Phase | Trạng thái | Bước tiếp theo |
|---|---|---|
| Discovery | Đã khảo sát FE và cấu hình; phạm vi đã đổi sang FE | Dùng inventory FE làm nền |
| Deep audit bổ sung | Đã truy vết Swagger types, API management, provider, store, upload và response | Hoàn thiện bảng file/contract trong từng chương |
| Validation bổ sung | Typecheck pass; 315 test pass; lint phạm vi 0 error/24 warning | Không khẳng định toàn bộ suite hoặc live API đã pass |
| Documentation | Đã viết đủ 9 chương FE trong Phase 4 | Hoàn tất |
| Final review | Đã được xác nhận, đã đối chiếu tĩnh và sửa nhận định 204/nguồn projectId | Hoàn tất với giới hạn Mermaid render/live API ghi tại final-review.md |

Kết quả bổ sung chi tiết: [audit/frontend-api-revalidation.md](audit/frontend-api-revalidation.md).

## 4. Cấu trúc 9 chương đã điều chỉnh

| File dự kiến | Nội dung |
|---|---|
| `README.md` | Hướng dẫn đọc, phạm vi, snapshot, trạng thái và giới hạn |
| `01-project-overview.md` | Mục tiêu FE, stack từ manifest/config, entry và cách chạy |
| `02-design-system.md` | Token thực tế, theme, component responsibilities, interaction states, responsive và accessibility |
| `03-user-flow.md` | Auth, management, tạo workspace/project, upload, thông báo, hồ sơ; tách demo và online |
| `04-system-architecture.md` | Folder/layer FE, composition root, providers, dependency direction, store và local persistence |
| `05-technical-workflow.md` | Truy vết từng file từ event tới HTTP và UI; Swagger/type pipeline; API inventory |
| `06-software-testing.md` | Unit/component/integration/E2E FE, mock boundary, test thực chạy, coverage và giới hạn |
| `07-deployment.md` | FE typecheck/build/static artifacts, yêu cầu SPA hosting và API configuration; phân biệt hiện trạng với đề xuất |
| `08-security-performance.md` | FE session/token, error exposure, validation, request/response handling, bundle và request waterfall |
| `09-results-evaluation.md` | Trạng thái kết nối FE, findings có bằng chứng, technical debt, ưu tiên cải thiện |

Các file trên đã được tạo trong Phase 4 và được review tĩnh ở Phase 5. Không dùng tài liệu BE làm chương riêng. README liên kết các chương, inventory, diagram exports và [kết quả final review](audit/final-review.md).

## 5. Workflow phải truy vết

1. Khởi tạo: `src/frontend/src/app/main.tsx` → bootstrap/providers/router → auth → application frame.
2. Auth: form → login hook → session coordinator → auth service → Axios → contract response → session snapshot → router.
3. Load management: `ManagementDataProvider` → session-bound token reader → `createManagementStore.load()` → danh sách/phân trang → DTO mapping → context/store subscription → UI.
4. Mutation: component → preview session hook (tên lịch sử) → store được inject → validation → request → reload → success/error. Không nhầm biến có tên `previewMockStore` trong hook với store mock cố định.
5. Project CSV: wizard giữ `File` thật → tạo project → multipart upload → thêm thành viên → reload; phân tích từng điểm partial failure và retry.
6. Notification/profile/issues: load cá nhân, update, attachment upload/download Blob và lỗi.
7. Shopping demo: adapter/fixture/timer/session storage riêng; không mô tả như AI/backend thật.
8. Generated types: Swagger snapshot → generator → `lib/openapi.ts` → `types/services-type/*` → kiểm tra consumer thực tế.

## 6. Sơ đồ và inventory

- Mermaid: FE stack, component/provider hierarchy, user flow, FE architecture, request-response sequence, data flow, testing pyramid và FE deployment boundary.
- BE chỉ xuất hiện như một participant/box API; không vẽ các tầng nội bộ BE.
- Design system dùng token/bảng showcase có bằng chứng; screenshot chỉ ghi nhận nếu đã chụp từ ứng dụng.
- Testing pyramid biểu thị loại test đã tìm thấy, không tự đặt tỷ lệ. CI/CD hoặc performance dashboard ghi `NOT FOUND`/`UNVERIFIED` nếu thiếu bằng chứng.
- API inventory phải có method, path, caller FE, payload, kiểu response FE mong đợi, contract Swagger, auth, timeout và trạng thái kiểm chứng.

## 7. Tiêu chí review cuối

- Đủ 9 chương, không lẫn nội dung phân tích BE đã loại khỏi scope.
- Các workflow chính truy vết được tới file, input/output, caller/callee và layer FE.
- Không đồng nhất generated types với runtime validation.
- Phân biệt dữ liệu thật, mock, local-only và phần chưa nối.
- Mọi kết quả test/build/coverage có phạm vi và phiên bản; không dùng số liệu cũ như hiện trạng mới.
- Các finding API có bằng chứng từ FE và Swagger snapshot; live behavior còn thiếu phải ghi `UNVERIFIED`.
- Kiểm tra file paths, Mermaid và liên kết giữa các tài liệu; mở review trong Codex.
