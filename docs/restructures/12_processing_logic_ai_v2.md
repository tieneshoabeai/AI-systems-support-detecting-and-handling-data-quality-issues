# 12. Logic xử lý dữ liệu và phạm vi AI

- **Version:** v2
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-04
- **Trạng thái:** Đã bổ sung thiết kế logic chạy được cho AI (nhà cung cấp Gemini, cơ chế bất đồng bộ, ranh giới dữ liệu che PII), ngưỡng ảnh hưởng và số mẫu tối thiểu theo phần 2 mục 3.29, cùng logic nhập file/sheet, xóa dòng/sửa ô và dấu vân tay đầu vào. Còn mở: schema kỹ thuật port AI, thư viện thống kê, chi tiết che PII.
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

Đã ghi nhận hướng tích hợp từ thảo luận tính năng; v2 bổ sung nhà cung cấp, cơ chế chạy và ranh giới dữ liệu.

- Dùng API mô hình bên ngoài. **Nhà cung cấp đã chốt: Google Gemini API** (model Flash miễn phí của Gemini Free Tier); không yêu cầu huấn luyện hoặc vận hành mô hình riêng trong đợt này.
- Backend tính toán các chỉ số và chuẩn bị kết quả/bằng chứng thống kê tổng hợp có cấu trúc; AI hỗ trợ Detection bổ sung, giải thích, nhận xét và đề xuất dựa trên thống kê được cung cấp. Backend kiểm tra phản hồi, đối chiếu số liệu và tham chiếu bằng chứng trước khi hiển thị; không chấp nhận kết luận lỗi từng ô/dòng không có bằng chứng.
- Gọi AI qua port, triển khai API nhà cung cấp ở adapter. Chưa chốt schema input/output, thuật toán kiểm chứng hoặc thư viện.
- Nội dung mỗi phát hiện AI đã chốt: vấn đề, cột liên quan, bằng chứng thống kê, mức độ ảnh hưởng, giải thích và đề xuất xử lý. Phân biệt nghi vấn cần kiểm tra thêm với vấn đề hệ thống đã xác nhận; AI không tự biến nghi vấn thành vấn đề đã xác nhận. Schema kỹ thuật sẽ được bàn sau.
- **Phạm vi gửi ra ngoài (v2):** thống kê tổng hợp **và tối đa 20 ô lỗi/cột đã che PII**. Không gửi file gốc, không gửi toàn bộ tập bản ghi, không gửi ảnh chụp màn hình lỗi. Chi tiết định danh cột và biểu diễn nhãn nhóm còn cần thiết kế, không mặc nhiên cho phép gửi giá trị gốc qua nhãn nhóm. Chi tiết ở mục 3.9 và 3.10.
- V2 bổ sung giới hạn đầu vào (số cột, số mẫu/cột, độ dài mô tả lỗi), chi phí (quota Free Tier), thời gian đáp ứng (timeout 60s) và khả năng bỏ sót khi chỉ gửi thống kê — việc gửi mẫu ô đã che PII làm giảm rủi ro bỏ sót loại lỗi không mô tả được bằng thống kê.
- Giữ các quy tắc tại phần 2: AI lỗi vẫn có Tổng kết từ kết quả hệ thống, không có giải thích/đề xuất AI; được thử lại riêng AI nếu đầu vào không đổi; AI không tự sửa dữ liệu.

### 3.1. Mức độ ảnh hưởng và kiểm chứng AI đã xác nhận

- Backend quyết định mức ảnh hưởng theo quy tắc tái lập được: **Thấp** (ảnh hưởng hạn chế), **Trung bình** (có khả năng làm sai lệch kết quả, cần kiểm tra), **Cao** (ảnh hưởng lớn đến độ tin cậy hoặc khiến một phép phân tích không thực hiện được). Đánh giá phải gắn với phép phân tích/phạm vi cụ thể, không suy rộng sang cả dataset.
- **Chưa đủ cơ sở** là trạng thái khi thiếu quy tắc hoặc ngữ cảnh đánh giá, không phải mức Thấp. Mỗi đánh giá cần lý do, phạm vi và quy tắc áp dụng. Chưa có ngữ cảnh nghiệp vụ nên chỉ đánh giá ảnh hưởng đến phân tích; ngưỡng theo từng loại vấn đề còn cần chốt, không áp dụng một ngưỡng chung.
- Trạng thái xác minh tách biệt mức ảnh hưởng: **Đã xác nhận bằng kiểm tra hệ thống** hoặc **Nghi vấn cần kiểm tra**. Phép tính xác nhận hiện tượng không tự xác nhận nguyên nhân hoặc lỗi nghiệp vụ; điểm vượt ngưỡng outlier chưa chắc là dữ liệu sai.
- Đối chiếu từng phát hiện với đúng kết quả của lần phân tích hiện tại, đúng sheet/cấu hình. Loại phát hiện sai số liệu hoặc tham chiếu bằng chứng không tồn tại. Suy diễn quá mức chỉ giữ dạng nghi vấn nếu có bằng chứng hỗ trợ; không chấp nhận như kết luận đã xác nhận. AI không được ghi đè mức ảnh hưởng backend xác định.
- Phản hồi hợp lệ một phần: giữ nhận xét hợp lệ, loại phần không đạt và báo phần nhận xét AI chưa đầy đủ tại Tổng kết. Phản hồi hỏng toàn bộ/không kiểm chứng được: chỉ dùng kết quả hệ thống và cho phép Thử lại AI theo điều kiện đã chốt.
- Đánh đổi: quy tắc backend giúp nhất quán và kiểm thử được nhưng cần xây dựng ngưỡng riêng, có thể bỏ sót ý nghĩa nghiệp vụ. Không chọn để AI tự quyết định toàn bộ mức ảnh hưởng vì khó tái lập và kiểm thử. Kiểm chứng cấu trúc/số liệu chưa bảo đảm mọi diễn giải đều đúng; thuật toán kiểm chứng và tiêu chí đánh giá chi tiết cần thiết kế sau.

### 3.2. Tiêu chí DQ-01/DQ-02 đã xác nhận

- Áp dụng tiêu chí nghiệp vụ tại [phần 2, mục 3.5.1–3.5.2](2_feature_catalog_v2.md#351-dq-01--tiêu-chí-dữ-liệu-thiếu-đã-xác-nhận). Đây là đầu vào thiết kế logic, chưa phải lựa chọn thư viện/thuật toán hoặc hoàn tất phần 12.
- Dữ liệu thiếu: ô không có giá trị, chuỗi rỗng/chỉ khoảng trắng; không tự coi `0`, `false` hoặc các chuỗi ký hiệu là thiếu. Lỗi chuyển kiểu thuộc DQ-03. Tính số lượng/tỷ lệ theo cột và số dòng thiếu một phần/toàn bộ trong phạm vi cột được chọn; không còn dòng thì báo không có dữ liệu, không trả tỷ lệ 0%.
- Dữ liệu trùng: so khớp chính xác giá trị và kiểu sau đọc file trên toàn bộ cột được chọn; không tự chuẩn hóa chữ/dấu/khoảng trắng. Loại dòng thiếu toàn bộ khỏi việc nhóm trùng; dòng thiếu một phần chỉ nhóm khi vị trí thiếu và giá trị còn lại giống nhau, kèm ghi chú có dữ liệu thiếu.
- Phân biệt số nhóm, số dòng trong nhóm và số dòng lặp ngoài một đại diện mỗi nhóm. Bằng chứng trong hệ thống giữ số dòng gốc, cột liên quan và giá trị ô; đầu vào AI là thống kê tổng hợp kèm tối đa 20 ô lỗi/cột đã che PII (mục 3.9, 3.10). Phát hiện thiếu/trùng không tự chứng minh lỗi nghiệp vụ và không tự xóa dữ liệu.
- Ngưỡng ảnh hưởng từng phép phân tích, trùng theo khóa nghiệp vụ, gần giống, ký hiệu thiếu tùy chỉnh và chi tiết đọc file còn cần bàn. So khớp chính xác dễ tái lập/kiểm thử nhưng chưa bao quát gần giống; không suy đoán khóa duy nhất.

### 3.3. Tiêu chí DQ-03 đã xác nhận

- Áp dụng tiêu chí tại phần 2, mục 3.5.3 và cấu hình Data Views tại mục 3.22. Tách kiểu dữ liệu khỏi vai trò phân tích và cột nhãn; lưu nguồn xác định kiểu/định dạng và thể hiện sự chưa chắc chắn của nhận diện. Chưa chọn thuật toán suy luận kiểu.
- Kiểm tra theo kiểu/định dạng đã chốt, phân biệt sai kiểu, sai định dạng và mơ hồ; không tính ô thiếu thành lỗi kiểu, không âm thầm chuyển lỗi thành thiếu. Cấu hình dấu thập phân/phân nhóm và định dạng ngày phải ngăn diễn giải mơ hồ; không tự bỏ đơn vị, chuẩn hóa văn bản hoặc gán múi giờ. Phân biệt giá trị ngày Excel với định dạng hiển thị. Tập giá trị boolean và chi tiết parser cần thiết kế sau theo phạm vi đã chốt.
- Báo số hợp lệ/không hợp lệ/mơ hồ và tỷ lệ không hợp lệ trên số giá trị không thiếu; mẫu số 0 báo không có dữ liệu để đánh giá. Bằng chứng nội bộ dùng lý do, giá trị ô và số dòng gốc; AI nhận thống kê tổng hợp kèm tối đa 20 ô lỗi/cột đã che PII (mục 3.9, 3.10).
- Cho phép các phân tích không bị ảnh hưởng tiếp tục. Phép tính cần số/ngày chỉ dùng giá trị hợp lệ và công bố số dùng/bị loại riêng cho phép tính, không xóa dữ liệu. Không đủ dữ liệu thì không tính, nêu lý do. Xử lý dòng cho tương quan/VIF tại mục 3.6; số lượng tối thiểu cần bàn riêng. Tổng kết phải nêu nguy cơ sai lệch do loại phần không hợp lệ.
- Thay đổi cấu hình kiểu/vai trò/định dạng tại Data Views yêu cầu phân tích lại; cấu hình được lưu/khôi phục và thay đổi cuối cùng còn hiệu lực xuất hiện trong Tổng kết/PDF. Đây là cấu hình diễn giải dữ liệu, không phải sửa file gốc.

### 3.4. Tiêu chí DQ-04 đã xác nhận

- Áp dụng phần 2, mục 3.5.4: tách miền nghiệp vụ khỏi outliers thống kê. Chưa có quy tắc miền thì báo chưa có quy tắc, không suy từ tên cột/min/max hoặc lời AI.
- Outliers từng cột định lượng được chọn: IQR mặc định với hàng rào 1,5 × IQR, có thể nhận diện thêm ngoài 3 × IQR; hỗ trợ Modified Z-score dùng trung vị/MAD, ngưỡng trị tuyệt đối > 3,5, hoặc chạy cả hai. Tách tập chỉ từng phương pháp phát hiện và phần giao, không cộng trùng.
- Chỉ dùng số hữu hạn hợp lệ, công bố số dùng/bị loại. IQR/MAD bằng 0 báo phương pháp tương ứng không đủ độ phân tán; không kết luận không có outlier. Số lượng quan sát tối thiểu, cách tính tứ phân vị và giới hạn tham số còn cần thiết kế. Không tự chuyển phương pháp, biến đổi hoặc chia nhóm ngoài cấu hình.
- Báo phương pháp, tham số, ngưỡng, số lượng/tỷ lệ, số quan sát và bằng chứng dòng gốc; AI nhận thống kê kèm tối đa 20 ô lỗi/cột đã che PII. Không tự loại outliers khỏi thống kê thông thường hoặc gán mức Cao từ độ xa thống kê/đồng thuận hai phương pháp. Box plot/histogram chỉ từng cột; đa biến và bất thường thời gian cần logic riêng.
- Cấu hình phương pháp/ngưỡng tại Data Views được lưu/khôi phục, thể hiện trong Tổng kết/PDF và thay đổi yêu cầu phân tích lại. Giới hạn: phân bố lệch/nhiều nhóm có thể gây nhiều cảnh báo; phát hiện vượt ngưỡng không chứng minh dữ liệu sai. Thiết kế chi tiết phần 12 chưa hoàn tất.

### 3.5. DQ-05 — Giữ giới hạn phạm vi hiện tại

- Theo phần 2, mục 3.5.5: tiếp tục hoãn nhập/cấu hình quy tắc nghiệp vụ, không thêm mẫu quy tắc tại Data Views trong đợt này. Chưa có quy tắc quan hệ được xác nhận thì báo Chưa đánh giá kèm lý do, không báo đạt/không có mâu thuẫn.
- Không suy quy tắc từ tên cột, đa số dữ liệu hoặc AI. Các phân tích tương quan/VIF/quan hệ vẫn thực hiện theo phạm vi riêng; kết quả thống kê không tự chứng minh mâu thuẫn nghiệp vụ. AI chỉ nhận xét trên thống kê kèm mẫu ô đã che PII, không tự xác nhận lỗi hay cần dữ liệu dòng chưa che để thực hiện phạm vi này.
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
- Bảng đủ lớp, biểu đồ cột có thể dùng Top N; Khác chỉ là hiển thị, mọi chỉ số tính trên lớp gốc. AI dùng thống kê kèm mẫu ô đã che PII và không tự kết luận hiệu năng mô hình. Không tự cân bằng/sinh/xóa mẫu hoặc huấn luyện mô hình.
- Nếu cho chỉnh ngưỡng, cấu hình phải ở Data Views và được lưu/thể hiện trong Tổng kết; khả năng chỉnh và giới hạn cụ thể chưa chốt. Chi tiết triển khai và kiểm thử sẽ thiết kế sau.

### 3.8. Phân tích thời gian đã xác nhận

- Áp dụng phần 2, mục 3.15. Trong các cột đã chọn phân tích, tự chọn khi chỉ có một cột thời gian phù hợp, yêu cầu chọn nếu nhiều cột; không có thì báo không áp dụng. Cấu hình tại Data Views: cột, mức ngày/tuần/tháng/năm (mặc định ngày, tuần từ thứ Hai), chỉ số, ngưỡng và múi giờ khi cần. Không tự gán múi giờ cho dữ liệu không có.
- Luôn có số bản ghi mỗi kỳ; cột số định lượng được chọn theo dõi mặc định trung vị, cho chọn trung bình/min/max và tổng theo lựa chọn chủ động. Công bố số hợp lệ/thiếu/không hợp lệ theo kỳ, giữ outliers. Ngày không hợp lệ/thiếu/mơ hồ không dùng tổng hợp, báo số lượng/lý do, không xóa dòng dataset.
- Tạo kỳ trong khoảng thời gian hợp lệ quan sát được. Kỳ trống: số bản ghi 0, thống kê giá trị không có dữ liệu kể cả tổng, không nội suy/nối qua khoảng trống. Báo số kỳ, danh sách và chuỗi kỳ trống dài nhất; chưa có lịch kỳ vọng thì không gọi là mất dữ liệu. Bản ghi cùng thời điểm không tự coi là trùng lỗi.
- Tính chênh lệch tuyệt đối giữa kỳ liền trước khi hợp lệ; phần trăm chỉ khi giá trị kỳ trước dương. Không bỏ qua kỳ trống để so với kỳ xa hơn. IQR hệ số 1,5 trên chênh lệch kỳ liên tiếp hợp lệ để sàng lọc Biến động lớn cần kiểm tra; thiếu mẫu hoặc IQR = 0 báo chưa đủ điều kiện.
- Nêu giới hạn do mùa vụ, độ dài tháng, kỳ biên có thể chỉ quan sát một phần và số mẫu ít. Chưa phân rã xu hướng–mùa vụ hoặc dự báo. Giữ bảng/biểu đồ thời gian; cấu hình thay đổi yêu cầu chạy lại và được lưu/thể hiện trong Tổng kết/PDF. Số kỳ tối thiểu, biên kỳ, giới hạn tham số và xử lý múi giờ chi tiết cần thiết kế sau.

### 3.9. Cơ chế chạy AI (v2)

**Kiến trúc.** Gọi AI qua **port AI**; adapter Gemini thực hiện lời gọi HTTP. Phần AI **không chạy đồng bộ** trong request phân tích: lần phân tích hệ thống hoàn tất và trả kết quả ngay, phần AI được giao một **job** chạy nền.

**Hàng đợi.** Job table trong MongoDB + tiến trình polling nền trong chính API process. Không thêm Redis/BullMQ/Kafka ở đợt này — một hạ tầng event platform đầy đủ nhưng cho một tác vụ AI đơn lẻ thì quá nặng và tăng chi phí vận hành.

**Trạng thái job:** `pending` → `running` → `succeeded` | `failed`. Job lưu: `analysis_id` (kết quả phân tích hệ thống được dùng làm đầu vào), `project_id`, `sheet_id`, `attempt`, `error`, `created_at`, `started_at`, `finished_at`. Job chỉ mang **tham chiếu** tới kết quả phân tích đã lưu, không mang theo bí mật hệ thống.

**Timeout và retry:** timeout mỗi lượt gọi **60 giây**, tối đa **2 lần retry**. Retry chỉ áp dụng cho lỗi tạm thời (timeout, 429, 5xx); lỗi 4xx do payload không hợp lệ thì không retry. Vượt số lần retry thì job `failed`.

**Khôi phục khi restart:** khi API khởi động lại, job ở trạng thái `running` quá hạn phải được quét và chuyển về `pending` (đếm lại số lần retry) hoặc `failed` nếu đã hết lượt. Ngưỡng quá hạn cụ thể thuộc phần 9 (thường dựa trên `started_at` + 60s × số lần retry + đệm).

**Ranh giới hạn định lượng (đầu vào AI):**
- Tối đa **20 ô lỗi/cột** đã che PII.
- Số cột gửi tối đa: cần chốt (xem mục 6.2).
- Độ dài mỗi mô tả lỗi: cắt bớt (ví dụ 200 ký tự) để tránh vượt context.
- Tổng payload: cần chốt (xem mục 6.2). Vượt ngưỡng thì cắt bớt mẫu ô theo thứ tự giảm dần mức độ ảnh hưởng, không cắt thống kê tổng hợp.

**Xử lý lỗi:** AI lỗi **không chặn Tổng kết**. Tổng kết hiển thị kết quả hệ thống không có phần giải thích và đề xuất của AI, kèm thông báo lỗi có kiểm soát. Người có quyền phân tích được **Thử lại AI** khi dữ liệu và cấu hình phân tích không đổi (dùng lại `input_fingerprint` theo mục 3.13).

**Kiểm chứng phản hồi:** phản hồi AI được kiểm tra theo thứ tự — (1) đúng cấu trúc schema; (2) mức độ ảnh hưởng và trạng thái xác minh không vượt quyền backend (AI không được ghi đè); (3) mọi tham chiếu bằng chứng phải tồn tại trong bằng chứng đã lưu; (4) số liệu trích dẫn phải khớp thống kê đã gửi. Phát hiện không vượt kiểm chứng bị loại khỏi kết quả hiển thị.

### 3.10. Ranh giới dữ liệu gửi ra ngoài và che PII (v2)

- **Đầu vào gửi đi:** (a) thống kê tổng hợp theo cột và theo nhóm; (b) tối đa 20 ô lỗi/cột, **đã che PII**; (c) thông tin cấu hình phân tích liên quan (ngưỡng, phương pháp) để AI hiểu bối cảnh.
- **Không gửi:** file gốc, toàn bộ tập bản ghi, ảnh chụp màn hình lỗi, thông tin người dùng (email, tên, tài khoản), khóa hay cấu hình hệ thống.
- **Che PII là bắt buộc**, không phải tuỳ chọn. Ô lỗi chứa dữ liệu nghiệp vụ (họ tên, định danh, email, số điện thoại) phải được che trước khi rời hệ thống. **Nếu không che được thì gửi thống kê tổng hợp thuần túy** — loại bỏ mẫu ô khỏi payload thay vì gửi giá trị thô.
- **Gemini Free Tier dùng nội dung prompt và phản hồi để cải thiện sản phẩm; dữ liệu được xử lý ngoài EU/UK/EEA.** Người dùng đã chấp nhận điều kiện này; phải ghi rõ trong tài liệu bàn giao và tài liệu dữ liệu của hệ thống.
- **Log:** hệ thống không ghi nguyên giá trị ô lỗi chưa che; chỉ ghi định danh cột, số dòng gốc và mã lỗi.
- Đánh đổi: mẫu ô đã che cho phép AI chỉ ra dạng lỗi cụ thể mà thống kê không mô tả được (VD "cột Giới tính có `Nam` và `nam` không nhất quán"); đổi lại hệ thống phải có bước che PII bắt buộc trước khi gọi API ngoài và không được gửi toàn bộ tập lỗi.
- Cơ chế phát hiện PII cụ thể (regex, từ khóa, cột đánh dấu) và dạng thay thế còn mở — xem mục 6.2.

### 3.11. Ngưỡng ảnh hưởng và số mẫu tối thiểu áp dụng (v2)

- Bảng ngưỡng và điều kiện số mẫu tối thiểu lấy nguyên văn từ phần 2, mục 3.29. Tóm tắt:
  - DQ-01 thiếu: Thấp < 1%, Trung bình 1–10%, Cao > 10%.
  - DQ-02 trùng: Thấp < 0,5%, Trung bình 0,5–5%, Cao > 5%.
  - DQ-03 sai kiểu/định dạng: Thấp < 1%, Trung bình 1–10%, Cao > 10%.
  - DQ-04 bất thường: Thấp vượt IQR 1,5×, Trung bình vượt IQR 3× hoặc Modified Z-score > 3,5, Cao khi cả hai phương pháp cùng đánh dấu.
  - DQ-05: luôn hiển thị "Chưa đánh giá".
- Tỷ lệ tính trên số dòng đang phân tích của cột tương ứng. Không có dòng nào thì báo "không có dữ liệu để đánh giá", không trả 0% và không áp ngưỡng.
- Số mẫu tối thiểu: Pearson/Spearman ≥ 3 quan sát hợp lệ chung; Cramér's V và η² ≥ 2 quan sát hợp lệ mỗi lớp có mặt; VIF ≥ (số cột số tham gia + 1) quan sát hợp lệ trên tập dòng chung; IQR/Modified Z-score ≥ 4 quan sát hợp lệ; mất cân bằng lớp ≥ 2 lớp quan sát được; sàng lọc biến động theo IQR trên chênh lệch kỳ ≥ 3 chênh lệch hợp lệ.
- Không đủ số mẫu: báo "không tính được" kèm lý do cụ thể, không thay kết quả bằng 0 và không coi là dữ liệu tốt.
- Mỗi mức ảnh hưởng phải kèm lý do, phạm vi bị ảnh hưởng và quy tắc áp dụng; ngưỡng là quy ước dự án, phải thể hiện trong Tổng kết và PDF.
- Ngưỡng cảnh báo "lớp có quá ít mẫu" và giới hạn tinh chỉnh tham số còn mở (mục 6.2 của phần 2).

### 3.12. Logic nhập file và đọc sheet (v2)

- **Định dạng:** chỉ `.xlsx` và `.csv`. `.xls` không hỗ trợ; file Excel có mật khẩu báo lỗi và yêu cầu gỡ mật khẩu rồi tải lại.
- **Giới hạn dung lượng:** tối đa 50 MB mỗi file, 500 MB mỗi workspace (phần 2, mục 3.25).
- **CSV:** UTF-8, tự bỏ BOM; tự nhận diện delimiter trong `,` `;` `\t` `|`; không xác định được thì báo lỗi Import, không đoán.
- **Excel:** mỗi sheet là một bảng duy nhất; dòng đầu là tên cột. Không xử lý ô gộp, không tính lại công thức.
- **Không tự đoán locale số:** dấu thập phân và phân nhóm do người dùng cấu hình tại Data Views. Hệ thống không tự diễn giải `1,234` là `1234` hay `1.234`, không tự bỏ tiền tệ/phần trăm/đơn vị.
- **Dòng lệch số cột:** giữ theo vị trí; cột thiếu ở dòng đó là thiếu (DQ-01); cột thừa bị bỏ kèm cảnh báo. Ô trống bên phải cột cuối không tạo dòng dư thừa.
- **Cấu trúc bảng (phần 2, mục 3.26):** sheet rỗng hoàn toàn → mở kèm thông báo "không có dữ liệu"; sheet chỉ có header → hợp lệ, các phép phân tích báo "không có dữ liệu để đánh giá"; sheet có dữ liệu nhưng không xác định được header → lỗi Import, chưa gắn file vào project, cho nhập lại.
- **Kiểm tra tên cột:** kiểm tra tất cả sheet gồm sheet ẩn, thông báo theo từng sheet. Tên rỗng/trùng là lỗi Import nhưng vẫn nhận file và gắn vào project; người dùng phải sửa tên trên hệ thống. **Chặn phân tích sheet đang làm việc cho tới khi hết lỗi tên cột**; lỗi ở sheet khác không chặn.
- **Tên cột so sánh:** phân biệt hoa/thường và khoảng trắng, không tự trim hay đổi hoa/thường. Tên chỉ chứa khoảng trắng chỉ cảnh báo, không bắt buộc đổi.
- **Luồng ghi:** file gốc lưu qua port Storage (R2, local fallback) với **đúng extension gốc**; bản ghi dữ liệu tách riêng vào cơ sở dữ liệu. Khi lỗi giữa chừng phải **dọn file tạm** trong bucket.
- Mỗi project chỉ có một file dữ liệu; không cho thay thế file, muốn đổi file phải tạo project mới.

### 3.13. Xóa dòng, sửa ô và dấu vân tay đầu vào (v2)

- **Xóa dòng:** theo số dòng file gốc; hỗ trợ một dòng, nhiều dòng chọn và một khoảng dòng. Xóa chỉ tác động **dữ liệu làm việc**, file gốc giữ nguyên.
- **Reset Dataset:** đưa sheet đang làm việc về trạng thái chưa sửa (khôi phục dòng đã xóa, tên cột từ file gốc, hiển thị lại cảnh báo). Reset **không** thay đổi bản lưu hiện hành; chỉ lần Lưu thành công tiếp theo mới cập nhật.
- **Sửa ô (v2 — giữ trong backend mới):** sửa giá trị trên dữ liệu làm việc, không ghi đè file gốc. Sửa ô **không** làm mất hiệu lực kết quả phân tích theo cơ chế `stale`; hệ thống **cảnh báo** kết quả đã lưu có thể không còn khớp và vẫn cho phép tạo Tổng kết từ kết quả hiện có (quy tắc `keep` + `warn_only`). Sửa ô là một thay đổi đầu vào của dữ liệu làm việc nên phải được ghi vào trạng thái lưu/khôi phục của project.
- **Dấu vân tay đầu vào (`input_fingerprint`):** hash của tổng hợp: sheet đang làm việc, tập cột được chọn phân tích, cột nhãn nếu có, cấu hình phân tích (kiểu/định dạng cột, phương pháp tương quan, phương pháp outlier, mức tổng hợp thời gian, Top N), tập số dòng gốc đã xóa, phiên bản cấu hình.
  - Khi fingerprint của yêu cầu hiện tại khác kết quả đã lưu → kết quả cũ đánh dấu **stale**; **không xóa khỏi database**.
  - Mở Data Analysis & Detection với đầu vào đã đổi → yêu cầu chạy lại phân tích. Mở Tổng kết mà phân tích hệ thống chưa chạy lại với đầu vàu hiện tại → từ chối tạo Tổng kết mới.
  - Sửa ô không làm thay đổi fingerprint (theo quyết định `keep` + `warn_only`); hệ thống hiển thị cảnh báo mà không chặn.

### 3.14. Thư viện triển khai phân tích (v2)

**Đã chốt:** dùng **`simple-statistics`** cho thống kê mô tả và **`ml-matrix`** cho tương quan, VIF và các phép tính ma trận. Không tự viết lại từng phép tính.

**Phân công cụ thể:**

| Nhóm phép tính | Thư viện |
|---|---|
| Trung bình, trung vị, độ lệch chuẩn, phương sai, tứ phân vị, IQR | `simple-statistics` (`mean`, `median`, `standardDeviation`, `variance`, `quantile`, `sampleQuantile`) |
| Modified Z-score (MAD) | `simple-statistics` (`medianAbsoluteDeviation`, `median`) |
| Tần suất giá trị | `simple-statistics` (`sampleCorrelation` không dùng; tự đếm tần suất trên tập hợp) — thư viện không có hàm tần suất chuyên dụng nên đếm trực tiếp |
| Pearson, Spearman | `ml-matrix` (`correlation`, `correlationPearson`) cho Pearson; Spearman tính trên thứ hạng của các cột |
| Cramér's V | `ml-matrix` để dựng bảng tần suất kết hợp, công bố chỉ số V từ bảng |
| Eta-squared (η²) | `ml-matrix` cho ma trận phân tích biến phân một yếu tố, hoặc tính trực tiếp từ tổng bình phương trong/ngoài nhóm |
| VIF | `ml-matrix` (`inverse` của ma trận tương quan) — VIF = đường chéo của nghịch đảo ma trận tương quan |
| Ma trận tương quan đầy đủ cho biểu đồ/thống kê | `ml-matrix` (`matrix`, `multiply`, `transpose`, `inverse`) |

**Quy tắc bắt buộc khi dùng thư viện:**
- Mọi phép tính phải bọc trong một **service/domain helper** của module `analysis`, không gọi trực tiếp thư viện từ controller hay application service. Lý do: giữ domain không phụ thuộc thư viện ngoài (đúng nguyên tắc domain không import framework), và cho phép đổi/kiểm thử phép tính tập trung.
- **Tiền điều kiện đầu vào phải kiểm tra trước khi gọi thư viện**: mọi phép tính cần số mẫu tối thiểu theo mục 3.11 phải được kiểm tra ở lớp trên; không giao mảng rỗng hoặc mảng chứa `NaN` cho thư viện.
- **Ma trận không khả nghịch** (VIF với phụ thuộc tuyến tính hoàn hảo): phải bắt lỗi của `ml-matrix` và báo rõ "phụ thuộc tuyến tính hoàn hảo — không tính được VIF" thay vì thay bằng số hữu hạn tùy ý (đã chốt ở mục 3.6).
- **Giá trị không hữu hạn** (`NaN`, `Infinity`) sinh ra từ phép tính phải được phát hiện và báo "không tính được" thay vì trả về giá trị hỏng cho tầng trên. Đặc biệt với Pearson khi một cột hằng (độ lệch chuẩn = 0).
- **Số mẫu tối thiểu và điều kiện tính** của mỗi phép tính vẫn do backend kiểm soát theo mục 3.11, không giao cho thư viện quyết định.
- Kết quả phải **làm tròn/giữ số thực đầy đủ** ở tầng domain; việc hiển thị làm tròn thuộc tầng trình bày (mục 3.29 và mục 3.16 của phần 2).
- **Kiểm thử:** mỗi helper phải có test với bộ dữ liệu có giá trị kỳ vọng tính tay (golden values) để đối chiếu kết quả thư viện. Không chỉ kiểm thử "không ném lỗi".

**Đánh đổi:** dùng thư viện giảm rủi ro sai số và rút ngắn thời gian triển khai, nhưng gắn thêm phụ thuộc ngoài và phải bọc lại để giữ ranh giới domain. `ml-matrix` không có sẵn hàm Cramér's V, Eta-squared hay VIF nên vẫn phải tự tính phần trên nền ma trận — phần này là nơi dễ sai số nhất và cần test kỹ nhất.

## 4. Đầu vào và đầu ra

- **Đầu vào:** Yêu cầu người dùng, kết quả các phần trước và mã nguồn/tài liệu hiện trạng liên quan.
- **Đầu ra:** Hoàn thiện kế hoạch lần đầu trong file v1, cập nhật v2; ghi rõ quyết định, lý do, phương án khác, trade-off, rủi ro, giới hạn và ảnh hưởng liên quan.

## 5. Điều kiện hoàn tất phần này

Logic, trường hợp biên và tiêu chí đánh giá được xác nhận; rà lại các thiết kế trước nếu có ảnh hưởng.

**Trạng thái v2:** logic phân tích (DQ-01..DQ-04, liên hệ/VIF, mất cân bằng, thời gian) và logic AI đã có đặc tả đủ để thiết kế ở phần 8–9. Các câu hỏi còn mở ở mục 6.2 cần chốt trước khi bắt đầu implementation.

## 6. Câu hỏi và phụ thuộc còn mở (v2)

### 6.1. Đã chốt ở v2

- Nhà cung cấp AI: Gemini API, model Flash miễn phí (mục 3.9).
- Cơ chế chạy AI: bất đồng bộ qua job table MongoDB + polling nền, timeout 60s, retry 2 lần (mục 3.9).
- Phạm vi dữ liệu gửi ra ngoài: thống kê tổng hợp + tối đa 20 ô lỗi/cột đã che PII (mục 3.9, 3.10).
- Ngưỡng ảnh hưởng và số mẫu tối thiểu: theo bảng tại phần 2, mục 3.29 (mục 3.11 ở đây).
- Thư viện thống kê: `simple-statistics` + `ml-matrix` (mục 3.14).
- Logic nhập file/sheet, xóa dòng, sửa ô, dấu vân tay đầu vào: mục 3.12, 3.13.

### 6.2. Còn mở

1. **Schema kỹ thuật port AI:** cấu trúc request/response chuẩn (JSON Schema hay Zod), trường bắt buộc, cách biểu diễn mức độ ảnh hưởng và trạng thái xác minh, cách AI tham chiếu bằng chứng (mã bằng chứng hay mô tả tự do), cấu trúc phản hồi khi lỗi từng phần.
2. **Chi tiết che PII:** cơ chế phát hiện PII (regex theo loại dữ liệu, từ khóa nghiệp vụ, hay chỉ dựa vào cột đã đánh dấu là PII), phạm vi áp dụng (chỉ ô lỗi hay cả thống kê), dạng thay thế (`***`, giữ trục giữa, hash), và quy tắc khi không che được.
3. ~~**Thư viện thống kê:**~~ **Đã chốt ở v2:** `simple-statistics` + `ml-matrix` — xem mục 3.14. Còn mở: quy ước làm tròn số ở tầng domain và số chữ số hiển thị mặc định.
4. **Thứ tự ưu tiên phát hiện và cách gom nhóm phát hiện** trong Tổng kết (mục 3.9 của phần 2 chưa chốt tiêu chí xếp ưu tiên).
5. **Số phát hiện AI tối đa** được giữ lại và cách xử lý khi AI trả về quá nhiều phát hiện.
6. **Giới hạn tinh chỉnh tham số** mà người dùng được phép (mục 6.2 của phần 2) và phạm vi giá trị.
7. **Quy tắc bố cục báo cáo PDF** và mức chi tiết (mục 6.2 của phần 2).

### 6.3. Phụ thuộc bên ngoài

- `GEMINI_API_KEY` phải có ở môi trường chạy; adapter phải fail an toàn (Tổng kết vẫn có kết quả hệ thống) khi thiếu key.
- Quota Gemini Free Tier (request/phút, request/ngày) là giới hạn cứng bên ngoài; vượt ngưỡng phải báo lỗi có kiểm soát, không retry vô hạn.
- MongoDB là hạ tầng cho cả dữ liệu và job table AI.

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v2 / 2026-11-04:** Dùng `simple-statistics` cho thống kê mô tả + `ml-matrix` cho tương quan/VIF/ma trận / Theo lựa chọn người dùng / Bổ sung mục 3.14, bổ sung quy tắc bọc thư viện trong domain helper và kiểm thử golden values.
- **Xác nhận v2 / 2026-11-04:** Nhà cung cấp AI là Gemini API, model Flash miễn phí; chấp nhận dữ liệu dùng để train ngoài EU, ghi rõ trong tài liệu bàn giao / Theo lựa chọn `gemini` / Bổ sung mục 3.9 và 3.10.
- **Xác nhận v2 / 2026-11-04:** AI chạy bất đồng bộ nền, timeout 60s, retry 2 lần, lỗi AI không chặn Tổng kết / Theo lựa chọn `async_job` / Bổ sung mục 3.9 với trạng thái job và cơ chế khôi phục sau restart.
- **Xác nhận v2 / 2026-11-04:** Job table MongoDB + polling nền trong API process, không thêm Redis/BullMQ/Kafka / Theo lựa chọn `mongo_job` / Bổ sung mục 3.9, ghi rõ lý do không dùng hạ tầng event platform của hệ thống tham chiếu.
- **Xác nhận v2 / 2026-11-04:** Gửi tối đa 20 ô lỗi/cột cho AI, che PII bắt buộc; mọi nơi ghi "AI chỉ nhận thống kê tổng hợp" phải hiểu là không nhận toàn bộ mẫu dòng/giá trị ô / Theo lựa chọn `send_sample_masked` / Sửa mục 3.2, 3.3, 3.4, 3.6, 3.7 và bổ sung mục 3.10.
- **Xác nhận v2 / 2026-11-04:** Ngưỡng ảnh hưởng và số mẫu tối thiểu theo phương án đề xuất / Theo phương án được duyệt / Bổ sung mục 3.11, đồng bộ với phần 2 mục 3.29.
- **Xác nhận v2 / 2026-11-04:** Quy tắc nhập file/sheet, xóa dòng, sửa ô (`keep` + `warn_only`) và dấu vân tay đầu vào / Theo lựa chọn người dùng / Bổ sung mục 3.12 và 3.13.
- **Xác nhận v2 / 2026-11-04:** Bằng chứng ở mức ô lưu collection riêng / Theo lựa chọn `cell_level` + `separate_collection` / Ghi nhận ranh giới bằng chứng và tham chiếu bằng chứng trong kiểm chứng phản hồi AI ở mục 3.9.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận tổng hợp thời gian, khoảng trống và sàng lọc IQR trên chênh lệch kỳ / Người dùng đồng ý đề xuất / Bổ sung mục 3.8 làm đầu vào thiết kế logic/kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận đánh giá mất cân bằng lớp và ngưỡng IR ≥ 3 theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.7 làm đầu vào thiết kế logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận phương pháp liên hệ ba loại cặp và VIF theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.6 và đồng bộ xử lý dữ liệu không hợp lệ tại DQ-03, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** DQ-05 giữ hoãn cấu hình quy tắc và báo chưa đánh giá khi chưa có quy tắc xác nhận / Người dùng chọn giữ phạm vi hiện tại / Bổ sung mục 3.5, không mở rộng logic hoặc triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận DQ-04 và phương pháp outliers từng cột theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.4 làm đầu vào logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận DQ-03 và cấu hình kiểu/định dạng, minh bạch phần dữ liệu hợp lệ dùng trong phân tích / Người dùng đồng ý đề xuất / Bổ sung mục 3.3 làm đầu vào thiết kế logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận tiêu chí DQ-01/DQ-02 đã được người dùng đồng ý tại phần 2 / Làm đầu vào cho logic xử lý và kiểm thử / Bổ sung mục 3.2, chưa triển khai backend hoặc chốt các tiêu chí còn mở.
- **Xác nhận v1 / 2026-11-03:** Backend xác định ba mức ảnh hưởng hoặc Chưa đủ cơ sở; tách trạng thái xác minh và xử lý mâu thuẫn từng phát hiện AI / Người dùng đồng ý phương án / Bổ sung mục 3.1 làm đầu vào thiết kế logic và kiểm thử sau, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Chốt sáu nội dung mỗi phát hiện AI và phân biệt nghi vấn/vấn đề hệ thống đã xác nhận / Theo xác nhận người dùng / Làm đầu vào cho thiết kế phản hồi và kiểm chứng, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** AI chỉ nhận kết quả thống kê / Theo lựa chọn người dùng / Cập nhật phạm vi đầu vào và giới hạn bằng chứng; chưa triển khai hoặc gửi dữ liệu ra ngoài. (Bị thay thế bởi quyết định v2 ngày 2026-11-04: thống kê + tối đa 20 ô lỗi/cột đã che PII.)
- **Ghi nhận v1 / 2026-11-03:** Hướng dùng API mô hình ngoài và phân chia trách nhiệm backend/AI đã được đồng ý trong thảo luận tính năng / Theo xác nhận người dùng / Là đầu vào cho thiết kế chi tiết sau, chưa triển khai hoặc gửi dữ liệu ra ngoài.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 12 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.

