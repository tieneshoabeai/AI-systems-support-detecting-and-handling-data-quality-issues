# Shared: storage, pagination, crypto, events và transaction

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): shared/storage; shared/pagination; shared/crypto; shared/events; shared/application/outbox; shared/database; shared/utils.
- Cô lập dependency: SDK storage, filesystem abstraction, model/query/session, broker, Redis, clock và timer; không mở kết nối thật.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **SHR-001 [P1]** Storage thiếu credentials → chọn local mode đúng; đủ cấu hình → adapter remote đúng, không gọi cả hai cùng lúc.
- [ ] **SHR-002 [P1]** Upload/download/exists/delete với storage key hợp lệ → truyền đúng key, MIME, stream, metadata; file missing → lỗi rõ.
- [ ] **SHR-003 [P0]** Storage key tuyệt đối/../ và path encoding lạ → không thoát thư mục cho phép; không tin filename client.
- [ ] **SHR-004 [P1]** Quota ngay dưới/bằng/trên giới hạn → allowed/count/warning đúng; lỗi thống kê storage không biến thành dung lượng trống giả.
- [ ] **SHR-005 [P1]** Upload stream bị lỗi giữa chừng → reject và cleanup theo adapter; ký URL trả đúng TTL, không log credential.
- [ ] **SHR-006 [P1]** SHA256 buffer và stream cùng bytes → cùng hash chuẩn; empty stream có hash xác định.
- [ ] **SHR-007 [P0]** Encrypt/decrypt round-trip, sai key, sửa ciphertext/tag, buffer ngắn → khôi phục đúng hoặc từ chối, không trả plaintext rác.
- [ ] **SHR-008 [P1]** Salt/IV khác nhau → ciphertext/key khác theo thiết kế; cùng đầu vào key derivation → kết quả xác định; không mock crypto đang kiểm tra.
- [ ] **SHR-009 [P0]** sanitizeObjectForLog với nested object/array và tên trường nhạy cảm → redact sâu, không mutate input hoặc lộ token.
- [ ] **SHR-010 [P1]** Cursor encode/decode Date/number/string/null → round-trip đúng; malformed, sai version, sai sort → lỗi.
- [ ] **SHR-011 [P1]** Keyset ascending/descending với nhiều bản ghi cùng sort value → thêm tie-breaker ID; không lặp hoặc bỏ sót giữa trang trong fixture cố định.
- [ ] **SHR-012 [P1]** Keyset null/date/boolean/mixed values và bộ lọc search → thứ tự và điều kiện Mongo tương ứng comparator trong memory.
- [ ] **SHR-013 [P0]** Query filter chứa $ operator hoặc regex user → escape/allowlist, không mở đường query injection.
- [ ] **SHR-014 [P1]** parseDurationMs ms/s/m/h/d/w, chuỗi thiếu đơn vị, rỗng/sai → đúng fallback và đơn vị; biên 0/âm theo contract.
- [ ] **SHR-015 [P1]** ObjectId hợp lệ 24 hex và invalid length/nonhex/null → validator đúng, không gọi database cho ID sai.
- [ ] **SHR-016 [P1]** Device detector user-agent phổ biến/rỗng/lạ → nhãn ổn định, không throw.
- [ ] **SHR-017 [P1]** Transaction success → commit/endSession; callback lỗi → abort/endSession; lỗi commit không trả thành công.
- [ ] **SHR-018 [P0]** Nested transaction hoặc hai request song song → đúng session context, không dùng session request A cho B; unit stub, concurrency thật INT-004.
- [ ] **SHR-019 [P1]** Base repository → scope deleted, projection, version filter và session đúng; mapper không làm mất nullable/date/enum/id.
- [ ] **SHR-020 [P0]** Outbox record event → nội dung đúng aggregate/tenant, ghi trong transaction nếu contract yêu cầu; lỗi ghi không bị bỏ qua tùy tiện.
- [ ] **SHR-021 [P1]** Relay API-only/disabled/busy → không publish; claim batch → publish rồi markPublished, lỗi → markFailed và tiếp tục event khác.
- [ ] **SHR-022 [P0]** Relay thiếu publisher → không được đánh dấu published giả; hiện có nhánh cần đánh dấu RISK.
- [ ] **SHR-023 [P1]** Relay reclaim stuck publishing → trả event về xử lý theo lease, không phát lại event completed ngoài ý muốn; finally luôn nhả busy.
- [ ] **SHR-024 [P0]** Inbox event mới/completed/processing lease còn hạn/lease hết hạn/failed → claimed/already/busy/reclaim đúng; lỗi khác duplicate key phải propagate.
- [ ] **SHR-025 [P0]** Inbox/dispatcher nhận duplicate event → không lặp side effect; handler lỗi → fail thay vì complete; broker retry thật INT-004.
- [ ] **SHR-026 [P1]** Event dispatcher từng event_type → đúng consumer/notification/realtime/audit và ID; event không biết → xử lý rõ, không tạo tác dụng phụ tùy ý.
- [ ] **SHR-027 [P1]** In-process/Kafka/hybrid publisher chọn mode → chuyển đúng envelope; lỗi publish không bị báo delivery thành công.
- [ ] **SHR-028 [P0]** Broker/Redis credentials và payload nhạy cảm → không log; disconnect/reconnect được cleanup theo lifecycle.
- [ ] **SHR-029 [P1]** Mongoose schema User → metadata index phone chỉ một khai báo với options mong đợi; index database thật nằm INT-001.
