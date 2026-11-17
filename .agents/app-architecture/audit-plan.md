# Audit và target design cho src/app

Trạng thái: đã audit; chờ duyệt plan trước khi sửa source.

## 1. Baseline kiểm tra hiện tại

- TypeScript src theo tsconfig.app.json: 0 diagnostics.
- ESLint src/app: 15 file, 0 errors, 0 warnings.
- yarn test startup.test.tsx auth-flow.test.tsx workbench-return-target.test.ts preview-entry.test.tsx: 4 file và 39 test đạt. Đây là test chọn lọc, không phải toàn suite FE.
- yarn build: đạt; còn cảnh báo chunk >500 kB. Build sinh dist như script hiện có; không đổi dependencies.
- Dependency graph TypeScript: không thấy vòng static liên quan app; không thấy production module ngoài app import ngược vào app. Test có import trực tiếp và vi.mock entry app.
- Chưa kiểm tra WebGL/giao diện trực tiếp. Không dùng baseline 1171 lỗi cũ để mô tả trạng thái hiện tại.

## 2. Current architecture tree

```text
app/
  main.tsx
  application-bootstrap.tsx
  app-runtime.ts
  App.tsx
  app-providers.tsx
  layout.tsx
  design-tokens.css
  style.css
  README.md
  context/
    auth-provider.tsx
    index.ts
    .gitkeep
  guards/
    protected-route.tsx
    public-only-route.tsx
    index.ts
  router/
    app-router.tsx
    workbench-routes.tsx
    return-target.ts
    index.ts
  constants/.gitkeep
  pages/private/.gitkeep
  pages/public/.gitkeep
  provider/...temp
```

app/index.ts đã được xóa ở lượt trước theo quyết định của user. provider/...temp là file 0 byte, không có implementation.

## 3. Responsibility mapping và findings

| File / nhóm | Trách nhiệm thực tế | Đánh giá |
| --- | --- | --- |
| main.tsx | Tạo React root, render skeleton, chọn dev preview/workbench hoặc Application bằng dynamic import, hiển thị lỗi load | Cần giữ entry tách biệt, không gộp bootstrap vào import tĩnh |
| application-bootstrap.tsx | Tạo singleton query client/runtime, giữ lỗi cấu hình, ghép BrowserRouter và providers, cleanup HMR | Khác main: chỉ khởi tạo nhánh application sau khi được tải |
| app-runtime.ts | Factory inject HTTP/auth/health/users/draft ports; quản lý retain/dispose | Khác bootstrap: định nghĩa cách lắp dependency, không tạo instance khi import |
| App.tsx | Ghép AppRouter và SessionRenewalDialog | Nhỏ nhưng có vai trò root composition; giữ |
| app-providers.tsx | Ghép QueryClientProvider -> AuthProvider | Provider composition, không trùng implementation AuthProvider |
| context/auth-provider.tsx | Đồng bộ coordinator với React, subscribe snapshot, restore session, focus/pageshow/visibility, lịch hết hạn, expose actions | Đây là individual Provider; context object thật nằm ở hooks/auth/auth-context.ts |
| guards/protected-route.tsx | Guard private và SessionStatus fallback | Tách SessionStatus để PublicOnlyRoute không phụ thuộc implementation guard khác |
| guards/public-only-route.tsx | Guard public, lọc return target, xử lý session-ended state | Giữ hành vi; không chuyển logic phiên từ service vào guard |
| router/app-router.tsx | App routes, redirect entry, focus heading, lazy Dataset3D | Giữ route và focus hiện tại |
| router/workbench-routes.tsx | Routes workbench dùng chung production/dev; có wrapper BrowserRouter riêng cho dev | Hai BrowserRouter không tự động là lồng router: main chọn entry loại trừ nhau |
| router/return-target.ts | Hàm thuần lọc đích quay về sau login | Giữ direct entry; không đi qua barrel export AppRouter vì guard cũng dùng helper này |
| layout.tsx | Trang workspace cụ thể: lời chào, trạng thái phiên, logout và nội dung placeholder; không render children/Outlet | Tên Layout không phản ánh trách nhiệm; đề xuất chuyển sang views/workspace/workspace.view.tsx |
| design-tokens.css | Font, palette, radius, motion tokens và z-index toàn ứng dụng | Global app styles, giữ nội dung và thứ tự tải |
| style.css | Reset/global rules lẫn login/dialog/workspace selectors và reduced-motion | Đang trộn ownership; đợt này chỉ tổ chức vị trí, chưa chia selectors/đổi cascade |
| context/index.ts, guards/index.ts, router/index.ts | Public barrels hiện không có consumer import tới chúng | Không có nhu cầu app root; local barrels có thể phục vụ composition khi giới hạn export đúng |
| constants/, pages/private/, pages/public/, provider/ | Chỉ placeholder, chưa có code, không thấy import/route/dynamic reference | Đề xuất xóa placeholder thay vì viết code lấp đầy |
| README.md | Mô tả luồng và public entries | Có đường dẫn/nội dung sẽ lỗi thời sau move; phải cập nhật cùng đợt |

Không thấy duplicate implementation rõ ràng giữa main/bootstrap/runtime/providers. Không kết luận xóa file chỉ vì ít dòng hoặc chưa có import tĩnh.

## 4. Proposed architecture tree

```text
app/
  main.tsx                         # DOM entry, chọn nhánh tải
  application-bootstrap.tsx        # Khởi tạo instance và ghép application
  app-runtime.ts                  # Factory/lifecycle dependencies
  App.tsx                         # Root UI composition
  README.md
  providers/
    app-providers.tsx              # Composition
    auth-provider.tsx              # Individual Provider
    index.ts                      # Chỉ export AppProviders nếu consumer cần
  guards/
    protected-route.tsx
    public-only-route.tsx
    session-status.tsx             # Fallback dùng chung của guards/router
    index.ts
  router/
    app-router.tsx
    workbench-routes.tsx
    return-target.ts               # Entry helper thuần, độc lập barrel router
    index.ts                      # Chỉ public AppRouter
  styles/
    design-tokens.css
    global.css                    # Nội dung style.css cũ, giữ cascade

views/
  workspace/
    workspace.view.tsx            # layout.tsx cũ, không đổi UI
    index.ts                      # Public entry của trang
```

Không tạo thư mục runtime/bootstrap chỉ để phân loại hai file đã có tên và trách nhiệm rõ. Không tạo app/index.ts hoặc src/index.ts. Không đưa AuthContext từ hooks vào app, vì hook sẽ phải import ngược tầng app.

## 5. Keep / Move / Merge / Rename / Remove / Create mapping

| Action | Nguồn | Đích / kết quả |
| --- | --- | --- |
| Keep | main.tsx, application-bootstrap.tsx, app-runtime.ts, App.tsx | Giữ file và export contract; chỉ cập nhật import cần thiết |
| Move | app-providers.tsx | providers/app-providers.tsx |
| Move | context/auth-provider.tsx | providers/auth-provider.tsx |
| Replace barrel | context/index.ts | providers/index.ts export AppProviders; AuthProvider là nội bộ composition |
| Move + rename | layout.tsx (default Layout) | ../views/workspace/workspace.view.tsx (named WorkspaceView) |
| Move | design-tokens.css | styles/design-tokens.css; sửa relative font URL |
| Move + rename | style.css | styles/global.css; giữ nguyên thứ tự/nội dung selectors |
| Create by extraction | SessionStatus trong protected-route.tsx | guards/session-status.tsx; giữ nguyên JSX/message |
| Keep + narrow exports | router/index.ts | Chỉ AppRouter; return-target tiếp tục entry trực tiếp |
| Keep/update | guards/index.ts | Named exports cho hai guards và SessionStatus |
| Create | views/workspace/index.ts | Export WorkspaceView; không gom route lazy khác |
| Remove | constants/.gitkeep, pages/private/.gitkeep, pages/public/.gitkeep, provider/...temp, context/.gitkeep | Không giữ thư mục không có nhu cầu; file có nội dung mới trước lúc sửa phải được đánh giá lại |
| Update docs | app/README.md | Cấu trúc, lifecycle ownership, test commands và entry exceptions |
| Merge | Không có | Chưa có bằng chứng cần gộp implementation |

Move layout sang views là một thay đổi source nằm ngoài app nhưng phục vụ trực tiếp việc phân định trách nhiệm app. Đây là phần cần user duyệt rõ trong plan; không refactor các view khác.

## 6. Dependency changes và rủi ro

1. Application -> providers/index -> AppProviders -> AuthProvider; AppRuntime tiếp tục import type trực tiếp từ app-runtime.
2. App -> router/index -> AppRouter -> guards; PublicOnlyRoute -> router/return-target trực tiếp. Không import helper từ router/index để tránh tạo vòng router/guard.
3. Router -> views/workspace; views/workspace chỉ dùng hooks, assets và styles có sẵn, không import app.
4. Di chuyển Provider chỉ đổi consumer trong bootstrap/provider composition và test import AppProviders. Các test mock application-bootstrap, main và WorkbenchEntry giữ nguyên entry.
5. main giữ dynamic imports và điều kiện DEV/demo; không đưa factory runtime hoặc bootstrap vào barrel providers/router.
6. CSS giữ thứ tự import: tokens -> global -> login CSS như source hiện tại. Đổi URL font theo độ sâu thư mục. Không tự xóa selector bị nghi là thừa.
7. Duy trì StrictMode retain/release microtask, timer/listener cleanup, captured-token clients và HMR disposal. Không đưa khởi tạo runtime vào render hoặc effect mới.
8. Hạn chế: không chứng minh runtime behavior bằng graph/type-check; cần test routing/provider và browser smoke sau move.

## 7. Findings ngoài phạm vi và behavior phải giữ

- /workspaces/3d-dataset hiện không bọc ProtectedRoute, có TODO review hình ảnh. Không tự bật guard trong refactor kiến trúc; cần quyết định hành vi riêng.
- Dev workbench bypass auth theo nhánh main, production qua Application/guard; đây là behavior hiện có, không coi là duplicate app cần gộp.
- ProcessingProject đọc fixture store để quyết định project tồn tại: app route đang gắn vào demo model. Báo cáo coupling, không đổi business/data source đợt này.
- main tải login-glass.css trước lazy Application; có thể xem xét tối ưu sau, không tự thay đổi thời điểm CSS trong audit/refactor này.
- application-bootstrap khởi tạo singleton lúc evaluate module. Nếu đổi sang factory/React state sẽ đổi thời điểm lifecycle; không làm trong plan này.
- Không mở rộng thành kiến trúc features/shared hoặc đổi thư viện.

## 8. Migration và validation plan

1. Kiểm tra lại baseline và working tree ngay trước implementation; bảo toàn chỉnh sửa user.
2. Dùng apply_patch move provider/composition, cập nhật consumer và test import liên quan; kiểm tra type/lint.
3. Extract SessionStatus, giới hạn public exports, kiểm tra graph runtime không có vòng mới.
4. Chuyển workspace view, cập nhật route/import/font path/styles mà không đổi nội dung UI hoặc thứ tự tải.
5. Xóa placeholder sau kiểm tra nội dung/dependency lại; cập nhật README.
6. Chạy TypeScript cả app/node config, lint toàn FE hoặc tối thiểu các file ảnh hưởng với baseline toàn FE, yarn build và suite auth/foundation/preview/workspace entry. Bổ sung kiểm tra thiếu root và dev workbench/demo nếu coverage hiện tại thiếu và thay đổi chạm các nhánh đó.
7. Browser smoke: login, return target, /workspaces, management/processing dev và production, unknown route, auth config error; kiểm tra font/CSS sau move. WebGL screenshot không được suy ra từ DOM test.
8. Mở review diff trong Codex, báo kết quả cụ thể và giới hạn kiểm chứng. Không commit/reset/revert.

Chưa triển khai bất kỳ mapping source nào ở trên. User cần duyệt target tree và việc move workspace view ra views trước khi implementation.

