# Yêu cầu hiệu năng và mô hình tải

## Chỉ số và cách thu

**Nghiệm thu FE** dựa trên Browser metrics, thời gian form/danh sách sẵn sàng, tỷ lệ thành công của luồng và số mẫu. Chỉ số tách theo request có thể dùng để giải thích độ trễ quan sát từ trình duyệt. Các mục tiêu p95/p99 API, RPS/TPS và tài nguyên BE dưới đây là tham chiếu khi phối hợp với BE/DevOps. Chúng không phải tiêu chí chặn nghiệm thu FE.

| Nhóm | Metric | Định nghĩa và điểm thu |
|---|---|---|
| API latency | `http_req_duration` p50, p90, p95, p99; `http_req_waiting` | Duration = gửi + chờ + nhận. Waiting là thời gian đến byte đầu. Báo từng endpoint/luồng và cửa sổ steady, kèm số mẫu, kích thước payload và trạng thái. |
| Throughput | `http_reqs` total/RPS, TPS | RPS = HTTP requests trên giây trong cửa sổ đo. TPS = giao dịch nghiệp vụ **thành công** trên giây. Một lần mở danh sách chỉ được tính khi trả đúng quyền và trang, dù có nhiều request. Tách auth, retry và polling khỏi TPS. |
| Reliability | `http_req_failed`, `checks`, failed iterations, `dropped_iterations` | Ghi status và timeout theo endpoint. Failed iteration là luồng đã vào nhưng check bắt buộc hoặc exception làm thất bại, đếm tối đa một lần trong hàm kết thúc, báo cả số và tỷ lệ so với started. Dropped là iteration lên lịch mà chưa bắt đầu. Báo interrupted riêng vì khi bị hard stop script có thể chưa ghi outcome. |
| Concurrency | `vus`, `vus_max`, concurrent requests | VUs active và mức cấp phát tối đa là hai số khác nhau. Concurrent requests đo số in-flight ở proxy/server nếu có telemetry. Công thức L ≈ RPS × latency trung bình giây chỉ để ước lượng ở steady và cùng boundary. |
| Data và Browser | `data_received`, `data_sent`, Browser bytes, TTFB/FCP/LCP/CLS/INP, route ready | Ghi bytes theo run và payload bucket. Route ready đo từ thao tác điều hướng đến UI đúng dữ liệu, dùng Trend riêng cho SPA. INP cần tương tác thực và báo thiếu mẫu nếu không có. Trang login có thêm thời gian đến form enabled. |
| CPU và memory | CPU theo quota, RSS/heap, GC, restart | Đề xuất Docker stats hoặc cAdvisor/node exporter và Prometheus/Grafana nếu có. Thu riêng FE hosting hoặc proxy, API, worker, DB và máy tạo tải theo topology. |
| Mongo | Connections, pool wait, query time, scans | Dùng Atlas metrics nếu là Atlas, hoặc exporter/serverStatus trên môi trường được phép. Độ trễ query từ APM hoặc slow query log đã lọc, kèm query shape. Xác định mức phí và overhead của profiler trước khi bật. |
| Network và jobs | Network I/O, retransmits nếu có, queue lag, submit-to-complete | Proxy/OS hoặc container metrics cho network, log/tracing worker và thời điểm trạng thái terminal cho job. Lưu thời gian poll để diễn giải độ phân giải của phép đo. |

## Mục tiêu và trạng thái phê duyệt

| Chỉ số | Target | Mức | Trạng thái |
|---|---:|---|---|
| API interactive p95 / p99 | ≤ 500 ms / ≤ 1000 ms | P0 | Đề xuất per endpoint ở steady, áp dụng sau khi xác nhận workload. |
| HTTP error | < 1% | P0 | Đề xuất cho happy path. Theo dõi 429 riêng và tính vào lỗi nếu ngoài contract happy path. |
| Check success | ≥ 99% | P0 | Đề xuất. Đo thêm tỷ lệ transaction thành công để tránh nhiều check dễ che một check quan trọng. |
| Smoke | 100% check bắt buộc, 0 lỗi luồng, 0 drop nếu applicable | P0 | Đề xuất gate correctness. |
| Dropped ở tải kỳ vọng | 0 | P0 | Đề xuất cho cửa sổ arrival-rate steady. Kiểm tra năng lực generator trước khi quy kết cho SUT. |
| RPS/TPS, in-flight và browser budgets | Theo traffic, UX và baseline | P1 | Chưa đủ dữ liệu. |
| CPU, heap, DB pool/query, Network I/O | Theo quota, headroom và profile | P1 | Chưa đủ dữ liệu. |
| Upload và async analysis/report | Theo nhóm byte/hàng và budget submit/completion | P1 | Chưa đủ dữ liệu. |

Chưa có target nào được xác nhận. Thu p99 với số mẫu và độ ổn định đủ để diễn giải. Nếu rất ít mẫu, ghi `insufficient samples`. Không gộp percentile từ nhiều run bằng phép lấy trung bình. Với API P0, chỉ bật release gate sau khi chủ sở hữu duyệt threshold, traffic mix và cửa sổ. [k6 metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) · [Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)

## Lấy workload từ dữ liệu

1. Thu log hoặc số liệu sử dụng đã ẩn danh theo cửa sổ thường và cao điểm, tính arrival theo route, số session đồng thời, thao tác mỗi session, kích thước file/dataset, tỉ lệ role và retry. Ghi khoảng thời gian và nguồn. Nếu chưa có traffic, dùng pilot với tập thao tác do nhóm xác nhận, ghi rõ độ lệch.
2. Xây mix theo giao dịch. Ví dụ một browse gồm index rồi lấy trang kế khi có cursor. Một processing read gồm datasets rồi records. Tần suất mỗi endpoint bằng tổng tần suất giao dịch nhân số lần gọi kỳ vọng, gồm nhánh có điều kiện.
3. Dùng closed model khi cần mô phỏng session đồng thời và think time lấy từ khoảng cách giữa thao tác. Dùng open model khi điều khiển arrivals độc lập tốc độ trả lời. Rate của executor là **iterations/giây**, chỉ bằng RPS khi một iteration có đúng một request. Với open model, không thêm sleep để ép rate. Ước lượng VU pool bằng arrival rate × p95 thời lượng **toàn iteration** × headroom, rồi sửa theo pilot.
4. Tách warm-up, steady, cooldown. Chốt ramp và cap theo capacity staging, giới hạn dữ liệu, rate limit và telemetry. Khi thiếu số người dùng, peak hoặc tần suất, profile giữ trạng thái dự thảo. [Chiến lược](04-TESTING-STRATEGY.md) · [Open questions](08-RISKS-AND-CONSTRAINTS.md)
