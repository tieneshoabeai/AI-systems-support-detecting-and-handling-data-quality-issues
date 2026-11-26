# views

## Phase 5 screen ownership

- `management/{home,workspaces,projects,notifications,settings}`: Management screens.
- `processing/home`: landing, danh sách project gần đây và form tạo project.
- `processing/project`: project workspace; its actions live in `sections/`.
- `processing/records`: shopping demo records.
- `auth/login`: login view; provider buttons and scene error boundary live in `sections/`.
- `workspace`: account workspace UI; `app/pages/private/workspace-page.tsx` only exports the view.

Private and public pages load their feature views directly.

Processing, Project, Workspaces hero and Dataset 3D own CSS Modules. Legacy DOM
classes remain for theme and scene integration. A local `screen` class gates each
selector through `:where()`, keeping the original specificity and media queries.
Result Review owns its rating styles independently of project actions.
Login CSS is shared with the eager loading skeleton; workbench shell/theme, shared
hero, shopping demo and Workspace 3D area CSS remain shared during this migration.
Do not delete those global styles until all consumers have migrated.

## 1. Mục đích

Hiển thị màn hình và giữ state tương tác của màn hình. Gửi request, quản lý phiên, tính geometry và ghi IndexedDB được giao cho tầng tương ứng.

## 2. Vị trí & phụ thuộc

`app/router/app-router.tsx` mở login và chuyển các đường dẫn workbench cho `WorkbenchRoutes`. Dataset 3D được nhúng trong trang chi tiết project. View ghép [hooks](../hooks/README.md), [services](../services/README.md), [graphics](../graphics/README.md), math và asset.

## 3. Public API

Project detail chỉ dùng `/processing/projects/:projectId`; `/management/projects` giữ trang danh sách, route chi tiết Management đã bỏ. `ProjectWorkspaceView` dùng shell Processing không sidebar, header/nav toàn chiều ngang và `Dataset3DView embedded` lấp đầy phần còn lại. Chế độ embedded giữ tương tác scene nhưng ẩn header/mô tả demo; chưa nối dữ liệu thật của Project vào mô hình.

Project sở hữu `focus: CubeFocus | null`, truyền vào `Dataset3DView` cùng `onFocusChange`: nav và click khối dùng chung lựa chọn (overview/violet, data-view/blue, data-analysis/cyan, detection/orange). Về góc tổng quan xóa lựa chọn; tách mô hình khóa nav. `colorMode` nhận theme đã resolve từ UI session, cập nhật nền/fog/bloom/nhãn và đường nối mà không remount mô hình/camera. Light dùng nền trắng xanh và sàn/lưới sáng; standalone Dataset 3D mặc định dark.

Panel module chỉ mở từ `onFocusComplete` sau camera + reveal, không dùng timeout. Chọn module khác đóng panel và thay lựa chọn chờ; reduced motion báo hoàn tất ngay khi snap. Panel rộng 40% scene trên desktop, gần toàn chiều ngang trên mobile. Detection đặt phần đánh giá ở cuối panel; tải kết quả nằm riêng cạnh logo header. Project chưa nhận `ConfirmedProjectResult` thì không bật tải/đánh giá. Breadcrumb và Dataset cùng một hàng, không còn khung thông tin Project lớn hoặc nút Quay lại.

Kính panel Project được render bằng `project-glass-pass.ts` sau output màu của scene. Pass lấy mẫu scene động theo biên DOM đo bằng ResizeObserver/resize/scroll, dùng chung profile thấu kính lồi và hàm refract với Login trong `graphics/common/convex-lens.glsl.ts`. Nội dung HTML không bị khúc xạ. Thuộc tính `data-refractive` tắt nền/blur CSS khi pass được gắn, được dọn khi đóng/unmount; CSS còn lại là fallback khi WebGL không chạy. Panel chỉ khúc xạ nội dung canvas, không lấy mẫu các overlay HTML.

Thân kính mô phỏng Regular: tán xạ bằng mẫu đĩa cố định, giới hạn dải sáng theo theme và độ sáng nền, cạnh giữ khúc xạ/phản sáng có hướng. Không thay đổi pixel ngoài vùng kính hay pipeline màu của scene. Phần Đánh giá dùng cùng bề mặt, không lồng thêm một panel kính. Đây là mô phỏng web, không phải vật liệu hệ thống iOS; chưa đo hiệu năng trên thiết bị thật.

`project-glass-motion.ts` giữ chung tiến trình hình học cho HTML và shader: sau focus hoàn tất, kính morph 250 ms từ nút nav bằng rounded-box SDF kết hợp smooth union; đóng đảo từ tiến trình hiện tại. Nav nằm trong stage, canvas phủ cả vùng nav với camera view offset để giữ khung hình scene. Shader cập nhật DOM và uniforms trong cùng frame; fallback dùng RAF riêng. Nội dung chỉ hiện và nhận tương tác khi kính mở xong. Keyboard và reduced motion chuyển ngay.

Vật liệu có blur đĩa, saturation/luminance thích ứng, khúc xạ rìa, specular theo pointer, Schlick Fresnel, bóng viền trong và tách màu nhẹ. Pointer/touch nhấn làm sáng và nén nhẹ bằng spring (stiffness 100, damping 10); không chặn thao tác mặc định hay capture pointer. `?glassPerf=1` chỉ ở dev đo CPU submit của composer sau 60 frame làm nóng, lấy 60 mẫu; số này không đại diện GPU time hoặc FPS trên điện thoại.

`HolographicBloomPass` giữ thứ tự màu trước khi thêm kính Project: tone mapping/chuyển màu base trước, cộng bloom sau. Không tone-map tổng base+bloom lần nữa. Cùng một ảnh đầu ra được dùng khi panel đóng hoặc mở; pass kính chỉ thay đổi pixel trong panel. Giữ nguyên cường độ ánh sáng/vật liệu và cấu hình bloom riêng của light/dark trong lần sửa pipeline này.

- `LoginView()`, `Dataset3DView()`, `Workspace3DPreview()`, `ManagementArea()` và `ProcessingView()` trả JSX. Management/Processing cần React Router; WorkbenchRoutes bọc cả hai bằng `ApplicationFrame` để dùng một UI session/theme. Login cần AuthProvider và router. Dataset 3D cần router và trình duyệt hỗ trợ WebGL để thấy scene.
- `HomePreviewView` và `UniverseHero` nhận `UniverseHeroProps` với scene tùy chọn. `WorkspacesPreviewView({ workspaceId? })`, `ProjectsPreviewView()`, `ProjectWorkspaceView({ projectId, scene? })`, `NotificationsPreviewView({ notificationId })`, `SettingsPreviewView({ section })` trả JSX theo phạm vi preview. `WorkspaceCard({ workspace, selected, view })` và `ProjectCard({ project, selected, view })` render thẻ cho view tương ứng.
- `PreviewSessionProvider({ routeIds, navigateSection?, children })` cấp model tương tác. Các export con về menu, card, dialog, icon và URL là điểm dùng trong preview, xem file tương ứng ở mục 5 để tra props và kiểu trả về.

## 5. Cấu trúc thư mục

**Khi thêm code.** Màn hình, bố cục và state riêng của màn hình nằm trong thư mục tính năng dưới `views/`. Đưa logic gọi API sang [services](../services/README.md) và geometry sang [graphics](../graphics/README.md).

`application/application-frame.tsx` ghép provider và CSS chung; `application/components/workbench-shell.tsx` nhận `area` và `context` để dùng chung header/theme. Management có sidebar; Processing chỉ có header và nội dung rộng toàn trang, không render sidebar hoặc nút thu gọn. `application/components/topbar-color-mode.tsx` mở bộ chọn Sáng/Tối/Theo hệ thống trên header; `processing/home/processing.module.css` chỉ định dạng nội dung và dùng token theme hiện có, không tạo nền hay palette riêng.

Processing và Home Management dùng chung `../components/project/list/universe-hero.tsx` và `recent-projects.tsx`; bảng giữ sắp xếp, phân trang, menu và đường dẫn project như Home hiện có. Processing thêm nút Tạo Project ở tiêu đề bảng. `project-data-actions.tsx` cung cấp hộp chọn tệp và khu vực lưu kết quả của Project; `result-review-dialog.tsx` kiểm tra sao/nội dung và đợi callback lưu, không tự gọi endpoint. Trạng thái dataset mẫu không đủ để bật lưu: cần kết quả đã được server xác nhận.

### Auth, Dataset 3D và Workspace 3D

- [auth/login/login.view.tsx](auth/login/login.view.tsx) — form login, đăng ký qua account service và nhánh review kính.
- [auth/login-glass.css](auth/login-glass.css) — bố cục và nền login.
- [dataset-3d/dataset-3d.view.tsx](dataset-3d/dataset-3d.view.tsx) — legend, focus cube, tách và chọn part.
- [dataset-3d/dataset-3d.module.css](dataset-3d/dataset-3d.module.css) — canvas, overlay và bảng chi tiết part.
- [workspace-3d/workspace-3d.view.tsx](workspace-3d/workspace-3d.view.tsx) — resource map, scope, camera command và file cục bộ.
- [workspace-3d/workspace-3d.css](workspace-3d/workspace-3d.css) — bố cục map, nhãn và fallback.

### Management và bố cục dùng chung

- [management-area.tsx](management/management-area.tsx) ghép màn hình Management theo URL.
- [workbench-session.tsx](application/workbench-session.tsx) cấp context tương tác cho Management và Processing.
- [workbench-shell.tsx](application/components/workbench-shell.tsx) chứa khung điều hướng và nội dung.
- [workbench.css](../styles/workbench/workbench.css) và [workbench-theme.css](../styles/workbench/workbench-theme.css) định dạng workbench.

`.gitkeep` giữ thư mục.

## 6. Luồng hoạt động

Login nhập dữ liệu → hook submit → coordinator cập nhật snapshot → guard chuyển trang. Workbench đọc URL để chọn view và phạm vi dữ liệu, rồi thao tác qua store do provider cấp. Dataset 3D nhận thao tác legend/canvas → cập nhật focus hoặc part → truyền state về scene. Workspace 3D kiểm tra cây, tính layout, truyền lệnh camera và mở bảng CSV theo dataset cục bộ.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| Dataset `detached`, `legendOpen` | `false` | Khởi đầu ở góc tổng quan và legend thu gọn |
| `?glassDebug=` (dev) | Tắt | Các mode `sdf`, `normal`, `offset` để xem shader |
| `?glassThickness=` (dev) | Giá trị scene | Ghi đè độ dày kính, clamp 0–200 |
| `?quality=low`, `?overlay=1` | Tắt | Chế độ nhẹ và overlay đối chiếu ở nhánh hỗ trợ |

## 8. Quy ước & bất biến

Giữ thao tác API qua hook/service. Page entry trong app/pages phân loại public/private, router thực thi guard. Management, Processing và Dataset 3D yêu cầu phiên cả dev lẫn production. Chỉ công cụ preview Workspace 3D riêng còn tách khỏi runtime auth. Giữ fallback và điều hướng bàn phím khi scene lỗi. Trong Dataset 3D, chế độ tách và focus cube là hai luồng khác nhau.

## 9. Test & debug

Chạy `yarn test src/__tests__/auth/auth-flow.test.tsx src/__tests__/management src/__tests__/processing src/__tests__/workspace-3d src/__tests__/dataset-3d/dataset-3d-view.test.tsx`. Review bằng `/auth/login`, `/management/workspaces` và `/processing/projects/:projectId` với ID project có sẵn.

## 10. Giới hạn & lưu ý

Management và Processing yêu cầu phiên trong dev lẫn production. `/processing` dùng nguồn project gần đây theo trang. [ManagementDataProvider](application/management-data-provider.tsx) cấp trạng thái tải và lỗi cho màn hình. [AdminApiPanel](management/members/admin-api-panel.tsx) hiển thị chức năng quản trị trong khu vực Members. [LiveDatasetPanel](processing/project/sections/live-dataset-panel.tsx) dùng dữ liệu server cho bảng records, schema, thống kê cột, cờ PII và tải CSV gốc. Upload CSV và lưu kết quả Detection là hai luồng riêng. Lưu đánh giá và xuất kết quả Detection vẫn cần kết nối backend. Xem [bảng route và hosting](../../README.md#route-management-và-ai-data-processing).

## 11. Hướng cải tiến

Kiểm tra focus cube trên thiết bị cảm ứng thật. Dataset 3D trong project dùng guard của route workbench.

## Luồng theo màn hình và thao tác

| Màn hình hoặc thao tác | Đường đi và trạng thái trả về |
| --- | --- |
| Đăng nhập email | [LoginView](auth/login/login.view.tsx) → useLogin → coordinator → AuthService → Axios → snapshot. UI hiển thị pending hoặc lỗi, guard điều hướng khi có phiên. |
| Đăng nhập Google | Nút Google → helper sign-in → chuyển trình duyệt đến backend. Callback → AuthProvider → coordinator đọc hồ sơ và xác nhận phiên → guard điều hướng. |
| Đăng ký | Form trong LoginView → account service → HTTP. Thành công điền email vào form đăng nhập, thất bại hiển thị lỗi đăng ký. |
| Quên và đặt lại mật khẩu | [PasswordRecoveryDialog](auth/login/sections/password-recovery-dialog.tsx) → account service → HTTP → trạng thái gửi yêu cầu hoặc cập nhật mật khẩu, kèm lỗi khi thao tác thất bại. |
| Khung ứng dụng và điều hướng | [ApplicationFrame](application/application-frame.tsx) → provider dữ liệu và workbench session → shell/topbar/breadcrumb. Menu, theme và điều hướng cập nhật cùng UI session. |
| Home, danh sách project và workspace | [ManagementArea](management/management-area.tsx) chọn màn hình theo URL → provider/store và component danh sách → hiển thị overview, workspace, project, phân trang hoặc trạng thái vùng. |
| Tạo, đổi tên, cập nhật, xóa, chuyển chủ, rời tài nguyên và thành viên | Màn hình management → wizard/dialog hoặc action tài nguyên → store → snapshot mới hoặc lỗi ở dialog. |
| Thành viên quản trị, thông báo và cài đặt | Panel admin → admin service; thông báo → store đọc chi tiết và đánh dấu đã đọc; settings → store cập nhật hồ sơ, mật khẩu, phiên và tùy chọn thông báo, hoặc health service cho trạng thái hệ thống. |
| Báo cáo sự cố và tệp đính kèm | Workbench UI → report component → store tạo/đọc/cập nhật issue, tải hoặc đính kèm tệp → thông tin kết quả và lỗi quay lại UI. |
| Processing và upload | [ProcessingView](processing/processing.view.tsx) → danh sách gần đây/wizard; project detail nhận tệp từ vùng chọn → store upload → làm mới thông tin project/dataset. |
| Records, schema, biểu đồ, thống kê, PII, tải và xóa dataset | [LiveDatasetPanel](processing/project/sections/live-dataset-panel.tsx) → dataset service → dữ liệu hoặc tệp trả về panel; thay đổi dataset thông báo cho caller cập nhật. |
| Chạy analysis, xem kết quả, feedback và tải báo cáo | [LiveAnalysisPanel](processing/project/sections/live-analysis-panel.tsx) và các section dự án → analysis service/store → trạng thái job, kết quả và thao tác tiếp theo của panel. |
| Focus cube, tách mô hình và chọn part | [Dataset3DView](dataset-3d/dataset-3d.view.tsx) → scene → callback về view → camera, legend và phần chi tiết cập nhật. |
| Resource map và xem CSV cục bộ | [Workspace 3D](workspace-3d/workspace-3d.view.tsx) → math và resource scene → thay scope, camera, selection hoặc mở giao diện đọc CSV. |
| Workspace tài khoản | Xem triển khai [WorkspaceView](workspace/workspace.view.tsx) và kiểm tra route đang mount trước khi dùng view làm điểm vào. |
