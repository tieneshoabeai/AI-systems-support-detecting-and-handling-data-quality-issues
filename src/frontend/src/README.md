# Mã nguồn frontend

Mã nguồn React và TypeScript của workbench. Xem [README frontend](../README.md) để cấu hình và chạy ứng dụng.

| Phần | Trách nhiệm |
| --- | --- |
| [app](app/README.md) | Khởi tạo runtime, AuthProvider và route guard. |
| [views](views/README.md) · [components](components/README.md) · [hooks](hooks/README.md) | Màn hình theo route, thành phần giao diện và logic React. |
| [services](services/README.md) | Điều phối phiên, gọi API theo nghiệp vụ và ánh xạ phản hồi. |
| [lib](lib/README.md) · [configs](configs/README.md) · [types](types/README.md) | HTTP client, cấu hình API, storage phiên và kiểu dữ liệu. |
| [repositories](repositories/README.md) · [sync](sync/README.md) | Bản nháp dữ liệu cục bộ và đồng bộ. |
| [graphics](graphics/README.md) · [math](math/README.md) | Scene 3D và phép tính phục vụ hiển thị. |
| [utils](utils/README.md) · [`__tests__`](__tests__/README.md) | Tiện ích dùng chung và bản đồ kiểm thử. |

Khi đọc một luồng, bắt đầu từ route trong `app`, sang màn hình và provider trong `views`, rồi tìm thao tác tương ứng trong `services`. Từ thư mục frontend, chạy `yarn test` để kiểm tra bằng Vitest.

## Bản đồ luồng chức năng

| Chức năng | Đường đi giữa các module |
| --- | --- |
| Khởi động, khôi phục phiên, login email, callback Google, gia hạn, logout, xóa tài khoản | [app](app/README.md) ↔ [hooks](hooks/README.md) ↔ [services/auth và users](services/README.md) ↔ [lib](lib/README.md) → snapshot → guard và UI |
| Đăng ký, quên và đặt lại mật khẩu | [views/auth](views/README.md) → account service → Axios → phản hồi về form |
| Home, workspace, project, thành viên, thông báo, báo cáo, cài đặt, quản trị | [app/router](app/README.md) → [views/application và management](views/README.md) → [store và admin service](services/README.md) → Axios → snapshot hoặc state của panel |
| Tạo project, đọc CSV, đính kèm hoặc upload dataset | [components/project](components/README.md) → hook và helper CSV → wizard → management store → HTTP upload → trạng thái project |
| Dataset, analysis, feedback, report và xuất kết quả | [views/processing](views/README.md) → dataset/analysis service hoặc hook đánh giá → Axios → panel hoặc trình tải tệp |
| Workspace 3D, Dataset 3D, Auth Glass | [views](views/README.md) → [components/graphics](components/README.md) → [graphics](graphics/README.md), [math](math/README.md) và [assets](assets/README.md) → render hoặc callback → UI |
| Lưu bản nháp cục bộ | [app runtime](app/README.md) tạo [repository](repositories/README.md) → Dexie/IndexedDB khi caller sử dụng. [Sync](sync/README.md) ghi tình trạng tích hợp. |
| Cấu hình, DTO và tiện ích | [configs](configs/README.md) → runtime/client/repository. [types](types/README.md) → hợp đồng và model của caller. [utils](utils/README.md) → kết quả kiểm tra cho service hoặc module điều hướng. |
| Kiểm thử | [__tests__](__tests__/README.md) → UI, service, storage hoặc scene qua điểm vào tương ứng → assertion. |

Ở mỗi README, tìm thao tác theo tên chức năng rồi mở caller và hàm tiếp theo. Với HTTP, phần backend bắt đầu tại request và kết thúc tại response.
