# Auth: tài khoản, token, OTP và Google OAuth

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/auth/application; modules/auth/domain; modules/auth/infrastructure/security; modules/auth/infrastructure/auth/jwt.strategy.ts.
- Cô lập dependency: user lookup, session port, hasher, token issuer, Google OAuth, outbox; cố định thời gian và random.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **AUTH-001 [P0]** Đăng ký email mới, dữ liệu hợp lệ → hash mật khẩu trước khi tạo user; trả hồ sơ an toàn, không trả password hash hoặc token reset.
- [ ] **AUTH-002 [P0]** Email đã tồn tại → Conflict; không hash/tạo user/session/event thành công sau khi bị từ chối.
- [ ] **AUTH-003 [P1]** Password dài 7, 8, 100, 101 ký tự → kiểm tra chính xác biên policy 8–100 hiện tại tại DTO/value object.
- [ ] **AUTH-004 [P1]** Email viết hoa/khoảng trắng, thiếu trường bắt buộc, email sai định dạng → DTO chuẩn hóa hoặc từ chối đúng schema; handler nhận dữ liệu đã xác thực.
- [ ] **AUTH-005 [P0]** Client gửi role admin khi đăng ký → ghi nhận kết quả thực tế, đối chiếu quyết định OPEN-01; không coi khả năng tự cấp admin là tiêu chí an toàn mặc định.
- [ ] **AUTH-006 [P0]** Đăng nhập đúng → so sánh hash, tạo session, cấp token gắn đúng user/session; response không chứa secret.
- [ ] **AUTH-007 [P0]** Email không tồn tại, sai mật khẩu, user chỉ đăng nhập Google chưa có password → từ chối; không tạo session.
- [ ] **AUTH-008 [P0]** Tài khoản blocked/đã xóa → không phát token mới; bổ sung ca hồi quy nếu nhánh chưa chặn đầy đủ.
- [ ] **AUTH-009 [P1]** remember_me thiếu/false/true và alias rememberMe → TTL đúng policy, mặc định false; cố định clock để so expires_at.
- [ ] **AUTH-010 [P1]** Thiếu user-agent/IP hoặc thiết bị không nhận diện được → vẫn đăng nhập theo contract; metadata không biến thành thông tin xác thực.
- [ ] **AUTH-011 [P0]** Refresh token hợp lệ → lookup bằng hash, thu hồi session cũ, tạo session mới, access token tham chiếu session mới.
- [ ] **AUTH-012 [P0]** Refresh tại thời điểm expiresAt bằng now và sau now → bị từ chối; không tạo session mới.
- [ ] **AUTH-013 [P0]** Refresh token đã thu hồi được dùng lại → yêu cầu thu hồi toàn bộ session của đúng user, trả lỗi; không phát token.
- [ ] **AUTH-014 [P0]** Refresh token không tồn tại hoặc user bị khóa/xóa → từ chối; không ảnh hưởng session người khác.
- [ ] **AUTH-015 [P0]** Revoke session cũ thất bại trong rotation → xác minh không âm thầm để hai token còn hợp lệ; đánh dấu RISK nếu code vẫn cấp token.
- [ ] **AUTH-016 [P1]** Refresh có remember_me → giữ cờ; hạn tuyệt đối hay trượt cần OPEN-02, không viết assertion TTL theo comment mâu thuẫn code.
- [ ] **AUTH-017 [P0]** Đổi mật khẩu: xác nhận không khớp, mật khẩu cũ sai, mới giống cũ, user bị khóa → từ chối và không đổi hash.
- [ ] **AUTH-018 [P0]** Đổi mật khẩu thành công → lưu hash mới, thu hồi các session khác, giữ session hiện tại theo contract; không trả hash.
- [ ] **AUTH-019 [P0]** Forgot password cho email có/không có hoặc user bị khóa → response trung tính, không tiết lộ tài khoản tồn tại.
- [ ] **AUTH-020 [P1]** Gửi OTP ở lần 4/5/6 trong cửa sổ và ngay trước/sau hết cửa sổ → áp dụng đúng giới hạn 5 lần và reset bộ đếm theo code; mock clock.
- [ ] **AUTH-021 [P0]** OTP đúng còn hạn → đổi hash, xóa trạng thái OTP, thu hồi session theo contract; OTP dùng lại không thành công.
- [ ] **AUTH-022 [P0]** OTP sai lần 1/2/3, đã hết lượt, đã hết hạn → tăng bộ đếm đúng, khóa/reset đúng quy tắc; không thay mật khẩu.
- [ ] **AUTH-023 [P1]** OTP đúng tại đúng mốc hết hạn → ghi nhận quy tắc biên cần thống nhất với now > expiresAt hiện tại; kiểm tra cả trước và sau mốc.
- [ ] **AUTH-024 [P0]** Logout có session/không có session; revoke session của người khác → chỉ thu hồi session hợp lệ thuộc user, không ảnh hưởng người khác.
- [ ] **AUTH-025 [P1]** Liệt kê/đọc session → đúng user, không lộ refresh hash; ID không tồn tại hoặc thuộc user khác trả lỗi.
- [ ] **AUTH-026 [P0]** Google ID đã liên kết → đăng nhập user đó, không tạo user mới; profile email chưa verified → từ chối.
- [ ] **AUTH-027 [P0]** Google ID mới và email mới → tạo tài khoản Google rồi tạo session; email trùng tài khoản local → Conflict, không tự liên kết.
- [ ] **AUTH-028 [P0]** OAuth state thiếu/sai; code lỗi; upstream từ chối → không tạo user/session/token; không gọi upstream khi state đã sai.
- [ ] **AUTH-029 [P1]** Thiếu Google credentials → lỗi dependency rõ ràng; URL authorization có redirect URI và state được encode đúng.
- [ ] **AUTH-030 [P0]** JWT sai chữ ký/hết hạn/thiếu sub, user không hoạt động, session bị thu hồi → từ chối ở strategy/guard; không chỉ tin role trong payload.
- [ ] **AUTH-031 [P1]** Hasher/issuer/repository/provider throw → kiểm tra lỗi được truyền/mapping đúng, không báo thành công giả, không log mật khẩu/token/OTP.
