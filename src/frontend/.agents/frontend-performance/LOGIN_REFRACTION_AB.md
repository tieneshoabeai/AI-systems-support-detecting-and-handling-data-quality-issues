# Login 3D — Đo xen kẽ thời điểm bật khúc xạ

Desktop vẫn chờ đến khi form HTML được chiếu lên panel 3D. Thử nghiệm dùng vật liệu physical sẵn có cho khung hình đầu của panel tương tác rồi yêu cầu render với các pass khúc xạ ở khung hình tiếp theo. Bản mobile và fallback WebGL giữ luồng 2D.

Trace chẩn đoán trước thay đổi ghi callback R3F 549 ms và 260 ms trước mốc panel sẵn sàng. CPU samples tập trung tại nhánh `getUniforms` của chương trình WebGL và ở thiết lập render target. Trace này được ghi ở phiên Chrome riêng và không thay thế số TBT từ Lighthouse. [Trace chẩn đoán](reports/login-3d/tbt-baseline.trace.json)

## Cách đo

Lighthouse 13.6.0 dùng preset desktop, Chrome headless và bốn nhóm audit. Hai production build phục vụ qua HTTPS loopback. Bản cũ ở cổng 4183, bản thử ở cổng 4181. Chạy tuần tự theo năm cặp, đảo thứ tự chạy ở cặp 02 và 04. Lệnh kiểm tra HTML trả về khớp với file trong từng build. Playwright đo tương tác ở hai nhóm riêng sau lượt Lighthouse.

## Kết quả và quyết định

| Chỉ số | Baseline | Thử nghiệm |
|---|---:|---:|
| TBT từng lượt (ms) | 485, 249, 240, 431,5, 337,5 | 2.194, 283, 365, 417, 204,5 |
| TBT trung vị | 337,5 ms | 365 ms |
| Thời gian đến ký tự đầu tiên, trung vị | 1.183 ms | 1.070 ms |
| Performance trung vị | 85/100 | 84/100 |

Thử nghiệm giúp giảm thời gian đến ký tự đầu tiên ở trung vị, nhưng TBT cao hơn ở 3/5 cặp. Lượt thử đầu là mẫu dao động lớn. Vì mục tiêu chính là giảm TBT, phần đổi render đã được gỡ khỏi source. Hai nhóm Playwright đều xác nhận scene desktop sẵn sàng, chuyển Đăng ký được, và form 2D hoạt động ở viewport hẹp hoặc khi thiếu WebGL2. Bản thử đã pass build và 10 test FE liên quan. Phép đo chỉ thực hiện thao tác nhập tại localhost.

[Timing baseline](reports/login-3d/refraction-ab/baseline/input-timing.json) · [Timing thử nghiệm](reports/login-3d/refraction-ab/candidate/input-timing.json) · [Trace baseline](reports/login-3d/refraction-ab/baseline/chrome-performance.trace.json) · [Trace thử nghiệm](reports/login-3d/refraction-ab/candidate/chrome-performance.trace.json)

| Lượt | Baseline | Thử nghiệm |
|---|---|---|
| 01 | [PNG](reports/login-3d/refraction-ab/baseline/run-01.png) · [HTML](reports/login-3d/refraction-ab/baseline/run-01.report.html) · [JSON](reports/login-3d/refraction-ab/baseline/run-01.report.json) | [PNG](reports/login-3d/refraction-ab/candidate/run-01.png) · [HTML](reports/login-3d/refraction-ab/candidate/run-01.report.html) · [JSON](reports/login-3d/refraction-ab/candidate/run-01.report.json) |
| 02 | [PNG](reports/login-3d/refraction-ab/baseline/run-02.png) · [HTML](reports/login-3d/refraction-ab/baseline/run-02.report.html) · [JSON](reports/login-3d/refraction-ab/baseline/run-02.report.json) | [PNG](reports/login-3d/refraction-ab/candidate/run-02.png) · [HTML](reports/login-3d/refraction-ab/candidate/run-02.report.html) · [JSON](reports/login-3d/refraction-ab/candidate/run-02.report.json) |
| 03 | [PNG](reports/login-3d/refraction-ab/baseline/run-03.png) · [HTML](reports/login-3d/refraction-ab/baseline/run-03.report.html) · [JSON](reports/login-3d/refraction-ab/baseline/run-03.report.json) | [PNG](reports/login-3d/refraction-ab/candidate/run-03.png) · [HTML](reports/login-3d/refraction-ab/candidate/run-03.report.html) · [JSON](reports/login-3d/refraction-ab/candidate/run-03.report.json) |
| 04 | [PNG](reports/login-3d/refraction-ab/baseline/run-04.png) · [HTML](reports/login-3d/refraction-ab/baseline/run-04.report.html) · [JSON](reports/login-3d/refraction-ab/baseline/run-04.report.json) | [PNG](reports/login-3d/refraction-ab/candidate/run-04.png) · [HTML](reports/login-3d/refraction-ab/candidate/run-04.report.html) · [JSON](reports/login-3d/refraction-ab/candidate/run-04.report.json) |
| 05 | [PNG](reports/login-3d/refraction-ab/baseline/run-05.png) · [HTML](reports/login-3d/refraction-ab/baseline/run-05.report.html) · [JSON](reports/login-3d/refraction-ab/baseline/run-05.report.json) | [PNG](reports/login-3d/refraction-ab/candidate/run-05.png) · [HTML](reports/login-3d/refraction-ab/candidate/run-05.report.html) · [JSON](reports/login-3d/refraction-ab/candidate/run-05.report.json) |
