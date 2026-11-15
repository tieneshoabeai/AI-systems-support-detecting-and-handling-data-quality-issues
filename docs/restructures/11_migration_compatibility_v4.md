# 11. Chuyển đổi dữ liệu, tương thích và rollback

- **Version:** v4
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-05 (v4)
- **Trạng thái:** Đã chốt 15 quyết định migration và thiết kế chi tiết **17 collection cũ → 21 collection mới**, quy trình 8 bước cutover, công cụ `ts-node` 3 chế độ, quy tắc ánh xạ dữ liệu cho 11 collection, cơ chế rollback 3 mức, và bộ kiểm chứng. **v4 áp dụng 4 quyết định:** (1) chỉ `.csv` → **xoá `dataset_sheet`**, gộp cột vào `dataset`; (2) thêm `finding_feedback` + `feedback_example` (collection mới, không có nguồn migrate); (3) `outbox_event` chuyển sang **Kafka** + `processed_event`; (4) `ai_job` bổ sung `model_id`/`prompt_version` cho chạy model cục bộ. Còn mở ở mục 6.2.
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 11; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** tuân thủ bảng đối chiếu schema của **Phần 8 v4 mục 3.12**, quy tắc migration của **Phần 10 v4 mục 3.10.4**, quy trình deploy/rollback của Phần 10 mục 3.10.2–3.10.3, cơ chế optimistic locking của Phần 5 mục 3.9, mô hình quyền của **Phần 6 v5**, quy tắc soft delete + retention của Phần 8 v4 mục 3.11, và hạ tầng **Kafka/Socket.IO** của Phần 9 v3 + Phần 10 v4.

## 1. Mục tiêu

Thiết kế cách chuyển dữ liệu hiện có sang schema mới (Phần 8 v2) mà không mất dữ liệu, không làm hỏng tính nhất quán, và luôn có đường quay lại.

## 2. Nội dung cần bàn luận

- Chiến lược chuyển đổi, quy trình cutover và downtime.
- Ánh xạ dữ liệu từng collection, xử lý dữ liệu không tương thích.
- Công cụ, kiểm chứng, rollback và xử lý sự cố.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Chiến lược: **tạo collection mới song song**, migrate sang, chuyển đổi, giữ collection cũ 30 ngày rồi xoá | An toàn, rollback dễ, tốn dung lượng gấp đôi |
| 2 | Viết lại `dataset_record`: **bulk write theo lô** (5.000 docs/lần) + resume theo cursor | Nhanh, an toàn, dừng/tiếp tục được |
| 3 | Ánh xạ `_id`: **sinh ULID mới ngẫu nhiên** + bảng `id_map` | Chuẩn, cần bảng tra cứu cho rollback |
| 4 | Xoá collection LEGACY (**7 collection** ở v4: `clean_rules`, `lineage`, `lineage_nodes`, `dataset_versions`, `exports`, `export_tasks`, `dataset_sheet`): **ngay khi cutover thành công** | Không giữ thêm |
| 5 | **Không** có giai đoạn dual-write | Cutover là một thời điểm cắt |
| 6 | Map vai trò workspace: `editor` → `member`, `viewer` → `member` | Gộp hết về 1 role, khớp Phần 6 v3 |
| 7 | Suy ra `project.status` từ **`dataset.status`** | Chính xác hơn `has_dataset` |
| 8 | Công cụ: **script `ts-node` trong `scripts/`**, 3 chế độ `--dry-run`/`--apply`/`--verify` | Theo pattern script migration chuẩn (`--dry-run`/`--apply`/`--verify`) |
| 9 | Kiểm chứng: **đối chiếu số document + hash mẫu ngẫu nhiên 1% + referential integrity** | Đủ tin cậy, chạy nhanh |
| 10 | Xoá module `lineage` → **xoá hoàn toàn**, gỡ `neo4j.service.ts`, xoá graph trên AuraDB | Bỏ 1 dependency |
| 11 | **Có maintenance window** — tắt API, migrate, bật lại | Downtime chấp nhận được |
| 12 | Backup trước cutover: **khuyến nghị** (không chặn) | Cảnh báo nếu thiếu |
| 13 | ~~`dataset_sheet`: mỗi dataset 1 sheet~~ → **ĐẢO NGƯỢC ở v4: không tạo `dataset_sheet`** | Chỉ `.csv` → 1 file = 1 bảng; cột nhúng thẳng vào `dataset` (Phần 8 v4 mục 3.6.2) |
| 14 | `dataset_sheet` (collection cũ) → **xoá trong migration**, kèm cơ chế chặn | Không còn ý nghĩa nghiệp vụ (mục 3.6.15) |
| 15 | `finding_feedback` + `feedback_example` → **collection mới, không có nguồn migrate** | Hệ thống cũ chưa có tính năng nhận xét (mục 3.6.16) |

**Lưu ý về quyết định 4 và 10:** hai quyết định này **loại bỏ** dữ liệu vĩnh viễn. Điều kiện tiên quyết: backup trước cutover phải tồn tại (mục 3.9). Nếu không có backup, `clean_rules` / `lineage` / `exports` không thể khôi phục.

**Cập nhật 2026-11-05 (v4 — chỉ `.csv` + feedback + Kafka):**
- `datasets.file_format` chỉ nhận giá trị `csv`. Dataset cũ có `file_format = 'xlsx'` → **không migrate** (đếm vào báo cáo "bản ghi bị bỏ qua"), vì hệ thống mới không đọc được Excel.
- `dataset_sheet` **không được tạo**. Toàn bộ `datasets.columns[]` được **nhúng thẳng** vào `dataset.columns[]` (chuyển `name` → `name`, `data_type` → `data_type`, `missing_count` → `missing_count`), đồng thời sinh `key` `c0`/`c1`… theo vị trí.
- Thêm 2 collection mới `finding_feedback` (`fb_`), `feedback_example` (`fex_`) — **không có dữ liệu cũ để migrate**, chỉ tạo index.
- `outbox_event` giữ nguyên vai trò nhưng được publish ra **Kafka** (Phần 9 v3) thay vì BullMQ/Redis; thêm `processed_event` (inbox) cho idempotency.
- `ai_job` bổ sung `model_id` + `prompt_version` — bắt buộc để truy vết khi so sánh chất lượng giữa các model cục bộ.

**Cập nhật 2026-11-05 (quyết định "chỉ đọc"):**
- `dataset_versions` (collection cũ) **không được migrate** — collection `dataset_version` không còn tồn tại trong schema mới (Phần 8 mục 3.11c). Dữ liệu cũ chỉ giữ trong backup để đối chiếu.
- Thêm `versions` và `cell-edit` vào nhóm module bị xoá → tổng **5 collection** bị loại bỏ vĩnh viễn.
- **v4:** thêm `dataset_sheet` vào nhóm bị xoá (đã gộp vào `dataset`) → tổng **7 collection** bị loại bỏ vĩnh viễn.
- **Không có rollback dữ liệu dataset** trong phạm vi mới: dữ liệu bất biến nên không có phiên bản để quay lại. Cơ chế rollback 3 mức tại mục 3.9 **chỉ áp dụng cho rollback deploy/migration**, không phục vụ khôi phục dữ liệu người dùng.

### 3.2. Bức tranh tổng thể

```
┌──────────────────────── PHÍA CŨ (legacy) ────────────────────────┐
│ users, user_sessions, workspaces, projects, datasets,             │
│ dataset_records, dataset_versions, outbox_events, ai_jobs,        │
│ analysis_results, clean_rules, lineage, lineage_nodes,            │
│ exports, export_tasks                                              │
└───────────────────────────┬───────────────────────────────────────┘
                            │  migrate (scripts/migrate-*.ts)
                            │  giữ nguyên _id cũ, sinh _id mới
                            ▼
┌──────────────────────── PHÍA MỚI (target) ──────────────────────┐
│ user, user_session, workspace, workspace_member, project,          │
│ project_member, dataset (đã gộp columns), dataset_record,         │
│ outbox_event, processed_event, ai_job,                             │
│ analysis_run, analysis_result, cell_evidence, notification,        │
│ issue_report, audit_log, audit_change, project_save,               │
│ finding_feedback, feedback_example        ← v4: 2 collection mới    │
└───────────────────────────────────────────────────────────────────┘
```

**Đặc điểm quan trọng của chiến lược "collection mới song song":**

| Đặc điểm | Hệ quả |
|---|---|
| Code cũ và code mới dùng **hai bộ collection khác nhau** | Không cần dual-write — mỗi thời điểm chỉ một bên hoạt động |
| Collection cũ **không bị đụng đến** trong lúc migrate | Rollback L1 (deploy lại code cũ) hoạt động ngay |
| Dung lượng tạm thời **× 2** | Cần đủ quota Atlas M10 |
| Index của collection mới phải **tạo sau khi** dữ liệu vào | Nếu tạo trước thì build index chậm hơn nhiều |

### 3.3. Quy trình cutover 8 bước

```
  BƯỚC 1        BƯỚC 2        BƯỚC 3         BƯỚC 4        BƯỚC 5         BƯỚC 6         BƯỚC 7        BƯỚC 8
┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  ┌───────────┐
│  BACKUP  │→ │  DỪNG    │→ │ MIGRATE   │→ │  TẠO      │→ │  VERIFY    │→ │  DEPLOY    │→ │  SMOKE    │→ │ GIỮ CŨ /  │
│          │  │  API +   │  │  DỮ LIỆU  │→ │  INDEX    │→ │  DỮ LIỆU  │→ │  CODE MỚI  │→ │  TEST     │→ │ XOÁ CŨ    │
│ mongodump│  │  WORKER  │  │           │  │           │  │            │  │            │  │           │  │ 30 ngày  │
└──────────┘  └──────────┘  └───────────┘  └───────────┘  └────────────┘  └────────────┘  └───────────┘  └───────────┘
  bắt buộc    downtime      có thể chạy    sau data       3 mức kiểm      migration      5 kịch bản    drop collection
  theo khuyến  30p – 2h     lại được      nhanh          bản              đã chạy       nghiệp vụ     LEGACY ngay
  nghị         (ước tính)                                  (mục 3.8)                                  (quyết định 4)
```

**Chi tiết từng bước:**

| Bước | Lệnh / hành động | Điều kiện tiên quyết | Đầu ra |
|---|---|---|---|
| 1 | `bash deploy/scripts/backup.sh` | — | File `.archive.gz` trên R2 + báo cáo |
| 2 | `docker compose stop api worker` | Xác nhận không còn process nào ghi DB | API trả 503 (đã tắt) |
| 3 | `pnpm db:migrate --apply` (mục 3.4) | Backup đã tạo | Collection mới đầy dữ liệu |
| 4 | `pnpm db:indexes:sync` | Migration xong | Đủ index theo Phần 8 v2 |
| 5 | `pnpm db:migrate --verify` | Index đã tạo | Báo cáo 3 mức kiểm chứng |
| 6 | `docker compose up -d` | Verify pass | Container chạy code mới |
| 7 | Smoke test (mục 3.10.2) | Container healthy | Xác nhận 5 kịch bản |
| 8 | Đặt lịch drop collection cũ sau 30 ngày | Smoke test pass + đã qua 30 ngày | `drop_collection.ts` chạy |

**Quy tắc bắt buộc cho cutover:**

| # | Quy tắc |
|---|---|
| 1 | **Bước 2 là bắt buộc** — không được migrate khi API/worker còn chạy, vì sẽ có ghi đè xen kẽ và mất tính nhất quán |
| 2 | Bước 3 **phải idempotent** — dừng giữa chừng rồi chạy lại phải cho kết quả đúng, không nhân bản |
| 3 | Bước 5 phải **pass** mới được sang bước 6 — không có ngoại lệ |
| 4 | Nếu bước 5 fail → **rollback ngay** (mục 3.9), không sửa lỗi tại chỗ trên production |
| 5 | Ghi nhật ký toàn bộ cutover: thời điểm từng bước, số document, kết quả verify, người thực hiện |
| 6 | Bước 8 **không tự động** — phải có xác nhận thủ công sau khi đã xem log vận hành 30 ngày |
| 7 | Toàn bộ quy trình phải được **diễn tập trên staging** ít nhất 1 lần trước khi chạy production |

### 3.4. Bộ công cụ migration

#### 3.4.1. Cấu trúc

```
scripts/
├── lib/
│   ├── load-env.ts               # nạp .env, kiểm tra biến bắt buộc
│   ├── mongo.ts                  # kết nối MongoClient, helper bulk write
│   ├── id-map.ts                 # sinh ULID + ghi/đọc bảng id_map
│   ├── report.ts                 # định dạng báo cáo JSON
│   └── required-indexes.ts       # danh sách index bắt buộc (Phần 8 v2)
├── migrate-01-users.ts
├── migrate-02-workspaces.ts
├── migrate-03-projects.ts
├── migrate-04-datasets.ts
├── migrate-05-dataset-records.ts
├── migrate-06-versions-outbox.ts
├── migrate-07-analysis-ai.ts
├── migrate-08-drop-legacy.ts
├── verify-migration.ts
└── drop-legacy-collections.ts
```

**Quyết định về thứ tự:** các script chạy **tuần tự theo số thứ tự** — mỗi script phụ thuộc script trước (VD `migrate-03-projects` cần `workspace` đã tạo).

#### 3.4.2. Ba chế độ — theo pattern chuẩn

| Chế độ | Lệnh | Hành vi |
|---|---|---|
| **dry-run** | `pnpm db:migrate` (mặc định) | Chỉ đọc, in ra kế hoạch: bao nhiêu document sẽ chuyển đổi, bao nhiêu bản ghi sẽ bị bỏ qua, ước tính thời gian. **Không ghi gì** |
| **apply** | `pnpm db:migrate --apply` | Thực thi ghi dữ liệu thật |
| **verify** | `pnpm db:migrate --verify` | Chạy kiểm chứng, **không** ghi (chế độ read-only) |

**Quy tắc bắt buộc:**
1. **Mặc định là `dry-run`** — không bao giờ ghi dữ liệu nếu không có `--apply` tường minh.
2. `--apply` phải chạy trong môi trường có `NODE_ENV=production` hoặc `MIGRATION_CONFIRM=yes` — chống chạy nhầm.
3. Mỗi script in báo cáo JSON ra stdout — dùng được cho CI và cho `analyze-logs.sh`.
4. `--verify` **không bao giờ** ghi — kể cả khi phát hiện sai lệch, chỉ báo cáo.
5. Exit code ≠ 0 khi có lỗi → deploy script dừng (mục 3.3 bước 3).

#### 3.4.3. Cấu trúc một script migration

```typescript
// scripts/migrate-03-projects.ts
import './lib/load-env';
import { withMongo, BulkWriter } from './lib/mongo';
import { IdMap } from './lib/id-map';

async function main(): Promise<void> {
  const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';

  await withMongo(async (db) => {
    const idMap = new IdMap(db);
    const legacy = db.collection('projects');
    const target = db.collection('project');
    const writer = new BulkWriter(target, { batchSize: 5_000 });

    let total = 0;
    let skipped = 0;

    for await (const doc of legacy.find({}).cursor()) {
      const workspaceId = await idMap.resolve('ws', doc.workspace_id);
      if (!workspaceId) {
        skipped++;               // workspace cha không tồn tại → bỏ qua, báo cáo
        continue;
      }

      const status = await deriveProjectStatus(db, doc, idMap);

      const target_ = {
        _id: await idMap.allocate('prj', doc._id),
        workspace_id: workspaceId,
        name: doc.name,
        description: doc.description ?? '',
        status,
        created_by: await idMap.resolve('usr', doc.created_by),
        deleted_at: doc.deleted_at ?? null,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        version: 1,
      };

      if (mode === 'apply') await writer.push(target_);
      total++;
    }

    if (mode === 'apply') {
      const result = await writer.flush();
      process.stdout.write(`${JSON.stringify({
        script: 'migrate-03-projects',
        mode,
        sourceCount: await legacy.countDocuments(),
        migrated: total,
        skipped,
        inserted: result.insertedCount,
        updated: result.modifiedCount,
      })}\n`);
    } else {
      process.stdout.write(`${JSON.stringify({
        script: 'migrate-03-projects',
        mode, wouldMigrate: total, wouldSkip: skipped,
      })}\n`);
    }
  });
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: String(error) })}\n`);
  process.exit(1);
});
```

#### 3.4.4. `BulkWriter` — ghi theo lô, an toàn

**Quyết định:** batch size **5.000 document/lần**, `ordered: false`.

| # | Quy tắc |
|---|---|
| 1 | `ordered: false` — lỗi 1 document **không** dừng cả lô; lỗi được gom lại để xử lý |
| 2 | Lỗi **duplicate key** được bỏ qua có chủ đích — đây là cơ chế idempotent: chạy lại sẽ gặp trùng `_id` và bỏ qua |
| 3 | Lỗi khác (network, schema) → ghi log và **dừng script** với exit code ≠ 0 |
| 4 | Sau mỗi lô, in log tiến độ: `{ flushed: n, total: m, elapsedSeconds: s }` |
| 5 | Giữ **checkpoint** (số lô đã ghi) vào collection `migration_checkpoint` để resume |

**Quy tắc về `upsert`:**

| Tình huống | Hành vi |
|---|---|
| `_id` chưa tồn tại | `insertOne` |
| `_id` đã tồn tại, nội dung giống | Bỏ qua (idempotent) |
| `_id` đã tồn tại, nội dung khác | `replaceOne` — ghi đè, vì dữ liệu nguồn là chuẩn |

**Hiệu năng ước tính (Atlas M10, region gần VPS):**

| Khối lượng | Thời gian ước tính |
|---|---|
| 10.000 user + project + dataset | < 10 giây |
| 100.000 `dataset_record` | ~30–60 giây |
| 1.000.000 `dataset_record` | ~5–10 phút |
| 5.000.000 `dataset_record` | ~25–50 phút |

**Ảnh hưởng tới maintenance window:** với 1 triệu record, downtime ước tính 10–20 phút (migrate + index + verify + smoke). Vượt 5 triệu record → cần chia thành nhiều đợt hoặc chạy migrate offline song song với API (chấp nhận dữ liệu lệch tạm thời).

### 3.5. Bảng ánh xạ `_id`

#### 3.5.1. Bảng `id_map`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `_id` | String | `imap_<ULID26>` |
| `entity_type` | String | `usr` \| `ses` \| `ws` \| `prj` \| `ds` \| `dsh` \| `dsr` \| `dsv` \| `obx` \| `aib` \| `anr` \| `anl` |
| `old_id` | String | ObjectId cũ dạng chuỗi hex (24 ký tự) |
| `new_id` | String | ULID26 có tiền tố |
| `created_at` | Date | |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ entity_type: 1, old_id: 1 }` | **unique** | Tra cứu chính |
| `{ new_id: 1 }` | unique | Tra cứu ngược |

**Quy tắc bắt buộc:**
1. `old_id` lưu **ObjectId dạng chuỗi** — không lưu `ObjectId` native, để bảng đọc được bằng mắt và tách khỏi driver.
2. Bảng `id_map` **giữ nguyên suốt vòng đời** — cần cho rollback và tra cứu hậu kiểm.
3. `id_map` thuộc collection **hạ tầng migration**, không nằm trong 21 collection nghiệp vụ (Phần 8 v3) → không đưa vào schema chính, nhưng phải được backup cùng R2.
4. Không bao giờ xoá bản ghi `id_map` — kể cả sau khi drop collection cũ.

#### 3.5.2. Cơ chế cấp phát ID

```
resolve(entity_type, old_id):
  1. Tìm trong id_map theo (entity_type, old_id)
  2. Nếu có → trả new_id
  3. Nếu chưa có → sinh ULID26 mới, ghi id_map, trả new_id
```

**Quy tắc:**
1. `resolve()` chạy **trong bộ nhớ cache** (LRU, tối đa 50.000 entry) trong một lần chạy script — tránh truy vấn lặp lại cho cùng một `old_id`.
2. Sinh ULID26 bằng đúng generator của `packages/core/src/id/id-generator.ts` — **không** viết lại thuật toán.
3. ULID **đơn điệu theo thời gian** → ID mới luôn lớn hơn ID cũ trong cùng loại — thuận tiện cho cursor pagination.
4. `old_id` có thể rỗng (VD `parent_version_id = null`) → trả `null`, không cấp ID.

#### 3.5.3. Bảng ánh xạ theo collection

| Collection cũ | Tiền tố | Loại ID trong `id_map` |
|---|---|---|
| `users` | `usr_` | `usr` |
| `user_sessions` | `ses_` | `ses` |
| `workspaces` | `ws_` | `ws` |
| *(tách)* `workspaces.members[]` | `wsm_` | `wsm` |
| `projects` | `prj_` | `prj` |
| *(tách)* project members | `prm_` | `prm` |
| `datasets` | `ds_` | `ds` |
| *(tách)* dataset sheets | `dsh_` | `dsh` |
| `dataset_records` | `dsr_` | `dsr` |
| ~~`dataset_versions`~~ | ~~`dsv_`~~ | ~~`dsv`~~ — **không migrate 2026-11-05** |
| `outbox_events` | `obx_` | `obx` |
| `ai_jobs` | `aib_` | `aib` |
| `analysis_results` | `anr_` | `anr` |
| *(tách)* analysis cells | `anl_` | `anl` |

**Quy tắc:** ID của collection mới được tách (`workspace_member`, `project_member`, `dataset_record`, `analysis_result`, `cell_evidence`, `finding_feedback`, `feedback_example`) **không có `old_id`** — chúng được sinh hoàn toàn mới. Bảng `id_map` chỉ giữ ánh xạ cho các thực thể vốn đã tồn tại.

### 3.6. Quy tắc ánh xạ dữ liệu chi tiết

#### 3.6.1. `users` → `user`

| Trường cũ | Trường mới | Quy tắc |
|---|---|---|
| `_id` | `_id` | `usr_` + ULID mới |
| `email` | `email` | Giữ nguyên, lowercase |
| `password_hash` | `password_hash` | Giữ nguyên — **không** rehash (sẽ làm tất cả user phải đổi mật khẩu) |
| `google_id` | `google_id` | Giữ nguyên |
| `first_name`, `last_name` | `first_name`, `last_name` | Giữ nguyên |
| `avatar_url` | `avatar_url` | Giữ nguyên |
| `role` | `role` | `admin` → `admin`, `analyst` → `analyst` — **giữ nguyên** |
| `status` | `status` | Giữ nguyên |
| `password_reset_token_hash` | `password_reset_token_hash` | Giữ nguyên |
| `password_reset_expires_at` | `password_reset_expires_at` | Giữ nguyên |
| `deleted_at` | `deleted_at` | Giữ nguyên — soft delete được bảo toàn |
| `created_at`, `updated_at` | `created_at`, `updated_at` | Giữ nguyên |
| — | `phone`, `bio`, `notifications_enabled`, `last_login_at` | **Mặc định**: `null`, `null`, `true`, `null` |
| — | `version` | `1` |

**Quy tắc bắt buộc:**
1. **Không** rehash `password_hash` — bcrypt salt đã có, verify vẫn hoạt động. Rehash chỉ làm user phải đổi mật khẩu mà không có lý do.
2. `notifications_enabled` mặc định `true` — người dùng không mất thông báo nào khi nâng cấp.
3. `deleted_at` giữ nguyên — user đã xoá vẫn bị xoá sau migration (không "hồi sinh").

#### 3.6.2. `user_sessions` → `user_session`

| Trường cũ | Trường mới | Quy tắc |
|---|---|---|
| `_id` | `_id` | `ses_` + ULID mới |
| `user_id` | `user_id` | Tra `id_map` |
| `refresh_token_hash` | `refresh_token_hash` | Giữ nguyên |
| `device_name` | `device_label` | Đổi tên trường |
| `ip_address` | `ip_address` | Giữ nguyên |
| `user_agent` | `user_agent` | Giữ nguyên |
| `is_revoked` | `revoked_at` | `true` → `revoked_at = updated_at`, `false` → `null` |
| — | `revoke_reason` | `null` |
| `expires_at` | `expires_at` | Giữ nguyên |

**Quy tắc bắt buộc:**
1. `is_revoked: true` → `revoked_at = updated_at` (xấp xỉ thời điểm thu hồi) — **không** dùng `new Date()` vì sẽ phá tính xác định của migration.
2. Session đã hết hạn (`expires_at < now`) vẫn migrate — TTL index sẽ dọn sau. Nhưng có thể **bỏ qua** session đã hết hạn để giảm dung lượng; phải ghi rõ số lượng đã bỏ qua trong báo cáo.
3. **Khuyến nghị:** bỏ qua session đã hết hạn — người dùng đăng nhập lại, không mất tính năng nào.

#### 3.6.3. `workspaces` → `workspace` + `workspace_member`

**Đây là phép tách phức tạp nhất** — 1 document cũ → 1 `workspace` + N `workspace_member`.

| Nguồn | Đích | Quy tắc |
|---|---|---|
| `workspaces._id` | `workspace._id` | `ws_` + ULID mới |
| `workspaces.name` | `workspace.name` | Giữ nguyên |
| `workspaces.description` | `workspace.description` | Giữ nguyên |
| `workspaces.owner_id` | `workspace.owner_id` | Tra `id_map` |
| `workspaces.deleted_at` | `workspace.deleted_at` | Giữ nguyên |
| `workspaces.created_at/updated_at` | `workspace.created_at/updated_at` | Giữ nguyên |
| — | `workspace.storage_used_bytes` | Tính từ tổng kích thước dataset thuộc workspace |
| — | `workspace.status` | `active` |
| — | `workspace.version` | `1` |
| `workspaces.members[]` | `workspace_member` (mỗi phần tử 1 document) | Xem bảng dưới |

**Ánh xạ phần tử `members[]` → `workspace_member`:**

| Trường cũ | Trường mới | Quy tắc |
|---|---|---|
| `user_id` | `user_id` | Tra `id_map` |
| `role` | `role` | `owner` → `owner`, `editor` → `member`, `viewer` → `member` |
| `joined_at` | `granted_at` | Giữ nguyên |
| — | `granted_by` | `owner_id` của workspace |
| — | `workspace_id` | ID workspace mới |
| — | `version`, `created_at`, `updated_at` | `1`, `joined_at`, `joined_at` |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | **Bỏ qua phần tử `members[]` không có `user_id` hợp lệ** (user không tồn tại trong `users`) — đếm và báo cáo |
| 2 | Nếu `owner_id` **không** xuất hiện trong `members[]` → **tự tạo** một `workspace_member` với `role: 'owner'` từ `owner_id`. Đây là trường hợp dữ liệu lệch — bảo đảm bất biến "mỗi workspace đúng một Owner" (Phần 8 v2) |
| 3 | Nếu `members[]` có **nhiều** phần tử `role: 'owner'` → giữ phần tử đầu tiên, các phần tử còn lại đổi thành `member`, **ghi cảnh báo** |
| 4 | Nếu `members[]` có phần tử `role: 'owner'` **khác** `owner_id` → ưu tiên `owner_id` (nguồn chuẩn hơn, vì nó là trường được dùng để kiểm tra quyền), đổi phần tử trong `members[]` thành `member`, **ghi cảnh báo** |
| 5 | Thứ tự `owner` trong collection không quan trọng — quyền được xác định qua `role`, không qua vị trí |
| 6 | `workspace_member` **không có** `deleted_at` — membership bị xoá bằng cách xoá document (lý do: xoá 1 dòng membership là thao tác hiếm, và giữ soft delete sẽ phải lọc `deleted_at: null` ở mọi truy vấn quyền) |

**Quy tắc 6 — đánh đổi đã chấp nhận:** truy vấn quyền sẽ là `workspace_member.find({ workspace_id, user_id })` không kèm điều kiện `deleted_at`. Đánh đổi: giảm 1 điều kiện lọc ở hot path, đổi lại membership table luôn nhỏ.

**Tính `storage_used_bytes`:**

```
workspace.storage_used_bytes = SUM(
  dataset.file_size_bytes
  WHERE dataset.workspace_id = workspace._id
    AND dataset.deleted_at IS NULL
)
```

**Quy tắc:**
1. Chỉ tính dataset **chưa xoá mềm** — dataset đã xoá vẫn giữ file 90 ngày nhưng không tính vào quota hiện hành (khớp Phần 10 mục 3.14).
2. Phải tính **sau khi** migrate xong `dataset` → thứ tự script: `migrate-02-workspaces` (tạo workspace) → `migrate-04-datasets` → rồi script tính lại quota.
3. Nếu tổng vượt `STORAGE_MAX_QUOTA_BYTES` → **không** chặn, chỉ ghi cảnh báo. Dữ liệu đã tồn tại, không nên xoá.

#### 3.6.4. `projects` → `project` + `project_member`

| Nguồn | Đích | Quy tắc |
|---|---|---|
| `projects._id` | `project._id` | `prj_` + ULID mới |
| `projects.workspace_id` | `project.workspace_id` | Tra `id_map` — nếu workspace không tồn tại → **bỏ qua project** |
| `projects.name` | `project.name` | Giữ nguyên |
| `projects.description` | `project.description` | Giữ nguyên |
| `projects.created_by` | `project.created_by` | Tra `id_map` |
| `projects.deleted_at` | `project.deleted_at` | Giữ nguyên |
| `projects.created_at/updated_at` | `project.created_at/updated_at` | Giữ nguyên |
| `projects.has_dataset` | *(bỏ)* | Dùng để đối chiếu, không migrate trực tiếp |
| — | `project.status` | Suy ra từ `dataset.status` (mục 3.6.5) |
| — | `project.version` | `1` |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Project có `workspace_id` không tồn tại (workspace đã xoá) → **bỏ qua project**, đếm và báo cáo |
| 2 | Project có `workspace_id` trỏ tới workspace **đã xoá mềm** → **vẫn migrate** (giữ `deleted_at` của project) — để rollback và đối chiếu được đầy đủ |
| 3 | `created_by` không tồn tại → đặt `null` (trường cho phép nullable) — không bỏ qua project vì lý do này |
| 4 | **`project_member` được tạo từ đâu?** Xem mục 3.6.4.1 |

##### 3.6.4.1. Sinh `project_member` — không có nguồn trực tiếp

**Vấn đề:** schema cũ `projects` **không có** mảng thành viên. Chỉ có `workspace.members[]`. Vậy ai là thành viên của project?

**Quyết định:** suy ra 2 nguồn, hợp nhất thành 1 tập.

```
nguồn 1: workspace_member của workspace chứa project
         → role: 'member'  (mọi thành viên workspace đều có quyền truy cập project)

nguồn 2: project.created_by
         → role: 'owner'   (người tạo project là Owner của project)
```

**Bảng hợp nhất:**

| Điều kiện | `project_member` được tạo | `role` |
|---|---|---|
| User là thành viên workspace **và** là `created_by` | 1 bản ghi | `owner` |
| User là thành viên workspace, **không** phải `created_by` | 1 bản ghi | `member` |
| `created_by` **không** phải thành viên workspace | 1 bản ghi (vẫn tạo) | `owner` |
| `created_by` không tồn tại trong `users` | **Không tạo** | — |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mỗi project có **đúng 1** `project_member` với `role: 'owner'` — là `created_by` |
| 2 | Mọi thành viên workspace khác đều có `project_member` với `role: 'member'` — đảm bảo quyền truy cập không đổi so với hệ thống cũ |
| 3 | `project_member` **không** có bản ghi cho user không thuộc workspace (trừ `created_by` ở trên) |
| 4 | Nếu `created_by` không tồn tại → project **vẫn migrate**, nhưng không có `project_member` với `role: 'owner'` — phải ghi cảnh báo vì vi phạm bất biến "mỗi project đúng một Owner" |
| 5 | Thứ tự migrate: `migrate-02-workspaces` (tạo `workspace_member`) → `migrate-03-projects` (tạo `project_member`) |

**Đánh đổi đã chấp nhận:** số bản ghi `project_member` tăng mạnh — bằng số project × số thành viên workspace. Với 100 project × 20 thành viên = 2.000 bản ghi — không đáng kể so với `dataset_record`.

**Lưu ý về quyền:** Phần 6 v3 quy định Workspace Owner có toàn quyền với mọi project trong workspace **mà không cần** có bản ghi trong `project_member`. Vì vậy quy tắc 3 không làm mất quyền của Workspace Owner.

#### 3.6.5. Suy ra `project.status`

**Quyết định (câu hỏi đã chốt):** suy ra từ **`dataset.status`**, không dùng `has_dataset`.

```
dataset của project:
  ├─ có dataset status = 'READY'      → project.status = 'in_progress'
  ├─ có dataset status = 'INGESTING'   → project.status = 'in_progress'
  ├─ chỉ có dataset status = 'FAILED'  → project.status = 'draft'
  └─ không có dataset nào              → project.status = 'draft'
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `dataset.status` là **nguồn chuẩn**; `has_dataset` chỉ dùng để **đối chiếu**, không quyết định |
| 2 | Nếu có **nhiều** dataset: lấy trạng thái của dataset **mới nhất** (`created_at` lớn nhất, chưa xoá) |
| 3 | Dataset đã xoá mềm (`deleted_at != null`) **không** tính |
| 4 | **Đối chiếu bắt buộc:** đếm số project có `has_dataset = true` nhưng suy ra `status = 'draft'` → ghi cảnh báo. Trường hợp này xảy ra khi dataset `FAILED` hoặc dataset đã xoá |
| 5 | Cùng chiều ngược: `has_dataset = false` nhưng suy ra `in_progress` → cảnh báo (dữ liệu lệch) |
| 6 | Số lượng cảnh báo phải được in ra trong báo cáo, **không** chặn migration |

**Quy trình thực thi:** vì `dataset` được migrate ở script 04 còn `project` ở script 03, `project.status` phải được tính ở **script 05** (sau khi có dataset) — hoặc đơn giản hơn: script 03 ghi `status` tạm, script 05 **cập nhật lại** sau khi có đủ dữ liệu dataset. Tôi chọn cách **2 lần**: script 03 tính từ collection **cũ** `datasets` (đã có sẵn `status`), không cần đợi.

#### 3.6.6. `datasets` → `dataset` (**v4: không tạo `dataset_sheet`**)

> **v4:** Vì hệ thống chỉ làm việc với `.csv` (1 file = 1 bảng) nên `dataset_sheet` **không còn tồn tại**. Toàn bộ thông tin cột được **nhúng thẳng** vào document `dataset`.

| Nguồn | Đích | Quy tắc |
|---|---|---|
| `datasets._id` | `dataset._id` | `ds_` + ULID mới |
| `datasets.project_id` | `dataset.project_id` | Tra `id_map` — project không tồn tại → bỏ qua dataset |
| `datasets.workspace_id` | `dataset.workspace_id` | Tra `id_map` |
| `datasets.name` | `dataset.name` | Giữ nguyên |
| `datasets.original_file_name` | `dataset.original_filename` | Giữ nguyên |
| `datasets.file_format` | `dataset.file_format` | **Chỉ `csv`** — giá trị khác → bỏ qua dataset (quy tắc 10) |
| `datasets.file_size_bytes` | `dataset.file_size_bytes` | Giữ nguyên |
| `datasets.file_checksum` | `dataset.content_fingerprint` | Chuẩn hoá sang `sha256:<hex>` (mục 3.6.7) |
| `datasets.storage_key` | `dataset.storage_key` | Giữ nguyên — file gốc vẫn trên R2 |
| `datasets.row_count` | `dataset.row_count` | Giữ nguyên |
| `datasets.column_count` | `dataset.column_count` | Giữ nguyên |
| `datasets.columns[]` | `dataset.columns[]` | **Nhúng trực tiếp** + sinh `key` `c0`/`c1`… theo vị trí (mục 3.6.6.1) |
| — | `dataset.has_header` | `true` (CSV mặc định coi dòng đầu là header) |
| — | `dataset.delimiter` | `,` (mặc định) — không có dữ liệu delimiter cũ |
| — | `dataset.working_sheet_id` | `null` — trường này không còn dùng ở v4 |
| `datasets.status` | `dataset.status` | `INGESTING`→`ingesting`, `READY`→`ready`, `FAILED`→`failed` — **chuyển sang lowercase** |
| `datasets.deleted_at` | `dataset.deleted_at` | Giữ nguyên |
| — | `dataset.version` | `1` |

**Quy tắc bắt buộc:**
1. `status` chuyển **sang lowercase** — schema mới dùng lowercase (`ready`/`ingesting`/`failed`) nhất quán với các enum khác.
2. **KHÔNG tạo `dataset_sheet`** — đảo ngược quyết định 13 của v3 (mục 3.7.2 xoá collection cũ).
3. **`dataset.columns[]` được nhúng thẳng** vào `dataset` theo đúng cấu trúc Phần 8 v4 mục 3.6.2.
4. **`dataset_record` không còn `sheet_id`** → không cần tra `id_map` cho sheet.
5. `dataset.has_header` = `true`, `dataset.delimiter` = `,` — dữ liệu cũ không lưu thông tin này, dùng mặc định.
6. `dataset.working_sheet_id` = `null` — giữ trường để tương thích schema nhưng không dùng.
7. `dataset.status = 'failed'` → `ingest_error` = `{ code: 'LEGACY_UNSUPPORTED_FORMAT', message: '...' }` nếu nguyên nhân là định dạng.
8. Dataset có `project_id` không tồn tại → **bỏ qua** dataset + toàn bộ `dataset_record` của nó. Đếm và báo cáo.
9. **`storage_key` giữ nguyên** — file gốc vẫn nằm trên R2, không cần tải lại hay tải lên lại.
10. **`file_format` ≠ `csv` → bỏ qua dataset** (không migrate `dataset_record` của nó). Lý do: hệ thống mới chỉ đọc CSV; giữ lại dataset Excel sẽ tạo dữ liệu chết. Đếm vào báo cáo "bản ghi bị bỏ qua" + cảnh báo rõ ràng cho người dùng.

##### 3.6.6.1. Chuyển `datasets.columns[]` → `dataset.columns[]`

| Nguồn (`datasets.columns[]`) | Đích (`dataset.columns[]`) | Quy tắc |
|---|---|---|
| `[i].name` | `.name` | Giữ nguyên |
| `[i].original_name` | `.original_name` | Giữ nguyên — nếu thiếu → copy từ `.name` |
| `[i].data_type` | `.data_type` | `string`/`number`/`boolean`/`date`/`mixed` — giá trị lạ → `mixed` |
| `[i].missing_count` | `.missing_count` | Giữ nguyên, mặc định `0` |
| — | `.key` | **Sinh `c{i}`** theo vị trí — khóa bất biến (Phần 8 v4 mục 3.6.2) |
| — | `.index` | `i` |
| — | `.is_label` | `false` — dữ liệu cũ không có cột nhãn |

**Quy tắc bắt buộc:**
1. `key` sinh **theo vị trí** → `c0`, `c1`, … — **không** theo tên cột. Đây là điều kiện để `dataset_record.props` dùng chung key với dataset (mục 3.6.8).
2. Số cột > 1.000 → dataset bị **bỏ qua** kèm cảnh báo `too_many_columns` (guard 16 MB của MongoDB).
3. Tên cột trùng nhau → giữ nguyên, đồng thời sinh entry trong `dataset.column_issues[]` với `issue = 'duplicate_name'`.
4. Tên cột rỗng hoặc chỉ khoảng trắng → `issue = 'empty_name'` / `'whitespace_only'`.
5. `column_issues[]` **không** làm fail migrate — lỗi tên cột chỉ chặn phân tích (Phần 12 mục 3.12).

#### 3.6.7. Chuẩn hoá `content_fingerprint`

Schema cũ: `file_checksum` (string tùy ý, maxlength 64). Schema mới: `content_fingerprint` theo định dạng `sha256:<hex>` (Phần 8 v2).

| Trường cũ | Giá trị | Kết quả |
|---|---|---|
| `file_checksum` | 64 ký tự hex | `sha256:<giá trị>` — giữ nguyên hash |
| `file_checksum` | 64 ký tự hex **có tiền tố `sha256:`** | Bỏ tiền tố rồi thêm lại — chuẩn hoá |
| `file_checksum` | Chuỗi khác (VD MD5 32 ký tự) | `sha256:<hash mới tính từ file trên R2>` — **cần đọc file** |
| `file_checksum` | Rỗng / null | `null` — không có fingerprint |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Ưu tiên **không đọc file** — chỉ chuẩn hoá chuỗi có sẵn. Đọc file từ R2 chỉ khi định dạng không nhận diện được |
| 2 | File có `sha256` 64 hex → giữ nguyên hash, **không** tải file |
| 3. File có hash khác định dạng → tải từ R2, tính `sha256`, **ghi đè** — báo cáo số lượng đã tính lại |
| 4 | File không còn trên R2 → `content_fingerprint = null`, **ghi cảnh báo** |
| 5 | Tải file từ R2 **tốn băng thông** (egress R2 = $0 nên không tốn phí, nhưng vẫn tốn thời gian) → giới hạn tối đa 100 file/đợt, chạy nhiều đợt nếu cần |

**Ghi chú:** ~~`dataset_version` cũng có `data_checksum`~~ — **bỏ 2026-11-05**, collection không còn tồn tại (mục 3.6.9).

#### 3.6.8. `dataset_record.data` → `props` (key `c0`/`c1`)

Đây là phép chuyển đổi **khối lượng lớn nhất**.

**Cơ chế:**

```
dataset.columns[] (cũ)          dataset.columns[] (mới)
┌──────────────────────┐        ┌──────────────────────────────┐
│ [0] name: "Tuổi"      │  ───►  │ [0] key: "c0"                │
│     original_name:.. │        │     display_name: "Tuổi"      │
│     data_type: number│        │     original_name: ".."       │
│     missing_count: 0 │        │     data_type: number         │
├──────────────────────┤        │     missing_count: 0         │
│ [1] name: "Tên"       │  ───►  │ [1] key: "c1"                │
│     ...              │        │     display_name: "Tên"       │
└──────────────────────┘        │     ...                      │
                                └──────────────────────────────┘

dataset_record (cũ)             dataset_record (mới)
┌────────────────────────┐       ┌──────────────────────┐
│ data: {                │       │ props: {              │
│   "Tuổi": 25,          │  ───►  │   c0: 25,             │
│   "Tên": "An"          │       │   c1: "An"             │
│ }                      │       │ }                    │
└────────────────────────┘       └──────────────────────┘
```

**Quy tắc ánh xạ tên → key:**

| # | Quy tắc |
|---|---|
| 1 | Key được gán theo **vị trí** trong `dataset.columns[]` → `c0`, `c1`, ... — **không** theo tên |
| 2 | `dataset_record.data` dùng **tên cột hiển thị** (`name`) làm key — không phải `original_name`. Xác nhịnh bằng `name` |
| 3 | Tên cột **trùng nhau** → lấy giá trị của cột **đầu tiên** (khớp hành vi khi import — xem Phần 12) |
| 4 | Cột có trong `dataset.columns[]` nhưng **không có** trong `record.data` → `props` **không** có key đó (giữ nguyên hành vi "thiếu = không có") |
| 5 | Key trong `record.data` **không khớp** cột nào → **bỏ qua** key đó, đếm và báo cáo |
| 6 | Giá trị `null` → giữ `null` trong `props` — phân biệt "ô rỗng" với "thiếu cột" |
| 7 | Giá trị `undefined` (key không tồn tại) → không đưa vào `props` |

**Quy tắc bắt buộc cho phép chạy song song 2 lần:**

| # | Quy tắc |
|---|---|
| 1 | `props` được xây **từ `dataset.columns[]`**, không từ `record.data` — nếu xây từ `data` thì lần chạy 2 sẽ sinh key `c0` từ key `c0` (sai) |
| 2 | Ánh xạ `dataset_id` → danh sách `(tên cột → key)` được **cache theo dataset** trong RAM. Với 1 dataset 100 cột × 1 triệu record → cache chỉ 100 entry |
| 3 | Cache bị giới hạn **500 dataset**; vượt thì dùng LRU |
| 4 | **v4:** Không có `sheet_id` — bỏ trường này khỏi `dataset_record` |
| 5 | `row_index` giữ nguyên — **không** đánh số lại. Giữ thứ tự gốc để đối chiếu |
| 6 | `version_number` giữ nguyên |
| 7 | `deleted_at` giữ nguyên |

**Hiệu năng:**

| Yếu tố | Giá trị |
|---|---|
| Xử lý 1 record | O(số cột) — tra map tên → key |
| Cache map theo dataset | O(số dataset trong RAM) |
| I/O | Ghi 1 document có `props` nhỏ hơn `data` (key ngắn hơn tên cột) → **nhỏ hơn 30–50%** |

#### 3.6.9. ~~`dataset_versions` → `dataset_version`~~ — **KHÔNG MIGRATE (2026-11-05)**

> **Quyết định:** Collection `dataset_version` **không còn tồn tại** trong schema mới (Phần 8 mục 3.11c). Collection cũ `dataset_versions` **không được migrate** — không có bản ghi nào được chuyển sang.
>
> **Lý do:** Module `versions` bị gỡ cùng quyết định "chỉ đọc". Cơ chế Merkle (`parent_hash`, `rules_hash`, `version_hash`) không còn mục đích.
>
> **Xử lý dữ liệu cũ:** toàn bộ `dataset_versions` **bị xoá cùng các collection LEGACY khác** tại bước drop (quyết định 4, mục 3.1). Dữ liệu chỉ còn trong backup trước cutover — không migrate, không giữ.
>
> **Tác động đối chiếu:** các trường `parent_hash`, `rules_hash`, `version_hash`, `data_checksum` (chuẩn hoá sang `sha256:<hex>`) **không còn được migrate**. Cũng không có `changes_summary.rule_ids`.
>
> **Lưu ý về hash:** vì không migrate `dataset_version`, nên các hash liên quan phiên bản **không cần chuyển đổi SHA-256 → SHA-512**. SHA-512 chỉ áp dụng cho các hash còn tồn tại trong schema mới (checksum file upload, checksum export, `input_fingerprint`, `refresh_token_hash`, `password_reset_token_hash`).


#### 3.6.10. `outbox_events` → `outbox_event`

| Trường cũ | Trường mới | Quy tắc |
|---|---|---|
| `_id` | `_id` | `obx_` + ULID mới |
| `aggregate_type` | `aggregate_type` | `DATASET`→`dataset`, `TRANSFORMATION`→`transformation` — **lowercase**. ~~`DATASET_VERSION`~~ → **bỏ 2026-11-05** |
| `aggregate_id` | `aggregate_id` | Tra `id_map` theo loại; không tồn tại → giữ nguyên chuỗi gốc |
| `event_type` | `event_type` | Chuẩn hoá sang `dot.camelCase` (mục 3.6.11) |
| `payload` | `payload` | Giữ nguyên, **loại bỏ** field không thuộc schema mới |
| `status` | `status` | `PENDING`→`pending`, `PROCESSED`→`published`, `FAILED`→`failed` |
| `retry_count` | `retry_count` | Giữ nguyên |
| `error_message` | `last_error` | Đổi tên trường |
| `processed_at` | `published_at` | Đổi tên trường |
| — | `lease_expires_at` | `null` |
| — | `created_at`, `updated_at` | Từ `created_at`/`updated_at` cũ |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `PROCESSED` → `published` — tương ứng 1-1 với trạng thái đã xử lý xong |
| 2 | Event ở trạng thái `PENDING` khi cutover → **giữ nguyên** `pending`; relay của code mới sẽ publish chúng. Đây là cơ chế chuyển tiếp tự nhiên |
| 3 | `aggregate_id` là **string** trong schema cũ (không phải ObjectId) → không luôn tra được `id_map`. Giữ nguyên nếu không map được |
| 4 | `payload` phải được **lọc** theo schema `payload` mới (Phần 9 mục 3.3.3) — field không có trong schema bị loại bỏ |
| 5 | **Không** tạo `processed_event` cho các event đã `published` — inbox chỉ ghi khi consumer xử lý lần đầu |

#### 3.6.11. Chuẩn hoá tên sự kiện

| Tên cũ (snake_case) | Tên mới (dot.camelCase) |
|---|---|
| `dataset.imported` | `dataset.imported` |
| `dataset.version_created` | `dataset.versionCreated` |
| `dataset.processing_started` | `dataset.processingStarted` |
| `dataset.processing_completed` | `dataset.processingCompleted` |
| `dataset.processing_failed` | `dataset.processingFailed` |
| `version.created` | `dataset.versionCreated` |
| `transformation.applied` | `dataset.versionCreated` |

**Quy tắc:**
1. Event **không** nằm trong bảng → giữ nguyên tên cũ, ghi cảnh báo — không đoán.
2. Event có nhiều tên cũ quy về 1 tên mới (VD `version.created` và `dataset.version_created`) → gộp.
3. Danh sách 13 sự kiện chuẩn ở **Phần 9 mục 3.3.2** — event không có trong danh sách là event **ngoài thiết kế mới**.

#### 3.6.12. `analysis_results` → `analysis_run` + `analysis_result` + `cell_evidence`

**Vấn đề:** module `analysis` **chưa tồn tại** trong code hiện tại (đã kiểm tra — không có schema, không có controller). Bảng đối chiếu ở Phần 8 v2 mục 3.12 ghi `analysis_results` là collection cũ, nhưng thực tế code chưa có.

**Quyết định:** script `migrate-07-analysis-ai.ts` kiểm tra sự tồn tại của collection `analysis_results`:
- **Không tồn tại** → script in `skipped: 0, reason: 'collection not found'` và kết thúc thành công.
- **Có tồn tại** → migrate theo quy tắc bên dưới.

**Quy tắc ánh xạ (khi collection tồn tại):**

| Nguồn | Đích | Quy tắc |
|---|---|---|
| `analysis_results._id` | `analysis_run._id` | `anr_` + ULID mới |
| `dataset_id` | `analysis_run.dataset_id` | Tra `id_map` |
| `project_id` | `analysis_run.project_id` | Tra `id_map` |
| `created_at` | `analysis_run.started_at` | Giữ nguyên |
| — | `analysis_run.finished_at` | `null` (chưa có dữ liệu kết thúc) |
| — | `analysis_run.status` | `completed` |
| — | `analysis_run.triggered_by` | `null` |
| `results[]` (nếu có) | `analysis_result` | Tách mỗi phần tử thành 1 document |
| `results[].column_name` | `analysis_result.column_key` | Tra map tên → `c0`/`c1` |
| `results[].issue_count` | `analysis_result.issue_count` | Giữ nguyên |
| `results[].severity` | `analysis_result.severity` | Giữ nguyên |
| `results[].cells[]` | `cell_evidence` | Tách mỗi phần tử thành 1 document |
| `cells[].row_index` | `cell_evidence.row_index` | Giữ nguyên |
| `cells[].value` | `cell_evidence.value_masked` | **Mask PII** theo Phần 12 mục 3.10 |
| `cells[].reason` | `cell_evidence.reason` | Giữ nguyên |

**Quy tắc bắt buộc:**
1. Script **phải chạy được** khi collection không tồn tại — không được crash.
2. `cell_evidence.value_masked` **bắt buộc** che PII — giá trị ô dữ liệu không được lưu nguyên trong bằng chứng.
3. `analysis_result.column_key` phải là key `c0`/`c1` — tra qua map của dataset tương ứng. Không map được → `column_key = null` + cảnh báo.
4. `analysis_run.status` = `completed` cho dữ liệu đã có — dữ liệu đang chạy (nếu có) → `failed` + cảnh báo.

#### 3.6.13. `ai_jobs` → `ai_job`

| Trường cũ | Trường mới | Quy tắc |
|---|---|---|
| `_id` | `_id` | `aib_` + ULID mới |
| `dataset_id` | `dataset_id` | Tra `id_map` |
| `project_id` | `project_id` | Tra `id_map` |
| `status` | `status` | Chuẩn hoá sang lowercase theo enum mới |
| `created_at` | `created_at` | Giữ nguyên |
| — | `input_fingerprint` | `null` — không có nguồn |
| — | `kafka_partition` / `kafka_offset` | `null` — job cũ không chạy trên Kafka |
| — | `attempt` | `0` |
| `error_message` | `last_error` | Đổi tên |
| — | `completed_at` | `null` |
| — | `model_id` | `null` — job cũ dùng API ngoài, không có model cục bộ |
| — | `prompt_version` | `null` |
| — | `kafka_partition` / `kafka_offset` | `null` — job cũ không chạy trên Kafka |
| — | `attempt` | `0` |
| — | `status = 'skipped'` | Không dùng ở bản cũ |

**Quy tắc bắt buộc:**
1. AI job ở trạng thái `running`/`pending` khi cutover → đặt `status = 'failed'`, `last_error = 'Migrated from legacy system'`, ghi cảnh báo. Không có message Kafka để tiếp tục.
2. AI job `completed` với kết quả đã lưu → giữ `completed`.
3. `input_fingerprint` = `null` → phân tích lại sẽ tạo fingerprint mới, không so khớp được với job cũ. Chấp nhận.
4. **v4:** `model_id` = `null` — các job cũ được sinh bởi API ngoài, **không** quy được cho model cục bộ nào. Khi so sánh chất lượng model (UC-72), các job này **bị loại khỏi thống kê** vì không có model cục bộ tương ứng.
5. **v4:** `kafka_partition`/`kafka_offset` = `null` — worker mới sẽ đẩy job mới vào Kafka, không resume job cũ.

#### 3.6.14. Bảng tổng hợp — bản ghi bị bỏ qua

| Collection cũ | Điều kiện bỏ qua | Tác động |
|---|---|---|
| `workspaces.members[]` | `user_id` không tồn tại | Mất 1 membership |
| `projects` | `workspace_id` không tồn tại | Mất project + dataset + record của nó |
| `datasets` | `project_id` không tồn tại | Mất dataset + record của nó |
| `dataset_records` | `dataset_id` không tồn tại | Mất record |
| `analysis_results` | `dataset_id`/`project_id` không tồn tại | Mất kết quả phân tích |
| `ai_jobs` | `dataset_id` không tồn tại | Mất job (không quan trọng) |

**Quy tắc bắt buộc:**
1. **Không** bỏ qua âm thầm — mọi lần bỏ qua đều được đếm và in ra báo cáo.
2. Báo cáo phải có **danh sách chi tiết** (tối đa 100 bản ghi đầu) để tra cứu khi có sự cố.
3. Nếu tổng số bị bỏ qua > 1% tổng → **cảnh báo lớn** trong báo cáo, yêu cầu review trước khi tiếp tục.

**Bổ sung v4 — bảng bỏ qua do chỉ-CSV:**

| Collection cũ | Điều kiện bỏ qua | Tác động |
|---|---|---|
| `datasets` | `file_format ≠ 'csv'` | Mất dataset + toàn bộ `dataset_record` của nó — **cảnh báo đặc biệt** cho người dùng (dữ liệu Excel không còn đọc được) |
| `datasets` | số cột > 1.000 | Mất dataset — guard 16 MB MongoDB |
| `dataset_records` | thuộc dataset bị bỏ qua | Mất record |

#### 3.6.15. `dataset_sheet` → **XOÁ** (v4)

> **v4:** Collection `dataset_sheet` không còn tồn tại trong schema mới (Phần 8 v4 mục 3.6.2 — đã gộp vào `dataset`). Collection cũ `dataset_sheet` **không được migrate** và bị xoá trong bước drop LEGACY.

| Hành động | Chi tiết |
|---|---|
| Migrate | **Không** — không sinh bản ghi nào |
| Verify | Không kiểm tra số lượng (`dataset_sheet` không có trong collection mới) |
| Xoá | Nằm trong `LEGACY_COLLECTIONS` của `drop-legacy-collections.ts` (mục 3.7.2) |
| Cảnh báo báo cáo | Số bản ghi `dataset_sheet` bị xoá + số dataset có `source_index > 0` (đa sheet) — để người dùng biết mất dữ liệu bao nhiêu |

**Quy tắc bắt buộc:**
1. `dataset_sheet` **không** nằm trong bảng đối chiếu số lượng (mục 3.8.2) vì không có bản ghi đích.
2. Nếu có dataset cũ có **nhiều sheet** (`source_index > 0`) → báo cáo phải nêu rõ **những sheet ngoài sheet đầu tiên bị mất dữ liệu**.
3. Mọi tham chiếu `sheet_id` trong collection cũ (`dataset_records`, `ai_jobs`, `analysis_results`) → `null` khi migrate (mục 3.6.6 quy tắc 4, mục 3.6.13).

#### 3.6.16. `finding_feedback` + `feedback_example` — **collection mới, không có nguồn migrate** (v4)

> **v4:** Hai collection này phục vụ tính năng nhận xét kết quả (UC-68…UC-72) — hệ thống cũ **không có** tính năng này nên không có dữ liệu để chuyển đổi.

| Collection | Hành động | Ghi chú |
|---|---|---|
| `finding_feedback` | Tạo collection + index, **0 bản ghi** | Dữ liệu bắt đầu từ ngày hệ thống mới chạy |
| `feedback_example` | Tạo collection + index (Atlas Vector Search), **0 bản ghi** | Kho mẫu được sinh dần từ nhận xét đã ẩn danh hoá |

**Quy tắc bắt buộc:**
1. Hai collection này **không có nguồn** → **không** có script migrate riêng; chỉ cần `db:indexes:sync` tạo index (Phần 8 v4 mục 3.7.5–3.7.6).
2. `verify` phải xác nhận cả hai collection **tồn tại** và có đủ index — kể cả khi rỗng.
3. Vector index trên `feedback_example.embedding` cần **Atlas Vector Search** — nếu chưa bật, index tạo thất bại → migration **fail** với lỗi rõ ràng, không bỏ qua.
4. Không có dữ liệu feedback cũ → **bộ benchmark AI mới** (Phần 13) phải lấy mẫu từ nhận xét **sau** khi hệ thống chạy, không dùng dữ liệu migrate.

### 3.7. Xoá collection LEGACY

#### 3.7.1. Danh sách xoá

| Collection | Lý do | Dữ liệu mất |
|---|---|---|
| `clean_rules` | Module LEGACY — không còn tính năng tương ứng trong 77 tính năng | Quy tắc làm sạch tự định nghĩa |
| `lineage` | Module LEGACY — đồ thị lineage | — |
| `lineage_nodes` | Module LEGACY | Node lineage |
| `exports` | Module LEGACY | Task export |
| `export_tasks` | Module LEGACY | Task export (bản trùng) |
| `dataset_versions` | **v4** — không migrate (mục 3.6.9), phiên bản bị bỏ | Lịch sử phiên bản dataset |
| `dataset_sheet` | **v4** — gộp vào `dataset` (chỉ `.csv`, 1 file = 1 bảng) | Thông tin sheet + phần sheet thừa của dataset đa sheet |

**Ghi chú quan trọng:** ~~`dataset_version.change_summary.rule_ids` tham chiếu tới `clean_rules`~~ — **bỏ 2026-11-05**: cả `dataset_version` và `clean_rules` đều không được migrate, nên không còn quan hệ tham chiếu nào cần bảo toàn (mục 3.6.9).

#### 3.7.2. Script `drop-legacy-collections.ts`

```typescript
// scripts/drop-legacy-collections.ts
const LEGACY_COLLECTIONS = [
  'clean_rules',
  'lineage',
  'lineage_nodes',
  'exports',
  'export_tasks',
  'dataset_versions', // v4: không migrate (mục 3.6.9)
  'dataset_sheet',    // v4: gộp vào `dataset` — chỉ hỗ trợ .csv
];

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';

  // Chặn xoá khi chưa verify
  if (mode === 'apply') {
    const verified = await db.collection('migration_checkpoint')
      .findOne({ key: 'verify_passed', value: true });
    if (!verified) {
      throw new Error('Verify chưa pass — không được xoá collection LEGACY');
    }
  }

  for (const name of LEGACY_COLLECTIONS) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) continue;
    const count = await db.collection(name).countDocuments();
    if (mode === 'apply') {
      await db.collection(name).drop();
      log(`dropped ${name} (${count} docs)`);
    } else {
      log(`would drop ${name} (${count} docs)`);
    }
  }
}
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Script **chặn** nếu `migration_checkpoint.verify_passed` chưa được set — không cho xoá trước khi kiểm chứng |
| 2 | Chạy **sau** khi smoke test production đã pass, **không** chạy ngay sau cutover |
| 3 | Trước khi drop, **export** số lượng document ra báo cáo — để biết mất bao nhiêu |
| 4 | Nếu có bất kỳ collection nào trong danh sách **không tồn tại** → bỏ qua, không lỗi |

#### 3.7.3. Xoá module `lineage` và Neo4j

**Quyết định 10:** xoá hoàn toàn.

**Các bước xoá (thực hiện trong đợt tái cấu trúc code, không phải trong migration script):**

| # | Bước | Chi tiết |
|---|---|---|
| 1 | Xoá thư mục module | `src/modules/lineage/` (toàn bộ) |
| 2 | Xoá service | `src/shared/database/neo4j.service.ts` |
| 3 | Gỡ khỏi `database.module.ts` | Bỏ `Neo4jService` khỏi `providers`, `exports` |
| 4 | Gỡ khỏi `app.module.ts` | Bỏ `LineageModule` khỏi `imports` |
| 5 | Gỡ khỏi `app.controller.ts` | Bỏ route health check phụ thuộc Neo4j |
| 6 | Gỡ biến môi trường | Xoá `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` khỏi `.env.example` và `env.validation.ts` |
| 7 | Gỡ khỏi `env.validation.ts` | Bỏ schema validate Neo4j |
| 8 | Xoá graph trên AuraDB | `MATCH (n) DETACH DELETE n` — **thực hiện thủ công** qua AuraDB UI hoặc Cypher console |
| 9 | Huỷ đăng ký AuraDB | Xoá instance AuraDB free tier trong console của hãng |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Bước 8 phải chạy **trước** bước 9 — xoá graph rồi mới huỷ instance |
| 2 | Bước 8 cần xác nhận từ người dùng — xoá dữ liệu không thể hoàn tác nếu đã huỷ instance |
| 3 | Thực hiện **sau** khi cutover thành công và smoke test pass — không làm trước |
| 4 | Ghi lại URL AuraDB instance trong log bàn giao để tra cứu nếu cần khôi phục trong thời gian ngắn |

#### 3.7.4. Xoá 3 module LEGACY khỏi code

Tương tự mục 3.7.3, cho `clean-rules` và `exports`:

| Module | Bước gỡ |
|---|---|
| `clean-rules` | Xoá `src/modules/clean-rules/`, gỡ `CleanRulesModule` khỏi `app.module.ts` |
| `versions` | Xoá `src/modules/versions/`, gỡ `VersionsModule` — **bỏ 2026-11-05** |
| `cell-edit` | Xoá `src/modules/cell-edit/`, gỡ `CellEditModule` — **bỏ 2026-11-05** |
| `exports` | Xoá `src/modules/exports/`, gỡ `ExportsModule` khỏi `app.module.ts` |

**Ghi chú:** `exports` có thể trùng chức năng với `reports` (PDF) trong thiết kế mới — nhưng là chức năng khác (PDF tổng kết vs. export dữ liệu). Xác nhận với người dùng trước khi xoá.

### 3.8. Kiểm chứng dữ liệu

#### 3.8.1. Ba mức kiểm chứng

**Quyết định 9:** đối chiếu số document + hash mẫu ngẫu nhiên 1% + referential integrity.

```
╔══════════════════════════════════════════════════════════════╗
║  MỨC 1 — ĐỐI CHIẾU SỐ LƯỢNG (tất cả collection)              ║
║  So sánh countDocuments() cũ vs mới                         ║
║  Dung sai lệch cho phép: 0 (trừ bản ghi bỏ qua có lý do)   ║
╠══════════════════════════════════════════════════════════════╣
║  MỨC 2 — HASH MẪU NGẪU NHIÊN 1% (mọi collection có dữ liệu) ║
║  Chọn ngẫu nhiên 1% document, so sánh hash nội dung đã map  ║
║  Dung sai lệch cho phép: 0                                   ║
╠══════════════════════════════════════════════════════════════╣
║  MỨC 3 — REFERENTIAL INTEGRITY (toàn bộ)                     ║
║  Mọi khóa ngoại phải trỏ tới document tồn tại                ║
║  Dung sai lệch cho phép: 0                                   ║
╚══════════════════════════════════════════════════════════════╝
```

#### 3.8.2. Mức 1 — đối chiếu số lượng

| Collection cũ | Collection mới | Quan hệ kỳ vọng |
|---|---|---|
| `users` | `user` | `new = old` |
| `user_sessions` | `user_session` | `new = old - sessionsHếtHạn` |
| `workspaces` | `workspace` | `new = old` |
| *(từ `workspaces.members[]`)* | `workspace_member` | `new = tổng phần tử members - membersBỏQua` |
| `projects` | `project` | `new = old - projectsBỏQua` |
| *(sinh từ quy tắc 3.6.4.1)* | `project_member` | `new = Σ(project × thành viên)` — tính trước |
| `datasets` | `dataset` | `new = old - datasetsBỏQua` (gồm dataset không phải CSV) |
| `dataset_records` | `dataset_record` | `new = old - recordsBỏQua` |
| `dataset_versions` | ~~`dataset_version`~~ | **KHÔNG MIGRATE** (mục 3.6.9) → `new = 0` |
| `outbox_events` | `outbox_event` | `new = old` |
| `ai_jobs` | `ai_job` | `new = old - jobsBỏQua` |
| `analysis_results` | `analysis_run` + `analysis_result` + `cell_evidence` | `new ≥ old` (tách 1 → N) |
| `dataset_sheet` | ~~`dataset_sheet`~~ | **KHÔNG MIGRATE — XOÁ** (mục 3.6.15) → `new = 0` |
| — | `processed_event` | `new = 0` — chưa có consumer nào chạy |
| — | `notification`, `issue_report`, `audit_log`, `audit_change`, `project_save` | `new = 0` — collection mới, không migrate |
| — | `finding_feedback` | `new = 0` — collection mới (v4, mục 3.6.16) |
| — | `feedback_example` | `new = 0` — collection mới (v4, mục 3.6.16) |

**Quy tắc bắt buộc:**
1. Mỗi collection có **kỳ vọng công thức** riêng — không dùng một quy tắc chung.
2. Sai lệch ≠ 0 mà **không** khớp công thức → **fail verify**.
3. Sai lệch khớp công thức (VD `old - sessionsHếtHạn`) → **pass** nhưng phải in ra giá trị đã bỏ qua.
4. In bảng đối chiếu ra stdout dưới dạng JSON.

#### 3.8.3. Mức 2 — hash mẫu ngẫu nhiên 1%

**Cơ chế:**

```
1. Lấy danh sách _id cũ (dùng .sample() hoặc aggregation $sample)
2. Với mỗi _id cũ → tra id_map → lấy _id mới
3. Chuẩn hoá cả 2 document về cùng dạng so sánh:
   - Bỏ _id (khác nhau do map)
   - Bỏ created_at/updated_at nếu được tạo mới
   - Map tên trường về tên trường mới
   - Với dataset_record: map props về data (đảo ngược key c → tên cột)
4. Sort key, JSON.stringify, sha256
5. So sánh hash
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Tỉ lệ mẫu = **1%**, tối thiểu 100 document, **tối đa 10.000** (để không mất quá nhiều thời gian) |
| 2 | Mẫu chọn **ngẫu nhiên** — không lấy 100 document đầu tiên (có thể không đại diện) |
| 3 | `dataset_record` so sánh **đảo ngược** `props` → `data` — kiểm tra đúng logic map tên → `c0`/`c1` |
| 4 | Sai khác → in **chi tiết** khác biệt (tối đa 5 field) cho tối đa 10 document đầu |
| 5 | Dung sai lệch = 0 mới pass |
| 6 | Với `dataset_record` 1 triệu dòng → mẫu 10.000 document → xử lý song song 4 luồng để giữ thời gian dưới 2 phút |

**Lưu ý về `dataset_record`:** so sánh phải **đảo ngược** map — nếu không, mọi document sẽ "khác nhau" vì key khác (`c0` vs `"Tuổi"`). Đây là chỗ dễ làm sai nhất.

#### 3.8.4. Mức 3 — referential integrity

| Quan hệ | Kiểm tra |
|---|---|
| `workspace_member.workspace_id` → `workspace._id` | Mọi tham chiếu phải tồn tại |
| `workspace_member.user_id` → `user._id` | Mọi tham chiếu phải tồn tại |
| `project.workspace_id` → `workspace._id` | Mọi tham chiếu phải tồn tại |
| `project_member.project_id` → `project._id` | Mọi tham chiếu phải tồn tại |
| `project_member.user_id` → `user._id` | Mọi tham chiếu phải tồn tại |
| `dataset.project_id` → `project._id` | Mọi tham chiếu phải tồn tại |
| `dataset.workspace_id` → `workspace._id` | Mọi tham chiếu phải tồn tại |
| ~~`dataset_sheet.dataset_id` → `dataset._id`~~ | **v4: bỏ** — không còn `dataset_sheet` |
| `dataset_record.dataset_id` → `dataset._id` | Mọi thambda chiếu phải tồn tại |
| ~~`dataset_record.sheet_id` → `dataset_sheet._id`~~ | **v4: bỏ** — không còn `sheet_id` |
| ~~`dataset_version.dataset_id` → `dataset._id`~~ | **v4: bỏ** — `dataset_version` không migrate |
| `analysis_run.dataset_id` → `dataset._id` | Hoặc `null` |
| `analysis_run.project_id` → `project._id` | Hoặc `null` |
| `analysis_result.run_id` → `analysis_run._id` | Mọi tham chiếu phải tồn tại |
| `analysis_result.dataset_id` → `dataset._id` | Hoặc `null` |
| `cell_evidence.result_id` → `analysis_result._id` | Mọi tham chiếu phải tồn tại |
| `ai_job.dataset_id` → `dataset._id` | Hoặc `null` |
| `finding_feedback.analysis_run_id` → `analysis_run._id` | Hoặc `null` |
| `finding_feedback.finding_id` → `analysis_result._id` | Hoặc `null` |
| `finding_feedback.project_id` → `project._id` | Bắt buộc |
| `feedback_example.source_feedback_id` → `finding_feedback._id` | Bắt buộc |
| `outbox_event.aggregate_id` | Không kiểm tra — là string tự do |
| `notification.user_id` → `user._id` | Mọi tham chiếu phải tồn tại |
| `issue_report.*_id` → tương ứng | Mọi tham chiếu phải tồn tại |

**Quy tắc bắt buộc:**
1. Dùng `$lookup` với `let`/`pipeline` hoặc query song song — **không** N+1.
2. Kết quả: danh sách khóa ngoại "mồ côi" (orphan) — phải **rỗng**.
3. Nếu có orphan → **fail verify**, in tối đa 50 ví dụ.

#### 3.8.5. Bổ sung — kiểm tra quyền (bắt buộc)

**Đây là kiểm tra riêng, không nằm trong 3 mức trên** — vì quyền là thứ khó phát hiện bằng đếm.

| Kiểm tra | Kỳ vọng |
|---|---|
| Mỗi workspace có **đúng 1** `workspace_member` với `role: 'owner'` | 0 vi phạm |
| `workspace_member.user_id` của Owner khớp `workspace.owner_id` | 100% khớp |
| Mỗi project có **đúng 1** `project_member` với `role: 'owner'` | 0 vi phạm (trừ project không có `created_by` — đã cảnh báo) |
| Mọi thành viên workspace có `project_member` trong project thuộc workspace | 100% |
| Không có `workspace_member` trùng `(workspace_id, user_id)` | 0 vi phạm |
| Không có `project_member` trùng `(project_id, user_id)` | 0 vi phạm |

**Quy tắc:** vi phạm quyền → **fail verify**. Lý do: nếu không kiểm tra, người dùng có thể mất quyền truy cập mà không ai biết.

#### 3.8.6. Script `verify-migration.ts`

```typescript
// scripts/verify-migration.ts — chế độ read-only, không bao giờ ghi
const results = {
  level1_counts: await verifyCounts(db),
  level2_hashes: await verifyHashSamples(db),
  level3_referential: await verifyReferentialIntegrity(db),
  permissions: await verifyPermissions(db),
};

const passed =
  results.level1_counts.passed &&
  results.level2_hashes.passed &&
  results.level3_referential.passed &&
  results.permissions.passed;

if (passed) {
  await db.collection('migration_checkpoint')
    .updateOne({ key: 'verify_passed' }, { $set: { value: true, at: new Date() } }, { upsert: true });
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
process.exit(passed ? 0 : 1);
```

**Ghi chú:** dòng `updateOne` set `verify_passed` là **ngoại lệ duy nhất** cho quy tắc "verify không bao giờ ghi" — nó ghi vào `migration_checkpoint`, không phải collection nghiệp vụ. Điều này cần thiết cho script xoá LEGACY (mục 3.7.2 quy tắc 1).

### 3.9. Cơ chế rollback

#### 3.9.1. Ba mức rollback

```
MỨC 1 — ROLLBACK CODE              (~3 phút)
│ Đổi trở lại code cũ, collection cũ còn nguyên
│ Áp dụng: lỗi logic, không có migration chạy
│
MỨC 2 — ROLLBACK KÈM DỮ LIỆU      (~15–60 phút)
│ Xoá collection mới, chạy lại code cũ
│ Áp dụng: code mới đã chạy và ghi dữ liệu mới, cần quay lại trạng thái cũ
│
MỨC 3 — RESTORE TỪ BACKUP          (~30 phút – 2 giờ)
│ Khôi phục từ Atlas PITR hoặc snapshot R2
│ Áp dụng: dữ liệu cũ bị hỏng trong quá trình migrate
└─────────────────────────────────────────────────────────────────────
```

#### 3.9.2. Mức 1 — rollback code

| # | Bước | Chi tiết |
|---|---|---|
| 1 | Dừng container mới | `docker compose stop api worker` |
| 2 | Deploy lại commit cũ | `git checkout <commit-cũ> && docker compose up -d` |
| 3 | Kiểm tra | API đọc collection **cũ** — dữ liệu cũ **chưa bị đụng đến** nên hoạt động ngay |

**Điều kiện áp dụng:** chỉ dùng được nếu code mới **chưa ghi** gì đáng kể vào collection mới, hoặc ghi vào collection mới không ảnh hưởng code cũ (đúng với chiến lược "collection song song").

**Ưu điểm lớn của chiến lược đã chọn:** vì collection cũ **hoàn toàn không bị sửa**, mức 1 luôn khả dụng. Không cần rollback dữ liệu.

#### 3.9.3. Mức 2 — rollback kèm dữ liệu

**Khi nào cần:** code mới đã chạy, người dùng đã tạo dữ liệu mới (dataset mới, project mới) không có trong collection cũ → mức 1 sẽ làm mất dữ liệu đó.

| # | Bước | Chi tiết |
|---|---|---|
| 1 | Export dữ liệu mới | `mongodump` các collection mới → file riêng (giữ lại, không xoá) |
| 2 | Dừng container | `docker compose stop api worker` |
| 3 | Xoá collection mới | Chỉ xoá 21 collection mới — **không** đụng collection cũ |
| 4 | Deploy code cũ | `git checkout <commit-cũ> && docker compose up -d` |
| 5 | Smoke test code cũ | Kiểm tra đăng nhập, xem workspace, xem project |

**Quy tắc bắt buộc:**
1. Bước 3 xoá **chỉ** collection mới — xác định bằng danh sách cố định, không quét theo pattern.
2. Dữ liệu mới tạo sau cutover **mất** — không tránh được với chiến lược không dual-write. Đây là đánh đổi đã chấp nhận.
3. Nếu cần giữ dữ liệu mới → dùng mức 3 (restore từ backup) thay vì mức 2.

#### 3.9.4. Mức 3 — restore từ backup

Áp dụng quy trình đã thiết kế ở **Phần 10 mục 3.9.3**:
1. Tạo cluster Atlas mới (M10, cùng region)
2. Đổi `DB_URI`
3. `mongorestore` từ snapshot R2 hoặc dùng PITR của Atlas
4. Kiểm tra 5 điểm sau restore (Phần 10 mục 3.9.3)
5. Restart + kiểm tra health

**Quy tắc:** mức 3 **mất toàn bộ dữ liệu** phát sinh sau thời điểm backup — kể cả dữ liệu hợp lệ. Chỉ dùng khi mức 1 và 2 không đủ.

#### 3.9.5. Ma trận quyết định mức rollback

| Tình huống | Mức |
|---|---|
| Smoke test fail ngay sau deploy, chưa có người dùng thật | **1** |
| Lỗi hiển thị trên 1 màn hình, không ảnh hưởng ghi dữ liệu | **1** |
| Đã có người dùng tạo dữ liệu mới, cần trở về trạng thái cũ | **2** |
| Dữ liệu cũ bị hỏng trong lúc migrate (hiếm — vì migrate chỉ đọc cũ) | **3** |
| Migrate làm hỏng collection cũ do bug trong script | **3** |

#### 3.9.6. Bảo đảm collection cũ không bị sửa

**Đây là điều kiện tiên quyết để mức 1 luôn khả dụng.**

| # | Quy tắc |
|---|---|
| 1 | Script migration **chỉ đọc** collection cũ — không `updateOne`, `deleteOne`, `findOneAndUpdate` trên collection cũ |
| 2 | Tài khoản MongoDB dùng cho migration nên có quyền **chỉ đọc** trên collection cũ và **đọc/ghi** trên collection mới — phân quyền ở tầng Atlas |
| 3 | Nếu không phân quyền được → dùng **tài khoản riêng** cho migration với quyền hạn chế |
| 4 | Kiểm tra tự động: sau migrate, so sánh `countDocuments()` + hash mẫu của collection cũ với giá trị ghi lại **trước** khi bắt đầu — phải khớp 100% |
| 5 | Ghi lại `checksum` tổng của collection cũ vào `migration_checkpoint` trước khi bắt đầu |

### 3.10. Kiểm thử sau cutover

#### 3.10.1. Smoke test tự động

| # | Kịch bản | Kết quả mong đợi |
|---|---|---|
| 1 | Health endpoint | `/api/v1/health/ready` trả 200, `mongodb.transactions = true` |
| 2 | Đăng nhập bằng tài khoản có sẵn | 200, nhận access + refresh token |
| 3 | Xem danh sách workspace của tôi | Trả về đúng danh sách — **kiểm tra số lượng khớp dữ liệu cũ** |
| 4 | Xem workspace → danh sách project | Đúng project, đúng `status` |
| 5 | Xem project → danh sách dataset | Đúng dataset, đúng `row_count`, `column_count` |
| 6 | Mở dataset → xem 20 dòng đầu | Giá trị hiển thị **giống hệt** hệ thống cũ |
| 7 | Lọc dữ liệu theo 1 cột | Kết quả đúng — **kiểm tra map `c0`/`c1` hoạt động** |
| 8 | Đổi tên 1 cột | Đổi tên thành công, dữ liệu không đổi — **kiểm tra key `c0` ổn định** |
| 9 | Chạy phân tích DQ-01 | Chạy được, trả kết quả |
| 10 | Chạy AI giải thích | Job 202 Accepted → hoàn tất (dùng model cục bộ) |
| 11 | **v4** Upload file `.xlsx` | Từ chối với `UNSUPPORTED_FILE_TYPE` |
| 12 | **v4** Upload file `.csv` | Chấp nhận, tạo dataset với `columns[].key = c0/c1…` |
| 13 | **v4** Phân trang danh sách kết quả | Trả `nextCursor` + `hasMore`; lấy trang sau bằng cursor → không trùng/không thiếu |
| 14 | **v4** Gửi nhận xét cho 1 phát hiện | `201`, lưu vào `finding_feedback`; đọc lại được nhận xét đúng |
| 15 | **v4** Kiểm tra `finding_feedback` | Có `ai_confidence` snapshot đúng với giá trị lúc nhận xét |
| 16 | **v4** Kafka | Sự kiện phân tích xuất hiện trong topic `domain.events`; consumer group lag = 0 |
| 17 | **v4** Socket.IO | Kết nối `/api/v1/realtime?token=…` → nhận event khi phân tích xong |

#### 3.10.2. Đối chiếu thủ công với hệ thống cũ

**Bắt buộc** — không thể tự động hết:

| # | Đối chiếu | Cách |
|---|---|---|
| 1 | Số workspace của 1 tài khoản | So sánh số giữa collection cũ và mới |
| 2 | Số project trong 1 workspace | So sánh |
| 3 | Số dataset + tổng số dòng | So sánh — **số dòng quan trọng nhất** |
| 4 | Giá trị 5 dòng dữ liệu bất kỳ | So sánh từng ô |
| 5 | Quyền của Workspace Owner | Xem được mọi project trong workspace |
| 6 | Quyền của thành viên thường | Xem được project của workspace |
| 7 | Thông báo cũ (nếu có) | Không có — `notification` là collection mới, **không migrate** |
| 8 | Lịch sử phiên bản dataset | Xem được, `rule_ids` còn nguyên |

#### 3.10.3. Rollback drill

**Quy tắc bắt buộc:** trước khi cutover production, phải **diễn tập** mức 1 và mức 2 trên staging, ghi lại thời gian thực tế.

| Mức | Kỳ vọng | Ghi nhận |
|---|---|---|
| 1 | < 5 phút | Thời gian thực tế: ___ |
| 2 | < 30 phút | Thời gian thực tế: ___ |

### 3.11. Xử lý sự cố migration

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Script dừng giữa chừng | Lỗi mạng, R2 timeout | Chạy lại — idempotent, tiếp tục từ checkpoint |
| `BulkWriteError` duplicate key | Chạy lại lần 2 | **Bình thường** — bỏ qua duplicate, không phải lỗi |
| Số document mới **ít hơn** cũ | Quan hệ cha-con bị bỏ qua | Kiểm tra báo cáo "bản ghi bị bỏ qua" — nếu > 1% thì dừng |
| Hash mẫu lệch | Logic map `data` → `props` sai | Dừng, sửa script, chạy lại (xem mục 3.12.1) |
| Orphan phát hiện ở mức 3 | Bỏ sót bước map | Dừng, sửa, chạy lại |
| Vi phạm "1 Owner mỗi workspace" | Dữ liệu cũ lệch | Áp dụng quy tắc 3.6.3 #2/#3/#4 — tự sửa khi migrate |
| `storage_used_bytes` sai | Tính trước khi migrate dataset | Chạy lại script tính quota **sau** `migrate-04` |
| R2 tải file checksum lỗi | File không còn trên R2 | `content_fingerprint = null` + cảnh báo — không chặn |
| MongoDB hết dung lượng | Tạm thời × 2 | Atlas M10 có 10 GB — nếu không đủ thì nâng cấp tier |
| Migration quá 2 giờ | > 5 triệu record | Dừng, chia thành nhiều đợt, hoặc chạy offline song song |
| `verify` fail vì `processed_event` khác 0 | Có consumer đã chạy | Xoá `processed_event` (collection hạ tầng, không có dữ liệu nghiệp vụ) rồi verify lại |

#### 3.12.1. Quy trình xử lý khi verify fail

```
1. DỪNG — không deploy code mới
2. Đọc báo cáo verify, xác định mức fail (1, 2, 3, hay quyền)
3. Sửa script migration
4. Xoá toàn bộ collection mới đã tạo dễ sai   ← bắt buộc
5. Chạy lại migrate --apply
6. Chạy lại verify
7. Nếu pass → tiếp tục cutover
8. Nếu vẫn fail → rollback mức 1 (đơn giản, collection cũ nguyên vẹn)
```

**Quy tắc bắt buộc:**
1. Bước 4 **bắt buộc** — chạy lại trên dữ liệu cũ đã convert một phần sẽ cho kết quả sai (VD `props` đã có `c0`, chạy lại sẽ map `c0` → `c0`).
2. Xoá collection mới = danh sách cố định 21 collection, **không** xoá `id_map` và `migration_checkpoint` (giữ để tra cứu).
3. `id_map` giữ nguyên khi xoá collection mới — nếu chạy lại, `resolve()` trả về ID cũ đã cấp → vẫn đúng.

### 3.13. Quy tắc kiểm thử migration

| # | Kiểm tra |
|---|---|
| M1 | `migrate` **mặc định** là `dry-run` — không ghi gì vào database |
| M2 | `--apply` yêu cầu `MIGRATION_CONFIRM=yes` hoặc `NODE_ENV=production` |
| M3 | Chạy `migrate --apply` 2 lần cho kết quả giống hệt — idempotent |
| M4 | `verify` **không bao giờ** ghi vào collection nghiệp vụ |
| M5 | Đối chiếu số lượng khớp công thức kỳ vọng ở mục 3.8.2 |
| M6 | Hash mẫu 1% — sai lệch 0 |
| M7 | Referential integrity — 0 orphan |
| M8 | Mỗi workspace đúng 1 Owner; Owner khớp `workspace.owner_id` — 0 vi phạm |
| M9 | Mỗi project đúng 1 Owner `project_member` — 0 vi phạm |
| M10 | Mọi thành viên workspace có `project_member` trong project — 100% |
| M11 | Không có bản ghi trùng `(workspace_id, user_id)` hay `(project_id, user_id)` |
| M12 | Collection cũ **không bị sửa** — checksum trước/sau khớp 100% |
| M13 | Mọi giá trị ô trong `cell_evidence.value_masked` đã che PII |
| M14 | `dataset_record.props` dùng key `c0`/`c1` — không còn key là tên cột |
| M14b | **v4:** `dataset_sheet` **không tồn tại** trong collection mới sau cutover |
| M14c | **v4:** Mọi `dataset` có `columns[]` với `key` = `c{i}` đúng thứ tự vị trí |
| M14d | **v4:** Mọi `dataset.file_format` = `csv` — không còn `xlsx`/`json` |
| M14e | **v4:** `finding_feedback` và `feedback_example` tồn tại và có đủ index (kể cả khi rỗng) |
| M15 | `dataset_record.props` đảo ngược map cho ra `data` cũ giống hệt |
| M16 | `project.status` khớp quy tắc ở mục 3.6.5 cho 100% project |
| M17 | Số bản ghi bị bỏ qua ≤ 1% — nếu vượt, verify phải cảnh báo |
| M18 | `id_map` có unique `(entity_type, old_id)` |
| M19 | `outbox_event.status` chỉ nhận 4 giá trị hợp lệ |
| M20 | `drop-legacy-collections.ts` **từ chối** chạy khi `verify_passed` chưa được set |
| M21 | Script drop chỉ xoá **7** collection LEGACY — không xoá collection khác |
| M22 | Sau cutover, mọi request vẫn trả đúng dữ liệu như hệ thống cũ |
| M23 | Rollback mức 1 khôi phục được chức năng trong < 5 phút |
| M24 | Backup trước cutover tồn tại và **đã được restore thử** |

### 3.14. Đối chiếu với quy trình vận hành (Phần 10)

| Yêu cầu của Phần 10 | Đáp ứng ở Phần 11 |
|---|---|
| Mọi migration có `up()` và `down()` (mục 3.10.4 quy tắc 3) | `migrate-*.ts` với `--apply` / `--dry-run` (coi như `up`); `down` = rollback mức 2 (mục 3.9.3) |
| Migration **idempotent** (quy tắc 4) | Quy tắc M3 + cơ chế `upsert` theo `_id` (mục 3.4.4) |
| Migration **không xoá dữ liệu cũ** (quy tắc 6) | Collection cũ **không bị sửa** — bảo đảm bằng quy tắc M12 |
| Migration ghi log số document bị ảnh hưởng (quy tắc 5) | Mọi script in báo cáo JSON (mục 3.4.2) |
| Migration chạy **trước** khi start API mới (quy tắc 7) | Bước 3–5 trong quy trình cutover (mục 3.3) |
| Deploy dừng `api`, giữ `worker` (quy tắc 2) | **Sửa:** trong cutover phải dừng **cả 2** — vì worker cũ có thể ghi vào collection cũ trong lúc migrate |
| Rollback L1 khả dụng (mục 3.10.3 quy tắc 1) | Mức 1 rollback code (mục 3.9.2) |
| Backup trước cutover | Bước 1 (mục 3.3) — khuyến nghị, không chặn |

**Điểm khác biệt cần lưu ý:** Phần 10 mục 3.10.2 quy tắc 2 nói *"Dừng api trước, giữ worker chạy để không mất job"* — quy tắc này đúng cho deploy thường, nhưng **không đúng** cho cutover migration. Lý do: worker cũ đang xử lý job và ghi vào collection cũ (`outbox_events`) → nếu chạy song song với migration sẽ ghi thêm record sau khi đã đếm → sai lệch số lượng. Vì vậy cutover dừng **cả 2**, chấp nhận job phải xử lý lại sau.

**v4 — job không mất khi dừng worker:** với hạ tầng **Kafka**, message đang chờ nằm bền vững trên disk (`kafka-data` volume) và consumer chưa commit offset → sau khi bật lại worker, message được đọc lại. Đây là lý do **không cần** dựa vào `Redis appendonly yes` cho việc bảo toàn job nữa (BullMQ đã bị gỡ).

**Cần cập nhật:** Phần 10 v2 sẽ ghi rõ ngoại lệ này.

### 3.15. Đối chiếu với bảng schema (Phần 8 v2)

| Câu hỏi mở ở Phần 4 mục 6 | Trả lời ở Phần 11 |
|---|---|
| #5 — Migration chạy song song 2 backend trên cùng MongoDB với collection prefix khác nhau, hay dùng collection mới hoàn toàn? | **Dùng collection mới hoàn toàn** (quyết định 1). Không dùng prefix — vì collection mới có tên khác hẳn (`users` → `user`), đủ để phân biệt |
| #6 — `has_dataset` cũ dùng để suy ra trạng thái project — project nào coi là `in_progress`? | Quy tắc ở mục 3.6.5: có dataset `READY`/`INGESTING` → `in_progress`, còn lại → `draft` |

### 3.16. Ước tính thời gian và tài nguyên

| Hạng mục | Ước tính |
|---|---|
| Thời gian viết 8 script migration | 3–5 ngày công |
| Thời gian viết `verify-migration.ts` | 1–2 ngày công |
| Thời gian diễn tập trên staging | 1 ngày công |
| Dung lượng tạm thời | × 2 (collection cũ + mới) — cần ≥ 2 × dung lượng hiện tại |
| Downtime production | 30 phút – 2 giờ (tuỳ khối lượng record) |

**Điều kiện cần xác nhận trước khi lên kế hoạch:** số lượng `dataset_record` thực tế. Đây là con số quyết định downtime.

### 3.17. Điều kiện hoàn tất phần này

Chiến lược chuyển đổi, quy trình cutover, quy tắc ánh xạ dữ liệu, cơ chế kiểm chứng, rollback và xử lý sự cố đã rõ ràng.

**Trạng thái v4:** 15 quyết định migration đã chốt. 17 collection cũ → **21 collection mới** có quy tắc ánh xạ chi tiết (không migrate: `dataset_versions`, `dataset_sheet`; không có nguồn: `finding_feedback`, `feedback_example`). Quy trình cutover 8 bước, bộ công cụ 3 chế độ, kiểm chứng 4 mức, rollback 3 mức, **29 quy tắc kiểm thử M1–M29**. Còn 3 câu hỏi mở tại mục 6.2.

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 4 v2 — ranh giới module, danh sách module LEGACY cần xoá, câu hỏi mở #5 và #6.
- Phần 5 v1 mục 3.9 — optimistic locking (`version`).
- Phần 6 v3 — mô hình quyền `owner`/`member`, quy tắc Workspace Owner không cần `project_member`.
- **Phần 8 v4** mục 3.6.2, 3.7.5–3.7.6, 3.11 — bảng đối chiếu 17 collection cũ → 21 collection mới, gộp `dataset_sheet`, thêm 2 collection feedback.
- Phần 9 v1 — 13 tên sự kiện `dot.camelCase`, schema `outbox_event`, quy tắc idempotency.
- Phần 10 v1 mục 3.10.4 — 7 quy tắc migration (`up`/`down`, idempotent, không xoá dữ liệu cũ).
- Phần 12 v2 mục 3.10 — quy tắc che PII cho bằng chứng ô.
- Mã nguồn hiện tại — 10 schema Mongoose (`users`, `user_sessions`, `workspaces`, `projects`, `datasets`, `dataset_records`, `dataset_versions`, `outbox_events`, `clean_rules`, `export_tasks`), module `lineage` dùng **Neo4j AuraDB**, `BaseMongoRepository` với soft delete + ambient session.
- Quyết định của người dùng — 13 lựa chọn migration (2026-11-05).

**Đầu ra**
- 13 quyết định migration nền tảng.
- Chiến lược "collection mới song song" kèm đánh đổi (dung lượng × 2, rollback dễ).
- Quy trình cutover 8 bước với 7 quy tắc bắt buộc.
- Bộ công cụ: 8 script `ts-node` + `lib/` 5 module + 3 chế độ `--dry-run`/`--apply`/`--verify`.
- `BulkWriter` — batch 5.000, `ordered: false`, cơ chế idempotent qua `_id`, checkpoint để resume.
- Bảng `id_map` — cấu trúc, 2 index unique, cơ chế cấp phát ID có cache LRU, bảng mapping 13 loại ID.
- Quy tắc ánh xạ chi tiết cho **14 collection**, gồm các quy tắc xử lý dữ liệu lệch (thiếu Owner, nhiều Owner, Owner khác `owner_id`, `members[]` rỗng).
- **v4:** Quy tắc gộp `datasets.columns[]` → `dataset.columns[]` với `key` `c{i}` (mục 3.6.6.1); quy tắc bỏ qua dataset không phải CSV (mục 3.6.6 quy tắc 10); quy tắc xoá `dataset_sheet` (mục 3.6.15); xác nhận 2 collection feedback không có nguồn migrate (mục 3.6.16).
- Quy tắc sinh `project_member` từ 2 nguồn — quyết định thiết kế quan trọng nhất của phần này.
- Quy tắc chuẩn hoá `content_fingerprint` (`sha256:<hex>`) với chiến lược tránh đọc file R2.
- Quy tắc chuyển `data` → `props` (key `c0`/`c1`) kèm 7 quy tắc chống chạy sai khi idempotent.
- Quy tắc `project.status` từ `dataset.status` + 4 điều kiện đối chiếu bắt buộc.
- Script xoá **7** collection LEGACY với cơ chế chặn khi chưa verify (v3: 5, v4: + `dataset_versions`, + `dataset_sheet`).
- Quy trình gỡ Neo4j đầy đủ 9 bước (gồm xoá graph trên AuraDB và huỷ instance).
- Kiểm chứng 4 mức: số lượng theo công thức, hash mẫu 1% (có đảo ngược map cho `dataset_record`), referential integrity 20 quan hệ, kiểm tra quyền 6 tiêu chí.
- Rollback 3 mức + ma trận quyết định + cơ chế bảo đảm collection cũ không bị sửa.
- Smoke test 10 kịch bản tự động + 8 đối chiếu thủ công + rollback drill.
- Bảng 11 sự cố migration + quy trình 8 bước xử lý verify fail.
- **29 quy tắc kiểm thử M1–M29** (v4 thêm M14b–M14e).
- Bảng đối chiếu với Phần 10 — kèm **1 điểm cần sửa** (deploy thường dừng api/giữ worker, nhưng cutover phải dừng cả 2).

## 5. Điều kiện hoàn tất phần này

Chiến lược chuyển đổi, quy trình cutover, quy tắc ánh xạ dữ liệu, cơ chế kiểm chứng, rollback và xử lý sự cố đã rõ ràng.

**Trạng thái v4:** 15 quyết định migration đã chốt; 17 collection cũ → **21 collection mới** có quy tắc ánh xạ chi tiết; quy trình cutover 8 bước; bộ công cụ 3 chế độ; kiểm chứng 4 mức; rollback 3 mức; **29 quy tắc M1–M29**. Còn 3 câu hỏi mở tại mục 6.2.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Chiến lược migration tổng thể | **Collection mới song song**, giữ cũ 30 ngày (mục 3.2) |
| 2 | Viết lại `dataset_record` | **Bulk write theo lô** 5.000 + resume checkpoint (mục 3.4.4) |
| 3 | Ánh xạ `_id` | **ULID mới** + bảng `id_map` (mục 3.5) |
| 4 | Xoá collection LEGACY | **Ngay khi cutover thành công** (mục 3.7) |
| 5 | Giai đoạn dual-write | **Không** — cutover là một thời điểm cắt (mục 3.3) |
| 6 | Map vai trò workspace | `editor` → `member`, `viewer` → `member` (mục 3.6.3) |
| 7 | Suy ra `project.status` | Từ **`dataset.status`** (mục 3.6.5) |
| 8 | Công cụ migration | **Script `ts-node`**, 3 chế độ (mục 3.4) |
| 9 | Kiểm chứng | Số lượng + hash 1% + referential integrity + quyền (mục 3.8) |
| 10 | Xoá module `lineage` / Neo4j | **Xoá hoàn toàn**, gỡ 9 bước (mục 3.7.3) |
| 14 | Module `exports` (LEGACY) | **Xoá hẳn** — chốt ở Phần 13 v1 mục 3.1 quyết định 1; áp dụng mục 3.7.4 |
| 11 | Downtime | **Có maintenance window** (mục 3.3) |
| 12 | Backup trước cutover | **Khuyến nghị**, không chặn (mục 3.3 bước 1) |
| 13 | ~~Cấu trúc `dataset_sheet`~~ | **v4: đảo ngược** — không tạo `dataset_sheet`, cột nhúng vào `dataset` (mục 3.6.6) |
| 14 | **v4** Xoá `dataset_sheet` cũ | Thêm vào `LEGACY_COLLECTIONS` (mục 3.7.1–3.7.2, mục 3.6.15) |
| 15 | **v4** `finding_feedback` + `feedback_example` | Collection mới — không có nguồn migrate (mục 3.6.16) |

### 6.2. Còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | Số lượng `dataset_record` thực tế trong production là bao nhiêu? Quyết định downtime (ước tính 30p–2h) và có cần chia nhiều đợt không | Kế hoạch cutover | Phần 14 — cần đếm trước khi lên kế hoạch |
| 2 | Có cần giữ **audit log lịch sử** (thao tác trước tái cấu trúc) vào collection mới không? `audit_log` là collection mới, hiện không có dữ liệu để migrate | Bổ sung giá trị cho collection `audit_log` | Phần 14 — nếu cần thì định nghĩa nguồn dữ liệu |
| 3 | Module `exports` (LEGACY) xoá hẳn hay giữ lại chức năng export dữ liệu (khác PDF tổng kết)? | Phạm vi tính năng | Phần 2 v4 / Phần 14 — **đã chốt ở Phần 13 v1: xoá hẳn** (quyết định 1) |

**Phụ thuộc cứng:**
- Câu hỏi 1 **phải có đáp án** trước khi chốt lịch cutover production — nếu > 5 triệu record thì chiến lược 1 đợt không khả thi.
- Câu hỏi 3 **đã chốt** ở Phần 13 v1 (xoá hẳn module `exports`) → mục 3.7.4 áp dụng được ngay, gỡ module `exports` khỏi code trong đợt tái cấu trúc.
- Phần 14 (kế hoạch thực hiện) phải đặt migration **sau** khi deploy được code mới chạy đúng với schema mới trên collection rỗng — không thể migrate trước rồi mới viết code.

### 6.3. Phụ thuộc bên ngoài

- **MongoDB Atlas** — M10 cho staging/production, cần đủ dung lượng cho × 2 tạm thời.
- **Cloudflare R2** — file gốc giữ nguyên `storage_key`, không cần tải lại trừ trường hợp checksum không chuẩn (tối đa 100 file/đợt).
- **Quyền DB** — tài khoản migration nên có read-only trên collection cũ, read/write trên collection mới.
- **AuraDB** — cần xác nhận người dùng trước khi xoá graph và huỷ instance.
- **Redis** — `appendonly yes` để cache + Socket.IO adapter không mất trong maintenance window (không còn vai trò hàng đợi job).
- **Kafka** — volume `kafka-data` phải bền vững qua maintenance window; phải là broker KRaft single-node với `min.insync.replicas=1`.
- **Atlas Vector Search** — phải được bật trên cluster để tạo index vector cho `feedback_example.embedding`.
- **File model AI** — `Qwen3-14B` + `Qwen3-8B` phải được tải về VPS **trước** cutover (dung lượng ~12–13 GB); không có mô hình cục bộ thì tính năng AI không hoạt động.

## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 11 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v4 / 2026-11-05:** Áp dụng 4 quyết định 2026-11-05. (1) **Chỉ `.csv`**: `dataset_sheet` không còn được tạo — cột nhúng thẳng vào `dataset` với `key` `c{i}` (mục 3.6.6.1); dataset có `file_format ≠ csv` → bỏ qua kèm cảnh báo (mục 3.6.6 quy tắc 10); `dataset_sheet` thêm vào `LEGACY_COLLECTIONS` để xoá (mục 3.7.1–3.7.2, mục 3.6.15); bỏ `sheet_id` khỏi `dataset_record`. (2) **Feedback**: thêm mục 3.6.16 — `finding_feedback` + `feedback_example` là collection mới, không có nguồn migrate, chỉ tạo index. (3) **Kafka**: `ai_job` bỏ `bullmq_job_id`, thêm `model_id`/`prompt_version`/`kafka_partition`/`kafka_offset`; `outbox_event` publish ra Kafka. (4) **AI cục bộ**: `ai_job.model_id` = `null` cho job cũ (không quy được cho model nào) → loại khỏi thống kê so sánh model. Bổ sung quy tắc M14b–M14e, M21 cập nhật 5→6 collection LEGACY, smoke test thêm 7 kịch bản (11–17), 4 quan hệ referential integrity mới.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 13 quyết định migration; chiến lược "collection mới song song" với đánh đổi dung lượng × 2; quy trình cutover 8 bước; bộ công cụ 8 script `ts-node` + `lib/` 5 module với 3 chế độ `--dry-run`/`--apply`/`--verify`; `BulkWriter` batch 5.000 `ordered:false` + checkpoint; bảng `id_map` với cache LRU; quy tắc ánh xạ chi tiết cho 14 collection; quy tắc sinh `project_member` từ `workspace_member` + `project.created_by`; quy tắc chuẩn hoá `content_fingerprint`; quy tắc `data` → `props`; quy tắc `project.status`; script xoá LEGACY với cơ chế chặn; quy trình gỡ Neo4j 9 bước; kiểm chứng 4 mức (18 quy tắc kiểm thử M1–M24); rollback 3 mức + ma trận quyết định; smoke test 10 kịch bản + 8 đối chiếu thủ công; bảng 11 sự cố; quy tắc M12 bảo đảm collection cũ không bị sửa.
