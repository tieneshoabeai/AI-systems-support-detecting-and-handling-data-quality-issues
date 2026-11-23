# Baseline FE — tải trang đăng nhập

**FE-PERF-01 · Desktop · 5/5 lượt hợp lệ.** Đo `/auth/login` từ 23:59 ngày 21/11 đến 00:00 ngày 22/11/2026 (UTC+7). Cả 5 lượt kết thúc đúng route, document HTTP 200, Lighthouse không báo runtime error. Mỗi lượt ghi 18 request cùng origin và không thấy request lỗi trong waterfall. Đây là phép đo navigation trên trang công khai, chưa đo submit hoặc đăng nhập.

## Môi trường

- Production build của worktree hiện tại, HEAD `054a699` kèm thay đổi đang có. Entry `index-59KqQ8_u.js`, SHA-256 `2466de1263ac54317f07ddbb8488f5785d49aaf98d0aacde7067c9ed7598c2fd`.
- Vite 8.3.5 HTTPS preview loopback tại cổng 4181, Node 26.7.0, Lighthouse CLI 13.6.0, Chrome headless 158.0.8127.36, macOS 13.5.2 x86_64.
- Preset desktop Lighthouse 1350 × 940, DPR 1. Throttling mô phỏng RTT 40 ms, throughput 10.240 Kbps và CPU 1×. Mỗi lượt khởi tạo Chrome mới, chạy tuần tự sau khi build xong.

## Kết quả

| Chỉ số | Trung vị | Min–max |
|---|---:|---:|
| Lighthouse Performance | 74/100 | 69–80 |
| FCP | 228 ms | 222–244 ms |
| LCP | 759 ms | 240–775 ms |
| CLS | 0 | 0–0 |
| Speed Index | 1.035 ms | 869–1.215 ms |
| Total Blocking Time (TBT) | 659 ms | 449–1.269 ms |
| Initial document server response, theo audit Lighthouse | 6 ms | 3–20 ms |
| Request quan sát được | 18 | 18–18 |
| Tổng bytes truyền | 640.849 B | 640.849–640.872 B |
| Bytes JS truyền | 435.772 B | 435.772–435.816 B |

FCP, LCP và CLS trong pilot nằm trong mục tiêu tham khảo của kế hoạch. Initial document response đo preview loopback và dùng audit `server-response-time`, phạm vi hẹp hơn TTFB thực địa. INP cần bài có tương tác. Chưa dùng các kết quả này làm gate hoặc kết luận cho mobile, route có đăng nhập và người dùng production.

## Tín hiệu cần phân tích

TBT dao động từ 449 đến 1.269 ms. Ở lượt 3, Lighthouse quy khoảng 1.493 ms trong tổng 1.770 ms main-thread work vào script evaluation. Waterfall lượt này có chunk `react-three-fiber.esm` truyền 240.388 B, lớn nhất trong các request JS. Trace Performance cần chỉ rõ tác vụ nào tạo blocking và import nào đưa chunk vào đường tải login. Audit hiện có chỉ xác nhận chunk được tải và script evaluation chiếm nhiều thời gian.

## Artifact

| Lượt | HTML | JSON |
|---|---|---|
| 1 | [HTML](reports/lighthouse/login-desktop-01/run-1.report.html) | [JSON](reports/lighthouse/login-desktop-01/run-1.report.json) |
| 2 | [HTML](reports/lighthouse/login-desktop-01/run-2.report.html) | [JSON](reports/lighthouse/login-desktop-01/run-2.report.json) |
| 3 | [HTML](reports/lighthouse/login-desktop-01/run-3.report.html) | [JSON](reports/lighthouse/login-desktop-01/run-3.report.json) |
| 4 | [HTML](reports/lighthouse/login-desktop-01/run-4.report.html) | [JSON](reports/lighthouse/login-desktop-01/run-4.report.json) |
| 5 | [HTML](reports/lighthouse/login-desktop-01/run-5.report.html) | [JSON](reports/lighthouse/login-desktop-01/run-5.report.json) |

[Tooling và lệnh chạy lại](TOOLING_SETUP.md) · [Lighthouse Performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
