# Login — Tách bundle Workbench

Phạm vi là một thay đổi tại router. Trước đó `AppRouter` import tĩnh `WorkbenchRoutes`, khiến module route nghiệp vụ và các import tĩnh của nó tham gia đường tải login, dù các page bên trong Workbench đã dùng lazy import. Bản mới dùng dynamic import với skeleton hiện có trong lúc route nghiệp vụ tải. Guard và chuyển hướng về route gốc sau đăng nhập vẫn nằm trong luồng hiện có. [AppRouter](../../src/app/router/app-router.tsx)

Lighthouse dùng cùng production build profile desktop, Chrome headless, Lighthouse CLI 13.6.0 và URL `https://127.0.0.1:4181/auth/login`. Mỗi phiên bản có năm lượt tuần tự. Số unused JS là tổng `wastedBytes` từ các file được audit liệt kê. Số JS truyền là tổng `transferSize` của resource loại Script, gồm cả code đã chạy và code chưa chạy. [Bản đối chứng](LOGIN_BACKDROP_SEO.md)

## Kết quả 5 lượt

| Chỉ số, trung vị | Trước | Sau |
|---|---:|---:|
| JavaScript thực tế truyền | 425,7 KiB | 411,5 KiB |
| Unused JS Lighthouse ước tính | 174,2 KiB | 175,5 KiB |
| TBT | 336,5 ms | 967 ms |
| Đến ký tự đầu tiên | 1.046 ms | 1.148 ms |
| Lighthouse Performance | 85/100 | 70/100 |
| SEO | 100/100 | 100/100 |

Bundle `workbench-routes` được tạo riêng và vắng mặt trong 5/5 waterfall của login. JavaScript truyền giảm 14.481 B ở trung vị. Audit còn ghi khoảng 107,4 KiB từ R3F trong cả hai bản. Trace sau có callback trước ký tự đầu tiên dài 480 ms ở entry JS và 408 ms ở R3F. Benchmark index của Lighthouse dao động 186,5–1.394,5 ở đợt sau so với 1.665,5–1.820,5 ở đợt trước. TBT sau nằm trong khoảng 868,5–2.262 ms. Hai mẫu thời gian có điều kiện máy khác nhau đáng kể, nên chưa xác định được phần chênh lệch TBT do thay đổi router.

Build và 66 test liên quan đạt, gồm guard và return-to. Do Workbench tải bất đồng bộ, assertion chuyển hướng trong test chờ URL đích. Playwright xác nhận desktop có scene 3D, chuyển được sang Đăng ký và form 2D hoạt động ở viewport hẹp hoặc khi thiếu WebGL2. Submit qua BE không nằm trong đợt Lighthouse này.

## Ảnh và báo cáo từng lượt

| Lượt | Lighthouse |
|---|---|
| 01 | [PNG](reports/login-3d/workbench-split/run-01.png) · [HTML](reports/login-3d/workbench-split/run-01.report.html) · [JSON](reports/login-3d/workbench-split/run-01.report.json) |
| 02 | [PNG](reports/login-3d/workbench-split/run-02.png) · [HTML](reports/login-3d/workbench-split/run-02.report.html) · [JSON](reports/login-3d/workbench-split/run-02.report.json) |
| 03 | [PNG](reports/login-3d/workbench-split/run-03.png) · [HTML](reports/login-3d/workbench-split/run-03.report.html) · [JSON](reports/login-3d/workbench-split/run-03.report.json) |
| 04 | [PNG](reports/login-3d/workbench-split/run-04.png) · [HTML](reports/login-3d/workbench-split/run-04.report.html) · [JSON](reports/login-3d/workbench-split/run-04.report.json) |
| 05 | [PNG](reports/login-3d/workbench-split/run-05.png) · [HTML](reports/login-3d/workbench-split/run-05.report.html) · [JSON](reports/login-3d/workbench-split/run-05.report.json) |

[Chrome trace](reports/login-3d/workbench-split/chrome-performance.trace.json) · [Số đo nhập liệu](reports/login-3d/workbench-split/input-timing.json)
