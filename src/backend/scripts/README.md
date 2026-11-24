# Scripts — Vận Hành, Kiểm Thử, Benchmark Và Bảo Trì

Thư mục `src/backend/scripts/` chứa khoảng 44 script và 2 thư mục (`benchmark/`, `lib/`). Tất cả chạy từ `src/backend/`. Phần lớn là **codemod chạy một lần** trong đợt tái cấu trúc — không phải chạy hằng ngày.

> Quy tắc: chạy trên nhánh riêng, xem `git diff` trước khi commit, xong chạy `pnpm type-check && pnpm lint && pnpm test`.

---

## 1. Kiểm tra kiến trúc (6 script, có lệnh `pnpm` bọc ngoài)

| Script | Lệnh `pnpm` | Công dụng thật |
|---|---|---|
| `check-api-coverage.cjs` | `pnpm arch:api-coverage` | Đối chiếu hợp đồng API với mã nguồn (controller/routes) |
| `extract-routes.cjs` | — | Trích danh sách route từ controller để sinh tài liệu hợp đồng |
| `list-cross-module-imports.ts` | `pnpm arch:cross-imports` | Liệt kê import chéo giữa các module (phát hiện vi phạm CA8) |
| `generate-arch-baseline.ts` | `pnpm arch:baseline` | Sinh `test/fixtures/arch-baseline.json` sau tái cấu trúc cố định |
| `verify-di-graph.ts` | `pnpm arch:verify-di` | Xác nhận đồ thị phụ thuộc DI khi thêm module/provider |
| `status-audit.cjs` | — | Tổng hợp trạng thái các mục checklist |

---

## 2. Hạ tầng và dịch vụ (12 script, dùng hằng ngày)

| Script | Công dụng thật |
|---|---|
| `test-infra-up.sh` | Bật hạ tầng test: Docker compose test nếu có daemon, không thì binary native (Mongo rs0 ở 27018, Redis ở 6380, MinIO ở 9002/9003) |
| `test-infra-down.sh` | Tắt cả 2 chế độ và xóa `minio-data` |
| `verify-external-services.ts` | Kiểm tra Mongo/Redis/S3 có sống không |
| `bootstrap-database.ts` | Tạo collection và index (`pnpm db:bootstrap`, `db:reset:*`) |
| `seed-initial-data.ts` | Nạp dữ liệu mẫu (`pnpm db:seed`) |
| `migrate-coerce-and-orphans.ts` | Ép kiểu dữ liệu và dọn bản ghi mồ côi (`pnpm db:migrate:*`) |
| `backup-mongo.sh` / `restore-mongo.sh` | Sao lưu / khôi phục MongoDB (`pnpm db:backup:mongo`, `db:restore:mongo`) |
| `backup-storage.sh` | Sao lưu kho lưu trữ (`pnpm db:backup:storage`) |
| `generate-ssl-certs.sh` | Sinh chứng thư SSL tự ký (`pnpm ssl:generate`) |
| `install-cloudflared.sh` / `start-cloudflare-tunnel.sh` | Cài đặt / chạy Cloudflare Tunnel (`pnpm tunnel*`) |
| `perf-report.sh` | Tổng hợp báo cáo hiệu năng staging (`pnpm test:perf:staging`) |

---

## 3. Codemod và tái cấu trúc (chạy một lần, không chạy lặp lại)

| Nhóm | Script |
|---|---|
| Lỗi domain | `codemod-domain-error.mjs`, `normalize-domain-error-classes.mjs`, `cleanup-presentation-error-imports.mjs`, `cleanup-unused-error-code-imports.mjs`, `cleanup-nestjs-exception-imports.mjs`, `dedupe-test-error-imports.mjs` |
| Test | `codemod-test-domain-error.mjs`, `codemod-test-assertions-multiline.mjs`, `fix-test-import-paths.mjs`, `fix-http-status-regression.mjs`, `fix-status-codemod.cjs` |
| Handler CQRS | `split-commands-queries.ts`, `wire-handlers.ts`, `rebase-handler-imports.ts`, `map-handler-to-service.ts`, `generate-test-handlers.py`, `update-tests-for-handlers.py` |
| Module | `update-module-index.py`, `fix-shared-app-files.ts`, `add-explicit-return-types.ts`, `cleanup-old-services.py`, `restore-step4-modules.py`, `_refactor_b1.py`, `measure-refactor.sh` |

---

## 4. Benchmark (`benchmark/` + `lib/`)

| Đường dẫn | Nội dung thật |
|---|---|
| `scripts/benchmark/` | `run-models.ts`, `compare-models.ts`, `describe-gold-set.ts`, `pareto.ts`, `gold-set.ts`, `models.ts`, `judge.ts`, `scorer.ts`, `stats.ts`, `prompt.ts`, `ram-guard.ts`, `http-client.ts`, `infra-error.ts`, `benchmark.spec.ts` |
| `scripts/lib/` | `cli-storage.ts`, `load-env.ts`, `ntfy-notifier.ts` (tiện ích dùng chung) |

```bash
pnpm bench:models    # chạy đo hiệu năng mô hình
pnpm bench:gold      # mô tả bộ dữ liệu vàng
pnpm bench:stats     # so sánh kết quả giữa các mô hình
pnpm bench:pareto    # phân tích đường Pareto
```

---

## 5. Lưu ý khi chạy codemod

1. Làm trên nhánh riêng, commit/sao lưu trước.
2. Xem `git diff` sau khi chạy — codemod có thể sửa sai chỗ.
3. Chạy `pnpm type-check && pnpm lint && pnpm test` ngay sau đó.
4. Không chạy lặp lại trên mã đã qua codemod.
