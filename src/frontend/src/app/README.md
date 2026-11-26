# app

## 1. Mục đích

Là điểm lắp ráp ứng dụng. Tầng này chọn entry, tạo runtime, gắn provider và điều hướng. Xử lý HTTP, lưu draft và render màn hình thuộc các tầng tương ứng.

## 2. Vị trí & phụ thuộc

`index.html` nạp `main.tsx`. App ghép [lib](../lib/README.md), [services](../services/README.md), [repositories](../repositories/README.md) và [views](../views/README.md). Hook auth và dialog đọc context do app cấp.

## 3. Public API

- `Application()`, `App()` (default) và `AppRouter()` trả về cây JSX. `AppRouter` cần React Router và Auth context.
- `createAppRuntime(options: RuntimeOptions): AppRuntime` nhận `clearSessionCache` bắt buộc, tùy chọn `client`, `storage`, `database`, `now`. Trả `coordinator`, `drafts`, `retain()` và `dispose()`. Cấu hình API sai hoặc gọi `retain` sau khi đóng runtime có thể ném `ApiError`.
- `AppProviders({ queryClient, runtime, configurationError, children })` và `AuthProvider({ runtime, configurationError?, children })` trả về JSX. `AuthContext` có kiểu `AuthContextValue | null`.
- `ProtectedRoute({ children })`, `PublicOnlyRoute({ children })` và `SessionStatus()` chọn nội dung hoặc chuyển hướng theo snapshot.
- `validReturnTarget(value: unknown): string` chấp nhận route hợp lệ dưới `/management`, `/processing`; đích không hợp lệ rơi về `/processing`. Hai URL đã gỡ `/workspaces` và `/workspaces/3d-dataset` hiển thị 404 và không được dùng làm đích sau đăng nhập. Dataset 3D được nhúng trong trang project `/processing/projects/:projectId`.
- `WorkbenchRoutes()` đăng ký route 2D chính thức và chuyển hướng URL cũ. Các route Management/Processing luôn yêu cầu phiên, không có cờ bỏ guard. `WorkbenchEntry()` chỉ ghép BrowserRouter và vẫn cần AuthProvider từ caller.
- Các route Management/Processing nằm dưới `ApplicationFrame` (tầng views), giữ chung phiên UI/theme qua `Outlet`. Guard vẫn bao bên ngoài; việc dùng chung giao diện không thay đổi xác thực hay kết nối API.

```ts
import { validReturnTarget } from './app/router/return-target'

console.log(validReturnTarget('/management/projects?workspace=ws-acme')) // /management/projects?workspace=ws-acme
console.log(validReturnTarget('https://example.test')) // /processing
```

Chạy trong ngữ cảnh TypeScript dưới `src`. Để đi từ entry thật, chạy `yarn dev` và mở `/`.

## 5. Cấu trúc thư mục

**Khi thêm code.** Ghép dependency trong `app-runtime.ts`; `context/` chứa AuthProvider implementation, `provider/` tổng hợp providers, `pages/public` và `pages/private` chứa page entry theo chính sách phiên. Quy tắc truy cập đặt tại `guards/`, route tại `router/`, đường dẫn cấp ứng dụng tại `constants/`. UI implementation vẫn ở [views](../views/README.md).

- [main.tsx](main.tsx) — tạo React root, chọn entry chính hoặc preview dev.
- [application-bootstrap.tsx](application-bootstrap.tsx) — lắp runtime, query client và router, giữ lỗi cấu hình để UI hiển thị.
- [App.tsx](App.tsx) — component gốc ghép router ứng dụng.
- [provider/app-providers.tsx](provider/app-providers.tsx) — ghép QueryClientProvider và AuthProvider.
- [app-runtime.ts](app-runtime.ts) — ghép HTTP, phiên, draft, vòng đời retain/release.
- `pages/public/login-page.tsx`, `pages/public/not-found-page.tsx` — entry login và 404, tái sử dụng UI hiện có.
- `pages/private/*-page.tsx` — entry Management, Processing, Project và Shopping Records; router áp guard trước khi render. Các entry workspace và Dataset 3D cũ không còn được đăng ký trong router.
- `constants/routes.ts` — đường dẫn login; route helper nghiệp vụ vẫn ở services.
- `index.ts` — public API runtime/providers, không export module bootstrap có side effects. Lazy pages dùng entry riêng thay vì gom qua barrel tổng.
- [AuthContext](../hooks/auth/auth-context.ts) — context dùng chung giữa provider và hook, được khai báo ở `hooks/auth`.
- [context/auth-provider.tsx](context/auth-provider.tsx) — nối coordinator với React và vòng đời trình duyệt.
- [guards/protected-route.tsx](guards/protected-route.tsx) — giới hạn route theo phiên, hiển thị trạng thái chờ.
- [guards/public-only-route.tsx](guards/public-only-route.tsx) — điều hướng người đã đăng nhập khỏi route công khai.
- [router/app-router.tsx](router/app-router.tsx) — danh sách route, xử lý entry và focus; các route nghiệp vụ và 404 được ghép qua WorkbenchRoutes.
- [router/return-target.ts](router/return-target.ts) — lọc đích quay về sau đăng nhập.
- [tokens.css](../styles/tokens.css) — font và biến giao diện dùng chung.
- [global.css](../styles/global.css) — reset, mặc định trang, focus và reduced motion.
- [style.css](style.css) — CSS component/màn hình chưa migrate; giữ tạm trong Phase 1.

Các folder chuẩn được giữ theo trách nhiệm. Đặt file trong `pages/private` không tự bảo vệ URL; `ProtectedRoute` thực thi chính sách truy cập.

## 6. Luồng hoạt động

`index.html` → `main.tsx` → `Application` → providers → router → guard/page → view. Management, Processing và Dataset 3D đi qua runtime auth cả dev lẫn production. AuthProvider giữ runtime, khôi phục phiên và đăng ký snapshot.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `import.meta.env.DEV` | Do Vite cấp | Cho phép công cụ preview Workspace 3D riêng; không bỏ auth cho Management/Processing/Dataset 3D |
| `VITE_API_BASE_URL`, `VITE_API_PREFIX` | Bắt buộc với runtime mặc định | Tạo cấu hình HTTP cho luồng chính |
| `RuntimeOptions.now` | Đồng hồ hệ thống | Đồng hồ của phiên và draft |

## 8. Quy ước & bất biến

Provider sở hữu vòng đời runtime, còn `dispose()` đóng tài nguyên. Giữ cache phiên và client đã gắn token theo đúng phiên khi đổi tài khoản. Unknown URL hiển thị 404 public; project không tồn tại trên route private chỉ được kiểm tra sau guard. `authenticated` và `local-limited` được phép vào private pages theo chính sách phiên hiện có.

## 9. Test & debug

Chạy `yarn test src/__tests__/foundation/startup.test.tsx src/__tests__/auth/auth-flow.test.tsx src/__tests__/auth/private-pages.test.tsx src/__tests__/auth/workbench-return-target.test.ts`. Kiểm `/`, `/auth/login`, `/processing`, `/processing/projects/:projectId` và 404 tại `/workspaces`, `/workspaces/3d-dataset`. URL 2D cũ `/#/preview/workspaces` chuyển về `/management/workspaces`.

## 10. Giới hạn & lưu ý

Management, Processing và Dataset 3D yêu cầu phiên cả dev lẫn production. `ApplicationFrame` gắn provider dữ liệu cho các route workbench. Route danh sách project gần đây và route chi tiết có phạm vi tải riêng. Với phiên trực tuyến, provider lấy dữ liệu từ API và hiển thị trạng thái tải hoặc lỗi. Workspace 3D preview riêng chạy trong dev. Test bootstrap/auth dùng transport và scene mô phỏng. Xem [bảng route](../../README.md#route-management-và-ai-data-processing).

`createAppRuntime` cấp client theo phiên và nối `getMe`, `logout`, `deleteMe` vào coordinator. `AuthProvider` đưa thao tác nhận phiên Google và xóa tài khoản tới UI.

## 11. Hướng cải tiến

Kiểm tra tích hợp với server thật và xác thực quyền truy cập tài nguyên ở backend khi các API nghiệp vụ được kết nối.

## Đường đi theo chức năng

| Chức năng | Caller → xử lý trong app → đầu ra |
| --- | --- |
| Khởi động và cấu hình | [main](main.tsx) → [bootstrap](application-bootstrap.tsx) → [runtime](app-runtime.ts) ghép client, services, coordinator, storage và draft repository → React tree đọc qua provider. |
| Khôi phục và cập nhật phiên | [AuthProvider](context/auth-provider.tsx) → coordinator restore/check → subscribe snapshot → các hook và guard render lại. |
| Login và callback Google | [AppRouter](router/app-router.tsx) → login view; provider nhận callback Google khi khởi động → coordinator → snapshot → [PublicOnlyRoute](guards/public-only-route.tsx) điều hướng. |
| Gia hạn, đăng xuất, xóa tài khoản | UI → Auth Context → coordinator → snapshot → guard và dialog cập nhật. |
| Trang riêng tư và URL cũ | [WorkbenchRoutes](router/workbench-routes.tsx) → route guard, lazy page và fallback tải. Route cũ qua helper navigation. Project Processing lấy ID từ URL trước khi mở view. |
| Đường dẫn không khớp | AppRouter chuyển các đường dẫn ngoài login và entry cho WorkbenchRoutes. Route wildcard ở WorkbenchRoutes hiển thị trang 404. |
