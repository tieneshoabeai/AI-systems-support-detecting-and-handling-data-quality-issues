# views

## 1. Mục đích

Hiển thị màn hình và giữ state tương tác của màn hình. Gửi request, quản lý phiên, tính geometry và ghi IndexedDB được giao cho tầng tương ứng.

## 2. Vị trí & phụ thuộc

`app/router/app-router.tsx` mở login và Dataset 3D. `app/main.tsx` lazy load các entry preview dev. View ghép [hooks](../hooks/README.md), [services](../services/README.md), [graphics](../graphics/README.md), math và asset.

## 3. Public API

- `LoginView()`, `Dataset3DView()`, `Workspace3DPreview()`, `Preview2DEntry()` trả JSX. Login cần AuthProvider và router. Dataset 3D cần router và trình duyệt hỗ trợ WebGL để thấy scene.
- `ResourceMap(props: ResourceMapProps)` nhận resources, ID chọn, callback chọn/mở dataset và `localFileMode?`. `Workspace3DView` nhận `resources`, `onOpenDataset`, `localFileMode?`. `LocalCsvViewer({ document: LocalCsvDocument, onClose: () => void })` render bảng mẫu.
- `HomePreviewView` và `UniverseHero` nhận `UniverseHeroProps` với scene tùy chọn. `WorkspacesPreviewView({ workspaceId? })`, `ProjectsPreviewView()`, `ProjectWorkspaceView({ projectId, scene? })`, `NotificationsPreviewView({ notificationId })`, `SettingsPreviewView({ section })` trả JSX theo phạm vi preview. `WorkspaceCard({ workspace, selected, view })` và `ProjectCard({ project, selected, view })` render thẻ cho view tương ứng.
- `PreviewSessionProvider({ routeIds, navigateUniverse?, children })` cấp model tương tác. Các export con về menu, card, dialog, icon và URL là điểm dùng trong preview, xem file tương ứng ở mục 5 để tra props và kiểu trả về.

## 4. Cách dùng (ví dụ)

```tsx
import { LocalCsvViewer } from './views/workspace-3d/local-csv-viewer'

export const CsvExample = () => (
  <LocalCsvViewer
    document={{ id: 'demo', name: 'demo.csv', delimiter: ',', headers: ['id'], rows: [['1']] }}
    onClose={() => console.log('Đã đóng')}
  />
)
```

Render bằng React/Vite. Viewer hiện cột `id` và một dòng `1`. Nút đóng gọi callback.

## 5. Cấu trúc thư mục

**Khi thêm code.** Màn hình, bố cục và state riêng của màn hình nằm trong thư mục tính năng dưới `views/`. Đưa logic gọi API sang [services](../services/README.md) và geometry sang [graphics](../graphics/README.md).

### Auth, Dataset 3D và Workspace 3D

- [auth/login.view.tsx](auth/login.view.tsx) — form login, panel đăng ký thử và nhánh review kính.
- [auth/login-glass.css](auth/login-glass.css) — bố cục và nền login.
- [dataset-3d/dataset-3d.view.tsx](dataset-3d/dataset-3d.view.tsx) — legend, focus cube, tách và chọn part.
- [dataset-3d/dataset-3d.css](dataset-3d/dataset-3d.css) — canvas, overlay và bảng chi tiết part.
- [workspace-3d/local-csv-viewer.tsx](workspace-3d/local-csv-viewer.tsx) — bảng CSV và phân trang.
- [workspace-3d/preview-resources.ts](workspace-3d/preview-resources.ts) — cung cấp hai danh sách node mẫu. Chuyển CSV thành node thuộc [math](../math/workspace-3d/local-csv.ts).
- [workspace-3d/workspace-3d-preview.tsx](workspace-3d/workspace-3d-preview.tsx) — entry preview Workspace 3D.
- [workspace-3d/workspace-3d.view.tsx](workspace-3d/workspace-3d.view.tsx) — resource map, scope, camera command và file cục bộ.
- [workspace-3d/workspace-3d.css](workspace-3d/workspace-3d.css) — bố cục map, nhãn và fallback.

### Preview 2D

- [home-2d.view.tsx](preview/home-2d.view.tsx) — Home và Universe hero.
- [notifications-2d.view.tsx](preview/notifications-2d.view.tsx) — danh sách và chi tiết thông báo.
- [preview-card.ts](preview/preview-card.ts) — logic trình bày/thao tác thẻ.
- [preview-data.ts](preview/preview-data.ts) — dữ liệu và cấu hình hiển thị suy ra từ fixture.
- [preview-entry.tsx](preview/preview-entry.tsx) — đọc route và ghép màn hình preview.
- [preview-menu.ts](preview/preview-menu.ts) — các mục menu theo loại đích.
- [preview-session-context.ts](preview/preview-session-context.ts) — context tương tác.
- [preview-session.tsx](preview/preview-session.tsx) — provider và UI dùng chung của phiên preview.
- [preview-url.ts](preview/preview-url.ts) — re-export helper điều hướng.
- [preview.css](preview/preview.css) — style preview 2D.
- [project-workspace-2d.view.tsx](preview/project-workspace-2d.view.tsx) — chi tiết project trong workspace.
- [projects-2d.view.tsx](preview/projects-2d.view.tsx) — danh sách và thẻ project.
- [settings-2d.view.tsx](preview/settings-2d.view.tsx) — hồ sơ, bảo mật, thiết bị và tùy chọn thông báo.
- [workspaces-2d.view.tsx](preview/workspaces-2d.view.tsx) — danh sách, thẻ và chi tiết workspace.

### Thành phần cục bộ trong `preview/components`

- [notification-center.tsx](preview/components/notification-center.tsx) — panel thông báo.
- [preview-context-menu.tsx](preview/components/preview-context-menu.tsx) — menu thao tác theo vị trí.
- [preview-dialog.tsx](preview/components/preview-dialog.tsx) — dialog đổi tên và xóa.
- [preview-icons.tsx](preview/components/preview-icons.tsx) — SVG icon preview.
- [preview-popover.tsx](preview/components/preview-popover.tsx) — khung popover dùng lại.
- [preview-primitives.tsx](preview/components/preview-primitives.tsx) — badge, tab, phân trang, card và biểu đồ nhỏ.
- [preview-shell.tsx](preview/components/preview-shell.tsx) — khung điều hướng và nội dung.
- [preview-surface.ts](preview/components/preview-surface.ts) — helper định vị surface.
- [preview-toaster.tsx](preview/components/preview-toaster.tsx) — thông báo kết quả và dismiss.
- [preview-topbar.tsx](preview/components/preview-topbar.tsx) — thanh trên, chọn scope và hành động nhanh.
- [project-info-card.tsx](preview/components/project-info-card.tsx) — thông tin project.
- [project-members-dialog.tsx](preview/components/project-members-dialog.tsx) — quản lý thành viên project.
- [project-wizard.tsx](preview/components/project-wizard.tsx) — wizard tạo project.
- [report-center.tsx](preview/components/report-center.tsx) — luồng báo cáo giả lập.
- [workspace-create-dialog.tsx](preview/components/workspace-create-dialog.tsx) — form tạo workspace.
- [workspace-detail-dialogs.tsx](preview/components/workspace-detail-dialogs.tsx) — chỉnh thông tin và thành viên workspace.

`.gitkeep` giữ thư mục.

## 6. Luồng hoạt động

Login nhập dữ liệu → hook submit → snapshot cập nhật → guard chuyển trang. Preview đọc URL → chọn view và scope → cập nhật mock store qua hook. Dataset 3D nhận thao tác legend/canvas → lưu theme focus hoặc part → truyền state về scene. Workspace 3D kiểm tra cây, tính layout, truyền lệnh camera và mở bảng CSV theo dataset cục bộ.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `localFileMode` | `false` | Cho phép luồng file cục bộ khi bật ở caller |
| Dataset `detached`, `legendOpen` | `false` | Khởi đầu ở góc tổng quan và legend thu gọn |
| `?glassDebug=` (dev) | Tắt | Các mode `sdf`, `normal`, `offset` để xem shader |
| `?glassThickness=` (dev) | Giá trị scene | Ghi đè độ dày kính, clamp 0–200 |
| `?quality=low`, `?overlay=1` | Tắt | Chế độ nhẹ và overlay đối chiếu ở nhánh hỗ trợ |
| `?data=` (preview dev) | `demo` | Chọn bộ fixture |

## 8. Quy ước & bất biến

Giữ thao tác API qua hook/service. Entry preview 2D và Workspace 3D tách khỏi runtime auth. Giữ fallback và điều hướng bàn phím khi scene lỗi. Trong Dataset 3D, chế độ tách và focus cube là hai luồng khác nhau.

## 9. Test & debug

Chạy `yarn test src/__tests__/auth/auth-flow.test.tsx src/__tests__/preview src/__tests__/workspace-3d src/__tests__/dataset-3d/dataset-3d-view.test.tsx`. Review bằng `/auth/login?preview=display-base`, `/#/preview/workspaces`, `/preview/workspaces-3d` và `/workspaces/3d-dataset`.

## 10. Giới hạn & lưu ý

Preview 2D/Workspace 3D chỉ chạy dev. Thao tác preview dùng fixture và form đăng ký login hiện là UI thử. Route Dataset 3D tạm bỏ guard để review. Test DOM có mock scene và không chứng minh render WebGL.

## 11. Hướng cải tiến

Hoàn tất các luồng production theo contract đã duyệt và khôi phục guard Dataset 3D trước release. Đề xuất kiểm tra focus cube trên thiết bị cảm ứng thật.
