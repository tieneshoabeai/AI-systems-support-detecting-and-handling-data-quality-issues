# Baseline frontend — Project Detail

Đo route `/processing/projects/:projectId` trên production preview HTTPS loopback. Một tài khoản E2E đăng nhập qua BE test và chọn project có dataset từ index mà tài khoản được phép đọc. Mỗi lượt Lighthouse xác nhận URL cuối là đúng project đã chọn. Các lượt giữ phiên đăng nhập trên cùng tab và xóa HTTP cache trước khi điều hướng.

[Tooling và lệnh tái lập](TOOLING_SETUP.md) · [Probe](project-probe.mjs)

## Lighthouse desktop, 5 lượt

| Chỉ số | Trung vị | Min–max |
|---|---:|---:|
| Performance | 41/100 | 40–44 |
| FCP | 264 ms | 235–563 ms |
| LCP | 3,41 s | 3,01–3,79 s |
| TBT | 11,42 s | 3,14–19,46 s |
| CLS | 0,0172 | 0–0,0172 |
| JS truyền trong audit | 576,4 KiB | Khoảng 576,4 KiB |

Chrome headless chạy Lighthouse 13.6.0, preset desktop. Benchmark index Lighthouse dao động từ 72,5 đến 528,5. TBT và Performance là kết quả của đợt chạy này, cần xác nhận bằng profile máy/GPU ổn định trước khi dùng làm gate hoặc quy toàn bộ chi phí cho code. Lượt 1 ghi thời gian xử lý JS cao nhất ở chunk R3F/Three.js, kế đến là entry JS. Đây là điểm bắt đầu phân tích trước khi tối ưu.

## Thao tác trên cùng project, 5 lượt Playwright

| Mốc đo | Trung vị | Min–max |
|---|---:|---:|
| Mở URL → thấy tên project | 5,56 s | 4,98–9,39 s |
| Mở URL → có metadata dataset và canvas hiển thị | 5,73 s | 5,27–9,90 s |
| Bấm Data View → thấy hàng đầu tiên | 752 ms | 594–1.673 ms |
| Bấm Trang tiếp → thấy hàng ở trang mới | 982 ms | 821–2.169 ms |
| P95 khoảng cách callback rAF mỗi lượt khi idle | 67 ms | 67–83 ms |
| P95 khoảng cách callback rAF mỗi lượt trong cửa sổ kéo | 100 ms | 67–233 ms |

Renderer Playwright báo ANGLE Metal trên Intel Iris Plus Graphics 645. Probe phân biệt canvas hiển thị với WebGL fallback và gửi thao tác kéo, sau đó xác nhận nội dung Data View và hàng ở trang mới. Số rAF là nhịp callback quan sát trên main thread trong cửa sổ ngắn, chưa xác minh góc camera, dropped frames hoặc GPU time. API records đầu đã hoàn tất trước thao tác Data View trong cả 5 lượt. Thời gian click đến hàng gồm xử lý panel và render quan sát được. Khoảng response đến hàng ở lượt prefetch gồm cả thời gian chờ người dùng mở panel.

Chrome trace chẩn đoán ghi callback từ chunk R3F/Three.js khoảng 1,85 s và entry JS khoảng 1,14 s. Ưu tiên mở các tác vụ này trong Bottom-up và kiểm tra chi phí dựng model, shader và render. Chưa đủ bằng chứng để quy toàn bộ cho một API hoặc một component.

[Timing tương tác và API theo route mẫu](reports/project-detail/desktop-baseline/journey.json) · [Chrome Performance trace](reports/project-detail/desktop-baseline/chrome-performance.trace.json)

## Artifact Lighthouse

| Lượt | Báo cáo |
|---|---|
| 01 | [PNG](reports/project-detail/desktop-baseline/run-01.png) · [HTML](reports/project-detail/desktop-baseline/run-01.report.html) · [JSON](reports/project-detail/desktop-baseline/run-01.report.json) |
| 02 | [PNG](reports/project-detail/desktop-baseline/run-02.png) · [HTML](reports/project-detail/desktop-baseline/run-02.report.html) · [JSON](reports/project-detail/desktop-baseline/run-02.report.json) |
| 03 | [PNG](reports/project-detail/desktop-baseline/run-03.png) · [HTML](reports/project-detail/desktop-baseline/run-03.report.html) · [JSON](reports/project-detail/desktop-baseline/run-03.report.json) |
| 04 | [PNG](reports/project-detail/desktop-baseline/run-04.png) · [HTML](reports/project-detail/desktop-baseline/run-04.report.html) · [JSON](reports/project-detail/desktop-baseline/run-04.report.json) |
| 05 | [PNG](reports/project-detail/desktop-baseline/run-05.png) · [HTML](reports/project-detail/desktop-baseline/run-05.report.html) · [JSON](reports/project-detail/desktop-baseline/run-05.report.json) |
