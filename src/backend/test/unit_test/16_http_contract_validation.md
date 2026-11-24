# Logic HTTP có thể unit test và kiểm tra cấu trúc

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): shared/pipes; filters; interceptors; middleware; decorators; config; swagger; tất cả infrastructure/http/dtos và controllers.
- Cô lập dependency: request/response/context/reflector, handler và logger mock; không khởi động Nest server.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **HTTP-001 [P1]** Mọi DTO: tối thiểu hợp lệ, thiếu từng field required, sai kiểu, null, chuỗi rỗng, enum lạ → parse hoặc lỗi đúng schema; tách từng ca khi viết test.
- [ ] **HTTP-002 [P1]** Mọi field có min/max/default/coerce → kiểm tra min−1/min/max/max+1 và giá trị thiếu; không chỉ happy path.
- [ ] **HTTP-003 [P0]** DTO nhận fields nội bộ không cho phép → strip/reject theo schema; payload không nâng quyền hoặc ghi đè owner/tenant/version.
- [ ] **HTTP-004 [P1]** ZodValidationPipe hợp lệ → trả dữ liệu đã parse; lỗi → mã/path field dễ hiểu, không lộ payload nhạy cảm.
- [ ] **HTTP-005 [P1]** If-Match thiếu/số hợp lệ/quoted/chuỗi rác/số âm → xử lý theo decorator contract; không bỏ qua version sai rồi update.
- [ ] **HTTP-006 [P1]** Transform interceptor với data thường/list có meta/stream → envelope đúng, không bọc đôi hoặc làm hỏng stream tải file.
- [ ] **HTTP-007 [P0]** Exception filter với validation/unauthorized/forbidden/notfound/conflict/unexpected error → mã và envelope đúng, không trả stack/secret cho client.
- [ ] **HTTP-008 [P1]** Request ID hợp lệ/thiếu/không an toàn → dùng hoặc tạo ID phù hợp, response có cùng ID; không cho header injection.
- [ ] **HTTP-009 [P0]** Logging interceptor thành công/lỗi → thời gian/status/requestId đúng, không ghi password/OTP/auth header/refresh token.
- [ ] **HTTP-010 [P1]** Controller có chuyển đổi DTO hoặc mapping response → đúng handler/input/current user, lỗi không bị nuốt; controller forwarding thuần không cần test trùng logic handler.
- [ ] **HTTP-011 [P0]** Route nhạy cảm → kiểm tra metadata auth/role/policy có đủ; đây là kiểm tra cấu trúc, không chứng minh runtime guard hoạt động.
- [ ] **HTTP-012 [P1]** Env validation: config tối thiểu hợp lệ, thiếu secret bắt buộc, sai enum/port/boolean → default hoặc fail rõ, không tự dùng secret mẫu trong production.
- [ ] **HTTP-013 [P1]** Swagger Zod conversion: optional/null/enum/array/nested → schema phản ánh DTO, không khai báo required sai.
- [ ] **HTTP-014 [P1]** App health/info → response đúng contract, không chứa env secret hoặc thông tin nội bộ nhạy cảm.
- [ ] **HTTP-015 [P1]** Dependency rule và zero-any → ghi riêng static checks, không tính là unit coverage nghiệp vụ hoặc thay thế test hành vi.
