# Data Views: đọc, lọc, sắp xếp và thống kê cột

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/data-view/application; modules/data-view/domain; modules/datasets/infrastructure/persistence/record-query.repository.ts.
- Cô lập dependency: record-query/dataset ports; model stub khi kiểm tra query builder.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **VIEW-001 [P1]** Get records hợp lệ → đúng items và meta nextCursor/hasMore/limit, không thêm offset/total ngoài contract.
- [ ] **VIEW-002 [P1]** ID dataset sai/không tồn tại → validation/NotFound; record port không được gọi với ID sai.
- [ ] **VIEW-003 [P1]** Trang rỗng, đúng limit, limit+1 → hasMore đúng, chỉ trả limit dòng; cursor dựa dòng cuối thực trả.
- [ ] **VIEW-004 [P1]** limit thiếu/0/âm/quá lớn/non-integer → chuẩn hóa hoặc từ chối đúng DTO; không trả không giới hạn.
- [ ] **VIEW-005 [P1]** Cursor sai base64/JSON/thiếu row_index hoặc sai kiểu → validation error, không silently về trang đầu.
- [ ] **VIEW-006 [P1]** Resolve cN, tên hiện tại, tên gốc → ưu tiên key rồi tên; cột không tồn tại → lỗi.
- [ ] **VIEW-007 [P0]** Tên hiển thị chứa '.', '$', '__proto__' hoặc chuỗi giống query → chỉ map sang stable key cho phép; không chèn operator tùy ý vào Mongo query.
- [ ] **VIEW-008 [P1]** equals/notEquals với số, string, boolean và null → đúng kiểu so sánh, không gộp 0/false với rỗng.
- [ ] **VIEW-009 [P1]** contains/notContains/startsWith/endsWith với ký tự regex đặc biệt → literal theo contract, không thực thi regex do user chèn ngoài ý muốn.
- [ ] **VIEW-010 [P1]** greater/greaterOrEqual/less/lessOrEqual → kiểm tra giá trị đúng biên và hai phía; số/ngày sai không bị so sánh sai âm thầm.
- [ ] **VIEW-011 [P1]** between với hai đầu bằng nhau/đảo thứ tự/thiếu đầu; in với rỗng/nhiều giá trị → hành vi rõ theo validator.
- [ ] **VIEW-012 [P1]** isEmpty/isNotEmpty cho null/undefined/''/whitespace/0/false → bám định nghĩa đã duyệt; ghi khác biệt với DQ nếu có.
- [ ] **VIEW-013 [P1]** AND/OR gồm điều kiện cùng cột/khác cột → đúng giao/hợp; operator lạ → từ chối.
- [ ] **VIEW-014 [P1]** Search kết hợp filter và cursor → đúng thứ tự xử lý, không bỏ filter khi sang trang mới.
- [ ] **VIEW-015 [P1]** Sort tăng/giảm, giá trị trùng/null → ổn định; cursor row_index khi sort cột khác cần ca bắt bỏ sót/lặp dòng.
- [ ] **VIEW-016 [P0]** Lọc/sort/search → chỉ gọi query, không update records/dataset hoặc tự chạy analysis.
- [ ] **VIEW-017 [P1]** Stats cột số theo key hoặc tên → cùng kết quả; cột không tồn tại → NotFound; không phải số → đúng response contract.
- [ ] **VIEW-018 [P1]** Stats với rỗng/toàn thiếu/giá trị không hợp lệ → không NaN/Infinity; valid count và excluded count rõ.
- [ ] **VIEW-019 [P0]** Dữ liệu hai dataset có cùng rowIndex → query luôn scope datasetId; không trộn records.
- [ ] **VIEW-020 [P1]** Tên cột đổi sau import → Data Views trả tên mới nhưng giá trị từng key giữ nguyên; tên trùng phải còn phân biệt key.
- [ ] **VIEW-021 [P0]** Không có use case updateCell trong phạm vi hiện tại → không tạo test giả cho endpoint không tồn tại; yêu cầu xóa dòng cũ ghi GAP-005.
