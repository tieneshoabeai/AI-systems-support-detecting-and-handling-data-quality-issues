# AI-systems-support-detecting-and-handling-data-quality-issues — Frontend

Frontend của dự án **AI-systems-support-detecting-and-handling-data-quality-issues** — **Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề về chất lượng dữ liệu**. Tên tiếng Anh trong README gốc: **AI Systems Support Detecting and Handling Data Quality Issues**. Tài liệu này dành cho nhóm 2 người phát triển FE, người review và người cần cài/chạy project.

**Trạng thái hiện tại.** Frontend có luồng đăng nhập và quản lý phiên. Management dùng API cho workspace/project, thành viên, thông báo, báo cáo vấn đề và hồ sơ; Settings nối đổi mật khẩu và quản lý phiên. Trong project, panel Overview/Data View đọc schema/bản ghi, hỗ trợ truy vấn, thống kê cột, đổi tên cột và tải CSV. Tài khoản admin có panel tài khoản/báo cáo vấn đề trên Home. Các lời gọi này cần kiểm chứng với backend triển khai; build/test mô phỏng không thay nghiệm thu BE thật. Workspace 3D dành cho dev và Shopping Demo vẫn là các công cụ riêng.

## 1. Project Overview

Mục tiêu của hệ thống là hỗ trợ phát hiện các vấn đề chất lượng dữ liệu như giá trị thiếu, ngoại lai, trùng lặp và định dạng không nhất quán; giúp người dùng xem xét, xử lý và theo dõi nguồn gốc thay đổi. FE là lớp giao diện cho luồng này, không phải tên của một dự án quản lý dữ liệu khác.

Theo tài liệu dự án, lộ trình gồm **Core Platform** trước, sau đó là **AI hỗ trợ** phát hiện, giải thích và gợi ý xử lý. Người dùng kiểm tra và phê duyệt thao tác xử lý dữ liệu. Scene 3D hiện phục vụ trực quan và review giao diện, còn việc nối dữ liệu phân tích thật phụ thuộc hợp đồng của từng tính năng.

Nguồn đối chiếu: [README dự án](../../README.md), [báo cáo tổng quan v5](../../docs/report_overview_v5.md), [đặc tả tính năng giai đoạn 1](../../docs/feature_spec_v4.md) và source backend. Mô tả mục tiêu trong docs không được dùng thay cho bằng chứng chức năng đã chạy.

Frontend dùng **React + TypeScript + Vite** và quản lý package bằng **Yarn**. Entry là [src/app/main.tsx](src/app/main.tsx).

| Công cụ | Vai trò dự kiến | Trạng thái |
|---|---|---|
| React, TypeScript, Vite | UI, type checking, dev server và build | Đang dùng |
| React Router | Điều hướng và layout | Luồng chính có router và guard |
| Axios | HTTP client dùng chung | Được runtime truyền vào service auth, users và health |
| TanStack Query | Dữ liệu server và cache | QueryClientProvider và dọn cache phiên đã ghép |
| Three.js + React Three Fiber | Scene, camera và tương tác 3D | Có scene cho login, Workspace và Dataset |
| Dexie / IndexedDB | File và metadata bản nháp | Repository đã ghép vào runtime |
| Vitest, Testing Library, jsdom | Kiểm thử logic và component | Có suite theo nhóm tại [__tests__](src/__tests__/README.md) |

Version và script thực tế xem [package.json](package.json). Đã cài thư viện không đồng nghĩa chức năng tương ứng đã hoạt động.

## 2. Problem Statement

Dữ liệu có thể chứa giá trị thiếu, sai định dạng hoặc thông tin không nhất quán. Người sử dụng cần luồng làm việc rõ ràng để xem dữ liệu, nhận biết vấn đề, kiểm tra tác động xử lý và theo dõi nguồn gốc thay đổi.

Frontend cần giải quyết các yêu cầu:

- Tổ chức tài nguyên theo workspace → project → dataset.
- Hiển thị dữ liệu, trạng thái xử lý và lỗi dễ hiểu.
- Phân biệt dữ liệu đã được server xác nhận với bản nháp trên thiết bị.
- Tách UI, logic, API, lưu trữ và graphics để hai người phát triển cùng project.
- Hỗ trợ một số thao tác cục bộ đã duyệt khi API không khả dụng, với điều kiện thiết bị còn Internet và access token còn hạn.

Đây là mục tiêu thiết kế, không phải tuyên bố các yêu cầu đã được triển khai đầy đủ.

## 3. Main Features

| Module | Phạm vi mục tiêu | Hiện trạng FE |
|---|---|---|
| Auth | Đăng nhập, đăng ký và quản lý phiên | UI gọi API đăng ký và đăng nhập, nhận callback Google và hỗ trợ gia hạn phiên theo xác nhận người dùng. |
| User | Hồ sơ và vòng đời tài khoản | Workbench trực tuyến đọc hồ sơ từ API. Runtime nối thao tác xóa tài khoản với coordinator. |
| Workspace | Danh sách, chi tiết và quản lý workspace/thành viên theo quyền | Workbench tải dữ liệu qua API cho phiên trực tuyến. Preview dev có fixture riêng. |
| Project | Quản lý project trong workspace | Danh sách gần đây và chi tiết project dùng các luồng tải API theo phạm vi route. |
| Dataset | Upload, metadata, schema và quản lý dataset | Project gọi API upload CSV, đọc schema, tải file gốc và xóa dataset. Bản nháp cục bộ có repository riêng. |
| Visualization | Bảng records, thống kê cột và scene 3D | Data View đọc records theo con trỏ và thống kê cột từ API. Scene 3D vẫn có phần hiển thị mẫu. |
| Transformation | Chuẩn bị, xem trước và thực thi phép biến đổi | Có plan; contract backend còn cần xác nhận |
| Version / Lineage | Graph, truy vết và kiểm tra toàn vẹn; history/rollback khi có contract | Có plan; một số phần chờ backend |
| Export | Preview, download và save-as-new khi có API phù hợp | Có plan; contract backend còn cần xác nhận |

Các phần dùng chung gồm Foundation, Screen flow và Shared UI. Xem [master plan](.agents/frontend-delivery/master-plan.md) và [contract audit](.agents/frontend-delivery/modules/00-contract-audit.md) để phân biệt API đã kiểm kê, nguồn static và phần chưa kiểm thử.

## 4. System Architecture

### Luồng đang chạy

~~~text
index.html → src/app/main.tsx
  ├─ /preview/workspaces-3d ở dev → Workspace 3D
  └─ Luồng chính → Application → providers → BrowserRouter → AppRouter → guard/view
~~~

Management và Processing đi qua guard cả dev lẫn production. Dataset 3D được nhúng tại `/processing/projects/:projectId`; hai URL cũ `/workspaces` và `/workspaces/3d-dataset` đã gỡ và hiển thị 404. Page entry nằm trong `app/pages/private`; login và 404 nằm trong `app/pages/public`. `provider/` ghép providers, `context/` giữ AuthProvider implementation.

### Route Management và AI Data Processing

React Router điều hướng bằng pathname; URL 2D mới không dùng `/preview` hoặc hash.

| Route | Nội dung |
| --- | --- |
| `/management` | Home của khu vực quản lý |
| `/management/workspaces`, `/management/workspaces/:workspaceId` | Danh sách và chi tiết workspace |
| `/management/projects` | Danh sách project |
| `/management/members` | Thành viên và khu vực quản trị theo quyền |
| `/management/projects?workspace=:workspaceId` | Danh sách project lọc theo workspace |
| `/management/settings`, `/management/settings/:settingsSection` | Cài đặt và mục con |
| `/management/notifications`, `/management/notifications/:notificationId` | Thông báo |
| `/processing` | Trang mở đầu: chào mừng và Projects gần đây, không có sidebar |
| `/processing/new` | Tạo project, upload CSV và thêm thành viên qua API |
| `/processing/projects/:projectId` | Chi tiết project và các panel dataset |
| `/processing/projects/:projectId/upload`, `/analysis`, `/review`, `/results` | Các URL từng bước cũ chuyển hướng tới chi tiết project |

Đường dẫn chi tiết hiện tại có dạng `/processing/projects/prj-sales`. ID workspace có thể dùng để lọc danh sách qua query `?workspace=` tại `/management/projects`.

Dev và production đều đi qua `ProtectedRoute` cho Management, Processing và Dataset 3D, giữ URL đích hợp lệ khi đăng nhập. Không có entry mock 2D bỏ auth runtime. Đích mặc định sau đăng nhập là `/processing`. Processing và Home Management cùng dùng `UniverseHero` và `RecentProjects`; Management giữ các khối còn lại. Nút Tạo Project mở `/processing/new`; một dòng project mở trang Project hiện tại. `ManagementDataProvider` tải dữ liệu qua API cho phiên đăng nhập trực tuyến; lỗi API hiển thị lỗi/thử lại, không chuyển sang dữ liệu mẫu. Shopping Demo vẫn là luồng riêng.

**Upload và lưu kết quả:** Project chưa có dataset có nút Upload data theo quyền upload. Tệp CSV được gửi qua API, UI chờ server xác nhận và tải lại dữ liệu; lỗi giữ hộp thoại để thử lại. Mục Detection vẫn cần kết quả server xác nhận. `ConfirmedProjectResult` là biên tích hợp UI, không phải DTO backend: callback `save` chỉ được resolve sau khi đánh giá và kết quả được lưu. Đợt tích hợp này chưa nối API lưu đánh giá/xuất kết quả Detection. Tải CSV gốc trong Data View là thao tác riêng với tải kết quả xử lý.

**Hosting.** Cấu hình SPA fallback để URL giao diện như `/processing/projects/prj-sales` và `/processing/new` trả `index.html`. Giữ riêng đường dẫn API và tài nguyên tĩnh. Vite dev/preview hỗ trợ tải lại các route này.

**Layout và theme dùng chung:** `views/application/application-frame.tsx` giữ một UI session cho cả Management và Processing. Hai khu vực dùng `PreviewShell`/`PreviewTopbar`, cùng nền và token light/dark. Processing chỉ giữ header, không có sidebar hoặc nút thu gọn; nội dung dùng toàn bộ chiều ngang. Header Processing có lối về Quản lý và ngữ cảnh project thay cho bộ chọn phạm vi. Header có bộ chọn Sáng / Tối / Theo hệ thống trước chuông thông báo, dùng cùng lựa chọn với Settings → System → Color. Lựa chọn được lưu trên thiết bị khi storage khả dụng; nếu storage bị chặn, vẫn giữ trong phiên khi chuyển giữa hai khu vực nhưng không bảo đảm qua tải lại trang. Management giữ sidebar thu gọn; hai khu vực dùng chung menu tài khoản/thông báo/báo cáo.

### Bản đồ module frontend

| Module | Trách nhiệm | Tài liệu |
| --- | --- | --- |
| `app` | Entry, runtime, provider và router | [app](src/app/README.md) |
| `views` | Màn hình và state riêng của màn hình | [views](src/views/README.md) |
| `components` | UI cấp ứng dụng và các scene React Three Fiber | [components](src/components/README.md) |
| `hooks` | Nối state và thao tác vào React | [hooks](src/hooks/README.md) |
| `services` | Endpoint, mapping response, điều phối phiên và mock preview | [services](src/services/README.md) |
| `repositories` | Schema và thao tác draft IndexedDB | [repositories](src/repositories/README.md) |
| `sync` | Vị trí dự kiến cho điều phối đồng bộ | [sync](src/sync/README.md) |
| `lib` | HTTP, lỗi, cache và lưu phiên | [lib](src/lib/README.md) |
| `configs` | Cấu hình API và hạn mức draft | [configs](src/configs/README.md) |
| `types` | Hợp đồng TypeScript dùng chung qua tầng | [types](src/types/README.md) |
| `utils` | Helper thuần như đọc claim token | [utils](src/utils/README.md) |
| `graphics` | Model, geometry, vật liệu và render pass Three.js | [graphics](src/graphics/README.md) |
| `math` | Layout, đường nối, camera và parse CSV cho Workspace 3D | [math](src/math/README.md) |
| `assets` | Ảnh, logo và font | [assets](src/assets/README.md) |
| `__tests__` | Kiểm thử theo hành vi và tính năng | [__tests__](src/__tests__/README.md) |

### Thứ tự đọc theo tính năng

- **Đăng nhập.** Đọc `types/auth/auth.types.ts` để biết input/output, sau đó qua `services/auth/auth.service.ts`, `services/auth/session-coordinator.ts`, `app/context/auth-provider.tsx`, `hooks/auth/use-auth.ts`, `hooks/auth/use-login.ts` và `views/auth/login.view.tsx`. Khi submit, lời gọi bắt đầu ở view và đi xuống service. Khi có kết quả, snapshot mới đi qua provider để UI hoặc guard cập nhật.
- **Workspace 3D.** Đọc `types/workspace-3d/resource-map.types.ts`, `math/workspace-3d/resource-layout.ts`, `graphics/workspace-3d/connection-geometry.ts`, `components/graphics/workspace-3d/resource-scene.tsx` rồi `views/workspace-3d/workspace-3d.view.tsx` để lần từ cây tài nguyên tới mesh, nhãn và thao tác chọn.

### Phụ thuộc và vị trí đặt code

Trong bảng này, `A → B` nghĩa là **A import B**. Đây là các ví dụ đã đối chiếu trong source.

| Import hiện có | Lý do |
| --- | --- |
| `app/context/auth-provider.tsx` và `hooks/auth/use-auth.ts` → `hooks/auth/auth-context.ts` | Provider và hook dùng chung một context |
| `views/preview/preview-url.ts` → `services/preview/preview-route.ts` | View re-export helper URL dùng chung cho preview |
| `lib/axios-client.ts` → `configs/api.config.ts` | HTTP client đọc cấu hình đã kiểm |
| `configs/api.config.ts` → `lib/api-error.ts` | Config dùng định dạng lỗi chuẩn |
| `components/graphics/workspace-3d/resource-scene.tsx` → `math/workspace-3d/` | Scene dùng kết quả toán học để dựng đường và nhãn |

**Vị trí JSX.** Trong `src/`, dùng `.tsx` ở `app/`, `views/` và `components/`. `__tests__/` được dùng JSX để render UI trong test. File không viết JSX dùng `.ts`. Ví dụ hook `useAuth` dùng React nhưng vẫn là `.ts`.

**Chiều import.** `app` lắp runtime và giao diện. `views` ghép màn hình từ component và các tầng hỗ trợ. `components` không import `views` hoặc `app`. `hooks` không import tầng render. Các tầng xử lý và hạ tầng không import tầng UI hoặc hooks. `types` có thể import kiểu nội bộ và từ thư viện. `graphics` dùng Three.js và để phần React Three Fiber ở `components/graphics`.

`yarn lint` kiểm tra vị trí `.tsx` và các hướng import bị cấm trong source, gồm import và re-export tĩnh cùng lazy import dùng chuỗi đường dẫn cố định. Xem **Vị trí & phụ thuộc** và **Quy ước & bất biến** của tầng sở hữu trước khi thêm dependency.

**Quy tắc kiểu đã chốt.** Kiểu chỉ dùng trong một file đặt cạnh code sử dụng. Hợp đồng dùng chung qua các tầng đặt ở nhóm tương ứng trong `types/`. Ví dụ `Props` của `ResourceScene` đặt cạnh component, còn `ResourceLayout` dùng giữa math và graphics đặt trong `types/workspace-3d/`.

### Kiến trúc mục tiêu

~~~text
Route / Page
  → View / Component
      → Hook / Flow
          → Service → API client → Backend
          → Repository → IndexedDB
          → Sync coordinator (sau khi đủ contract backend)

Components/graphics → Graphics → Math
Components/graphics → phát selection callback về View
~~~

- Component không trực tiếp gọi Axios hoặc IndexedDB.
- Service không giữ UI state; repository quản lý lưu trữ/transaction.
- Session coordinator quản lý consent và refresh; không refresh âm thầm.
- Graphics không tự quyết định nghiệp vụ hoặc gửi request.
- Backend xác nhận quyền và kết quả thay đổi dữ liệu.

Chi tiết: [architecture](.agents/Structure/frontend-architecture-plan.md), [Foundation](.agents/frontend-delivery/foundation-spec.md), [Screen flow](.agents/frontend-delivery/screen-flow.md), [Shared UI](.agents/frontend-delivery/shared-ui.md).

## 5. Folder Structure

Cây dưới đây liệt kê các thư mục chính. Xem README từng module để tra file và trách nhiệm cụ thể.

~~~text
frontend/
├── public/                 # Static assets
├── src/
│   ├── app/
│   │   ├── constants/
│   │   ├── context/
│   │   ├── provider/        # Tổng hợp providers
│   │   ├── pages/
│   │   │   ├── private/
│   │   │   └── public/
│   │   ├── router/
│   │   ├── App.tsx
│   │   ├── app-runtime.ts
│   │   ├── application-bootstrap.tsx
│   │   ├── main.tsx
│   │   └── style.css
│   ├── assets/
│   ├── views/              # Màn hình theo domain
│   ├── components/         # UI component và scene JSX
│   ├── hooks/              # State và điều phối flow
│   ├── services/           # API theo domain
│   ├── repositories/      # IndexedDB
│   ├── sync/              # Hàng đợi và đồng bộ
│   ├── graphics/          # Model, geometry, shader và render pass Three.js
│   ├── math/              # Layout, camera, routing và CSV
│   ├── lib/               # Client dùng chung
│   ├── types/             # DTO và UI/local models
│   ├── configs/           # Cấu hình công khai
│   ├── utils/             # Helper thuần
│   └── __tests__/         # Suites Vitest theo tính năng
├── .agents/               # Rules, skills và plan nội bộ
├── README.md
├── AI-usage.md
├── package.json
├── yarn.lock
├── package-lock.json
└── vite.config.ts
~~~

Phân công chính: FE A phụ trách app/auth/user/workspace/project; FE B phụ trách dataset/visualization/graphics/math. Các phần còn lại chỉ định owner/reviewer trước batch. Xem [team workflow](.agents/frontend-delivery/team-workflow.md).

## 6. Installation / Run / Test

### Yêu cầu môi trường

- Môi trường đã dùng trong lần setup trước: Node **26.7.0**, Yarn **1.22.22**.
- Với Node khác, kiểm tra engine/peer dependency trước khi cài; không dùng tùy chọn bỏ kiểm tra engine để vượt lỗi.
- Yarn là công cụ chính. Giữ cả hai lockfile theo quyết định nhóm, nhưng dùng **yarn.lock** khi cài; không chạy npm install xen kẽ.

### Cài đặt và chạy local

Mở terminal tại thư mục **src/frontend** của repository:

~~~sh
yarn install --frozen-lockfile
yarn dev:cert
yarn dev
~~~

Dev server dùng `https://localhost:5173` và strict port. `yarn dev:cert` tạo certificate tự ký 30 ngày trong `certs/`, không ghi đè file có sẵn và không tự thêm trust vào trình duyệt. Trên macOS/Linux cần OpenSSL; trên Windows script mặc định gọi PowerShell (`pwsh`). Nếu có certificate đã được tin cậy, dùng `DEV_HTTPS_KEY` và `DEV_HTTPS_CERT` để chọn đường dẫn. Không commit certificate/private key. API dùng từ FE HTTPS cũng phải dùng HTTPS; cấu hình CORS của server cần chấp nhận origin FE. Thiếu certificate sẽ làm dev server không khởi động. Build không yêu cầu certificate; cấu hình E2E riêng không bật HTTPS.

### Build, lint và preview

~~~sh
yarn build
yarn lint
yarn preview
~~~

Build chạy TypeScript build và Vite production build. Preview phục vụ bản build để xem thử, không phải backend API hoặc cấu hình production hosting hoàn chỉnh.

### Test

Chạy `yarn test` để kiểm tra các suite frontend bằng Vitest, Testing Library và jsdom. Dùng [bản đồ test](src/__tests__/README.md) để chạy nhóm cụ thể. HTTP adapter giả và test DOM chỉ kiểm tra hành vi mô phỏng. Xác nhận API và WebGL cần môi trường tích hợp hoặc trình duyệt.

`yarn test:e2e` chạy Playwright với **API thật**, không dùng Shopping Demo hay mock HTTP. Vite E2E mở riêng `http://127.0.0.1:4173`; backend phải cho phép CORS từ origin này. Chỉ cấu hình công khai `VITE_API_BASE_URL`/`VITE_API_PREFIX` được đưa vào browser. Trong `.env.local` (không commit), khai báo `E2E_TEST_EMAIL` và `E2E_TEST_PASSWORD` của tài khoản thử; ca quản trị yêu cầu role `admin`. Hai biến này chỉ được đọc trong Node test runner. Thiếu credentials làm ca đăng nhập fail rõ ràng, không skip hoặc fallback sang dữ liệu giả.

Suite kiểm tra guard, login/reload, logout và cờ thu hồi phiên phía BE, giao diện Admin, theme, tạo/đổi tên workspace/project và upload/đọc lại CSV giả lập. Lifecycle chỉ tạo tài nguyên `E2E-<uuid>` và dọn đúng ID do ca đó nhận về, theo thứ tự dataset → project → workspace; có workspace chứng minh thao tác xóa không ảnh hưởng bản ghi khác. Đây là xóa mềm theo API, không phải purge file R2. Chỉ chạy trên backend thử nghiệm đã được phép ghi/xóa dữ liệu thử. Không tái sử dụng refresh token cũ, đổi mật khẩu hoặc đăng ký tài khoản.

Không có credentials vẫn có thể chạy riêng `yarn test:e2e tests/e2e/auth/anonymous-guard.spec.ts`. Bộ Vitest mock giữ nguyên cho timeout, lỗi mạng và race. Live E2E tắt trace để tránh lưu password/token trong network trace; screenshot lỗi và report nằm trong `.agents/testing-e2e/`. Không đưa artifact có thông tin tài khoản lên public.

### Quản lý phiên nền tảng

Runtime ghép session storage và coordinator. AuthProvider theo dõi trạng thái phiên để cập nhật guard và UI. Access token mặc định hết hạn sau 15 phút; backend quản lý refresh session 7 ngày mặc định hoặc 30 ngày khi bật **Ghi nhớ đăng nhập**. Frontend dùng thời điểm hết hạn từ JWT/`expires_at`; với session cũ chưa lưu refresh expiry, runtime đặt mặc định 7/30 ngày tương ứng. Network, timeout hoặc 5xx giữ credential trong sessionStorage, chuyển sang `local-limited` và không xóa IndexedDB. Khi access token hết hạn, request được chặn; dữ liệu cục bộ vẫn đọc được trong refresh session còn hiệu lực. Khi backend mới sẵn sàng, hộp thoại xác nhận hiện có cho phép refresh qua URL mới. Hết refresh session, refresh bị từ chối, tài khoản bị vô hiệu hoặc người dùng từ chối thì cần đăng nhập lại. Xem [lib](src/lib/README.md) để tra cách lưu phiên và [services](src/services/README.md) để theo dõi điều kiện gia hạn.

ManagementDataProvider truyền response online từ allowlist vào kho IndexedDB theo account + EnvironmentId + request key ổn định. Network/timeout/5xx hoặc request bị session gate tạm dừng sẽ dùng response khớp cache; giao diện cho biết thời điểm lưu và lúc chuyển sang fallback. Cache miss hiển thị rõ dữ liệu chưa có bản lưu. HTTP 401 xóa cache của account/environment; 403/404 xóa dữ liệu liên quan tới tài nguyên. Cache đọc bao phủ workspace, project, dataset, issue, notification, profile, overview, schema, records, stats/chart, analysis, feedback và PDF report. Offline write queue không nhận mọi request: allowlist gồm upload CSV vào project đã tồn tại, PATCH tên/mô tả workspace/project có `expectedVersion`, và DELETE workspace/project/dataset. Tạo project, chạy analysis và các thao tác ghi khác không tự được queue. Command chỉ được trả receipt sau khi commit vào IndexedDB; replay tuần tự dưới Web Lock và hiển thị trạng thái trong bảng hàng đợi.

### Cấu hình địa chỉ API

[configs](src/configs/README.md) mô tả `VITE_API_BASE_URL` và `VITE_API_PREFIX`. Runtime tạo `ApiTargetManager` từ cấu hình ban đầu; mọi client production lấy target mới nhất từ manager ở đầu mỗi request. Nếu cấu hình ban đầu sai, bootstrap chuyển lỗi tới UI. Chỉ preview Workspace 3D dành cho dev được chọn trước khi nạp runtime chính.

Sau khi nạp plugin (cần khởi động lại một Vite server cũ một lần), đổi tunnel trong cùng phiên Vite bằng lệnh dưới đây từ thư mục `src/frontend`:

~~~powershell
.\scripts\dev-with-swagger.ps1 -SwaggerUrl "https://<tunnel-moi>.trycloudflare.com/api/v1/docs" -EnvironmentId "qa-main"
~~~

Nếu Vite của project chưa chạy, script khởi động Vite trên port 5180 và không tự mở tab. Nếu đã có Vite chạy với plugin này, chạy lệnh từ terminal thứ hai: script gửi cấu hình qua control endpoint loopback; tab đang mở nhận custom HMR event, còn Vite không restart. `ApiTargetManager` tạm dừng worker đã đăng ký, hủy/đánh dấu request cũ, kiểm tra `/health/ready` và hồ sơ `/users/me`, rồi mới công bố URL/revision mới. Nếu access token hết hạn, hộp thoại gia hạn chờ người dùng xác nhận; refresh và kiểm tra hồ sơ chạy trên URL mới. Worker chỉ resume sau khi phiên hợp lệ. Request bị hủy có thể cần người dùng gửi lại; manager không tự đưa mọi request vào queue. Khi xác minh thất bại, target cũ vẫn được giữ, queue vẫn pause và UI hiện lỗi để thử lại. `EnvironmentId` phải khớp với Vite đang chạy; đổi URL chỉ đổi origin, giữ prefix `/api/v1` và namespace. `PreviousSwaggerUrl` được chấp nhận tương thích với lệnh cũ; namespace ổn định làm migration theo hostname không cần thiết. Terminal chờ tab tối đa 210 giây; browser chỉ gửi ACK thành công sau kiểm tra backend và phiên. Endpoint chỉ bind `127.0.0.1`, yêu cầu token cục bộ, từ chối request có `Origin`, và chỉ nhận Swagger HTTPS đúng dạng `/api/v1/docs` hoặc `/api/v1/docs-json`.

Khi tích hợp backend, cần chốt config/client và CORS theo đúng origin FE. Không đưa token, API key, password hoặc secret backend vào cấu hình FE; không in nội dung **.env** vào chat/tài liệu. Xem [AI usage](AI-usage.md).

## 7. Example Input / Output

### Ví dụ theo hiện trạng source

**Đầu vào.** Chạy dev server và mở `/management/workspaces`.

**Kết quả theo source.** Người dùng chưa đăng nhập được chuyển qua luồng đăng nhập. Khi có phiên trực tuyến, provider tải workspace/project từ API. Thao tác ghi chờ server xác nhận; API lỗi không được thay bằng fixture.

### Bản nháp upload và hàng đợi đồng bộ

**Input:** chọn CSV ở dialog upload của project hoặc wizard tạo project.

**Output:** file và SHA-256 được commit vào IndexedDB trước khi UI cho upload; draft có thể khôi phục sau reload. Upload vào project đã tồn tại được ghi queue-first và giữ file đến khi ACK được lưu bền rồi đối chiếu dataset/account/project/tên/kích thước/hash. Wizard tạo project vẫn dùng luồng riêng, không queue upload khi lệnh tạo project chưa được xác nhận. PATCH tên/mô tả workspace/project giữ `expectedVersion`; delete workspace/project/dataset cũng vào allowlist. Queue giữ thứ tự, tự chạy khi online, backend hồi phục, đổi API target hoặc theo chu kỳ; tab dùng Web Locks để tránh gửi đồng thời. Upload mất phản hồi chuyển `uncertain`; chỉ xác nhận tự động khi backend mới cung cấp SHA-256 khớp, nếu không sẽ `blocked` để kiểm tra thay vì gửi lại.

## 8. Results

| Hạng mục | Kết quả và giới hạn bằng chứng |
|---|---|
| Structure và dependency | Đã setup; version nằm trong manifest và yarn.lock |
| Bootstrap, auth và router | Có entry, provider, guard và màn hình đăng nhập trong source |
| 3D và draft | Có preview Workspace 3D, route review Dataset 3D và repository draft trong source |
| Kiểm chứng | Xem README từng module để chọn test và biết phạm vi mô phỏng |

## 9. Limitations

- Preview 2D và Workspace 3D dùng dữ liệu mẫu. Dataset 3D đang phục vụ review hình ảnh.
- Một số contract backend còn thiếu hoặc cần đối chiếu DTO/service và response thật; xem ngày/bằng chứng trong contract audit, không coi snapshot cũ là xác nhận server hiện tại.
- Chưa chốt toàn bộ UX, permission presentation, data 3D mapping và tiêu chí hiệu năng.
- Queue replay đã nối cho allowlist. Request `uncertain` không tự gửi lại; upload cần response dataset có SHA-256 để tự đối chiếu sau khi mất phản hồi. Nếu response hiện tại không có hash, queue chuyển sang `blocked` để người dùng kiểm tra. Queue cần Web Locks; trình duyệt không hỗ trợ Web Locks sẽ từ chối nhận command vào queue và giữ nguyên draft để người dùng không tưởng request đã được lưu.

## 10. Future Improvements

1. Review quyết định UX/UI còn chờ; thống nhất interface cho hai người FE.
2. Kiểm thử đăng nhập, gia hạn và đăng xuất với backend được phép.
3. Tích hợp module có API thực tế, kèm validation, permission và error handling.
4. Xác nhận data mapping và hiệu năng 3D với dữ liệu/thiết bị mục tiêu.
5. Đối chiếu DTO dataset backend để xác nhận tên trường SHA-256 và giữ upload bất định ở trạng thái cần kiểm tra nếu backend không cung cấp hash; không retry mù.
6. Bổ sung Transformation/Version/Export theo contract backend được xác nhận, không tự tạo endpoint.
7. Thêm automated tests, browser/API integration, accessibility, CI và deployment checks.

Mọi thay đổi quan trọng theo workflow review và human confirmation của dự án. Quy định sử dụng AI: [AI-usage.md](AI-usage.md).

## Luồng từ thao tác đến giao diện

```text
Người dùng → router/màn hình → component, hook hoặc provider
  → service hoặc xử lý cục bộ
  → nếu gọi API: api.request → Axios → HTTP request → backend → HTTP response
  → dữ liệu hoặc lỗi → state của phiên, store hoặc màn hình → giao diện
```

Đăng nhập gửi `{ email, password }` tới `POST /api/v1/auth/login`. Axios nhận phản hồi, API client lấy `data` từ envelope, AuthService chuyển dữ liệu thành model phiên, coordinator lưu phiên và router điều hướng. CSV cục bộ và thao tác camera cập nhật giao diện qua state của màn hình. Xem [danh mục chức năng và đường đi](src/README.md).
