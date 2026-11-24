# `test/integration/` — 7 file: DB/Redis/MinIO thật (`--runInBand`)

Unit dùng fake (`fakeTransaction`) nên **không** chứng minh được rollback thật, query thật, upload thật. 7 file này chạy với hạ tầng thật để lấp lỗ hổng đó. Tất cả `describe` dưới đây chép nguyên văn từ code.

## Bắt buộc hạ tầng trước (chép từ `package.json` + `scripts/test-infra-up.sh`)

```bash
pnpm test:infra:up     # Mongo rs0 @27018 + Redis @6380 + MinIO @9002/9003 (đọc thật trong test-infra-up.sh: MONGO_PORT=27018, REDIS_PORT=6380, MINIO_PORT=9002, MINIO_CONSOLE_PORT=9003)
pnpm test:integration  # jest --config ./test/jest-integration.json --runInBand (timeout 60s, maxWorkers 1)
pnpm test:infra:down
```

Vì sao `--runInBand` + `maxWorkers: 1` (xem `jest-integration.json`)? Các suite dùng chung 1 DB test — chạy song song sẽ tranh nhau xóa collection.

## Triết lý skip (đọc trong `helpers/test-infra.ts`)

Hạ tầng chưa sẵn sàng → `describe.skip` + in cảnh báo, **không fail**. Không bao giờ có trạng thái xanh ảo. URI mặc định trong code: `mongodb://127.0.0.1:27018/?replicaSet=rs0`, `redis://127.0.0.1:6380`, `http://127.0.0.1:9002`.

## Từng file làm gì (`describe` thật trong code)

| File | `describe` thật | Chứng minh thật cái gì |
|---|---|---|
| `repositories.spec.ts` | `B2.3 — Mongoose repository trên MongoDB thật` | CRUD + soft-delete + phân trang trên Mongo thật |
| `repositories-domain.spec.ts` | `B2.4 — Mongoose repository trên MongoDB thật (nhóm 2)` | Repository domain (user/workspace/...) đọc/ghi thật |
| `repositories-analysis.spec.ts` | `B2.5 — AnalysisRepository trên MongoDB thật` | Lưu/đọc run/result/job thật |
| `record-query.spec.ts` | `B2.6 — RecordQueryRepository trên MongoDB thật` | Keyset + null-sorting trên Mongo thật (hàng triệu dòng vẫn nhanh) |
| `redis-minio.spec.ts` | `B2.5 — Redis thật` + `B2.5 — MinIO thật (StorageService chế độ CLOUD)` + `B2.5 — cấu hình hạ tầng` (3 describe trong 1 file) | Cache/lease/rate-limit + upload MinIO thật |
| `open09-transaction-rollback.spec.ts` | `B2.2 — OPEN-09: rollback THẬT trên MongoDB replica set` + `B2.2 — cấu hình hạ tầng` (2 describe trong 1 file) | Multi-document transaction rollback thật trên replica set (điều unit không làm được) |
| `cascade-delete.spec.ts` | `B2.3 — cascade xóa Workspace → Project → Dataset → Records` | Xóa workspace → project/dataset/records thật biến mất |

## Khi nào viết integration mới?

Chỉ khi cần chứng minh thứ unit không chứng minh được: transaction thật, query thật, adapter thật, streaming thật.
