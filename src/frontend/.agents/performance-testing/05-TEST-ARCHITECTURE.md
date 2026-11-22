# Kiến trúc test đề xuất

Dùng TypeScript cho k6 Browser tại `src/frontend/tests/performance/`. Tài liệu hiện nằm tại `src/frontend/.agents/performance-testing/`. Các module HTTP, auth ở mức giao thức và test ghi dữ liệu trong bảng chỉ là thiết kế tham chiếu nếu có kế hoạch phối hợp riêng với BE.

| Thành phần dự kiến | Trách nhiệm |
|---|---|
| `frontend/package.json`, `frontend/yarn.lock`, `tests/performance/tsconfig.json` | Dùng chung TypeScript và cài `@types/k6` ở frontend. Lệnh `yarn typecheck:perf` dùng cấu hình strict riêng cho các suite k6. |
| `config/environments.ts`, `config/workload.ts`, `config/thresholds.ts` | Parse input, allowlist host, profile theo môi trường, cap và ngưỡng theo tag; giữ version và trạng thái duyệt của workload/target. |
| `suites/browser/login.ts`, `suites/browser/projects.ts` | Entrypoint Browser theo thứ tự triển khai. Mỗi suite tự đóng page/context trong finally, dùng locator xác nhận trải nghiệm. |
| `suites/http/{smoke,load,stress,spike,soak,breakpoint}.ts` | Entrypoint theo mục đích test. Ghép scenario và options từ config thay vì copy nghiệp vụ. |
| `scenarios/browser/`, `scenarios/http/` | Điều hướng, browse, đọc dữ liệu, upload, job. Trả outcome có kiểu để suite đếm check và transaction. |
| `fixtures/`, `data/` | Fixture CSV synthetic, manifest ID/role/sizes, bộ dữ liệu versioned. Account secrets được inject khi chạy. |
| `lib/auth.ts`, `lib/http.ts`, `lib/checks.ts` | Bearer và refresh theo VU, route tag ổn định, timeout, expected status, kiểm tra envelope, file, cursor và negative cases. |
| `lib/metrics.ts`, `lib/reporting.ts` | Counter/Rate cho luồng, Trend cho ready và completion, metadata run, summary và artifact đã lọc. |
| `reports/`, `dist/` | Kết quả/bundle tạo lúc chạy, lưu dưới thư mục run ID được ignore hoặc CI artifacts, retention bằng policy. |

## TypeScript và runtime

k6 hỗ trợ transpile `.ts` trực tiếp theo mặc định từ v0.57. Chọn phiên bản cụ thể có browser module tương thích, rồi pin local/CI. Native transpile sẽ bỏ type annotations. **Type-check riêng vẫn bắt buộc**. Module nội bộ đi bằng import tương đối, dùng `k6/http` và `k6/browser` đúng runtime. Khi cần npm package thuần JS tương thích k6 hoặc phân phối artifact, bundle từng entry bằng esbuild `--platform=neutral --format=esm --external:k6 --external:k6/*`. Verify fixture path trong native/bundle vì `open()` phụ thuộc đường dẫn. Không import Node built-ins hoặc Axios adapter từ FE; chỉ dùng subset types thuần đã xác nhận hoặc định nghĩa hợp đồng kiểm thử từ OpenAPI/DTO. [TypeScript native](https://grafana.com/docs/k6/latest/using-k6/javascript-typescript-compatibility-mode/) · [k6 modules](https://grafana.com/docs/k6/latest/using-k6/modules/)

## Quy tắc vòng đời

- Imports ở đầu, rồi options và thresholds, data init, setup, VU workload, teardown khi có tài nguyên cần thu hồi. Dùng `SharedArray` cho manifest hoặc dataset lớn, đọc file ở init. Browser login không cần data array hay setup rỗng.
- Setup dành cho validation và chuẩn bị dùng chung được phép. Mỗi VU nhận danh tính riêng, cache token trong VU, refresh theo expiry và tránh dùng chung token. Kiểm tra đủ danh tính trước khi tăng tải. Tách số lần login/refresh và warm-up khỏi metrics giao dịch chính.
- HTTP sử dụng name/tag theo template, `endpoint`, `scenario`, loại fixture cardinality thấp. Cấm gắn raw IDs, token, email vào tag và báo cáo. Đặt timeout điều hướng, HTTP, job và graceful stop theo contract/baseline.
- Một check phục vụ chẩn đoán. Threshold hoặc cổng báo cáo đã kiểm nghiệm quyết định pass/fail. Assertion auth và status phải đúng mục đích của từng suite. Giữ định nghĩa transaction và cách đếm ở [Requirements](03-PERFORMANCE-REQUIREMENTS.md).
- Teardown chỉ xóa fixture thuộc run đã chấp thuận, idempotent. Có quy trình owner xác định run còn sót khi runner dừng đột ngột. Read-only suite không cần cleanup DB.

[Execution guide](09-EXECUTION-GUIDE.md)
