# `test/unit/` — Unit + Architecture (77 file, không cần hạ tầng)

Thư mục này chứa toàn bộ test **chạy được mà không cần Mongo/Redis/MinIO thật**. Mọi dependency bên ngoài đều bị mock/fake. Chạy nhanh, chạy song song nhiều worker.

## Chạy thế nào

```bash
# từ src/backend/
npx jest test/unit --no-coverage
npx jest test/unit/datasets --no-coverage
npx jest test/unit/arch --no-coverage   # đủ 9 file arch
pnpm test        # unit + arch (mặc định, bỏ integration + e2e)
pnpm test:unit   # chỉ unit, ignore 5 spec arch nặng
pnpm test:arch   # chỉ 5 spec arch (xem lưu ý bên dưới)
```

Lưu ý: `pnpm test:arch` trong `package.json` chỉ chạy **5/9 file**: `zero-any|guard-coverage|zod-openapi|clean-architecture|api-contract-coverage`. Muốn đủ 9 file phải chạy `npx jest test/unit/arch`.

## 14 thư mục con = 14 nhóm trách nhiệm

| Thư mục | Số file | Test cái gì |
|---|---|---|
| `analysis/` | 19 | Guard chống quá tải (GĐ0/GĐ8/GĐ9/GĐ10/GĐ12), GĐ2 missing-token (6 describe), GĐ7 vai trò cột, wave5 DQ-01→DQ-04, wave6-10 AN-14→AN-45, PDF, report-content, đợt K (AK-01→AK-07), route `/result` + audit (VAT-06/07); `vqd-port/` 6 file port đợt A–I |
| `arch/` | 9 | Luật kiến trúc CA1–CA14, MM5+MM6, guard-coverage, zero-any, contract-coverage, session, OPEN-09 (2 file), OPEN-10, zod-openapi |
| `auth/` | 2 | Bootstrap admin OPEN-01 (+ RegisterSchema cấm `role`), Google OAuth PKCE+state |
| `datasets/` | 10 | CSV delimiter, PII heuristic, findings, entity (7 describe), ingestion streaming, wave4, data-view, ép kiểu (2 describe), chart (2 describe), schema Swagger |
| `feedback/` | 4 | Entity (5 describe) + wave7 FB-01→FB-06 + v14 FBT-01→FBT-11 (6 describe) + khuôn mẫu RAG FST-01 |
| `infra/` | 8 | Event-dispatcher, storage dual-mode, storage-cleanup (3 describe), group1 Redis/Kafka/PDF, ai-worker (2 describe), ai-adapter+outbox (3 describe), report-worker, email-push (6 describe) |
| `issues/` | 1 | Entity IssueReport (6 describe) |
| `notifications/` | 1 | Entity Notification (4 describe) |
| `projects/` | 2 | Entity (8 describe) + service (1 project = 1 dataset) |
| `realtime/` | 3 | Gateway Socket.IO, revocation OPEN-08 (4 describe), envelope+room |
| `shared/` | 8 | CASL, crypto, mask-pii, keyset cursor (6 describe), record-keyset-cursor, device-detector, domain-error (+error-mapping), policies-guard |
| `users/` | 2 | Entity User (8+ describe) + UserSession (6 describe) |
| `workflows/` | 6 | Test liên module: cascade-delete (4 describe), gap P2/P3, step1-services, step3-efgh (7 describe), step1-remember-me (5 describe), notif-wave6 (3 describe) |
| `workspaces/` | 3 | Entity + service CRUD/members + invite-email (WS-01/WS-07/quota) |

Mỗi thư mục có README riêng — mở README trong thư mục đó để biết từng file `describe` gì (chép nguyên văn từ code).

## Quy ước chung

- Handler: fake repository/port (success/null/throw/conflict), assert cả output **và** tác vụ ghi/phát event bị cấm.
- Hàm thống kê/crypto: thuật toán thật + đáp án tính tay, không mock chính hàm đang test.
- `fakeTransaction()` trong `../helpers/transaction.ts` thay cho Mongo replica set.
- File `*.spec.ts` khớp `testRegex: .*\.spec\.ts$` nên `pnpm test` tự nhặt. File e2e tên `*.e2e-spec.ts` nên **không** bị nhặt nhầm.
