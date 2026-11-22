# Login — Texture nền và SEO

Phạm vi là `/auth/login` trên bản production preview. Desktop tiếp tục chờ panel 3D. Màn hình hẹp và trường hợp WebGL lỗi dùng form 2D.

## Chẩn đoán và thay đổi

Probe Playwright bọc các lệnh upload WebGL2 và ghi thời gian đồng bộ cùng loại và kích thước nguồn. Trước khi sửa backdrop, `texSubImage2D` với ảnh SVG 1536 × 1024 mất 429,1 ms trong một lượt chẩn đoán. Artwork canvas trong lượt đó không có lần gọi dài tương tự. Sau chỉnh sửa, probe ghi nhận backdrop được upload từ canvas 768 × 512, dưới độ phân giải 0,1 ms của phép ghi. Con số này chỉ mô tả lời gọi upload, còn chi phí raster và dựng trang nằm trong phép đo Lighthouse riêng. Nền CSS vẫn dùng ảnh gốc.

FE dùng title `Đăng nhập | DataVerse` trên route login, title mặc định `DataVerse` ở các route khác và meta description chung cho app. Vite phục vụ `/robots.txt` với HTTP 200 và `Content-Type: text/plain`. Quy tắc robots hiện cho phép crawl. Eligibility trên production cần được kiểm tra ở host triển khai. Nếu muốn login xuất hiện trong Search hoặc sitelinks, Google hướng dẫn để trang có thể crawl và index. Nếu về sau muốn ẩn login, áp dụng `noindex` riêng cho route và vẫn cho Google crawl để nhận chỉ thị.

[Google Search về sitelinks trang login](https://developers.google.com/search/help/office-hours/2024/august?hl=en) · [Google Search về noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

## Kết quả desktop production, 5 lượt mỗi bản

| Chỉ số | Trước → Sau |
|---|---|
| Lighthouse Performance, trung vị | 78 → 85 |
| SEO, trung vị | 82 → 100 |
| TBT, trung vị (min–max) | 506 ms (397–648) → 336,5 ms (276–422) |
| Thời gian đến ký tự đầu tiên, trung vị | 1.435 ms → 1.046 ms |
| CLS | 0 → 0 |

Cả hai audit SEO pass 5/5. TBT đạt mục tiêu ≤ 350 ms ở 4/5 lượt và theo trung vị. Một lượt ghi 422 ms. Bài gõ sáu ký tự giữ đủ ký tự, với khoảng dài nhất giữa hai sự kiện input từ 73 đến 153 ms theo từng lượt, gồm delay 40 ms do probe đặt. Playwright xác nhận scene desktop sẵn sàng trong cả 5 lượt, form 2D ở viewport hẹp và khi giả lập thiếu WebGL2, cùng chuyển panel Đăng ký trên desktop. Build pass, 10 test FE liên quan pass.

## Báo cáo từng lượt

| Lượt | Lighthouse |
|---|---|
| 01 | [PNG](reports/login-3d/backdrop-seo/run-01.png) · [HTML](reports/login-3d/backdrop-seo/run-01.report.html) · [JSON](reports/login-3d/backdrop-seo/run-01.report.json) |
| 02 | [PNG](reports/login-3d/backdrop-seo/run-02.png) · [HTML](reports/login-3d/backdrop-seo/run-02.report.html) · [JSON](reports/login-3d/backdrop-seo/run-02.report.json) |
| 03 | [PNG](reports/login-3d/backdrop-seo/run-03.png) · [HTML](reports/login-3d/backdrop-seo/run-03.report.html) · [JSON](reports/login-3d/backdrop-seo/run-03.report.json) |
| 04 | [PNG](reports/login-3d/backdrop-seo/run-04.png) · [HTML](reports/login-3d/backdrop-seo/run-04.report.html) · [JSON](reports/login-3d/backdrop-seo/run-04.report.json) |
| 05 | [PNG](reports/login-3d/backdrop-seo/run-05.png) · [HTML](reports/login-3d/backdrop-seo/run-05.report.html) · [JSON](reports/login-3d/backdrop-seo/run-05.report.json) |

[Số đo nhập liệu](reports/login-3d/backdrop-seo/input-timing.json) · [Chrome trace](reports/login-3d/backdrop-seo/chrome-performance.trace.json) · [Bản desktop chờ 3D trước chỉnh backdrop](LOGIN_3D_COMPARISON.md)
