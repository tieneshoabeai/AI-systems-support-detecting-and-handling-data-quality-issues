# Kế hoạch Performance Testing với Grafana k6

**Phạm vi triển khai thuộc Frontend.** Bạn có quyền chỉnh `src/frontend` sau khi duyệt plan. Source `src/backend` do người khác phụ trách và được pull về để đọc luồng xử lý, hợp đồng API và schema. Thứ tự triển khai FE là **Browser login → Browser danh sách dự án**. HTTP API load và hybrid là luồng phối hợp riêng với người phụ trách BE/DevOps, cần họ xác nhận môi trường, phạm vi và quyền chạy.

| Câu hỏi | Bài đo |
|---|---|
| Form login xuất hiện và sẵn sàng sau bao lâu? | Chromium mở trang từ bản build production, đo Web Vitals và thời gian form sẵn sàng. |
| Sau khi đăng nhập, danh sách dự án có sẵn sàng để thao tác không? | Chromium đăng nhập bằng fixture và đo từ lúc bấm điều hướng đến khi danh sách đúng dữ liệu hiển thị. |
| Hệ thống có phục vụ được tải kỳ vọng và giữ được SLO không? | Tham chiếu cho BE/DevOps nếu có bài đo HTTP được họ phê duyệt. Báo cáo FE tập trung vào Web Vitals và thời gian thao tác. |
| Điểm suy giảm nằm ở lớp nào? | Đồng bộ các cửa sổ tải, đối chiếu request, queue, tài nguyên, query và Browser, lặp lại có kiểm soát. |

**Kết quả khảo sát tĩnh.** 86 operations khớp method/path giữa controller và OpenAPI snapshot. Backend đã có smoke/stress JavaScript, cần đối chiếu route và assertion trước khi tái sử dụng. Các SLO và thời lượng trong bộ tài liệu là đề xuất. Chưa có kết quả đo, traffic thực tế, năng lực tải hoặc SLO được phê duyệt.

| Tài liệu | Nội dung |
|---|---|
| [01](01-PROJECT-ANALYSIS.md) và [02](02-API-INVENTORY.md) | Kiến trúc, hiện trạng, hợp đồng và luồng nghiệp vụ |
| [03](03-PERFORMANCE-REQUIREMENTS.md) và [04](04-TESTING-STRATEGY.md) | Metrics, SLO, workload và sáu loại test |
| [05](05-TEST-ARCHITECTURE.md) và [06](06-IMPLEMENTATION-ROADMAP.md) | Kiến trúc test TypeScript và lộ trình |
| [07](07-ACCEPTANCE-CRITERIA.md) và [08](08-RISKS-AND-CONSTRAINTS.md) | Cổng nghiệm thu, rủi ro và câu hỏi cần chốt |
| [09](09-EXECUTION-GUIDE.md) và [PROGRESS](PROGRESS.md) | Cách chạy dự kiến, đọc báo cáo và trạng thái |

Giai đoạn hiện tại bàn giao thiết kế để review. Mọi cài đặt, script, thay đổi pipeline và bài đo thuộc giai đoạn triển khai sau khi duyệt.
