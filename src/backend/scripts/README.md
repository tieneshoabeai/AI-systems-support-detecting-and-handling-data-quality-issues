# Kịch bản vận hành & Bảo trì

Các kịch bản (script) phục vụ vận hành, kiểm thử, đo hiệu năng (benchmark) và bảo trì mã nguồn. Phần lớn là **codemod** — chạy một lần trong quá trình tái cấu trúc, không phải chạy hằng ngày.

> Mọi kịch bản đều nên chạy từ `src/backend` và dùng `pnpm exec tsx <tệp>` hoặc `node <tệp>` tùy loại.

---

## 1. Kiểm tra kiến trúc

| Kịch bản | Công dụng | Dùng khi nào |
|---|---|---|
| `check-api-coverage.cjs` | Đối chiếu hợp đồng API §3.13 với mã nguồn | Trước khi hợp nhất (merge), sau mỗi thay đổi tuyến đường |
| `extract-routes.cjs` | Trích danh sách tuyến từ controller | Sinh tài liệu hợp đồng |
| `list-cross-module-imports.ts` | Liệt kê import chéo giữa các mô-đun | Phát hiện vi phạm CA8 |
| `generate-arch-baseline.ts` | Sinh đường cơ sở kiến trúc (`test/fixtures/arch-baseline.json`) | Sau khi tái cấu trúc có chủ đích |
| `verify-di-graph.ts` | Xác nhận đồ thị phụ thuộc DI | Khi thêm mô-đun/provider |
| `status-audit.cjs` | Tổng hợp trạng thái các mục trong danh sách kiểm tra | Theo dõi tiến độ |

Lệnh bao ngoài của các kịch bản này cũng được gọi qua `pnpm`:

```bash
pnpm arch:api-coverage
pnpm arch:cross-imports
pnpm arch:baseline
pnpm arch:verify-di
```

---

## 2. Codemod & Tái cấu trúc

Các kịch bản này **tự động sửa mã nguồn**. Luôn xem lại bằng `git diff` trước khi chốt (commit), và chạy trên nhánh riêng trước.

| Kịch bản | Tác dụng |
|---|---|
| `codemod-domain-error.mjs` | Chuyển `throw new Error` thành `DomainError` có mã lỗi |
| `normalize-domain-error-classes.mjs` | Chuẩn hoá lớp lỗi domain |
| `codemod-test-domain-error.mjs` | Sửa assertion trong kiểm thử theo lỗi mới |
| `codemod-test-assertions-multiline.mjs` | Định dạng assertion kiểm thử xuống nhiều dòng |
| `dedupe-test-error-imports.mjs` | Loại import trùng lặp trong kiểm thử |
| `cleanup-nestjs-exception-imports.mjs` | Loại import `HttpException` thừa |
| `cleanup-presentation-error-imports.mjs` | Dọn dẹp import lỗi ở tầng trình bày |
| `cleanup-unused-error-code-imports.mjs` | Loại import mã lỗi không dùng |
| `fix-http-status-regression.mjs` | Sửa hồi quy (regression) trạng thái HTTP |
| `fix-test-import-paths.mjs` | Sửa đường dẫn import trong kiểm thử |
| `split-commands-queries.ts` | Tách handler thành command / query |
| `wire-handlers.ts` | Gắn provider + controller gọi handler |
| `rebase-handler-imports.ts` | Chuẩn hoá import của handler |
| `map-handler-to-service.ts` | Sinh bảng ánh xạ handler → service |
| `add-explicit-return-types.ts` | Thêm kiểu trả về tường minh |
| `fix-shared-app-files.ts` | Sửa tệp trong `shared/application` |
| `update-module-index.py` | Cập nhật `modules/index.ts` (hợp đồng công khai) |
| `update-tests-for-handlers.py` | Sinh/sửa kiểm thử theo handler mới |
| `generate-test-handlers.py` | Sinh kiểm thử handler mẫu (boilerplate) |
| `cleanup-old-services.py` | Xoá service đã thay thế |
| `restore-step4-modules.py` | Khôi phục mô-đun ở bước 4 |
| `_refactor_b1.py` | Tái cấu trúc B1 |

---

## 3. Hạ tầng & Dịch vụ

| Kịch bản | Công dụng |
|---|---|
| `test-infra-up.sh` | Khởi động MongoDB replica set + Redis + MinIO cho kiểm thử |
| `test-infra-down.sh` | Tắt và dọn dẹp hạ tầng kiểm thử |
| `verify-external-services.ts` | Kiểm tra dịch vụ bên ngoài (Mongo, Redis, S3) có hoạt động không |
| `bootstrap-database.ts` | Tạo collection + chỉ mục cần thiết |
| `seed-initial-data.ts` | Nạp dữ liệu mẫu |
| `migrate-coerce-and-orphans.ts` | Ép kiểu dữ liệu & dọn bản ghi mồ côi |
| `backup-mongo.sh` / `restore-mongo.sh` | Sao lưu / khôi phục MongoDB |
| `backup-storage.sh` | Sao lưu kho lưu trữ |
| `generate-ssl-certs.sh` | Sinh chứng thư SSL tự ký |
| `install-cloudflared.sh` | Cài đặt cloudflared |
| `start-cloudflare-tunnel.sh` | Khởi động Cloudflare Tunnel |
| `perf-report.sh` | Tổng hợp báo cáo hiệu năng |

---

## 4. Đo hiệu năng (Benchmark)

| Kịch bản | Công dụng |
|---|---|
| `benchmark/` | Thư mục các kịch bản đo hiệu năng mô hình AI |
| `lib/` | Tiện ích dùng chung cho benchmark |

```bash
pnpm bench:models    # Chạy đo hiệu năng mô hình
pnpm bench:gold      # Mô tả bộ dữ liệu vàng
pnpm bench:stats     # So sánh kết quả giữa các mô hình
pnpm bench:pareto    # Phân tích đường Pareto
```

---

## 5. Lưu ý khi chạy codemod

1. **Làm việc trên nhánh riêng** — không chạy trực tiếp trên nhánh chính.
2. **Chốt/sao lưu trước khi chạy** — để khôi phục (rollback) được.
3. **Xem lại `git diff` sau khi chạy** — codemod có thể sửa sai chỗ.
4. **Chạy `pnpm type-check && pnpm lint && pnpm test`** ngay sau đó.
5. **Không chạy codemod lặp lại** trên mã nguồn đã qua codemod — dễ sinh thay đổi sai ở lần thứ hai.
