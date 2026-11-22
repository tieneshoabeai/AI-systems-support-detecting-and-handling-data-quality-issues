# Các điểm cần chốt khi triển khai test

Đây là danh sách câu hỏi, không tự thêm quyết định nghiệp vụ. Không cần chờ tất cả câu trả lời để viết các unit test độc lập còn lại.

- **OPEN-01 — Role khi đăng ký:** admin được cấp bằng cơ chế nào? Quyết định cũ đang hoãn. Không chốt pass cho tự đăng ký admin chỉ vì DTO hiện chấp nhận.
- **OPEN-02 — Hạn refresh:** giữ mốc hết hạn gốc hay gia hạn trượt? RefreshAccessTokenHandler comment nói giữ hạn nhưng code dùng now + TTL. Cả hai đều có thể là chính sách, phải chốt trước assertion.
- **OPEN-03 — Rename payload lặp key:** từ chối hay tên cuối thắng? Đồng thời có cho đổi tên cột vốn hợp lệ hay chỉ sửa cột lỗi?
- **OPEN-04 — Cột có tên trùng:** output trả key/name/value hay object keyed by name? Phải giữ mọi cột, không làm mất ô khi tên trùng.
- **OPEN-05 — Ngày/CSV:** timezone, locale, delimiter/encoding, dòng lệch header, trailing blank row, ngày mơ hồ và số dòng vật lý khi ô xuống dòng. Không tự chuẩn hóa dữ liệu theo suy đoán.
- **OPEN-06 — Cấu hình cột:** selected_columns=[] nghĩa không chọn hay mặc định tất cả? label/time/value có bắt buộc thuộc selected_columns không? Khi rename thì cập nhật cấu hình thế nào?
- **OPEN-07 — Retry/cancel:** trạng thái được retry, giới hạn attempt tính lần đầu ra sao, result stale hoặc job đang chạy có được retry không; kết quả trả trễ xử lý thế nào?
- **OPEN-08 — Thu hồi realtime:** user bị remove/blocked trong lúc socket đang mở phải bị ngắt hoặc kiểm tra lại vào lúc nào?
- **OPEN-09 — Lỗi hạ tầng:** audit/notification/outbox/storage/quota thất bại có rollback nghiệp vụ không; trường hợp nào best-effort? Không mặc định mọi lỗi đều được bỏ qua.
- **OPEN-10 — Số học:** sample/population variance, quartile convention, tolerance, min sample và ngưỡng cảnh báo chưa xác nhận đầy đủ; phân biệt hằng số code với chuẩn nghiệp vụ được duyệt.

## Cách ghi kết quả khi bạn thực hiện

Mỗi ID ghi: tên test thực hiện; fixture; nguồn expected (yêu cầu hay characterization code); Actual; PASS/FAIL/BLOCKED/NOT_IMPLEMENTED; link issue nếu có. Nếu code sai yêu cầu thì giữ expected nghiệp vụ, không chỉnh test để khớp lỗi. Không ghi PASS chỉ vì có file test cũ.
