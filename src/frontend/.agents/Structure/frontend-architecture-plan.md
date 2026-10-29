# AI-systems-support-detecting-and-handling-data-quality-issues — Frontend Architecture Plan

Tên dự án: **AI-systems-support-detecting-and-handling-data-quality-issues**; tên mô tả tiếng Việt: **Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề về chất lượng dữ liệu**. Đối chiếu README gốc và docs/report_overview_v5.md: Core Platform trước, AI hỗ trợ phát hiện/giải thích/gợi ý xử lý sau; không coi AI hỗ trợ phát triển bằng công cụ là bằng chứng phân hệ AI sản phẩm đã có.

Ngày đối chiếu source: 26/10/2026. Trạng thái: kiến trúc đã thống nhất; đã setup folder/dependency cho nhóm 2 người, chưa triển khai nghiệp vụ runtime. Roadmap nhóm: [master plan](../frontend-delivery/master-plan.md), [team workflow](../frontend-delivery/team-workflow.md).

## 1. Mục tiêu, phạm vi và cách đọc

Tài liệu dành cho thành viên fresher/intern: hiểu trách nhiệm từng tầng, đi theo một hành động từ UI tới API/lưu trữ và biết phần nào cần đặc tả tiếp. Phạm vi là frontend React tại `src/frontend` trong repository dự án.

Scope mới đã duyệt: hoàn thiện plan cho 2 người, setup folder .gitkeep và cài dependency qua Yarn; chưa viết chức năng, chạy migration hay thay đổi backend. Tài liệu `project-architecture.md` cùng thư mục đang mô tả SGOD; giữ nguyên nhưng không dùng nó làm bằng chứng về frontend này. Không mang chat, Firebase, Socket.IO hoặc endpoint SGOD sang dự án.

Quy ước bằng chứng:

- **Hiện có — static:** đã đọc source; không đồng nghĩa đã chạy API/browser/test.
- **Đề xuất:** cấu trúc hoặc hành vi cần triển khai trong đợt được duyệt sau.
- **Chờ backend:** thiếu contract hoặc khả năng cần thiết; không dựng endpoint giả.
- **Chờ đặc tả:** chưa được phép tự chọn business logic để triển khai.

Nguồn chính: `project-architecture-template.md` và `feature_spec_v4.md` do người dùng cung cấp; controller, DTO, service backend trong checkout. Khi khác nhau, backend hiện tại là chuẩn tích hợp. Spec dùng để kiểm kê đủ 9 module, không dùng để tuyên bố backend đã hỗ trợ.

## 2. Hiện trạng và công nghệ đề xuất

**Hiện trạng sau setup app folder:** file mẫu ở root src đã được người dùng xóa. Theo cấu trúc mới đã duyệt, index.html trỏ `/src/app/main.tsx`, mount `src/app/App.tsx` trong StrictMode và import `src/app/style.css`. App và layout chỉ có một arrow function render tên component; layout chưa được ghép vào runtime. constants/context/pages/private/pages/public/router hiện là folder .gitkeep. Chưa có auth, router hoặc UI nghiệp vụ; không nhầm bootstrap này với foundation đã hoàn thành. Đoạn scaffold bên dưới chỉ là lịch sử setup ban đầu.

Frontend runtime hiện vẫn là `src/main.tsx` → `StrictMode` → `App.tsx`, CSS và asset của scaffold. Đã khai báo/cài bộ nền tảng, 3D, IndexedDB và test trong manifest/yarn.lock; chưa tích hợp vào app. Người dùng đã chọn **Yarn làm công cụ chính** cho cài đặt/build/lint. Giữ cả `package-lock.json` và `yarn.lock`, không xóa lockfile; không chạy npm install xen kẽ hoặc tự cập nhật package-lock. yarn.lock là lockfile dùng để resolve; package-lock có thể không còn đồng bộ và không được dùng để suy ra kết quả cài đặt của Yarn.

| Công cụ đã duyệt cho kiến trúc | Trách nhiệm | Giới hạn |
|---|---|---|
| React Router | Route, layout, URL params, guard | Guard không thay thế phân quyền backend |
| Axios | HTTP, multipart upload, bearer token, chuẩn hóa lỗi | Không tự retry thao tác ghi ngoài sync coordinator |
| TanStack Query | Server cache, loading/error, invalidation | Không thay IndexedDB hoặc làm hàng đợi ghi bền vững |
| Three.js + React Three Fiber | Render, camera, component scene, frame loop | Không tự chọn thuật toán dữ liệu |
| Dexie / IndexedDB | File, snapshot, draft, thao tác chờ | Không tự cung cấp idempotency hoặc conflict resolution phía server |

Version dependency đã pin trong package.json sau khi đối chiếu engine/peer với môi trường hiện có; Yarn ghi transitive resolution trong yarn.lock. Chưa thêm Redux/Zustand, bộ UI hoặc thư viện animation riêng. CSS hiện có là điểm xuất phát, chưa chốt visual design.

## 3. Bootstrap, routing và layout đề xuất

Entry hiện tại là `src/app/main.tsx` → StrictMode → App. Đợt foundation tương lai compose provider/router từ App; không tạo lại entry ở root src. Sơ đồ sau là phần kiến trúc đầy đủ còn cần triển khai:

```text
main.tsx
  → StrictMode
  → Router + QueryClient provider
  → Auth/session provider
  → App routes
      → Public layout: login/register
      → Protected layout: navigation + trạng thái BE/sync + nội dung
      → Session dialog và sync lifecycle (một instance)
```

Route dưới đây là URL frontend đề xuất, không phải endpoint backend:

| URL | Nội dung | Điều kiện |
|---|---|---|
| `/auth/login`, `/auth/register` | Đăng nhập/đăng ký | Public |
| `/workspaces` | Danh sách workspace và lối vào không gian 3D | Phiên hợp lệ |
| `/workspaces/:workspaceId` | Chi tiết workspace, danh sách project | Phiên hợp lệ |
| `/projects/:projectId` | Chi tiết project, dataset hoặc upload | Phiên hợp lệ |
| `/datasets/:datasetId` | Bảng, profile, thông tin dataset | Phiên hợp lệ |
| `/datasets/:datasetId/lineage` | Nguồn gốc và kiểm tra toàn vẹn qua server | Phiên hợp lệ |
| `/account`, `/account/sessions` | Hồ sơ và phiên đăng nhập | Phiên hợp lệ |
| `/sync` | File/draft/thao tác chờ của tài khoản hiện tại | Phiên hợp lệ |

Root chuyển tới `/workspaces` khi có phiên hợp lệ, ngược lại tới login. Có trang not-found; public-only guard không mở login/register khi đang có phiên hợp lệ. Với resource không có quyền hoặc không tồn tại, UI hiện lỗi phù hợp, không tự thay bằng dữ liệu tài khoản khác. Route cho transformation/export/admin chỉ bổ sung sau khi có contract, không tạo màn hình giả hoạt động.

Layout dùng DOM cho điều hướng, form, bảng, dialog và trạng thái sync; scene là khu vực riêng. Hỏng 3D không làm mất khả năng thao tác bằng UI thông thường. Refresh trang/khôi phục phiên không mở snapshot riêng tư chỉ vì tìm thấy dữ liệu trong IndexedDB.

## 4. Cấu trúc thư mục và ranh giới

```text
src/
  app/             # providers, routes, guards, layouts
  views/           # màn hình theo nghiệp vụ
  components/      # UI tái sử dụng
  hooks/           # UI state và điều phối flow
  services/        # API theo nghiệp vụ
  repositories/    # transaction/truy vấn IndexedDB
  sync/            # coordinator, retry, reconciliation, conflict
  graphics/        # scene, camera, picking, resource lifecycle
  math/            # số phức, vector, Quaternion, motion
  lib/             # cấu hình Axios, QueryClient, Dexie
  types/           # API DTO, UI model, draft/sync model
  configs/         # cấu hình công khai
  utils/           # helper thuần
```

Chia theo domain trong các tầng liên quan: auth, users, workspaces, projects, datasets, visualization, transformations, versions-lineage, export. Ngoại lệ đã duyệt cho setup nhóm: tạo 14 folder tầng/test với .gitkeep để bàn giao structure; không tạo toàn bộ folder domain rỗng. Component/file mới dùng kebab-case có suffix theo rules project; tên component PascalCase, biến/hàm camelCase. Tên file hiện có không bị tự đổi.

| Tầng | Được làm | Không được làm |
|---|---|---|
| View/component | Render, nhận input, gọi callback/hook | Gọi Axios hoặc Dexie trực tiếp |
| Hook | Điều phối UI state, service/repository/sync | Tự lặp retry ghi song song coordinator |
| Service | Endpoint, payload, DTO/mapper, trả kết quả | Giữ dialog/loading UI hoặc scene state |
| Repository | Lưu trữ, transaction, phân vùng tài khoản | Giả lập server xác nhận |
| Sync | Điều kiện replay, thứ tự, retry, đối soát | Phụ thuộc component hoặc tự quyết ghi đè conflict |
| Graphics | Render/picking, nhận model và phát selection | Gọi API hoặc quyết định nghiệp vụ |
| Math | Tính toán độc lập, kiểm thử số học | Phụ thuộc React/HTTP/IndexedDB |

Luồng đọc code: route → view → component → hook → service/repository/sync → type/mapper → helper. Chỉ tách controller hook khi flow đủ phức tạp; tránh tạo wrapper không có trách nhiệm riêng.

## 5. API client, types và state

Nguồn static: `src/backend/src/main.ts`, `shared/interceptors/transform.interceptor.ts`, `shared/filters/all-exceptions.filter.ts`. Mọi đường dẫn bằng chứng backend trong tài liệu đều tính từ root repository.

- Prefix mặc định trong source là `/api/v1`; đây không phải xác nhận cấu hình runtime. Frontend dùng cấu hình base URL công khai, không hardcode địa chỉ triển khai.
- Thành công thông thường: `{ success: true, data: T }`; interceptor giữ object đã có cả `success` và `data`. Service đọc cấu trúc `T` cụ thể, không tự unwrap mọi trường `data` lồng nhau.
- Lỗi filter: `{ success: false, error: { code, message, timestamp, path } }`; `message` có thể không phải string. Lỗi mạng/timeout không có envelope phải được biểu diễn riêng. Không render stack hoặc nguyên payload nhạy cảm.
- DTO giữ snake_case theo contract; UI model có thể dùng camelCase qua mapper có tên rõ. Không gộp kiểu API và local draft thành một entity không phân biệt nguồn.
- Response không được khai báo schema đầy đủ thì đọc service/schema và thêm kiểm tra tối thiểu tại biên khi triển khai. Không gọi type tự viết là type OpenAPI generated.
- Chưa có pipeline sinh type được kiểm chứng; không tự thêm lệnh gen giả. Khi có generator sau này, không sửa tay file generated.
- Query key/cache phải chứa tài khoản và resource/query params liên quan; xóa/đổi phạm vi cache khi đổi tài khoản. Không để response cũ cập nhật UI của phiên mới.
- TanStack Query giữ server state. IndexedDB giữ bản sao có thời điểm/phạm vi tải và draft; UI không gọi bản sao đó là dữ liệu mới nhất của server.
- Invalidate/refetch resource liên quan sau server ACK, không sau riêng bước lưu IndexedDB.

## 6. Bảng đối chiếu đủ 9 module

Endpoint bên dưới đều tương đối với prefix API. Tên hook/service là nhóm trách nhiệm đề xuất, chưa phải symbol đã có. Thấy controller/service chỉ chứng minh source hiện diện, chưa chứng minh endpoint chạy được hoặc ownership guard đúng toàn bộ.

| Module | Feature/màn hình | Hook/service đề xuất | Contract/backend và giới hạn static |
|---|---|---|---|
| 1. Auth | Register, login, refresh có đồng ý, logout, sessions/revoke | `hooks/auth`, `services/auth` | `POST /auth/register`, `/login`, `/refresh`, `/logout`; `GET /auth/sessions`; `DELETE /auth/sessions/:id`. Login trả `access_token`, `refresh_token`, `expires_in`, `user`. Google/forgot/reset/permissions chưa thấy route tương ứng |
| 2. User | Hồ sơ; các feature admin trong spec chờ API | `hooks/users`, `services/users` | `GET/PATCH /users/me`; thêm `DELETE /users/me` có trong backend nhưng không tự mở rộng scope UI. Update nhận `first_name`, `last_name`, `avatar_url`; không phải `fullName`. Chưa thấy change-password/list users/block/unblock |
| 3. Workspace | Danh sách, chi tiết, create/update/delete; membership cần đặc tả UI riêng | `hooks/workspaces`, `services/workspaces` | `GET/POST /workspaces`; `GET/PATCH/DELETE /workspaces/:id`; `POST /workspaces/:id/members`; `DELETE /workspaces/:id/members/:userId`. List trả `{ workspaces }`, không tự coi là pagination của spec. Restore chưa thấy |
| 4. Project | Danh sách trong workspace, chi tiết, create/update/delete | `hooks/projects`, `services/projects` | `GET/POST /workspaces/:workspaceId/projects`; `GET/PATCH/DELETE /projects/:id`. List trả `{ projects }`; restore chưa thấy |
| 5. Dataset | Upload, chi tiết/schema, đổi tên, xóa | `hooks/datasets`, `services/datasets`, draft repository | `POST /projects/:projectId/datasets/upload`; `GET /projects/:projectId/datasets`; `GET/PATCH/DELETE /datasets/:id`; `GET /datasets/:id/schema`. Upload là multipart và trả `{ message, dataset }` trong envelope; project query có thể trả `dataset: null` |
| 6. Visualization | Cursor grid, profile; module dữ liệu 3D chờ mapping | `hooks/visualization`, `services/visualization` | `GET /datasets/:datasetId/records`; `PATCH /datasets/:datasetId/records/:rowIndex` nhận `{ field, value }`; `GET /datasets/:datasetId/columns/:columnName/stats` trả `{ stats }`. Không dùng `POST /query` hay `/profile` của spec |
| 7. Transformation | Vị trí editor/preview/execute trong kiến trúc | Domain transformations; chỉ tạo khi có đợt được duyệt | Chưa thấy controller/service transformation trong source đã kiểm kê; 6 action của spec và dry-run chưa được coi là hỗ trợ. Không tự biến cell edit thành transformation/version chính thức |
| 8. Version/Lineage | Graph, upstream/downstream, verify; history/rollback chờ API | `hooks/versions-lineage`, `services/versions-lineage`, graph adapter | `GET /lineage/:dataset_id`; `GET /lineage/node/:id/upstream`, `/downstream`; `GET/POST /lineage/verify-integrity/:dataset_id`. Chưa thấy versions history/rollback theo spec; graph không thay thế version history contract |
| 9. Export | Vị trí preview/download/save-as-new | Domain export, chưa dựng thực thi | Chưa thấy controller/service export. Không tự thực hiện download/encryption/save-as-new hoặc coi dữ liệu cache là toàn dataset |

Bằng chứng: `src/backend/src/modules/{auth,users,workspaces,projects,datasets,data-view,lineage}/*controller.ts`, DTO/service tương ứng; kiểm kê các module dưới `src/backend/src/modules`.

### Các khác biệt ảnh hưởng thiết kế

- Auth register dùng `first_name`/`last_name`, role trong service mặc định `analyst`; không hardcode quyền theo `DATA_ANALYST`/`ADMIN` từ spec. Quyền UI cần đối chiếu backend trước đợt auth, không tự xây permission API chưa có.
- `data-view/dto/query-records.dto.ts` nhận `cursor`, `limit` (1–200, mặc định 50), `sort_field`, `sort_order`. `data-view.service.ts` hiện lọc và sort theo `row_index`; chưa thực hiện sort tùy chọn. UI chưa được hứa sort/filter/search toàn bộ dataset.
- Cursor response là `{ items, next_cursor, has_more, total_count? }`. Record identity dựa dữ liệu thực tế gồm `row_index` và resource; không tự thay bằng `_rowId` của spec. Không giả định hỗ trợ xem version lịch sử.
- `datasets.service.ts` kiểm tra `project.has_dataset`, tên dataset suy từ filename. Parser hiện gọi `processCsvStream` dù có nhận diện đuôi xlsx/json; không tuyên bố Excel/JSON đã chạy đúng. `datasetName` và các giới hạn file/row/column của spec chưa được coi là đã enforce. Trước triển khai upload phải chốt định dạng/giới hạn được hỗ trợ thực tế; không tự đặt cap.
- `If-Match` có decorator trong shared nhưng cell update hiện chưa dùng kiểm tra version trong controller/service đã đọc. CORS source cũng chưa cho phép `If-Match` trong allowed headers. Không coi optimistic locking đã hoạt động.
- SHA checksum, cờ một dataset/project hoặc backend outbox đồng bộ Neo4j không chứng minh idempotency cho thao tác frontend.

## 7. Hai module 3D và toán học

### Không gian làm việc 3D

View/hook chuyển resource UI model thành scene model có định danh resource, nhãn, trạng thái và selection. Scene hiển thị workspace/project/dataset và quy trình; thao tác chọn phát callback về hook để UI/route cập nhật. Không vẽ upload pending thành dataset đã tồn tại trên server. Bố cục, hình dạng và quỹ đạo chi tiết cần được duyệt ở đợt scene.

### Trực quan dữ liệu 3D

Chốt ranh giới: nhận dữ liệu đã được mapper chuẩn bị cùng định danh/phạm vi nguồn; render và trả selection có thể liên kết ngược tới dòng. Không suy đoán ba trục, normalize, sampling, giới hạn điểm, null handling hoặc thuật toán AI. Các phần này là **chờ đặc tả**, chưa được phép triển khai. Dữ liệu tải một phần phải hiện phạm vi; không gọi thống kê cục bộ là thống kê toàn dataset.

### Math và vòng đời

- Số phức `z = a + bi`: pha, góc và quỹ đạo trên mặt phẳng đã chọn; ánh xạ mặt phẳng vào 3D ở adapter rõ ràng.
- Vector 3D: vị trí, hướng, khoảng cách. Quaternion `w + xi + yj + zk`: hướng/phép quay 3D; không dùng phép nhân Quaternion như phép nhân số phức giao hoán.
- Thuật toán nghiệp vụ bằng số phức chưa có input/output; nằm ngoài scope, không tự thêm FFT/anomaly detection.
- Hàm math thuần, sai số số thực được kiểm tra với tolerance phù hợp; quy ước đơn vị góc và hệ tọa độ cần chốt trước code math.
- Frame loop/ref cập nhật chuyển động, không set React state mỗi frame. Pause khi scene không cần render; hỗ trợ reduced motion, dọn geometry/material/texture và listener khi unmount.
- Lỗi khởi tạo renderer/context có fallback DOM; bảng/form vẫn sử dụng được. Không hứa FPS hoặc số điểm khi chưa có dataset và thiết bị đại diện.

## 8. Chính sách auth/session đã duyệt

Bằng chứng: `modules/auth/auth.module.ts`, `auth.service.ts`, DTO refresh và JWT strategy. Source mặc định JWT access expiration là `15m`, response `expires_in` hardcode 900; session refresh đang tính 7 ngày. Đây là static, không xác nhận runtime hoặc refresh 30 ngày; không đọc `.env`. FE dùng hạn token thực tế để scheduling, không cộng lại 15 phút tại thời điểm outage và không coi decode JWT là server xác nhận quyền mới nhất.

| Tình huống | Hành vi đề xuất bắt buộc |
|---|---|
| BE lỗi, access token còn hạn | Giữ ngữ cảnh; chỉ làm cục bộ trong whitelist đã duyệt |
| BE lỗi, access token hết hạn | Dừng nghiệp vụ/replay, khóa dữ liệu riêng tư, chuyển login |
| BE hoạt động, access token hết hạn | Dừng nghiệp vụ; một dialog hỏi có tiếp tục phiên |
| Người dùng đồng ý | Một request `POST /auth/refresh` với `{ refresh_token }`; thành công mới tiếp tục |
| Người dùng từ chối | Kết thúc phiên phía FE, chuyển login |
| Server từ chối refresh do phiên không hợp lệ | Kết thúc phiên phía FE, chuyển login |
| Refresh lỗi mạng/BE khi access token đã hết hạn | Chuyển login; không báo refresh thành công |

Không refresh âm thầm. Auth/session coordinator sở hữu dialog và promise refresh chung cho các request đồng thời; API client không tự mở dialog hoặc tự replay mutation. Request nghiệp vụ mới và queue bị chặn khi chờ quyết định/refresh. Không biến mọi `401` thành token-expiry: phân biệt login sai, phiên bị từ chối và token hết hạn theo bằng chứng có sẵn.

Kiểm tra expiration khi hành động, khi tab focus/visibility trở lại và bằng timer. Mỗi callback gửi cần kiểm tra session hiện tại, tránh race expiry/đổi account. Logout cục bộ khi server lỗi không đồng nghĩa đã thu hồi phiên trên server.

Chính sách đợt nền tảng đã chốt: dùng `Date.now() >= exp * 1000` để xác định hết hạn, không cộng grace period hoặc tự hiệu chỉnh clock skew. `exp` phải là NumericDate kiểu số hữu hạn, quy đổi được sang thời gian hữu hạn; thiếu/sai thì xử lý phiên lỗi. Đồng hồ thiết bị sai có thể gây nhận định sai phía FE; server vẫn quyết định token hợp lệ khi nhận request.

Mỗi tab quản lý phiên runtime/sessionStorage riêng, chưa đồng bộ login/logout hoặc dialog giữa các tab. Cam kết một dialog/một refresh áp dụng trong mỗi tab. Tab mới hoặc duplicate có thể được trình duyệt sao chép sessionStorage ban đầu; không hứa mỗi tab luôn tương ứng một server session khác nhau. Logout ở một tab không tự cập nhật UI tab khác; nếu chia sẻ server session thì khả năng refresh của tab kia có thể bị server từ chối. Quy tắc một chủ gửi queue giữa các tab vẫn thuộc đợt sync tương lai, không bị loại bỏ bởi chính sách auth này.

Chuyển login giữ file/draft/queue trong IndexedDB nhưng không render dữ liệu đó ở public route. Đăng nhập lại thành công cùng account mới được đọc lại/replay. Token/password không lưu trong payload queue. Snapshot phân quyền cũ không dùng để xác nhận quyền server hiện tại.

### Lưu credential và khôi phục phiên — đã chốt

- Lưu access token và refresh token trong **sessionStorage**; AuthProvider giữ bản runtime trong memory. Không lưu password, không tự đổi sang localStorage, IndexedDB hoặc cookie.
- Reload: guard đợi khôi phục phiên. Token còn hạn + BE hoạt động: gọi `GET /users/me` để lấy user hiện tại trước khi mở trang riêng tư. Token còn hạn + BE lỗi: chỉ vào chế độ cục bộ có giới hạn; không coi user/role lưu cũ là quyền server đã xác nhận.
- Token hết hạn + BE hoạt động: hỏi tiếp tục phiên; đồng ý mới refresh. Token hết hạn + BE lỗi: chuyển login. Không tự refresh khi bootstrap.
- Logout, từ chối gia hạn hoặc phiên bị từ chối: xóa credential và ngữ cảnh phiên trong sessionStorage, dọn server cache tài khoản; không xóa file/draft/queue nghiệp vụ.
- sessionStorage đọc được bằng JavaScript, không chống XSS; dữ liệu đọc lại phải được kiểm tra cấu trúc và không dùng như bằng chứng phân quyền. Đóng tab không được coi là bảo đảm thu hồi phiên trên server.
- Key đã duyệt: `data-quality.auth.v1`, một JSON object `{ schemaVersion: 1, accessToken: string, refreshToken: string, accountId: string }`. Không lưu password hoặc role; user hiện tại lấy qua `/users/me` khi BE hoạt động. `accountId` phải khớp `sub` của access token; kiểm tra này phục vụ nhất quán local, không xác minh chữ ký/phân quyền.
- JSON sai, thiếu trường, schemaVersion không hỗ trợ, token thiếu hạn hợp lệ hoặc accountId không khớp sub: xóa riêng phiên lỗi, chuyển login, giữ bản nháp. Token có exp hợp lệ nhưng đã hết hạn vẫn đi qua chính sách consent/refresh ở bảng trên, không bị coi là JSON/schema lỗi.

### Kiểm tra health trước gia hạn — đã chốt

Source `src/backend/src/app.controller.ts` có `@Public() GET /health`, được mount trong AppModule; prefix mặc định tạo `/api/v1/health`. Khi token hết hạn, dừng nghiệp vụ rồi gọi endpoint này với timeout **5.000 ms**, không cần bearer và không gửi refresh token. Đọc envelope thực tế: HTTP thành công, payload hợp lệ và `services.mongodb_atlas.status === 'connected'` mới mở dialog hỏi tiếp tục phiên. Lỗi mạng/timeout/HTTP lỗi, payload không hợp lệ hoặc MongoDB disconnected: chuyển login theo chính sách đã duyệt. Không biến tín hiệu health thất bại thành kết luận chắc chắn mọi dịch vụ đã sập.

Health thành công chỉ là tín hiệu khả dụng tại thời điểm kiểm tra, không xác nhận quyền hay bảo đảm refresh thành công. Chỉ sau người dùng đồng ý mới gọi refresh; refresh lỗi vẫn về login. Neo4j disconnected không tự chặn gia hạn auth nếu điều kiện MongoDB đạt. Không dùng riêng trường `status: 'ok'` để bỏ qua trạng thái MongoDB. Đây là luồng auth, không tự coi health đạt là đã đủ điều kiện replay nghiệp vụ.

### Đợt nền tảng

Router khai báo rõ public/private layout và guard chờ bootstrap; QueryClientProvider quản lý server cache; AuthProvider quản lý phiên. Session coordinator sở hữu một dialog/một refresh; Axios instance chỉ gắn bearer và chuẩn hóa lỗi, không tự refresh/retry ghi. Đợt này có form đăng nhập tối giản gọi API thật, chưa có UI hoàn chỉnh của 9 module, IndexedDB/replay hoặc scene 3D. Chi tiết ở [implementation plan nền tảng](../foundation/implementation-plan.md).

## 9. IndexedDB, repository và phạm vi lưu cục bộ

Chỉ hỗ trợ gián đoạn API khi thiết bị vẫn có Internet. Không mở rộng thành offline-first toàn ứng dụng, PWA hay service worker. Việc giữ bản nháp sau reload được bảo đảm trong điều kiện dữ liệu trình duyệt chưa bị xóa; browser storage không phải backup.

Whitelist ghi cục bộ đã được duyệt chỉ gồm:

1. Upload dataset: giữ toàn bộ File/Blob và metadata đích trong IndexedDB.
2. Yêu cầu xóa dataset: giữ ý định xóa; lần xác nhận ban đầu nêu rõ sẽ tự gửi khi backend phục hồi.

Các đề xuất trước về sửa ô, sửa hồ sơ, create/update workspace/project, transformation và local export chưa được duyệt làm cục bộ: không tự queue. Scene animation/selection là trạng thái trình bày, không phải giao dịch server. Snapshot khi được lưu chỉ phục vụ phạm vi đọc đã xác định ở đợt triển khai, không tự tải toàn bộ dataset.

Model nội bộ đề xuất, không phải wire contract backend:

| Nhóm dữ liệu | Thông tin cần giữ |
|---|---|
| Snapshot | account/resource, dữ liệu server đã tải, thời điểm, phạm vi/query, dấu phiên bản nếu server cung cấp |
| Upload file | file ID nội bộ, owner account, Blob, tên/MIME/kích thước gốc |
| Draft | owner, project/dataset đích, loại ý định, liên kết file và thông tin cần render |
| Operation | operation ID ổn định, owner, resource, loại upload/delete, payload tham chiếu, thứ tự/phụ thuộc, trạng thái, retry/error/ACK |

Schema Dexie/version migration, quota cap và retention cần đặc tả trước triển khai DB, không tự tạo schema sản phẩm trong đợt này. File + draft + operation phải commit transaction nguyên tử trước thông báo thành công. Network request nằm ngoài transaction. QuotaExceeded, abort hoặc thiếu hỗ trợ IndexedDB: báo chưa lưu, không thay bằng memory rồi tuyên bố durable.

Không tự xóa pending file để giải phóng quota. Việc xóa file sau đồng bộ cần chính sách retention được duyệt; khi chưa có thì không bật cleanup tự động. Mỗi thao tác đọc/ghi đều có account scope; UI logout che dữ liệu nhưng không hứa IndexedDB tự mã hóa.

## 10. Sync coordinator và xử lý lỗi

```text
User chọn file trong project
  → hook kiểm tra phiên và điều kiện được phép
  → repository transaction: file + draft + operation
  → commit: UI “Đã lưu cục bộ — chờ đồng bộ”
  → coordinator: backend phục hồi + phiên hợp lệ + contract đủ
  → kiểm tra lại quyền/tài nguyên/điều kiện thao tác
  → service gửi file bằng API thực tế
  → server ACK hợp lệ
  → repository ghi ACK/trạng thái
  → invalidate server cache, tải lại dataset/project
```

Đây là luồng học xuyên suốt: hook quyết định bước tiếp theo, repository xác nhận đã lưu trên thiết bị, service gửi, server mới xác nhận thay đổi chính thức.

Trạng thái operation nội bộ: `pending`, `sending`, `awaiting-reconciliation`, `blocked-auth`, `blocked-conflict`, `failed`, `synced`, `cancelled`. Draft được commit nhưng chưa đủ contract replay vẫn hiện chờ backend; không gọi là synced. Pending/sending/synced là trạng thái thao tác, không ghi đè dataset `status` của backend.

- Một coordinator sở hữu retry mutation; Axios/Query mutation không retry độc lập. Retry có backoff và không retry vô hạn liên tục. Giá trị timeout/backoff cụ thể chốt ở đợt sync, không phải business rule đã có.
- API timeout/network/5xx có thể biểu thị outage; 400/401/403/409 không tự coi là server sập. Browser online chỉ là tín hiệu gợi ý, không chứng minh API sống. Health có sẵn được đối chiếu ở mục 8; kiểm tra phục hồi cho sync vẫn phải kiểm tra điều kiện nghiệp vụ và gate backend, không tự tạo endpoint khác.
- Token còn hạn không chứng minh account chưa bị revoke từ xa; trong outage chỉ lưu ý định được duyệt, không giả lập quyền hoặc server ACK.
- Giữ FIFO và phụ thuộc theo resource; delete→upload thay thế cùng project phải chờ delete được xác nhận và project đủ điều kiện. Lỗi predecessor chặn successor.
- Có một chủ gửi giữa các tab và phục hồi quyền sở hữu sau tab đóng. Cơ chế lock/lease cụ thể cần đặc tả sync; không chỉ dùng boolean trong memory.
- Timeout sau request có thể server đã commit: chuyển chờ đối soát, không mù quáng tạo operation ID mới hoặc gửi lại.
- Reload khi `sending`: không tự coi thành công hay chưa gửi; cần đối soát trước replay. Server ACK thành công nhưng ghi IndexedDB lỗi cũng cần khôi phục/đối soát.
- Chỉ `synced` sau ACK và ghi trạng thái cục bộ; nếu response chưa đủ nhận diện kết quả thì chờ đối soát.
- Conflict hoặc quyền thay đổi: giữ draft, dừng chuỗi liên quan, hiển thị căn cứ và yêu cầu xử lý; không last-write-wins ngầm.
- Cho hủy trước gửi. Khi request đã in-flight, UI không hứa đã hủy server; cancel transport không chứng minh server chưa commit.
- UI hiển thị riêng trạng thái bản cục bộ, dữ liệu server và lỗi sync. Không xóa dataset chính thức khỏi UI như đã thành công chỉ vì đã lưu ý định xóa.

### Gate phụ thuộc backend — chưa bật replay

Chưa thấy đủ idempotency/đối soát/version guard trong luồng upload/delete hiện tại. Backend cần contract đã xác minh cho:

1. Mã thao tác ổn định và kết quả chống xử lý trùng, kể cả request đồng thời/retry.
2. Đối soát kết quả khi mất response, timeout hoặc reload.
3. Điều kiện phiên bản/tài nguyên chống ghi đè và nhận diện đúng dataset cần xóa.
4. Phản hồi xung đột/quyền/tài nguyên đủ để FE quyết định dừng hoặc tiếp tục.

Không phát minh header, endpoint, payload hoặc thời hạn dedup trong tài liệu này. Trước khi gate đạt, có thể thiết kế lưu draft nhưng không bật tự replay upload/delete; UI phải nói rõ chờ hỗ trợ đồng bộ. Backend outbox Neo4j không phải queue của trình duyệt. Không sửa backend trong đợt này.

## 11. Roadmap và phần cần đặc tả tiếp

| Đợt tương lai | Kết quả | Gate trước implementation |
|---|---|---|
| 1. Nền tảng | Router/layout, API/type boundary, session policy, login tối giản | Yarn và sessionStorage đã chốt; kiểm tra version/contract và duyệt batch code |
| 2. Feature có API | Auth, profile, workspace/project, dataset/grid/lineage | Duyệt từng feature; kiểm tra runtime ownership/error/response |
| 3. 3D | Scene workspace và math; data scene khi đủ mapping | Duyệt visual/interaction/math conventions; data mapping riêng |
| 4. Draft bền vững | Upload Blob và delete intent | Duyệt schema/migration/quota/retention và storage tests |
| 5. Replay | Tự sync theo account/session/resource | Backend gate đạt; duyệt retry/locking/reconciliation/conflict |
| 6. Feature chờ | Transformation, export, phần auth/admin/version còn thiếu | Backend có contract và scope được duyệt mới |

Chưa được phép tự quyết các phần còn thiếu: version dependency; cap file/storage; parser support; snapshot coverage; quy tắc X/Y/Z/sampling/normalize; motion layout; thuật toán AI/số phức trên dữ liệu; retry/lease constants; chính sách cleanup; contract replay. Credential storage đã chốt sessionStorage, chi tiết batch code nằm ở plan nền tảng. Người thực hiện tài liệu chỉ ghi rõ gate, không triển khai lấp chỗ trống.

## 12. Validation và kịch bản nghiệm thu tương lai

Trong đợt tài liệu chỉ kiểm tra nội dung, đường dẫn bằng chứng và diff. Không gọi kết quả static là runtime test. Khi triển khai, dùng bộ test phù hợp sau:

| Nhóm | Kịch bản | Kết quả cần có |
|---|---|---|
| Storage | Commit file + operation thành công; quota/abort lỗi | Chỉ báo lưu thành công sau commit; không có record mồ côi |
| Reload | Reload sau lưu; browser giữ dữ liệu | File/draft/queue còn; auth gate vẫn áp dụng |
| Outage | BE lỗi, token còn hạn | Chỉ whitelist cục bộ hoạt động; không giả API thành công |
| Expiry | Token hết hạn khi BE lỗi; tab ngủ rồi focus | Dừng nghiệp vụ/replay, chuyển login; giữ draft |
| Consent | BE hoạt động, token hết hạn; đồng ý/từ chối | Một dialog; đồng ý mới refresh; từ chối chuyển login |
| Refresh | Rejected, timeout/network error, nhiều request đồng thời | Một refresh; lỗi khi token hết hạn chuyển login; không replay mutation ngầm |
| Account | Logout/login tài khoản khác | Không render/gửi draft account cũ; cache không chảy chéo |
| Replay | BE phục hồi, đúng account và quyền, gate đủ | Tự gửi theo thứ tự; chỉ synced sau ACK |
| Ambiguous ACK | Server commit rồi mất response; ACK ghi local lỗi | Đối soát cùng operation; không tạo bản ghi trùng |
| Dedup | Retry cùng ID và hai tab đồng thời | Một kết quả server, một chủ gửi; không mất ý định |
| Conflict | Tài nguyên đổi/xóa, quyền đổi, project đã có dataset | Dừng chuỗi liên quan, giữ draft và yêu cầu xử lý |
| Cancel | Hủy pending; cancel khi đang gửi | Pending không gửi; in-flight không hứa server đã hủy |
| Dependency | Delete rồi upload cùng project | Upload chỉ gửi sau delete ACK và revalidate |
| API boundary | Envelope/list/cursor/errors/multipart thực tế | Mapper đúng, không unwrap nhầm, không hứa query chưa hỗ trợ |
| Math | Quay 0/toàn vòng, norm Quaternion, phối hợp quay, delta thời gian | Kết quả theo convention đã duyệt với tolerance, không NaN |
| 3D | Unmount/remount, reduced motion, context lỗi | Dọn tài nguyên, giảm chuyển động, DOM fallback dùng được |
| Coverage | Chỉ có một phần dữ liệu | UI ghi rõ phạm vi; không gọi là toàn dataset |

## 13. Quy tắc bảo trì và bàn giao

Đọc flow trước khi sửa; dùng đúng tầng, không tự sửa generated file, không đọc/in `.env`, không thêm tài liệu AI vào public. Config chỉ nhắc tên biến, không giá trị credential. Thư viện frontend không được chứa secret backend.

Nếu phát hiện mã/hàm nghi không dùng khi làm việc với file, ghi bằng chứng/caller/export/dynamic usage và nhắc lại trạng thái khi quay lại file; không tự xóa hoặc tạo tài liệu theo dõi ngoài phạm vi được duyệt.

Tiêu chí bàn giao setup nhóm: architecture/foundation cập nhật, master plan/team workflow, đủ 9 module và nguồn static, folder .gitkeep, manifest/yarn.lock, build/lint và kiểm tra frozen install. Không thực thi chức năng trong roadmap hoặc tuyên bố đã kiểm chứng trình duyệt/API.
