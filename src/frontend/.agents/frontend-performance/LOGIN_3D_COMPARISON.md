# Login 3D — So sánh trước và sau

Đo ngày 22/11/2026 (UTC+7) trên `https://127.0.0.1:4181/auth/login`. Mỗi bản có năm lượt Lighthouse CLI 13.6.0, desktop 1350 × 940, DPR 1, Chrome headless, production build và phiên Chrome mới mỗi lượt. Bật Performance, Accessibility, Best Practices và SEO. Bài nhập liệu dùng Playwright, năm browser context mới mỗi bản và một lượt trace riêng. [Lệnh chạy lại](TOOLING_SETUP.md)

## Bằng chứng và thay đổi

Trace trước sửa có tác vụ 518 ms chứa callback React Three Fiber 510 ms, cùng hai callback 232 ms và 122 ms trước sự kiện input đầu tiên. Source cũ ẩn form trong khi chờ scene. Bản sửa hiện form HTML ngay và chỉ yêu cầu scene lazy khi trình duyệt đã có cơ hội vẽ form. Deadline 10 giây bắt đầu khi yêu cầu scene; form tiếp tục hoạt động nếu WebGL lỗi.

[LoginView](../../src/views/auth/login/login.view.tsx) · [Trace trước](reports/login-3d/before/chrome-performance.trace.json) · [Trace sau](reports/login-3d/after/chrome-performance.trace.json)

## Số đo

| Chỉ số | Trước, trung vị (min–max) | Sau, trung vị (min–max) |
|---|---:|---:|
| Lighthouse Performance | 73 (70–77) | 78 (77–80) |
| Accessibility / Best Practices / SEO | 100 / 100 / 82 | 100 / 100 / 82 |
| FCP | 222 ms (215–270) | 218 ms (216–223) |
| LCP | 768 ms (738–835) | 731 ms (541–743) |
| CLS | 0 (0–0) | 0 (0–0) |
| Speed Index | 1.018 ms (917–1.205) | 824 ms (806–841) |
| TBT | 717 ms (525–1.095) | 504 ms (462–535) |
| Từ navigation đến ký tự đầu tiên | 1.743 ms (1.484–8.530) | 419 ms (342–601) |
| Bytes JS truyền trong cửa sổ Lighthouse | 435.772 B (435.772–435.795) | 435.881 B (435.881–435.904) |

TBT giảm 213 ms theo trung vị và còn vượt mốc chậm 350 ms của Lighthouse desktop. Tổng bytes JS quan sát gần như giữ nguyên vì scene vẫn tải trong cửa sổ audit. [Ngưỡng TBT của Lighthouse](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time)

Trong trace sau sửa, hai callback React Three Fiber dài 191 ms và 430 ms đều diễn ra sau sự kiện nhập đầu tiên. Scene báo `ready` và có một canvas ở cả mười lượt Playwright. Khoảng đo input gồm cả thời gian Playwright chờ và thực hiện thao tác, đo theo cùng quy trình trước/sau. [Input trước](reports/login-3d/before/input-timing.json) · [Input sau](reports/login-3d/after/input-timing.json)

## Ảnh Lighthouse từng lượt

| Lượt | Trước | Sau |
|---|---|---|
| 01 | [PNG](reports/login-3d/before/run-01.png) · [HTML](reports/login-3d/before/run-01.report.html) · [JSON](reports/login-3d/before/run-01.report.json) | [PNG](reports/login-3d/after/run-01.png) · [HTML](reports/login-3d/after/run-01.report.html) · [JSON](reports/login-3d/after/run-01.report.json) |
| 02 | [PNG](reports/login-3d/before/run-02.png) · [HTML](reports/login-3d/before/run-02.report.html) · [JSON](reports/login-3d/before/run-02.report.json) | [PNG](reports/login-3d/after/run-02.png) · [HTML](reports/login-3d/after/run-02.report.html) · [JSON](reports/login-3d/after/run-02.report.json) |
| 03 | [PNG](reports/login-3d/before/run-03.png) · [HTML](reports/login-3d/before/run-03.report.html) · [JSON](reports/login-3d/before/run-03.report.json) | [PNG](reports/login-3d/after/run-03.png) · [HTML](reports/login-3d/after/run-03.report.html) · [JSON](reports/login-3d/after/run-03.report.json) |
| 04 | [PNG](reports/login-3d/before/run-04.png) · [HTML](reports/login-3d/before/run-04.report.html) · [JSON](reports/login-3d/before/run-04.report.json) | [PNG](reports/login-3d/after/run-04.png) · [HTML](reports/login-3d/after/run-04.report.html) · [JSON](reports/login-3d/after/run-04.report.json) |
| 05 | [PNG](reports/login-3d/before/run-05.png) · [HTML](reports/login-3d/before/run-05.report.html) · [JSON](reports/login-3d/before/run-05.report.json) | [PNG](reports/login-3d/after/run-05.png) · [HTML](reports/login-3d/after/run-05.report.html) · [JSON](reports/login-3d/after/run-05.report.json) |

Ba file test liên quan pass 30/30, gồm timing khởi động, fallback WebGL và luồng submit ở tầng test FE. Bài Lighthouse và Playwright chỉ đo trang công khai và thao tác nhập ký tự, chưa submit qua BE.

## Lượt tiếp theo — desktop chờ panel 3D

Desktop hiển thị khung chờ rồi vào panel 3D. Form 2D dùng cho viewport hẹp và khi WebGL thiếu, lỗi hoặc quá hạn 10 giây. Form giữ state nếu scene lỗi sau khi đã nhập. CPU profile của callback dài 430 ms trong trace trước có nhiều mẫu tại wrapper `texSubImage2D`, trong nhánh upload texture khi render. Dữ liệu profile chưa chỉ ra texture cụ thể. Đợt này thử giảm chiều rộng artwork tương tác từ 1024 xuống 768 pixel, tương ứng giảm khoảng 44% số pixel mỗi texture. HTML của form vẫn được chiếu lên panel như trước.

| Chỉ số | Bản form 2D hiện trước | Bản desktop chờ 3D |
|---|---:|---:|
| Performance, trung vị (min–max) | 78 (77–80) | 78 (74–82) |
| TBT, trung vị (min–max) | 504 ms (462–535) | 506 ms (397–648) |
| Từ navigation đến ký tự đầu tiên | 419 ms (342–601) | 1.435 ms (1.426–1.543) |
| LCP, trung vị | 731 ms | 744 ms |
| CLS | 0 | 0 |
| SEO | 82 | 82 |

TBT chưa đạt mục tiêu ≤ 350 ms. Phép so sánh đổi đồng thời cách hiển thị form và kích thước artwork, nên chưa tách được tác động của độ phân giải lên TBT. Bài gõ sáu ký tự nhận đủ trong cả năm lượt; khoảng dài nhất giữa hai sự kiện nhập trên các lượt là 72–77 ms, đã tính cả delay 40 ms do probe đặt. Scene báo ready và có một canvas trong 5/5 lượt. Build và 31 test FE liên quan pass.

| Lượt | Lighthouse |
|---|---|
| 01 | [PNG](reports/login-3d/desktop-3d-first/run-01.png) · [HTML](reports/login-3d/desktop-3d-first/run-01.report.html) · [JSON](reports/login-3d/desktop-3d-first/run-01.report.json) |
| 02 | [PNG](reports/login-3d/desktop-3d-first/run-02.png) · [HTML](reports/login-3d/desktop-3d-first/run-02.report.html) · [JSON](reports/login-3d/desktop-3d-first/run-02.report.json) |
| 03 | [PNG](reports/login-3d/desktop-3d-first/run-03.png) · [HTML](reports/login-3d/desktop-3d-first/run-03.report.html) · [JSON](reports/login-3d/desktop-3d-first/run-03.report.json) |
| 04 | [PNG](reports/login-3d/desktop-3d-first/run-04.png) · [HTML](reports/login-3d/desktop-3d-first/run-04.report.html) · [JSON](reports/login-3d/desktop-3d-first/run-04.report.json) |
| 05 | [PNG](reports/login-3d/desktop-3d-first/run-05.png) · [HTML](reports/login-3d/desktop-3d-first/run-05.report.html) · [JSON](reports/login-3d/desktop-3d-first/run-05.report.json) |

[Trace desktop chờ 3D](reports/login-3d/desktop-3d-first/chrome-performance.trace.json) · [Số đo nhập liệu](reports/login-3d/desktop-3d-first/input-timing.json)

Playwright xác nhận form 2D ở viewport 390 px và khi giả lập thiếu WebGL2 ở desktop. Trên desktop có WebGL2, nút Đăng ký mở đúng panel sau khi scene sẵn sàng. Bài submit được kiểm tra ở tầng test FE.

[Đợt đo tiếp theo sau khi tối ưu texture nền và sửa hai audit SEO](LOGIN_BACKDROP_SEO.md)
