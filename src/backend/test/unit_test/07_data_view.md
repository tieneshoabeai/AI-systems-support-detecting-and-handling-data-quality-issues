# Data Views: đọc, lọc, sắp xếp và thống kê cột

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/data-view/application; modules/data-view/domain; modules/datasets/infrastructure/persistence/record-query.repository.ts.
- Cô lập dependency: record-query/dataset ports; model stub khi kiểm tra query builder.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện.
- Cập nhật 2026-11-24 (Phần 13 v15 mục 3.28): 12/21 nhóm đã phủ (`[x]`); còn mở VIEW-002, 003, 008, 009, 011, 014, 016, 019, 020.
- Cập nhật 2026-11-25 (Phần 13 v18 mục 3.31): thêm VIEW-022 (cursor gắn truy vấn + hạn 24 giờ), VIEW-023 (chuỗi ngày legacy UTC+7); VIEW-014 đã phủ. 15/23 nhóm đã phủ.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [x] **VIEW-001 [P1]** Get records hợp lệ → đúng items và meta nextCursor/hasMore/limit, không thêm offset/total ngoài contract. — *Đã phủ (2026-11-24): test/unit/datasets/data-view.spec.ts.*
- [ ] **VIEW-002 [P1]** ID dataset sai/không tồn tại → validation/NotFound; record port không được gọi với ID sai.
- [ ] **VIEW-003 [P1]** Trang rỗng, đúng limit, limit+1 → hasMore đúng, chỉ trả limit dòng; cursor dựa dòng cuối thực trả.
- [x] **VIEW-004 [P1]** limit thiếu/0/âm/quá lớn/non-integer → chuẩn hóa hoặc từ chối đúng DTO; không trả không giới hạn. — *Đã phủ (2026-11-24): test/unit/datasets/data-view.spec.ts (DTO Zod: limit 0/2.5/501).*
- [x] **VIEW-005 [P1]** Cursor sai base64/JSON/thiếu row_index hoặc sai kiểu → validation error, không silently về trang đầu. — *Đã phủ (2026-11-24): test/unit/shared/record-keyset-cursor.spec.ts, test/unit/datasets/data-view.spec.ts (DVT-02).*
- [x] **VIEW-006 [P1]** Resolve cN, tên hiện tại, tên gốc → ưu tiên key rồi tên; cột không tồn tại → lỗi. — *Đã phủ (2026-11-24): test/unit/datasets/data-view.spec.ts (DVT-06).*
- [x] **VIEW-007 [P0]** Tên hiển thị chứa '.', '$', '__proto__' hoặc chuỗi giống query → chỉ map sang stable key cho phép; không chèn operator tùy ý vào Mongo query. — *Đã phủ (2026-11-24): test/unit/datasets/data-view.spec.ts (DVT-05), test/integration/record-query.spec.ts (DV-6).*
- [ ] **VIEW-008 [P1]** equals/notEquals với số, string, boolean và null → đúng kiểu so sánh, không gộp 0/false với rỗng.
- [ ] **VIEW-009 [P1]** contains/notContains/startsWith/endsWith với ký tự regex đặc biệt → literal theo contract, không thực thi regex do user chèn ngoài ý muốn.
- [x] **VIEW-010 [P1]** greater/greaterOrEqual/less/lessOrEqual → kiểm tra giá trị đúng biên và hai phía; số/ngày sai không bị so sánh sai âm thầm. — *Đã phủ (2026-11-24): test/integration/record-query.spec.ts (DVT-07).*
- [ ] **VIEW-011 [P1]** between với hai đầu bằng nhau/đảo thứ tự/thiếu đầu; in với rỗng/nhiều giá trị → hành vi rõ theo validator.
- [x] **VIEW-012 [P1]** isEmpty/isNotEmpty cho null/undefined/''/whitespace/0/false → bám định nghĩa đã duyệt; ghi khác biệt với DQ nếu có. — *Đã phủ (2026-11-24): test/integration/record-query.spec.ts (DVT-10).*
- [x] **VIEW-013 [P1]** AND/OR gồm điều kiện cùng cột/khác cột → đúng giao/hợp; operator lạ → từ chối. — *Đã phủ (2026-11-24): test/integration/record-query.spec.ts (DVT-06).*
- [x] **VIEW-014 [P1]** Search kết hợp filter và cursor → đúng thứ tự xử lý, không bỏ filter khi sang trang mới. — *Đã phủ (2026-11-25): test/integration/record-query.spec.ts (DLT-06), test/unit/datasets/data-view.spec.ts (DLT-05).*
- [x] **VIEW-015 [P1]** Sort tăng/giảm, giá trị trùng/null → ổn định; cursor row_index khi sort cột khác cần ca bắt bỏ sót/lặp dòng. — *Đã phủ (2026-11-24): test/integration/record-query.spec.ts (DVT-01, DV-5).*
- [ ] **VIEW-016 [P0]** Lọc/sort/search → chỉ gọi query, không update records/dataset hoặc tự chạy analysis.
- [x] **VIEW-017 [P1]** Stats cột số theo key hoặc tên → cùng kết quả; cột không tồn tại → NotFound; không phải số → đúng response contract. — *Đã phủ (2026-11-24): test/unit/datasets/data-view.spec.ts, test/integration/record-query.spec.ts (DV-14).*
- [x] **VIEW-018 [P1]** Stats với rỗng/toàn thiếu/giá trị không hợp lệ → không NaN/Infinity; valid count và excluded count rõ. — *Đã phủ (2026-11-24): test/integration/record-query.spec.ts (DVT-11).*
- [ ] **VIEW-019 [P0]** Dữ liệu hai dataset có cùng rowIndex → query luôn scope datasetId; không trộn records.
- [ ] **VIEW-020 [P1]** Tên cột đổi sau import → Data Views trả tên mới nhưng giá trị từng key giữ nguyên; tên trùng phải còn phân biệt key.
- [x] **VIEW-021 [P0]** Không có use case updateCell trong phạm vi hiện tại → không tạo test giả cho endpoint không tồn tại; yêu cầu xóa dòng cũ ghi GAP-005. — *Đã phủ (2026-11-24): test/unit/datasets/data-view.spec.ts (không có updateCell).*
- [x] **VIEW-022 [P1]** Cursor dùng lại với `filters`/`search` khác, quá 24 giờ, dạng cũ (cấp trước v16), thời điểm cấp ở tương lai → `VALIDATION_ERROR` với `details.reason` đúng (`cursor_query_mismatch` / `cursor_expired`); đổi thứ tự filter hoặc `limit` vẫn hợp lệ. — *Đã phủ (2026-11-25): test/unit/shared/record-keyset-cursor.spec.ts (DLT-01…04), test/unit/datasets/data-view.spec.ts (DLT-05), test/integration/record-query.spec.ts (DLT-06).*
- [x] **VIEW-023 [P1]** Chuỗi ngày legacy không múi giờ / có `Z` / có dấu cách / rác → khớp `equals`/`in`/`between`/so sánh và sort như `Date` nạp qua `coerceDate` (UTC+7); so sánh thứ tự không khớp ô trống. — *Đã phủ (2026-11-25): test/integration/record-query.spec.ts (DLT-07, DLT-08).*
