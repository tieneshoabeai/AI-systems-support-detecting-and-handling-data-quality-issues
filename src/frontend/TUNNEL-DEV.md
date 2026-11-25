# Chạy frontend khi URL tunnel đổi

Chạy PowerShell trong thư mục `src/frontend`:

```powershell
.\scripts\dev-with-swagger.ps1 -SwaggerUrl 'https://backend-tunnel.example/api/v1/docs'
```

Mặc định script dùng `qa-main` làm mã môi trường, frontend luôn ở `http://127.0.0.1:5180`, và tự tách host API cùng prefix `/api/v1` từ link Swagger. Dừng phiên đang chạy rồi khởi động lại script với link Swagger mới khi tunnel đổi. IndexedDB được giữ vì địa chỉ frontend không đổi.

## Đổi tunnel và chuyển hàng đợi cũ

Lần đầu chuyển từ URL cũ sang URL mới, chỉ thêm URL cũ nếu bạn xác nhận nó trỏ tới cùng backend/DB:

```powershell
.\scripts\dev-with-swagger.ps1 `
  -SwaggerUrl 'https://new-tunnel.example/api/v1/docs' `
  -EnvironmentId 'qa-main' `
  -PreviousSwaggerUrl 'https://old-tunnel.example/api/v1/docs'
```

Có thể truyền nhiều `-PreviousSwaggerUrl`. Chỉ hàng đợi và cache của tài khoản đang đăng nhập được chuyển. Upload Blob, trạng thái `uncertain`, thứ tự, phiên bản sửa và mã yêu cầu được giữ. Nguồn không khai báo hoặc xung đột cache vẫn nằm nguyên ở URL cũ; frontend không tự đoán hai tunnel có cùng database hay không.

Giữ cùng `EnvironmentId` chỉ khi URL mới thuộc cùng QA/backend/DB. Dùng ID khác cho production, QA khác hoặc database khác. FE không thể xác minh danh tính đó nếu BE chưa trả một `environmentId` ổn định.

## Kiểm tra A → B

1. Chạy với link A và `qa-main`, đăng nhập, tạo một thao tác offline (tắt backend trước khi lưu để hàng đợi ghi vào IndexedDB).
2. Dừng frontend. Khởi động lại với link B, giữ `qa-main` và truyền A bằng `-PreviousSwaggerUrl`. Script dùng `npm.cmd run dev`, không tải package manager lúc khởi động.
3. Đăng nhập đúng tài khoản. Mở Settings → System để xác nhận Environment, Backend API và trạng thái migration. Nếu còn namespace chưa khai báo hoặc cache xung đột, màn hình báo và giữ dữ liệu cũ nguyên trạng.
4. Bật backend B. Hàng đợi được đồng bộ sau khi kiểm tra kết nối và phiên. Với upload ở trạng thái chưa rõ kết quả, cơ chế đối chiếu hiện có vẫn chạy trước; không tự gửi lại mù.
5. Reload trang để xác nhận frontend cùng origin giữ IndexedDB. Xác nhận không có thao tác bị gửi hai lần.

Script chỉ cấu hình tiến trình frontend hiện tại; các biến không được lưu vào `.env`.
