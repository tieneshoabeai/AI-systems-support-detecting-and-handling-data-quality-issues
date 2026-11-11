# AI-systems-support-detecting-and-handling-data-quality-issues — Frontend

Frontend của dự án **AI-systems-support-detecting-and-handling-data-quality-issues** — **Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề về chất lượng dữ liệu**. Tên tiếng Anh trong README gốc: **AI Systems Support Detecting and Handling Data Quality Issues**. Tài liệu này dành cho nhóm 2 người phát triển FE, người review và người cần cài/chạy project.

**Trạng thái hiện tại.** Frontend đã có luồng đăng nhập và quản lý phiên, khu vực Management 2D dùng dữ liệu mẫu, khung route AI Data Processing, Workspace 3D dành cho dev, trang review Dataset 3D và repository bản nháp IndexedDB. Management và Processing chưa nối API nghiệp vụ.

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
| Auth | Đăng nhập/đăng ký, quản lý phiên, gia hạn theo xác nhận người dùng | Có login, phiên và gia hạn. Panel đăng ký là UI thử |
| User | Xem và cập nhật hồ sơ | Service đọc hồ sơ phiên. Settings preview dùng mock |
| Workspace | Danh sách, chi tiết và quản lý workspace/thành viên theo quyền | Có khung bảo vệ theo phiên và màn hình preview dùng fixture |
| Project | Quản lý project trong workspace | Có các màn hình preview dùng fixture |
| Dataset | Upload, metadata, schema, đổi tên và xóa | Có repository draft cục bộ và luồng thử CSV trong Workspace 3D |
| Visualization | Cursor grid, thống kê cột, sửa ô trực tuyến và ranh giới data 3D | Có trang review Dataset 3D với nguồn điểm mẫu |
| Transformation | Chuẩn bị, xem trước và thực thi phép biến đổi | Có plan; contract backend còn cần xác nhận |
| Version / Lineage | Graph, truy vết và kiểm tra toàn vẹn; history/rollback khi có contract | Có plan; một số phần chờ backend |
| Export | Preview, download và save-as-new khi có API phù hợp | Có plan; contract backend còn cần xác nhận |

Các phần dùng chung gồm Foundation, Screen flow và Shared UI. Xem [master plan](.agents/frontend-delivery/master-plan.md) và [contract audit](.agents/frontend-delivery/modules/00-contract-audit.md) để phân biệt API đã kiểm kê, nguồn static và phần chưa kiểm thử.

## 4. System Architecture

### Luồng đang chạy

~~~text
index.html → src/app/main.tsx
  ├─ /management, /processing hoặc URL 2D cũ ở dev → WorkbenchEntry (dữ liệu mẫu, không khởi tạo auth runtime)
  ├─ /preview/workspaces-3d ở dev → Workspace 3D
  └─ Luồng chính → Application → providers → BrowserRouter → AppRouter → guard/view
~~~

`/workspaces` đi qua guard trước khi render `layout.tsx`. `/workspaces/3d-dataset` tạm bỏ guard để review giao diện theo ghi chú trong [AppRouter](src/app/router/app-router.tsx).

### Route Management và AI Data Processing

React Router điều hướng bằng pathname; URL 2D mới không dùng `/preview` hoặc hash.

| Route | Nội dung |
| --- | --- |
| `/management` | Home của khu vực quản lý |
| `/management/workspaces`, `/management/workspaces/:workspaceId` | Danh sách và chi tiết workspace |
| `/management/projects`, `/management/projects/:projectId` | Danh sách và chi tiết project |
| `/management/projects?workspace=:workspaceId` | Danh sách project lọc theo workspace |
| `/management/settings`, `/management/settings/:settingsSection` | Cài đặt và mục con |
| `/management/notifications`, `/management/notifications/:notificationId` | Thông báo |
| `/processing` | Trang mở đầu: chào mừng và Projects gần đây, không có sidebar |
| `/processing/new` | Khung thông tin project mới, chờ kết nối dịch vụ tạo |
| `/processing/projects/:projectId/upload`, `/analysis`, `/review`, `/results` | Các URL từng bước cũ chuyển hướng tới `/management/projects/:projectId` |

Ví dụ URL cũ `/preview/home#/preview/projects/ws-acme/prj-sales` được chuyển hướng bằng `replace` tới `/management/projects/prj-sales`. Workspace không nằm trong định danh URL của project. ID hiện hỗ trợ chữ, số, `_` và `-`; workspace ở query là bộ lọc danh sách.

Production đi qua `ProtectedRoute` cho cả hai khu vực và giữ URL đích hợp lệ khi đăng nhập. Đích mặc định sau đăng nhập được cấu hình là `/processing`; đây chỉ là điều hướng, không thay đổi hoặc chứng minh kết nối Login/API. Dev cho phép review UI mẫu khi API chưa sẵn sàng. Processing và Home Management cùng dùng `UniverseHero` và `RecentProjects`; Management giữ các khối còn lại. Nút Tạo Project trên Processing mở `/processing/new`, còn một dòng project mở trang Project hiện tại với Tổng quan, Data View, Data Analysis, Detection. Không có luồng upload/phân tích/đánh giá riêng theo từng trang nữa.

**Upload và lưu kết quả:** Project chưa có dataset có nút Upload data và hộp chọn tệp trên thiết bị; upload thật chưa nối dịch vụ nên không gửi tệp hoặc gắn dataset giả. Mục Detection chuẩn bị khu vực lưu kết quả, hiện không khả dụng vì chưa có kết quả server xác nhận. `ConfirmedProjectResult` là biên tích hợp UI, không phải DTO backend: chỉ truyền vào khi có kết quả thật; callback `save` chỉ được resolve sau khi cả đánh giá và kết quả đã lưu trong hệ thống. Biểu mẫu bắt buộc 1–5 sao và nội dung không trắng, giữ nội dung để thử lại khi lưu lỗi, chặn gửi trùng khi đang chờ. Tải file là tùy chọn và chỉ được bật sau khi lưu thành công, nếu có dịch vụ download. Chưa tự tạo endpoint đánh giá hoặc nối API upload/lưu/xuất; quy tắc nơi lưu khi bỏ qua workspace vẫn chờ chốt.

**Hosting:** cần cấu hình SPA fallback: request giao diện như `/management/projects/prj-sales` và `/processing/new` phải trả `index.html`; giữ riêng đường dẫn API và static assets. Vite dev/preview hỗ trợ tải lại các route này. Repository chưa xác định nền tảng hosting production nên chưa có cấu hình triển khai cho một nhà cung cấp cụ thể.

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
│   │   ├── pages/
│   │   │   ├── private/
│   │   │   └── public/
│   │   ├── router/
│   │   ├── App.tsx
│   │   ├── layout.tsx
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
yarn dev
~~~

Mở URL **Local** mà Vite hiển thị trong terminal. Cổng thường dùng là 5173; nếu có tiến trình khác sử dụng, kiểm tra URL thực tế thay vì giả định cổng cố định.

### Build, lint và preview

~~~sh
yarn build
yarn lint
yarn preview
~~~

Build chạy TypeScript build và Vite production build. Preview phục vụ bản build để xem thử, không phải backend API hoặc cấu hình production hosting hoàn chỉnh.

### Test

Chạy `yarn test` để kiểm tra các suite frontend bằng Vitest, Testing Library và jsdom. Dùng [bản đồ test](src/__tests__/README.md) để chạy nhóm cụ thể. HTTP adapter giả và test DOM chỉ kiểm tra hành vi mô phỏng. Xác nhận API và WebGL cần môi trường tích hợp hoặc trình duyệt.

### Quản lý phiên nền tảng

Runtime ghép session storage và coordinator. AuthProvider theo dõi trạng thái phiên để cập nhật guard và UI. Coordinator điều phối khôi phục, gia hạn và kết thúc phiên. Xem [lib](src/lib/README.md) để tra cách lưu phiên và [services](src/services/README.md) để theo dõi điều kiện gia hạn.

### Cấu hình địa chỉ API

[configs](src/configs/README.md) mô tả `VITE_API_BASE_URL` và `VITE_API_PREFIX`. Luồng chính đọc cấu hình khi tạo runtime. Nếu cấu hình sai, bootstrap chuyển lỗi tới UI. Hai nhánh preview dev được chọn trước khi nạp runtime chính.

Khi tích hợp backend, cần chốt config/client và CORS theo đúng origin FE. Không đưa token, API key, password hoặc secret backend vào cấu hình FE; không in nội dung **.env** vào chat/tài liệu. Xem [AI usage](AI-usage.md).

## 7. Example Input / Output

### Ví dụ theo hiện trạng source

**Đầu vào.** Chạy dev server và mở `/management/workspaces`.

**Kết quả theo source.** Entry preview chọn màn hình Workspaces và hiển thị fixture mẫu. Thao tác trong preview cập nhật mock store. Xem [views](src/views/README.md) để tra URL, các bộ dữ liệu và lệnh test.

### Ví dụ luồng mục tiêu — chưa triển khai

**Input:** chọn file dữ liệu trong project khi upload đã được triển khai và được backend hỗ trợ.

**Output mục tiêu:** server xác nhận thì cập nhật dataset chính thức; nếu chỉ commit bản nháp IndexedDB trong phạm vi được duyệt thì UI ghi rõ “Đã lưu cục bộ — chờ đồng bộ”. Không tạo response JSON/định danh giả rồi mô tả như đã thực thi.

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
- Repository có schema và quota cục bộ. Luồng replay và đối soát server chờ contract đồng bộ.

## 10. Future Improvements

1. Review quyết định UX/UI còn chờ; thống nhất interface cho hai người FE.
2. Kiểm thử đăng nhập, gia hạn và đăng xuất với backend được phép.
3. Tích hợp module có API thực tế, kèm validation, permission và error handling.
4. Xác nhận data mapping và hiệu năng 3D với dữ liệu/thiết bị mục tiêu.
5. Nối bản nháp IndexedDB vào luồng upload sau khi chốt contract chống trùng, đối soát và xử lý xung đột.
6. Bổ sung Transformation/Version/Export theo contract backend được xác nhận, không tự tạo endpoint.
7. Thêm automated tests, browser/API integration, accessibility, CI và deployment checks.

Mọi thay đổi quan trọng theo workflow review và human confirmation của dự án. Quy định sử dụng AI: [AI-usage.md](AI-usage.md).
