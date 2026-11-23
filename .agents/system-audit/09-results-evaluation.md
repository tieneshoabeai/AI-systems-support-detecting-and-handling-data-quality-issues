# Chương IX. Kết quả và đánh giá

Cập nhật 19/11/2026: HEAD `f017663` + working tree, ghép chọn lọc TaiFE@48d1ba6.

## 1. Mức hoàn thành

| Khả năng | Bằng chứng | Chưa được kết luận |
|---|---|---|
| Password auth/restore/logout | Source/mock + E2E thật trước ghép | Không nghiệm thu Google hay token reuse |
| Google login/delete account | Source + unit tests | Provider thật / xóa tài khoản thật UNVERIFIED |
| Workspace/project CRUD, CSV | Source/mock + manual thật trước ghép | Lifecycle E2E tự động đang FAIL |
| Dataset detail/GET records/PII/delete | Source, tests contract/guards | Live UI mới và numeric filter chưa retest |
| Complete project / supplement issue / phone-bio | Source, tests có phạm vi | Live chức năng mới UNVERIFIED |
| Admin | API service + Management members UI; E2E read PASS trước ghép | Analyst matrix và live status mutation chưa chứng minh |
| Provider/recent/members | Scope theo route, cancellation, cursor + guards | Không biến external store thành TanStack Query cache |
| Generated types | Request aliases có consumer | 86 operations thiếu success content; response end-to-end chưa đủ |
| Draft auto-sync | NOT FOUND | Không tự gửi IndexedDB draft |
| Hosting/coverage/a11y/WebGL/performance | UNVERIFIED | Build không chứng minh production readiness |

## 2. Kiểm thử

Build/typecheck PASS; auth/management/foundation **402 PASS / 26 file**; connected-api sau bổ sung issue **13 PASS**, scope trùng, không cộng. ESLint phạm vi loại provider test không error; provider test còn **6 require-await errors**, vẫn có warnings.

E2E thật trước ghép **6 PASS / 1 FAIL**; lifecycle lặp riêng **3 FAIL**. Cleanup fixture sửa nhưng chưa retest, dữ liệu thử còn lại chưa xác nhận dọn xong. Xem [chương VI](06-software-testing.md).

## 3. Findings hiện hành

| Finding | Trạng thái / nguyên nhân | Bằng chứng |
|---|---|---|
| Health root bị ghép prefix | ĐÃ XỬ LÝ: public GET /health resolve root | lib/axios-client.ts |
| Empty HTTP 204 | Không phải bug: trả undefined trước unwrap | axios-client + foundation tests |
| Members thiếu cursor | ĐÃ BỔ SUNG loadMembers, chống cursor thiếu/lặp | management.store.ts |
| Stale session/provider request | Có lifecycle cancellation, disposed/revision guards | provider + management store |
| Swagger response schema | CÒN: 86 operations thiếu 2xx content trực tiếp | lib/openapi.json |
| Partial writes | CÒN: Map tiến độ mất qua reload; không bảo đảm idempotency | management.store.ts |
| Runtime validation | Đã tăng guards, chưa phủ mọi DTO | dataset/admin/session/workspace/project |
| E2E lifecycle/cleanup | CÒN FAIL/UNVERIFIED sau sửa fixture | tests/e2e/management + support/live-fixture.ts |
| Token JS-readable | CÒN giới hạn sessionStorage; không có bằng chứng XSS | lib/session-storage.ts |
| Store contract dựa mock | CÒN: ManagementStore kết hợp previewMockStore | management.types.ts |

## 4. Thứ tự đề xuất

Dọn dữ liệu thử được phép và khôi phục lifecycle E2E; kiểm chứng các API mới; hoàn thiện response contract/runtime guards; sửa lint test; sau đó mới tách service/mapper theo domain nếu đem lại giá trị. Không cần đổi toàn bộ cấu trúc.

Google và analysis không còn được đánh dấu NOT FOUND: có caller Google và read/run analysis; async polling/report download pipeline vẫn chưa đủ bằng chứng. /processing/new local còn form disabled, không nghiệm thu wizard ở route này.

## 5. Giới hạn bàn giao

Báo cáo FE–API không phân tích nội bộ BE. Không chạy lại coverage/full suite hay mutation khi cập nhật tài liệu. Các kết quả trước ghép và sau ghép được tách thời điểm; không thay lịch sử bằng số liệu mới. Review slide/links không phải kiểm thử sản phẩm.
