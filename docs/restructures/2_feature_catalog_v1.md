# 2. Danh sách tính năng backend

- **Version:** v1
- **Ngày tạo:** 2026-11-02
- **Trạng thái:** Đang thảo luận v1 — đã xác nhận đối tượng sử dụng, nguồn dữ liệu và phạm vi phân tích; chưa chốt toàn bộ danh sách tính năng.
- **Giai đoạn:** Feature
- **Thứ tự thực hiện:** Phần 2; sử dụng kết quả đã xác nhận của các phần trước.

## 1. Mục tiêu

Làm rõ và thống nhất danh sách tính năng backend cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Các nhóm người dùng và mục tiêu sử dụng.
- Danh sách tính năng giữ lại, thay đổi, thêm mới hoặc loại bỏ; cấp mã định danh cho từng tính năng.
- Phạm vi ưu tiên và điều kiện chấp nhận nghiệp vụ cho từng tính năng.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Đối tượng sử dụng và nhu cầu đã xác nhận

- Hệ thống dành cho những người muốn phân tích và phát hiện vấn đề của dữ liệu.
- Người dùng chủ yếu làm việc trong các lĩnh vực xử lý và phân tích dữ liệu, chẳng hạn Data Analyst.
- Đây là mô tả đối tượng sử dụng theo công việc, chưa phải quyết định về role hoặc quyền truy cập trong hệ thống.

### 3.2. Nguồn dữ liệu và phạm vi đã xác nhận

- Mỗi project chỉ chứa một file dữ liệu (`.xlsx` hoặc `.csv`). Các sheet Excel được chọn để làm việc đều thuộc file này; không hỗ trợ nhiều file dữ liệu trong cùng project. Không cho phép thay thế file dữ liệu của project; muốn làm việc với file khác phải tạo project mới.
- Có tính năng Import file và kiểm tra ngay sau khi tải lên. Nếu tải thất bại, file không đọc được hoặc thuộc loại chưa hỗ trợ thì thông báo lỗi, chưa gắn file vào project và cho nhập lại trong project đó. File được tiếp nhận thành công mới được gắn vào project và không được thay thế.
- Người dùng xác nhận dữ liệu đầu vào không có ô gộp (merged cells). Chưa đưa hỗ trợ xử lý ô gộp vào phạm vi đợt hiện tại; không mặc định bổ sung tách ô hoặc điền giá trị cho vùng gộp.
- File `.xlsx` đầu vào chỉ chứa các giá trị có sẵn, không chứa ô công thức. Hỗ trợ đọc/xử lý hoặc tính lại công thức chưa thuộc phạm vi đợt hiện tại.
- Chưa hỗ trợ file Excel có mật khẩu mở file trong đợt hiện tại. Khi gặp file này, hệ thống thông báo chưa hỗ trợ và yêu cầu người dùng gỡ mật khẩu rồi tải lại; không bổ sung bước nhập mật khẩu trên hệ thống.
- Mỗi sheet Excel có dữ liệu chứa một bảng duy nhất: dòng đầu tiên là tên cột, các dòng bên dưới là dữ liệu. Không đưa xử lý nhiều bảng trong cùng một sheet vào phạm vi hiện tại. Sheet rỗng áp dụng quy tắc tại mục 3.8.
- Người dùng tải file lên hệ thống. Đợt hiện tại chỉ hỗ trợ Excel `.xlsx` và `.csv`; không hỗ trợ `.xls`. Giới hạn dung lượng và quy ước đọc file còn cần chốt. Cách chọn sheet Excel được ghi tại mục 3.8. Không mặc định bổ sung kết nối database bên ngoài.
- Tiêu đề hiển thị của bộ dữ liệu lấy từ tên file tải lên. Tên từng cột lấy từ dòng đầu tiên của sheet Excel hoặc bản ghi đầu tiên của CSV; phần này là tên cột, không phải dòng dữ liệu để phân tích. Không tự tìm một dòng khác làm tiêu đề. Cấu trúc bảng không hợp lệ còn cần chốt.
- Tên cột rỗng (không có giá trị) hoặc trùng chỉ tạo cảnh báo khi Import. Hệ thống thông báo rõ vấn đề và vị trí các cột liên quan; vẫn chấp nhận file và gắn vào project nếu không có lỗi Import khác, không yêu cầu tải lại chỉ vì tên cột rỗng/trùng. Người dùng phải nhập tên cho cột rỗng hoặc chỉnh sửa tên cột trùng ngay trên hệ thống; hệ thống kiểm tra lại và chỉ cho phân tích khi đã xử lý hết tên rỗng/trùng của sheet đang làm việc. Tên chỉnh sửa chỉ áp dụng cho dữ liệu làm việc, không sửa file gốc và không tự đặt tên thay người dùng. So sánh tên có phân biệt chữ hoa/thường và khoảng trắng, không tự trim hoặc đổi hoa/thường: `Tuổi`, `tuổi` và ` Tuổi ` là ba tên khác nhau. Riêng tên chỉ chứa khoảng trắng vẫn chỉ phát hiện và hiển thị cảnh báo, không bắt buộc đổi tên; quy tắc kiểm tra trùng tên vẫn áp dụng. Quyết định này thay thế việc cho phân tích khi tên cột còn rỗng/trùng. Workspace Owner, Project Owner và Project Member được nhập/chỉnh sửa tên cột; Viewer chỉ xem cảnh báo, không được sửa tên cột. Khi Import Excel, kiểm tra tất cả sheet, gồm sheet ẩn, và thông báo vấn đề theo từng sheet. Chỉ yêu cầu sửa tên cột rỗng/trùng của sheet đang làm việc trước khi phân tích sheet đó; lỗi tên cột ở sheet khác không chặn phân tích sheet hợp lệ. Sheet rỗng vẫn áp dụng mục 3.8. Đánh đổi: có cảnh báo đầy đủ từ đầu nhưng bước Import có thể lâu hơn kiểm tra từng sheet khi mở.
- Danh mục gồm 5 nhóm vấn đề cơ bản bên dưới; AI hỗ trợ phát hiện thêm theo phạm vi thống kê đã chốt. Tiêu chí ban đầu DQ-01 đến DQ-04 đã chốt tại mục 3.5, gồm phương pháp outliers từng cột. DQ-05 giữ giới hạn chưa đánh giá khi chưa có quy tắc được xác nhận, không cam kết phát hiện đầy đủ mâu thuẫn nghiệp vụ trong đợt này. Các tiêu chí còn mở và phạm vi phát hiện cụ thể của AI cần bàn tiếp; chưa chọn model hoặc nhà cung cấp AI.
- Phần phân tích của hệ thống phát hiện vấn đề, mô tả, cung cấp bằng chứng và đưa ra hướng đề xuất xử lý. Đề xuất không đồng nghĩa với tự động thực thi thay đổi dữ liệu.
- Ngày 2026-11-03, người dùng bổ sung yêu cầu thao tác xóa dữ liệu cơ bản, ví dụ xóa dòng theo số dòng. Đây là mở rộng so với phạm vi chỉ xem/phân tích trước đó; cách xóa và phạm vi dữ liệu bị tác động đang chờ làm rõ tại mục 3.11. Chưa mở rộng sang sửa ô hoặc tự động áp dụng cleaning rules.

### 3.3. Ảnh hưởng đến tính năng hiện có

Các chức năng sửa ô, apply cleaning rules và các chức năng phụ thuộc vào dữ liệu đã biến đổi cần được rà soát theo phạm vi mới. Chưa quyết định xóa endpoint hoặc module cụ thể. Versioning, lineage và export cần được làm rõ lại về mục đích nếu tiếp tục sử dụng, không mặc định giữ nguyên cơ chế phục vụ làm sạch dữ liệu.

### 3.4. Nội dung chưa thống nhất

Chi tiết hỗ trợ Excel/CSV, giới hạn dung lượng, tiêu chí kiểm tra cho từng nhóm vấn đề cơ bản, phạm vi AI hỗ trợ phát hiện thêm, mức chi tiết của bằng chứng, hình thức kết quả đầu ra và danh sách tính năng đầy đủ chưa được chốt.

### 3.5. Năm nhóm kiểm tra cơ bản đã được đồng ý

- **DQ-01 — Dữ liệu thiếu:** Ô trống hoặc thiếu trường cần thiết.
- **DQ-02 — Dữ liệu trùng:** Trùng dòng hoặc trùng giá trị tại cột cần duy nhất.
- **DQ-03 — Sai kiểu/định dạng:** Kiểu dữ liệu hoặc định dạng không nhất quán.
- **DQ-04 — Giá trị bất thường:** Giá trị ngoài miền cho phép hoặc bất thường về thống kê.
- **DQ-05 — Mâu thuẫn giữa các cột:** Quan hệ giữa các giá trị không đáp ứng quy tắc nghiệp vụ; trong đợt hiện tại, chưa có quy tắc được xác nhận thì báo Chưa đánh giá theo mục 3.5.5.

Trạng thái: người dùng đã đồng ý phạm vi 5 nhóm và tiêu chí ban đầu DQ-01 đến DQ-04 bên dưới. Các ngưỡng ảnh hưởng chi tiết và tiêu chí còn mở cần bàn tiếp. Không mặc định mọi giá trị trống, trùng hoặc ngoại lệ thống kê đều là lỗi.

#### 3.5.1. DQ-01 — Tiêu chí dữ liệu thiếu đã xác nhận

- Nhận diện thiếu: ô không có giá trị, chuỗi rỗng hoặc chỉ chứa khoảng trắng. Không tự coi `0`, `false` hoặc các chuỗi `NA`, `null`, `-`, `unknown` là thiếu. Giá trị không chuyển được sang kiểu đã chọn thuộc sai kiểu/định dạng, không âm thầm chuyển thành thiếu.
- Thống kê trên các dòng đang phân tích và các cột được chọn, không phụ thuộc bộ lọc hiển thị: số lượng/tỷ lệ thiếu từng cột, số dòng thiếu ít nhất một ô và số dòng thiếu toàn bộ các cột được chọn. Hiển thị biểu đồ tỷ lệ thiếu theo cột.
- Tỷ lệ thiếu của cột = số ô thiếu / số dòng đang phân tích × 100%. Nếu không còn dòng nào, báo Không có dữ liệu để đánh giá, không trả 0%.
- Bằng chứng trong hệ thống gồm cột và số dòng tương ứng file gốc. AI chỉ nhận thống kê tổng hợp, không nhận mẫu dòng/giá trị ô.
- Có giá trị thiếu là hiện tượng xác nhận được, chưa tự động là lỗi nghiệp vụ. Cột thiếu 100% khiến phép phân tích cần giá trị của cột không thực hiện được có thể được đánh giá Cao đối với phép phân tích đó; không suy rộng ra toàn dataset. Trường hợp chưa có quy tắc/ngữ cảnh thì Chưa đủ cơ sở, không gán ngưỡng phần trăm chung.

#### 3.5.2. DQ-02 — Tiêu chí dữ liệu trùng đã xác nhận

- Kiểm tra các dòng giống nhau trên toàn bộ cột được chọn phân tích, ghi rõ Trùng trên các cột đã chọn. Bỏ cột định danh có thể làm hai bản ghi hợp lệ giống nhau trên phạm vi còn lại; không mặc định đây là bản ghi lỗi.
- So khớp chính xác giá trị và kiểu dữ liệu sau bước đọc file đã thống nhất. Không tự bỏ dấu, đổi chữ hoa/thường hoặc cắt khoảng trắng để kết luận trùng. Chi tiết đọc file còn cần thiết kế.
- Dòng thiếu toàn bộ cột được chọn được báo riêng ở DQ-01, không gom thành nhóm trùng. Dòng thiếu một phần có thể được nhóm khi vị trí thiếu và các giá trị còn lại giống nhau; ghi rõ nhóm có dữ liệu thiếu.
- Báo riêng số nhóm trùng, số dòng thuộc các nhóm trùng và số dòng lặp ngoài một đại diện mỗi nhóm. Ví dụ một nhóm ba dòng giống nhau có 1 nhóm, 3 dòng liên quan và 2 dòng lặp ngoài đại diện; phép đếm không hàm ý xóa các dòng này.
- Bằng chứng gồm các cột dùng so khớp và số dòng gốc trong mỗi nhóm. AI chỉ nhận số nhóm, số lượng, tỷ lệ và thống kê liên quan. Không tự xóa dữ liệu hoặc kết luận vi phạm tính duy nhất khi chưa có khóa nghiệp vụ.
- Trùng theo khóa nghiệp vụ, so khớp gần giống và ký hiệu thiếu tùy chỉnh còn để bàn sau, chưa thuộc tiêu chí kiểm tra ban đầu. So khớp chính xác dễ giải thích/kiểm thử nhưng bỏ sót gần giống; so khớp gần giống có nguy cơ gộp nhầm nên chưa chọn ở bước này.

#### 3.5.3. DQ-03 — Tiêu chí sai kiểu và định dạng đã xác nhận

- Kiểm tra theo kiểu và định dạng cột chốt tại Data Views; giữ nguyên dữ liệu gốc, không tự đoán khi có nhiều cách hiểu. Tách kiểu dữ liệu (số nguyên, số thập phân, văn bản, boolean, ngày, ngày–giờ) khỏi vai trò phân tích (định lượng, phân loại, mã định danh); lựa chọn cột nhãn vẫn riêng. Hệ thống tự nhận diện, người dùng có quyền được điều chỉnh; ghi rõ khi nhận diện chưa chắc chắn, không mặc định dữ liệu sai vì kiểu suy đoán có thể sai.
- Phân biệt không phù hợp kiểu, không phù hợp định dạng và mơ hồ chưa thể diễn giải. Ví dụ: `abc` trong cột số; `2026-11-03` khi yêu cầu `DD/MM/YYYY`; `03/04/2026` khi chưa xác định thứ tự ngày/tháng. Ô thiếu thuộc DQ-01, không đếm lại thành lỗi kiểu.
- Số: cấu hình dấu thập phân và phân nhóm hàng nghìn cho chuỗi số; không tự diễn giải `1,234` khi chưa đủ cơ sở, không tự bỏ tiền tệ/phần trăm/đơn vị. Chuỗi số trong CSV đọc đúng theo quy tắc được chọn vẫn hợp lệ. Giá trị âm hoặc quá lớn thuộc kiểm tra miền DQ-04, không mặc định sai kiểu. Giữ mã định danh như `00123` dưới dạng văn bản khi có vai trò định danh, không tự mất số 0 đầu.
- Ngày/ngày–giờ: kiểm tra định dạng và tính hợp lệ của ngày; không tự diễn giải ngày mơ hồ hoặc gán múi giờ khi không có thông tin. Với Excel, phân biệt giá trị ngày được lưu và cách hiển thị; khác cách hiển thị chưa chứng minh sai giá trị.
- Boolean dùng tập giá trị được quy định rõ, không tự chuyển mọi `yes/no`, `1/0` thành boolean. Không tự đổi chữ hoa/thường, bỏ dấu, cắt khoảng trắng trong dữ liệu. Biến thể như `Nam`, `nam`, `NAM` có thể là dấu hiệu chưa thống nhất nhưng không tự kết luận phải gộp. Không suy đoán quy tắc email, điện thoại hoặc định danh chỉ từ tên cột.
- Kết quả theo cột: kiểu/định dạng và nguồn xác định (hệ thống/người dùng), số giá trị hợp lệ/không hợp lệ/mơ hồ, tỷ lệ không hợp lệ trên số giá trị không thiếu. Mẫu số bằng 0 thì báo không có dữ liệu để đánh giá. Bằng chứng trong hệ thống gồm lý do và số dòng gốc; AI chỉ nhận thống kê tổng hợp.
- Các phần không bị ảnh hưởng vẫn chạy. Phép tính cần số/ngày chỉ dùng giá trị diễn giải hợp lệ và công bố số giá trị dùng/bị loại khỏi phép tính đó; không xóa dòng khỏi dataset. Không đủ dữ liệu hợp lệ thì không tính và nêu lý do. Quy tắc xử lý dòng cho tương quan/VIF tại mục 3.23; số lượng tối thiểu từng phép tính cần bàn riêng.
- Tổng kết phải nêu giới hạn do phần dữ liệu không được dùng có thể làm lệch kết quả. Chọn tiếp tục phần hợp lệ thay vì chặn toàn bộ phân tích; đánh đổi là cần minh bạch phạm vi thực tế của từng phép tính.

#### 3.5.4. DQ-04 — Miền giá trị và outliers đã xác nhận

- Tách vi phạm miền giá trị khỏi bất thường thống kê. Chỉ kết luận ngoài miền khi có quy tắc được xác định; không suy miền từ tên cột hoặc min/max quan sát. Do tính năng nhập quy tắc nghiệp vụ đang hoãn, chưa có quy tắc thì báo Chưa có quy tắc kiểm tra miền. Không tự coi số âm, số lớn hoặc ngày tương lai là lỗi; AI không được tự đặt miền rồi coi là quy tắc đã xác nhận.
- Outliers từng cột: áp dụng trên cột số có vai trò định lượng được chọn phân tích, không tự áp dụng cho định danh hoặc phân loại mã hóa số. IQR mặc định: IQR = Q3 − Q1; đánh dấu x < Q1 − 1,5 × IQR hoặc x > Q3 + 1,5 × IQR. Có thể đánh dấu thêm nhóm nằm ngoài hàng rào 3 × IQR là xa hơn về thống kê, không đồng nghĩa ảnh hưởng Cao.
- Hỗ trợ Modified Z-score dùng trung vị và MAD với ngưỡng mặc định trị tuyệt đối > 3,5. Cho chọn IQR, Modified Z-score hoặc cả hai. Khi chạy cả hai, báo riêng chỉ IQR, chỉ Modified Z-score và cả hai phát hiện; không cộng trùng số lượng. Hai phương pháp đồng thuận không chứng minh dữ liệu sai.
- Chỉ tính trên số hữu hạn hợp lệ; công bố số quan sát dùng/bị loại khỏi phép tính. IQR hoặc MAD bằng 0 thì phương pháp tương ứng báo không đủ độ phân tán để đánh giá, không chia cho 0 hay báo không có outlier. Dữ liệu quá ít thì báo chưa đủ điều kiện; số lượng tối thiểu và cách tính tứ phân vị cần thiết kế sau.
- Không tự thay phương pháp, biến đổi log hoặc chia nhóm mà không thể hiện cấu hình. Bất thường thời gian cần xét xu hướng/mùa vụ riêng; kiểm tra toàn cột không thay thế kiểm tra thời gian. Outliers đa biến bàn riêng, chưa nằm trong tiêu chí ban đầu này.
- Kết quả gồm phương pháp, tham số, ngưỡng thực tế, số lượng/tỷ lệ, số quan sát dùng tính và bằng chứng theo số dòng gốc. Dùng box plot/histogram từng cột, không thêm biểu đồ giữa các cột. AI vẫn chỉ nhận thống kê tổng hợp.
- Xác nhận vượt ngưỡng không đồng nghĩa giá trị sai hoặc cần xóa; không tự gán mức Cao vì vượt 3 × IQR hoặc cả hai phương pháp đánh dấu. Giữ outliers trong dữ liệu và thống kê thông thường, không tự loại để cải thiện kết quả.
- Chọn phương pháp/ngưỡng tại Data Views, lưu/khôi phục cùng cấu hình và thể hiện trong Tổng kết/PDF; thay đổi yêu cầu phân tích lại. Giới hạn tinh chỉnh tham số còn cần chốt.
- Đánh đổi: IQR dễ giải thích, gắn với box plot nhưng có thể cảnh báo nhiều với dữ liệu lệch hoặc nhiều nhóm. Modified Z-score dùng thống kê ít nhạy với cực trị hơn trung bình/độ lệch chuẩn nhưng không phù hợp mọi phân bố. Không chọn Z-score thông thường làm mặc định. Tham khảo: [NIST — Outliers](https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm), [NIST — Detection of Outliers](https://itl.nist.gov/div898/handbook/eda/section3/eda35h.htm).

#### 3.5.5. DQ-05 — Giới hạn phạm vi hiện tại đã xác nhận

- Giữ hoãn tính năng nhập/cấu hình quy tắc nghiệp vụ; không bổ sung mẫu quy tắc quan hệ tại Data Views trong đợt này.
- Chưa có quy tắc quan hệ được xác nhận thì hiển thị **Chưa đánh giá — chưa có quy tắc quan hệ được xác nhận**. Không báo Không có mâu thuẫn hoặc kết quả đạt khi chưa thực hiện kiểm tra có cơ sở.
- Không tự suy quy tắc từ tên cột, xu hướng đa số hoặc nhận xét AI. Tương quan, VIF và phân tích quan hệ vẫn chạy theo phạm vi đã thống nhất; các chỉ số này không tự chứng minh mâu thuẫn nghiệp vụ.
- AI chỉ nhận xét theo thống kê được cung cấp, phân biệt nghi vấn với lỗi đã xác nhận; không tự tạo quy tắc rồi kết luận vi phạm. Không mở rộng đầu vào AI sang mẫu dòng/giá trị ô.
- Giới hạn nghiệm thu: kiểm tra đúng trạng thái chưa đánh giá và lý do trong kết quả/Tổng kết; không tuyên bố hỗ trợ đầy đủ phát hiện mâu thuẫn nghiệp vụ DQ-05. Thiết kế và triển khai cấu hình quy tắc, đánh giá quan hệ theo từng dòng sẽ bàn ở giai đoạn mở rộng, chưa được đưa vào phạm vi hiện tại.
- Đánh đổi: giữ phạm vi và tránh kết luận thiếu cơ sở, nhưng chưa xác nhận được mâu thuẫn nghiệp vụ khi không có nguồn quy tắc.

### 3.6. Phạm vi AI chờ làm rõ

- Hướng tích hợp đã được đồng ý: gọi API mô hình bên ngoài, không yêu cầu tự huấn luyện hoặc vận hành mô hình riêng trong đợt này. Chưa chọn nhà cung cấp/model.
- Backend tính toán kết quả phân tích, chuẩn bị đầu vào có cấu trúc chỉ gồm kết quả thống kê tổng hợp; bằng chứng gửi AI cũng phải nằm trong phạm vi thống kê này. AI hỗ trợ Detection bổ sung, nhận xét và đề xuất. Backend kiểm tra cấu trúc phản hồi, đối chiếu số liệu và tham chiếu bằng chứng trước khi hiển thị. Phản hồi đúng cấu trúc không đồng nghĩa với kết luận đúng.
- Tích hợp qua port AI và adapter nhà cung cấp theo Ports and Adapters đã chọn. Chi tiết hợp đồng, schema phản hồi và cơ chế kiểm chứng sẽ được thiết kế ở các bước sau.
- Phạm vi đã chốt: chỉ gửi kết quả thống kê sang API AI; không gửi file gốc, mẫu dòng hoặc giá trị ô dữ liệu gốc. Chi tiết định danh cột và cách biểu diễn nhãn nhóm trong thống kê còn cần thiết kế, không mặc nhiên cho phép gửi các giá trị gốc qua nhãn nhóm. Giữ quy tắc AI lỗi không chặn kết quả hệ thống và tính năng Thử lại AI.

- Cấu trúc nội dung mỗi phát hiện AI đã được xác nhận: vấn đề, cột liên quan, bằng chứng thống kê, mức độ ảnh hưởng, giải thích và đề xuất xử lý. Phải phân biệt nghi vấn cần kiểm tra thêm với vấn đề hệ thống đã xác nhận. Schema kỹ thuật chưa chốt.
- Backend xác định mức độ ảnh hưởng bằng quy tắc: **Thấp** (ảnh hưởng hạn chế đến phép phân tích), **Trung bình** (có khả năng làm sai lệch kết quả, cần kiểm tra), **Cao** (ảnh hưởng lớn đến độ tin cậy hoặc khiến một phép phân tích không thực hiện được). Thêm trạng thái **Chưa đủ cơ sở** khi thiếu quy tắc/ngữ cảnh, không mặc định là Thấp. Mỗi đánh giá cần lý do, phạm vi bị ảnh hưởng và quy tắc áp dụng; hiện đánh giá ảnh hưởng đến phân tích, chưa khẳng định thiệt hại nghiệp vụ. Ngưỡng riêng theo loại vấn đề sẽ bàn sau, không dùng một ngưỡng chung cho mọi loại.
- Trạng thái xác minh độc lập với mức độ ảnh hưởng: **Đã xác nhận bằng kiểm tra hệ thống** khi có phép tính/quy tắc tái lập được; **Nghi vấn cần kiểm tra** khi chưa đủ bằng chứng xác nhận. Xác nhận vượt ngưỡng outlier không đồng nghĩa giá trị đó sai; xác nhận tỷ lệ thiếu không đồng nghĩa xác nhận nguyên nhân thiếu.
- Kiểm chứng từng phát hiện AI bằng đúng kết quả của lần phân tích hiện tại: loại phát hiện sai số liệu/tham chiếu bằng chứng không tồn tại; suy diễn quá mức chỉ giữ dạng nghi vấn nếu có bằng chứng hỗ trợ; AI không được ghi đè mức ảnh hưởng backend xác định. Không dùng kết quả của sheet/cấu hình cũ để đối chiếu lần phân tích mới.
- Nếu loại một phần phản hồi AI, giữ nhận xét hợp lệ và báo phần nhận xét AI chưa đầy đủ tại Tổng kết. Nếu toàn bộ phản hồi hỏng hoặc không kiểm chứng được, dùng kết quả hệ thống và cho phép Thử lại AI theo quy tắc đã chốt.

Detection và nhận xét của AI phải dựa trên bằng chứng thống kê được cung cấp, phân biệt nghi vấn với lỗi đã xác nhận. Không cam kết phát hiện bất nhất ngữ nghĩa ở từng ô/dòng khi AI không nhận dữ liệu đó. Phạm vi phát hiện bổ sung và tiêu chí kiểm chứng chi tiết còn cần bàn.

### 3.7. Tính năng hoãn triển khai

Người dùng xác nhận sẽ làm tính năng nhập mô tả dữ liệu, ý nghĩa các cột và quy tắc nghiệp vụ trong tương lai, nhưng hiện tại chưa cần triển khai. Tính năng này không thuộc phạm vi nghiệm thu đợt hiện tại và chưa có lịch thực hiện.

Do chưa có đầu vào ngữ cảnh nghiệp vụ do người dùng khai báo, cần bàn riêng cách xác định tiêu chí kiểm tra, đặc biệt tính duy nhất của cột, miền giá trị và quan hệ giữa các cột. Chưa mặc định chọn bộ quy tắc cố định hoặc dùng suy luận AI thay cho yêu cầu nghiệp vụ đã xác nhận.

### 3.8. Chọn sheet làm việc trong Excel

- **FILE-01 — Chọn mặc định:** Sau khi nhập file Excel, hệ thống tự động chọn sheet đầu tiên làm sheet làm việc.
- **FILE-02 — Đổi sheet:** Người dùng có thể đổi sang sheet khác trong cùng file; hệ thống chuyển sang làm việc trên sheet được chọn.
- Quy tắc cũ quay lại sheet thì reset đã được người dùng yêu cầu thay đổi: cần giữ trạng thái đã lưu. Xem mục 3.19 về lưu project và các điểm cần làm rõ trước khi chốt vòng đời sheet.
- Người dùng được chuyển sheet khi đang phân tích; hệ thống hủy lần phân tích đang chạy của sheet vừa rời. Lần chạy đã hủy không được dùng để tạo Tổng kết hoặc cập nhật trạng thái sheet mới, kể cả khi kết quả trả về muộn. Việc hủy không thay đổi bản project đã lưu. Cơ chế hủy kỹ thuật sẽ được thiết kế ở các bước sau.
- Chưa chốt cách lưu lịch sử kết quả. Hủy phân tích hoặc yêu cầu chạy lại không đồng nghĩa với đã cho phép xóa lịch sử trong database.
- Khi sheet đầu tiên rỗng, hệ thống vẫn mở sheet đầu tiên và thông báo sheet không có dữ liệu để người dùng tự đổi sang sheet khác; không tự chuyển sang sheet có dữ liệu. Trường hợp không có cấu trúc bảng hợp lệ còn cần chốt.
- Cho phép chọn và xem sheet được đặt trạng thái ẩn trong file Excel; không loại sheet khỏi danh sách chọn chỉ vì trạng thái ẩn. Quy tắc mặc định mở sheet đầu tiên vẫn áp dụng khi sheet đó ẩn. Việc xem trên hệ thống không thay đổi trạng thái ẩn trong file gốc.

### 3.9. Ba phần làm việc với dữ liệu

- **VIEW-01 — Data Views:** Các thao tác xem dữ liệu và lọc. Thao tác xóa dòng trên dữ liệu làm việc và giữ nguyên file gốc được ghi riêng tại mục 3.11.
- **ANALYSIS-01 — Data Analysis & Detection:** Thống kê và phân tích bằng số liệu; kết hợp tính năng của hệ thống và tính năng được AI hỗ trợ để phát hiện vấn đề, mô tả, cung cấp bằng chứng và đề xuất hướng xử lý. Đây là một phần làm việc trong tổng số ba phần người dùng mô tả.
- **SUMMARY-01 — Tổng kết:** Tổng hợp hai phần trước để đưa ra kết luận về bộ dữ liệu. Khi người có quyền phân tích mở Tổng kết mà chưa chạy Data Analysis & Detection, hệ thống yêu cầu chạy phân tích trước; không tự chạy phân tích hoặc tạo Tổng kết khi đó. Nếu đã phân tích nhưng sau đó xóa dòng, đổi cột phân tích hoặc chọn/đổi/bỏ nhãn, phải chạy lại phân tích theo đầu vào hiện tại trước khi tạo Tổng kết mới; không dùng kết quả đã lỗi thời để tạo Tổng kết mới.
- Nội dung Tổng kết đã được xác nhận gồm: tổng quan dữ liệu; các vấn đề và mức độ ảnh hưởng; bằng chứng; đề xuất xử lý theo thứ tự ưu tiên. Thang đánh giá ảnh hưởng, tiêu chí xếp ưu tiên và hình thức bằng chứng chi tiết chưa chốt. Khi AI lỗi, vẫn áp dụng quy tắc không có phần giải thích và đề xuất của AI bên dưới.
- Khi phần phân tích của hệ thống bị lỗi, không cho tạo Tổng kết mới và yêu cầu người dùng chạy lại phân tích. Chỉ tạo Tổng kết mới sau khi phần phân tích hệ thống thành công với đầu vào hiện tại; sự cố AI được xử lý riêng theo quy tắc bên dưới. Quy tắc này không xóa hoặc ghi đè bản project đã lưu.
- Khi phần phân tích của hệ thống đã thành công nhưng AI gặp sự cố, Tổng kết vẫn hiển thị các kết quả phân tích của hệ thống, không có phần giải thích và đề xuất của AI. Không bắt buộc chờ AI thành công mới hiển thị Tổng kết; quy tắc này không cho phép dùng kết quả phân tích đã lỗi thời.
- **AI-01 — Thử lại AI:** Sau sự cố AI, người có quyền phân tích được chủ động thử lại riêng phần AI để bổ sung giải thích và đề xuất. Khi dữ liệu và cấu hình phân tích không đổi, dùng lại kết quả phân tích hệ thống hiện có, không chạy lại phần hệ thống. Nếu đầu vào đã đổi, vẫn phải chạy lại phân tích theo mục 3.18; không dùng kết quả hệ thống lỗi thời. Viewer không được thực hiện thao tác này. Kết quả bổ sung chỉ cập nhật bản lưu project khi người có quyền bấm Lưu thành công theo mục 3.19.

Quy tắc dùng lại kết quả Data Analysis & Detection và Tổng kết được ghi tại mục 3.18. Việc khôi phục trạng thái đã lưu khi mở lại project hoặc sheet được bàn tại mục 3.19.

Ba phần này là phân nhóm chức năng, chưa phải quyết định chia thành ba module backend hoặc ba service riêng.

### 3.10. Chọn cột trước khi phân tích

- **VIEW-02 — Chọn cột:** Trước khi chạy phân tích, có phần tích chọn cột hiển thị tại Data Views; mặc định chọn toàn bộ cột.
- Người dùng chỉ được thay đổi lựa chọn cột tại Data Views.
- Cột được tích chọn là cột cần phân tích; cột bỏ tích không thuộc phạm vi phân tích. Mặc định tích toàn bộ cột.
- Phân tích dùng toàn bộ dòng của sheet đang làm việc trên các cột được chọn, không giới hạn theo bộ lọc hiển thị của Data Views.

### 3.11. Bổ sung thao tác xóa dữ liệu cơ bản

- **DATA-01 — Xóa dòng:** Hỗ trợ cả ba cách: xóa một dòng, xóa nhiều dòng được chọn và xóa một khoảng dòng.
- File đã tải lên được giữ nguyên. Thao tác xóa chỉ tác động dữ liệu làm việc, không ghi đè file gốc.
- Cả ba cách xóa đều xác định dòng bằng số dòng so với file gốc, không phải vị trí sau lọc/sắp xếp.
- Phải nêu rõ các dòng dữ liệu đã xóa và các cột được chọn để phân tích; vị trí và hình thức trình bày chi tiết sẽ được bàn tiếp.
- Không cần tính năng hoàn tác từng thao tác. Người dùng yêu cầu Reset Dataset để đưa toàn bộ trạng thái làm việc về ban đầu, xem mục 3.12.
- Cần xác định dữ liệu dùng cho các lần phân tích sau khi xóa và cách đánh dấu kết quả phân tích/tổng kết cũ không còn phù hợp.
- Khi chuyển sheet rồi quay lại, không còn mặc định khôi phục mọi dòng như vừa reset; trạng thái đã lưu và thay đổi chưa lưu cần được xử lý theo mục 3.19.
- Chưa triển khai hoặc thực hiện xóa dữ liệu. Không suy ra quyền AI tự động xóa dòng hoặc áp dụng đề xuất.

### 3.12. Reset Dataset

- **DATA-02 — Reset Dataset:** Chỉ đưa trạng thái của sheet đang làm việc về ban đầu, như vừa vào trang; đây là cơ chế reset sheet thay cho hoàn tác từng thao tác.
- Reset Dataset chỉ tác động trạng thái đang làm việc, không thay đổi hoặc xóa bản project đã lưu. Bản đã lưu được giữ nguyên cho đến khi người dùng bấm Lưu thành công lần tiếp theo; vẫn áp dụng quy tắc quyền lưu và từ chối lưu từ bản lỗi thời.
- File tải lên vẫn được giữ nguyên làm nguồn dữ liệu ban đầu.
- Reset Dataset khôi phục tên cột từ file gốc của sheet đang làm việc, bỏ tên đã chỉnh sửa trong trạng thái làm việc. Sau reset, toàn bộ sheet đang làm việc trở về trạng thái chưa chỉnh sửa và các cảnh báo tương ứng được hiển thị lại. Nếu tên gốc rỗng/trùng thì thông báo và yêu cầu sửa lại trước khi phân tích; tên chỉ chứa khoảng trắng vẫn chỉ cảnh báo theo mục 3.2. Reset không thay đổi bản project đã lưu cho đến lần Lưu thành công tiếp theo.
- Với Excel nhiều sheet, chỉ reset sheet đang được chọn; giữ nguyên lựa chọn sheet, không chuyển về sheet đầu tiên và không tác động các sheet khác.
- Chi tiết vòng đời các tác vụ/kết quả phân tích khi reset cần được xác định trong phạm vi sheet hiện tại.
- Reset trạng thái làm việc không mặc định cho phép xóa lịch sử/audit trong database; chính sách lưu lịch sử chưa chốt.

### 3.13. Lọc dữ liệu trong Data Views

- **VIEW-03 — Lọc văn bản:** Chứa, bằng, bắt đầu bằng.
- **VIEW-04 — Lọc số/ngày:** Bằng, lớn hơn, nhỏ hơn, trong khoảng.
- **VIEW-05 — Lọc ô trống:** Giá trị trống hoặc không trống.
- **VIEW-06 — Kết hợp bộ lọc:** Hỗ trợ điều kiện trên nhiều cột với cả AND (thỏa tất cả điều kiện) và OR (thỏa ít nhất một điều kiện). Khả năng phối hợp AND/OR trong nhóm lồng nhau và các quy tắc so khớp chi tiết chưa chốt.
- Người dùng đã đồng ý cả bốn nhóm trên. Bộ lọc chỉ thay đổi dữ liệu hiển thị; không sửa dữ liệu và không giới hạn các dòng được phân tích.
- Bộ lọc được làm mới khi reset hoặc quay lại sheet, theo quy tắc trạng thái đã chốt.

### 3.14. Sắp xếp và tìm kiếm trong Data Views

- **VIEW-07 — Sắp xếp:** Hỗ trợ sắp xếp tăng/giảm theo cột. Chưa chốt sắp xếp một hay nhiều cột đồng thời, thứ tự giá trị trống hoặc dữ liệu hỗn hợp.
- **VIEW-08 — Tìm kiếm:** Hỗ trợ tìm kiếm giá trị trong bảng. Chưa chốt phạm vi tìm kiếm (toàn bảng hay cột chỉ định), kiểu khớp và cách kết hợp với bộ lọc.
- Người dùng đã đồng ý cả hai tính năng. Đây là các thao tác xem dữ liệu; không đổi dữ liệu gốc hoặc số dòng tham chiếu dùng để xóa, không giới hạn phạm vi phân tích.

### 3.15. Phân tích theo thời gian

- **ANALYSIS-02 — Phân tích theo thời gian:** Người dùng yêu cầu bổ sung khi dữ liệu có thông tin thời gian phù hợp; thuộc Data Analysis & Detection.
- Gợi ý cột ngày/ngày–giờ hợp lệ trong các cột được chọn phân tích: một cột phù hợp thì tự chọn và hiển thị rõ, nhiều cột thì yêu cầu người dùng chọn một trục thời gian tại Data Views. Không có cột phù hợp thì báo Không áp dụng phân tích thời gian, không tự dùng cột bị bỏ chọn.
- Tổng hợp ngày/tuần/tháng/năm, mặc định ngày; tuần bắt đầu thứ Hai, tháng/năm theo lịch và nêu rõ quy ước. Dữ liệu có múi giờ cần thống nhất múi giờ tổng hợp; không tự gán múi giờ cho dữ liệu không có. Trộn cách biểu diễn chưa đối chiếu được thì yêu cầu xác định cấu hình trước.
- Mặc định có số bản ghi mỗi kỳ. Với cột số định lượng được chọn theo dõi, mặc định trung vị; cho chọn trung bình, trung vị, min/max và tổng khi người dùng chủ động chọn. Giữ outliers; mỗi kỳ công bố số giá trị hợp lệ dùng tính, số thiếu và không hợp lệ.
- Ngày thiếu/sai/mơ hồ bị loại khỏi phép tổng hợp thời gian với số lượng/lý do, không tự sửa hay xóa dòng dataset. Nhiều bản ghi cùng thời điểm vẫn tổng hợp, không tự coi là lỗi trùng. Tạo kỳ từ thời điểm hợp lệ sớm nhất đến muộn nhất; không suy thiếu ngoài phạm vi này khi chưa có khoảng kỳ vọng.
- Kỳ không có bản ghi có số bản ghi bằng 0; thống kê giá trị gồm cả tổng báo không có dữ liệu, không tự điền 0. Không nội suy hoặc nối đường biểu đồ qua khoảng không có giá trị. Báo danh sách kỳ trống, số kỳ trống và chuỗi kỳ trống liên tiếp dài nhất dưới dạng khoảng trống quan sát được, không kết luận mất dữ liệu khi chưa có lịch thu thập kỳ vọng.
- So với kỳ liền trước: chênh lệch tuyệt đối khi tính được; phần trăm thay đổi chỉ khi giá trị kỳ trước dương. Kỳ trước bằng 0/âm/không có dữ liệu thì không trả phần trăm thay đổi thông thường. Không nhảy qua kỳ trống để lấy kỳ gần nhất có dữ liệu làm kỳ liền trước.
- Sàng lọc biến động bằng IQR trên các chênh lệch của hai kỳ liên tiếp hợp lệ, hệ số mặc định 1,5; gọi kết quả là Biến động lớn cần kiểm tra. Đây là lựa chọn sàng lọc của dự án, chưa điều chỉnh mùa vụ. Quá ít chênh lệch hợp lệ hoặc IQR = 0 thì báo chưa đủ điều kiện, không kết luận không có bất thường. Số lượng tối thiểu và giới hạn tham số cần thiết kế sau.
- Giữ bảng theo kỳ và biểu đồ đường/cột thời gian, không bổ sung biểu đồ quan hệ giữa các cột đã bỏ. Nêu giới hạn do mùa vụ, số ngày mỗi tháng khác nhau, kỳ đầu/cuối có thể chỉ quan sát một phần và kỳ ít mẫu. Chưa triển khai phân rã xu hướng–mùa vụ hoặc dự báo trong đợt này; phương pháp đơn giản dễ giải thích/kiểm thử nhưng có thể cảnh báo nhầm khi có mùa vụ.
- Cấu hình cột thời gian, mức tổng hợp, chỉ số và ngưỡng tại Data Views; thay đổi yêu cầu phân tích lại, lưu/khôi phục cùng trạng thái và thể hiện trong Tổng kết/PDF theo quy tắc thay đổi cuối cùng. AI chỉ nhận thống kê tổng hợp; khoảng trống hoặc biến động chưa mặc định là lỗi.

### 3.16. Biểu đồ và các đánh giá bổ sung

- **ANALYSIS-03 — Biểu đồ:** Có biểu đồ phục vụ thống kê, phân tích và phát hiện vấn đề. Loại biểu đồ, dữ liệu biểu diễn và mức tổng hợp chưa chốt. Phạm vi triển khai vẫn là backend; chưa mở rộng sang xây dựng giao diện.
- **ANALYSIS-04 — Tương quan và mối liên hệ:** Hỗ trợ số–số bằng Pearson/Spearman, phân loại–phân loại bằng Cramér’s V, số–phân loại bằng η²; quy tắc tại mục 3.23. Trình bày bằng bảng giá trị, không dùng chung một hệ số cho mọi loại cột. Giữ quyết định bỏ biểu đồ giữa các cột (scatter plot, box plot theo nhóm, cột nhóm/cột chồng giữa hai cột, heatmap tương quan); biểu đồ thống kê mô tả tại mục 3.21 vẫn được giữ.
- **ANALYSIS-05 — Đa cộng tuyến:** VIF trên các cột số định lượng được chọn phân tích, loại cột nhãn và không đưa mã định danh vào; không tự mã hóa cột phân loại. Dùng tập dòng hợp lệ chung, cảnh báo VIF > 5 theo mục 3.23. Việc mở rộng ANALYSIS-04 sang cột phân loại không thay đổi phạm vi VIF này.
- **ANALYSIS-06 — Outliers:** Áp dụng DQ-04 tại mục 3.5.4: IQR mặc định, hỗ trợ Modified Z-score hoặc cả hai cho từng cột định lượng. Outliers đa biến bàn riêng; không mặc định outlier là lỗi cần xóa.
- **ANALYSIS-07 — Mất cân bằng dữ liệu:** Đánh giá phân bố lớp của cột nhãn phân loại do người dùng chọn theo mục 3.17; hệ thống không tự gán nhãn. Thống kê từng lớp, Imbalance Ratio và cảnh báo IR ≥ 3 theo mục 3.24; không tự coi mất cân bằng là dữ liệu sai.
- Các đánh giá này vẫn phục vụ phát hiện, mô tả, bằng chứng và đề xuất; không tự động sửa dữ liệu hoặc áp dụng đề xuất. Mức phù hợp của mỗi đánh giá với dữ liệu cần được xác định trước khi tính toán.

### 3.17. Lựa chọn cột nhãn

- Tính năng lựa chọn, đổi và bỏ nhãn nằm tại Data Views. Bảng hiển thị dữ liệu phải chỉ rõ cột đang được chọn làm nhãn; hình thức thể hiện cụ thể chưa chốt.
- Mặc định không có cột nhãn; việc chọn nhãn là tùy chọn.
- Khi có nhu cầu, người dùng chủ động mở tính năng lựa chọn nhãn. Hệ thống gợi ý các cột có thể dùng làm nhãn, người dùng chọn một cột trong danh sách đó.
- Không tự chọn hoặc tự gán một cột làm nhãn chỉ vì hệ thống đã gợi ý. Tiêu chí gợi ý cột phù hợp chưa được thống nhất.
- Khi không có cột phù hợp trong danh sách gợi ý, người dùng không thể chọn nhãn. Hệ thống vẫn cho phép sử dụng các phân tích không cần nhãn; không thực hiện đánh giá mất cân bằng theo nhãn khi chưa có nhãn được chọn.
- Người dùng được đổi sang một cột nhãn khác trong danh sách gợi ý hoặc bỏ chọn để trở về trạng thái không có nhãn.
- Chưa chốt quan hệ giữa cột nhãn và các cột được tích chọn phân tích. Khi đổi/bỏ nhãn, áp dụng quy tắc chạy lại tại mục 3.18; cách lưu lịch sử kết quả chưa chốt.

### 3.18. Chốt dữ liệu và dùng lại kết quả phân tích

- Data Views là nơi chốt toàn bộ cấu trúc dữ liệu làm việc trước khi chuyển sang Data Analysis & Detection, bao gồm lựa chọn cột phân tích và cột nhãn nếu có. Yêu cầu này không tự mở rộng sang thao tác sửa ô hoặc schema chưa được thống nhất.
- Khi đã có kết quả phân tích và dữ liệu/cấu hình phân tích tại Data Views không thay đổi, mở lại Data Analysis & Detection không cần chạy lại.
- Khi dữ liệu/cấu hình phân tích tại Data Views thay đổi, bao gồm chọn, đổi hoặc bỏ nhãn, Data Analysis & Detection phải chạy lại khi người dùng mở phần này. Không tự chạy ngay tại thời điểm thay đổi trong Data Views.
- Lọc, sắp xếp, tìm kiếm và phân trang chỉ thay đổi hiển thị, không khiến phân tích chạy lại. Xóa dòng, đổi cột phân tích hoặc chọn/đổi/bỏ nhãn là thay đổi đầu vào khiến phân tích cần chạy lại khi mở phần này.
- Tổng kết dùng lại khi kết quả phân tích không đổi; tạo lại khi đã có kết quả phân tích mới và người dùng mở Tổng kết.
- Nếu dữ liệu/cấu hình phân tích đã thay đổi nhưng chưa chạy lại phân tích, hệ thống yêu cầu chạy lại Data Analysis & Detection trước khi tạo Tổng kết mới. Các thao tác chỉ đổi hiển thị không làm phát sinh yêu cầu này.
- Quy tắc cũ reset khi quay lại sheet được thay thế bằng yêu cầu lưu tại mục 3.19. Khi đổi sheet, hủy phân tích đang chạy theo mục 3.8; khi phân tích lỗi, áp dụng quy tắc Tổng kết và Thử lại AI tại mục 3.9.

### 3.19. Lưu trạng thái project — yêu cầu mới đang làm rõ

- **Thay đổi v1 / 2026-11-03:** Người dùng thay quy tắc reset khi quay lại sheet bằng lưu tại Tổng kết và khôi phục lần lưu cuối / Cần giữ kết quả làm việc / Ảnh hưởng mục 3.8, 3.9, 3.11, 3.18 và chính sách quyền ở phần 6; chưa chốt chi tiết lưu.
- Có nút Lưu tại Tổng kết. Khi truy cập lại project, khôi phục trạng thái theo lần lưu cuối cùng của người dùng có quyền lưu; không mặc định reset sheet đã lưu khi quay lại.
- Theo ví dụ người dùng: lưu sheet A, sang sheet B mới để thao tác từ trạng thái ban đầu; nếu chưa lưu B rồi quay lại A thì trạng thái A vẫn được giữ.
- Project sử dụng bản được lưu cuối cùng, gắn với sheet được lưu ở lần đó; không duy trì các bản lưu riêng cho từng sheet để khôi phục song song. Lưu B thì B trở thành bản hiện hành; mở lại project hiển thị sheet và trạng thái của B.
- Nếu bản hiện hành là A, sang B thao tác nhưng không lưu rồi quay lại A thì khôi phục bản A đã lưu gần nhất. Thay đổi chưa lưu không trở thành trạng thái được khôi phục của project.
- Khi Lưu tại Tổng kết thành công, tên cột đã chỉnh sửa được lưu và khôi phục cùng bản project hiện hành. Reset vẫn khôi phục tên từ file gốc trong trạng thái làm việc theo mục 3.12.
- Nội dung bản lưu đã được xác nhận gồm: sheet đang làm việc; trạng thái dữ liệu sau khi xóa dòng kèm số dòng gốc đã xóa; tên cột trong trạng thái làm việc, gồm tên đã nhập/chỉnh sửa; các cột được chọn phân tích và cột nhãn nếu có; kết quả Data Analysis & Detection (thống kê, biểu đồ, vấn đề, bằng chứng và đề xuất); nội dung Tổng kết. Cách biểu diễn/lưu trữ kỹ thuật chưa chốt, file gốc vẫn được giữ nguyên.
- Bản lưu bao gồm toàn bộ trạng thái hiển thị đã bàn: bộ lọc, sắp xếp, tìm kiếm và trang đang xem. Khi mở lại project, khôi phục các trạng thái này theo bản lưu cuối cùng cùng với dữ liệu, cấu hình và kết quả đã xác nhận; không đưa riêng trạng thái hiển thị về mặc định. Việc lưu vẫn thực hiện qua nút Lưu tại Tổng kết, không tự động lưu mỗi thao tác.
- Khi chọn sheet không thuộc bản lưu hiện hành, bắt đầu từ dữ liệu gốc và trạng thái mặc định. Ví dụ: đã lưu A rồi lưu B thì B là bản hiện hành; quay lại A không khôi phục bản A trước đây mà bắt đầu lại từ dữ liệu gốc, trạng thái mặc định.
- Reset Dataset không thay đổi bản lưu hiện hành; chỉ lần Lưu thành công tiếp theo mới cập nhật bản này, theo mục 3.12. Quy tắc chỉ khôi phục bản cuối không đồng nghĩa với yêu cầu xóa lịch sử/audit.
- Project Member được thao tác dữ liệu, chạy phân tích và lưu. Viewer được xem Data Views và lọc, đồng thời xem kết quả đã lưu ở Data Analysis & Detection và Tổng kết; không được thao tác các tính năng bên trong hai phần này, tạo/chạy lại kết quả, thay đổi dữ liệu hoặc lưu. Việc Viewer mở các phần này không được kích hoạt chạy phân tích/Tổng kết theo mục 3.18. Còn xác nhận quyền sắp xếp/tìm kiếm tại Data Views. Workspace Owner giữ toàn quyền sau khi giao project; chi tiết mô hình quyền được ghi tại phần 6.
- Khi nhiều người cùng mở một bản, nếu một người đã lưu bản mới thì yêu cầu lưu từ bản cũ của người còn lại phải bị từ chối. Hệ thống thông báo có bản mới và yêu cầu tải lại trước khi tiếp tục; không ghi đè bản mới bằng thay đổi dựa trên bản cũ. Người dùng có thể cần kiểm tra và thực hiện lại thay đổi của mình sau khi tải lại. Cơ chế kỹ thuật chưa chốt.

### 3.20. Xuất báo cáo PDF

- **REPORT-01 — Xuất báo cáo:** Cho phép xuất Tổng kết thành file PDF để tải xuống. Người dùng đã chọn định dạng PDF; chưa yêu cầu xuất báo cáo Excel.
- Nội dung nghiệp vụ dựa trên Tổng kết tại mục 3.9; bố cục báo cáo và mức chi tiết của biểu đồ/bằng chứng sẽ được thống nhất sau.
- Cho phép xuất báo cáo từ Tổng kết hiện tại trong lúc làm việc mà không cần lưu project trước. Xuất PDF không tự lưu hoặc thay thế bản project hiện hành; vẫn dùng nội dung Tổng kết hợp lệ theo mục 3.9.
- Viewer được tải báo cáo PDF từ nội dung họ có quyền xem. Đây là quyền tải báo cáo, không cấp quyền tạo/chạy lại phân tích, tạo Tổng kết mới hoặc lưu project cho Viewer; không mặc định cho Viewer xem trạng thái chưa lưu của người khác.
- Đây là yêu cầu tính năng backend; chưa chọn thư viện tạo PDF hoặc triển khai xuất file.

### 3.21. Thống kê mô tả và biểu đồ minh họa

- Thống kê mô tả thuộc Data Analysis & Detection. Người dùng yêu cầu có biểu đồ đại diện đi kèm chỉ số và bảng số liệu để dễ quan sát; cụ thể hóa yêu cầu biểu đồ tại mục 3.16.
- Danh sách chỉ số đang đề xuất gồm: tổng quan dòng/cột và phạm vi phân tích; kiểu dữ liệu, số lượng/tỷ lệ thiếu và số giá trị khác nhau theo cột; min/max, trung bình, trung vị, độ lệch chuẩn và tứ phân vị cho cột số; tần suất/tỷ lệ giá trị cho cột phân loại hoặc văn bản; khoảng thời gian và số giá trị không đọc được thành ngày giờ cho cột thời gian. Danh sách chi tiết chưa được chốt toàn bộ.
- Các loại biểu đồ đã được người dùng đồng ý: biểu đồ cột so sánh tỷ lệ thiếu giữa các cột; histogram thể hiện phân bố cột số; box plot thể hiện trung vị, tứ phân vị và các điểm có thể bất thường; biểu đồ thanh thể hiện tần suất/tỷ lệ giá trị của cột phân loại; biểu đồ đường hoặc cột thể hiện số bản ghi theo thời gian.
- Các giá trị chính xác vẫn được trình bày trong bảng số liệu. Với cột có nhiều giá trị khác nhau, biểu đồ hiển thị Top N giá trị phổ biến và gộp phần còn lại thành nhóm “Khác”. N mặc định là 5; người có quyền thao tác được nhập số nguyên dương tùy ý từ 1 đến 20, không giới hạn vào danh sách mức cố định. Đây là cách trình bày biểu đồ, không thay đổi dữ liệu gốc hoặc phạm vi phân tích. Cách xử lý đồng hạng chưa chốt.
- Viewer chỉ xem biểu đồ theo cấu hình đã lưu, không được thay đổi N hoặc cấu hình biểu đồ. Cấu hình Top N được lưu cùng bản project để khôi phục đúng cách hiển thị đã lưu.
- Quy tắc chia khoảng histogram còn cần bàn; tổng hợp thời gian theo mục 3.15, điểm bất thường theo IQR tại mục 3.5.4. Không mặc định điểm bất thường là lỗi.
- Phạm vi triển khai vẫn là backend cung cấp kết quả phục vụ biểu đồ, chưa triển khai giao diện.

### 3.22. Nhận diện, tinh chỉnh loại cột và thao tác trước phân tích

- Hệ thống tự nhận diện loại cột; người có quyền thao tác được tinh chỉnh lại tại Data Views, ví dụ xác định cột chứa mã số là cột phân loại. Viewer không được tinh chỉnh. Tách kiểu dữ liệu và vai trò phân tích theo mục 3.5.3; thuật toán nhận diện và kiểm tra tính hợp lệ của lựa chọn cần thiết kế sau.
- Bổ sung lựa chọn định dạng số/ngày tại Data Views theo DQ-03. Đổi kiểu, vai trò hoặc định dạng làm thay đổi đầu vào phân tích và cần chạy lại theo mục 3.18. Cấu hình định dạng thuộc trạng thái lưu/khôi phục; thay đổi cuối cùng còn hiệu lực được thể hiện trong Tổng kết và PDF như các thao tác trước phân tích khác.
- Đây là cấu hình dùng để phân tích, không mặc định cho phép sửa giá trị ô hoặc ghi đè file gốc. Thay đổi loại cột làm thay đổi đầu vào phân tích, áp dụng quy tắc chạy lại tại mục 3.18 trước khi tạo Tổng kết mới.
- Tổng kết có mục “Các thao tác trước phân tích” để thể hiện thao tác với bộ dữ liệu trước lần phân tích được tổng kết, bao gồm tinh chỉnh loại cột. Nội dung này cần khớp với đầu vào thực tế của lần phân tích, không trộn thay đổi phát sinh sau đó.
- Thông tin loại cột đã tinh chỉnh và mục thao tác thuộc trạng thái cần lưu/khôi phục; mục thao tác thuộc nội dung Tổng kết được xuất PDF. Các yêu cầu trước về nêu rõ dòng đã xóa và cột được chọn phân tích vẫn áp dụng.
- Mục “Các thao tác trước phân tích” chỉ hiển thị những thay đổi cuối cùng còn hiệu lực so với dữ liệu gốc và cấu hình ban đầu, không liệt kê toàn bộ lịch sử thao tác. Ví dụ: đổi loại cột từ số sang phân loại rồi trở lại số ban đầu thì không liệt kê là thay đổi loại cột. Nội dung phản ánh trạng thái dùng cho lần phân tích được tổng kết.
- Mức chi tiết như loại cột trước/sau, người thực hiện và thời điểm chưa chốt. Quy tắc hiển thị thay đổi cuối cùng không quyết định schema audit hoặc chính sách lưu lịch sử nội bộ.

### 3.23. Phương pháp liên hệ giữa các cột và VIF đã xác nhận

- Số–số: mặc định tính cả Pearson (liên hệ tuyến tính) và Spearman (liên hệ đơn điệu theo thứ hạng), hiển thị riêng; cho chọn một phương pháp tại Data Views. Không tự chọn chỉ dựa vào kiểm tra phân phối chuẩn. Kết quả khác nhau chỉ là dấu hiệu cần xem xét, không tự kết luận nguyên nhân; giữ outliers trong phép tính theo phạm vi đã chốt.
- Phân loại–phân loại: Cramér’s V từ bảng tần suất kết hợp, phạm vi 0–1, không có chiều âm/dương; không tự mã hóa tên nhóm thành số để tính Pearson. Báo số nhóm mỗi cột và số quan sát; cảnh báo thiếu ổn định khi nhiều nhóm/ít dữ liệu, không tự gộp nhóm hiếm.
- Số–phân loại: Eta-squared (η²) mô tả tỷ phần biến thiên của cột số gắn với khác biệt trung bình giữa các nhóm. Kèm bảng số quan sát, trung bình, trung vị và độ lệch chuẩn khi tính được theo nhóm. Không diễn giải nhân quả; nhóm quá nhỏ/quá nhiều có thể gây hiểu nhầm; không bao quát mọi khác biệt phân phối. Trước mắt chưa tự bổ sung kiểm định ANOVA/p-value.
- Phân tích từng cặp dùng dòng hợp lệ đồng thời ở hai cột, không tự điền thiếu hoặc xóa dòng khỏi dataset. Mỗi cặp báo số dùng/bị loại và lý do; thiếu ở cột thứ ba không loại dòng của cặp này. Đánh đổi: tận dụng dữ liệu hơn loại theo toàn bộ cột, nhưng mỗi cặp có thể dùng tập dòng khác nhau nên không hoàn toàn so sánh trực tiếp.
- Cột hằng, thiếu nhóm hoặc không đủ dữ liệu thì báo Không tính được và lý do, không thay kết quả bằng 0. Số quan sát tối thiểu và ngưỡng cảnh báo nhóm thưa cần thiết kế chi tiết.
- VIF cần ít nhất hai cột phù hợp; loại cột nhãn, định danh và không mã hóa phân loại. Dùng một tập dòng có giá trị hợp lệ trên toàn bộ cột tham gia VIF; công bố danh sách cột và số dòng dùng/bị loại. Cột hằng được báo riêng và loại khỏi phép tính, không âm thầm bỏ. Kiểm tra số quan sát và phụ thuộc tuyến tính trước khi trả kết quả; báo rõ phụ thuộc tuyến tính hoàn hảo, không đổi VIF vô hạn thành số hữu hạn tùy ý.
- VIF không cần cột nhãn để tính và bổ sung cho tương quan từng cặp. Ngưỡng cảnh báo tham khảo **VIF > 5** là cần kiểm tra, không tự chứng minh dữ liệu sai hoặc yêu cầu xóa cột. Không dùng chung thang yếu/vừa/mạnh cho Pearson, Cramér’s V và η²; không tự gán mức ảnh hưởng Cao từ liên hệ/VIF cao.
- Kết quả bằng bảng, gồm phương pháp, cột, giá trị, số quan sát thực tế và cảnh báo điều kiện tính; không bổ sung biểu đồ giữa các cột. Cấu hình phương pháp tại Data Views tuân thủ quy tắc lưu/khôi phục, thay đổi đầu vào yêu cầu phân tích lại và thể hiện thay đổi cuối cùng trong Tổng kết/PDF.
- Nguồn tham khảo phương pháp: [SciPy — Association](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.contingency.association.html), [SciPy — Pearson](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html), [statsmodels — Effect sizes](https://www.statsmodels.org/stable/generated/statsmodels.stats.oneway._fstat2effectsize.html), [statsmodels — VIF](https://www.statsmodels.org/stable/generated/statsmodels.stats.outliers_influence.variance_inflation_factor.html). Đây chưa phải quyết định chọn thư viện triển khai.

### 3.24. Đánh giá mất cân bằng lớp đã xác nhận

- Chỉ đánh giá khi người dùng chọn nhãn phù hợp cho phân loại, dựa vào vai trò cột tại Data Views, không suy từ việc cột chứa số nguyên. Chưa chọn nhãn: Chưa đánh giá — chưa chọn cột nhãn. Nhãn liên tục: Không áp dụng đánh giá mất cân bằng lớp, vẫn thống kê phân bố số và không tự chia khoảng tạo lớp. Không còn nhãn hợp lệ: Không có dữ liệu nhãn hợp lệ. Chỉ quan sát một lớp: báo rõ, không kết luận cân bằng.
- Với ít nhất hai lớp quan sát được: báo số dòng nhãn hợp lệ; số thiếu/không hợp lệ riêng; số lớp; số lượng/tỷ lệ từng lớp; lớp lớn nhất/nhỏ nhất (đầy đủ các lớp đồng hạng); **IR = số mẫu lớp lớn nhất / số mẫu lớp nhỏ nhất**. IR chỉ phản ánh hai đầu nên phải đi cùng phân bố đầy đủ, không dùng làm kết luận duy nhất.
- Tỷ lệ lớp tính trên số dòng có nhãn hợp lệ. Nhãn thiếu không tự thành lớp Không rõ; thiếu ở đặc trưng khác không loại dòng khỏi thống kê nhãn. Dùng toàn bộ sheet đang làm việc sau xóa dòng đã xác nhận, không phụ thuộc lọc hiển thị. Không tự gộp nhãn gần giống, điền nhãn hoặc xóa dòng trùng. Nêu rõ phân bố chỉ phản ánh phần có nhãn hợp lệ và có thể lệch so với thực tế do nhãn thiếu.
- **IR ≥ 3** bật cảnh báo Có chênh lệch đáng chú ý về số lượng giữa các lớp. Đây là ngưỡng mặc định do dự án lựa chọn, không phải chuẩn thống kê chung; không tự gán mức ảnh hưởng Cao hoặc kết luận dataset không dùng được. Luôn xem cùng số mẫu tuyệt đối; ngưỡng cảnh báo lớp quá ít mẫu cần bàn riêng.
- Bảng phân bố đầy đủ các lớp, có thể phân trang; biểu đồ cột thể hiện số lượng/tỷ lệ. Top N và Khác chỉ để hiển thị theo quy tắc đã chốt; IR, lớp nhỏ nhất và cảnh báo tính trên tất cả lớp gốc, không tính lại sau gộp Khác.
- Chỉ đề xuất kiểm tra tính đại diện/thu thập thêm dữ liệu; nếu mục tiêu huấn luyện mô hình thì có thể gợi ý cân nhắc trọng số lớp/lấy mẫu phù hợp. Không tự cân bằng, sinh mẫu, xóa mẫu hoặc huấn luyện mô hình. AI chỉ nhận thống kê, giải thích giới hạn và đề xuất có điều kiện, không khẳng định chất lượng mô hình khi chưa đánh giá mô hình.
- Ngưỡng cảnh báo nếu cho chỉnh phải đặt tại Data Views, lưu cùng cấu hình và thể hiện trong Tổng kết; quyền chỉnh và giới hạn giá trị còn cần chốt. Không mặc định thêm chức năng chỉnh ngưỡng từ mô tả điều kiện này.
- Đánh đổi: cảnh báo có ngưỡng giúp nhận biết chênh lệch nhưng mang tính quy ước; số lượng mẫu và mục tiêu sử dụng vẫn cần để đánh giá tác động. Phương án chỉ báo chỉ số ít áp đặt hơn nhưng chưa được chọn cho mặc định hiện tại.

## 4. Đầu vào và đầu ra


- **Đầu vào:** Yêu cầu người dùng, kết quả các phần trước và mã nguồn/tài liệu hiện trạng liên quan.
- **Đầu ra:** Hoàn thiện kế hoạch lần đầu trong file v1 này; ghi rõ quyết định, lý do, phương án khác, trade-off, rủi ro, giới hạn và ảnh hưởng liên quan.

## 5. Điều kiện hoàn tất phần này

Danh sách tính năng được người dùng xác nhận, không mặc định giữ nguyên các module cũ.

## 6. Câu hỏi và phụ thuộc còn mở

- Đã chốt chỉ `.xlsx` và `.csv`, tiêu đề bộ dữ liệu từ tên file, tên cột từ dòng đầu tiên; tên cột rỗng/trùng chỉ cảnh báo, vẫn chấp nhận Import và gắn file vào project nếu không có lỗi Import khác, không yêu cầu tải lại vì tên cột. Tên cột phân biệt hoa/thường và khoảng trắng; tên chỉ chứa khoảng trắng chỉ cảnh báo. Tên cột rỗng/trùng phải được nhập/chỉnh sửa trên hệ thống trước khi phân tích. Workspace Owner, Project Owner và Project Member được nhập/chỉnh sửa tên cột; Viewer chỉ xem cảnh báo, không được sửa tên cột. Đã chốt kiểm tra tất cả sheet khi Import, gồm sheet ẩn; thông báo theo sheet và chỉ chặn phân tích sheet còn tên cột rỗng/trùng. Cần chốt giới hạn dung lượng, quy ước đọc CSV và bảng không hợp lệ.
- Có cần nhóm điều kiện lồng nhau để phối hợp AND/OR không? Quy tắc so khớp văn bản, giá trị trống và biên khoảng số/ngày cần được xác định chi tiết.
- Sắp xếp một hay nhiều cột? Tìm kiếm trên toàn bảng hay cột chỉ định, theo kiểu khớp nào và kết hợp với bộ lọc ra sao?
- Sau khi xóa, các lần phân tích dùng dữ liệu còn lại như thế nào và kết quả cũ được xử lý ra sao?
- Đã chốt vẫn mở và thông báo khi sheet đầu tiên rỗng, cho phép chọn/xem sheet ẩn. Sheet không có cấu trúc bảng hợp lệ thì xử lý thế nào?
- Các ngưỡng ảnh hưởng và điều kiện chi tiết còn mở của DQ-01 đến DQ-04 là gì? DQ-05 giữ giới hạn chưa đánh giá khi chưa có quy tắc theo mục 3.5.5; cấu hình quy tắc tiếp tục hoãn.
- Phân tích thời gian đã chốt tại mục 3.15; còn cần thiết kế số kỳ tối thiểu, giới hạn tham số, quy tắc biên kỳ chi tiết và xử lý cấu hình múi giờ.
- Tiêu chí gợi ý, loại nhãn hỗ trợ và quan hệ giữa cột nhãn với các cột được chọn phân tích là gì? Lịch sử kết quả cũ được lưu thế nào khi đổi/bỏ nhãn?
- Cần chốt thêm điều kiện số mẫu tối thiểu, ngưỡng nhóm thưa/lớp quá ít mẫu, giới hạn cấu hình và các chi tiết còn mở của mục 3.5.4, 3.23, 3.24; các phương pháp và ngưỡng mặc định đã xác nhận tại các mục này không còn là câu hỏi mở.
- AI cần hỗ trợ phát hiện vấn đề gì trong đợt hiện tại, khi tính năng nhập ngữ cảnh nghiệp vụ đang được hoãn?
- Nguồn xác định các tiêu chí kiểm tra phụ thuộc nghiệp vụ là gì khi chưa có chức năng khai báo quy tắc từ người dùng?
- Bằng chứng cần thể hiện ở mức dòng/cột/ô, thống kê hay hình thức nào khác?
- Có cần lưu lịch sử kết quả ngoài bản lưu hiện hành không?
- Các tính năng hiện có liên quan đến sửa/làm sạch dữ liệu sẽ được loại bỏ hoặc chuyển mục đích cụ thể như thế nào?

Nếu phát hiện mâu thuẫn với phần trước, cần xác nhận lại và cập nhật version phù hợp trước khi thực hiện công việc phụ thuộc.

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v1 / 2026-11-04:** Workspace Owner, Project Owner và Project Member được sửa tên cột; Viewer chỉ xem cảnh báo. Reset đưa toàn bộ sheet đang làm việc về trạng thái chưa sửa và hiển thị lại cảnh báo / Theo xác nhận người dùng / Đồng bộ mục 3.2, 3.12, câu hỏi mở và phần 6; giữ phạm vi reset một sheet và bản lưu hiện hành, chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Kiểm tra tất cả sheet khi Import Excel, gồm sheet ẩn; thông báo theo từng sheet, chỉ yêu cầu sửa tên cột của sheet đang phân tích / Theo xác nhận hướng đề xuất của người dùng / Cập nhật mục 3.2 và câu hỏi mở, giữ quy tắc sheet rỗng; chưa sửa backend.

- **Điều chỉnh v1 / 2026-11-04:** Vẫn nhận file có tên cột rỗng/trùng nhưng thông báo và yêu cầu nhập/chỉnh sửa tên trên hệ thống trước khi phân tích / Theo yêu cầu mới của người dùng / Thay quyết định cho phân tích khi tên còn lỗi; đồng bộ mục 3.2, Reset, Lưu và câu hỏi mở theo quy tắc giữ file gốc và lưu toàn bộ trạng thái; chưa sửa backend.

- **Xác nhận v1 / 2026-11-04:** Cột có tên rỗng/trùng vẫn được chọn và phân tích bình thường, kèm cảnh báo / Theo xác nhận người dùng / Chốt mục 3.2 và cập nhật câu hỏi mở, không chặn phân tích vì tên cột; chưa sửa backend.
- **Điều chỉnh v1 / 2026-11-04:** Tên cột rỗng/trùng chỉ cảnh báo, vẫn chấp nhận Import và gắn file nếu không có lỗi Import khác / Theo yêu cầu sửa lại của người dùng / Thay quy định từ chối và yêu cầu tải lại vì tên cột tại mục 3.2 và câu hỏi mở; chưa tự bổ sung sửa tên hoặc chốt quyền chạy phân tích, chưa sửa backend.

- **Điều chỉnh v1 / 2026-11-04:** Tên cột rỗng/trùng là lỗi Import, báo rõ cột lỗi và yêu cầu sửa file rồi tải lại trước khi gắn vào project / Theo lựa chọn mới của người dùng / Thay phương án sửa tên trên hệ thống; đồng bộ mục 3.2, Reset, nội dung Lưu và câu hỏi mở; giữ lịch sử quyết định cũ bên dưới, chưa sửa backend.

- **Tinh chỉnh v1 / 2026-11-04:** Bổ sung Import file và kiểm tra ngay sau tải lên; lỗi tải/đọc file hoặc loại chưa hỗ trợ chưa gắn vào project và được nhập lại / Theo xác nhận và mô tả người dùng / Làm rõ thời điểm gắn file tại mục 3.2; phạm vi nhập lại khi tên cột lỗi cần xác nhận, chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Gắn file ngay khi tải lên; tên cột lỗi được sửa trên hệ thống, tải file đã sửa cần project mới / Theo lựa chọn người dùng để thống nhất với quy tắc không thay file / Cập nhật mục 3.2 và thay lựa chọn tải lại trong cùng project khi tên cột lỗi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Không cho phép thay thế file dữ liệu của project; file khác cần project mới / Theo lựa chọn người dùng / Cập nhật mục 3.2, ghi điểm cần làm rõ với luồng sửa file rồi tải lại khi tên cột lỗi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Mỗi project chỉ chứa một file dữ liệu / Theo lựa chọn người dùng / Chốt phạm vi tại mục 3.2; cơ chế thay thế file còn cần bàn, chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Chưa hỗ trợ file Excel có mật khẩu mở file; thông báo để người dùng gỡ mật khẩu rồi tải lại / Theo xác nhận người dùng / Bổ sung giới hạn nhập file tại mục 3.2; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Mỗi sheet có dữ liệu chứa một bảng duy nhất, dòng đầu là tên cột và các dòng bên dưới là dữ liệu / Theo xác nhận người dùng / Bổ sung phạm vi tại mục 3.2, giữ quy tắc sheet rỗng tại mục 3.8; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** File `.xlsx` chỉ chứa giá trị có sẵn, không có ô công thức / Theo xác nhận người dùng / Bổ sung giới hạn đầu vào tại mục 3.2, chưa đưa xử lý công thức vào phạm vi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Đầu vào không có ô gộp / Theo mô tả người dùng / Ghi giới hạn dữ liệu tại mục 3.2, chưa đưa xử lý ô gộp vào phạm vi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Cho phép chọn và xem sheet ẩn / Theo yêu cầu người dùng / Cập nhật mục 3.8 và câu hỏi mở, giữ nguyên file gốc; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Sheet đầu tiên rỗng vẫn được mở, hiển thị thông báo để người dùng tự đổi sheet / Theo lựa chọn người dùng / Cập nhật mục 3.8 và câu hỏi mở, không tự bỏ qua sheet rỗng; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Lưu tên cột đã nhập lại khi bấm Lưu tại Tổng kết và khôi phục cùng bản project hiện hành / Theo xác nhận người dùng / Bổ sung mục 3.19, giữ quy tắc reset tên từ file gốc; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Reset Dataset khôi phục tên cột từ file gốc của sheet đang làm việc / Theo lựa chọn người dùng / Bổ sung mục 3.12, áp dụng lại kiểm tra tên cột sau reset; bản lưu hiện hành vẫn giữ đến lần Lưu thành công, chưa sửa backend.
- **Tinh chỉnh v1 / 2026-11-04:** Tên cột chỉ chứa khoảng trắng chỉ được phát hiện và hiển thị cảnh báo, không bắt buộc sửa để phân tích / Theo yêu cầu người dùng / Phân biệt với tên rỗng và giữ kiểm tra trùng tên; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Phân biệt hoa/thường và khoảng trắng khi so sánh tên cột; `Tuổi`, `tuổi`, ` Tuổi ` không được xem là cùng tên / Theo trả lời người dùng / Cập nhật quy tắc tên cột và câu hỏi mở, chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Báo lỗi tên cột trống/trùng; cho nhập tên trên hệ thống hoặc sửa file rồi tải lại; chỉ phân tích khi mọi tên cột có giá trị và không trùng / Theo lựa chọn và xác nhận người dùng / Bổ sung xử lý tên cột tại 3.2, giữ nguyên file gốc; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Tiêu đề bộ dữ liệu lấy từ tên file, dòng đầu tiên của sheet/CSV dùng làm tên cột / Theo mô tả và xác nhận người dùng / Bổ sung quy tắc đọc đầu vào tại 3.2, cập nhật câu hỏi mở; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Chỉ hỗ trợ `.xlsx` và `.csv`, không đưa `.xls` vào đợt hiện tại / Theo lựa chọn người dùng / Chốt định dạng đầu vào tại mục 3.2 và cập nhật câu hỏi mở; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt tổng hợp thời gian theo kỳ, chọn cột tại Data Views, khoảng trống quan sát được và IQR trên chênh lệch kỳ liền trước / Người dùng đồng ý đề xuất / Hoàn thiện phạm vi 3.15, đồng bộ biểu đồ/câu hỏi mở; chưa phân rã mùa vụ, dự báo hoặc sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt đánh giá phân bố lớp, IR và cảnh báo IR ≥ 3 là ngưỡng dự án; xử lý nhãn thiếu/liên tục/một lớp và biểu đồ Top N / Người dùng đồng ý đề xuất / Bổ sung 3.24, cập nhật ANALYSIS-07; không tự cân bằng dữ liệu, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt Pearson/Spearman, Cramér’s V, η², dòng hợp lệ theo cặp và tập dòng chung cho VIF, cảnh báo VIF > 5 / Người dùng đồng ý đề xuất / Bổ sung 3.23, cập nhật ANALYSIS-04/05 và tham chiếu DQ-03; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Giữ phạm vi hiện tại với DQ-05, tiếp tục hoãn cấu hình quy tắc; chưa có quy tắc thì báo Chưa đánh giá / Người dùng chọn giữ phạm vi / Làm rõ giới hạn nghiệm thu, không cam kết đầy đủ phát hiện mâu thuẫn nghiệp vụ; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt DQ-04, IQR mặc định và Modified Z-score/cả hai, giới hạn áp dụng và cấu hình tại Data Views / Người dùng đồng ý đề xuất / Bổ sung 3.5.4, cập nhật ANALYSIS-06; đa biến và điều kiện chi tiết còn mở, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt DQ-03, phân biệt kiểu/vai trò, dữ liệu không hợp lệ/mơ hồ; cấu hình số/ngày tại Data Views và tiếp tục tính trên phần hợp lệ có công bố phạm vi / Người dùng đồng ý đề xuất / Bổ sung mục 3.5.3 và cập nhật 3.22, ảnh hưởng lưu/khôi phục, chạy lại, Tổng kết/PDF; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt tiêu chí ban đầu dữ liệu thiếu và trùng lặp, thống kê/bằng chứng, xử lý không có dòng và giới hạn diễn giải / Người dùng đồng ý đề xuất / Bổ sung mục 3.5.1–3.5.2; còn bàn khóa nghiệp vụ, gần giống, ký hiệu thiếu tùy chỉnh và ngưỡng ảnh hưởng, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt ba mức ảnh hưởng và trạng thái Chưa đủ cơ sở do backend xác định, tách trạng thái xác minh; kiểm chứng từng phát hiện AI và xử lý phản hồi không hợp lệ một phần/toàn bộ / Người dùng đồng ý phương án / Cập nhật hành vi Detection và Tổng kết; ngưỡng chi tiết, schema và implementation chưa thực hiện.
- **Xác nhận v1 / 2026-11-03:** Mỗi phát hiện AI gồm vấn đề, cột liên quan, bằng chứng thống kê, mức độ ảnh hưởng, giải thích và đề xuất xử lý; phân biệt nghi vấn với vấn đề hệ thống đã xác nhận / Người dùng xác nhận cấu trúc đề xuất / Chốt nội dung chức năng, chưa chốt schema kỹ thuật hoặc sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chỉ gửi kết quả thống kê sang API AI / Theo lựa chọn người dùng / Không gửi file gốc, mẫu dòng hay giá trị ô; thu hẹp bằng chứng và nhận xét AI tương ứng, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Dùng API mô hình ngoài để đọc kết quả hệ thống, hỗ trợ Detection/nhận xét/đề xuất, kiểm tra phản hồi và tích hợp qua port/adapter / Người dùng đồng ý hướng triển khai / Không cần mô hình riêng; nhà cung cấp, dữ liệu gửi và hợp đồng chi tiết chưa chốt, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Tổng kết chỉ thể hiện những thay đổi cuối cùng còn hiệu lực trước phân tích / Theo lựa chọn người dùng / Chốt cách trình bày mục thao tác và nội dung tương ứng trong PDF, không liệt kê thay đổi đã trở về ban đầu; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Hệ thống tự nhận diện loại cột, cho tinh chỉnh tại Data Views; Tổng kết thể hiện các thao tác với dữ liệu trước phân tích / Theo yêu cầu người dùng / Bổ sung mục 3.22, liên kết cấu hình phân tích, lưu và báo cáo; cách trình bày lịch sử còn cần chốt, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Hỗ trợ đánh giá mối liên hệ giữa một cột số và một cột phân loại / Người dùng đồng ý / Hoàn thiện phạm vi ba loại cặp tại ANALYSIS-04; phương pháp và ngưỡng chưa chốt, giữ phạm vi VIF và không thêm biểu đồ giữa các cột.
- **Mở rộng v1 / 2026-11-03:** Hỗ trợ cả cột số và cột phân loại trong đánh giá mối liên hệ / Người dùng yêu cầu bao quát khả năng của dữ liệu / Cập nhật ANALYSIS-04, phương pháp từng loại và cặp hỗn hợp còn cần chốt; giữ phạm vi VIF và quyết định không có biểu đồ giữa các cột.
- **Xác nhận v1 / 2026-11-03:** VIF tính trên các cột số được chọn phân tích và loại cột nhãn / Người dùng đồng ý đề xuất / Chốt phạm vi VIF; câu hỏi bảng tương quan chỉ cột số hay thêm cột phân loại chưa có lựa chọn cụ thể, chưa sửa backend.
- **Điều chỉnh v1 / 2026-11-03:** Bỏ biểu đồ giữa các cột theo yêu cầu mới / Người dùng điều chỉnh phạm vi / Thay yêu cầu biểu đồ quan hệ tại ANALYSIS-04, giữ bảng tương quan, VIF và biểu đồ thống kê mô tả; chưa sửa backend.
- **Bổ sung v1 / 2026-11-03:** Thêm biểu đồ quan hệ giữa các cột và chỉ số VIF cho đa cộng tuyến / Theo yêu cầu người dùng / Cụ thể hóa ANALYSIS-04 và ANALYSIS-05; loại cột, biểu đồ cụ thể và ngưỡng đánh giá còn cần chốt, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Top N mặc định 5, cho nhập tùy ý với giới hạn tối đa 20 / Theo lựa chọn người dùng / Chốt cấu hình N là số lượng nguyên dương từ 1 đến 20, giữ giới hạn quyền Viewer và cách gộp “Khác”; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Viewer chỉ xem biểu đồ theo cấu hình đã lưu, không thay đổi N / Theo lựa chọn người dùng / Chốt quyền xem biểu đồ và lưu cấu hình Top N cùng project; đồng bộ phần 6, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Biểu đồ hiển thị Top N giá trị phổ biến, gộp phần còn lại thành “Khác”, cho phép chọn N / Người dùng đồng ý / Chốt cách giảm số nhóm hiển thị; N mặc định, giới hạn, đồng hạng và quyền Viewer còn cần làm rõ; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Đồng ý biểu đồ tỷ lệ thiếu, histogram, box plot, thanh tần suất/tỷ lệ và đường/cột theo thời gian cho thống kê mô tả / Theo xác nhận người dùng / Chốt loại biểu đồ, giữ bảng số liệu; số nhóm và quy tắc tính chi tiết còn cần thống nhất, chưa sửa backend.
- **Bổ sung v1 / 2026-11-03:** Thống kê mô tả có biểu đồ minh họa đi kèm các chỉ số và bảng số liệu / Theo yêu cầu người dùng để dễ nhìn / Cụ thể hóa nhóm biểu đồ, ghi lại các chỉ số đang đề xuất; chưa chốt loại biểu đồ hoặc triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Cho phép xuất PDF khi đang làm việc mà không cần lưu project; Viewer được tải báo cáo / Theo trả lời người dùng / Tách xuất báo cáo khỏi Lưu, bổ sung quyền tải PDF nhưng không mở quyền phân tích hoặc lưu cho Viewer; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Bổ sung xuất Tổng kết thành báo cáo PDF tải xuống / Theo yêu cầu người dùng / Chốt định dạng báo cáo, còn nguồn bản xuất và quyền xuất/tải; chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Tổng kết gồm tổng quan dữ liệu, vấn đề và mức độ ảnh hưởng, bằng chứng, đề xuất xử lý theo thứ tự ưu tiên / Người dùng đồng ý / Chốt nhóm nội dung Tổng kết; tiêu chí đánh giá và xếp ưu tiên còn cần thống nhất, giữ quy tắc khi AI lỗi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Cho chuyển sheet và hủy lần phân tích đang chạy của sheet vừa rời / Theo lựa chọn người dùng / Chốt vòng đời phân tích khi chuyển sheet, không áp dụng kết quả đến muộn của lần đã hủy và giữ bản đã lưu; chưa chọn cơ chế kỹ thuật hoặc sửa backend.
- **Xác nhận v1 / 2026-11-03:** Phân tích hệ thống lỗi thì không tạo Tổng kết mới, yêu cầu chạy lại phân tích / Người dùng đồng ý / Chốt điều kiện thành công của phần hệ thống trước Tổng kết, giữ quy tắc riêng khi AI lỗi và bản đã lưu; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Bổ sung Thử lại AI sau sự cố, dùng lại kết quả phân tích hệ thống khi đầu vào không đổi / Người dùng đồng ý / Cho phép bổ sung giải thích và đề xuất AI mà không chạy lại phần hệ thống; giữ quy tắc quyền thao tác và bấm Lưu, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** AI gặp sự cố thì Tổng kết hiển thị kết quả phân tích của hệ thống, không có giải thích và đề xuất của AI / Theo yêu cầu người dùng / AI lỗi không chặn Tổng kết khi kết quả hệ thống hợp lệ; lỗi phân tích hệ thống và thử lại AI còn cần làm rõ, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Phải chạy lại phân tích sau khi thay đổi dữ liệu/cột phân tích/nhãn trước khi tạo Tổng kết mới / Người dùng đồng ý / Chốt xử lý kết quả lỗi thời tại mục 3.9 và 3.18, không thay đổi bản đã lưu hoặc quyền Viewer; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Mở Tổng kết khi chưa phân tích thì yêu cầu người dùng chạy Data Analysis & Detection trước, không tự chạy thay / Theo lựa chọn người dùng / Chốt điều kiện cho luồng chưa phân tích, bỏ câu hỏi tương ứng; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Sheet không thuộc bản lưu hiện hành bắt đầu từ dữ liệu gốc và trạng thái mặc định; lưu B sau A thì quay lại A không khôi phục bản A cũ / Theo xác nhận người dùng / Chốt hành vi chuyển sheet ngoài bản lưu cuối, bỏ câu hỏi tương ứng; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Reset Dataset chỉ reset trạng thái đang làm việc của sheet hiện tại, giữ nguyên bản đã lưu đến lần Lưu thành công tiếp theo / Theo xác nhận người dùng / Chốt quan hệ giữa reset và lưu, đồng bộ mục 3.12 và 3.19; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Lưu cả bộ lọc, sắp xếp, tìm kiếm và trang đang xem cùng năm nhóm nội dung đã chốt / Người dùng yêu cầu lưu lại toàn bộ / Khôi phục đầy đủ các trạng thái đã thống nhất theo bản lưu cuối khi mở lại project; không thay đổi cơ chế bấm Lưu hoặc quyền Viewer.
- **Xác nhận v1 / 2026-11-03:** Bản lưu gồm sheet, dữ liệu làm việc và số dòng gốc đã xóa, cột phân tích/nhãn, kết quả phân tích và Tổng kết / Người dùng đồng ý năm nội dung đề xuất / Chốt nội dung nghiệp vụ của bản lưu; lựa chọn lưu trạng thái hiển thị chưa được trả lời, chưa chọn schema hoặc sửa backend.
- **Làm rõ v1 / 2026-11-03:** Viewer vẫn xem được kết quả đã lưu ở Data Analysis & Detection và Tổng kết, chỉ bị giới hạn thao tác bên trong / Theo đính chính người dùng / Đồng bộ phần 6 và giới hạn trigger chạy tại mục 3.18 theo quyền; chưa sửa backend.
- **Tinh chỉnh v1 / 2026-11-03:** Ghi nhận Viewer xem Data Views và lọc, không thao tác/tạo phân tích hoặc Tổng kết / Theo làm rõ của người dùng / Đồng bộ phần 6, còn xác nhận quyền xem kết quả đã lưu; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Từ chối lưu từ bản cũ khi đã có bản lưu mới, thông báo và yêu cầu tải lại / Người dùng đồng ý đề xuất tránh ghi đè thay đổi của người khác / Chốt nghiệp vụ xung đột lưu; chưa chọn cơ chế kỹ thuật hoặc sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt quyền thao tác và lưu của Project Member, quyền chỉ xem của Viewer, toàn quyền của Workspace Owner / Theo xác nhận người dùng / Đồng bộ yêu cầu tính năng với phần 6; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Project khôi phục bản lưu cuối cùng và sheet tương ứng; lưu B thay bản hiện hành A, không lưu B thì quay lại bản A đã lưu / Theo trả lời người dùng / Không giữ bản khôi phục riêng từng sheet; quyền lưu và xung đột nhiều người còn cần chốt. Mô hình quyền mới được ghi tại phần 6.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 2 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **Bổ sung v1 / 2026-11-02:** Ghi nhận người dùng làm công việc xử lý/phân tích dữ liệu, ví dụ Data Analyst, với nhu cầu phân tích và phát hiện vấn đề dữ liệu / Theo mô tả của người dùng / Chưa suy ra vai trò phân quyền hoặc danh sách tính năng chi tiết.
- **Bổ sung v1 / 2026-11-02:** Xác nhận đầu vào là file tải lên; đầu ra là phát hiện, mô tả, bằng chứng và đề xuất xử lý / Theo trả lời của người dùng / Cần rà soát tính năng sửa/làm sạch và các chức năng phụ thuộc trước khi chốt API/schema; chưa sửa implementation.
- **Bổ sung v1 / 2026-11-02:** Ưu tiên Excel/CSV, phát hiện vấn đề cơ bản và dùng AI hỗ trợ phát hiện thêm / Theo yêu cầu người dùng / Chưa chốt nhóm lỗi, chi tiết định dạng hoặc giải pháp AI; bổ sung các ví dụ chờ thảo luận.
- **Xác nhận v1 / 2026-11-02:** Người dùng đồng ý 5 nhóm kiểm tra cơ bản DQ-01 đến DQ-05 / Theo phản hồi “Đồng ý” / Chưa chốt tiêu chí chi tiết; khả năng nhập mô tả dữ liệu và quy tắc nghiệp vụ được giữ là câu hỏi chờ xác nhận riêng.
- **Xác nhận v1 / 2026-11-02:** Hoãn tính năng nhập mô tả dữ liệu, ý nghĩa cột và quy tắc nghiệp vụ sang tương lai / Người dùng xác nhận sẽ làm nhưng hiện tại chưa cần / Không đưa vào phạm vi triển khai và nghiệm thu hiện tại; cần làm rõ nguồn tiêu chí cho các kiểm tra phụ thuộc nghiệp vụ.
- **Bổ sung v1 / 2026-11-02:** Mặc định chọn sheet đầu tiên sau khi nhập Excel và cho phép người dùng đổi sheet làm việc / Theo mô tả người dùng / Chưa quyết định hành vi chạy phân tích, lưu kết quả hoặc ngoại lệ sheet.
- **Bổ sung v1 / 2026-11-02:** Xác nhận ba phần Data Views, Data Analysis & Detection, Tổng kết; khi quay lại sheet chỉ giữ Data Views, hai phần sau chạy lại khi người dùng bấm vào / Theo mô tả người dùng / Chưa chốt trạng thái view cần giữ, phạm vi dữ liệu lọc, trigger trong cùng sheet hoặc chính sách lưu lịch sử; không suy ra ranh giới module kỹ thuật.
- **Tinh chỉnh v1 / 2026-11-03:** Data Views làm mới như vừa vào trang khi quay lại sheet; phần tích chọn cột mặc định chọn toàn bộ và chỉ được thay đổi tại Data Views / Theo trả lời người dùng / Thay mô tả giữ trạng thái view; chờ làm rõ ý nghĩa cột được tích và phạm vi dòng phân tích.
- **Bổ sung v1 / 2026-11-03:** Chốt tích chọn cột cần phân tích, mặc định toàn bộ; phân tích toàn bộ dòng của sheet không phụ thuộc bộ lọc. Ghi nhận yêu cầu xóa dòng cơ bản / Theo xác nhận và yêu cầu mới của người dùng / Mở rộng phạm vi thao tác dữ liệu, cần làm rõ xóa dòng trước khi chốt use case/API/schema và cơ chế vô hiệu hóa kết quả cũ.
- **Bổ sung v1 / 2026-11-03:** Giữ nguyên file tải lên, xóa theo số dòng file gốc, nêu rõ dòng đã xóa/cột phân tích; không cần hoàn tác từng thao tác, bổ sung Reset Dataset về trạng thái ban đầu / Theo xác nhận người dùng / Còn chờ phạm vi reset giữa các sheet và chi tiết vòng đời trạng thái/kết quả.
- **Xác nhận v1 / 2026-11-03:** Reset Dataset chỉ reset sheet đang làm việc / Theo trả lời người dùng / Không reset cả file, không chuyển về sheet đầu tiên và không tác động các sheet khác.
- **Xác nhận v1 / 2026-11-03:** Khi quay lại sheet, dữ liệu và trạng thái trở về ban đầu như vừa reset, bao gồm khôi phục dòng đã xóa / Theo điều chỉnh của người dùng / Không giữ thay đổi xóa dòng qua lần quay lại sheet; loại bỏ câu hỏi tương ứng khỏi danh sách còn mở.
- **Xác nhận v1 / 2026-11-03:** Hỗ trợ cả xóa một dòng, nhiều dòng được chọn và một khoảng dòng / Theo lựa chọn “cả 3” của người dùng / Cả ba sử dụng số dòng file gốc, giữ nguyên các quy tắc bảo toàn file và reset đã chốt.
- **Xác nhận v1 / 2026-11-03:** Đồng ý lọc văn bản, số/ngày, ô trống và kết hợp điều kiện nhiều cột / Theo phản hồi người dùng / Chỉ tác động hiển thị, chưa chốt AND/OR hoặc quy tắc so khớp chi tiết.
- **Xác nhận v1 / 2026-11-03:** Bộ lọc nhiều cột hỗ trợ cả AND và OR / Theo lựa chọn người dùng / Chưa mặc định hỗ trợ nhóm điều kiện lồng nhau; bộ lọc vẫn chỉ tác động hiển thị.
- **Xác nhận v1 / 2026-11-03:** Bổ sung sắp xếp tăng/giảm theo cột và tìm kiếm giá trị trong bảng / Người dùng đồng ý cả hai / Thuộc Data Views; chi tiết sắp xếp và tìm kiếm chờ làm rõ.
- **Bổ sung v1 / 2026-11-03:** Thêm phân tích theo thời gian khi dữ liệu có thông tin thời gian phù hợp / Theo yêu cầu người dùng / Chưa chốt cách chọn cột, chỉ số, mức tổng hợp hoặc khả năng phát hiện bất thường theo thời gian.
- **Bổ sung v1 / 2026-11-03:** Đồng ý bốn nội dung phân tích thời gian; bổ sung biểu đồ, bảng tương quan, đa cộng tuyến, đánh giá outliers và mất cân bằng có điều kiện / Theo yêu cầu người dùng / Chưa chốt phương pháp/ngưỡng; cần làm rõ “dữ liệu có dãn” và cách xác định nhãn, không mở rộng phạm vi sang frontend.
- **Tinh chỉnh v1 / 2026-11-03:** Chọn nhãn tùy chọn, mặc định không có nhãn; người dùng chủ động mở tính năng và chọn một cột từ gợi ý của hệ thống / Theo mô tả người dùng / Làm rõ luồng chọn nhãn phục vụ đánh giá mất cân bằng; còn xác nhận hành vi khi không có cột phù hợp, chưa chọn thuật toán gợi ý.
- **Xác nhận v1 / 2026-11-03:** Không thể chọn nhãn khi không có cột phù hợp; vẫn sử dụng các phân tích không cần nhãn / Theo xác nhận người dùng / Chốt hành vi khi danh sách gợi ý rỗng, loại bỏ câu hỏi tương ứng; đánh giá mất cân bằng theo nhãn cần có nhãn được chọn.
- **Xác nhận v1 / 2026-11-03:** Cho phép đổi cột nhãn hoặc bỏ chọn nhãn / Theo xác nhận người dùng / Hoàn thiện thao tác lựa chọn nhãn; cách xử lý kết quả đã có khi thay đổi nhãn vẫn cần thống nhất.
- **Tinh chỉnh v1 / 2026-11-03:** Chọn nhãn tại Data Views và chỉ rõ cột nhãn trong bảng; Data Views chốt cấu trúc dữ liệu, phân tích dùng lại kết quả khi đầu vào không đổi và chạy lại khi mở sau thay đổi / Theo yêu cầu người dùng / Làm rõ vòng đời kết quả trong cùng sheet; còn xác nhận thao tác chỉ đổi hiển thị và quy tắc Tổng kết, chưa thay đổi API hoặc implementation.

