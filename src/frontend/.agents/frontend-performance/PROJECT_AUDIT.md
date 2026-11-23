# Phase 0 — Khảo sát hiệu năng frontend

Phạm vi khảo sát là `src/frontend`. Bằng chứng gồm source, cấu hình test, artifact build hiện có và báo cáo k6 đã lưu. Kết quả runtime bên dưới dựa trên các lần chạy trước. Phase 0 chưa chạy benchmark mới. Backend cung cấp dữ liệu cho các hành trình đã được duyệt và dùng để đối chiếu contract.

[Kế hoạch triển khai](IMPLEMENTATION_PLAN.md) · [Baseline k6](../performance-testing/PROGRESS.md) · [Runbook k6](../performance-testing/09-EXECUTION-GUIDE.md)

## Kiến trúc và tooling đang có

| Khu vực | Hiện trạng và ý nghĩa khi đo |
|---|---|
| Stack | Manifest khai báo React/React DOM ^19.3.1, React Router 8.5.0, TypeScript ~6.0.3, Vite ^8.3.4, React Three Fiber 9.8.2, Three.js 0.186.1, Axios 1.20.0, TanStack Query 5.104.5 và Dexie 4.4.7. Khi đo, ghi phiên bản thực tế của build và browser cùng Git revision. [Manifest](../../package.json) |
| Tổ chức | `app` ghép router và providers. `views` và `components` dựng màn hình. `hooks` nối state với React. `services` và `lib` điều phối dữ liệu, HTTP và session. `graphics` và các component graphics sở hữu scene, geometry và render passes. [Bản đồ source](../../src/README.md) |
| Build | `yarn build` chạy TypeScript rồi Vite. Vite dùng React Compiler qua Babel và HTTPS cho dev/preview thông thường. Router dùng lazy import cho ApplicationFrame, Management, Processing và Project Workspace. Cần so trace theo route để biết chunk nào tải trước mốc sẵn sàng. [Vite](../../vite.config.ts) · [Router](../../src/app/router/workbench-routes.tsx) |
| Session và state | Auth và Management dùng `useSyncExternalStore`. Management phát snapshot khi dữ liệu bổ sung về, nên cần đo số commit và phạm vi render của các subscriber. QueryClient tắt retry và refetch khi đổi focus/kết nối theo mặc định, đồng thời hủy và xóa query khi dọn phiên. Management tải dữ liệu bằng store và Axios, vì vậy cần đo hành vi cache theo từng đường gọi. [Auth provider](../../src/app/context/auth-provider.tsx) · [Store hook](../../src/hooks/preview/use-preview-store.ts) · [Query client](../../src/lib/query-client.ts) |
| Test | Vitest 5.0.5 và Testing Library dùng cho chức năng. Playwright 1.61.1 hiện có E2E auth, admin, workspace/project và theme. E2E dùng Vite dev riêng, 1 worker và tắt trace do có dữ liệu xác thực. Build benchmark cần một profile riêng. k6 Browser có hai suite TypeScript login và danh sách dự án. [Playwright](../../playwright.config.ts) · [Vitest](../../vitest.config.ts) · [k6](../../tests/performance) |
| Hạ tầng | Chưa tìm thấy workflow CI trong thư mục FE hoặc GitHub workflow ở root repo đã khảo sát. Quyền runner, thiết bị mobile, GPU và nơi lưu artifact cần xác nhận trước khi thiết kế CI gate. |

## Route và điểm đo

| Route / luồng | Mốc đo đề xuất | Điểm cần kiểm tra |
|---|---|---|
| `/auth/login` | Cold navigation đến form sẵn sàng, rồi submit đến heading Processing | Tách hai mốc. Trace loading và hoạt ảnh backdrop riêng. Tái sử dụng k6 login. [Router công khai](../../src/app/router/app-router.tsx) · [Login view](../../src/views/auth/login/login.view.tsx) |
| `/processing` | Heading hiển thị, recent projects sẵn sàng, sau đó tương tác scene | Đo fallbacks và frame time riêng. Một heading hiện sớm chưa chứng minh scene sẵn sàng. [Processing view](../../src/views/processing/home/processing.view.tsx) |
| `/management`, `/management/workspaces` | Mốc tổng quan, mở danh sách, chuyển workspace | So dấu thời gian request, thời điểm đổi selection và commit của UI. Kiểm tra cache warm khi quay lại. [Management entry](../../src/views/preview/preview-entry.tsx) |
| `/management/projects` | Thẻ đầu tiên, dữ liệu thẻ sẵn sàng, lọc/sắp xếp/phân trang | Store công bố thẻ từ workspace/index, rồi tải dataset và thành viên theo trang đang hiện. Sort số bản ghi cần metadata của cả tập đã lọc. Đo theo quy mô workspace và số thẻ, xác minh request lặp theo method và route. [Store](../../src/services/management/management.store.ts) · [Projects view](../../src/views/management/projects/projects.view.tsx) |
| `/processing/projects/:projectId` | Shell, scene thao tác được, mở Data View, đổi trang bản ghi, mở và đóng module | View prefetch schema và trang records đầu, tải kết quả Detection đã lưu nếu có. Records mặc định 50 và hỗ trợ cursor. Tách thời gian request khỏi render bảng và scene. Chọn dataset thử đã có quy mô đã biết. [Project Workspace](../../src/views/processing/project/project-workspace.view.tsx) · [Dataset service](../../src/services/processing/dataset.service.ts) |
| Modal thao tác từ Management | Click đến modal sẵn sàng, đóng modal và focus trở về | Ưu tiên đường đọc và tương tác, ví dụ mở thông tin hoặc mở wizard rồi hủy. Đường đo thật dùng bản ghi được phê duyệt. [Preview session](../../src/views/preview/preview-session.tsx) |

Trong các thư mục runtime FE đã khảo sát, chưa thấy luồng chat, SSE hoặc WebSocket được nối tới UI. Bài streaming và unsubscribe realtime được giữ ở trạng thái chờ bằng chứng tích hợp. Các request REST, tải asset, phân trang, hủy prefetch và vòng đời listener là các đối tượng đo đã có căn cứ. [Axios client](../../src/lib/axios-client.ts) · [API inventory tham chiếu](../performance-testing/02-API-INVENTORY.md)

## Rendering, runtime và bộ nhớ

| Khu vực | Bằng chứng source | Giả thuyết và phép kiểm chứng |
|---|---|---|
| Holographic Project scene | R3F Canvas, `useFrame`, tạo model trong `useMemo`, pipeline composer với glass và bloom. Có hàm dispose model/passes. | Đo initial model creation, GPU upload và render loop ở ba khoảng mở scene, idle và tương tác. Tách bản profiling React khỏi bản production benchmark. |
| Resource scene | Canvas đặt DPR trong khoảng 1–1,5 và chuyển giữa `always` và `demand` theo motion. | Kiểm tra tỷ lệ frame vượt budget khi idle, quay camera và khi tab bị ẩn. Ghi renderer phần cứng/phần mềm và trạng thái reduced motion. |
| Mô hình lặp | Holographic decor đã có `InstancedMesh`. Scene có dispose geometry, material, texture hoặc composer ở các nhánh đã khảo sát. | Đo draw calls và số geometry/texture trước khi xem xét thay đổi instancing. So lượng tài nguyên còn giữ qua các chu kỳ mở/đóng và truy retaining path. |
| Quản lý snapshot UI | Store publish khi bổ sung từng phần dữ liệu. | Profiler đo commit count, actualDuration và component thực sự render lại trên một navigation, một lần đổi workspace và một lần hydrate danh sách. |
| Bảng và thao tác | Data View phân trang server, scene và panel cùng tồn tại. | Dùng dữ liệu thật đã phê duyệt, ghi kích thước trang và số cột. Đo input delay và từ phản hồi API tới lúc UI hiển thị trang mới. |
| Lifecycle | Có AbortController cho prefetch và card scope. Scene có cleanup cho controls và tài nguyên tự tạo. | Lặp mở/đóng module và điều hướng vào/ra Project. Theo dõi heap sau GC, DOM detach, listeners và GPU counters có thể quan sát; xác nhận object còn bị giữ trước khi quy là leak. |

[Holographic scene](../../src/components/graphics/holographic-core/holographic-core.scene.tsx) · [Instancing](../../src/components/graphics/holographic-core/holographic-core.decor.tsx) · [Resource scene](../../src/components/graphics/workspace-3d/resource-scene.tsx) · [Chrome DevTools Memory](https://developer.chrome.com/docs/devtools/memory-problems)

## Bằng chứng hiệu năng đã có

| Bằng chứng | Quan sát | Giới hạn |
|---|---|---|
| k6 danh sách dự án, 1 VU và 5 lượt mỗi đợt | Thẻ đầu tiên có trung vị 3,84 → 2,91 s. API theo dõi mỗi lượt 17 → 8. P95 5,38 → 8,67 s. | Lần sau có một mẫu đến 10,10 s và chồng lấp build/test cục bộ. Dùng làm tham chiếu, cần đo lại riêng trước khi đặt gate. |
| `dist/assets` đã có | Chunk R3F 912.518 B, Project Workspace 520.996 B, entry JS 227.283 B. Hai ảnh nền lớn khoảng 2,06 MB và 1,74 MB theo kích thước file. | Kích thước artifact trên đĩa. Coverage theo route, transfer nén, cache và chi phí decode cần Resource Timing và trace. |
| DevTools trace cũ được ghi trong lịch sử dự án | Có tín hiệu long task trong lần mở Project và dấu vết CPU của dựng model hoặc WebGL resize. | Chạy dev và có extension. Chỉ dùng để chọn vùng cần profile lại trên bản build chuẩn; chưa có baseline GPU, FPS hoặc LCP cho route này. |

[Kết quả k6 đã lưu](../performance-testing/PROGRESS.md)

## Thứ tự ưu tiên

1. **P0** Chuẩn hóa runner và baseline sạch cho login, Processing, danh sách dự án và Project Detail. Ghi nhận riêng browser cold/warm, CPU/GPU và fixture.
2. **P0** Tách thời gian mạng, commit UI, lần dựng model đầu và render liên tục ở Project Detail.
3. **P1** Đo bảng records, lọc/sort, chuyển workspace, modal và chu kỳ mount/unmount. Xác nhận giữ object sau GC nếu có dấu hiệu tăng.
4. **P2** Tích hợp CI và mở rộng route khi đã có thiết bị, baseline ổn định và chủ sở hữu phê duyệt ngưỡng.

Phase 0 hoàn tất khảo sát tĩnh. Phiên bản Chrome, GPU thực, dữ liệu độ lớn và điều kiện runner còn cần xác nhận trong đợt baseline đầu.
