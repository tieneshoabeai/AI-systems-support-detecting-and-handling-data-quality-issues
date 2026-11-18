# Các kiểm tra phải làm thêm ngoài unit test

- Ngày lập: 2026-11-16.
- Loại: Bổ sung integration, không phải unit.
- Nguồn (tương đối với `src/backend/src/`): MongoDB indexes/transactions; Nest HTTP; storage; broker; PDF.
- Cô lập dependency: Dùng môi trường test cô lập khi người dùng triển khai; KHÔNG thực hiện trong tác vụ tài liệu này.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **INT-001 [P0]** MongoDB index phone/email thật → đúng unique/partial filter, nhiều user thiếu phone không xung đột, trùng số bị chặn; metadata schema và mock không chứng minh điều này.
- [ ] **INT-002 [P0]** Rename → lưu thật → đọc lại từ connection/request mới → tên mới hiện, key/records/originalName nguyên; Reset → đọc lại tên gốc và warnings.
- [ ] **INT-003 [P0]** Hai import vào cùng project hoặc hai update cùng expectedVersion → chỉ một thành công, không dataset/file/quota mồ côi.
- [ ] **INT-004 [P0]** Transaction rollback, outbox/inbox/job claim giữa hai worker và broker redelivery → tính nguyên tử/idempotency thực, không suy từ mock.
- [ ] **INT-005 [P0]** HTTP auth/guard/DTO thật: Owner/Member/Viewer/admin/anonymous và tài nguyên khác tenant → status/envelope, không chạy use case trái phép.
- [ ] **INT-006 [P1]** PDF thực → bytes đọc được, đủ tiếng Việt, bảng dài/page breaks, đúng snapshot và download authorization.
- [ ] **INT-007 [P1]** Storage local/R2 → upload checksum/download bytes/cleanup; signed URL TTL và quyền truy cập thực tế.
- [ ] **INT-008 [P1]** Redis Socket.IO và Kafka → kết nối nhiều instance, room isolation, revoke/reconnect; unit chỉ kiểm tra logic gọi adapter.
- [ ] **INT-009 [P0]** Luồng thật import → cảnh báo → rename → analysis → AI failure/retry → summary/PDF → reset → cảnh báo lại → không sử dụng kết quả cũ.
- [ ] **INT-010 [P1]** Khởi động Nest với DI/module wiring, API prefix, Swagger, CORS → kiểm tra riêng; gọi controller trực tiếp không xác nhận router hoạt động.
- [ ] **INT-011 [P1]** Tải lớn/memory/backpressure/timeout, load/stress/security scan → kế hoạch ngoài unit, không chạy trong tài liệu này.
