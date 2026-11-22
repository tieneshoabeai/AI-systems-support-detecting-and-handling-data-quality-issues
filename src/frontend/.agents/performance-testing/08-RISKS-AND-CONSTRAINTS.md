# Rủi ro, ràng buộc và câu hỏi mở

## Ràng buộc

Bạn chỉ có quyền sửa `src/frontend`. BE là source chỉ đọc để hiểu luồng và schema. Mọi truy cập ngoài hành vi Browser bình thường của một luồng FE, như chạy k6 HTTP trực tiếp, cấp tài khoản hoặc seed dữ liệu BE, bật monitoring BE hay sửa cấu hình triển khai, cần owner có thẩm quyền duyệt riêng.

Chỉ thực thi test sau khi duyệt kế hoạch và môi trường cụ thể. Không tác động production hoặc shared env ngoài phê duyệt riêng. Fixtures dùng dữ liệu synthetic, không đưa PII/secrets vào version control, output hoặc chat. Không tự seed số lượng lớn, đổi API contract, bypass policy hoặc dọn dữ liệu ngoài run scope. Gắn thời điểm UTC, người phụ trách và thông số cap vào run manifest. Kết quả hiệu năng cần số đo thực.

| ID | Rủi ro | Dấu hiệu và xử lý | Owner đề xuất |
|---|---|---|---|
| R1 | Rate limit che capacity hoặc gây nhiều 429 | Xác nhận tracking key và gateway policy, so timeline 429 với quota. Đo behavior đúng chính sách. Nếu cần capacity sau limiter, yêu cầu profile môi trường riêng do owner phê duyệt. | BE/DevOps |
| R2 | Auth churn, hết token hoặc dùng chung identity | Phân bổ fixture đủ role/VU, refresh có kiểm soát, báo 401/403 riêng, hạn chế login burst. | QA/BE |
| R3 | Working tree hoặc OpenAPI trôi contract | Ghi revision và trạng thái local, so Swagger runtime với snapshot trước run, assert status/schema chính xác. | FE/BE |
| R4 | Generator/Chromium dùng hết CPU/RAM | Theo dõi máy tạo tải, so scheduled và started, tách Browser runner khi hybrid. | QA/DevOps |
| R5 | Seed/upload/analysis gây write, chi phí hoặc đối tượng sót | Giới hạn byte/job/run, storage và DB cô lập, stop rule, cleanup by run ID và TTL có duyệt. | BE/DevOps |
| R6 | Mongo query nặng hoặc pool hết | Thu pool wait, scans và query time; sampling có giới hạn. Không gán nguyên nhân chỉ từ TTFB. | BE/DB owner |
| R7 | p99 thiếu mẫu hoặc trộn ramp với steady | Báo số mẫu, giữ từng cửa sổ và tag theo route, lặp run nếu cần. | QA |
| R8 | Lộ thông tin qua log, query, HAR hoặc report | Redact ở nguồn, chỉ tag route templates, giới hạn quyền/retention artifact. | QA/DevOps |
| R9 | Local khác topology triển khai | Manifest ghi phiên bản, network, storage/worker, cache, fixture, quota; chỉ so cùng profile. | DevOps |
| R10 | Side effects qua email, realtime, worker và AI | Xác thực sink/test tenant, profile mặc định read-heavy; write jobs cần duyệt riêng. | BE/DevOps |

## OPEN QUESTIONS

| ID | Cần xác nhận | Owner | Chặn bước nào? |
|---|---|---|---|
| Q1 | Môi trường staging riêng, allowlist, dependency endpoints, người trực, cửa sổ chạy và quota an toàn? | DevOps | Phase 2 và mọi run từ load trở lên |
| Q2 | Traffic theo peak/normal, active sessions, transaction mix, think time, tần suất refresh và phân bố payload/dataset? | Product/BE | Chốt profile và SLO |
| Q3 | Chấp nhận P0/P1/P2 đề xuất, ngưỡng API, Browser budgets, recovery, drift và tolerance của actual workload? | Product/FE/BE | Release gate, stress/spike/soak |
| Q4 | Tài khoản synthetic theo role, workspace/dataset ID, cơ chế inject secret và quota seed/cleanup? | QA/BE | 4B và HTTP |
| Q5 | Gateway và throttler tính theo IP hay khóa khác? Có proxy/tunnel trước API không? | BE/DevOps | Chọn mức tải và phân tích 429 |
| Q6 | Monitoring hiện có, quyền đọc Mongo/server metrics, query time/APM và retention? | DevOps/DB owner | Phase 5 |
| Q7 | Duyệt package `src/frontend/tests/performance/`, k6 version, Chromium runner và CI platform? | Maintainers | Phase 2 |
| Q8 | Runtime Swagger/response có khớp snapshot cho API P0 và upload/job không? UI ready dùng locator nào? | FE/BE/QA | Nghiệm thu Phase 1 và Phase 4 |

[Tiến độ](PROGRESS.md) · [Runbook](09-EXECUTION-GUIDE.md)
