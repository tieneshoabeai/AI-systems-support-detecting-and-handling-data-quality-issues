# Quy chuẩn nhận diện frontend

Ngày xác nhận: 28/10/2026. Cập nhật batch UI auth: đã áp dụng màu/font/logo vào login/dialog/shell. Token nằm tại `src/app/design-tokens.css`; brand board vẫn chỉ là tham khảo, không phải asset runtime.

## 1. Nguồn chuẩn và phạm vi

- Quy chuẩn bằng văn bản trong file này là nguồn tham chiếu khi lập plan UI. Ảnh chỉ minh họa; không lấy màu bằng cách hút màu từ ảnh.
- [Brand board đã duyệt về hướng màu](references/brand-board-v2.png): xanh tươi thay teal trầm, đỏ thay amber cảnh báo.
- Tên project vẫn là **AI-systems-support-detecting-and-handling-data-quality-issues**. “Chất lượng dữ liệu” trên board là nhãn mô tả, không phải quyết định đổi tên.
- Board được tạo bằng image_gen theo skill brandkit, kế thừa concept đăng nhập từ imagegen-frontend-web và high-end-visual-design. Đây là concept, không phải bằng chứng chức năng đã chạy.
- Nhận diện không thay các contract, policy auth hoặc UX/UI pending trong Screen flow và Shared UI. Mọi batch triển khai vẫn cần plan và xác nhận.

## 2. Màu sắc đã chốt

| Vai trò | Giá trị | Cách dùng |
|---|---|---|
| Nền chính | `#F6F8F7` | Canvas sáng, thoáng |
| Chữ chính | `#202A29` | Heading, nội dung và thông tin cần đọc rõ |
| Nhận diện / điểm nhấn | `#00A878` | Xanh tươi cho logo concept, điểm nhấn và tương tác chính |
| Bề mặt phụ | `#DFE6E3` | Phân tầng nền, khung và vùng phụ; không mặc định dùng làm chữ |
| Cảnh báo / cần kiểm tra | `#DC2626` | Lỗi, bất thường và trạng thái cần chú ý; thay amber trong hướng nhận diện trước |

- Xanh là màu nhận diện và tương tác; không tự có nghĩa dữ liệu đã chính xác hoặc server đã xác nhận thành công.
- Đỏ phải đi cùng nhãn/icon và ngữ cảnh; không chỉ dùng màu để truyền đạt trạng thái. Phân biệt lỗi chặn thao tác và cảnh báo cần kiểm tra bằng nội dung cụ thể.
- Không mặc định trắng trên xanh `#00A878` đạt tương phản cho chữ nhỏ. Màu nút tối hơn `#008563` trong prompt tạo board chỉ là ứng viên kỹ thuật, cần đo tương phản và review ở batch UI.
- Các token success/info/disabled/focus/hover, màu nền nhạt cho trạng thái và dark mode chưa được đặc tả đầy đủ; không coi palette năm màu là design system hoàn chỉnh.

## 3. Hướng hình ảnh và typography

- Tính cách: chính xác, bình tĩnh, dễ hiểu; con người kiểm tra và quyết định xử lý dữ liệu.
- Hình ảnh: ô dữ liệu có cấu trúc, vật liệu kính mờ và bề mặt bạc nhẹ; đỏ chỉ ra phần cần xem xét. Không dùng hình này như kết quả phân tích thật.
- Font: Plus Jakarta Sans variable self-host ở `src/assets/fonts/plus-jakarta-sans/`, kèm OFL.txt; đã khai báo @font-face/font-display swap và xem chữ tiếng Việt trên browser. Không gọi CDN font khi runtime.
- Phân cấp chữ rõ, label dễ đọc, khoảng trắng phục vụ thao tác. Không áp dụng khoảng cách kiểu landing page máy móc cho bảng dữ liệu hoặc form.
- Khung lồng nhẹ, bo góc đồng tâm, bóng mềm. CTA chính có thể dùng dạng pill; icon mũi tên nằm trong vòng tròn riêng như board.
- Giữ focus rõ, bàn phím sử dụng được, trạng thái loading/error đọc được; chuyển động phải hỗ trợ reduced motion. Ảnh tĩnh chưa kiểm chứng các tiêu chí này.

## 4. Logo và giới hạn của ảnh

Logo dạng các thanh dữ liệu là concept. Board còn khác nhau về chiều cao/thành phần giữa các panel; chữ mô tả hình học trong ảnh không phải thông số dựng logo. Chưa có SVG chuẩn, quy chuẩn kích thước nhỏ, vùng an toàn, bản đơn sắc hoặc kiểm tra trùng nhãn hiệu. Không cắt logo raster từ board rồi coi là asset production.

Người dùng cung cấp logo thực `src/assets/8DA AI Network Logo.png`; UI hiện dùng nguyên file này, không cần tạo logo SVG thay thế hoặc đổi màu logo. Chưa cần hình minh họa login. Màu logo xanh–tím được giữ như asset riêng, không mở rộng palette tương tác theo logo.

## 5. Cách áp dụng xuyên suốt

1. Trước batch UI, đọc file này cùng handoff, Screen flow, Shared UI và source liên quan.
2. Lập plan cho màn hình cụ thể; giữ palette đã chốt, nêu rõ token/trạng thái còn thiếu để review.
3. `src/app/design-tokens.css` đã là nơi khai báo biến CSS/font dùng chung. Component dùng token thay vì lặp mã màu.
4. Logo SVG/font/hình ảnh thực sự được ứng dụng sử dụng sẽ đặt ở `src/assets/brand/` khi được duyệt; không để ứng dụng import tài liệu hoặc ảnh board trong `.agents/`.
5. Kiểm tra tương phản: chữ thường ít nhất 4.5:1, chữ lớn 3:1; viền điều khiển/focus thiết yếu cần kiểm tra tương phản 3:1 theo ngữ cảnh. Kiểm tra thêm bàn phím, zoom, màn hẹp, lỗi và loading trong browser.
6. Khi thay quy chuẩn, trình bày ảnh hưởng và xin xác nhận; cập nhật cùng nguồn chuẩn để hai người FE không dùng hai bộ token riêng.

## 6. Vị trí lưu

- `.agents/brand/brand-guidelines.md`: quy chuẩn nội bộ.
- `.agents/brand/references/brand-board-v2.png`: ảnh tham khảo màu mới, không xuất bản cùng app.
- `.agents/handoff/context.md`: liên kết giúp các chat sau tìm quy chuẩn.

Batch nhận diện gốc chỉ lưu tài liệu; batch UI auth sau đó đã áp dụng vào source mà không thêm dependency/đổi lockfile. Các thay đổi có sẵn của người dùng được giữ nguyên.

Cập nhật nghiệm thu batch UI: login/dialog/shell đã dùng tokens và font/logo; chữ trắng trên action #007A57 đạt 5.36:1, muted/canvas 5.67:1, error text/surface 6.79:1, input border/canvas 3.39:1. Brand accent vẫn #00A878. Có focus-visible, input mobile 16px và reduced motion. Đây chưa phải kiểm toán accessibility đầy đủ hoặc kiểm chứng mọi trạng thái/browser; xem log ở auth-session plan mục 14.
