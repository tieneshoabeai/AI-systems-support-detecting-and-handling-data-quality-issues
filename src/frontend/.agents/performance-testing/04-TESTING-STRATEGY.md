# Chiến lược kiểm thử

## Thứ tự triển khai

1. **Browser login.** Một VU, một navigation trong smoke. Đo trên production build, chờ form visible và enabled. Trong baseline lặp số lượt duyệt với context mới cho cold cache, có cohort warm cache riêng nếu cần.
2. **Browser danh sách dự án.** Sau khi nghiệm thu login, đăng nhập qua UI với tài khoản synthetic, xác minh phiên và vào `/management/projects`. Đo từ click đến khi có hàng fixture, hoặc empty state đúng fixture đã chọn. Ghi navigation, ready, failed flow và Web Vitals theo page. Tách thời gian login để không làm lệch metric route.
3. **Phối hợp BE nếu cần đo tải.** Sau khi có baseline Browser, BE/DevOps có thể dùng các profile HTTP bên dưới làm đề xuất để duyệt riêng. Đo hybrid chỉ thực hiện khi có baseline HTTP, môi trường cô lập và người phụ trách BE đồng ý. FE có thể tiếp tục hoàn thiện, nghiệm thu và bàn giao hai luồng Browser độc lập.

## Sáu loại test

Smoke và baseline Browser thuộc phạm vi FE. Các profile HTTP trong bảng là thiết kế tham chiếu cho BE/DevOps. Mọi bài đo trực tiếp nhắm API, gồm cả HTTP smoke độc lập và write profiles, cần BE xác nhận trước.

Các thời lượng là đề xuất lập ngân sách. Tải được lấy từ [workload model](03-PERFORMANCE-REQUIREMENTS.md), thông số chưa duyệt để trống. Ký hiệu Browse = workspaces và projects, Read = project datasets và records/query. Tất cả route theo [Inventory](02-API-INVENTORY.md).

| Loại | Mục đích, phạm vi và API | Workload và thời lượng đề xuất | Metrics, kỳ vọng và pass/fail | Rủi ro và kiểm soát |
|---|---|---|---|---|
| Smoke | Xác minh build, auth và happy path. Browser theo hai mốc. HTTP lần lượt health/readiness, login, users/me, Browse và Read với dữ liệu có sẵn. | 1 VU, 1 iteration mỗi mốc, `per-vu-iterations`, budget tối đa 2 phút hoặc theo timeout đã chốt. | Toàn bộ check bắt buộc pass, có mẫu đo theo profile, 0 failed/interrupted/dropped. Sai route, schema hoặc quyền là fail. | Dữ liệu test thiếu cho false positive nếu chỉ kiểm tra status; assert fixture và nội dung. |
| Load | Kiểm tra tải kỳ vọng, mix Browse/Read, auth theo tần suất phiên. Browser probe chạy riêng trước hybrid. | Closed `ramping-vus` nếu target là simultaneous sessions, open nếu target arrival. Gợi ý 2 phút ramp, 15 phút steady, 2 phút down. | p50/90/95/99, lỗi, checks, TPS/RPS, VUs, concurrent requests, CPU/RAM/DB/network. Pass nếu workload đạt và toàn bộ SLO được duyệt đạt trong steady. | Giới hạn rate có thể gây 429. Ghi policy và phân loại theo contract. |
| Stress | Đánh giá suy giảm và phục hồi khi vượt peak đã duyệt. Ưu tiên Browse/Read, upload hoặc job chỉ trong profile riêng. | `ramping-arrival-rate` nếu tải mục tiêu là arrivals. Steady theo bậc khoảng 5 phút, cooldown 5–10 phút. Cap theo owner. | Kỳ vọng hệ thống suy giảm có thể quan sát và phục hồi. Pass tiêu chí thí nghiệm nếu có đủ evidence và hồi phục trong budget đã duyệt. Fail nếu không hồi phục hoặc vi phạm cap an toàn. | DB/worker bão hòa và write side effects. Stop rule theo quota và thời gian. |
| Spike | Xác minh burst và recovery giữa baseline và peak ngắn. Browse/Read. Chỉ có burst login khi workload chứng minh. | Ramp nhanh theo telemetry, ví dụ 10–30 giây tăng, giữ 1–2 phút, 5 phút theo dõi hồi phục. | Báo p95/p99, lỗi, drops, RPS/TPS, backlog và thời gian trở về baseline. Pass nếu lỗi và recovery trong budget đã duyệt. | Rate limit và generator có thể làm đỉnh tải thấp; xác thực arrival đã phát. |
| Soak | Tìm rò bộ nhớ, session churn, pool drift, queue backlog. Browse/Read, refresh khi đến hạn. | `constant-vus` hoặc `constant-arrival-rate` ở tải steady đã kiểm chứng. Đề xuất 2–4 giờ và đủ dài để quan sát chu kỳ token; tăng thời lượng theo nhu cầu. | So trend RSS/heap sau GC, connections, queue, lỗi và latency theo các cửa sổ. Pass nếu drift và SLO trong budget, backlog thoát sau cooldown. | Chi phí, volume logs và TTL. Đặt retention, giới hạn viết và theo dõi cleanup. |
| Breakpoint | Ước lượng mức tải đầu tiên làm SLO bền vững suy giảm. Kịch bản P0 Browse/Read cố định mix. | Arrival ramp theo bậc 3–5 phút đã duyệt. Lặp hẹp quanh bậc cuối đạt và bậc đầu trượt, dừng ở cap. | Báo khoảng `[last-good, first-bad]`, hoặc chưa chạm giới hạn đến cap nếu tất cả đạt. Đề xuất định nghĩa vi phạm bền vững qua hai cửa sổ liên tiếp và lặp xác nhận. Thành công thí nghiệm khi có evidence hợp lệ hoặc kết luận đến cap; vi phạm stop rule là fail vận hành. | Tải cao ảnh hưởng dependency. Chỉ chạy môi trường độc lập, có người trực và stop rule. |

## Profile nghiệp vụ có ghi

Upload synthetic, analysis/summary/report là profile riêng với quota số lượt, dung lượng và thời lượng. Chỉ tạo entity dưới run ID và scope riêng. Với async, submit thành công chỉ tính throughput tiếp nhận; giao dịch hoàn tất chỉ tính sau terminal status đúng và file hợp lệ nếu có. Một số API tạo side effect như email, notifications hoặc thay đổi membership, cần mock/sink hoặc loại khỏi profile tới khi có môi trường thích hợp.

[Roadmap](06-IMPLEMENTATION-ROADMAP.md) · [Tiêu chí nghiệm thu](07-ACCEPTANCE-CRITERIA.md)
