# 12. Logic xử lý dữ liệu và phạm vi AI

- **Version:** v1
- **Ngày tạo:** 2026-11-02
- **Trạng thái:** Khung chờ thảo luận lần đầu — chưa phê duyệt nội dung chi tiết.
- **Giai đoạn:** Logic/AI solution
- **Thứ tự thực hiện:** Phần 12; sử dụng kết quả đã xác nhận của các phần trước.

## 1. Mục tiêu

Làm rõ và thống nhất logic xử lý dữ liệu và phạm vi ai cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Thuật toán và quy tắc xử lý cho từng use case đã chọn.
- Streaming/batch, chuẩn hóa schema, cleaning, versioning và integrity theo tính năng được duyệt.
- Vai trò AI trong backend nếu thuộc phạm vi; input/output, dữ liệu gửi ra ngoài, phê duyệt và fallback.
- Nếu AI không thuộc đợt này, ghi rõ xác nhận loại khỏi phạm vi; không tự mặc định triển khai.

## 3. Quyết định và thiết kế chi tiết

Đã ghi nhận hướng tích hợp từ thảo luận tính năng; thiết kế chi tiết phần 12 chưa hoàn tất.

- Dùng API mô hình bên ngoài, chưa chọn nhà cung cấp/model; không yêu cầu huấn luyện hoặc vận hành mô hình riêng trong đợt này.
- Backend tính toán các chỉ số và chuẩn bị kết quả/bằng chứng thống kê tổng hợp có cấu trúc; AI hỗ trợ Detection bổ sung, giải thích, nhận xét và đề xuất dựa trên thống kê được cung cấp. Backend kiểm tra phản hồi, đối chiếu số liệu và tham chiếu bằng chứng trước khi hiển thị; không chấp nhận kết luận lỗi từng ô/dòng không có bằng chứng.
- Gọi AI qua port, triển khai API nhà cung cấp ở adapter. Chưa chốt schema input/output, thuật toán kiểm chứng hoặc thư viện.
- Nội dung mỗi phát hiện AI đã chốt: vấn đề, cột liên quan, bằng chứng thống kê, mức độ ảnh hưởng, giải thích và đề xuất xử lý. Phân biệt nghi vấn cần kiểm tra thêm với vấn đề hệ thống đã xác nhận; AI không tự biến nghi vấn thành vấn đề đã xác nhận. Schema kỹ thuật sẽ được bàn sau.
- Phạm vi gửi ra ngoài đã chốt: chỉ kết quả thống kê; không gửi file gốc, mẫu dòng hoặc giá trị ô dữ liệu gốc. Chi tiết định danh cột và biểu diễn nhãn nhóm còn cần thiết kế, không mặc nhiên cho phép gửi giá trị gốc qua nhãn nhóm. Cần cân nhắc giới hạn đầu vào, chi phí, thời gian đáp ứng và khả năng bỏ sót khi chỉ gửi thống kê.
- Giữ các quy tắc tại phần 2: AI lỗi vẫn có Tổng kết từ kết quả hệ thống, không có giải thích/đề xuất AI; được thử lại riêng AI nếu đầu vào không đổi; AI không tự sửa dữ liệu.

### 3.1. Mức độ ảnh hưởng và kiểm chứng AI đã xác nhận

- Backend quyết định mức ảnh hưởng theo quy tắc tái lập được: **Thấp** (ảnh hưởng hạn chế), **Trung bình** (có khả năng làm sai lệch kết quả, cần kiểm tra), **Cao** (ảnh hưởng lớn đến độ tin cậy hoặc khiến một phép phân tích không thực hiện được). Đánh giá phải gắn với phép phân tích/phạm vi cụ thể, không suy rộng sang cả dataset.
- **Chưa đủ cơ sở** là trạng thái khi thiếu quy tắc hoặc ngữ cảnh đánh giá, không phải mức Thấp. Mỗi đánh giá cần lý do, phạm vi và quy tắc áp dụng. Chưa có ngữ cảnh nghiệp vụ nên chỉ đánh giá ảnh hưởng đến phân tích; ngưỡng theo từng loại vấn đề còn cần chốt, không áp dụng một ngưỡng chung.
- Trạng thái xác minh tách biệt mức ảnh hưởng: **Đã xác nhận bằng kiểm tra hệ thống** hoặc **Nghi vấn cần kiểm tra**. Phép tính xác nhận hiện tượng không tự xác nhận nguyên nhân hoặc lỗi nghiệp vụ; điểm vượt ngưỡng outlier chưa chắc là dữ liệu sai.
- Đối chiếu từng phát hiện với đúng kết quả của lần phân tích hiện tại, đúng sheet/cấu hình. Loại phát hiện sai số liệu hoặc tham chiếu bằng chứng không tồn tại. Suy diễn quá mức chỉ giữ dạng nghi vấn nếu có bằng chứng hỗ trợ; không chấp nhận như kết luận đã xác nhận. AI không được ghi đè mức ảnh hưởng backend xác định.
- Phản hồi hợp lệ một phần: giữ nhận xét hợp lệ, loại phần không đạt và báo phần nhận xét AI chưa đầy đủ tại Tổng kết. Phản hồi hỏng toàn bộ/không kiểm chứng được: chỉ dùng kết quả hệ thống và cho phép Thử lại AI theo điều kiện đã chốt.
- Đánh đổi: quy tắc backend giúp nhất quán và kiểm thử được nhưng cần xây dựng ngưỡng riêng, có thể bỏ sót ý nghĩa nghiệp vụ. Không chọn để AI tự quyết định toàn bộ mức ảnh hưởng vì khó tái lập và kiểm thử. Kiểm chứng cấu trúc/số liệu chưa bảo đảm mọi diễn giải đều đúng; thuật toán kiểm chứng và tiêu chí đánh giá chi tiết cần thiết kế sau.

### 3.2. Tiêu chí DQ-01/DQ-02 đã xác nhận

- Áp dụng tiêu chí nghiệp vụ tại [phần 2, mục 3.5.1–3.5.2](2_feature_catalog_v1.md#351-dq-01--tiêu-chí-dữ-liệu-thiếu-đã-xác-nhận). Đây là đầu vào thiết kế logic, chưa phải lựa chọn thư viện/thuật toán hoặc hoàn tất phần 12.
- Dữ liệu thiếu: ô không có giá trị, chuỗi rỗng/chỉ khoảng trắng; không tự coi `0`, `false` hoặc các chuỗi ký hiệu là thiếu. Lỗi chuyển kiểu thuộc DQ-03. Tính số lượng/tỷ lệ theo cột và số dòng thiếu một phần/toàn bộ trong phạm vi cột được chọn; không còn dòng thì báo không có dữ liệu, không trả tỷ lệ 0%.
- Dữ liệu trùng: so khớp chính xác giá trị và kiểu sau đọc file trên toàn bộ cột được chọn; không tự chuẩn hóa chữ/dấu/khoảng trắng. Loại dòng thiếu toàn bộ khỏi việc nhóm trùng; dòng thiếu một phần chỉ nhóm khi vị trí thiếu và giá trị còn lại giống nhau, kèm ghi chú có dữ liệu thiếu.
- Phân biệt số nhóm, số dòng trong nhóm và số dòng lặp ngoài một đại diện mỗi nhóm. Bằng chứng trong hệ thống giữ số dòng gốc và cột liên quan; đầu vào AI vẫn chỉ là thống kê tổng hợp. Phát hiện thiếu/trùng không tự chứng minh lỗi nghiệp vụ và không tự xóa dữ liệu.
- Ngưỡng ảnh hưởng từng phép phân tích, trùng theo khóa nghiệp vụ, gần giống, ký hiệu thiếu tùy chỉnh và chi tiết đọc file còn cần bàn. So khớp chính xác dễ tái lập/kiểm thử nhưng chưa bao quát gần giống; không suy đoán khóa duy nhất.

### 3.3. Tiêu chí DQ-03 đã xác nhận

- Áp dụng tiêu chí tại phần 2, mục 3.5.3 và cấu hình Data Views tại mục 3.22. Tách kiểu dữ liệu khỏi vai trò phân tích và cột nhãn; lưu nguồn xác định kiểu/định dạng và thể hiện sự chưa chắc chắn của nhận diện. Chưa chọn thuật toán suy luận kiểu.
- Kiểm tra theo kiểu/định dạng đã chốt, phân biệt sai kiểu, sai định dạng và mơ hồ; không tính ô thiếu thành lỗi kiểu, không âm thầm chuyển lỗi thành thiếu. Cấu hình dấu thập phân/phân nhóm và định dạng ngày phải ngăn diễn giải mơ hồ; không tự bỏ đơn vị, chuẩn hóa văn bản hoặc gán múi giờ. Phân biệt giá trị ngày Excel với định dạng hiển thị. Tập giá trị boolean và chi tiết parser cần thiết kế sau theo phạm vi đã chốt.
- Báo số hợp lệ/không hợp lệ/mơ hồ và tỷ lệ không hợp lệ trên số giá trị không thiếu; mẫu số 0 báo không có dữ liệu để đánh giá. Bằng chứng nội bộ dùng lý do và số dòng gốc; AI chỉ nhận thống kê tổng hợp.
- Cho phép các phân tích không bị ảnh hưởng tiếp tục. Phép tính cần số/ngày chỉ dùng giá trị hợp lệ và công bố số dùng/bị loại riêng cho phép tính, không xóa dữ liệu. Không đủ dữ liệu thì không tính, nêu lý do. Xử lý dòng cho tương quan/VIF tại mục 3.6; số lượng tối thiểu cần bàn riêng. Tổng kết phải nêu nguy cơ sai lệch do loại phần không hợp lệ.
- Thay đổi cấu hình kiểu/vai trò/định dạng tại Data Views yêu cầu phân tích lại; cấu hình được lưu/khôi phục và thay đổi cuối cùng còn hiệu lực xuất hiện trong Tổng kết/PDF. Đây là cấu hình diễn giải dữ liệu, không phải sửa file gốc.

### 3.4. Tiêu chí DQ-04 đã xác nhận

- Áp dụng phần 2, mục 3.5.4: tách miền nghiệp vụ khỏi outliers thống kê. Chưa có quy tắc miền thì báo chưa có quy tắc, không suy từ tên cột/min/max hoặc lời AI.
- Outliers từng cột định lượng được chọn: IQR mặc định với hàng rào 1,5 × IQR, có thể nhận diện thêm ngoài 3 × IQR; hỗ trợ Modified Z-score dùng trung vị/MAD, ngưỡng trị tuyệt đối > 3,5, hoặc chạy cả hai. Tách tập chỉ từng phương pháp phát hiện và phần giao, không cộng trùng.
- Chỉ dùng số hữu hạn hợp lệ, công bố số dùng/bị loại. IQR/MAD bằng 0 báo phương pháp tương ứng không đủ độ phân tán; không kết luận không có outlier. Số lượng quan sát tối thiểu, cách tính tứ phân vị và giới hạn tham số còn cần thiết kế. Không tự chuyển phương pháp, biến đổi hoặc chia nhóm ngoài cấu hình.
- Báo phương pháp, tham số, ngưỡng, số lượng/tỷ lệ, số quan sát và bằng chứng dòng gốc; AI chỉ nhận thống kê. Không tự loại outliers khỏi thống kê thông thường hoặc gán mức Cao từ độ xa thống kê/đồng thuận hai phương pháp. Box plot/histogram chỉ từng cột; đa biến và bất thường thời gian cần logic riêng.
- Cấu hình phương pháp/ngưỡng tại Data Views được lưu/khôi phục, thể hiện trong Tổng kết/PDF và thay đổi yêu cầu phân tích lại. Giới hạn: phân bố lệch/nhiều nhóm có thể gây nhiều cảnh báo; phát hiện vượt ngưỡng không chứng minh dữ liệu sai. Thiết kế chi tiết phần 12 chưa hoàn tất.

### 3.5. DQ-05 — Giữ giới hạn phạm vi hiện tại

- Theo phần 2, mục 3.5.5: tiếp tục hoãn nhập/cấu hình quy tắc nghiệp vụ, không thêm mẫu quy tắc tại Data Views trong đợt này. Chưa có quy tắc quan hệ được xác nhận thì báo Chưa đánh giá kèm lý do, không báo đạt/không có mâu thuẫn.
- Không suy quy tắc từ tên cột, đa số dữ liệu hoặc AI. Các phân tích tương quan/VIF/quan hệ vẫn thực hiện theo phạm vi riêng; kết quả thống kê không tự chứng minh mâu thuẫn nghiệp vụ. AI chỉ nhận xét trên thống kê, không tự xác nhận lỗi hay cần dữ liệu dòng để thực hiện phạm vi này.
- Nghiệm thu hiện tại kiểm tra việc thể hiện đúng trạng thái và giới hạn đánh giá; chưa nghiệm thu khả năng phát hiện đầy đủ mâu thuẫn nghiệp vụ. Logic kiểm tra quan hệ theo quy tắc và cấu hình quy tắc sẽ bàn khi mở rộng phạm vi. Đánh đổi: tránh kết luận thiếu cơ sở nhưng chưa phát hiện được vi phạm nghiệp vụ khi thiếu quy tắc.

### 3.6. Phân tích liên hệ và VIF đã xác nhận

- Áp dụng phần 2, mục 3.23: số–số mặc định Pearson và Spearman (có thể chọn một tại Data Views); phân loại–phân loại Cramér’s V; số–phân loại η² kèm thống kê từng nhóm. Không tự thêm ANOVA/p-value hoặc dùng chung thang diễn giải cho mọi chỉ số. Không suy nhân quả hay lỗi nghiệp vụ từ liên hệ.
- Theo cặp: chỉ dùng dòng hợp lệ ở cả hai cột, báo số dùng/bị loại và lý do; không tự điền thiếu, xóa dữ liệu, gộp nhóm hiếm hoặc bỏ outliers. Cột hằng/thiếu nhóm/thiếu dữ liệu báo không tính được, không trả 0. Cảnh báo giới hạn tập dòng khác nhau, nhóm quá nhỏ/quá nhiều.
- VIF: ít nhất hai cột số định lượng phù hợp, loại nhãn và định danh, không mã hóa phân loại; dùng tập dòng hợp lệ chung cho toàn bộ cột tham gia. Báo cột hằng bị loại, danh sách cột và số dòng thực tế; kiểm tra số quan sát/phụ thuộc tuyến tính. Phụ thuộc hoàn hảo phải được biểu diễn rõ, không thay vô hạn bằng số hữu hạn tùy ý.
- VIF > 5 là cảnh báo tham khảo cần kiểm tra, không tự gán lỗi/mức ảnh hưởng Cao hoặc xóa cột. Hiển thị bảng chỉ số và điều kiện tính, không bổ sung biểu đồ giữa các cột. Cấu hình tại Data Views theo quy tắc lưu và vô hiệu hóa kết quả cũ đã chốt.
- Chi tiết số quan sát tối thiểu, ngưỡng nhóm thưa, ổn định số học và thuật toán/thư viện triển khai còn cần thiết kế, chưa hoàn tất phần 12.

### 3.7. Mất cân bằng lớp đã xác nhận

- Áp dụng phần 2, mục 3.24: cần nhãn phân loại do người dùng chọn; phân biệt chưa chọn nhãn, nhãn liên tục không áp dụng, không có nhãn hợp lệ và chỉ quan sát một lớp. Không tự chia khoảng nhãn liên tục hoặc suy loại nhãn chỉ từ giá trị số nguyên.
- Với ít nhất hai lớp: thống kê số lượng/tỷ lệ từng lớp trên dòng nhãn hợp lệ, số lớp và các lớp lớn nhất/nhỏ nhất kể cả đồng hạng; IR = số mẫu lớn nhất / nhỏ nhất. Báo riêng nhãn thiếu/không hợp lệ, không biến thiếu thành lớp; thiếu đặc trưng khác không loại dòng. Giữ phạm vi toàn bộ sheet đang làm việc, không phụ thuộc lọc hiển thị và không tự gộp nhãn/xóa trùng.
- IR ≥ 3 là cảnh báo mặc định do dự án chọn, không phải ngưỡng chuẩn chung hoặc bằng chứng dữ liệu sai. Không tự gán ảnh hưởng Cao; xét cả số mẫu tuyệt đối và phân bố đầy đủ. Ngưỡng lớp ít mẫu còn mở.
- Bảng đủ lớp, biểu đồ cột có thể dùng Top N; Khác chỉ là hiển thị, mọi chỉ số tính trên lớp gốc. AI chỉ dùng thống kê và không tự kết luận hiệu năng mô hình. Không tự cân bằng/sinh/xóa mẫu hoặc huấn luyện mô hình.
- Nếu cho chỉnh ngưỡng, cấu hình phải ở Data Views và được lưu/thể hiện trong Tổng kết; khả năng chỉnh và giới hạn cụ thể chưa chốt. Chi tiết triển khai và kiểm thử sẽ thiết kế sau.

### 3.8. Phân tích thời gian đã xác nhận

- Áp dụng phần 2, mục 3.15. Trong các cột đã chọn phân tích, tự chọn khi chỉ có một cột thời gian phù hợp, yêu cầu chọn nếu nhiều cột; không có thì báo không áp dụng. Cấu hình tại Data Views: cột, mức ngày/tuần/tháng/năm (mặc định ngày, tuần từ thứ Hai), chỉ số, ngưỡng và múi giờ khi cần. Không tự gán múi giờ cho dữ liệu không có.
- Luôn có số bản ghi mỗi kỳ; cột số định lượng được chọn theo dõi mặc định trung vị, cho chọn trung bình/min/max và tổng theo lựa chọn chủ động. Công bố số hợp lệ/thiếu/không hợp lệ theo kỳ, giữ outliers. Ngày không hợp lệ/thiếu/mơ hồ không dùng tổng hợp, báo số lượng/lý do, không xóa dòng dataset.
- Tạo kỳ trong khoảng thời gian hợp lệ quan sát được. Kỳ trống: số bản ghi 0, thống kê giá trị không có dữ liệu kể cả tổng, không nội suy/nối qua khoảng trống. Báo số kỳ, danh sách và chuỗi kỳ trống dài nhất; chưa có lịch kỳ vọng thì không gọi là mất dữ liệu. Bản ghi cùng thời điểm không tự coi là trùng lỗi.
- Tính chênh lệch tuyệt đối giữa kỳ liền trước khi hợp lệ; phần trăm chỉ khi giá trị kỳ trước dương. Không bỏ qua kỳ trống để so với kỳ xa hơn. IQR hệ số 1,5 trên chênh lệch kỳ liên tiếp hợp lệ để sàng lọc Biến động lớn cần kiểm tra; thiếu mẫu hoặc IQR = 0 báo chưa đủ điều kiện.
- Nêu giới hạn do mùa vụ, độ dài tháng, kỳ biên có thể chỉ quan sát một phần và số mẫu ít. Chưa phân rã xu hướng–mùa vụ hoặc dự báo. Giữ bảng/biểu đồ thời gian; cấu hình thay đổi yêu cầu chạy lại và được lưu/thể hiện trong Tổng kết/PDF. Số kỳ tối thiểu, biên kỳ, giới hạn tham số và xử lý múi giờ chi tiết cần thiết kế sau.

## 4. Đầu vào và đầu ra

- **Đầu vào:** Yêu cầu người dùng, kết quả các phần trước và mã nguồn/tài liệu hiện trạng liên quan.
- **Đầu ra:** Hoàn thiện kế hoạch lần đầu trong file v1 này; ghi rõ quyết định, lý do, phương án khác, trade-off, rủi ro, giới hạn và ảnh hưởng liên quan.

## 5. Điều kiện hoàn tất phần này

Logic, trường hợp biên và tiêu chí đánh giá được xác nhận; rà lại các thiết kế trước nếu có ảnh hưởng.

## 6. Câu hỏi và phụ thuộc còn mở

Chưa lập câu hỏi chi tiết; sẽ bổ sung khi đến lượt thảo luận phần này. Nếu phát hiện mâu thuẫn với phần trước, cần xác nhận lại và cập nhật version phù hợp trước khi thực hiện công việc phụ thuộc.

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v1 / 2026-11-03:** Ghi nhận tổng hợp thời gian, khoảng trống và sàng lọc IQR trên chênh lệch kỳ / Người dùng đồng ý đề xuất / Bổ sung mục 3.8 làm đầu vào thiết kế logic/kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận đánh giá mất cân bằng lớp và ngưỡng IR ≥ 3 theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.7 làm đầu vào thiết kế logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận phương pháp liên hệ ba loại cặp và VIF theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.6 và đồng bộ xử lý dữ liệu không hợp lệ tại DQ-03, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** DQ-05 giữ hoãn cấu hình quy tắc và báo chưa đánh giá khi chưa có quy tắc xác nhận / Người dùng chọn giữ phạm vi hiện tại / Bổ sung mục 3.5, không mở rộng logic hoặc triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận DQ-04 và phương pháp outliers từng cột theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.4 làm đầu vào logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận DQ-03 và cấu hình kiểu/định dạng, minh bạch phần dữ liệu hợp lệ dùng trong phân tích / Người dùng đồng ý đề xuất / Bổ sung mục 3.3 làm đầu vào thiết kế logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận tiêu chí DQ-01/DQ-02 đã được người dùng đồng ý tại phần 2 / Làm đầu vào cho logic xử lý và kiểm thử / Bổ sung mục 3.2, chưa triển khai backend hoặc chốt các tiêu chí còn mở.
- **Xác nhận v1 / 2026-11-03:** Backend xác định ba mức ảnh hưởng hoặc Chưa đủ cơ sở; tách trạng thái xác minh và xử lý mâu thuẫn từng phát hiện AI / Người dùng đồng ý phương án / Bổ sung mục 3.1 làm đầu vào thiết kế logic và kiểm thử sau, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Chốt sáu nội dung mỗi phát hiện AI và phân biệt nghi vấn/vấn đề hệ thống đã xác nhận / Theo xác nhận người dùng / Làm đầu vào cho thiết kế phản hồi và kiểm chứng, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** AI chỉ nhận kết quả thống kê / Theo lựa chọn người dùng / Cập nhật phạm vi đầu vào và giới hạn bằng chứng; chưa triển khai hoặc gửi dữ liệu ra ngoài.
- **Ghi nhận v1 / 2026-11-03:** Hướng dùng API mô hình ngoài và phân chia trách nhiệm backend/AI đã được đồng ý trong thảo luận tính năng / Theo xác nhận người dùng / Là đầu vào cho thiết kế chi tiết sau, chưa triển khai hoặc gửi dữ liệu ra ngoài.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 12 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.

