# Tiêu chí nghiệm thu

## Review bộ thiết kế

- Có đủ 11 Markdown, liên kết nội bộ hợp lệ. Inventory đối chiếu đủ 86 operations, ghi nguồn method, path, auth và độ phủ schema. Luồng chiến lược tham chiếu đúng route trong inventory.
- Bộ thiết kế ghi thứ tự Browser login → Browser projects và có sáu loại test để tham chiếu khi phối hợp BE, kèm tiêu chí pass/fail, duration đề xuất và stop rule. SLO ghi trạng thái, workload thiếu dữ liệu có owner ở [Open Questions](08-RISKS-AND-CONSTRAINTS.md).
- Bộ thay đổi thiết kế chỉ gồm Markdown trong thư mục đã duyệt. Việc nghiệm thu hệ thống cần dữ liệu đo ở phase sau.

## Gate khi triển khai

Các gate API smoke, API load và vượt tải áp dụng khi BE/DevOps duyệt bài đo riêng. FE hoàn thành khi các gate môi trường, Browser login, Browser projects, repeatability và handover tương ứng đạt.

| Gate | Evidence cần có | Điều kiện đạt |
|---|---|---|
| Config và type-check | Log build/type-check, k6/Chromium version, config đã lọc | `tsc --noEmit` và smoke run pass. URL ngoài allowlist, biến bắt buộc thiếu hoặc fixture vượt cap bị từ chối trước khi chạy. |
| Browser login | URL, check status UI, số lượt và ready Trend | 100% lượt smoke thấy form visible/enabled. Browser baseline có giá trị FCP/LCP/CLS khi page emit và số mẫu. |
| Browser projects | Phiên test, điều hướng, kiểm tra dữ liệu fixture, ready Trend | Check đúng route và UI dữ liệu đã chốt, mỗi lượt thành công có một mẫu route-ready, flow failures được ghi. |
| API smoke | Run log và assertion chi tiết | Tất cả check bắt buộc pass. Đúng status và schema P0; 0 failed, interrupted và dropped nếu áp dụng. |
| Tính hợp lệ benchmark | Workload planned/actual, phiên bản, UTC windows, generator và telemetry | Khối steady và môi trường có thể nhận diện; đạt workload trong sai số đã duyệt; generator không bão hòa theo budget. Đánh dấu incomplete nếu thiếu metric bắt buộc, invalid nếu tải hoặc môi trường không hợp lệ. |
| API load | Báo cáo theo endpoint và business flow | p95, p99, error và check theo [mục tiêu đã duyệt](03-PERFORMANCE-REQUIREMENTS.md), so trong steady. Mọi SLO chưa duyệt chỉ ghi quan sát. |
| Khả năng vượt tải | Báo cáo stress, spike, soak, breakpoint | So recovery, drift, backlog, điểm suy giảm và stop cap với tiêu chí mỗi profile. Tách kết quả thí nghiệm khỏi trạng thái đạt SLO của sản phẩm. |
| Repeatability | Run manifest, baseline theo hai lần chạy trở lên, evidence ổn định | Đồng revision, fixture, topology, profile và cache. Nếu biến thiên vượt budget đã duyệt, thu thêm mẫu và ghi nguyên nhân/độ bất định. |
| Handover | Runbook, báo cáo, owner và log rehearsal | Người nhận tự chạy một smoke, tìm artifact và đọc được nguyên nhân nếu check/threshold fail. |

Báo cáo có thể là `pass`, `fail`, `invalid` hoặc `incomplete`. Chỉ dùng pass/fail hiệu năng cho run hợp lệ đã có mục tiêu phê duyệt. Có thể nói smoke pass khi check chức năng đạt, độc lập với đánh giá sức tải.
