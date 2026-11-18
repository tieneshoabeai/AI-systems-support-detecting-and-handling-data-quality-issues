# Manager API

Khung 2D dùng `createManagementStore` khi đăng nhập; dữ liệu mẫu chỉ dành cho trang review phát triển. Không có fallback tự động sang dữ liệu mẫu khi API lỗi.

- `management.store.ts`: tải workspace/project, chuyển DTO sang dữ liệu màn hình, ghi bằng API và tải lại sau khi máy chủ xác nhận.
- `management.types.ts`: hợp đồng store dùng chung cho hook và API adapter.
- `upload-validation.ts`, `csv-preview.ts`: CSV UTF-8 tối đa 50 MB; preview hỗ trợ dấu phẩy, chấm phẩy, tab và gạch đứng. CSV preview không thay kiểm tra backend.
- `index.ts`: điểm export của module.

Workspace chỉ có Owner/Member; project có Owner/Member/Viewer. Quyền màn hình được tính từ người đăng nhập và danh sách thành viên. Backend vẫn phải kiểm tra độc lập. Chỉ Workspace Owner được tạo/xóa project; Workspace Owner hoặc Project Owner được quản lý thành viên và upload. Mỗi project có một dataset, không thay thế.

Chuyển chủ sở hữu gửi `expectedVersion`; xung đột phải tải lại dữ liệu. Retry tạo project trong cùng phiên dùng lại project đã tạo nếu upload thất bại. Sau khi tải lại trang, mở project đã tạo để tiếp tục upload; không tạo một project mới cùng tên.

Thông báo dùng cursor và một cờ `notificationsEnabled`; xóa thông báo chưa có hợp đồng API nên giao diện vô hiệu hóa thao tác đó. Hồ sơ chỉ lưu họ tên theo DTO hiện hành; các trường chưa hỗ trợ không cho sửa. Báo lỗi dùng `/issues`, đính kèm PNG/JPG/PDF tối đa 10 MB và tải tệp qua request xác thực.

Auth/session và module 3D do phần tích hợp riêng quản lý. Provider đọc token hiện tại mỗi request, không giữ bản token cũ.

Payload JSON của manager được kiểm tra bằng `satisfies` với type sinh tại `types/services-type` (workspace, project, thành viên, chuyển quyền, hồ sơ, thông báo và báo lỗi). Không sửa thủ công các file sinh. OpenAPI hiện chưa mô tả body của nhiều response (`content?: never`), vì vậy adapter vẫn khai báo DTO nhận về và hỗ trợ cả phân trang số/con trỏ, danh sách thành viên `members/items`. Type sinh sẵn không thay thế kiểm tra runtime hoặc kiểm thử với BE thật. Khi bổ sung response schema ở BE, sinh lại type rồi cập nhật adapter.

Kiểm thử: `yarn test src/__tests__/management`; bộ này kiểm tra hợp đồng request, upload thất bại/retry, phân trang, phiên bị hủy và UI chờ xác nhận. Kiểm thử HTTP backend ở `test/management-http.spec.ts` dùng controller/guard/service thật với persistence thay thế, không phải nghiệm thu với MongoDB thật.
