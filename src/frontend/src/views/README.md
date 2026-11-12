# views

## 1. Mục đích

Hiển thị màn hình và giữ state tương tác của màn hình. Gửi request, quản lý phiên, tính geometry và ghi IndexedDB được giao cho tầng tương ứng.

## 2. Vị trí & phụ thuộc

`app/router/app-router.tsx` mở login và Dataset 3D. `app/main.tsx` lazy load các entry preview dev. View ghép [hooks](../hooks/README.md), [services](../services/README.md), [graphics](../graphics/README.md), math và asset.

## 3. Public API

Project detail chỉ dùng `/processing/projects/:projectId`; `/management/projects` giữ trang danh sách, route chi tiết Management đã bỏ. `ProjectWorkspaceView` dùng shell Processing không sidebar, header/nav toàn chiều ngang và `Dataset3DView embedded` lấp đầy phần còn lại. Chế độ embedded giữ tương tác scene nhưng ẩn header/mô tả demo; chưa nối dữ liệu thật của Project vào mô hình.

Project sở hữu `focus: CubeFocus | null`, truyền vào `Dataset3DView` cùng `onFocusChange`: nav và click khối dùng chung lựa chọn (overview/violet, data-view/blue, data-analysis/cyan, detection/orange). Về góc tổng quan xóa lựa chọn; tách mô hình khóa nav. `colorMode` nhận theme đã resolve từ UI session, cập nhật nền/fog/bloom/nhãn và đường nối mà không remount mô hình/camera. Light dùng nền trắng xanh và sàn/lưới sáng; standalone Dataset 3D mặc định dark.

Panel module chỉ mở từ `onFocusComplete` sau camera + reveal, không dùng timeout. Chọn module khác đóng panel và thay lựa chọn chờ; reduced motion báo hoàn tất ngay khi snap. Panel rộng 40% scene trên desktop, gần toàn chiều ngang trên mobile. Detection đặt phần đánh giá ở cuối panel; tải kết quả nằm riêng cạnh logo header. Project chưa nhận `ConfirmedProjectResult` thì không bật tải/đánh giá. Breadcrumb và Dataset cùng một hàng, không còn khung thông tin Project lớn hoặc nút Quay lại.

Kính panel Project được render bằng `project-glass-pass.ts` sau output màu của scene. Pass lấy mẫu scene động theo biên DOM đo bằng ResizeObserver/resize/scroll, dùng chung profile thấu kính lồi và hàm refract với Login trong `graphics/convex-lens.glsl.ts`. Nội dung HTML không bị khúc xạ. Thuộc tính `data-refractive` tắt nền/blur CSS khi pass được gắn, được dọn khi đóng/unmount; CSS còn lại là fallback khi WebGL không chạy. Panel chỉ khúc xạ nội dung canvas, không lấy mẫu các overlay HTML.

Thân kính mô phỏng Regular: tán xạ bằng mẫu đĩa cố định, giới hạn dải sáng theo theme và độ sáng nền, cạnh giữ khúc xạ/phản sáng có hướng. Không thay đổi pixel ngoài vùng kính hay pipeline màu của scene. Phần Đánh giá dùng cùng bề mặt, không lồng thêm một panel kính. Đây là mô phỏng web, không phải vật liệu hệ thống iOS; chưa đo hiệu năng trên thiết bị thật.

`project-glass-motion.ts` giữ chung tiến trình hình học cho HTML và shader: sau focus hoàn tất, kính morph 250 ms từ nút nav bằng rounded-box SDF kết hợp smooth union; đóng đảo từ tiến trình hiện tại. Nav nằm trong stage, canvas phủ cả vùng nav với camera view offset để giữ khung hình scene. Shader cập nhật DOM và uniforms trong cùng frame; fallback dùng RAF riêng. Nội dung chỉ hiện và nhận tương tác khi kính mở xong. Keyboard và reduced motion chuyển ngay.

Vật liệu có blur đĩa, saturation/luminance thích ứng, khúc xạ rìa, specular theo pointer, Schlick Fresnel, bóng viền trong và tách màu nhẹ. Pointer/touch nhấn làm sáng và nén nhẹ bằng spring (stiffness 100, damping 10); không chặn thao tác mặc định hay capture pointer. `?glassPerf=1` chỉ ở dev đo CPU submit của composer sau 60 frame làm nóng, lấy 60 mẫu; số này không đại diện GPU time hoặc FPS trên điện thoại.

`HolographicBloomPass` giữ thứ tự màu trước khi thêm kính Project: tone mapping/chuyển màu base trước, cộng bloom sau. Không tone-map tổng base+bloom lần nữa. Cùng một ảnh đầu ra được dùng khi panel đóng hoặc mở; pass kính chỉ thay đổi pixel trong panel. Giữ nguyên cường độ ánh sáng/vật liệu và cấu hình bloom riêng của light/dark trong lần sửa pipeline này.

- `LoginView()`, `Dataset3DView()`, `Workspace3DPreview()`, `ManagementArea()` và `ProcessingView()` trả JSX. Management/Processing cần React Router; WorkbenchRoutes bọc cả hai bằng `ApplicationFrame` để dùng một UI session/theme. Login cần AuthProvider và router. Dataset 3D cần router và trình duyệt hỗ trợ WebGL để thấy scene.
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

`application/application-frame.tsx` ghép provider và CSS chung; `preview/components/preview-shell.tsx` nhận `area` và `context` để dùng chung header/theme. Management có sidebar; Processing chỉ có header và nội dung rộng toàn trang, không render sidebar hoặc nút thu gọn. `preview/components/topbar-color-mode.tsx` mở bộ chọn Sáng/Tối/Theo hệ thống trên header; `processing/processing.css` chỉ định dạng nội dung và dùng token theme hiện có, không tạo nền hay palette riêng.

Processing và Home Management dùng chung `preview/components/universe-hero.tsx` và `recent-projects.tsx`; bảng giữ sắp xếp, phân trang, menu và đường dẫn project như Home hiện có. Processing thêm nút Tạo Project ở tiêu đề bảng. `project-data-actions.tsx` cung cấp hộp chọn tệp và khu vực lưu kết quả của Project; `result-review-dialog.tsx` kiểm tra sao/nội dung và đợi callback lưu, không tự gọi endpoint. Trạng thái dataset mẫu không đủ để bật lưu: cần kết quả đã được server xác nhận.

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

Management dùng các màn 2D hiện có tại `/management`; `/processing` là trang mở đầu chào mừng và danh sách project. URL 2D cũ chuyển hướng tới Management; các URL Processing từng bước cũ về trang Project tương ứng. Dev cho review không cần API session; production yêu cầu đăng nhập. Dữ liệu quản lý vẫn là fixture. Upload, lưu đánh giá/kết quả và tải file thật chưa được tích hợp. Workspace 3D preview chỉ chạy dev, form đăng ký login hiện là UI thử. Route Dataset 3D tạm bỏ guard để review. Test DOM có mock scene và không chứng minh render WebGL. Xem [bảng route và yêu cầu hosting](../../README.md#route-management-và-ai-data-processing).

## 11. Hướng cải tiến

Hoàn tất các luồng production theo contract đã duyệt và khôi phục guard Dataset 3D trước release. Đề xuất kiểm tra focus cube trên thiết bị cảm ứng thật.
