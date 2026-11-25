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
