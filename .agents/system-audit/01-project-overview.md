# Chương I. Tổng quan và khởi tạo Frontend

## Cập nhật hiện hành — 19/11/2026

HEAD `f017663` + working tree, ghép TaiFE@48d1ba6. Hiện đã có Google login, delete account, Dataset detail/records/PII/delete, complete project và supplement issue ở source. Processing recent và provider theo route đã thay đổi. Không còn coi social login/analysis caller là NOT FOUND toàn bộ; /processing/new local vẫn disabled.

Nguồn hiện hành: [revalidation](audit/frontend-api-revalidation.md), [API inventory](audit/api-inventory.md), [testing](06-software-testing.md). **Các mục snapshot 17/11 dưới đây được giữ làm lịch sử; khi có khác biệt, mục cập nhật này và revalidation thay thế nhận định cũ.**


## 1. Bài toán, người dùng và phạm vi

README gốc mô tả nền tảng hỗ trợ phát hiện/xử lý vấn đề chất lượng dữ liệu. Trong FE hiện tại, người dùng đăng nhập, tổ chức workspace/project, nhập CSV, xem tài nguyên và tương tác với các vùng trực quan dữ liệu. Các màn hình cho thông báo, cài đặt và báo cáo sự cố dùng chung application frame.

“Analyst” và “admin” xuất hiện trong kiểu auth và mapper response. Đây là các role mà FE chấp nhận từ API; không suy ra từ tên role rằng mọi hành trình quản trị đã có UI. Workspace/project còn có quyền hiển thị theo owner/member/viewer, map trong management store. Quyền trên FE giúp điều khiển UI, không thay thế kiểm tra quyền trên API.

Nguồn: `README.md`, `src/frontend/README.md`, `src/frontend/src/types/auth/auth.types.ts`, `src/frontend/src/services/auth/auth.service.ts`, `src/frontend/src/services/management/management.store.ts`.

| Nhóm tính năng | Hiện trạng FE |
|---|---|
| Login, restore, logout, consent renewal | Có service HTTP và session coordinator; có test mock |
| Workspace/project/member management | Có API store được provider inject vào UI |
| Tạo project kèm CSV | Có giữ File thật, POST tạo project, upload multipart và thêm thành viên |
| Notifications/profile/issues | Có API caller và mapping tại management store |
| Dataset 3D | Có scene tương tác; sự hiện diện của scene không chứng minh dữ liệu phân tích thật |
| Shopping detection | Demo DEV dùng fixture/timer và sessionStorage |
| Đăng ký, quên mật khẩu, social login | UI có control nhưng chưa thấy hành trình API hoàn chỉnh từ các control hiện tại |
| Tự đồng bộ upload drafts | NOT FOUND trong `src/frontend/src/sync/` |

Đối chiếu UX chưa nối: `src/frontend/src/views/auth/login/login.view.tsx` giữ draft đăng ký, form ngăn submit mặc định và ghi “Chưa mở đăng ký tài khoản”; `sections/auth-provider-buttons.tsx` thông báo provider chưa khả dụng. Checkbox ghi nhớ và nút quên mật khẩu chưa cho thấy caller nghiệp vụ ở view đó.

## 2. Tech stack thực tế

Version dưới đây là **khai báo trong manifest**, không tự đồng nhất với bản đang cài trên mọi máy.

| Thành phần | Khai báo | Vai trò / file bằng chứng |
|---|---|---|
| React / React DOM | `^19.3.1` | Render UI; `src/frontend/package.json`, `src/app/main.tsx` dưới FE |
| TypeScript | `~6.0.3` | Strict typecheck; `tsconfig.app.json`, `tsconfig.node.json` |
| Vite | `^8.3.4` | Dev/build; `vite.config.ts` |
| React Compiler | Babel preset/plugin | `vite.config.ts` có React plugin và `reactCompilerPreset()` |
| React Router | `8.5.0` | Routes/guards; `src/frontend/src/app/router/` |
| Axios | `1.20.0` | HTTP adapter; `src/frontend/src/lib/axios-client.ts` |
| TanStack Query | `5.104.5` | Provider/cache policy; `src/frontend/src/lib/query-client.ts` |
| Dexie | `4.4.7` | IndexedDB upload drafts; `src/frontend/src/repositories/datasets/` |
| Three.js / React Three Fiber | `0.186.1` / `9.8.2` | Graphics/UI rendering bridge |
| Styling | CSS, CSS Modules, custom properties | `src/frontend/src/styles/`, `views/preview/`, component CSS |
| Vitest / coverage-v8 | `5.0.5` | Unit/component tests và coverage config |
| Testing Library / jsdom / fake-indexeddb | Có trong devDependencies | DOM và local persistence tests |
| Playwright | `1.61.1` | Browser E2E config; chưa chạy trong lượt mới |
| openapi-typescript | `7.13.0` | Sinh type từ Swagger snapshot |
| dotenv | `18.0.10` | Generator đọc cấu hình riêng; không chạy trong audit |
| Package manager | `yarn@1.22.22` | `packageManager` trong `src/frontend/package.json` |

Không tìm thấy dependency Tailwind/MUI trong manifest FE hiện tại. Không mô tả React Flow, Redux hoặc Zustand như thư viện FE đang dùng khi chưa có bằng chứng. Source management sử dụng external store và React Context/useSyncExternalStore.

## 3. Khởi tạo và execution order

`src/frontend/index.html` là đầu vào HTML; `src/frontend/src/app/main.tsx` tìm `#root`, hiển thị skeleton trước và dynamic import bootstrap. Trong DEV, đúng path `/preview/workspaces-3d` có entry riêng. Các route còn lại vào `application-bootstrap.tsx`.

Bootstrap tạo QueryClient, tạo runtime trong try/catch và đưa lỗi cấu hình vào provider. AppProviders bọc QueryClientProvider và AuthProvider; BrowserRouter đưa điều hướng vào App/AppRouter. AuthProvider restore session; guard chỉ cho vào frame khi trạng thái phù hợp.

Đây là composition root (nơi ghép các dependency), không phải mỗi component tự tạo client/session. Một ngoại lệ đáng ghi nhận là ManagementDataProvider tự tạo client/store cho data management theo phiên, thay vì lấy management service từ AppRuntime.

## 4. Cấu hình môi trường

| Tên cấu hình đọc từ source | Ý nghĩa | Bằng chứng |
|---|---|---|
| `VITE_API_BASE_URL` | HTTP/HTTPS server origin, không chứa prefix path | `src/frontend/src/configs/api.config.ts` |
| `VITE_API_PREFIX` | Prefix path ghép với origin; từ chối traversal/query/hash | Cùng file |
| `VITE_SWAGGER_URL` | URL đặc tả dùng bởi generator | `src/frontend/scripts/generate-swagger-types.mjs` |
| `import.meta.env.DEV` | Chặn bật shopping demo/preview/debug ở production branch | `src/frontend/src/mocks/shopping-trends/demo-mode.ts`, `src/app/main.tsx` |

Không đọc hoặc công bố giá trị cấu hình cục bộ. Timeout API mặc định 30000 ms. Việc parse config chấp nhận cả HTTP và HTTPS là hiện trạng; enforcement HTTPS production ở hosting/network chưa xác minh.

## 5. Lệnh đã có và môi trường chạy

Các lệnh thực hiện từ `src/frontend/`; đây là mô tả script, không phải tuyên bố đã chạy tất cả:

```text
yarn dev            → vite
yarn build          → tsc -b && vite build
yarn lint           → eslint .
yarn test           → vitest run
yarn test:coverage  → vitest run --coverage
yarn test:e2e       → playwright test
yarn preview        → vite preview
yarn gen:types      → node scripts/generate-swagger-types.mjs
```

Repo đã có source FE: không tạo project mới bằng template. Khi tái lập máy khác, cài dependency theo manifest/lockfile và chính sách dự án; audit này không cài thêm. FE có cả `yarn.lock` và `package-lock.json`; manifest chọn Yarn, chưa chứng minh cả hai lockfile tương đương.

Dev server phục vụ module cho phát triển; production build tạo static assets. `vite preview` dùng xem build trên máy, không là bằng chứng cấu hình hosting production. Chương VII phân tích riêng quá trình này.

Sơ đồ stack: [tech-stack.mmd](diagrams/tech-stack.mmd). Inventory chi tiết: [tech-stack-inventory.md](audit/tech-stack-inventory.md).
