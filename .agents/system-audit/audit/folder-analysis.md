# Folder analysis — FE

> **Snapshot lịch sử 17/11.** Cập nhật 19/11/2026 tại [frontend-api-revalidation.md](frontend-api-revalidation.md): build PASS; 402 test PASS/26 file; connected-api 13 PASS có overlap; E2E thật trước ghép 6 PASS/1 FAIL, cleanup fixture chưa retest. Health prefix đã xử lý; generated request aliases có consumer, members cursor/lifecycle đã bổ sung. Nội dung lịch sử dưới đây không thay thế trạng thái mới.


Cây chọn lọc tại [chương IV](../04-system-architecture.md). Tất cả đường dẫn dưới đây từ repository gốc.

| Folder | Trách nhiệm và file tiêu biểu | Chú ý khi đọc |
|---|---|---|
| `src/frontend/src/app/` | Entry/runtime/router/guards/pages; `application-bootstrap.tsx` | Pages chủ yếu ghép/re-export view, không đồng nhất với full feature implementation |
| `src/frontend/src/views/application/` | ApplicationFrame, ManagementDataProvider | Nơi online store được tạo/inject |
| `src/frontend/src/views/management/` | Home/workspaces/projects/notifications/settings | UI nguồn mới; nhiều alias từ preview trỏ về đây |
| `src/frontend/src/views/processing/` | Landing/project/records | Online upload khác shopping demo detection |
| `src/frontend/src/views/preview/` | Shared presentation/session/adapters và aliases | Tên preview không chứng minh runtime luôn mock |
| `src/frontend/src/components/ui/` | Primitive/form/layout/feedback/overlay | Có migration warning, chưa mọi view dùng chung hết |
| `src/frontend/src/components/project/` | Wizard/list/overview/members | Business interaction qua hooks/session |
| `src/frontend/src/components/graphics/` | React/R3F bridge và canvas lifecycle | Khác graphics model layer |
| `src/frontend/src/hooks/` | Auth/session/UI/navigation/presentation hooks | use-preview-store lấy context, không cố định API/mock |
| `src/frontend/src/services/management/` | API store, DTO mapping, CSV parsing/validation | Chưa dùng generated aliases; Maps chỉ trong memory |
| `src/frontend/src/services/auth/` | Auth HTTP service + coordinator | Generation/expiry/cleanup/consent |
| `src/frontend/src/services/preview/` | Fixture store, route helpers | Default context/test/demo source |
| `src/frontend/src/repositories/datasets/` | Draft metadata/Blob transactions | Không tự upload hoặc sync HTTP |
| `src/frontend/src/lib/` | Axios/error/session/query + OpenAPI artifacts | openapi.ts generated @ts-nocheck |
| `src/frontend/src/types/services-type/` | 15 nhóm aliases + index | Có request/status types nhưng thiếu success payload schema |
| `src/frontend/src/types/` | UI/domain/ports contracts | Root barrel chưa export generated aliases tại lúc kiểm tra |
| `src/frontend/src/styles/` | Base tokens/global | Preview theme token vẫn nằm ở views |
| `src/frontend/src/configs/` | API parser, draft limits | Không công bố giá trị env |
| `src/frontend/src/graphics/`, `src/frontend/src/math/` | Procedural model/geometry/layout/data helpers | Không suy graphics demo thành AI result |
| `src/frontend/src/mocks/` | Shopping fixture/adapter | DEV demo; không là API thật |
| `src/frontend/src/sync/` | README/placeholder | Chưa có runtime coordinator |
| `src/frontend/src/__tests__/` | Vitest groups | Integration phần lớn thay transport/ports |
| `src/frontend/tests/e2e/` | Playwright specs/support | Shopping DEV demo, không live API E2E |
| `src/frontend/scripts/` | Generator có sẵn | Không chạy hoặc sửa trong audit |

Không tạo thêm folder sản phẩm `features`, `stores`, `contexts` theo mẫu giả định. Tài liệu audit mới chỉ đặt ở `.agents/system-audit/`.
