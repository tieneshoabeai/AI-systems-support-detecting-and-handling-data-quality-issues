# Phân tích hệ thống hiện tại

## Phạm vi và nguồn

`src/frontend` là phần bạn có quyền thay đổi sau khi duyệt. Toàn bộ nhận định về `src/backend` trong tài liệu này phục vụ việc hiểu request, response, quyền và luồng dữ liệu FE sử dụng. Script và hạ tầng BE được ghi nhận để tham khảo. Xác nhận runtime, cấu hình và telemetry BE thuộc người phụ trách BE/DevOps.

Khảo sát working tree tại nhánh có HEAD `054a699`. Working tree có các thay đổi sẵn, nhất là backend, nên kết luận source được ghi theo trạng thái khảo sát và cần lưu lại revision triển khai khi chạy. Nguồn chính gồm [README repo](../../../../README.md), [README FE](../../README.md), [README BE](../../../backend/README.md), [package FE](../../package.json) và [package BE](../../../backend/package.json). Khi mô tả README và code khác nhau, dùng code hiện hành để lập plan, rồi xác nhận trên môi trường test.

| Lớp | Bằng chứng trong source | Ý nghĩa khi đo |
|---|---|---|
| Frontend | TypeScript, React, Vite, React Router, Axios, React Query, React Three Fiber. `src/app` quản lý router và guards, `views` và `components` dựng UI, `services` và `repositories` xử lý nghiệp vụ và dữ liệu, `graphics` chứa đồ họa. Package khai báo Yarn 1.22.22 và có build `tsc -b && vite build`. | Dùng bản production build. Đo route công khai và route có phiên. Giữ browser, viewport, cache và máy chạy giống nhau giữa các lần đo. |
| API client | [API config](../../src/configs/api.config.ts) ghép origin và prefix Vite, timeout mặc định 30 giây. [Axios adapter](../../src/lib/axios-client.ts) hỗ trợ timeout riêng và gắn Bearer theo session, đọc envelope. | Script HTTP có timeout rõ ràng và assertion contract. k6 chạy trên runtime riêng, nên lấy hợp đồng từ client hiện có thay vì import nguyên Axios adapter. |
| Auth và quyền | [Session coordinator](../../src/services/auth/session-coordinator.ts) phục hồi phiên, xác thực profile và refresh. [JWT strategy](../../../backend/src/modules/auth/infrastructure/auth/jwt.strategy.ts) đọc Bearer. Guard và policy ở từng controller, route admin yêu cầu role admin. | Fixture tách danh tính theo VU, gắn ID đúng quyền, đo refresh riêng. Kịch bản từ chối quyền là kiểm tra riêng khỏi happy path. |
| Backend | NestJS, Express, Zod, Swagger, Mongoose. `src/modules` tổ chức presentation, application, domain và infrastructure. [Bootstrap](../../../backend/src/main.ts) đặt prefix, CORS, envelope và Swagger. [App module](../../../backend/src/app.module.ts) có throttler toàn cục, request ID, Mongo, outbox và các module nghiệp vụ. | Ghi riêng HTTP 429 để phân biệt chính sách giới hạn và quá tải. Source đặt mặc định 200/60s, login override 100/giờ, cần xác minh tracking key và giá trị runtime trước khi chốt tải. |
| Data, cache và storage | [Mongo module](../../../backend/src/shared/infrastructure/database/database.module.ts) cấu hình Mongoose maxPoolSize 20 trong source. Có index project và dataset records, Redis adapter cho Socket.IO khi cấu hình, fallback bộ nhớ. README mô tả object storage và local fallback. | Thu connection pool và query time. Chỉ đưa Redis vào phân tích khi môi trường bật. Vai trò Redis ở adapter realtime chưa chứng minh có HTTP response cache. Ghi rõ storage mode. |
| Xử lý nền | Backend có worker entry point, outbox và Kafka publisher/consumer theo cấu hình, có nhánh in-process. Analysis có worker và report/PDF. | Ghi mode worker, queue transport, storage và model vào báo cáo. Xác nhận cấu hình runtime từ DevOps. |
| Docker và CI | [Dev compose](../../../backend/deploy/docker-compose.dev.yml) khai báo Mongo, Redis, Ollama. [Test compose](../../../backend/deploy/docker-compose.test.yml) khai báo Mongo, Redis, MinIO. Không thấy workflow CI trong tập file tracked đã rà; pipeline ngoài repo chưa xác minh. | Có thể tái sử dụng topology test sau khi xác minh isolation và thông số. Kế hoạch CI bắt đầu từ manual job. |

Các module nghiệp vụ đã rà gồm auth/users, workspaces/projects, overview, datasets/data-view, analysis/summary/report, feedback, issues, notifications, audit và realtime. Đường dẫn, quyền và phụ thuộc chính nằm trong [API Inventory](02-API-INVENTORY.md). Danh mục REST bao quát controller HTTP đã đối chiếu. Socket.IO, worker và hạ tầng được xét như phụ thuộc của luồng đo.

## Tái sử dụng và khoảng trống

| Hiện có | Tái sử dụng | Việc cần xây |
|---|---|---|
| Vitest, Playwright và E2E auth/workspace/project | Căn cứ selector, điều kiện ready, quyền và dữ liệu mẫu. Kiểm tra lại E2E chạy dev hay build trước khi lấy số liệu. | Browser suite k6 chạy build production, xác minh đúng route và dữ liệu rồi thu Web Vitals. |
| [BE smoke](../../../backend/test/k6/smoke.js), [BE stress](../../../backend/test/k6/stress.js), `test:perf`, [perf-report.sh](../../../backend/scripts/perf-report.sh) | Tag ý đồ nghiệp vụ, health, upload template và mẫu xuất log để tham khảo. | Stress dùng các mức 50/20/10 VUs chưa có căn cứ trong plan, có token dùng chung và gọi `/analysis/run` khác `POST /projects/{projectId}/analysis`. Check hiện chấp nhận một số status lỗi. Kiểm tra lại upload, auth, fixture và schema trước khi chuyển logic sang suite mới. |
| Swagger snapshot, BE DTO, fixtures và compose | Đồng bộ danh mục API, đối chiếu request và mô hình dữ liệu. Lấy quy trình seed an toàn sau khi duyệt quota. | Tách fixture synthetic và endpoint risk. Xây test IDs, telemetry và baseline có thể tái lập. |
| Benchmark model và load utility hiện có | Có thể tham khảo khi điều tra phần inference. | Cần đo Browser, API và worker trên cùng timeline. Chưa xác nhận dashboard, traffic mix, SLO hay kết quả baseline. |

[Requirements](03-PERFORMANCE-REQUIREMENTS.md) · [Rủi ro và câu hỏi](08-RISKS-AND-CONSTRAINTS.md)
