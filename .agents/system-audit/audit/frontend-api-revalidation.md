# Kiểm chứng FE–API — cập nhật 19/11/2026

Source: HEAD `f017663` + working tree; ghép chọn lọc `TaiFE@48d1ba6`. Đường dẫn tính từ repository gốc. Kết quả thực chạy được ghi theo từng lượt; đợt tài liệu này không chạy lại API hay sửa sản phẩm.

## 1. Chức năng và chuỗi file hiện hành

| Nhóm | File dưới src/frontend/src/ | Hành vi / giới hạn |
|---|---|---|
| Google | services/auth/google-sign-in.ts → app/context/auth-provider.tsx → services/auth/session-coordinator.ts | Redirect qua BE; nhận token fragment, xóa fragment, kiểm tra attempt còn hạn và GET users/me trước commit. SOURCE + unit tests; Google thật UNVERIFIED |
| Xóa tài khoản | views/management/settings/settings.view.tsx → auth coordinator → services/users/users.service.ts | Nhập email xác nhận → DELETE users/me → cleanup phiên khi thành công. Test rejection/race; chưa xóa tài khoản thật |
| Dataset | views/processing/project/sections/live-dataset-panel.tsx → services/processing/dataset.service.ts | Detail/schema, GET records thường; POST records/query khi có điều kiện; CSV Blob, stats, PII, delete. Không còn đổi/reset tên cột |
| Project | project-workspace.view.tsx → services/management/management.store.ts | PUT snapshot với expectedVersion; refreshProject giữ các project khác. Không coi snapshot là lưu toàn bộ trạng thái tùy ý |
| Issues | components/report/center/report-center.tsx → management.store.ts | needs-info + version → form bổ sung → PATCH issues/:id → đọc lại detail; lỗi conflict không retry |
| Profile | settings.view.tsx → management.store.ts | PATCH first_name/last_name/phone/bio; trống phone/bio gửi null; organization chưa nối |
| Recent | components/project/list/recent-projects.tsx → services/processing/recent-projects.service.ts | Cursor theo trang; đọc workspace name riêng và dùng lại lookup |
| Admin | views/management/members/ → services/management/admin.service.ts | Danh sách/chi tiết user, issues và đổi status; không phải workspace management |

## 2. Provider, cancellation và cache

`views/application/application-frame.tsx` chọn ManagementDataProvider hoặc ProcessingDataProvider theo route. Processing landing recent không tải toàn bộ management trước khi render; detail tải theo projectId. `management-data-provider.tsx` kiểm tra session/account, hủy khi scope/phiên thay đổi. Store ghép signal lifecycle với request, kiểm tra disposed/revision trước publish. Lỗi online không tự fallback fixture.

`management.store.ts` có loadMembers lặp cursor, từ chối cursor thiếu/lặp và kiểm tra rows; concurrency tải workspace giới hạn 3. Đây là implementation + mock tests, không chứng minh mọi phân quyền nhiều trang ở server thật.

TanStack Query có provider/hạ tầng; management data hiện do external store quản lý, không tự gán staleTime/invalidation của Query cho các mutation này. Partial create/upload progress vẫn ở Map trong instance, không bền qua reload.

## 3. HTTP/contract đã thay đổi

- `lib/axios-client.ts`: public GET /health được resolve ở origin root; finding ghép prefix đã xử lý. Empty 204 trả undefined; Blob không unwrap JSON.
- `lib/api-error.ts`: giữ phân loại network/timeout/cancelled/http/invalid-response, error fields và retry metadata theo source. Không coi metadata retry là cơ chế retry tự động.
- `types/services-type/*`: có static consumer trong services; request types được dùng với satisfies. Dataset PII request alias được bổ sung theo contract nhánh TaiFE.
- `lib/openapi.json`: 66 paths, 86 operations, 86 operations không có response 2xx content trực tiếp. Không tự suy ra response schema từ TypeScript generic.
- Một số response vẫn dùng DTO viết tay; guards có ở dataset, workspace/project, members, session, admin, nhưng chưa phải schema validation toàn bộ hệ thống.
- Không lấy debug log [qa-network]; không thêm Axios instance/abstraction mới trong đợt ghép.

## 4. Bằng chứng kiểm thử

| Lượt | Kết quả | Phạm vi |
|---|---|---|
| yarn build | PASS, gồm tsc -b và Vite build | Sau sửa OpenAPI PII; warning chunk >500 kB, không phải đo tốc độ trình duyệt |
| Vitest auth/management/foundation | 402 PASS / 26 file | Sau ghép API; transport/ports giả; không coverage |
| Vitest connected-api sau bổ sung issue | 13 PASS / 1 file | Trùng scope lượt trên, không cộng; thêm conflict/no retry và supplement reload |
| ESLint phạm vi mới, loại provider test | 0 error với --quiet | Không kết luận không có warnings |
| ESLint có provider test | 6 require-await errors | management-data-provider.test.tsx; còn warnings migration/indent |
| git diff --check -- src/frontend | PASS | Chỉ whitespace, không live behavior |

## 5. E2E trước đợt ghép mới

Bộ bảy spec dùng API thật, không route.fulfill/mock login: prerequisites; anonymous guard; login/restore; logout/revoked detail; admin read; appearance; workspace/project lifecycle.

Full run: **6 PASS / 1 FAIL**. Lifecycle timeout; lặp riêng ba lần đều fail ở các vị trí khác nhau. Cleanup trong body từng che lỗi gốc, nên đã chuyển sang `tests/e2e/support/live-fixture.ts` với teardown budget riêng; **chưa chạy lại sau sửa**. Lệnh recovery cleanup bị từ chối, không thực hiện qua cách khác; chưa xác nhận tài nguyên thử/phiên còn lại được dọn xong.

Manual auth/CRUD trước đợt ghép đã có quan sát server thật, nhưng không dùng để nghiệm thu chức năng mới. Không thử refresh-token reuse theo giới hạn người dùng. Logout proof là session detail is_revoked, không khẳng định JWT cũ lập tức 401. Chưa có analyst để so sánh quyền; lỗi Dataset numeric filter do BE xử lý, chưa retest.

## 6. Phần còn lại

Google thật; xóa tài khoản thật; PII/detail/delete UI; complete project; supplement issues; profile phone/bio live: UNVERIFIED. Full suite/coverage mới, a11y/WebGL/production hosting: UNVERIFIED. Processing /processing/new vẫn có form disabled trong local; không ghi nhận wizard từ TaiFE đã được tích hợp vào route này.

Kết quả 315/55 test ngày 17/11 và 864/70,83% cũ chỉ là lịch sử. Xem [testing-results.md](testing-results.md), [API inventory](api-inventory.md).
