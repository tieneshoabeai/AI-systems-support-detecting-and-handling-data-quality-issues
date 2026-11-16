# Analysis: thuật toán thống kê và chất lượng dữ liệu

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/analysis/domain/dq.util.ts; stats.util.ts; correlation.util.ts; vif.util.ts.
- Cô lập dependency: Không mock phép tính đang kiểm tra; fixture nhỏ với đáp án tính độc lập, epsilon khi so số thực.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **STAT-001 [P0]** Missing với [null, undefined, '', ' ', 0, false, 'NA', 'null'] → đúng 4 giá trị thiếu; 0/false/text NA không thiếu.
- [ ] **STAT-002 [P1]** Không có dòng → tỷ lệ thiếu/invalid không giả bằng 0%; trả null/trạng thái không có dữ liệu.
- [ ] **STAT-003 [P1]** Ba dòng {a:null,b:1},{a:'',b:null},{a:2,b:3} → a thiếu 2/3, b thiếu 1/3, một dòng thiếu toàn bộ và một dòng thiếu một phần.
- [ ] **STAT-004 [P1]** Chỉ chọn a thay vì a,b → missing và duplicate chỉ tính trên cột chọn, không chịu filter hiển thị.
- [ ] **STAT-005 [P1]** Duplicate chính xác: hai dòng giống nhau, một dòng khác → một nhóm, phân biệt số dòng tham gia và số dư theo output hiện tại.
- [ ] **STAT-006 [P1]** Dòng toàn thiếu → không gom duplicate; dòng thiếu một phần trùng vị trí/value → nhóm có ghi chú partial missing.
- [ ] **STAT-007 [P1]** '1' khác 1, 'A' khác 'a', có/không khoảng trắng → không tự normalize để tạo duplicate.
- [ ] **STAT-008 [P1]** Duplicate có rowIndex không liên tục → evidence giữ chỉ số gốc fixture, không vị trí mảng.
- [ ] **STAT-009 [P1]** DQ03: ô thiếu không tính invalid; number không parse được → invalid; valid+missing+invalid khớp số dòng.
- [ ] **STAT-010 [P1]** Number NaN/Infinity, chuỗi số, ngày invalid, boolean vocab hợp lệ/không hợp lệ → kết quả có reason, không tính trên giá trị không hữu hạn.
- [ ] **STAT-011 [P1]** DQ03 toàn thiếu → invalidRate null; kiểm tra mẫu số là nonmissing, không total rows.
- [ ] **STAT-012 [P1]** Mô tả [1,2,3,4] → min=1, max=4, mean=median=2.5; quartile/variance theo convention được ghi rõ, không sao chép kết quả từ hàm đang test.
- [ ] **STAT-013 [P1]** Một số, toàn số bằng nhau, số âm, số rất lớn, dữ liệu đảo thứ tự → thống kê xác định, không mutate mảng đầu vào.
- [ ] **STAT-014 [P1]** Mô tả categorical/boolean → frequency, valid/missing/invalid đúng; các giá trị khác kiểu không bị trộn ngoài contract.
- [ ] **STAT-015 [P1]** Outlier dưới/đúng/trên IQR fence → chỉ ngoài fence bị đánh dấu; IQR=0 phải báo không đủ phân tán.
- [ ] **STAT-016 [P1]** Modified Z ngay dưới/bằng/trên abs=3.5 → đúng ngưỡng strict; MAD=0 không chia 0.
- [ ] **STAT-017 [P1]** Outlier 0/1/3/4 observations → kiểm tra min 4 hiện tại; chọn IQR/Z/both → union/intersection không đếm hai lần.
- [ ] **STAT-018 [P1]** IQR 1.5 và 3 → phân biệt mức thống kê, không tự gán tác hại nghiệp vụ; không xóa outlier khỏi dữ liệu.
- [ ] **STAT-019 [P1]** Pearson [1,2,3] với [2,4,6] → gần +1; với [6,4,2] → gần −1; đổi thứ tự hai cột không đổi hệ số.
- [ ] **STAT-020 [P1]** Spearman dữ liệu monotonic không tuyến tính và tied ranks → thứ hạng trung bình đúng; không dùng Pearson như thay thế.
- [ ] **STAT-021 [P1]** Pairwise missing: thiếu cột thứ ba không loại cặp a,b; used/excluded A/B/both cộng đúng total.
- [ ] **STAT-022 [P1]** Một cột hằng, thiếu quan sát, toàn missing → hệ số null kèm reason, không báo 0 như không tương quan.
- [ ] **STAT-023 [P1]** Cramér V: categorical độc lập/hoàn toàn liên hệ, một nhóm, bảng thưa → giá trị trong [0,1] hoặc reason; không có dấu âm.
- [ ] **STAT-024 [P1]** Eta squared nhóm có mean giống/khác nhau, chỉ một nhóm, không có giá trị số → đúng miền hoặc không đánh giá; không khẳng định nhân quả.
- [ ] **STAT-025 [P1]** Matrix mixed numeric/categorical/date → chọn phương pháp đúng từng cặp, date bị loại có lý do; không NaN/Infinity trong JSON.
- [ ] **STAT-026 [P1]** VIF chỉ 0/1 cột phù hợp → không tính; cột hằng bị loại riêng và giữ reason.
- [ ] **STAT-027 [P1]** VIF cột độc lập/gần phụ thuộc/phụ thuộc tuyến tính hoàn hảo → không bịa giá trị hữu hạn khi singular; báo đúng trạng thái.
- [ ] **STAT-028 [P1]** VIF dùng cùng tập dòng hợp lệ cho mọi predictor → commonN đúng, khác pairwise của correlation; lossWarning kiểm tra dưới/bằng/trên ngưỡng code.
- [ ] **STAT-029 [P1]** Imbalance chưa chọn nhãn → no_label; nhãn number/date → not_applicable theo code hiện tại; không tự bin.
- [ ] **STAT-030 [P1]** Nhãn A,A,A,B → tỷ lệ .75/.25, IR=3 và cảnh báo; thiếu nhãn không vào mẫu số, thiếu feature khác không loại dòng.
- [ ] **STAT-031 [P1]** Nhãn toàn thiếu, một lớp, hai lớp bằng nhau → ba kết quả khác nhau; không gọi một lớp là cân bằng.
- [ ] **STAT-032 [P1]** Time không có cột/chỉ ngày sai → no_time/no_data; phân biệt missingDates và invalidDates.
- [ ] **STAT-033 [P1]** Day/week/month/year với nhiều record cùng thời điểm → tổng hợp đúng; tuần bắt đầu thứ Hai, kiểm tra giao tháng/năm và năm nhuận.
- [ ] **STAT-034 [P1]** Khoảng giữa hai kỳ không có record → bucket count=0, số đo null, không nội suy; không tự thêm kỳ ngoài min/max.
- [ ] **STAT-035 [P1]** Chênh lệch hai kỳ liên tiếp, kỳ trước 0/âm/thiếu → không chia 0 hoặc vượt qua kỳ rỗng để tạo xu hướng giả.
- [ ] **STAT-036 [P1]** Gap nhiều đoạn và kỳ biên chưa đủ → longest gap/count đúng, nêu giới hạn; timezone/DST cần OPEN-05.
- [ ] **STAT-037 [P0]** DQ05 không có rule → unassessed, không suy mâu thuẫn nghiệp vụ từ correlation/VIF/AI.
