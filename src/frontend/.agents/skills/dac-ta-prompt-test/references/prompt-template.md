# Khung prompt (lưu thành tệp .md)

```markdown
# PROMPT: <tên chức năng>

## 1. CONTEXT (Ngữ cảnh)
- Ngôn ngữ/phiên bản: <ví dụ JavaScript ES2022>
- Môi trường chạy: <Node.js 20 / trình duyệt>
- Quy ước: <khai báo hàm thường, không dùng thư viện ngoài, không đọc/ghi file>

## 2. TASK (Nhiệm vụ)
Viết hàm `<tên>(<tham số>)` để <mục đích>. Chỉ viết các hàm sau: <danh sách>.

## 3. INPUT (Đầu vào)
| Tên | Kiểu | Miền hợp lệ |
|-----|------|-------------|

## 4. CONSTRAINTS (Ràng buộc)
1. <quy tắc xử lý, đánh số>
2. Xác định hợp lệ: <điều kiện>
3. Đầu vào không hợp lệ: <ném lỗi / trả về giá trị gì>
4. Ranh giới: <≥ hay >>
5. Không có tác dụng phụ (không sửa đầu vào, không in ra) trừ khi nêu rõ.

## 5. PSEUDOCODE (nếu có)
<các bước đánh số; AI phải làm đúng theo>

## 6. EXAMPLES (Ví dụ end-to-end)
- Vào: ... → Ra: ...
- Ví dụ lỗi: ... → ...

## 7. OUTPUT (Định dạng trả lời)
1. Mã nguồn trong một khối code.
2. Danh sách giả định đã dùng.
3. Comment trong mã ở chỗ bổ sung hoặc quyết định ngoài đặc tả.
4. Không thêm mã thừa, không thêm tính năng ngoài đặc tả.

## 8. CRITERIA (Tiêu chí đúng)
- Qua toàn bộ bảng test dưới đây.
- <tiêu chí phụ>

### Bảng test
<dán bảng test case>
```
