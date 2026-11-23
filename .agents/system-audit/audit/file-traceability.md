# File traceability — các workflow FE trọng tâm

## Chuỗi file mới — 19/11/2026

Các path dưới src/frontend/src/:

| File | Trách nhiệm |
|---|---|
| services/auth/google-sign-in.ts | Điều hướng Google, consume và xóa token fragment |
| app/context/auth-provider.tsx | Restore rồi chuyển callback cho coordinator |
| services/auth/session-coordinator.ts | Google profile validation, delete account, generation guards |
| services/users/users.service.ts | DELETE users/me |
| services/processing/dataset.service.ts | Detail, GET/POST records, PII, delete và runtime guards |
| views/processing/project/sections/live-dataset-panel.tsx | UI PII/delete/detail, invalidation preview |
| views/processing/project/project-workspace.view.tsx | CompleteProjectAction và expectedVersion qua store |
| components/report/center/report-center.tsx | Form needs-info supplement |
| services/processing/recent-projects.service.ts | Recent cursor API |
| services/management/session.mapper.ts | Session snake_case → UI model |
| views/management/members/ | Admin read/detail/issues ở Management |

E2E mới: tests/e2e/auth, api, admin, management, appearance; cleanup fixture tại tests/e2e/support/live-fixture.ts. [Bằng chứng hiện hành](frontend-api-revalidation.md).

> **Snapshot lịch sử 17/11.** Cập nhật 19/11/2026 tại [frontend-api-revalidation.md](frontend-api-revalidation.md): build PASS; 402 test PASS/26 file; connected-api 13 PASS có overlap; E2E thật trước ghép 6 PASS/1 FAIL, cleanup fixture chưa retest. Health prefix đã xử lý; generated request aliases có consumer, members cursor/lifecycle đã bổ sung. Nội dung lịch sử dưới đây không thay thế trạng thái mới.


Caller/callee và layer chi tiết tại chương [IV](../04-system-architecture.md)/[V](../05-technical-workflow.md). Đường dẫn bảng là đường dẫn thực từ repo root; một file có thể tham gia cả request lẫn response.

| STT | Thứ tự/flow | File | Layer/nhiệm vụ | Input | Output / gọi tiếp |
|---|---|---|---|---|---|
| 1 | Bootstrap 1 | `src/frontend/src/app/main.tsx` | Entry | root/path/DEV flag | Skeleton, lazy Application |
| 2 | Bootstrap 2 | `src/frontend/src/app/application-bootstrap.tsx` | Composition | Runtime/config | AppProviders/BrowserRouter |
| 3 | Bootstrap 3 | `src/frontend/src/app/app-runtime.ts` | Composition | client/storage/db ports | Coordinator + drafts + lifecycle |
| 4 | Auth subscription | `src/frontend/src/app/context/auth-provider.tsx` | Provider | Runtime/snapshot | AuthContext, restore/focus/expiry checks |
| 5 | Admission | `src/frontend/src/app/guards/protected-route.tsx` | Router guard | Snapshot/location | Children, loading hoặc login redirect |
| 6 | Login 1 | `src/frontend/src/views/auth/login/login.view.tsx` | View | Input/scene status | Submit tới useLogin |
| 7 | Login 2 | `src/frontend/src/hooks/auth/use-login.ts` | Hook | email/password | signIn, pending/error |
| 8 | Login/refresh/logout | `src/frontend/src/services/auth/session-coordinator.ts` | Application service | Session/ports/actions | Generation-checked snapshot/storage/cache |
| 9 | Auth HTTP | `src/frontend/src/services/auth/auth.service.ts` | Service/mapper | Login/refresh DTO | Request, runtime-checked LoginResult/RefreshResult |
| 10 | Profile auth | `src/frontend/src/services/users/users.service.ts` | Service/mapper | Bound ApiClient | GET me → checked CurrentUser |
| 11 | Health | `src/frontend/src/services/health/health.service.ts` | Service/mapper | Public client | GET health → available flag |
| 12 | Shared transport | `src/frontend/src/lib/axios-client.ts` | Infrastructure | ApiRequestOptions | HTTP → undefined cho 204, Blob/data hoặc ApiError |
| 13 | Shared error | `src/frontend/src/lib/api-error.ts` | Infrastructure | unknown transport error | Sanitized typed error |
| 14 | Auth persistence | `src/frontend/src/lib/session-storage.ts` | Browser storage | StoredSession | Valid/expired/invalid read; write/clear |
| 15 | Frame 1 | `src/frontend/src/views/application/application-frame.tsx` | Layout | Router context | DataProvider/session surfaces/Outlet |
| 16 | Frame 2 | `src/frontend/src/views/application/management-data-provider.tsx` | Provider | Auth snapshot/session reader | Create/load API store → context/error |
| 17 | Management request/response | `src/frontend/src/services/management/management.store.ts` | Application store | Account/ApiClient/input | API calls + DTO mapping + publish |
| 18 | Subscription | `src/frontend/src/hooks/preview/use-preview-store.ts` | Hook | Injected context store | React snapshot |
| 19 | Interaction | `src/frontend/src/hooks/preview/use-preview-session.ts` | Hook | UI action/input | Store mutation → toast/dialog/boolean |
| 20 | Project create 1 | `src/frontend/src/components/project/create/project-wizard.tsx` | Feature | Form/File/members | Pending → session.createProject |
| 21 | CSV bridge | `src/frontend/src/hooks/project/use-project-csv-parser.ts` | Hook boundary | Caller | Parser function |
| 22 | CSV parse | `src/frontend/src/services/management/csv-preview.ts` | Utility service | UTF-8 text | delimiter/headers/rows hoặc error |
| 23 | CSV preflight | `src/frontend/src/services/management/upload-validation.ts` | Validation | File | Return void hoặc throw trước request |
| 24 | Project upload UI | `src/frontend/src/views/processing/project/sections/project-data-actions.tsx` | Feature | onClose, File từ input, projectId từ session selection; result callbacks cho các component kết quả | Store upload, busy/error/close |
| 25 | Issues UI | `src/frontend/src/components/report/center/report-center.tsx` | Feature | Form/attachment/store | createReport/download workflow |
| 26 | Notification UI | `src/frontend/src/components/notification/center/notification-center.tsx` | Feature | Store records | Read/open actions và display |
| 27 | Local draft | `src/frontend/src/repositories/datasets/upload-draft.repository.ts` | Repository | File/access/generation | Transactional draft/Blob operations |
| 28 | IndexedDB schema | `src/frontend/src/repositories/datasets/upload-draft.database.ts` | Persistence | DB name | Dexie tables/indexes |
| 29 | Demo separation | `src/frontend/src/mocks/shopping-trends/demo-mode.ts` | DEV selector | DEV/query/sessionStorage | Demo enabled |
| 30 | Demo detection | `src/frontend/src/hooks/preview/use-shopping-detection.ts` | Hook | Enabled/review | Timer/local state; không HTTP analysis |
| 31 | Swagger pipeline | `src/frontend/scripts/generate-swagger-types.mjs` | Dev tooling | Spec/config | JSON/generated TS/aliases; không chạy audit |
| 32 | Contract source | `src/frontend/src/lib/openapi.json` | Snapshot | Captured spec | 65 paths/86 operations inventory |
| 33 | Generated contract | `src/frontend/src/lib/openapi.ts` | Types | Generator output | paths/operations; @ts-nocheck |
| 34 | Alias barrel | `src/frontend/src/types/services-type/index.ts` | Types | Group alias files | Exports; chưa thấy consumer nghiệp vụ |

Truy vết một event cụ thể: mở hàng 20 → 19 → 17 → 23 → 12; response đi 12 → 17 → 18/19 → 20. Không đọc thẳng generated endpoint rồi giả định đã có component gọi nó.
