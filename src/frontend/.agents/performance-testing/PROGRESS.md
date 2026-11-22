# Theo dõi tiến độ

Trạng thái sau lần chạy timeline danh sách dự án ngày 2026-11-21. Phần trăm ước lượng theo deliverable. Dùng bốn trạng thái Pending, In Progress, Blocked và Completed.

| Phase | Status | Progress | Deliverable | Blocker |
|---|---|---:|---|---|
| Project Analysis | Completed | 100% | Hai luồng Browser FE và phụ thuộc API đã được đối chiếu với source và lần chạy thực tế | — |
| Environment Setup | Completed | 100% | k6 v2.4.0, Chromium, Vite HTTPS và fixture qua BE test đã chạy lặp | — |
| Test Architecture | Completed | 100% | Hai suite TypeScript, launcher, gates và timeline Resource Timing đã kiểm chứng | — |
| Test Implementation | Completed | 100% | Nghiệm thu Phase 4B và hoàn tất hai Browser suites thuộc phạm vi FE | — |
| Execution | Completed | 100% | Hai lượt chạy 5 mẫu qua BE test, lượt sau có timeline đồng hồ Chromium | — |
| Analysis & Optimization | Completed | 100% | Đối chiếu timeline với source, ghi hướng tối ưu và cách đo lại | — |
| Handover | Completed | 100% | Chủ phạm vi FE nghiệm thu baseline tham chiếu, có runbook và bằng chứng chạy | — |

## Browser login local

k6 v2.4.0, Chrome headless, Vite preview HTTPS. Smoke đạt 1/1 check, thời gian form sẵn sàng 7,38 giây. Pilot chạy tuần tự với 1 VU đạt 5/5 check, 0 lượt bị bỏ và 0/90 request trình duyệt thất bại. Trung vị form sẵn sàng 1,42 giây, p95 là 1,70 giây. LCP trung vị 376 ms, CLS 0. Số mẫu ít và có chênh lệch giữa smoke và pilot. Chưa xác định nguyên nhân chênh lệch hoặc ngưỡng hiệu năng. Bài đo chỉ mở form, nên không diễn giải INP.

## Phase 4B qua BE thật

Browser local mở production build và dùng cấu hình API hiện có. Lần đầu đăng nhập và danh sách đạt, check đăng xuất đọc kết quả trước khi có response xác nhận. Phiên bản cuối đợi đúng response POST đăng xuất, qua TypeScript type-check và chạy với 1 VU đạt 3/3 checks, 0/120 request trình duyệt thất bại và 0 lượt bị bỏ. Đăng nhập đến khi màn Processing hiện mất 1,44 giây. Mở URL danh sách đến khi thấy thẻ và xác nhận HTTP 200 mất 5,66 giây. Lượt kiểm chứng trước đó ghi 3,87 giây cho danh sách. Kết quả xác nhận smoke chạy được. Tổng hợp timing tùy chỉnh của API có mẫu 0 ms nên chưa dùng để kết luận latency riêng từng endpoint.

## Phase 5 — Baseline ban đầu

Ngày 2026-11-21, k6 v2.4.0, Chromium headless, FE production build qua Vite HTTPS preview local, BE thật theo cấu hình FE, 1 VU và 5 lượt tuần tự trong 55,6 giây. Kết quả 5/5 lượt, 20/20 checks, 0 lượt bỏ/gián đoạn, 0/596 request trình duyệt thất bại theo k6. Resource Timing thay cách đọc timing cũ. Tổng cộng ghi 85 mẫu fetch/XHR hợp lệ trên trang danh sách.

| Phép đo | Số mẫu | Trung vị | P95 hoặc khoảng quan sát |
|---|---:|---:|---:|
| Đăng nhập đến màn Processing | 5 | 1,40 s | p95 1,85 s |
| Mở URL danh sách đến thẻ dự án | 5 | 3,81 s | p95 5,45 s |
| GET /projects | 5 | 500,3 ms | 460,5–726,3 ms |
| GET /workspaces | 5 | 455,1 ms | 413,2–695,9 ms |
| GET /workspaces/{id}/members | 50 | 525,35 ms | 489,7–974,2 ms |
| GET /projects/{id}/members | 10 | 514,0 ms | 493,9–838,1 ms |
| GET /projects/{id}/datasets | 10 | 465,4 ms | 443,4–753,6 ms |
| GET /users/me | 5 | 324,1 ms | 291,4–620,7 ms |

Các request có thể chạy chồng lấp. GET /projects riêng lẻ nhanh hơn thời gian tới thẻ, còn lời gọi members chiếm 50/85 mẫu theo dõi. Cần timeline theo từng lượt để xác định nhóm request nào nằm trên đường chờ và tách thời gian render. P95 từ 5 lượt chỉ có tính mô tả pilot. Chưa xác nhận SLO hay thu telemetry nội bộ BE.

## Chuẩn bị phân tích Phase 6

Đọc lại source tại HEAD `054a699`: khi mở danh sách Management, provider đợi `loadCore()` hoàn tất mới cấp store đã tải. Store đợi danh sách workspace rồi mới tải index dự án, sau đó phân công tối đa ba workspace song song. Trong từng workspace, store đợi danh sách thành viên, rồi duyệt dự án tuần tự. Hai request thành viên dự án và dataset của cùng dự án chạy song song. Store publish danh sách sau khi các nhánh tải đã hoàn tất. Các API members có thể phân trang; tổng 50 mẫu trong pilot chưa đủ để suy ra số workspace duy nhất.

Giả thuyết cần kiểm chứng là chuỗi request tuần tự qua từng nhóm workspace làm tăng thời gian đến thẻ đầu tiên. Log hiện chỉ giữ duration từng request nên chưa xác định được mức chồng lấp. Lần đo tiếp theo cần `startTime` và `responseEnd` cùng mốc với thời điểm ghi nhận thẻ hiển thị trong trang, đồng thời chỉ ghi route mẫu. Khoảng sau response core cuối đến thời điểm ghi nhận thẻ bao gồm xử lý dữ liệu, cập nhật state, render và độ trễ quan sát của test. Đây là giới hạn của phép đo, chưa thể quy cả khoảng đó cho render.

[Luồng tải và publish danh sách](../../src/services/management/management.store.ts#L229) · [Điểm provider mở dữ liệu cho UI](../../src/views/application/management-data-provider.tsx#L71)

## Phase 5 — Timeline kiểm chứng

1 VU, 5 lượt tuần tự, k6 v2.4.0 trên bản FE production local nối BE test đã duyệt. Hoàn tất 5/5 lượt trong 55,9 giây, 20/20 checks pass, 0/596 request trình duyệt bị k6 đánh dấu thất bại, 0 drop và 0 gián đoạn. Thời gian từ mở URL đến sẵn sàng có trung vị 3,84 giây và p95 mô tả 5,38 giây. Đăng nhập có trung vị 1,67 giây. Lần baseline trước đo trung vị 3,81 giây cho mở danh sách.

Các mốc sau dùng đồng hồ Resource Timing của document, tính bằng ms sau navigation. Mỗi lượt có 17 request API theo dõi. Response cuối quan sát được ở mọi lượt là một request thành viên workspace.

| Lượt | GET /projects hoàn tất | Response members cuối | Test quan sát thấy thẻ | Khoảng sau response cuối |
|---:|---:|---:|---:|---:|
| 1 | 2379 | 5636 | 5755 | 119 |
| 2 | 1614 | 3773 | 3870 | 97 |
| 3 | 1654 | 3794 | 3887 | 93 |
| 4 | 1671 | 3795 | 3890 | 95 |
| 5 | 1877 | 4064 | 4154 | 90 |

## Phase 6 — Kết luận và đề xuất

- Index dự án đã về trước khi test thấy thẻ khoảng 2,23–3,38 giây. Response members cuối còn cách thẻ 90–119 ms. Kết quả phù hợp với source, nơi provider đợi cả lần tải core trước khi công bố danh sách. Khoảng 90–119 ms còn gồm xử lý dữ liệu, cập nhật state và thời gian script quan sát. Browser timing không cho biết thời gian query hay worker của BE.
- Ưu tiên đề xuất cho một thay đổi FE riêng là công bố thẻ từ dữ liệu tối thiểu rồi tải members hoặc dataset bổ sung theo nhu cầu. Trước khi thử, đối chiếu trường nào dùng để lọc, kiểm quyền, đếm số lượng hoặc dựng thẻ để giữ hành vi hiện tại. Tăng số request song song có thể giảm số đợt chờ nhưng làm tăng tải đồng thời lên BE, nên cần phối hợp nếu cân nhắc hướng đó.
- Với thay đổi FE được duyệt, so trước/sau bằng cùng fixture, build profile, Chrome và quy trình 1 VU. Đối chiếu thời gian đến thẻ, số request trước thẻ, checks và lỗi. Chốt mục tiêu với người phụ trách FE trước khi dùng số đo làm gate. Mỗi run chỉ có 5 mẫu nên p95 hiện là số tham chiếu, chưa đủ để đặt SLO.

## Phase 7 — Nghiệm thu và bàn giao

`yarn typecheck:perf` đã pass trên worktree. `k6 inspect` với dữ liệu giả xác nhận cả hai entrypoint dùng Chromium và 1 VU, login mặc định chạy một lượt và projects nhận cấu hình năm lượt. Cả hai giữ gate checks 100% và zero dropped iterations. Bằng chứng chạy Browser thật nằm ở các mục Phase 4B và Phase 5.

Ngày 2026-11-21, chủ phạm vi FE xác nhận nghiệm thu theo baseline tham chiếu. Bản tổng hợp đã lọc nằm trong tài liệu này, cùng [runbook thực thi](09-EXECUTION-GUIDE.md). Người vận hành là chủ phạm vi FE. Các lượt đã chạy là bằng chứng bàn giao do Codex thực hiện. Chưa có lượt chạy độc lập của người nhận. Mục tiêu latency, tối ưu sản phẩm, CI định kỳ và bài tải HTTP hoặc hybrid là hạng mục riêng cần chốt khi có nhu cầu. Hai suite hiện áp dụng gate chức năng và số lượt bị bỏ.

[Roadmap](06-IMPLEMENTATION-ROADMAP.md) · [Open Questions](08-RISKS-AND-CONSTRAINTS.md)

## Phase 4 và 5 — Hiển thị thẻ dự án theo hai giai đoạn

FE công bố thẻ sau khi lấy index dự án và workspace. Fallback danh sách theo workspace vẫn dùng khi index trả 404. Dataset và thành viên tải cho các thẻ trong trang hiện tại. Khi sắp xếp theo số bản ghi, metadata dataset tải cho tất cả kết quả lọc để giữ thứ tự giữa các trang. Wizard gọi roster workspace khi đến bước chọn thành viên. Quyền thao tác chỉ dùng sau khi roster dự án được xác nhận.

k6 Browser chạy 5 lượt tuần tự với 1 VU qua Chromium, Vite HTTPS preview và BE test đã duyệt. Hoàn tất 5/5 lượt, 25/25 checks, 0 lượt bỏ hoặc gián đoạn và 0/470 request trình duyệt lỗi.

| Chỉ số | Baseline | Sau thay đổi |
|---|---:|---:|
| Thời gian đến thẻ, trung vị (5 mẫu) | 3,84 s | 2,91 s |
| Thời gian đến thẻ, p95 (5 mẫu) | 5,38 s | 8,67 s |
| Thời gian đến thẻ, khoảng min–max theo k6 | — | 2,39–10,10 s |
| Thời gian đến khi dữ liệu thẻ đang hiển thị sẵn sàng, trung vị (5 mẫu) | — | 3,65 s |
| Thời gian đến khi dữ liệu thẻ đang hiển thị sẵn sàng, min–max theo k6 | — | 3,08–10,16 s |
| API theo dõi hoàn tất trước lúc quan sát thấy thẻ, trung vị mỗi lượt | 17 | 4 |
| API theo dõi trên trang danh sách mỗi lượt | 17 | 8 |
| Browser request đã phát đến lúc thấy thẻ, trung vị (khoảng) | — | 50 (48–50) |
| Browser request đã phát đến lúc dữ liệu thẻ sẵn sàng, trung vị (khoảng) | — | 50 (48–50) |

Các số đếm API trước mốc quan sát lần lượt là 8, 4, 4, 3 và 4. Số đếm browser gồm tài nguyên frontend và request đã phát, còn số API trước thẻ chỉ tính response theo dõi đã hoàn tất. Vì vậy hai loại số đếm có thể khác nhau. Kịch bản browser đo từ lúc mở URL danh sách, còn số request trình duyệt lỗi bao phủ cả lượt gồm đăng nhập và đăng xuất.

Trung vị đến thẻ giảm 0,93 s. P95 tăng và một lượt mất khoảng 10 s. Trong lần chạy này có tiến trình build hoặc test cục bộ chạy chồng lấp, nên số đo tail cần được xác nhận trên runner riêng trước khi dùng làm mốc nghiệm thu hiệu suất. K6 ghi log Chromium bị kết thúc lúc đóng browser, đồng thời báo đủ 5 lượt và exit code 0. Chưa đặt SLO từ đợt đo này.

Các test bổ sung kiểm chứng thẻ trong lúc chờ dataset và roster, retry dataset độc lập, hủy scope, bỏ response tới muộn sau khi xóa và giới hạn quyền Viewer. Build và type-check k6 pass. Lần chạy Management/Preview ban đầu có 303 test pass, một lỗi theme đã ghi nhận trước thay đổi và hai timeout. Test wizard pass khi chạy riêng. Suite admin pass 5/5 với timeout chẩn đoán 15 s trên CLI. Kịch bản BE thật chỉ kiểm tra luồng đọc danh sách và vòng đời đăng nhập/đăng xuất.
