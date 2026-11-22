# Hướng dẫn chạy và bàn giao k6

Hai suite Browser bên dưới đã có trong FE. Kịch bản HTTP và hybrid tiếp tục theo [phạm vi phối hợp với BE](05-TEST-ARCHITECTURE.md). Tài khoản E2E được launcher đọc từ cấu hình hiện có, giữ giá trị ngoài lệnh chạy, log và báo cáo.

## Preflight

1. Xác nhận run ID, version FE/BE, build profile, browser/k6 version, tài nguyên runner, fixture version, hostname và owner. K6 Browser cần Chromium. Module HTTP có thể chạy trên runner khác. Pin cả hai phiên bản trong Phase 2.
2. Kiểm tra đúng database/storage/worker test, readiness, tài khoản và quyền từ manifest. Xác nhận config FE build trỏ đúng BE, CORS và cùng các thiết lập dự kiến dùng cho baseline. Dừng khi endpoint ngoài allowlist, job quota chưa chốt hoặc dependency trỏ môi trường thật.
3. Thống nhất clock UTC, cửa sổ steady, quota test và người có quyền stop. Ghi cách thu CPU/RAM/DB/network trước khi bắt đầu. Không gọi script performance legacy làm gate cho đến khi sửa các sai khác được ghi ở [phân tích](01-PROJECT-ANALYSIS.md).

## Lệnh tham chiếu

Từ root repo với dependencies FE đã sẵn sàng:

```sh
cd src/frontend
yarn build
yarn preview --host 127.0.0.1 --port 4173 --strictPort
```

Từ root ở terminal khác, chạy từng lệnh Browser sau khi mốc triển khai tương ứng được nghiệm thu:

```sh
k6 version
k6 run -e BASE_URL=https://127.0.0.1:4173 -e ALLOW_LOCAL_SELF_SIGNED_CERT=1 src/frontend/tests/performance/suites/browser/login.ts
node src/frontend/tests/performance/run-projects.mjs
ITERATIONS=5 node src/frontend/tests/performance/run-projects.mjs
```

Suite danh sách ghi riêng thời gian đến thẻ đầu tiên và thời gian đến khi dataset cùng thành viên của mọi thẻ trên trang đầu sẵn sàng. Hai bộ đếm request ghi số request trình duyệt đã phát từ lúc mở URL đến mỗi mốc, gồm cả tài nguyên FE và API. Log `projects_api_timing` giữ danh sách API theo route mẫu. Đối chiếu `endMs` với `cardObservedMs` để đếm API đã hoàn tất trước mốc quan sát thẻ. Dữ liệu từ baseline 5 lượt chỉ có bộ đếm API theo dõi tại mốc đầu, vì vậy hai bộ đếm browser mới chưa có số cũ cùng định nghĩa.

Vite preview hiện dùng HTTPS. Chỉ đặt `ALLOW_LOCAL_SELF_SIGNED_CERT=1` khi chạy với chứng chỉ tự ký ở máy local. Mặc định là một lượt smoke. Thêm `-e ITERATIONS=5` để đo lặp tuần tự với 1 VU. Mỗi lượt ghi thời gian từ khi bắt đầu mở URL tới khi các trường và nút submit đều hiển thị và bật. Để kiểm tra kiểu, chạy `yarn install --frozen-lockfile` rồi `yarn typecheck:perf` trong `src/frontend`.

Launcher Browser projects đọc cấu hình production của Vite và tài khoản E2E. `per-vu-iterations` chạy tuần tự với 1 VU, mặc định một lượt và giới hạn tối đa 5 lượt. Script xác nhận đăng nhập qua BE, mở URL danh sách trong cùng phiên, đợi thẻ dự án và đăng xuất qua UI. Phép đo danh sách bắt đầu từ navigation trực tiếp vì sidebar hiện tại không có mục Dự án. Thời gian đăng xuất nằm ngoài hai phép đo chính. Log `projects_api_timing` ghi duration từ Resource Timing của Chromium cho các fetch/XHR đã hoàn tất trên trang danh sách, status quan sát được và route đã chuẩn hóa. Lệnh chạy HTTP độc lập cần kế hoạch riêng với BE/DevOps.

## Kết quả và báo cáo

### Kiểm tra bàn giao Browser FE

| Bước | Bằng chứng cần ghi |
|---|---|
| Xác nhận toolchain | Ghi revision bản build, phiên bản k6/Chromium và kết quả `yarn typecheck:perf`. |
| Chạy Browser login một lượt | Form hiển thị và có thể nhập, check pass, có một mẫu `login_form_ready`. |
| Chạy Browser projects một lượt qua BE test đã duyệt | Có một lượt hoàn tất, bốn checks pass, gồm đăng nhập, thẻ thật, timing dương của `GET /projects` và đăng xuất. |
| Đọc kết quả | Chỉ ra `projects_navigation_to_ready` là thời gian người dùng chờ thẻ. Duration của `GET /projects` là thời lượng một request. Ghi số mẫu cùng percentile. |
| Bàn giao | Người nhận xác nhận tự chạy smoke hoặc quan sát buổi chạy chung, biết đầu mối FE cho lỗi script và đầu mối BE cho lỗi môi trường, API hoặc tài khoản test. |

Nếu preflight thiếu cấu hình, bổ sung từ nơi quản lý môi trường đã thống nhất. Nếu check đăng xuất thất bại, xác minh trạng thái phiên test trước khi chạy thêm. Nếu số lượt thực tế thấp hơn số lượt dự kiến, hoặc k6 trả exit code khác 0, ghi run là không đạt và lưu phần lỗi đã lọc. Khi so sánh hai run, dùng cùng bản build, profile, điều kiện chạy và dữ liệu test. Lưu bằng chứng theo run ID tại nơi nhóm duyệt, chỉ giữ route mẫu, status và thời gian. Owner và thời hạn lưu báo cáo được chốt lúc bàn giao.

### Báo cáo cho bài chạy HTTP hoặc hybrid được phê duyệt

- Lưu summary, exit code, log đã lọc, time series nếu có, run manifest và dashboard snapshot/link dưới run ID. Ưu tiên JSON output cục bộ cho pilot. Khi có Prometheus receiver, đánh giá remote write và pin phiên bản tương thích. Chỉ lưu artifacts đã kiểm tra quyền và retention. [Prometheus remote write](https://grafana.com/docs/k6/latest/results-output/real-time/prometheus-remote-write/)
- Báo từng profile, từng endpoint và cửa sổ với planned/actual arrivals, RPS/TPS, p50/p90/p95/p99, checks, lỗi, failed/dropped/interrupted và concurrency. Ghi số mẫu, Web Vitals/route-ready và resource charts. Mỗi SLO có target, trạng thái duyệt, actual và verdict. Ghi mục missing/invalid rõ ràng.
- Lộ trình CI sau duyệt bắt đầu manual smoke. Sau khi ổn định, dùng smoke hợp đồng làm gate cho môi trường cô lập, chạy load định kỳ, giữ stress/spike/soak/breakpoint bằng manual approval và execution lock. Pipeline hiện hữu ngoài repo cần owner xác nhận.

## Đọc bottleneck theo timeline

Trong log `projects_api_timing`, `startMs`, `endMs` và `cardObservedMs` cùng tính từ mốc navigation của document danh sách. So thứ tự và phần chồng lấp giữa các request, rồi đối chiếu response core cuối cùng với mốc script quan sát thẻ. Khoảng cách này gồm xử lý dữ liệu, cập nhật state, render và độ trễ quan sát. Request nền kết thúc muộn có thể không chặn thẻ. Tránh cộng duration các request chạy song song. Log chỉ chứa route mẫu, status và thời gian.

| Triệu chứng | Đối chiếu trước khi kết luận |
|---|---|
| p95/p99 tăng, `http_req_waiting` tăng, Mongo query time tăng cùng lúc | Xem trace/query shape, index, scans và pool wait. Lặp cùng fixture và chỉ đổi một biến. |
| TTFB ổn, LCP hoặc route-ready xấu | Xem browser trace, asset size, thứ tự render, CPU main thread và network waterfall trước khi tìm ở server. |
| RPS phẳng, 429 tăng, CPU còn thấp | Kiểm tra throttle/gateway và tracking key, so số request đã phát với quota. |
| Drops tăng, CPU runner cao hoặc đã dùng hết VUs | Đối chiếu generator telemetry, iteration duration và VU pool. Xác nhận capacity thực sau khi loại giới hạn runner. |
| Submit nhanh, job completion chậm | Xem backlog, worker utilization, thời gian inference và độ phân giải polling. |

Ghi finding dưới dạng **quan sát → giả thuyết → phép đo kiểm chứng → tác động → việc đề xuất**. Báo lại recovery sau khi ngừng tải. [Nghiệm thu](07-ACCEPTANCE-CRITERIA.md)
