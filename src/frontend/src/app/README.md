# app

## 1. Mục đích

Là điểm lắp ráp ứng dụng. Tầng này chọn entry, tạo runtime, gắn provider và điều hướng. Xử lý HTTP, lưu draft và render màn hình thuộc các tầng tương ứng.

## 2. Vị trí & phụ thuộc

`index.html` nạp `main.tsx`. App ghép [lib](../lib/README.md), [services](../services/README.md), [repositories](../repositories/README.md) và [views](../views/README.md). Hook auth và dialog đọc context do app cấp.

## 3. Public API

- `Application()`, `App()` (default) và `AppRouter()` trả về cây JSX. `AppRouter` cần React Router và Auth context.
- `createAppRuntime(options: RuntimeOptions): AppRuntime` nhận `clearSessionCache` bắt buộc, tùy chọn `client`, `storage`, `database`, `now`. Trả `coordinator`, `drafts`, `retain()` và `dispose()`. Cấu hình API sai hoặc gọi `retain` sau khi đóng runtime có thể ném `ApiError`.
- `AppProviders({ queryClient, runtime, configurationError, children })` và `AuthProvider({ runtime, configurationError?, children })` trả về JSX. `AuthContext` có kiểu `AuthContextValue | null`.
- `ProtectedRoute({ children })`, `PublicOnlyRoute({ children })` và `SessionStatus()` chọn nội dung hoặc chuyển hướng theo snapshot. `Layout()` (default) render khung workspace.
- `validReturnTarget(value: unknown): string` chấp nhận `/workspaces` và route hợp lệ dưới `/management`, `/processing`; đích không hợp lệ rơi về `/processing`. Root của người đã đăng nhập cũng trỏ tới `/processing`; không thay đổi logic kết nối API.
- `WorkbenchRoutes({ protect })` đăng ký route 2D chính thức và chuyển hướng URL cũ. `WorkbenchEntry()` bọc BrowserRouter cho review UI ở dev. Production luôn truyền `protect=true` từ AppRouter.
- Các route Management/Processing nằm dưới `ApplicationFrame` (tầng views), giữ chung phiên UI/theme qua `Outlet`. Guard vẫn bao bên ngoài; việc dùng chung giao diện không thay đổi xác thực hay kết nối API.

## 4. Cách dùng (ví dụ)

```ts
import { validReturnTarget } from './app/router/return-target'

console.log(validReturnTarget('/workspaces?tab=recent')) // /workspaces?tab=recent
console.log(validReturnTarget('https://example.test')) // /processing
```

Chạy trong ngữ cảnh TypeScript dưới `src`. Để đi từ entry thật, chạy `yarn dev` và mở `/`.

## 5. Cấu trúc thư mục

**Khi thêm code.** Ghép dependency trong `app-runtime.ts`, đặt provider tại `context/`, quy tắc truy cập tại `guards/` và khai báo đường dẫn tại `router/`. Phần dựng màn hình đặt ở [views](../views/README.md).

- [main.tsx](main.tsx) — tạo React root, chọn entry chính hoặc preview dev.
- [application-bootstrap.tsx](application-bootstrap.tsx) — lắp runtime, query client và router, giữ lỗi cấu hình để UI hiển thị.
- [App.tsx](App.tsx) — component gốc ghép router ứng dụng.
- [app-providers.tsx](app-providers.tsx) — ghép QueryClientProvider và AuthProvider.
- [app-runtime.ts](app-runtime.ts) — ghép HTTP, phiên, draft, vòng đời retain/release.
- [layout.tsx](layout.tsx) — khung workspace và thao tác phiên.
- [AuthContext](../hooks/auth/auth-context.ts) — context dùng chung giữa provider và hook, được khai báo ở `hooks/auth`.
- [context/auth-provider.tsx](context/auth-provider.tsx) — nối coordinator với React và vòng đời trình duyệt.
- [guards/protected-route.tsx](guards/protected-route.tsx) — giới hạn route theo phiên, hiển thị trạng thái chờ.
- [guards/public-only-route.tsx](guards/public-only-route.tsx) — điều hướng người đã đăng nhập khỏi route công khai.
- [router/app-router.tsx](router/app-router.tsx) — danh sách route, lazy load Dataset 3D, xử lý 404 và focus.
- [router/return-target.ts](router/return-target.ts) — lọc đích quay về sau đăng nhập.
- [design-tokens.css](design-tokens.css) — font và biến giao diện dùng chung.
- [style.css](style.css) — style nền và UI ứng dụng.

Các `.gitkeep` ở `constants`, `context`, `pages/private`, `pages/public` và `router` chỉ giữ thư mục.

## 6. Luồng hoạt động

`index.html` → `main.tsx` → nhánh preview nếu URL khớp và đang dev. Nhánh còn lại nạp `Application` → providers → router → guard/view. AuthProvider giữ runtime, khôi phục phiên và đăng ký lắng nghe snapshot. Khi đổi phase, guard và view render lại.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `import.meta.env.DEV` | Do Vite cấp | Cho phép nhánh preview 2D và Workspace 3D |
| `VITE_API_BASE_URL`, `VITE_API_PREFIX` | Bắt buộc với runtime mặc định | Tạo cấu hình HTTP cho luồng chính |
| `RuntimeOptions.now` | Đồng hồ hệ thống | Đồng hồ của phiên và draft |

## 8. Quy ước & bất biến

Chọn preview trước khi nạp composition auth. Provider sở hữu vòng đời runtime, còn `dispose()` đóng tài nguyên. Giữ cache phiên và client đã gắn token theo đúng phiên khi đổi tài khoản.

## 9. Test & debug

Chạy `yarn test src/__tests__/foundation/startup.test.tsx src/__tests__/auth/auth-flow.test.tsx`. Kiểm `/`, `/auth/login`, `/workspaces` và một URL không tồn tại. Preview dev có `/#/preview/workspaces` và `/preview/workspaces-3d`.

## 10. Giới hạn & lưu ý

Management và khung Processing dùng URL chính thức `/management`, `/processing`. Dev cho review không cần runtime API; production đi qua guard. Các màn này vẫn chưa nối API nghiệp vụ. Workspace 3D preview chỉ ở dev. `/workspaces/3d-dataset` đang tạm bỏ `ProtectedRoute` để review hình ảnh. Các test bootstrap/auth mô phỏng transport. Xem bảng URL và yêu cầu SPA fallback trong [README frontend](../../README.md#route-management-và-ai-data-processing).

## 11. Hướng cải tiến

Khôi phục `ProtectedRoute` cho Dataset 3D trước release theo TODO trong router, rồi xác nhận hành vi truy cập với phiên hợp lệ và phiên vắng mặt.
