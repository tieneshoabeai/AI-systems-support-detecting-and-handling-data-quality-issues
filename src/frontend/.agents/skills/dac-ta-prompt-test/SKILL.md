---
name: dac-ta-prompt-test
description: Biến một yêu cầu/chức năng lập trình thành bộ ba "đặc tả → test case → prompt" chặt chẽ trước khi nhờ AI sinh mã (kèm pseudocode và nhật ký AI prompting log). Dùng skill này mỗi khi người dùng đưa một chức năng, hàm, module, bài tập code cần làm, hoặc nói "viết prompt", "đặc tả", "spec", "test case", "trường hợp biên", "pseudocode", "nhờ AI viết hàm", "prompting log", "pipeline làm việc với AI" — kể cả khi họ chưa nói rõ muốn đặc tả. Dùng ngay cả khi người dùng chỉ mô tả sơ yêu cầu bằng một hai câu, vì mục tiêu là làm rõ trước khi sinh mã.
---

# Đặc tả → Prompt + Test case

## Vì sao có skill này
AI hiểu yêu cầu mơ hồ theo nhiều cách, nên cùng một prompt lỏng lẻo có thể ra các kết quả khác nhau. Đặc tả chi tiết và test viết **trước khi sinh mã** biến "cảm giác đúng" thành thứ kiểm chứng được. Người lập trình giữ vai người đặc tả, người kiểm chứng và người quyết định; AI chỉ đề xuất mã.

## Pipeline (giữ đúng thứ tự)
1. **Yêu cầu**: giải quyết vấn đề gì, cho ai (business understanding).
2. **Đặc tả**: đầu vào, điều kiện, xử lý, đầu ra, xếp loại, thứ tự.
3. **Test case**: viết trước khi có mã.
4. **Pseudocode** (nên có với logic từ 3 nhánh/vòng lặp trở lên).
5. **Prompt**: ngữ cảnh, ràng buộc, ví dụ.
6. **AI đề xuất mã** (có thể xin 1–2 phương án).
7. **Kiểm chứng**: đọc mã, dò vết, chạy test. Chưa đạt thì quay lại bước 6 với test thất bại làm bằng chứng.
8. **Quyết định**: chấp nhận / sửa / từ chối, có lý do.

Skill này phụ trách bước 1–5 và ghi log (bước 6–8 người dùng thực hiện; hỗ trợ khi được nhờ). Nếu người dùng muốn hiểu mã AI vừa sinh, chuyển sang skill `doc-ma-giai-thich`.

## Cách làm việc

### 0. Làm rõ cùng giả định và phương án
Phân tích thông tin đã có và chỉ rõ phần còn thiếu. Khi thông tin thiếu ảnh hưởng đến đầu vào, đầu ra, quy tắc xử lý hoặc kết quả mong đợi, hỏi người dùng trước khi hoàn thiện đặc tả. Kết hợp câu hỏi với giả định hoặc phương án đề xuất để người dùng dễ chọn; đánh dấu `[GIẢ ĐỊNH — CHỜ XÁC NHẬN]`, giải thích ảnh hưởng và trade-off. Không chỉ đưa giả định thay cho câu hỏi và không dùng giả định chưa được xác nhận làm yêu cầu chính thức, kết quả test mong đợi hoặc cơ sở implementation. Gom các câu hỏi liên quan, ưu tiên tối đa 3 câu mỗi lượt.

### 1. Yêu cầu
Viết 2–3 câu: vấn đề, người dùng của chức năng, thành công trông như thế nào.

### 2. Đặc tả
Điền đủ 6 mục; mục nào không áp dụng thì ghi "không áp dụng" chứ không bỏ trống:
- **Đầu vào**: tên, kiểu, miền giá trị.
- **Điều kiện**: khi nào hợp lệ, khi nào không.
- **Xử lý**: quy tắc theo từng bước, đánh số.
- **Đầu ra**: kiểu, định dạng, giá trị trả về khi lỗi.
- **Xếp loại**: bảng khoảng giá trị → nhãn, nêu rõ ranh giới thuộc nhóm nào (≥ hay >).
- **Thứ tự**: thứ tự ưu tiên khi nhiều điều kiện cùng đúng; thứ tự sắp xếp kết quả.

Càng chi tiết càng tốt. Quy tắc phải xác định trước khi sinh mã, vì chỗ nào bỏ ngỏ AI sẽ tự chọn.

### 3. Test case
Viết thành bảng `Mã | Nhóm | Đầu vào | Kết quả mong đợi | Lý do`. Phủ đủ 4 nhóm:
1. **Thường**: 2–3 ca đại diện.
2. **Biên**: sát ngưỡng, bằng ngưỡng, ngay dưới/trên ngưỡng, min/max.
3. **Không hợp lệ**: vượt ngưỡng, sai kiểu (chuỗi thay số), `null`/`undefined`, NaN, thiếu trường.
4. **Đặc biệt**: danh sách rỗng, một phần tử, trùng lặp, sai số thực (ví dụ 0.1 + 0.2), số âm, chuỗi rỗng.

Kết quả mong đợi phải do **đặc tả** quyết định, không đoán từ việc mã chạy ra gì. Chọn nhóm nào liên quan bài toán và nói rõ nhóm nào bỏ qua kèm lý do. Nếu người dùng đã có test, rà soát xem thiếu nhóm nào rồi bổ sung.

### 4. Pseudocode
Là "hợp đồng giữa người và máy": mô tả thuật toán độc lập cú pháp, tập trung logic. Dùng bước đánh số, `NẾU / NGƯỢC LẠI / LẶP`. Sau khi viết, tự phản biện: thử chạy tay 2 test case (một thường, một biên) qua pseudocode; nếu lệch thì sửa pseudocode trước khi làm tiếp. Pseudocode sẽ được đưa vào prompt để buộc AI đi đúng thuật toán, và dùng làm chuẩn đối chiếu khi review mã.

### 5. Prompt
Dùng khung trong `references/prompt-template.md` (CONTEXT, TASK, INPUT, CONSTRAINTS, EXAMPLES, OUTPUT, CRITERIA). Lưu ý:
- CONTEXT nêu ngôn ngữ **và phiên bản**, môi trường chạy, quy ước (ví dụ khai báo hàm thường, không thư viện ngoài).
- EXAMPLES có ít nhất một ví dụ end-to-end (đầu vào → các bước → đầu ra) và một ví dụ lỗi.
- OUTPUT yêu cầu AI trả: mã nguồn, **danh sách giả định đã dùng**, và comment trong mã tại chỗ bổ sung hoặc quyết định riêng.
- CRITERIA: "đúng" nghĩa là qua toàn bộ bảng test; liệt kê tiêu chí phụ (không mã thừa, xử lý đầu vào sai).
- Không yêu cầu thêm mã ngoài phạm vi đặc tả. Nếu thấy mã hoặc hàm có dấu hiệu không được sử dụng, chỉ rõ bằng chứng và ảnh hưởng đến khả năng đọc hoặc bảo trì. Kiểm tra nơi gọi, export và cơ chế sử dụng gián tiếp trước khi kết luận; không tự xóa. Mỗi lần làm việc lại với file có mã/hàm đã được ghi nhận nghi không dùng, kiểm tra bằng chứng hiện tại và nhắc lại tình trạng: còn chờ xử lý hay đã giải quyết, tránh bỏ quên. Không tự tạo file theo dõi riêng khi chưa được duyệt.

### 6. Dữ liệu an toàn
Trước khi giao prompt, quét lại: không có khóa API, mật khẩu, dữ liệu cá nhân, tài liệu có bản quyền. Nếu có, thay bằng giá trị giả và báo người dùng.

### 7. Nhật ký AI (prompting log)
Mỗi module có một mục log chạy đủ pipeline từ A đến Z. Dùng mẫu trong `references/log-template.md`. Điền sẵn phần 1–5 (yêu cầu, đặc tả, test, prompt); để trống phần kết quả AI, kiểm chứng, quyết định cho người dùng điền sau, hoặc điền giúp khi họ dán kết quả lên.

## Định dạng đầu ra
Trình bày bản nháp trong chat để người dùng review, với các phần: Yêu cầu, Đặc tả, Test case, Pseudocode, Prompt (đặt trong khối code để dễ sao chép), Log. Nêu rõ các `[GIẢ ĐỊNH — CHỜ XÁC NHẬN]`. Chỉ tạo tệp `.md` sau khi nội dung và vị trí được người dùng xác nhận. Với tài liệu phụ trợ nội bộ do AI tạo trong project, dùng `.agents/<task>/`; với tài liệu chính thức của người dùng, hỏi vị trí hoặc dùng đúng vị trí đã được chỉ định. Nếu chức năng rất nhỏ, trình bày gọn trong chat.

Viết bằng ngôn ngữ người dùng đang dùng; mặc định tiếng Việt, giữ nguyên thuật ngữ kỹ thuật phổ biến (prompt, test case, unit test).

## Khi người dùng yêu cầu AI sinh mã luôn
Hoàn thành bước 1–5 ở dạng phù hợp với phạm vi yêu cầu. Trước khi sinh hoặc sửa mã, kiểm tra đặc tả và phạm vi implementation đã được người dùng xác nhận chưa. Nếu chưa, trình bày ngắn vấn đề, đầu ra mong đợi, ràng buộc, giải pháp, rủi ro và plan để người dùng xác nhận. Sau xác nhận, chỉ triển khai phạm vi đã duyệt; không yêu cầu xác nhận lại phần đã được duyệt nếu không có thay đổi. Nếu còn thiếu thông tin quyết định kết quả, tiếp tục làm rõ cùng giả định/phương án chờ xác nhận; không sinh mã dựa trên logic chưa được duyệt.
