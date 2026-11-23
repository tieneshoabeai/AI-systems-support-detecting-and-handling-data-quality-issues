# Kế hoạch triển khai Frontend Performance Testing

**Trạng thái** Đã đo baseline Lighthouse cho trang login desktop. Các profile và hành trình còn lại theo tiến độ bên dưới. [Project audit](PROJECT_AUDIT.md) · [Baseline FE](PERFORMANCE_REPORT.md)

## Phạm vi và đầu ra

Xây bộ đo lặp lại cho login, Processing, Management và Project Detail. Bản đầu dùng cùng browser và fixture để tái lập kết quả, có file JSON cho từng nhóm, báo cáo Markdown và tiêu chí đánh giá. Ưu tiên luồng đã có thật, dùng tài khoản thử với quyền tối thiểu và dữ liệu phi cá nhân. Các bài đọc dataset, mở module, chuyển workspace và đóng modal dùng dữ liệu đã có. Bài chat/streaming phụ thuộc bằng chứng triển khai ở FE.

| Nhóm | Công cụ dự kiến và chỉ số | Bằng chứng cần lưu |
|---|---|---|
| Loading | Lighthouse CLI và Playwright trên production preview. FCP/LCP/CLS/TTFB, Speed Index của Lighthouse, bytes JS/CSS tải ban đầu và waterfall. | JSON/HTML Lighthouse, route cuối, trạng thái auth, danh sách tài nguyên phân nhóm và thời gian tới mốc UI. |
| Rendering | Chrome Performance trace, React DevTools Profiler và số liệu từ R3F/Three.js khi cần. FPS, frame time p50/p95, dropped frames, React commit count/duration, draw calls. GPU duration chỉ báo cáo nếu đo được. | Trace đã làm sạch, profile React riêng, log GPU/renderer/DPR, các khoảng idle và tương tác. |
| Runtime | PerformanceObserver trong Playwright và Chrome Performance. Long-task count, tổng thời gian long task, script evaluation, scripting và main-thread blocking; event-loop delay nếu thiết kế được probe có kiểm soát. | Timeline theo mốc, thời lượng trace, stack/dấu vết source, mức overhead của instrumentation. |
| Memory | Chrome DevTools Heap Snapshot, Performance Monitor và CDP nếu phù hợp. JS heap used/total, heap sau GC, detached nodes, listener count và geometry/texture counters nếu lấy được. | Chuỗi số trước và sau từng lô, snapshot và retaining path ở một lượt chẩn đoán riêng. |
| Network | Resource Timing và Playwright/CDP. Request count, transfer/encoded bytes, API/asset latency, cache và tải chunk theo route. | Route template, status, initiator, cold/warm, dấu thời gian response tới UI. Cross-origin thiếu Timing-Allow-Origin được ghi là thiếu số liệu. |
| Interaction | Playwright với input thật, Event Timing và DevTools. Input delay, processing, presentation, INP lab khi hợp lệ và action-to-ready. | Mốc thao tác và selector xác minh trạng thái cuối. Navigation và thao tác trong SPA được báo cáo theo mốc riêng. |

Tận dụng Playwright đã có và các API browser. Lighthouse CLI là ứng viên bổ sung duy nhất ở đợt đầu nếu kiểm tra cho thấy runner chưa có phiên bản có thể pin. React DevTools dùng phiên profile riêng. Stats.js và web-vitals chỉ xem xét nếu phép đo sẵn có thiếu chỉ số hoặc thiếu khả năng lặp lại. Không đưa instrumentation vào production bundle mặc định. Giữ nguyên Playwright E2E và runner k6 hiện tại.

## Kịch bản và tiêu chí

| Test ID | Luồng, đầu vào và các bước | Kỳ vọng, tiêu chí và cách tái hiện |
|---|---|---|
| FE-PERF-01 | Loading. Context sạch mở login, rồi tách lượt auth để mở Processing, Management Projects và Project Detail. Ghi LCP/FCP/CLS/TTFB, Speed Index và bytes tải trước mốc UI. | PASS chức năng khi URL, heading và nội dung đích đúng. Chạy lại từng route với đúng profile và cache state khi có bất thường. Lighthouse phải xác nhận URL cuối của trang đã đăng nhập. |
| FE-PERF-02 | Network. Tài khoản có project đã biết. Mở Projects, đợi thẻ rồi dữ liệu thẻ, quay lại cùng route theo hai profile cold/warm. | Thẻ đúng và dữ liệu sẵn sàng. Ghi request trước thẻ và toàn luồng, cache và latency API. Đối chiếu waterfall theo route template khi thấy request lặp hoặc chậm. |
| FE-PERF-03 | Rendering và runtime. Mở Project Detail, đợi scene hoạt động, đo khoảng idle cố định rồi quay camera/chọn module theo chuỗi cố định. | Cần có WebGL và xác nhận scene nhận input. Thu frame time, dropped frames, draw calls, long tasks và commit React. Ghi riêng lần software rendering hoặc fallback. |
| FE-PERF-04 | Runtime và interaction. Dataset thật với kích thước đã ghi, mở Data View, chuyển trang, dùng filter/sort thực có. | Hàng hoặc trạng thái rỗng có căn cứ phải khớp dữ liệu. Đo click-to-content, long tasks và commit. Lặp với cùng trang, số cột và thao tác để tái hiện. |
| FE-PERF-05 | Interaction. Chuyển workspace, đổi bộ lọc danh sách, mở và đóng thông tin dự án. | Scope hiển thị đúng, modal đóng và focus trở về. Ghi input/processing/presentation delay và journey latency. Tái hiện từng thao tác độc lập. |
| FE-PERF-06 | Memory. Warm-up Project Detail, chụp mốc sau GC, lặp từng lô mở/đóng module và điều hướng vào/ra route, lấy lại snapshot sau mỗi lô. | UI có thể thao tác sau mỗi lô. Heap sau GC hoặc số tài nguyên tăng liên tục là cảnh báo. Chỉ xác nhận leak khi tái hiện được và có retaining path hoặc tài nguyên có vòng đời sai. |

Ngưỡng hiệu năng cho các kịch bản trên dùng chính sách bên dưới. Mỗi kịch bản sẽ có hướng dẫn fixture và bước tái hiện chi tiết trong `TEST_SCENARIOS.md` sau khi được duyệt.

## Chính sách đánh giá và phương pháp đo

| Trạng thái | Tiêu chí dự kiến |
|---|---|
| Target tham khảo | LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Chuẩn field dùng p75 và phân tách desktop/mobile. FCP ≤ 1,8 s là mục tiêu lab tham khảo trong yêu cầu. Một màn hình 60 Hz có khoảng 16,67 ms mỗi frame, dùng để diễn giải trace trên thiết bị tương ứng. |
| Warning | Metric xấu hơn baseline trong cùng profile. Dùng median và khoảng min–max cho pilot, rồi đặt mức cảnh báo theo độ dao động đo được. Frame time, long tasks, bundle và heap dùng budget riêng theo route, thiết bị và dữ liệu. |
| Failure | Trạng thái đích sai, thao tác không hoàn tất, artifact bắt buộc thiếu hoặc regression vượt budget đã phê duyệt và có lần đo xác nhận. Thiếu WebGL hoặc thiếu timing được ghi rõ với trạng thái không đủ dữ liệu cho chỉ số bị ảnh hưởng. |

Pilot đề xuất 5 lượt tuần tự mỗi profile để quan sát độ dao động. Tăng mẫu trước khi dùng tail percentile cho gate. Ghi revision, lockfile và build mode, phiên bản Chromium, thiết bị/OS, viewport/DPR, GPU, throttling, cache, mạng, quyền và quy mô fixture. Chạy từng bài với 1 worker, tránh build chạy cùng lúc. Ghi profile mobile emulation và mobile thực riêng. Không trộn trace bật profiler vào nhóm số dùng để so baseline. Baseline cũ của k6 tiếp tục được giữ làm tham chiếu lịch sử. [Web Vitals](https://web.dev/articles/vitals) · [Lighthouse và độ dao động](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)

## Roadmap và tiến độ

Ước lượng dưới đây tính theo giờ làm việc, giả định dùng được BE test và Chromium. Phần chuẩn bị GPU/mobile hoặc quyền runner có thể cần thêm thời gian chờ.

| Task ID | Phase và công việc | Ưu tiên | Status | Expected output | Acceptance criteria | Phụ thuộc / effort |
|---|---|---|---|---|---|---|
| FP-00 | Audit stack, route, lifecycle, build, test và dữ liệu lịch sử | P0 | DONE | PROJECT_AUDIT.md | Có bằng chứng source và chỉ rõ giả thuyết cùng khoảng trống đo | Đã khảo sát tĩnh / 2–4 h dự toán |
| FP-10 | Chốt thiết kế 6 nhóm và đặc tả kịch bản | P0 | IN_PROGRESS | Kế hoạch này, rồi TEST_SCENARIOS.md sau review | Chốt route, selector, input, profile và mốc đo từng test | FP-00, chủ FE review / 3–5 h |
| FP-20 | Thiết lập production preview và runner Playwright/Lighthouse | P0 | IN_PROGRESS | Config benchmark riêng, TOOLING_SETUP.md | Build chạy được, CLI pin phiên bản, đọc config an toàn, một lượt xác nhận thành công | Lighthouse hoàn tất, Playwright benchmark còn chờ / 4–7 h |
| FP-21 | Baseline tải trang login desktop | P0 | DONE | PERFORMANCE_REPORT.md và 5 cặp JSON/HTML | 5 lượt đúng route, document HTTP 200, thống kê min/median/max và lệnh tái lập | Lighthouse 13.6.0, production preview |
| FP-22 | Đo và tối ưu khởi tạo form login 3D | P0 | DONE | LOGIN_3D_COMPARISON.md, 10 bộ PNG/HTML/JSON và hai trace | 5 lượt trước và 5 lượt sau cùng cấu hình, so timing nhập và xác nhận scene sẵn sàng | FP-21, desktop Chrome |
| FP-30 | Cài bài loading, network, interaction | P0 | TODO | FE-PERF-01/02/05, JSON metric và screenshot/trace đã lọc nếu phù hợp | Mốc UI đúng, thu đủ metric được hỗ trợ, chạy lại được bằng một lệnh mỗi nhóm | FP-20, fixture / 6–10 h |
| FP-31 | Cài bài rendering, runtime và memory | P1 | TODO | FE-PERF-03/04/06 và hướng dẫn DevTools | Có trace production, số đo frame và heap có lượt kiểm tra hợp lệ, mô tả giới hạn GPU | FP-20, Chrome GPU / 8–14 h |
| FP-32 | Pilot Project Detail có xác thực | P0 | DONE | PROJECT_DETAIL_BASELINE.md, 5 bộ Lighthouse, timing và Chrome trace | Route cuối đúng project, scene hiển thị, mở Data View và chuyển trang được | Dùng account và dataset test hiện có |
| FP-40 | Đo baseline và chốt quy tắc ngưỡng | P0 | TODO | THRESHOLDS.md, baseline theo route/profile | Đủ mẫu, ghi min/median/max, có lý do cho warning/failure và owner duyệt | FP-30/31, dữ liệu và thiết bị / 4–7 h |
| FP-50 | Runner tuần tự và so regression | P1 | TODO | Scripts chạy từng nhóm và toàn bộ, bộ so JSON, TEST_EXECUTION.md | So sánh build khác trên cùng profile, từ chối so khác profile, báo sai lệch hoặc thiếu dữ liệu | FP-40 / 5–8 h |
| FP-51 | Xem xét CI | P2 | TODO | Đề xuất job nếu có runner phù hợp | Single-worker, artifact được lọc, gate chạy khi được duyệt, thiết bị được kiểm soát | FP-50, quyền CI / 2–5 h |
| FP-60 | Báo cáo, phân tích và bàn giao | P1 | TODO | README, PERFORMANCE_REPORT.md, BOTTLENECK_ANALYSIS.md | Có verdict từng nhóm, môi trường, minh chứng theo test ID, nguyên nhân ở mức đã xác nhận và phần còn mở | FP-40/50 / 3–6 h |

Sau mỗi phase cập nhật trạng thái bằng một trong `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`. Ghi link đến artifact, lỗi, điều kiện và cách tái hiện trước khi đánh dấu DONE.

## File dự kiến

- `.agents/frontend-performance/` chứa hai tài liệu hiện tại, README, THRESHOLDS, TEST_SCENARIOS, TOOLING_SETUP, TEST_EXECUTION, BOTTLENECK_ANALYSIS và PERFORMANCE_REPORT. Artifacts đã lọc đặt tại `reports/<nhóm>/<run-id>/` trong thư mục này theo chính sách lưu trữ được duyệt.
- Đề xuất `tests/performance/frontend/` cho spec, helper, config tách biệt và comparator TypeScript. Cần duyệt vị trí script trước khi tạo.
- `package.json` dự kiến thêm scripts chạy từng nhóm, toàn bộ và compare. Chỉ đổi lockfile nếu việc bổ sung CLI đã được duyệt.
- Baseline FE được đo mới bằng tooling của đợt này. Kết quả k6 thuộc đợt kiểm thử trước.

## Rủi ro và việc cần xác nhận

| Vấn đề | Xử lý |
|---|---|
| BE hoặc dữ liệu khác giữa hai lượt | Ghi fixture, quyền, quy mô, thời gian và status. Chọn lượt đọc lặp lại an toàn, báo biến động BE cạnh timing FE. |
| Dashboard có auth và artifact nhạy cảm | Xác nhận URL đích, loại token/cookie/query nhạy cảm và payload. Snapshot hoặc trace thô có thể giữ dữ liệu phiên, cần quy định lưu trữ trước khi thu. |
| GC, GPU và extension gây lệch | Dùng Chrome sạch, ghi renderer, chạy độc lập. Forced GC chỉ dùng cho bài lifecycle chẩn đoán. |
| Bundle size trên đĩa khác bytes tải | Ghi cả kích thước artifact và bytes truyền theo route, cache và compression. |
| Thiết bị hoặc pipeline chưa xác nhận | Chốt máy desktop/GPU, mobile thật hoặc emulation, nơi chạy CI, chủ duyệt budget và quyền lưu báo cáo. |

**Điểm review** Duyệt danh sách route và fixture, profile desktop/mobile, cách đo scene thật, vị trí script benchmark và tiêu chí chuyển warning thành failure trước Phase 2.
