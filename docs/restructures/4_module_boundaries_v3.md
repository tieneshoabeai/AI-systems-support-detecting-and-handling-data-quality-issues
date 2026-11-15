# 4. Ranh giới module và phân tích ảnh hưởng

- **Version:** v2
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-05
- **Trạng thái:** Đã chốt cấu trúc monorepo, danh sách module, ranh giới sở hữu dữ liệu, quy tắc dependency và chiến lược tái cấu trúc. Còn mở ở mục 6.
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 4; sử dụng kết quả đã xác nhận của phần 1 (v1), 2 (v3), 3 (v2), 6 (v3), 9 (v1), 12 (v2).
- **Thay đổi so với v1:** đồng bộ tên sự kiện nội bộ sang quy ước `dot.camelCase` theo Phần 7 mục 3.3 và Phần 9 mục 3.3.2; bổ sung collection `processed_event` (inbox); bổ sung cổng `publishing` cho `outbox_event`; đồng bộ mô hình vai trò workspace với Phần 6 v3 (collection `workspace_member` riêng, role `owner\|member`).
- **Quan hệ với các phần khác:** mọi ranh giới ở đây truy về `2_feature_catalog_v3.md` và `3_business_workflows_v2.md`. Phần này **không** tạo tính năng mới.

## 1. Mục tiêu

Làm rõ và thống nhất ranh giới module, quyền sở hữu dữ liệu và quy tắc dependency để đợt tái cấu trúc backend có thể triển khai mà không phát sinh phụ thuộc vòng.

## 2. Nội dung cần bàn luận

- Đối chiếu tính năng mới với implementation hiện tại: giữ, chỉnh sửa, thay thế hoặc loại bỏ.
- Trách nhiệm, quyền sở hữu dữ liệu và hợp đồng công khai của từng module.
- Dependency giữa module, điểm tái sử dụng và các phụ thuộc vòng cần xử lý.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Quyết định nền tảng — viết lại backend trong cây monorepo mới

**Quyết định (2026-11-05).** Backend được **viết lại** trong một cây monorepo mới, thay vì tái cấu trúc tại chỗ trong `src/backend/`.

| Nội dung | Quyết định |
|---|---|
| Hình thái cây | pnpm workspace: `apps/api`, `apps/worker`, `packages/core`, `packages/contracts` |
| Thư mục | Thay thế `src/backend/`; `src/frontend/` hiện **rỗng** (chưa có frontend) → không ràng buộc tương thích API |
| Trình quản lý gói | pnpm |
| Framework | NestJS 11, Mongoose 9, Zod 4 |
| Worker | App riêng `apps/worker`, dùng BullMQ + Redis |
| Đường dẫn URL | Thiết kế mới, dạng `/api/v1/...` (đã có global prefix `api/v1` ở mã nguồn hiện tại) |
| Lưu trữ file | Giữ R2 + local fallback, qua **port `Storage`** riêng (phần 2 mục 3.31.2) |
| Hàng đợi nền | **BullMQ + Redis** (thay cho polling worker MongoDB ở phần 2 mục 3.31.4) |
| Xuất PDF | **PDFKit** |
| Dữ liệu hiện có | **Có migration** từ collection/field cũ sang schema mới — thiết kế ở Phần 11 |
| Thứ tự viết lại | **Theo từng module**; mỗi module hoàn thành là dùng được. Chạy song song backend cũ/mới trong lúc chuyển tiếp |
| Module LEGACY | `clean-rules`, `lineage`, `exports`, `versions`, `cell-edit` → **xoá khỏi repo** khi backend mới đã chạy |
| Tái sử dụng code cũ | **Sao chép và cải thiện** các phần tốt sang cây mới; không import chéo giữa hai cây |

**Lý do chọn viết lại thay vì tái cấu trúc tại chỗ:**
1. Mã nguồn hiện tại dùng cấu trúc **phẳng** (`controller` / `service` / `schemas` trong cùng thư mục) — không phân biệt domain, application, infrastructure. Áp Ports and Adapters (đã chốt ở Phần 1) lên cấu trúc phẳng sẽ tạo ra nửa vời nửa thật.
2. Module `projects` **chưa có** danh sách vai trò project riêng — mô hình quyền đã chốt ở Phần 6 (`PROJ-OWNER` / `PROJ-MEMBER` / `PROJ-VIEWER`) chưa tồn tại trong code. Sửa trên nền cũ tốn công hơn viết lại.
3. Schema `workspace.members[].role` đang dùng `owner|editor|viewer` — sai với mô hình đã chốt (`owner|member`). Cần migration collection, tốn công nếu sửa lại dần.
4. Thêm `BullMQ`, `packages/core`, `packages/contracts` vào một câu trúc đơn lẻ sẽ tạo nợ kỹ thuật lớn hơn giá trị thu được.

**Đánh đổi đã chấp nhận:** chi phí viết lại lớn hơn, phải chạy song song trong giai đoạn chuyển tiếp, và có rủi ro frontend bị hỏng. Rủi ro giảm thiểu vì `src/frontend/` hiện **chưa tồn tại** — không có frontend để phá.

**Hệ quả bắt buộc:**
- Phần 2 mục 3.31.4 (AI chạy bất đồng bộ qua job table MongoDB + polling) **bị thay thế** bằng BullMQ. Cần cập nhật lại mục đó ở Phần 12 v3.
- Phần 11 (migration) trở thành **phần bắt buộc**, không còn tuỳ chọn.
- Phần 6 v2 (mô hình quyền) phải nâng lên v3 trước khi viết module `workspaces`/`projects`, vì mô hình vai trò là điều kiện tiên quyết cho schema mới.

### 3.2. Cấu trúc monorepo

```
/
├── apps/
│   ├── api/                    # NestJS API — toàn bộ HTTP controller + composition root
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       └── config/
│   └── worker/                 # NestJS worker — BullMQ consumer, không có HTTP
│       └── src/
│           ├── main.ts
│           └── app.module.ts
├── packages/
│   ├── core/                   # Domain dùng chung: value-objects, thuật toán thống kê, hằng số nghiệp vụ
│   └── contracts/              # DTO / API contract / error code dùng chung giữa api, worker, frontend
├── deploy/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**Quy tắc về `packages/`.**

| Package | Chứa được | Không chứa được |
|---|---|---|
| `packages/core` | Value-object dùng chung (`Email`, `ObjectId` wrapper), thuật toán thống kê dùng chung (`modifiedZScore`, `pearson`, `cramersV`, `etaSquared`, `vif`), hằng số nghiệp vụ (ngưỡng mặc định, giới hạn Top N), kiểu lỗi nghiệp vụ | Không import NestJS, Mongoose, hay bất kỳ framework hạ tầng nào. Phải chạy được trong test thuần Node |
| `packages/contracts` | Schema Zod của DTO request/response, mã lỗi, kiểu response phân trang | Không chứa logic nghiệp vụ. Chỉ mô tả hình dạng dữ liệu |

**Quy tắc cứng:** `packages/core` và `packages/contracts` **không** được import `apps/` và ngược lại. Mọi thứ ở `apps/` chỉ import từ `packages/`.

**Cấu trúc module nghiệp vụ.** Mỗi module trong `apps/api/src/modules/<module>/` theo cấu trúc đầy đủ (áp dụng cho **mọi** module, kể cả module được viết lại từ code cũ):

```
modules/<module>/
├── domain/                     # Độc lập framework
│   ├── entities/               # Model nghiệp vụ + invariant
│   ├── value-objects/          # Kiểu giá trị có validate
│   ├── events/                 # Sự kiện domain (không phải event nền)
│   └── ports/                  # Interface mà module cần từ bên ngoài
├── application/                # Điều phối use case
│   ├── commands/               # Use case thay đổi trạng thái
│   ├── queries/                # Use case đọc
│   └── ports/                  # Interface cho hạ tầng (repository, storage, mail…)
├── infrastructure/             # Adapter
│   ├── http/                   # Controller, DTO, response mapper
│   ├── persistence/            # Schema Mongoose, repository adapter
│   └── messaging/              # Listener/telemetry adapter nếu có
├── <module>.module.ts          # Composition root: nối port với adapter
└── README.md                   # Trách nhiệm, hợp đồng công khai, dependency
```

**Quy tắc phụ thuộc (kiểm tra được bằng script):**

```
domain  →  không import gì từ application/ hoặc infrastructure/
application → chỉ import domain/ và packages/
infrastructure → import domain/, application/, packages/
```

`domain` và `application` **không** được import NestJS decorators (`@Injectable`, `@Controller`) hay Mongoose. Điều này bắt buộc logic nghiệp vụ có thể test bằng unit test thuần.

### 3.3. Danh sách module và quyền sở hữu dữ liệu

Mỗi module **sở hữu duy nhất** collection của nó. Không module nào được đọc/ghi trực tiếp collection của module khác.

| Module | Sở hữu collection | Trách nhiệm | Tính năng (phần 2 v3) | Đợt |
|---|---|---|---|---|
| `auth` | `user_session` | Đăng nhập, token, refresh rotation, OTP, thay đổi mật khẩu | `AUTH-01`→`AUTH-13` | 1 |
| `users` | `user` | Hồ sơ người dùng, vai trò hệ thống, trạng thái tài khoản | `USER-01`, `USER-02` | 1 |
| `audit` | `audit_log` | Ghi log hành động nhạy cảm | (hỗ trợ `ADMIN-01`, `ISSUE-04`, `WS-09`, `PROJ-10`, `PROJ-11`) | 1 |
| `workspaces` | `workspace`, `workspace_member` | Vòng đời workspace, thành viên workspace, nhượng quyền Owner | `WS-01`→`WS-10` | 1 |
| `projects` | `project`, `project_member` | Vòng đời project, vai trò project, trạng thái project | `PROJ-01`→`PROJ-05`, `PROJ-09`→`PROJ-12` | 1–2 |
| `notifications` | `notification` | Trung tâm thông báo, công tắc bật/tắt, tiêu thụ sự kiện | `NOTIF-01`→`NOTIF-03` | 1 |
| `issues` | `issue_report` | Báo cáo sự cố, vòng đời trạng thái, duyệt báo cáo | `ISSUE-01`→`ISSUE-04` | 1 |
| `datasets` | `dataset`, `dataset_record`, `dataset_sheet` | Import file, đọc sheet, cấu trúc bảng, lưu trữ file gốc | `FILE-01`, `FILE-02`, `DATA-01`, `DATA-02` | 2 |
| `data-view` | *(không sở hữu)* | Đọc dữ liệu, lọc, sắp xếp, tìm kiếm, reset tên cột | `VIEW-01`→`VIEW-08` | 2 |
| `analysis` | `analysis_run`, `analysis_result`, `cell_evidence` | Chạy phân tích, DQ-01→DQ-05, thống kê mô tả, tương quan/VIF, mất cân bằng lớp | `DQ-01`→`DQ-05`, `ANALYSIS-01`→`ANALYSIS-07` | 2 |
| `ai` | `ai_job` | Port AI + adapter Gemini, job bất đồng bộ, che PII | `AI-01` | 2 |
| `summary` | `project_save` | Tạo Tổng kết, lưu trạng thái project, khôi phục | `SUMMARY-01`, `PROJ-12` | 2 |
| `reports` | *(không sở hữu)* | Xuất PDF | `REPORT-01` | 2 |
| `shared` | `outbox_event`, `processed_event` | Relay outbox, inbox chống xử lý trùng, hàng đợi BullMQ | (hạ tầng cho tất cả module) | 1 |

**Ghi chú về `data-view` và `reports`.** Hai module này **không sở hữu collection** — chúng đọc/ghi qua port của `datasets` và `analysis`. `data-view` không sở hữu trạng thái làm việc vì trạng thái làm việc thuộc về bản lưu của `summary` (phần 2 mục 3.19).

**Ghi chú về `admin`.** Quyết định: **không có module `admin` riêng**.
- `ADMIN-01` (xem hồ sơ người dùng) đặt trong module **`users`** — vì đọc collection `user`.
- `ISSUE-04` (duyệt báo cáo) đặt trong module **`issues`** — vì thao tác collection `issue_report`.
- Cơ chế phân quyền `SYS-ADMIN` nằm ở tầng `shared/` (CASL + guard), không phải module.

### 3.4. Ranh giới giữa các module — hợp đồng công khai

**Nguyên tắc.** Module giao tiếp qua **port** (interface) do module **sở hữu** định nghĩa, không qua lời gọi service trực tiếp và không qua truy vấn chéo collection.

| Người cần | Port của module sở hữu | Mô tả |
|---|---|---|
| `analysis` → `datasets` | `DatasetReader` | Đọc sheet, cột, bản ghi để phân tích |
| `analysis` → `projects` | `ProjectReader` | Đọc metadata project, tập cột được chọn phân tích |
| `analysis` → `ai` | `AiAnalyzerPort` | Gửi thống kê tổng hợp + mẫu ô đã che PII, nhận phát hiện AI |
| `summary` → `analysis` | `AnalysisResultReader` | Đọc kết quả phân tích + bằng chứng để tạo Tổng kết |
| `summary` → `datasets` | `DatasetColumnWriter` | Chỉ ghi **tên cột** (metadata) — không ghi giá trị ô |
| `data-view` → `datasets` | `DatasetReader`, `DatasetColumnWriter` | Đọc dữ liệu; ghi **chỉ** tên cột |
| `reports` → `summary` | `SummaryReader` | Đọc nội dung Tổng kết để xuất PDF |
| `notifications` → *(nhận sự kiện)* | Outbox event bus | Tiêu thụ sự kiện nội bộ |
| `audit` → *(nhận sự kiện)* | Outbox event bus | Tiêu thụ sự kiện cần ghi log |

**Port hạ tầng (đặt ở `packages/core` hoặc `shared/` của app, không thuộc module nghiệp vụ):**

| Port | Adapter | Ghi chú |
|---|---|---|
| `StoragePort` | R2 (S3) + local fallback | Đã chốt ở phần 2 mục 3.31.2 |
| `EmailSenderPort` | SMTP (Nodemailer) | Mới — cho OTP và lời mời |
| `AiAnalyzerPort` | Gemini API | Đã chốt ở phần 2 mục 3.31.3 |
| `AuditLogPort` | MongoDB `audit_log` | Mới |
| `JobQueuePort` | BullMQ | Mới — thay polling worker |

### 3.5. Cơ chế sự kiện nội bộ — dùng Outbox

**Quyết định.** Dùng `OutboxService` (pattern transactional outbox) cho các sự kiện nội bộ giữa module, thay vì gọi service trực tiếp.

**Luồng:**

```
Module A (ghi trong transaction DB)
   └─→ ghi event vào collection `outbox_event` cùng transaction
          └─→ relay đọc outbox_event → publish vào BullMQ
                 └─→ Module B (listener) tiêu thụ → tạo thông báo / ghi audit log
```

**Cập nhật v2 (2026-11-05).** Cơ chế relay được thiết kế chi tiết ở **Phần 9 mục 3.4**:
- Relay có **2 kênh**: Change Stream (chính) + polling fallback 30 giây quét event mồ côi.
- `outbox_event.status` có **4 trạng thái**: `pending` → `publishing` → `published`, thêm `failed`.
- Consumer chống xử lý trùng bằng collection `processed_event` (inbox pattern) — khoá unique `(consumer_name, event_id)`.

**Lý do chọn outbox thay vì gọi trực tiếp:**
1. Tạo thông báo (UC-63) là **tác dụng phụ** — lỗi tạo thông báo không được làm hỏng thao tác chính (tạo project, duyệt báo cáo). Gọi trực tiếp buộc phải bọc try/catch và xử lý lỗi lặp lại ở mọi nơi phát.
2. Ghi log audit (UC-46, UC-51, UC-67) cũng là tác dụng phụ, cùng tính chất.
3. Worker `apps/worker` đã tách riêng — cần cầu nối giữa API và worker. BullMQ + outbox là cặp tự nhiên.

**Sự kiện nội bộ cần định nghĩa (đợt 1):**

| Sự kiện | Phát ra bởi | Tiêu thụ bởi | Tác dụng |
|---|---|---|---|
| `project.created` | `projects` | `notifications` | Thông báo cho thành viên được thêm cùng lúc |
| `project.deleted` | `projects` | `notifications` | Thông báo cho thành viên project |
| `project.memberAdded` | `projects` | `notifications` | Thông báo người vừa được thêm vào project |
| `issue.statusChanged` | `issues` | `notifications` | Thông báo khi cần bổ sung (bắt buộc) hoặc đã xử lý |
| `issue.statusChanged` | `issues` | `audit` | Ghi log thay đổi trạng thái báo cáo |
| `workspace.ownerTransferred` | `workspaces` | `audit` | Ghi log nhượng quyền |
| `workspace.memberRoleChanged` | `workspaces` | `audit` | Ghi log thay đổi vai trò thành viên workspace |
| `project.ownerTransferred` | `projects` | `audit` | Ghi log nhượng quyền project owner |
| `project.memberRoleChanged` | `projects` | `audit` | Ghi log thay đổi vai trò thành viên project |
| `analysis.completed` | `analysis` | `notifications` | Thông báo phân tích hệ thống hoàn tất |
| `analysis.failed` | `analysis` | `notifications` | Thông báo phân tích thất bại |
| `ai.jobSucceeded` | `ai` | `notifications` | Thông báo phần giải thích AI sẵn sàng |
| `ai.jobFailed` | `ai` | `notifications` | Thông báo phần AI thất bại |
| `report.ready` | `reports` | `notifications` | Thông báo PDF Tổng kết sẵn sàng |

**Ghi chú v2 (2026-11-05).** Bảng trên được đồng bộ với **Phần 9 mục 3.3.2** — danh mục 13 sự kiện cuối cùng. Quy ước đặt tên sự kiện: **`dot.camelCase`** (khớp Phần 7 mục 3.3), thay cho `snake_case` ở v1. Chi tiết envelope, producer/consumer và quy tắc tương thích version nằm ở Phần 9 mục 3.3 và 3.7.

**Rủi ro đã biết:** outbox relay là thành phần dễ hỏng nhất (mất event nếu relay chết giữa chừng). Bắt buộc: đánh dấu event đã phát **trước** khi publish (at-least-once), và listener phải **idempotent**.

### 3.6. Đối chiếu với implementation hiện tại

| Module hiện tại | Tình trạng | Quyết định |
|---|---|---|
| `auth` | Có 6 endpoint: register, login, refresh, logout, sessions, sessions/:id. Đã có `password_reset_token_hash`, `password_reset_expires_at`, `google_id` trong schema | **Viết lại** — cần thêm OTP, đổi mật khẩu, chi tiết phiên, rotation + reuse detection. Tái sử dụng: `crypto.util.ts`, `device-detector.util.ts`, DTO Zod |
| `users` | Có 3 endpoint: GET/PATCH/DELETE `me`. Schema có `avatar_url`, `password_hash`, `google_id`, `status` | **Viết lại** — thêm `phone`, `bio`, `notifications_enabled`; bỏ `DELETE /users/me` (không có trong 77 tính năng); thêm danh sách hồ sơ cho `SYS-ADMIN` |
| `workspaces` | Có 7 endpoint. Schema `members[].role` dùng `owner\|editor\|viewer` | **Viết lại** — đổi thành `owner\|member`; thêm phân trang/tìm kiếm/lọc/sắp xếp, danh sách thành viên, nhượng quyền, `last_accessed_at` |
| `projects` | Có 5 endpoint. Schema **không có** danh sách vai trò project, chỉ có `created_by`. Có `has_dataset: boolean` | **Viết lại** — thêm collection `project_member` với vai trò `owner\|member\|viewer`; bỏ `has_dataset`, thêm `status` và `last_accessed_at` |
| `datasets` | Có upload + đọc file. Có lỗi đuôi file (ghi `raw_files/{id}.csv` cho cả `.xlsx`) và file tạm sót lại khi lỗi giữa chừng | **Viết lại** — sửa lỗi đuôi file, dọn file tạm, thêm đọc `.xlsx` nhiều sheet, thêm `dataset_sheet` |
| `data-view` | Có lọc/sắp xếp/tìm kiếm cơ bản | **Viết lại** — bổ sung reset tên cột, lưu trạng thái; chuyển sang cấu trúc hexagonal. **Không** bổ sung xóa dòng/sửa ô (bỏ 2026-11-05) |
| `versions` | Có commit/diff/rollback với snapshot Merkle | **Xoá** khỏi repo — bỏ 2026-11-05, không còn phục vụ mục đích nào |
| `clean-rules` | Có preview/apply rule | **Xoá** khỏi repo — bỏ 2026-11-05, không còn phục vụ mục đích nào |
| `lineage` | Có đồ thị Neo4j | **Xoá** khỏi repo — bỏ 2026-11-05, không còn phục vụ mục đích nào |
| `exports` | Có xuất CSV, xuất bảo mật | **Xoá** khỏi repo — nằm ngoài phạm vi sản phẩm |
| `cell-edit` | Có API sửa ô | **Xoá** khỏi repo — bỏ 2026-11-05, không còn thao tác sửa dữ liệu |
| *(chưa có)* | — | **Tạo mới:** `audit`, `notifications`, `issues`, `analysis`, `ai`, `summary`, `reports` |

**Kết luận phụ thuộc vòng:** mã nguồn hiện tại **không có** phụ thuộc chéo giữa các module nghiệp vụ — tất cả module chỉ import từ `shared/`. Đây là nền tảng tốt để giữ khi viết lại; rủi ro phụ thuộc vòng chỉ xuất hiện khi bổ sung 7 module mới.

**Các phần `shared/` được tái sử dụng (sao chép và cải thiện):**

| Thành phần | Cải thiện |
|---|---|
| `shared/casl` | Thêm subject `ProjectMember`, `Notification`, `IssueReport`, `AuditLog`; tách rõ quyền `SYS-ADMIN` khỏi quyền nghiệp vụ |
| `shared/pipes/zod-validation.pipe` | Giữ nguyên — đã tốt |
| `shared/database/base-mongo.repository` | Thêm hỗ trợ transaction + optimistic concurrency (`version` field) |
| `shared/database/mongoose-transaction.service` | Giữ nguyên — cần cho `transfer-owner` và `nhượng quyền` phải là nguyên tử |
| `shared/application/outbox` | Bổ sung relay đọc `outbox_event` → publish BullMQ; thêm trạng thái `publishing` + `lease_expires_at` |
| `shared/application/inbox` *(mới)* | Inbox pattern chống xử lý trùng — collection `processed_event` |
| `shared/decorators` (`current-user`, `public`, `roles`, `if-match`) | Giữ nguyên; thêm `@RequireProjectRole` cho vai trò project |
| `shared/filters/all-exceptions.filter` | Bổ sung ánh xạ `TOKEN_INVALID`, `TOKEN_EXPIRED`, `LIMIT_EXCEEDED` sang HTTP status |
| `shared/swagger` | Giữ nguyên |
| `shared/storage` | Viết lại theo port `StoragePort` (phần 2 mục 3.31.2) |
| `shared/crypto/mask-pii` | Chuyển sang `packages/core` vì `analysis` và `ai` cùng dùng |
| `shared/config/env.validation` | Bổ sung biến: `REDIS_URL`, `SMTP_*`, `GOOGLE_CLIENT_*`, `STORAGE_MAX_QUOTA_BYTES` |

### 3.7. Schema vai trò project — collection riêng

**Quyết định.** Vai trò project nằm ở collection riêng `project_member`, **không** nhúng mảng trong `project`.

```
project_member: {
  _id, project_id (index), user_id (index),
  role: 'owner' | 'member' | 'viewer',
  granted_by, granted_at
}

workspace_member: {
  _id, workspace_id (index), user_id (index),
  role: 'owner' | 'member',
  granted_by, granted_at
}
```

**Lý do:**
1. Truy vấn "các project mà user X có quyền `member`" là câu hỏi thường xuyên (danh sách project của tôi, kiểm tra quyền) — collection riêng có index trực tiếp, không cần `$elemMatch` trên mảng nhúng.
2. **Cập nhật v2 (2026-11-05):** workspace cũng dùng **collection riêng** `workspace_member`, không nhúng `members[]`. Lý do bổ sung: (a) truy vấn "các workspace mà user X tham gia" là câu hỏi thường xuyên (danh sách workspace của tôi, kiểm tra quyền) — collection riêng có index trực tiếp; (b) mô hình quyền Phần 6 v3 cần unique constraint "mỗi workspace đúng một Owner" mà mảng nhúng không thể bảo đảm; (c) tách collection giúp cô lập quyền `WS-*` khỏi quyền `PROJ-*` — hai khái niệm khác nhau theo Phần 6 v3.
3. Bất biến "mỗi project đúng một Owner" được bảo đảm ở **tầng domain + transaction** (Phần 8 mục 3.5.4), kèm unique partial index `(project_id, user_id)` chống trùng membership. Bản ghi Owner được phân biệt bằng `role = 'owner'` trong cùng collection — không dùng unique index có điều kiện trên `role`, vì index đó sẽ **không** cho phép tồn tại nhiều `role = 'member'` (unique áp dụng cho mọi giá trị `role` trong phạm vi index).

**Hệ quả bắt buộc:** vai trò `WS-OWNER` và `PROJ-OWNER` là **hai khái niệm khác nhau**, cần hai nơi lưu:
- `WS-OWNER` — trong `workspace_member` (role `owner`).
- `PROJ-OWNER` — trong `project_member` (role `owner`).

Workspace Owner có toàn quyền quản trị với mọi project trong workspace **mà không cần** có bản ghi trong `project_member`. Xác định quyền phải kiểm tra cả hai nguồn.

### 3.8. Dependency giữa các module

```
                  ┌──────────┐
                  │  audit   │  (tiêu thụ outbox event)
                  └──────────┘
                        ▲
                  ┌──────────┐
                  │notifica- │  (tiêu thụ outbox event)
                  │  tions   │
                  └──────────┘
                        ▲
  ┌───────┐   ┌──────────┴───┐   ┌───────────┐
  │ auth  │   │  workspaces   │   │  issues   │
  └───┬───┘   └───────┬──────┘   └─────┬─────┘
      │               │                │
      │         ┌─────▼──────┐         │
      │         │  projects  │◄────────┘   (issues tham chiếu project/workspace qua id,
      │         └──┬───┬───┬─┘                 không import trực tiếp)
      │            │   │   │
      │      ┌─────▼┐ ┌▼────▼──┐ ┌────────┐
      │      │ data-│ │analysis │ │ summary│
      │      │ view │ └────┬────┘ └───┬────┘
      │      └──┬───┘      │          │
      │         └────┬─────┴────┬─────┘
      │              ▼          ▼
      │        ┌──────────┐ ┌────────┐
      └───────►│ datasets │ │  ai    │
               └────┬─────┘ └────────┘
                    │
                    ▼
              ┌───────────┐
              │ summary   │
              └───────────┘

  Mọi module ──► packages/core, packages/contracts
  Mọi module ──► shared/ (hạ tầng kỹ thuật: casl, mongo, storage, guards)
```

**Quy tắc không được vi phạm:**
1. `domain` và `application` của một module **không** import module khác. Chỉ `infrastructure` được import port từ module khác.
2. Không module nào import **service** của module khác.
3. Không module nào truy vấn chéo collection. Truy vấn chéo đi qua port.
4. Phụ thuộc vòng bị cấm tuyệt đối. Script `check-module` phải phát hiện và chặn CI.

**Các cặp phụ thuộc cần đặc biệt chú ý:**

| Cặp | Vì sao dễ tạo vòng | Cách xử lý |
|---|---|---|
| `analysis` ↔ `ai` | `analysis` gọi AI, AI cần kết quả analysis | `ai` **không** gọi ngược `analysis`; AI nhận payload thống kê đã che PII qua port, trả kết quả về |
| `analysis` ↔ `datasets` | Analysis đọc dataset, ghi bằng chứng | `datasets` không biết gì về analysis; bằng chứng thuộc `analysis` |
| `summary` ↔ `analysis` | Summary đọc kết quả analysis | `analysis` không biết về summary |
| `summary` ↔ `data-view` | Cả hai đều ghi vào dữ liệu làm việc | `data-view` ghi qua `DatasetWriter` của `datasets`; `summary` đọc bản lưu, không đọc trạng thái phiên |

### 3.9. Module LEGACY

**Quyết định.** **Năm** module `clean-rules`, `lineage`, `versions`, `cell-edit`, `exports` **xoá khỏi repo** khi backend mới đã chạy và được xác nhận đáp ứng đủ chức năng thay thế. Bốn module đầu bị gỡ do quyết định "chỉ đọc" ngày 2026-11-05; `exports` vốn đã nằm ngoài phạm vi sản phẩm.

| Module LEGACY | Lý do | Thay thế bằng |
|---|---|---|
| `clean-rules` | DQ-05 đã chốt **hoãn** tính năng nhập/cấu hình quy tắc nghiệp vụ (phần 2 mục 3.5.5) — module này cung cấp đúng tính năng đó nhưng nằm ngoài phạm vi sản phẩm | Không có — DQ-05 giữ trạng thái "chưa đánh giá" khi chưa có quy tắc được xác nhận |
| `lineage` | Cần Neo4j — hạ tầng nặng, không thuộc mục tiêu phân tích chất lượng dữ liệu | Không có — đồ thị biến đổi không nằm trong phạm vi 77 tính năng |
| `exports` | Trùng phần với `reports` (xuất PDF) đã chốt ở `REPORT-01` | `reports` |

**Cập nhật 2026-11-05:** `versions` **nay cũng nằm trong nhóm xoá.** Trước đây nó được viết lại và đưa vào phạm vi giao hàng ở Đợt 3 (phần 2 mục 3.32.1); nay bị gỡ hoàn toàn cùng `clean-rules`, `lineage` và `cell-edit` vì không còn phục vụ mục đích nào trong phạm vi chỉ đọc.

**Quy trình xoá (an toàn):**
1. Backend mới đã chạy và đáp ứng chức năng thay thế.
2. Xác nhận bằng test nghiệm thu tương ứng ở Phần 13.
3. Xoá module khỏi cây mới **và** khỏi `src/backend/` cũ.
4. Dọn dependency không còn dùng: `neo4j-driver`, `fast-csv` (nếu không dùng chỗ khác).

**Cảnh báo:** `neo4j-driver` và cấu hình Neo4j phải được gỡ khỏi biến môi trường và `docker-compose` sau khi xoá `lineage`.

### 3.10. Chiến lược viết lại theo từng module

**Quyết định.** Viết lại **theo từng module**, mỗi module hoàn thành là dùng được được. Trong giai đoạn chuyển tiếp, backend cũ và mới **chạy song song** (khác cổng, khác database hoặc khác collection prefix).

| Bước | Module | Đợt | Phụ thuộc |
|---|---|---|---|
| 1 | Nền tảng: monorepo, `packages/core`, `packages/contracts`, `shared/` cải thiện | — | — |
| 2 | `users`, `auth` (kèm OTP, đổi mật khẩu, rotation), `audit` | 1 | Bước 1 |
| 3 | `workspaces`, `projects` (kèm `project_member`, `project.status`) | 1 | Bước 2 |
| 4 | `notifications`, `issues` (+ outbox relay) | 1 | Bước 2, 3 |
| 5 | `datasets` (đọc `.xlsx` nhiều sheet, sửa lỗi storage) | 2 | Bước 1 |
| 6 | `data-view` (lọc/sắp xếp/tìm kiếm/reset tên cột) | 2 | Bước 3, 5 |
| 7 | `analysis` + `ai` (BullMQ worker) | 2 | Bước 5, 6 |
| 8 | `summary`, `reports` | 2 | Bước 6, 7 |
| 9 | ~~`versions`~~ | ~~3~~ | ~~Bỏ 2026-11-05 — không còn module này~~ |
| 10 | Migration dữ liệu, xoá module LEGACY, xoá `src/backend/` cũ | — | Bước 1–9 |

**Quy tắc bắt buộc:** không bước nào bắt đầu khi bước trước chưa vượt test nghiệm thu tương ứng. Bước 10 là bước duy nhất được phép xoá dữ liệu.

**Điều kiện bắt buộc trước bước 3:** Phần 6 phải nâng lên v3 (thêm `SYS-ADMIN`, chốt quyền `WS-MEMBER`, chốt `PROJ-OWNER` chỉ xoá bởi `WS-OWNER`) — vì schema `project_member` phụ thuộc trực tiếp vào mô hình quyền.

### 3.11. Phát hiện phụ thuộc vòng

**Quy tắc kiểm tra bắt buộc trong CI** (`scripts/check-module.mjs`, kế thừa từ hệ thống tham chiếu):

| Kiểm tra | Mô tả |
|---|---|
| R1 — Layering | `domain/` không import `application/`, `infrastructure/` hay framework (`@nestjs/*`, `mongoose`) |
| R2 — No cross-module service import | Không import `services`/`repositories` của module khác |
| R3 — No cross-collection access | Không truy cận model Mongoose của module khác |
| R4 — No cycle | Đồ thị dependency giữa module không có chu trình |
| R5 — Package purity | `packages/core` không import `@nestjs/*`, `mongoose`, `bullmq`, `@aws-sdk/*` |
| R6 — Public contract | Chỉ import được qua `index.ts` công khai của module, không import sâu vào file nội bộ |

**Kết quả R4 dùng làm sơ đồ dependency chính thức** — tự sinh từ code, không vẽ tay.

### 3.12. Đối chiếu ngược với phần 2 và phần 3

| Nội dung | Thay đổi ở phần 2/3 cần thực hiện |
|---|---|
| AI bất đồng bộ qua job table MongoDB + polling (phần 2 mục 3.31.4) | **Bị thay thế** bằng BullMQ + Redis. Cần cập nhật phần 2 mục 3.31.4 và phần 12 |
| Module `versions` là LEGACY (phần 2 mục 3.31.5) | **Bị xoá** — cập nhật 2026-11-05 (trước đó dự kiến viết lại và đưa vào phạm vi giao hàng Đợt 3) |
| `clean-rules`, `lineage`, `exports` ngoài phạm vi (phần 2 mục 3.31.5) | Giữ nguyên; bổ sung quy trình xoá (mục 3.9). Cập nhật 2026-11-05: thêm `versions` và `cell-edit` vào nhóm xoá |
| `datasets` giữ lỗi storage: đuôi file, file tạm (phần 2 mục 3.31.2) | Giữ nguyên — đã nêu là lỗi cần sửa; sửa trong bước 5 |
| `admin` là module riêng (ghi ở phần 2 mục 5 và mục 6.2c) | **Bị thay thế**: không có module `admin` — `ADMIN-01` vào `users`, `ISSUE-04` vào `issues` |
| Phân trang `offset` cho danh sách (phần 2 mục `WS-02`, `PROJ-02`, `NOTIF-01`) | Giữ nguyên — đã chốt |
| Endpoint cũ giữ nguyên đường dẫn | **Bị thay thế**: thiết kế đường dẫn mới `/api/v1/...` (không có frontend đang chạy) |
| ~~84 tính năng, 67 use case~~ | **Bị thay thế 2026-11-05**: còn **77 tính năng**, **62 use case** — bỏ 7 tính năng (mục 3.40 của phần 2) |

**Kiểm tra bao phủ:** 20 module trong bảng mục 3.3 phủ đủ **77 tính năng** của phần 2 v4. Không tính năng nào mất đi khi chuyển sang cấu trúc module mới. (v2 có 21 module phủ 84 tính năng; `versions` bị gỡ kèm `PROJ-06`→`PROJ-08`.)

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 1 v1 — định hướng Modular Monolith + Ports and Adapters.
- Phần 2 v4 — danh mục 77 tính năng, chia đợt giao hàng ở mục 3.39, quyết định ở mục 6.2c. Quyết định "chỉ đọc" tại mục 3.40.
- Phần 3 v3 — 62 use case, ma trận quyền v3, 4 vòng đời trạng thái mới.
- Phần 6 v2 — mô hình vai trò và ma trận quyền thao tác.
- Phần 12 v2 — logic AI, ngưỡng ảnh hưởng, thư viện `simple-statistics` + `ml-matrix`.
- Mã nguồn hiện tại tại `src/backend/src/` — 10 module, 1 outbox, 14 nhóm `shared/`.
- Tham chiếu về cấu trúc module, outbox/inbox, `check-module.mjs`, dependency list.

**Đầu ra**
- Cấu trúc monorepo và quy tắc đặt tên.
- Danh sách 20 module với ranh giới sở hữu dữ liệu và port công khai.
- Bảng dependency và các quy tắc chống phụ thuộc vòng kiểm được bằng script.
- Thứ tự viết lại 10 bước với điều kiện tiên quyết.
- Quy trình xoá 3 module LEGACY.
- Danh sách tác động cần đồng bộ sang phần 2, 5, 6, 11, 12.

## 5. Điều kiện hoàn tất phần này

Bản phân chia trách nhiệm, ranh giới sở hữu dữ liệu, quy tắc dependency và chiến lược tái cấu trúc đã được thống nhất; mọi tính năng trong phần 2 v3 và mọi use case trong phần 3 v2 đều có module chịu trách nhiệm; không còn module nào chưa được phân loại.

## 6. Câu hỏi và phụ thuộc còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | Phân trang danh sách (workspace, project, notification) dùng `offset` hay `cursor`? Đã chốt `offset` ở phần 2 nhưng chưa chốt trường sort mặc định cho từng danh sách | Thiết kế API | Phần 7 |
| 2 | `packages/core` có chứa thuật toán thống kê (`simple-statistics`, `ml-matrix`) hay để trong `apps/api/src/modules/analysis`? Đang giả định để trong `analysis` vì thuật toán chỉ dùng ở đó | Ranh giới package | Phần 5 |
| 3 | Redis dùng chung cho BullMQ và cache, hay tách instance? Ảnh hưởng vận hành | Hạ tầng | Phần 10 |
| 4 | Quota lưu trữ tính trên tổng workspace hay từng user? Đã có `STORAGE_MAX_QUOTA_BYTES` trong biến môi trường nhưng chưa chốt phạm vi áp dụng | Chính sách | Phần 10 |
| 5 | Migration schema: chạy song song 2 backend trên cùng MongoDB với collection prefix khác nhau, hay dùng collection mới hoàn toàn? | Phần 11 | Phần 11 |
| 6 | `has_dataset` cũ đã dùng để suy ra trạng thái project — khi migrate, project nào được coi là `in_progress`? | Quy tắc migration | Phần 11 |
| 7 | Có cần giữ `POST /auth/register` mở công khai, hay chỉ Admin tạo tài khoản? Chưa nêu trong 77 tính năng | Chính sách đăng ký | Phần 6 v3 |
| 8 | Worker BullMQ có chạy cùng replica MongoDB hay không? Ảnh hưởng transaction của outbox | Vận hành | Phần 9 — **đã chốt ở Phần 9 v1 mục 3.5.1: cùng replica MongoDB, `apps/worker` là app riêng** |
| 9 | Redis dùng chung cho BullMQ và rate-limit, hay tách instance? | Vận hành | Phần 10 — **đã chốt ở Phần 9 v1: dùng chung 1 instance `REDIS_URL`** |
| 10 | Có cần **dead-letter queue** (DLQ) riêng cho job BullMQ fail hết retry? | Khả năng điều tra lỗi | Phần 10 — câu hỏi mở #2 của Phần 9 |

**Phụ thuộc cứng:** câu hỏi 7 phải chốt trước khi viết module `auth` (bước 2 của mục 3.10). Câu hỏi 5 và 6 phải chốt trước khi viết script migration (bước 10).

**Đã đóng ở v2 (2026-11-05):** câu hỏi 1 (offset + trường sort mặc định) đã chốt ở **Phần 7 v1 mục 3.5**; câu hỏi 2 đã chốt ở **Phần 5 v1 mục 3.13** (`packages/core/src/stats/`); câu hỏi 7 đã chốt ở **Phần 6 v3** (đăng ký công khai); câu hỏi 8 và 9 đã chốt ở **Phần 9 v1**. Câu hỏi 4 (phạm vi quota) và 5–6 (migration) vẫn mở, xử lý ở Phần 10 và Phần 11.

## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v2 / 2026-11-05:** Đồng bộ với Phần 9 v1 và Phần 7 v1. (1) Tên sự kiện nội bộ chuyển sang `dot.camelCase` — bảng sự kiện mục 3.5 mở rộng từ 7 lên **13** sự kiện khớp Phần 9 mục 3.3.2; (2) thêm module `shared` sở hữu `outbox_event` + `processed_event`; (3) `workspaces` sở hữu thêm `workspace_member` — tách collection, bỏ mảng nhúng `members[]`; (4) bổ sung trạng thái `publishing` + `lease_expires_at` cho `outbox_event`; (5) sửa lý do unique index Owner — không dùng unique có điều kiện trên `role` vì sẽ chặn nhiều `member`; (6) đóng 4 câu hỏi đã được trả lời ở các phần sau.
- **v1 / 2026-11-02:** Tạo khung phần 4 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Ghi nhận 12 nhóm quyết định: (1) viết lại toàn bộ backend trong monorepo mới; (2) cấu trúc `apps/api` + `apps/worker` + `packages/core` + `packages/contracts`; (3) cấu trúc module hexagonal đầy đủ cho mọi module; (4) `versions` viết lại và vào phạm vi; (5) không có module `admin`; (6) outbox + BullMQ cho sự kiện nội bộ; (7) `shared/` giữ làm tầng kỹ thuật dùng chung; (8) có migration dữ liệu; (9) viết lại theo từng module; (10) `project_member` là collection riêng; (11) `audit` là module riêng ở `apps/api/src/modules/audit/`; (12) xoá 3 module LEGACY khỏi repo. Bổ sung cơ sở so sánh với mã nguồn hiện tại và hệ thống tham chiếu.
