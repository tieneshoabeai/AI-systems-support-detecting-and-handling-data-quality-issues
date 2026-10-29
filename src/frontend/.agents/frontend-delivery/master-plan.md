# Frontend master plan — nhóm 2 người

Ngày: 26/10/2026. Trạng thái: plan toàn bộ phạm vi đã biết; batch hiện tại chỉ setup structure/dependency, chưa triển khai nghiệp vụ.

## 1. Nguồn và phạm vi

- [Architecture](../Structure/frontend-architecture-plan.md): các tầng, 9 module, auth, 3D, IndexedDB và gate backend.
- [Foundation plan](../foundation/implementation-plan.md): thiết kế nền tảng và các quyết định session đã chốt.
- [Team workflow](team-workflow.md): người phụ trách, review và tích hợp.
- [Contract audit từ Swagger đang chạy](modules/00-contract-audit.md): 36 operation, response schema còn thiếu và đối chiếu service/DTO; không nhầm tài liệu runtime với test nghiệp vụ.
- Backend controller/DTO/service là chuẩn tích hợp; feature_spec_v4 là danh sách mục tiêu. Chưa có API không đồng nghĩa được tự tạo contract.

### Ba đầu ra dùng chung trước khi code module

| Tài liệu | Nội dung bàn giao cho hai người |
|---|---|
| [Foundation spec](foundation-spec.md) | Config/API error/session interfaces, DTO source map, query keys, provider/router boundary, quy tắc callback và prompt triển khai |
| [Screen flow](screen-flow.md) | Route registry, sơ đồ xuyên màn hình, action→cache→navigation, error/local-limited và các lựa chọn UX-P01–P08 chờ duyệt |
| [Shared UI](shared-ui.md) | Primitives/props/states, form/dialog/feedback/accessibility, capability presentation và các lựa chọn UI-P01–P05 chờ duyệt |

Chính sách đã chốt được giữ nguyên; technical interface trong spec là đề xuất cho batch code, không phải source đang chạy. Các ID UX/UI pending chưa cấp phép implementation và không được xem là business requirement đã xác nhận. Ba tài liệu có 48 test case dự kiến bổ sung; chưa chạy test hoặc sửa source trong đợt này.

### Plan chi tiết từng module

| File | Người phụ trách | Phụ thuộc chính |
|---|---|---|
| [01 Auth](modules/01-auth.md) | FE A, FE B review | Shared client/router/context, health, sessionStorage; register role policy còn gate |
| [02 User](modules/02-user.md) | FE A, FE B review | Auth/query me, response fixture |
| [03 Workspace](modules/03-workspace.md) | FE A, FE B review | Auth, permission context; membership tách batch |
| [04 Project](modules/04-project.md) | FE A, FE B review | Workspace context, không đoán datasetId |
| [05 Dataset](modules/05-dataset.md) | FE B, FE A review | Project, parser/limit/permission; local draft và replay tách gate |
| [06 Visualization](modules/06-visualization.md) | FE B, FE A review | Dataset, cursor/record identity; data 3D mapping chờ spec |
| [07 Transformation](modules/07-transformation.md) | Chỉ định trước batch | Chưa có API; chỉ plan/gate, không thực thi |
| [08 Version/Lineage](modules/08-version-lineage.md) | Chỉ định trước batch | Graph/trace/verify có path; raw node mapping và history/rollback còn gate |
| [09 Export](modules/09-export.md) | Chỉ định trước batch | Chưa có API; chỉ plan/gate, không thực thi |

Mỗi module có đặc tả 6 mục, bảng test, pseudocode/dò tay, prompt và log trạng thái. Case hậu gate là tiêu chí tương lai, không phải test đã pass. Prompt không tự cấp quyền code; từng batch implementation vẫn cần duyệt. Module thiếu contract chỉ hoàn tất plan phụ thuộc, không giả đặc tả data-level đã sẵn sàng.

Đã thay đổi yêu cầu: tạm dừng triển khai chức năng/login; trước hết hoàn thiện plan và setup cho **2 lập trình viên FE**. Cho phép cài thư viện vào package.json/yarn.lock và tạo folder .gitkeep. Không thêm component/service/hook giả, route hoạt động giả, test rỗng hoặc chức năng backend.

## 2. Bàn giao môi trường và structure

Từ frontend root:

```sh
yarn install --frozen-lockfile
```

Sau khi dọn mẫu, đã setup entry mới `src/app/main.tsx` → App.tsx (render tên App), layout.tsx tối giản và style.css. index.html dùng entry mới. Có thể chạy `yarn dev`, `yarn build`, `yarn lint` cho bootstrap; chưa có router/auth/feature. constants/context/pages/private/pages/public/router là các folder chuẩn bị cho đợt sau, không có logic giả.

Dùng Yarn 1.22.22 (packageManager trong manifest), Node đã kiểm tra là 26.7.0. Với máy khác, kiểm tra engine của dependency trước cài; không dùng ignore-engines để vượt lỗi. `--frozen-lockfile` dùng cho người nhận/CI để tránh resolve phiên bản khác. Chạy `yarn install` khi chủ động thay dependency đã được duyệt.

Giữ package-lock.json theo yêu cầu nhưng Yarn là công cụ chính. Người thứ hai dùng package.json + yarn.lock trong cùng snapshot. Không đổi lockfile format hoặc npm install xen kẽ. Không chia sẻ node_modules.

Structure đã duyệt (ngoài assets còn lại):

```text
src/
  app/             # FE A: bootstrap/providers/router/guards/layout
  views/           # A/B theo domain
  components/      # A/B theo domain; shared có owner mỗi batch
  hooks/           # A/B theo domain
  services/        # A/B theo domain
  repositories/    # owner chỉ định trước batch lưu trữ
  sync/            # owner chỉ định trước batch đồng bộ
  graphics/        # FE B: scene/camera/interaction
  math/            # FE B: số phức/vector/Quaternion
  lib/             # shared, một owner mỗi batch
  types/           # domain owner; API/shared một owner mỗi batch
  configs/         # shared, một owner mỗi batch
  utils/           # pure helper theo domain
  __tests__/       # test chính thức theo domain
```

Chỉ .gitkeep cho folder chưa có code; không tạo tất cả tích Descartes tầng × 9 domain. Khi có file thật thì bỏ .gitkeep của folder đó nếu không còn cần.

Thư viện cài cho toàn dự án: react-router, axios, @tanstack/react-query, three, @react-three/fiber, dexie. Dev: @types/three, vitest, @testing-library/react, @testing-library/dom, jsdom. Version chính xác trong manifest và lockfile; cài sẵn không chứng minh tính năng đã tích hợp. Chưa thêm test script/config hoặc UI/animation/state library khác.

## 3. Phân công nền tảng

| Người | Trách nhiệm chính | Reviewer |
|---|---|---|
| FE A | app shell, router, auth/session, user, workspace, project | FE B |
| FE B | dataset, visualization, graphics, math | FE A |

Transformation, version/lineage, export, repositories và sync là các batch riêng: chỉ định một owner và reviewer còn lại trước khi bắt đầu. Không mặc định chúng đã thuộc FE B. FE A/B là nhãn trách nhiệm, chưa gán tên người thật.

File chung (manifest/lock, lib, API DTO dùng chung, config, CSS global, provider/router) chỉ một owner sửa trong mỗi batch. Người khác đề xuất thay đổi qua review, không tự sửa song song. Cấu hình API là đầu mối chung; từng domain không tạo Axios instance riêng.

## 4. Thứ tự và điều kiện tích hợp

| Batch | Chủ trì | Đầu vào → đầu ra | Gate nghiệm thu |
|---|---|---|---|
| S0. Setup hiện tại | Người thực hiện setup; người còn lại review | Scaffold + plan → folder markers, dependency/lock, tài liệu nhóm | Frozen install, build/lint; runtime source giữ nguyên |
| S1. Foundation | FE A, FE B review | Contract thật + session decisions → router/providers/API/session và login tối giản | Duyệt batch code; hết hạn/consent/health/storage/cache tests; API thật khi đủ môi trường |
| S2A. User/workspace/project | FE A, FE B review | S1 + API/schema → profile, list/detail và các thao tác BE hỗ trợ | Input/error/ownership runtime; không queue ghi ngoài whitelist |
| S2B. Dataset/grid | FE B, FE A review | API boundary S1 + project context → upload/detail/schema/grid/profile | Parser/limit được xác nhận; cursor, null/empty/error; không hứa sort/filter chưa có |
| S3. Workspace 3D/math | FE B, FE A review | Resource UI model đã thống nhất → scene selection, camera, motion | Duyệt visual/hệ tọa độ/đơn vị góc; math test, cleanup, reduced motion, fallback |
| S4. Data visualization 3D | Owner chỉ định trước batch | Dữ liệu có identity/phạm vi → adapter + scene | Đặc tả X/Y/Z, normalize/sampling/null/limit được duyệt trước; không tự thêm AI |
| S5. Persistent drafts | Owner chỉ định trước batch | Upload/delete intents → Blob/draft/queue IndexedDB | Duyệt schema/migration/quota/retention; transaction/quota/reload/account tests |
| S6. Replay | Owner chỉ định trước batch | S5 + backend gate → retry/reconciliation/conflict | BE idempotency + đối soát + version/resource guard; multi-tab/order/ambiguous ACK tests |
| S7. Version/lineage | Owner chỉ định trước batch | API graph hiện có → graph/trace/verify UI | Duyệt presentation/adapter; history/rollback chờ contract riêng |
| S8. Transformation | Owner chỉ định trước batch | Backend action contracts được xác nhận → editor/preview/execute | Chốt tham số từng action và version conflict; chưa có API thì dừng |
| S9. Export | Owner chỉ định trước batch | Backend export contract → preview/download/save-as-new | Chốt stream/error/version/encryption; không tự xuất cache như toàn dataset |
| S10. Integration | Hai người; một integration owner mỗi batch | Các feature đã review → app liền mạch | Cross-flow tests, accessibility/error/3D/storage, báo rõ phần chưa runtime verify |

S2A và S2B có thể làm song song sau khi API/types/route boundaries của S1 được chốt. FE B có thể đặc tả math/scene trước nhưng không tự phát minh resource model khi A chưa bàn giao. S3 và S7 phối hợp adapter để không viết hai nguồn dữ liệu lineage khác nhau. Không có lịch ngày hoặc cam kết tiến độ khi chưa biết thời gian rảnh của hai người.

## 5. Checklist nghiệp vụ đủ 9 module

| Module | Lập kế hoạch triển khai | Chặn/phụ thuộc |
|---|---|---|
| Auth | login/register service, logout/session revoke; consent refresh, reload, health | UI register/sessions ở batch feature; Google/forgot/reset/permissions chưa thấy API tương ứng |
| User | profile GET/PATCH; map first_name/last_name/avatar_url | Admin list/block/unblock/change-password chờ backend; DELETE me không tự mở scope UI |
| Workspace | list/detail/create/update/delete; resource context cho scene | Restore chưa có; membership có API nhưng cần đặc tả UI/quyền riêng |
| Project | list/detail/create/update/delete; dataset presence | Restore chưa có; không tự dùng pagination của spec |
| Dataset | multipart upload, detail/schema/rename/delete | CSV parser hiện tại; Excel/JSON và giới hạn cần xác nhận trước UI; một project một dataset |
| Visualization | cursor grid, stats, cell edit trực tuyến theo contract; data 3D module | Không hỗ trợ sort toàn bộ chỉ vì DTO có sort; edit cục bộ chưa được duyệt |
| Transformation | mỗi action có form/validation/preview/execute/version handling sau đặc tả | Chưa thấy API; không biến cell edit thành transformation có version |
| Version/Lineage | graph/upstream/downstream/verify dùng API thực tế | Version history/rollback chưa thấy contract; verify không chạy giả ở FE |
| Export | preview/download/save-as-new/encryption khi có API | Chưa thấy API; không thêm local export hoặc crypto nghiệp vụ ngoài scope |

## 6. Ranh giới đã chốt cần giữ nguyên

- Session: sessionStorage key `data-quality.auth.v1`, schemaVersion/accessToken/refreshToken/accountId; không password/role. Exp theo Date.now, không grace period; accountId khớp sub chỉ là local consistency.
- Token hết hạn: health public timeout 5 giây, HTTP/payload hợp lệ + MongoDB connected mới hỏi gia hạn. Đồng ý mới refresh; từ chối hoặc refresh lỗi về login. Không refresh âm thầm.
- Auth riêng từng tab; một dialog/health flow/refresh trong mỗi tab. Queue tương lai vẫn cần một chủ gửi giữa các tab.
- Resilience chỉ khi Internet còn hoạt động, API lỗi và token còn hạn. Whitelist ghi cục bộ: lưu file upload đầy đủ và delete intent; server ACK mới đổi trạng thái chính thức.
- Chuyển login giữ IndexedDB nhưng khóa truy cập; account khác không được đọc/gửi draft cũ. Replay kiểm tra quyền/tài nguyên; backend gate chưa đạt thì không bật.
- Math thuần tách graphics: số phức/quỹ đạo mặt phẳng, vector/vị trí, Quaternion/phép quay. Thuật toán dữ liệu bằng số phức chờ đặc tả riêng.

## 7. Hợp đồng bàn giao giữa hai người

Trước batch có dependency chéo, ghi trong task: owner/reviewer, route/component props, DTO/mapper thực tế, trạng thái loading/empty/error, callback/selection identity, cache invalidation và file chung được phép sửa. Không coi tên hàm đề xuất trong plan là API đã tồn tại.

FE A bàn giao session/API provider boundary và resource context; FE B bàn giao dataset/grid/scene model và selection callback. Reviewer phải kiểm tra một flow xuyên tầng, không chỉ UI screenshot. Mock test được ghi rõ là mock, không dùng để tuyên bố API thật hoạt động.

## 8. Kiểm thử và bàn giao

Test chính thức tại src/__tests__, theo domain. Vitest + Testing Library + jsdom đã cài nhưng chưa có cấu hình/test/script trong setup. Khi triển khai S1 mới thêm script và test thực chất; không tạo passing test rỗng.

Mỗi batch cần source/diff review, build/lint, test hành vi phù hợp và browser/API evidence khi được thực chạy. Ngoài happy path: invalid input, empty data, denied auth, expired session, network/timeout, partial response và stale request khi đổi account. S5/S6 thêm quota, reload, duplicate, concurrency và conflict; S3/S4 thêm math/cleanup/fallback.

Trước bàn giao: kê file mới/sửa, dọn file AI tạm ngoài .agents, kiểm tra không sửa .env hoặc dữ liệu người dùng, mở review diff. Không tự commit/push/reset. Không triển khai batch kế tiếp chỉ vì dependency đã được cài.

## 9. Các gate còn mở

Không thể hoàn thiện logic chưa có yêu cầu bằng cách đoán: base URL/test account; parser/limits; snapshot coverage; DB quota/retention/schema; data mapping 3D; retry/lock/reconciliation policy; backend replay contracts; transformation/export/history/rollback contracts. Mỗi gate có batch xử lý trong bảng trên; trước khi gate đạt, chỉ plan, không implement phần đó.

## 10. Kết quả setup đã chạy

- `yarn install --non-interactive`: thành công, đã tạo resolution trong yarn.lock.
- `yarn install --frozen-lockfile --offline --non-interactive`: thành công trên cây hiện tại; không thay thế clean install máy thứ hai.
- `yarn build`, `yarn lint`: thành công ở lần setup trước khi người dùng dọn mẫu, không phải kết quả source hiện tại. Chưa chạy feature tests hoặc browser/API tests vì chưa viết chức năng/config test.
- Đủ 14 folder .gitkeep. Lần setup trước xác minh package-lock.json và file scaffold không đổi; sau đó người dùng đã xóa App.tsx/App.css/main.tsx/index.css. Không khôi phục các file này.
- Yarn có warning peer `rolldown@^1.0.0-rc.5` của @rolldown/plugin-babel hiện có và workspace warning từ quá trình resolve; build/lint vẫn đạt. Chưa thêm peer hoặc đổi toolchain ngoài scope để làm mất warning.
