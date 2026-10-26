---
name: doc-ma-giai-thich
description: Đọc mã và giải thích một hàm (func) hoặc một module theo 7 câu hỏi cố định (giá trị ban đầu, dữ liệu vào, giá trị trả về, dòng làm đổi trạng thái, hành vi, thứ tự các bước, kết quả) kèm bảng dò vết và một ví dụ đơn giản đến mức học sinh lớp 2 cũng hiểu. Dùng skill này mỗi khi người dùng dán hoặc tải lên mã và nói "giải thích code", "đọc mã", "hàm này làm gì", "dò vết", "trace", "review mã AI viết", "mã này chạy thế nào", "hiểu từng dòng", hoặc khi cần kiểm tra mã do AI sinh ra trước khi chấp nhận — kể cả khi họ chỉ dán mã mà không nói gì thêm.
---

# Đọc mã và giải thích

## Vì sao có skill này
Chỉ nên chấp nhận mã mà mình hiểu và giải thích được từng dòng. Đọc mã là kỹ năng kiểm chứng chính khi làm việc với AI: người đọc phải hiểu từng bước xử lý, dò vết được giá trị biến, và phát hiện **giả định ẩn** mà tác giả (hoặc AI) không nói ra. Giải thích tốt là giải thích để người chưa biết cũng theo được, nên mỗi lần giải thích đều kèm một ví dụ thật đơn giản.

## Quy trình

### Bước 1: Xác định phạm vi
Xác định đối tượng: một hàm, một module, hay một đoạn. Nếu mã dài, giải thích từng hàm theo thứ tự gọi rồi mới tổng hợp ở mức module. Nếu thiếu mã (người dùng nhắc tới tệp nhưng chưa có nội dung), kiểm tra tệp đã tải lên trước khi nói là không thấy. Nếu ngôn ngữ/môi trường chưa rõ (JS chạy ở Node hay trình duyệt, TS biên dịch sang JS), hỏi làm rõ cùng giả định/phương án có đánh dấu và giải thích ảnh hưởng. Không khẳng định hành vi phụ thuộc môi trường khi chưa có xác nhận hoặc bằng chứng.

### Bước 2: Trả lời 7 câu hỏi
Đây là khung bắt buộc cho mỗi hàm; nó buộc người đọc không bỏ sót phần nào. Với mỗi hàm, điền:

1. **Giá trị ban đầu là gì?** Biến/trạng thái trước khi hàm chạy (giá trị khởi tạo, tham số mặc định, biến ngoài hàm).
2. **Hàm nhận dữ liệu nào?** Tên tham số, kiểu, miền giá trị mong đợi; điều gì xảy ra nếu sai kiểu hoặc thiếu.
3. **Xong thì trả về gì?** Kiểu và ý nghĩa giá trị trả về; các nhánh trả về khác nhau; trường hợp không trả gì (`undefined`).
4. **Trạng thái thay đổi ở dòng nào?** Chỉ ra số dòng cụ thể cập nhật biến hoặc trạng thái và phân biệt **thay đổi nội bộ** (cập nhật biến cục bộ hoặc dữ liệu mới tạo trong hàm) với **tác dụng phụ** (sửa dữ liệu đầu vào dùng chung, trạng thái bên ngoài, DOM, ghi file, gửi request hoặc in ra console). Không gọi mọi phép gán là tác dụng phụ; nói rõ hàm có sửa dữ liệu đầu vào hay không.
5. **Hàm thực thi hành vi gì?** Một câu mô tả mục đích, không lặp lại cú pháp.
6. **Các bước chạy theo thứ tự?** Đánh số theo đúng thứ tự thực thi, không theo thứ tự xuất hiện trong tệp. Với điều kiện và vòng lặp, nói rõ khi nào vào nhánh, khi nào dừng.
7. **Kết quả là gì?** Kết luận cuối: với ví dụ đã chọn, hàm cho ra gì.

### Bước 3: Dò vết bằng ví dụ cụ thể
Chọn một đầu vào **nhỏ, tính tay được** (mảng 3 phần tử, số nhỏ). Lập bảng dò vết: mỗi hàng là một bước/lượt lặp, mỗi cột là giá trị các biến quan trọng. Cách này làm lộ lỗi lệch một đơn vị, điều kiện biên và biến không được cập nhật.

| Bước | Dòng | Điều kiện | Biến 1 | Biến 2 | Ghi chú |
|------|------|-----------|--------|--------|---------|

Nếu có điều kiện hoặc vòng lặp, dò thêm một ca biên (rỗng, bằng ngưỡng) và nêu kết quả.

### Bước 4: Ví dụ lớp 2
Kết thúc bằng một ví dụ đời thường thật đơn giản, dùng đồ vật quen thuộc, câu ngắn, không thuật ngữ, rồi ghép từng phần của ví dụ với 7 câu hỏi. Ví dụ: hàm cộng dồn điểm ≈ "bạn có một hộp kẹo, ban đầu hộp trống (giá trị ban đầu). Mỗi lần bạn đưa thêm một nắm kẹo (dữ liệu nhận vào). Bạn bỏ nắm kẹo vào hộp (dòng đổi trạng thái). Cuối cùng bạn đếm kẹo trong hộp (giá trị trả về)." Không dùng ví dụ này để thay thế phần kỹ thuật; nó đi kèm.

### Bước 5: Phát hiện rủi ro (ngắn)
Liệt kê tối đa 5 điểm đáng chú ý, theo thứ tự quan trọng:
- **Giả định ẩn** (giả sử đầu vào là số, mảng không rỗng, đã sắp xếp...).
- **Trường hợp biên chưa xử lý** (rỗng, `null`/`undefined`, sai kiểu, sai số thực).
- **Tác dụng phụ** bất ngờ (sửa mảng gốc, biến toàn cục).
- **Lỗi logic nghi vấn** (điều kiện sai chiều, `<` thay vì `<=`, vòng lặp không dừng).
- **Mã/hàm nghi không dùng**: Nếu thấy mã hoặc hàm có dấu hiệu không được sử dụng, chỉ rõ bằng chứng và ảnh hưởng đến khả năng đọc hoặc bảo trì. Kiểm tra nơi gọi, export và cơ chế sử dụng gián tiếp trước khi kết luận; không tự xóa. Mỗi lần làm việc lại với file có mã/hàm đã được ghi nhận nghi không dùng, kiểm tra bằng chứng hiện tại và nhắc lại tình trạng: còn chờ xử lý hay đã giải quyết, tránh bỏ quên. Không tự tạo file theo dõi riêng khi chưa được duyệt.
Chỉ nêu điều có căn cứ trong mã; không bịa lỗi. Phân biệt bằng chứng từ đọc source, dò vết bằng tay và thực thi test. Nếu chưa chạy, ghi rõ **chưa thực thi**; kết quả dò tay không phải kết quả chạy test. Chỉ kết luận trong phạm vi đã kiểm tra, không suy ra mã đúng toàn bộ từ một vài ví dụ. Nếu chưa phát hiện vấn đề, nói rõ trong phạm vi kiểm tra nào.

Nếu người dùng có đặc tả hoặc test (từ skill `dac-ta-prompt-test`), đối chiếu mã với chúng và nêu chỗ lệch.

## Định dạng đầu ra
Dùng đúng thứ tự sau cho mỗi hàm (module nhiều hàm thì lặp lại cho từng hàm, rồi thêm một đoạn tổng quan ở đầu):

```
## <tên hàm>
**Tóm tắt một dòng:** ...

### 7 câu hỏi
1. Giá trị ban đầu: ...
2. Dữ liệu nhận vào: ...
3. Trả về: ...
4. Trạng thái đổi ở dòng: ...
5. Hành vi: ...
6. Các bước theo thứ tự: ...
7. Kết quả (với ví dụ): ...

### Dò vết
<bảng>

### Ví dụ lớp 2
...

### Điểm cần lưu ý
...
```

Trả ngay trong chat; không tạo tệp trừ khi người dùng yêu cầu. Giữ lời lẽ ngắn, mỗi mục một đến hai câu. Mã dài hơn khoảng 80 dòng: giải thích theo hàm, và hỏi có muốn đi sâu hàm nào không. Dùng ngôn ngữ người dùng đang viết; mặc định tiếng Việt.

## Lưu ý khi giải thích mã AI sinh
Kết thúc bằng một dòng gợi ý quyết định: **chấp nhận / sửa / từ chối**, với lý do và căn cứ kiểm tra. Khuyến nghị chấp nhận phải nêu điều kiện hoặc phần chưa được kiểm chứng nếu có; không đồng nghĩa đã chạy test hoặc xác nhận toàn bộ hành vi. Không tự quyết thay người dùng; chỉ đưa khuyến nghị.
