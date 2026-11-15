# 8. Thiết kế dữ liệu và database schema

- **Version:** v6
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-07 (v6)
- **Trạng thái:** Đã chốt 11 quyết định schema và thiết kế **21 collection** đầy đủ (trường, index, unique constraint, transaction boundary, TTL, retention, layout storage R2) cùng bảng migration từ schema hiện tại. **v4:** gộp `dataset_sheet` vào `dataset` (21 → 20), thêm `finding_feedback` + `feedback_example` (20 → **21**), cập nhật `ai_job` cho Kafka + model. **v5:** mở rộng `analysis_result` (breakdown thiếu pairwise, `commonNRate`/`lossWarning`, `excludedColumns`, lý do date riêng) + worker AI corr-v1 (`claimPendingJob`, `AiWorkerService`, biến môi trường `AI_*`). Đã chốt toàn bộ mục 6.2 ở v6 (2026-11-07).
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 8; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** tuân thủ ranh giới sở hữu dữ liệu của Phần 4 v2 mục 3.3, quy ước đặt tên và cấu trúc response của Phần 7 mục 3.3, cơ chế optimistic locking của Phần 5 mục 3.9, cơ chế outbox/inbox của Phần 9 v1 mục 3.4, ngưỡng và quy tắc nghiệp vụ của Phần 12 v2.
- **Thay đổi so với v1:** (1) `outbox_event.status` thêm trạng thái `publishing` + trường `lease_expires_at`; (2) `notification` thêm `source_event_id` kèm unique partial; (3) thêm collection `processed_event` (inbox) — tổng cộng 21 → **22 collection** (v3: **21** sau khi bỏ `dataset_version`; **v4: gộp `dataset_sheet` (−1) + thêm `finding_feedback` và `feedback_example` (+2) → **21**)**.

## 1. Mục tiêu

Làm rõ và thống nhất thiết kế dữ liệu và database schema cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Entity, quan hệ, schema, index, unique constraint và quy tắc vòng đời dữ liệu.
- Quyền sở hữu dữ liệu theo module; tách domain model khỏi persistence model.
- Ràng buộc Project–Dataset, version, records, lineage và các thực thể theo tính năng đã chốt.
- Transaction boundary, concurrency, consistency, soft delete, retention và storage layout.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Khóa chính: **String có tiền tố** — `usr_`, `ws_`, `prj_`, `ds_`… | Đọc log dễ, tự nhận diện loại, không lộ quy mô collection |
| 2 | Thành viên workspace/project: **collection riêng** | `workspace_member`, `project_member` |
| 3 | Dữ liệu bảng: **collection riêng**, 1 document = 1 dòng | `dataset_record`, gom theo sheet |
| 4 | Xoá: **soft delete** (`deleted_at`) cho thực thể nghiệp vụ | Collection log dùng TTL thay vì soft delete |
| 5 | Trường `version`: **mọi resource** đều có | Đồng nhất, mapper đơn giản |
| 6 | `outbox_event`: do module **`shared`** sở hữu | Mọi module ghi vào, relay đọc |
| 7 | Audit log: **tách 2 collection** — `audit_log` + `audit_change` | Chuẩn, truy vấn linh hoạt |
| 8 | Index: **chuẩn** (trường query/lọc/sắp xếp), **không** text index | Tìm kiếm substring bằng regex (Phần 2 mục 3.27) |
| 9 | Inbox pattern: collection `processed_event` | Chống xử lý trùng ở tầng DB (Phần 9 mục 3.4.5) |

### 3.2. Quy ước chung

#### 3.2.1. Định danh (khóa chính)

**Định dạng:** `<prefix>_<ULID26>`

- ULID = 26 ký tự Crockford Base32, 10 ký tự đầu là timestamp milliseconds, 16 ký tự sau là random.
- Sắp xếp **lexicographically** tương đương sắp xếp theo thời gian → index trên `id` hoạt động như index thời gian.
- Sinh bởi `packages/core/src/id/id-generator.ts` — **không** dùng `ObjectId` của MongoDB.

**Bảng tiền tố:**

| Tiền tố | Collection | Ý nghĩa |
|---|---|---|
| `usr_` | `user` | Người dùng |
| `ses_` | `user_session` | Phiên đăng nhập |
| `ws_` | `workspace` | Không gian làm việc |
| `wsm_` | `workspace_member` | Thành viên workspace |
| `prj_` | `project` | Project |
| `prm_` | `project_member` | Thành viên project |
| `ds_` | `dataset` | Dataset |
| ~~`sht_`~~ | ~~`dataset_sheet`~~ | **Gỡ (v4)** — gộp vào `dataset` |
| `fb_` | `finding_feedback` | Nhận xét người dùng về kết quả |
| `fex_` | `feedback_example` | Mẫu chuẩn hoá cho kho học lại (T1) |
| `rec_` | `dataset_record` | Dòng dữ liệu |
| `run_` | `analysis_run` | Lần chạy phân tích |
| `res_` | `analysis_result` | Kết quả phân tích |
| `evd_` | `cell_evidence` | Bằng chứng ô lỗi |
| `job_` | `ai_job` | Job AI |
| `sav_` | `project_save` | Bản lưu trạng thái project |
| `iss_` | `issue_report` | Báo cáo sự cố |
| `ntf_` | `notification` | Thông báo |
| `aud_` | `audit_log` | Bản ghi audit |
| `chg_` | `audit_change` | Chi tiết thay đổi |
| `obx_` | `outbox_event` | Sự kiện outbox |

**Quy tắc bắt buộc:**
1. Tiền tố **cố định** theo loại thực thể — không dùng lại tiền tố của collection khác.
2. `id` là **khóa chính** (`_id`) kiểu `String`, không dùng `_id` mặc định của MongoDB.
3. Validate định dạng id ở tầng contract: `z.string().regex(/^usr_[0-9A-HJKMNP-TV-Z]{26}$/)` (tương ứng từng tiền tố).
4. Mọi tham chiếu chéo collection lưu dưới dạng **String id** + tên trường hậu tố `_id` (không dùng `ObjectId`), để tránh phải convert khi đọc.
5. `id` **không** bao giờ đổi sau khi tạo, kể cả khi soft delete.

#### 3.2.2. Quy ước đặt tên trường

| Lớp | Quy ước | Ví dụ |
|---|---|---|
| Collection | `snake_case` số nhiều | `workspace_member`, `dataset_record` |
| Trường trong DB | `snake_case` | `created_at`, `workspace_id`, `deleted_at` |
| Trường trong domain | `camelCase` | `createdAt`, `workspaceId` |
| Trường trong API | `camelCase` | `createdAt`, `workspaceId` |

**Quy tắc bắt buộc:**
1. Tầng persistence (`infrastructure/persistence/*.mapper.ts`) là nơi **duy nhất** chuyển đổi `snake_case` ↔ `camelCase`.
2. `domain/` và `application/` **không** bao giờ thấy tên trường `snake_case`.
3. Trường thời gian luôn kết thúc bằng `_at`: `created_at`, `updated_at`, `deleted_at`, `joined_at`, `last_accessed_at`, `read_at`.
4. Trường boolean dùng `is_` / `has_` / `can_` / `should_` — không dùng động từ.
5. Trường số lượng dùng `_count`; trường dung lượng dùng `_bytes`; trường số phiên bản dùng `_number`.
6. Trường boolean mặc định **luôn** có giá trị tường minh, không dùng `null` để diễn tả "chưa biết".

#### 3.2.3. Trường chuẩn có mặt trên mọi collection

| Trường | Kiểu | Quy tắc |
|---|---|---|
| `_id` | String | Khóa chính, `<prefix>_<ULID26>` |
| `version` | Int | Mặc định `1`, tăng mỗi lần ghi (optimistic locking) |
| `created_at` | Date | Tự động |
| `updated_at` | Date | Tự động |

**Ngoại lệ:** `outbox_event` không có `version` (append-only về nội dung; các trường trạng thái vận hành được cập nhật bởi relay). `audit_log`, `audit_change` và `processed_event` không có `version` (append-only).

#### 3.2.4. Xoá mềm (soft delete)

**Quy tắc bắt buộc:**
1. Collection có `deleted_at: Date | null` — `null` nghĩa là còn hiệu lực.
2. Mọi truy vấn đọc collection có soft delete **phải** lọc `deleted_at: null` — thực hiện ở tầng repository adapter, không phải ở application.
3. Soft delete **không** tự động tăng `version` nếu endpoint không yêu cầu `expectedVersion`; nếu có yêu cầu thì tăng như bình thường.
4. Unique constraint trên collection có soft delete phải dùng **partial unique index** — xem mục 3.3.
5. Xoá mềm `workspace` **không** xoá mềm các `project` con ngay. Việc dọn dẹp cascaded là tác vụ nền (Phần 9), giữ để khôi phục được.

**Các collection có soft delete:** `user`, `workspace`, `workspace_member`, `project`, `project_member`, `dataset`, `dataset_record`, `analysis_run`, `analysis_result`, `cell_evidence`, `ai_job`, `project_save`, `issue_report`.

> **v4:** `dataset_sheet` đã bị gỡ (gộp vào `dataset`). `finding_feedback` là **append-only — KHÔNG có soft delete** (mọi chỉnh sửa được ghi bằng `update_at`, không xoá bản ghi).

**Các collection append-only dùng TTL thay cho soft delete:** `notification`, `audit_log`, `audit_change`, `outbox_event`, `processed_event`, `user_session`.
- Lý do: đây là dữ liệu vòng đời ngắn hoặc bất biến — giữ bản ghi "đã xoá" không có giá trị nghiệp vụ, nhưng việc **xoá vật lý** theo chính sách retention là bắt buộc (mục 3.9).

#### 3.2.5. Trường `version` (optimistic locking)

**Quy tắc bắt buộc:**
1. Mọi resource đều có `version: number`, mặc định `1`.
2. Khi lưu, repository adapter tăng `version` **một lần** mỗi lần ghi thành công — dùng `findOneAndUpdate` với điều kiện `{ _id, version: expectedVersion }`.
3. Nếu không tìm thấy document khớp `expectedVersion` → ném `OptimisticLockError` → HTTP `409 CONFLICT` (Phần 7 mục 3.11).
4. `expectedVersion` là **tuỳ chọn** ở tầng repository — chỉ 5 endpoint nhạy cảm bắt buộc (Phần 7 mục 3.11).
5. `version` **không** dùng cho kiểm soát truy cập — quyền kiểm tra bằng CASL động, không phụ thuộc version.

### 3.3. Danh mục 21 collection (v4)

| # | Collection | Module sở hữu | Loại | Xoá |
|---|---|---|---|---|
| 1 | `user` | `users` | Thực thể | soft |
| 2 | `user_session` | `auth` | Thực thể | TTL |
| 3 | `audit_log` | `audit` | Log | TTL |
| 4 | `audit_change` | `audit` | Log | TTL |
| 5 | `workspace` | `workspaces` | Thực thể | soft |
| 6 | `workspace_member` | `workspaces` | Thực thể | soft |
| 7 | `project` | `projects` | Thực thể | soft |
| 8 | `project_member` | `projects` | Thực thể | soft |
| 9 | `notification` | `notifications` | Log | TTL |
| 10 | `issue_report` | `issues` | Thực thể | soft |
| 11 | `dataset` | `datasets` | Thực thể | soft |
| 12 | ~~`dataset_sheet`~~ | — | **Gỡ (v4)** — gộp vào `dataset` | — |
| 13 | `dataset_record` | `datasets` | Thực thể | soft |
| 14 | `analysis_run` | `analysis` | Thực thể | soft |
| 15 | `analysis_result` | `analysis` | Thực thể | soft |
| 16 | `cell_evidence` | `analysis` | Thực thể | soft |
| 17 | `ai_job` | `ai` | Thực thể | soft |
| 17b | `finding_feedback` | `feedback` | **Append-only** | TTL 365 ngày |
| 17c | `feedback_example` | `feedback` | Thực thể | TTL 180 ngày |
| 18 | `project_save` | `summary` | Thực thể | soft |
| 20 | `outbox_event` | `shared` | Log | TTL |
| 21 | `processed_event` | `shared` | Log | TTL |
| 22 | *(tệp đính kèm)* | `issues` | — | Storage |

**Ghi chú:** `data-view` và `reports` không sở hữu collection (Phần 4 v2 mục 3.3). Tệp đính kèm báo cáo sự cố nằm trên Storage, metadata nhúng trong `issue_report`.

**Ghi chú v2 — module `shared`:** module `shared` sở hữu **2 collection hạ tầng**:
- `outbox_event` — ghi trong transaction, relay publish lên Kafka (Phần 9 mục 3.4).
- `processed_event` — inbox chống xử lý trùng (Phần 9 mục 3.4.5).

Cả hai đều là collection log, append-only, dùng TTL index để dọn dẹp — không dùng soft delete.

---

### 3.4. Schema chi tiết — nhóm Identity

#### 3.4.1. `user` (module `users`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `usr_<ULID26>` |
| `email` | String | lowercase, trim, **unique partial** (chỉ khi `deleted_at: null`) |
| `password_hash` | String | `select: false`; null nếu đăng nhập Google |
| `google_id` | String | `select: false`, **unique sparse** |
| `first_name` | String | max 50 |
| `last_name` | String | max 50 |
| `phone` | String | nullable, max 20 |
| `bio` | String | nullable, max 500 |
| `avatar_url` | String | nullable |
| `role` | String | enum `admin` \| `analyst` — hệ thống, ngoài phân cấp workspace/project (Phần 2 mục 3.34.1) |
| `status` | String | enum `active` \| `blocked`, mặc định `active` |
| `notifications_enabled` | Boolean | mặc định `true` (Phần 2 mục 3.37) |
| `password_reset_otp_hash` | String | `select: false`, nullable |
| `password_reset_otp_expires_at` | Date | nullable |
| `password_reset_otp_attempts` | Int | mặc định `0` |
| `last_login_at` | Date | nullable |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ email: 1 }` | unique, partial `{ deleted_at: null }` | Đăng nhập, kiểm tra trùng email |
| `{ google_id: 1 }` | unique, sparse | Đăng nhập Google |
| `{ role: 1, status: 1, deleted_at: 1 }` | compound | `ADMIN-01` lọc + sắp xếp |
| `{ deleted_at: 1, created_at: -1 }` | compound | Danh sách admin mặc định `createdAt desc` |
| `{ last_name: 1, first_name: 1 }` | compound | Sắp xếp theo tên |

**Ghi chú:**
- `email` unique partial: sau khi soft delete một user, email được giải phóng — cho phép đăng ký lại cùng email. Quyết định này cần ghi vào tài liệu bàn giao (rủi ro: mất liên kết lịch sử với `workspace_member` cũ).
- `role` chỉ có 2 giá trị ở **tầng hệ thống**. Vai trò `WS-OWNER`/`WS-MEMBER`/`PROJ-*` **không** nằm ở đây — chúng nằm ở `workspace_member.role` và `project_member.role` (Phần 6 v3).
- `password_hash` và `google_id` không bao giờ trả ra API.

#### 3.4.2. `user_session` (module `auth`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `ses_<ULID26>` |
| `user_id` | String | `usr_...`, bắt buộc |
| `refresh_token_hash` | String | `select: false`, sha256, bắt buộc |
| `user_agent` | String | nullable, max 500 |
| `ip_address` | String | nullable, max 45 (hỗ trợ IPv6) |
| `device_label` | String | nullable, max 120 — nhãn hiển thị cho danh sách phiên |
| `last_used_at` | Date | tự động |
| `expires_at` | Date | TTL — 30 ngày (Phần 6 v3 mục 3.4) |
| `revoked_at` | Date | nullable |
| `revoke_reason` | String | nullable, enum `logout` \| `logout_other` \| `rotated` \| `reused_detected` \| `admin_revoked` |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ user_id: 1, revoked_at: 1, created_at: -1 }` | compound | `AUTH-08` danh sách phiên |
| `{ expires_at: 1 }` | **TTL, `expireAfterSeconds: 0`** | Tự xoá phiên hết hạn |
| `{ refresh_token_hash: 1 }` | unique | Tra cứu khi refresh |

**Quy tắc:**
1. Refresh token lưu **chỉ dạng hash** — không lưu bản gốc.
2. Phát hiện tái sử dụng refresh token đã rotate → đặt `revoked_at` cho **toàn bộ** phiên của user (Phần 7 mục 3.12).
3. TTL index xoá vật lý sau `expires_at` — an toàn vì token đã hết hạn.

#### 3.4.3. `audit_log` + `audit_change` (module `audit`)

**`audit_log`** — mỗi hành động nhạy cảm một document:

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `aud_<ULID26>` |
| `actor_id` | String | `usr_...`, bắt buộc — người thực hiện |
| `actor_role` | String | snapshot vai trò tại thời điểm hành động |
| `action` | String | enum — xem bảng bên dưới |
| `target_type` | String | enum `workspace` \| `project` \| `issue_report` \| `user` \| `dataset` \| `project_save` |
| `target_id` | String | bắt buộc |
| `target_label` | String | nullable, max 200 — tên hiển thị tại thời điểm hành động |
| `workspace_id` | String | nullable — phạm vi lọc (Phần 6 v3 mục 3.8) |
| `project_id` | String | nullable |
| `ip_address` | String | nullable, max 45 |
| `user_agent` | String | nullable, max 500 |
| `metadata` | Object | ngữ cảnh bổ sung, **không** chứa giá trị nghiệp vụ nhạy cảm |
| `created_at` | Date | tự động |
| `expires_at` | Date | TTL — retention |

**`audit_change`** — chi tiết before/after, một document mỗi thay đổi trường:

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `chg_<ULID26>` |
| `audit_log_id` | String | `aud_...`, bắt buộc |
| `field` | String | tên trường đã đổi (domain-level, camelCase) |
| `before_value` | Mixed | nullable — `null` nghĩa là trường chưa tồn tại |
| `after_value` | Mixed | nullable — `null` nghĩa là trường đã bị xoá |
| `created_at` | Date | tự động |
| `expires_at` | Date | TTL — retention |

**Index `audit_log`:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ actor_id: 1, created_at: -1 }` | compound | Lọc theo người thực hiện |
| `{ target_type: 1, target_id: 1, created_at: -1 }` | compound | Lọc theo đối tượng |
| `{ workspace_id: 1, created_at: -1 }` | compound | Lọc theo phạm vi workspace |
| `{ action: 1, created_at: -1 }` | compound | Lọc theo loại hành động |
| `{ created_at: -1 }` | đơn | Sắp xếp mặc định |
| `{ expires_at: 1 }` | **TTL** | Retention |

**Index `audit_change`:** `{ audit_log_id: 1 }`.

**Bảng `action` (8 hành động bắt buộc — Phần 2 mục 3.32, Phần 6 v3 mục 3.8):**

| `action` | Mô tả | `target_type` |
|---|---|---|
| `ISSUE_STATUS_CHANGED` | Admin đổi trạng thái báo cáo | `issue_report` |
| `ISSUE_LIST_VIEWED` | Admin xem danh sách báo cáo | `issue_report` |
| `USER_PROFILE_VIEWED` | Admin xem hồ sơ người dùng | `user` |
| `USER_LIST_VIEWED` | Admin xem danh sách hồ sơ | `user` |
| `WORKSPACE_ROLE_CHANGED` | Đổi vai trò thành viên workspace | `workspace` |
| `PROJECT_ROLE_CHANGED` | Đổi vai trò thành viên project | `project` |
| `WORKSPACE_OWNER_TRANSFERRED` | Nhượng quyền Owner workspace | `workspace` |
| `PROJECT_OWNER_TRANSFERRED` | Nhượng quyền Owner project | `project` |

**Quy tắc:**
1. `before_value`/`after_value` chỉ ghi **giá trị nghiệp vụ không nhạy cảm** — không ghi password hash, token, giá trị ô dữ liệu.
2. Với hành động xem danh sách (`*_LIST_VIEWED`), `target_id` = `null`, `metadata` chứa số lượng bản ghi xem và bộ lọc.
3. Ghi audit là **tác dụng phụ** — thực hiện qua outbox event, không nằm trong transaction chính (Phần 4 mục 3.5).

---

### 3.5. Schema chi tiết — nhóm Workspace & Project

#### 3.5.1. `workspace` (module `workspaces`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `ws_<ULID26>` |
| `name` | String | bắt buộc, trim, max 100 |
| `description` | String | nullable, max 500 |
| `owner_id` | String | `usr_...`, bắt buộc |
| `storage_used_bytes` | Int | mặc định 0 — tổng dung lượng file trong workspace |
| `last_accessed_at` | Date | mặc định = `created_at` — dùng để sắp xếp danh sách (Phần 2 mục 3.36.1) |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ owner_id: 1, deleted_at: 1 }` | compound | `WS-02` workspace của tôi |
| `{ name: 1 }` | đơn | Sắp xếp theo tên |
| `{ last_accessed_at: -1, deleted_at: 1 }` | compound | Sắp xếp mặc định |

**Ghi chú:** `owner_id` chỉ là **con trỏ** — quyền `WS-OWNER` được xác định qua `workspace_member.role = 'owner'`, không phải qua trường này. Trường `owner_id` tồn tại để truy vấn nhanh "workspace tôi sở hữu" và để kiểm tra invariant "owner phải có trong danh sách thành viên". Trường này **phải** được cập nhật đồng thời với `workspace_member`.

#### 3.5.2. `workspace_member` (module `workspaces`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `wsm_<ULID26>` |
| `workspace_id` | String | `ws_...`, bắt buộc |
| `user_id` | String | `usr_...`, bắt buộc |
| `role` | String | enum `owner` \| `member` (Phần 6 v3 mục 3.2) |
| `joined_at` | Date | tự động |
| `invited_by` | String | `usr_...`, nullable — null nếu tự thêm |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ workspace_id: 1, user_id: 1 }` | **unique**, partial `{ deleted_at: null }` | Một user chỉ có 1 membership đang hiệu lực |
| `{ user_id: 1, deleted_at: 1 }` | compound | `WS-02` workspace của tôi |
| `{ workspace_id: 1, deleted_at: 1, joined_at: 1 }` | compound | `WS-06` danh sách thành viên, sắp xếp `joinedAt asc` |
| `{ workspace_id: 1, role: 1, deleted_at: 1 }` | compound | Lọc theo vai trò |

**Quy tắc:**
1. Membership mềm xoá → user rời workspace có thể được thêm lại; unique partial cho phép điều đó.
2. **Invariant:** mỗi workspace có **đúng một** `role = 'owner'` đang hiệu lực — kiểm tra ở tầng domain, trong transaction.
3. `WS-09` (nhượng quyền Owner) là **giao dịch nguyên tử**: trong 1 transaction — đặt `role='member'` cho owner cũ, tạo membership `role='owner'` cho người nhận, cập nhật `workspace.owner_id`, ghi `audit_change` + outbox event.

#### 3.5.3. `project` (module `projects`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `prj_<ULID26>` |
| `workspace_id` | String | `ws_...`, bắt buộc |
| `name` | String | bắt buộc, trim, max 100 |
| `description` | String | nullable, max 500 |
| `status` | String | enum `not_started` \| `in_progress` \| `completed`, mặc định `not_started` (Phần 2 mục 3.36.1) |
| `created_by` | String | `usr_...`, bắt buộc |
| `last_accessed_at` | Date | mặc định = `created_at` |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ workspace_id: 1, deleted_at: 1, last_accessed_at: -1 }` | compound | `PROJ-02` project của workspace, sắp xếp mặc định |
| `{ status: 1, deleted_at: 1 }` | compound | Lọc theo trạng thái |
| `{ name: 1 }` | đơn | Sắp xếp theo tên |
| `{ deleted_at: 1, created_at: -1 }` | compound | Sắp xếp admin / fallback |

**Ghi chú quan trọng:**
- `has_dataset` **đã bỏ** — suy ra từ `status !== 'not_started'` (Phần 2 mục 3.36.1 quy tắc 4).
- Trường `status` **dẫn xuất từ sự kiện**, người dùng không tự đánh dấu.
- Vòng đời `status`:

```
not_started  ──(import dataset thành công)──→  in_progress
in_progress  ──(lưu project thành công)─────→  completed
completed   ──(xoá dataset)──────────────────→  not_started
```

#### 3.5.4. `project_member` (module `projects`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `prm_<ULID26>` |
| `project_id` | String | `prj_...`, bắt buộc |
| `user_id` | String | `usr_...`, bắt buộc |
| `role` | String | enum `owner` \| `member` \| `viewer` (Phần 6 v3 mục 3.2) |
| `joined_at` | Date | tự động |
| `invited_by` | String | `usr_...`, nullable |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ project_id: 1, user_id: 1 }` | **unique**, partial `{ deleted_at: null }` | Một user chỉ có 1 membership đang hiệu lực |
| `{ user_id: 1, deleted_at: 1 }` | compound | `PROJ-02` project của tôi |
| `{ project_id: 1, deleted_at: 1 }` | compound | Truy vấn danh sách vai trò |

**Quy tắc:**
1. **Invariant:** mỗi project có **đúng một** `role = 'owner'`.
2. User thêm vào project **phải là thành viên workspace** — kiểm tra ở tầng application qua port `WorkspaceReader`.
3. `PROJ-11` (nhượng quyền project owner) là giao dịch nguyên tử, giống `WS-09`.
4. Vai trò `viewer` = `PROJ-VIEWER` — có quyền đọc + tải file, **không** có quyền ghi (Phần 6 v3).

---

### 3.6. Schema chi tiết — nhóm Dataset

#### 3.6.1. `dataset` (module `datasets`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `ds_<ULID26>` |
| `project_id` | String | `prj_...`, bắt buộc |
| `workspace_id` | String | `ws_...`, bắt buộc — denormalize để kiểm tra quota không cần join |
| `name` | String | bắt buộc, trim, max 100 |
| `original_filename` | String | bắt buộc, max 255 |
| `file_format` | String | enum `csv` \| `xlsx` |
| `file_size_bytes` | Int | bắt buộc, ≥ 0 |
| `content_fingerprint` | String | bắt buộc — `sha256:<hex>` của file gốc |
| `storage_key` | String | bắt buộc — khoá đối tượng trên R2 (mục 3.10) |
| `row_count` | Int | mặc định 0 |
| `column_count` | Int | mặc định 0 |
| `working_sheet_id` | String | nullable — sheet đang làm việc |
| `status` | String | enum `ingesting` \| `ready` \| `failed`, mặc định `ingesting` |
| `ingest_error` | Object | nullable — `{ code, message }` khi `status = 'failed'` |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ project_id: 1 }` | **unique**, partial `{ deleted_at: null }` | **Ràng buộc: mỗi project chỉ có 1 dataset** (Phần 12 mục 3.12) |
| `{ workspace_id: 1, deleted_at: 1 }` | compound | Tính quota theo workspace |
| `{ content_fingerprint: 1 }` | đơn | Tra cứu trùng nội dung (không chặn upload) |

**Quy tắc:**
1. Unique partial trên `project_id` **thay thế** hoàn toàn logic "mỗi project một file" — không cần check thủ công trong service.
2. `status = 'ingesting'` → file đang được xử lý; client poll hoặc nhận thông báo.
3. `status = 'failed'` → `ingest_error` mô tả lý do (VD `password_protected`, `header_not_detected`).
4. `storage_key` **không** bao giờ trả ra API — client dùng endpoint có kiểm tra quyền.

#### 3.6.2. ~~`dataset_sheet`~~ — **GỘP VÀO `dataset` (v4)**

> **Quyết định 2026-11-05 (v4):** Hệ thống chỉ làm việc với file `.csv` → **một file = một bảng** → collection `dataset_sheet` không còn lý do tồn tại. Toàn bộ trường của sheet được **nhúng thẳng vào `dataset`**.
>
> - **21 → 20 collection.**
> - Các trường `sheet_index`, `name` (tên sheet), `is_hidden` bị gỡ.
> - Trường `name` của dataset lấy từ **tên file** (đã có sẵn) — hiển thị ở UI thay cho tên sheet.
> - Mọi tham chiếu `sheet_id` trong collection khác (`ai_job`, `analysis_run`, `project_save`) bị gỡ → dùng `dataset_id`.
> - `dataset_sheet` **vẫn còn trong DB cũ** → được xoá trong migration (Phần 11 v3), kèm cơ chế chặn.
> - **Tác động hiệu năng:** `columns[]` và `column_issues[]` giờ nằm trong document `dataset`. Với CSV 50 MB / 18 cột thì document vẫn nhỏ — nhưng `columns[]` giờ có thể vượt 16 MB nếu file có **hàng nghìn cột** → phải có guard (xem quy tắc bên dưới).

**Trường mới thêm vào `dataset` (thay cho document sheet):**

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `row_count` | Int | mặc định 0 |
| `column_count` | Int | mặc định 0 |
| `has_header` | Boolean | mặc định `true` |
| `delimiter` | String | enum `,` `;` `\t` `|` — delimiter đã nhận diện |
| `columns` | Array\<Object\> | xem bên dưới |
| `column_issues` | Array\<Object\> | lỗi tên cột — xem bên dưới |

**Guard bắt buộc:** số cột vượt **1.000** → `VALIDATION_ERROR` với `details.reason = 'too_many_columns'` (bảo vệ giới hạn 16 MB của MongoDB document). Số cột trong CSV thực tế hiếm khi vượt 1.000.

**Cấu trúc phần tử `columns[]`:**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `key` | String | **khóa ổn định** — `c0`, `c1`, `c2`… theo vị trí. Không đổi khi sửa tên |
| `index` | Int | vị trí cột, ≥ 0 |
| `name` | String | tên hiển thị hiện tại (đã sửa được) |
| `original_name` | String | tên gốc từ file — dùng cho `Reset Dataset` |
| `data_type` | String | enum `string` \| `number` \| `boolean` \| `date` \| `mixed` — suy ra ban đầu, người dùng cấu hình lại được ở Data Views |
| `is_label` | Boolean | mặc định `false` — cột nhãn (phụ thuộc biến) |
| `missing_count` | Int | mặc định 0 |

**Cấu trúc phần tử `column_issues[]`:**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `column_key` | String | `c0`… — null nếu lỗi ở cấp sheet |
| `issue` | String | enum `empty_name` \| `duplicate_name` \| `whitespace_only` |
| `message` | String | thông điệp tiếng Việt |

**Index (v4):** trường nằm trong document `dataset` — không còn index riêng.

**Quy tắc:**
1. `key` là khóa **bất biến** — sửa tên cột chỉ đổi `name`, không đổi `key`. Đây là điều kiện để `dataset_record` không phải viết lại khi đổi tên cột.
2. `column_issues` được tính lại khi người dùng sửa tên cột — nếu hết lỗi thì xoá entry tương ứng.
3. Lỗi tên cột **không** làm fail upload — chỉ **chặn phân tích** (Phần 12 mục 3.12).

#### 3.6.3. `dataset_record` (module `datasets`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `rec_<ULID26>` |
| `dataset_id` | String | `ds_...`, bắt buộc |
| `row_index` | Int | bắt buộc, ≥ 0 — **vị trí dòng trong file CSV gốc** |
| `props` | Object | giá trị theo **khóa cột** — `{ "c0": "abc", "c1": 42 }` |
| `deleted_at` | Date | nullable — dòng đã bị xoá trong dữ liệu làm việc |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ dataset_id: 1, row_index: 1 }` | **unique** | Mỗi dòng file gốc có đúng 1 record |
| `{ dataset_id: 1, row_index: 1 }` | compound | **Cursor pagination** — keyset theo `(row_index, _id)` (Phần 5 v2 mục 3.8) |
| `{ dataset_id: 1, deleted_at: 1 }` | compound | Reset dataset, đếm số dòng còn lại |

**Quy tắc:**
1. **1 document = 1 dòng.** Giá trị ô lưu trong `props` dưới dạng object với key = `key` cột ổn định (`c0`, `c1`…).
2. `row_index` là **vị trí gốc trong file CSV**, không phải vị trí sau khi lọc.
3. Giá trị ô lưu ở dạng JSON thuần: `string`, `number`, `boolean`, `null`. Ô trống → `null`.
4. Kiểu ngày: lưu dạng **chuỗi ISO 8601** (`"2026-03-15T00:00:00.000Z"`) cho tới khi người dùng cấu hình định dạng cột — hệ thống **không tự diễn giải locale** (Phần 12 mục 3.12).
5. `props` dùng tên field có dấu chấm bị chặn — vì vậy key phải là `c0`, `c1` (không phải tên cột thật).

**Quyết định thiết kế quan trọng — vì sao `props` dùng key `c0` chứ không phải tên cột:**
- Sửa tên cột (`VIEW-08`) là thao tác phổ biến. Nếu `props` dùng tên cột thật, mỗi lần sửa tên phải viết lại **toàn bộ** bản ghi của sheet — với 50.000 dòng là không khả thi trong một request.
- Với key ổn định, sửa tên chỉ cập nhật **1 document `dataset`** (v4: không còn `dataset_sheet`).
- Đánh đổi: truy vấn lọc/sắp xếp theo cột phải dùng `props.c3` thay vì `props."Tên cột"` — không đọc được, nhưng đây là đánh đổi đúng để tránh viết lại hàng loạt bản ghi.

**Hiệu năng lọc/sắp xếp:**
- Filter và sort được thực hiện **trong tầng ứng dụng** (JS), không bằng MongoDB query trên `props.c*`.
- Lý do: tên field động (`c0`, `c1`…) không thể tạo index có định trước; filter của Data View có cấu trúc phức tạp (OR trong cùng cột) khó diễn đạt bằng query chuẩn.
- Cách thực thi: truy vấn `dataset_record` theo `{ dataset_id, deleted_at: null }` với **projection chỉ lấy `row_index` + `props.cN` cần thiết**, lọc/sắp xếp trong JS, rồi cắt trang. Với giới hạn 50 MB/file (Phần 12 mục 3.12), số dòng không vượt quá ~200.000 → chấp nhận được trong RAM worker.
- Nếu vượt 200.000 dòng → trả `VALIDATION_ERROR` với `details.reason = 'dataset_too_large_for_filtering'`. Chưa cần tối ưu thêm ở giai đoạn này.
- **v4 — cursor pagination:** vì lọc/sắp xếp diễn ra trong JS, phân trang **cursor** không thể dùng index của MongoDB một cách trực tiếp. Cách thực thi: đọc theo lô `row_index` tăng dần từ vị trí cursor (dùng index `{ dataset_id, row_index }`), lọc/sắp xếp trong JS, dừng khi đủ `limit` bản ghi. Đây là đánh đổi của việc lọc ở tầng ứng dụng — **giải pháp lâu dài** là đẩy filter/sort xuống MongoDB aggregation pipeline.

---

### 3.7. Schema chi tiết — nhóm Analysis & AI

#### 3.7.1. `analysis_run` (module `analysis`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `run_<ULID26>` |
| `project_id` | String | `prj_...`, bắt buộc |
| `workspace_id` | String | `ws_...`, bắt buộc |
| `dataset_id` | String | `ds_...`, bắt buộc |
| `sheet_id` | String | `sht_...`, bắt buộc |
| `status` | String | enum `pending` \| `running` \| `succeeded` \| `failed`, mặc định `pending` |
| `input_fingerprint` | String | bắt buộc — hash đầu vào (Phần 12 mục 3.13) |
| `config` | Object | snapshot cấu hình phân tích tại thời điểm chạy |
| `started_by` | String | `usr_...`, bắt buộc |
| `started_at` | Date | nullable |
| `finished_at` | Date | nullable |
| `duration_ms` | Int | nullable |
| `error` | Object | nullable — `{ code, message }` |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ project_id: 1, created_at: -1 }` | compound | Lịch sử chạy của project |
| `{ input_fingerprint: 1, status: 1 }` | compound | Chống chạy trùng — trả về run đang chạy (Phần 7 mục 3.10) |
| `{ status: 1, started_at: 1 }` | compound | Quét run quá hạn khi khởi động (Phần 12 mục 3.9) |

**Cấu trúc `config`:**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `selected_column_keys` | Array\<String\> | tập cột được chọn phân tích |
| `label_column_key` | String | nullable — cột nhãn |
| `column_overrides` | Object | `{ "c3": { data_type, decimal_separator, thousands_separator, date_format } }` |
| `correlation_method` | String | enum `pearson` \| `spearman` |
| `outlier_method` | String | enum `iqr` \| `modified_zscore` \| `both` |
| `time_granularity` | String | enum `day` \| `week` \| `month` \| `quarter` \| `year` |
| `top_n` | Int | mặc định 10 |
| `thresholds` | Object | ngưỡng ảnh hưởng đã chốt ở Phần 12 mục 3.11 |

**Quy tắc:**
1. `config` là **snapshot bất biến** của cấu hình tại thời điểm chạy — sửa cấu hình sau đó không làm thay đổi run cũ.
2. `input_fingerprint` tính từ `sheet_id` + `selected_column_keys` + `label_column_key` + `config` + `deleted_row_indexes` + `config_version` (Phần 12 mục 3.13).
3. **Sửa ô không làm đổi fingerprint** — quy tắc `keep` + `warn_only`.
4. Xoá dòng **làm đổi fingerprint** → kết quả đã lưu thành `stale`.

#### 3.7.2. `analysis_result` (module `analysis`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `res_<ULID26>` |
| `analysis_run_id` | String | `run_...`, bắt buộc |
| `project_id` | String | `prj_...`, bắt buộc |
| `dataset_id` | String | `ds_...`, bắt buộc |
| `sheet_id` | String | `sht_...`, bắt buộc |
| `input_fingerprint` | String | bắt buộc — bản sao để tra cứu nhanh |
| `is_stale` | Boolean | mặc định `false` — kết quả không còn khớp đầu vào hiện tại |
| `stale_reason` | String | nullable — enum `rows_deleted` \| `config_changed` \| `columns_changed` |
| `column_reports` | Array\<Object\> | kết quả theo cột — xem bên dưới |
| `correlation_matrix` | Object | nullable — ma trận tương quan + VIF (**v5**: xem chi tiết bên dưới) |
| `correlation_matrix.cells[]` | Array | **v5**: mỗi ô thêm `totalScanned`, `missingAOnly`, `missingBOnly`, `missingBoth`; `n + missingAOnly + missingBOnly + missingBoth = totalScanned` |
| `correlation_matrix.excludedColumns[]` | Array | **v5**: `{ column, reason }`; cột `date` dùng lý do riêng `date_column_excluded_from_correlation_vif` |
| `correlation_matrix.totalScanned` | Int | **v5**: tổng dòng quét cho ma trận |
| `vif.commonN` / `vif.totalScanned` | Int | **v5**: số dòng chung + tổng dòng quét |
| `vif.commonNRate` | Number | nullable — **v5**: `commonN/totalScanned` (4 chữ số thập phân) |
| `vif.lossWarning` | String | nullable — **v5**: mất ≥ 20% cảnh báo thận trọng, mất ≥ 50% cảnh báo VIF kém tin (quy ước dự án) |
| `ai_job` worker | — | **v5**: `claimPendingJob` (`findOneAndUpdate` nguyên tử `pending → running`, sort `created_at`); `AiWorkerService` concurrency 1, tắt mặc định (`AI_WORKER_ENABLED=false`), poll `AI_WORKER_INTERVAL_MS`, timeout `AI_JOB_TIMEOUT_MS` = 180000 |
| `class_imbalance` | Array\<Object\> | nullable — kết quả mất cân bằng lớp |
| `time_analysis` | Object | nullable — kết quả phân tích thời gian |
| `summary_stats` | Object | thống kê mô tả tổng hợp |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Cấu trúc phần tử `column_reports[]`:**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `column_key` | String | `c0`… |
| `column_name` | String | tên hiển thị tại thời điểm phân tích |
| `data_type` | String | kiểu đã dùng |
| `row_count` | Int | số dòng đang phân tích |
| `valid_count` / `missing_count` | Int | số dòng hợp lệ / thiếu |
| `dq_issues` | Array\<Object\> | kết quả DQ-01→DQ-04 — xem bên dưới |
| `descriptive_stats` | Object | nullable — mean/median/std/min/max/quartiles |
| `unique_count` | Int | nullable |
| `outliers` | Object | nullable — `{ count, ratio, method, threshold }` |
| `evidence_ids` | Array\<String\> | `evd_...` — tham chiếu bằng chứng |

**Cấu trúc phần tử `dq_issues[]`:**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `code` | String | `DQ-01` \| `DQ-02` \| `DQ-03` \| `DQ-04` \| `DQ-05` |
| `severity` | String | `low` \| `medium` \| `high` — theo ngưỡng Phần 12 mục 3.11 |
| `count` | Int | số lượng phát hiện |
| `ratio` | Number | tỷ lệ trên số dòng đang phân tích |
| `reason` | String | lý do cụ thể (bắt buộc theo Phần 12 mục 3.11) |
| `affected_scope` | String | phạm vi bị ảnh hưởng |
| `rule_applied` | String | quy tắc đã áp dụng — hiển thị trong Tổng kết và PDF |
| `insufficient_samples` | Boolean | mặc định `false` — đánh dấu "không đủ mẫu" thay vì trả 0 |

**Index:** `{ project_id: 1, created_at: -1 }`, `{ analysis_run_id: 1 }`, `{ input_fingerprint: 1, is_stale: 1 }`, `{ dataset_id: 1, sheet_id: 1 }`.

**Quy tắc:**
1. Kết quả **không** bị xoá khi fingerprint thay đổi — chỉ đánh dấu `is_stale = true` (Phần 12 mục 3.13).
2. `DQ-05` luôn hiển thị "Chưa đánh giá" — không tính, không suy đoán.
3. Không đủ số mẫu → `insufficient_samples = true`, **không** trả 0 và không coi là dữ liệu tốt.

#### 3.7.3. `cell_evidence` (module `analysis`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `evd_<ULID26>` |
| `analysis_result_id` | String | `res_...`, bắt buộc |
| `dataset_id` | String | `ds_...`, bắt buộc |
| `sheet_id` | String | `sht_...`, bắt buộc |
| `column_key` | String | `c0`… |
| `column_name` | String | tên cột tại thời điểm phân tích |
| `row_index` | Int | vị trí dòng gốc |
| `issue_code` | String | `DQ-01`→`DQ-04` |
| `severity` | String | `low` \| `medium` \| `high` |
| `raw_value` | Mixed | giá trị gốc — **chỉ dùng nội bộ**, đã che PII trước khi hiển thị |
| `masked_value` | String | giá trị đã che — dùng để hiển thị và gửi AI |
| `is_masked` | Boolean | mặc định `false` — `true` nghĩa là không che được → không gửi AI |
| `created_at` | Date | tự động |

**Index:** `{ analysis_result_id: 1, column_key: 1, severity: -1 }`, `{ analysis_result_id: 1, row_index: 1 }`.

**Quy tắc bảo mật (Phần 12 mục 3.10):**
1. **Tối đa 20 ô lỗi/cột** được lưu làm bằng chứng.
2. `masked_value` là giá trị đã che PII. `raw_value` **không** bao giờ ghi log, không gửi AI, không trả ra API.
3. Nếu không che được → `is_masked = true`, `masked_value = null` — payload AI chỉ gửi thống kê tổng hợp, loại bỏ mẫu ô.
4. Mọi tham chiếu bằng chứng trong kết quả AI phải tồn tại trong collection này (kiểm chứng phản hồi AI — Phần 12 mục 3.9).

#### 3.7.4. `ai_job` (module `ai`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `job_<ULID26>` — trùng `jobId` trả về cho client |
| `analysis_run_id` | String | `run_...`, bắt buộc |
| `project_id` | String | `prj_...`, bắt buộc |
| `dataset_id` | String | `ds_...`, bắt buộc |
| `input_fingerprint` | String | bắt buộc — dùng lại khi thử lại |
| `status` | String | enum `pending` \| `running` \| `succeeded` \| `failed` \| `skipped`, mặc định `pending` |
| `attempt` | Int | mặc định 0 — tối đa 2 retry |
| `model_id` | String | nullable — VD `Qwen3-14B-Q4_K_M`; **bắt buộc** để đánh giá chất lượng theo model (Phần 12 mục 3.15) |
| `prompt_version` | String | nullable — VD `analysis-v3`; **bắt buộc** để truy xuết ngược khi chất lượng giảm |
| `kafka_topic` | String | nullable — `ai.jobs` |
| `kafka_offset` | String | nullable — vị trí message đã xử lý (idempotency) |
| `error` | Object | nullable — `{ code, message, retryable }` |
| `started_at` / `finished_at` | Date | nullable |
| `duration_ms` | Int | nullable |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ analysis_run_id: 1 }` | đơn | Tra cứu job theo run |
| `{ status: 1, started_at: 1 }` | compound | Quét job quá hạn khi khởi động (Phần 12 mục 3.9) |
| `{ project_id: 1, created_at: -1 }` | compound | Lịch sử job AI của project |
| `{ input_fingerprint: 1, status: 1 }` | compound | Chống tạo job trùng |
| `{ model_id: 1, created_at: -1 }` | compound | **Thống kê chất lượng AI theo model** (Phần 12 mục 3.15.5) |

**Quy tắc:**
1. Job **chỉ mang tham chiếu** tới kết quả phân tích — không mang bí mật hệ thống.
2. Timeout mỗi lượt gọi AI: **180 giây** (v4 — CPU-only chậm hơn API nhiều), tối đa **2 retry**. Retry chỉ cho lỗi tạm thời (timeout, engine quá tải, 5xx); lỗi 4xx không retry.
3. Khi worker chết, consumer Kafka **pause/rebalance** → job `running` quá hạn (`heartbeat_at` > 5 phút) → chuyển về `pending` (đếm lại retry) hoặc `failed` nếu hết lượt.
4. **v4:** trạng thái `skipped` = job chờ quá 10 phút trong hàng đợi → bỏ qua (hệ thống đang bận). Người dùng có thể **Thử lại AI** (UC-22).
5. **v4:** `model_id` và `prompt_version` **bắt buộc** — tiền đề cho việc so sánh hiệu năng giữa các model và truy xuất ngược khi chất lượng AI giảm.
4. `AI-01` (Thử lại) tạo job mới với **cùng `input_fingerprint`** — không tạo lại phân tích hệ thống.

---

#### 3.7.5. `finding_feedback` (module `feedback`) — **MỚI v4**

> **Quyết định 2026-11-05 (v4):** Mỗi kết quả hệ thống trả ra kèm phần đánh giá để người dùng nhận xét. Nhận xét được lưu lại làm nguồn dữ liệu học lại cho AI.

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `fb_<ULID26>` |
| `analysis_run_id` | String | `run_...`, bắt buộc |
| `finding_id` | String | nullable — `null` khi nhận xét gắn ở cấp lần phân tích |
| `project_id` | String | `prj_...`, bắt buộc — để kiểm tra quyền nhanh |
| `label` | String | enum `correct` \| `partially_correct` \| `false_positive` \| `missed_issue` \| `other`, bắt buộc |
| `reason` | String | nullable — bắt buộc với `false_positive`/`missed_issue`/`other`, max 2.000 ký tự |
| `suggested_severity` | String | nullable — enum `low` \| `medium` \| `high` \| `critical` |
| `ai_confidence` | Float | nullable — **ảnh chụp** tại thời điểm nhận xét |
| `ai_rationale` | String | nullable — **ảnh chụp** tại thời điểm nhận xét, max 1.000 ký tự |
| `author_id` | String | `usr_...`, bắt buộc |
| `author_role_at_time` | String | bắt buộc — vai trò tại thời điểm nhận xét (để không tính nhầm khi đổi vai trò) |
| `model_id` | String | nullable — model đã sinh phát hiện được nhận xét |
| `prompt_version` | String | nullable |
| `is_anonymized` | Boolean | mặc định `false` — đã được chuẩn hoá thành mẫu học lại hay chưa |
| `deleted_at` | Date | nullable — chỉ dùng cho xoá mềm theo yêu cầu quản trị |
| `created_at` / `updated_at` | Date | tự động |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ analysis_run_id: 1, finding_id: 1, created_at: -1 }` | compound | Xem nhận xét của phát hiện/lần phân tích + **cursor pagination** |
| `{ project_id: 1, created_at: -1 }` | compound | Thống kê chất lượng AI theo project (UC-72) |
| `{ label: 1, created_at: -1 }` | compound | Lọc nhận xét theo nhãn |
| `{ model_id: 1, created_at: -1 }` | compound | So sánh chất lượng giữa các model |

**Quy tắc:**
1. **Append-only về nghiệp vụ.** Không có `updateOne` xoá dữ liệu nhận xét; sửa nhận xét (UC-71) cập nhật `label`/`reason`/`suggested_severity` và `updated_at`. Xoá nhận xét = **soft delete** (`deleted_at`) vì cần giữ dấu vết cho audit.
2. **Không sửa kết quả phân tích.** Nhận xét là lớp đánh giá tách biệt — không đụng `analysis_result`, không đụng `dataset_record`, **không ảnh hưởng `input_fingerprint`**.
3. `ai_confidence` / `ai_rationale` là **ảnh chụp tại thời điểm nhận xét** — không cập nhật khi AI chạy lại. Nhờ vậy có thể đánh giá "AI lúc đó có tự tin sai không".
4. `author_role_at_time` ghi lại vai trò **tại thời điểm nhận xét** — vai trò có thể thay đổi sau đó nhưng không được viết lại lịch sử.
5. **Retention 365 ngày** (TTL index trên `created_at`) — nhận xét cũ hơn 1 năm bị dọn. Kho mẫu học lại (`feedback_example`) là bản đã ẩn danh hoá nên tồn tại lâu hơn.

#### 3.7.6. `feedback_example` (module `feedback`) — **MỚI v4**

> Kho mẫu chuẩn hoá cho cơ chế học lại T1 (Phần 12 mục 3.16.4). Mỗi mẫu là một ví dụ đã **ẩn danh hoá** — không chứa dữ liệu định danh.

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `fex_<ULID26>` |
| `category` | String | enum loại lỗi (`DQ-01`…`DQ-04`, `DQ-05`) — dùng để lọc khi truy xuất |
| `example_type` | String | enum `correct_pattern` \| `false_positive_pattern` \| `missed_pattern` |
| `column_profile` | String | mô tả **đặc điểm nguyên tý** của cột, VD "trạng thái dùng 5 mã viết tắt" |
| `pattern_text` | String | mẫu chuẩn hoá, max 1.000 ký tự — **không** chứa tên/nhận dạng cụ thể |
| `source_feedback_id` | String | `fb_...` — truy vết nguồn |
| `trust_score` | Float | 0–1 — tỉ lệ phản hồi đồng nhất từ ≥ 3 người; **< 0,6 bị loại khỏi kho** |
| `embedding` | Array\<Float\> | vector nhúng (embedding cục bộ `Qwen3-Embedding-0.6B`) |
| `language` | String | mặc định `vi` |
| `usage_count` | Int | mặc định 0 — số lần được truy xuất (hữu ích để dọn mẫu ít dùng) |
| `is_active` | Boolean | mặc định `true` |
| `expires_at` | Date | mặc định `created_at + 180 ngày` — mẫu cũ phải đánh giá lại |
| `created_at` / `updated_at` | Date | tự động |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ category: 1, is_active: 1, trust_score: -1 }` | compound | Lọc theo loại lỗi, sắp xếp theo độ tin cậy |
| `{ language: 1, is_active: 1 }` | compound | Lọc theo ngôn ngữ |
| `expires_at` | **TTL** | Dọn mẫu quá hạn 180 ngày |
| `{ embedding: 'vectorIndex' }` | Atlas Vector Search | Truy xuất cosine top-5 |

**Quy tắc:**
1. **Chỉ mẫu đã ẩn danh hoá** mới được vào kho. Bộ chuẩn hoá phải gỡ: tên người, tên khách hàng, số liệu cụ thể của dataset, mã định danh.
2. Mẫu **không được chứa PII** — kiểm tra bắt buộc trước khi ghi vào kho (Phần 12 mục 3.16.4).
3. `trust_score < 0,6` → `is_active = false`, không dùng cho truy xuất.
4. Mẫu **không được dùng làm ground truth của bộ benchmark** — đây là bài toán "đào ngược" (đánh giá trên dữ liệu đã dùng để huấn luyện sẽ cho kết quả ảo). Bộ benchmark phải từ nhận xét **chưa** dùng làm mẫu.
5. Khi xoá project/workspace: mẫu đã ẩn danh hoá **được giữ** (không chứa dữ liệu định danh); nhận xét gốc bị xoá theo.

### 3.8. Schema chi tiết — nhóm Summary, Versions, Notification, Issue

#### 3.8.1. `project_save` (module `summary`)

Lưu trạng thái làm việc của project (kết quả `PROJ-12`).

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `sav_<ULID26>` |
| `project_id` | String | `prj_...`, bắt buộc |
| `workspace_id` | String | `ws_...`, bắt buộc |
| `dataset_id` | String | `ds_...`, bắt buộc |
| `sheet_id` | String | `sht_...`, bắt buộc |
| `saved_by` | String | `usr_...`, bắt buộc |
| `label` | String | nullable, max 100 — tên bản lưu do người dùng đặt |
| `is_current` | Boolean | mặc định `false` — đánh dấu bản lưu hiện hành |
| `analysis_run_id` | String | nullable — run đã dùng để tạo Tổng kết |
| `input_fingerprint` | String | bắt buộc — fingerprint tại thời điểm lưu (không chứa thành phần dữ liệu) |
| `analysis_config` | Object | snapshot cấu hình phân tích |
| `column_state` | Array\<Object\> | trạng thái cột — xem bên dưới |
| `summary_content` | Object | nullable — nội dung Tổng kết đã tạo |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Cấu trúc phần tử `column_state[]`:**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `column_key` | String | `c0`… |
| `name` | String | tên đã sửa (nếu có) |
| `data_type` | String | kiểu đã cấu hình |
| `is_label` | Boolean | cột nhãn |
| `is_selected` | Boolean | có được chọn phân tích không |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ project_id: 1, is_current: 1 }` | compound | Tìm bản lưu hiện hành |
| `{ project_id: 1, created_at: -1 }` | compound | Lịch sử bản lưu |

**Quy tắc:**
1. **Chỉ một** bản lưu có `is_current = true` cho mỗi project — bảo đảm trong transaction khi lưu bản mới (bản cũ chuyển `false`).
2. **Cập nhật 2026-11-05:** trường `deleted_row_indexes` và `cell_overrides` bị **xoá** — không còn thao tác xoá dòng hay sửa ô. Bản lưu nay chỉ chứa **cấu hình + kết quả phân tích + Tổng kết**.
3. Bản lưu **không chứa trạng thái dữ liệu** — dữ liệu luôn được đọc từ nguồn bất biến (`dataset_record`).
4. Vì `input_fingerprint` không chứa thành phần dữ liệu, Reset Dataset (chỉ khôi phục tên cột) **không** làm mất hiệu lực kết quả phân tích.

#### 3.8.2. ~~`dataset_version` (module `versions`)~~ — **XOÁ (2026-11-05)**

> **Quyết định:** Module `versions` bị xoá hoàn toàn → collection `dataset_version` **không còn tồn tại**. Xem mục 3.11c.
>
> - Bỏ các trường `version_number`, `record_count`, `deleted_row_count`, `changes_summary` (chứa `added_rows`, `deleted_rows`, `edited_cells`, `renamed_columns`).
> - Bỏ cơ chế hash Merkle (`version_hash`) và mọi index liên quan.
> - **Lý do:** dữ liệu bất biến → không có "phiên bản dữ liệu" để snapshot hay diff; rollback là thao tác ghi đè dữ liệu.
> - Số collection: 22 → **21**.

#### 3.8.3. `notification` (module `notifications`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `ntf_<ULID26>` |
| `user_id` | String | `usr_...`, bắt buộc — người nhận |
| `type` | String | enum — xem bảng bên dưới |
| `is_mandatory` | Boolean | mặc định `false` — nhóm thông báo bắt buộc, không bị tắt bởi công tắc |
| `title` | String | bắt buộc, max 200 |
| `summary` | String | nullable, max 500 |
| `payload` | Object | dữ liệu điều hướng — `{ targetType, targetId, actionUrl }` |
| `source_event_id` | String | nullable — `obx_...`; null nếu không phát sinh từ event |
| `read_at` | Date | nullable |
| `created_at` | Date | tự động |
| `expires_at` | Date | TTL — retention |

**Bảng `type`:**

| `type` | Phát ra bởi | Bắt buộc? |
|---|---|---|
| `project_created` | `projects` | Không |
| `project_deleted` | `projects` | Không |
| `project_member_added` | `projects` | Không |
| `issue_needs_info` | `issues` | **Có** — chuyển trạng thái sang `new` |
| `issue_resolved` | `issues` | Không |
| `analysis_completed` | `analysis` | Không |
| `analysis_failed` | `analysis` | Không |
| `ai_analysis_ready` | `ai` | Không |
| `report_ready` | `reports` | Không |
| `security_alert` | `auth` | **Có** |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ user_id: 1, read_at: 1, created_at: -1 }` | compound | `NOTIF-01` danh sách + lọc `read` |
| `{ user_id: 1, read_at: 1 }` | compound | Đếm chưa đọc |
| `{ user_id: 1, source_event_id: 1 }` | **unique**, partial `{ source_event_id: { $ne: null } }` | Chống thông báo trùng khi event bị xử lý lại |
| `{ expires_at: 1 }` | **TTL** | Retention |

**Quy tắc:**
1. Tắt công tắc (`notifications_enabled = false`) → bỏ qua thông báo **không bắt buộc**; thông báo `is_mandatory = true` vẫn được gửi (Phần 2 mục 3.37, Phần 3 mục 3.x).
2. Thông báo chỉ phát sinh từ **sự kiện hệ thống** qua outbox — không có API tạo thủ công.
3. `payload.targetId` cho phép frontend điều hướng tới đối tượng liên quan.
4. **V2 — `source_event_id`:** mỗi thông báo ghi lại event đã sinh ra nó. Unique partial `(user_id, source_event_id)` đảm bảo một event chỉ tạo **một** thông báo cho mỗi người nhận. Đây là lớp chống trùng **thứ hai** bên cạnh inbox `processed_event`:
   - `processed_event` chặn trùng ở mức **event** (cả event, không phải từng người nhận).
   - `source_event_id` chặn trùng ở mức **(người nhận, event)** — cần thiết vì một event có thể sinh thông báo cho **nhiều** người (VD `project.created` cho mọi thành viên workspace).
5. `source_event_id` là `null` khi thông báo không phát sinh từ event — unique partial với điều kiện `$ne: null` cho phép nhiều bản ghi null trong cùng một `user_id`.

#### 3.8.4. `issue_report` (module `issues`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `iss_<ULID26>` |
| `user_id` | String | `usr_...`, bắt buộc — người gửi |
| `workspace_id` | String | nullable — workspace đang ở khi gửi |
| `issue_type` | String | enum `function_error` \| `display_error` \| `data_error` \| `feature_feedback` \| `other` |
| `title` | String | bắt buộc, max 200 |
| `description` | String | bắt buộc, max 5000 |
| `status` | String | enum `new` \| `in_progress` \| `resolved` \| `closed`, mặc định `new` |
| `attachments` | Array\<Object\> | tối đa 3 — xem bên dưới |
| `context` | Object | ngữ cảnh lỗi — xem bên dưới |
| `deleted_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |
| `version` | Int | mặc định 1 |

**Cấu trúc phần tử `attachments[]`:**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | String | `att_<ULID26>` — định danh phục vụ URL tải |
| `filename` | String | tên file gốc, max 255 |
| `storage_key` | String | khoá trên R2 — **không** trả ra API |
| `size_bytes` | Int | ≤ 10 MB (mục 6.2 câu hỏi mở) |
| `content_type` | String | mime đã kiểm tra bằng magic bytes |

**Cấu trúc `context`:**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `api_path` | String | nullable, max 200 |
| `error_message` | String | nullable, max 1000 |
| `occurred_at` | Date | nullable |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ user_id: 1, status: 1, created_at: -1 }` | compound | `ISSUE-02` danh sách của tôi + lọc trạng thái |
| `{ status: 1, created_at: -1 }` | compound | `ISSUE-04` danh sách quản trị |
| `{ workspace_id: 1, created_at: -1 }` | compound | Lọc theo workspace |

**Quy tắc:**
1. **Chỉ Admin** đổi `status` — người dùng không sửa nội dung báo cáo sau khi gửi (Phần 2 mục `ISSUE-04`).
2. Chuyển trạng thái hợp lệ: `new` → `in_progress` → `resolved` → `closed`, và `in_progress` → `new`.
3. Mọi thay đổi trạng thái **ghi audit log** (`ISSUE_STATUS_CHANGED`).
4. Chuyển sang `new` → phát thông báo `issue_needs_info` (bắt buộc) qua outbox.
5. File đính kèm kiểm tra mime thực bằng magic bytes, chặn file thực thi — không phục vụ file tĩnh trực tiếp.

#### 3.8.5. `outbox_event` (module `shared`)

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `obx_<ULID26>` |
| `event_type` | String | bắt buộc — `dot.camelCase`, xem bảng bên dưới |
| `aggregate_type` | String | bắt buộc — loại thực thể phát |
| `aggregate_id` | String | bắt buộc |
| `workspace_id` | String | nullable — phạm vi |
| `project_id` | String | nullable — phạm vi |
| `actor_id` | String | nullable — người gây ra sự kiện |
| `payload` | Object | bắt buộc — dữ liệu sự kiện, không chứa PII |
| `status` | String | enum `pending` \| `publishing` \| `published` \| `failed`, mặc định `pending` |
| `lease_expires_at` | Date | nullable — mốc hết hạn claim của relay |
| `retry_count` | Int | mặc định 0 |
| `last_error` | String | nullable, max 1000 |
| `published_at` | Date | nullable |
| `created_at` | Date | tự động |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ status: 1, created_at: 1 }` | compound | Relay quét event chờ publish |
| `{ status: 1, lease_expires_at: 1 }` | partial `{ status: 'publishing' }` | Quét event kẹt trong `publishing` |
| `{ aggregate_type: 1, aggregate_id: 1, created_at: -1 }` | compound | Truy vấn theo thực thể |
| `{ published_at: 1 }` | partial `{ status: 'published' }` | Dọn dẹp sau khi publish |
| `{ created_at: 1 }` | **TTL, `expireAfterSeconds: 604800`** | Xoá sau 7 ngày đã publish |

**Bảng `event_type` (đợt 1):**

| `event_type` | Phát ra bởi | Tiêu thụ bởi |
|---|---|---|
| `project.created` | `projects` | `notifications` |
| `project.deleted` | `projects` | `notifications` |
| `project.memberAdded` | `projects` | `notifications` |
| `issue.statusChanged` | `issues` | `notifications`, `audit` |
| `analysis.completed` | `analysis` | `notifications` |
| `analysis.failed` | `analysis` | `notifications` |
| `ai.jobSucceeded` | `ai` | `notifications` |
| `ai.jobFailed` | `ai` | `notifications` |
| `report.ready` | `reports` | `notifications` |
| `workspace.ownerTransferred` | `workspaces` | `audit` |
| `project.ownerTransferred` | `projects` | `audit` |
| `project.memberRoleChanged` | `projects` | `audit` |
| `workspace.memberRoleChanged` | `workspaces` | `audit` |

**Quy tắc:**
1. Event ghi vào outbox **phải cùng transaction** với thay đổi trạng thái (Phần 4 v2 mục 3.5).
2. Event là **append-only** — không cập nhật nội dung `payload`. Các trường `status`, `lease_expires_at`, `retry_count`, `last_error`, `published_at` là **trạng thái vận hành**, được cập nhật bởi relay.
3. `payload` **không** chứa PII, không chứa giá trị ô dữ liệu, không chứa khóa/credential.
4. Vòng đời trạng thái (Phần 9 mục 3.4.3):

```
pending ──(relay claim)──→ publishing ──(publish OK)──→ published
   ▲                          │
   │  (publish lỗi)          │ (relay chết → lease hết hạn)
   └──────────────────────────┘
   
publishing ──(retry > 5)──→ failed
```

5. Relay **claim trước, publish sau, đánh dấu `published` sau cùng** — không bao giờ đánh dấu `published` trước khi publish thành công.
6. Event kẹt ở `publishing` quá 60 giây (theo `lease_expires_at`) → polling fallback đưa về `pending` để publish lại.
7. `retry_count > 5` → đặt `status = 'failed'` + `last_error`, ghi log cảnh báo. Không tự retry tiếp — cần thao tác thủ công.
8. Consumer phải **idempotent** — dùng `_id` của event làm khoá, qua collection `processed_event` (mục 3.8.6).

**Ghi chú v2 — vì sao cần trạng thái `publishing`:**
Nếu chỉ có `pending`/`published`/`failed` và đánh dấu `published` **trước** khi publish (để không mất event khi worker chết), thì khi worker chết giữa lúc đánh dấu và lúc publish, event bị kẹt ở `published` mà **chưa** được publish → không ai xử lý, không polling nào thấy. Trạng thái `publishing` + `lease_expires_at` giải quyết lỗ hổng này: mốc hết hạn cho phép polling nhận ra event mồ côi và phát lại. Chi tiết phân tích ở Phần 9 mục 3.4.3.

---

#### 3.8.6. `processed_event` (module `shared`)

Inbox pattern — chống xử lý trùng ở tầng DB (Phần 9 mục 3.4.5).

| Trường | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `_id` | String | `pev_<ULID26>` |
| `consumer_name` | String | bắt buộc — VD `notifications`, `audit` |
| `event_id` | String | bắt buộc — `obx_...` |
| `event_type` | String | bắt buộc — VD `issue.statusChanged` |
| `status` | String | enum `processing` \| `completed` \| `failed`, mặc định `processing` |
| `lease_id` | String | nullable — token của lần claim hiện tại |
| `locked_at` | Date | nullable |
| `lease_expires_at` | Date | nullable — mặc định claim + 30 giây |
| `attempts` | Int | mặc định 1 |
| `last_error_code` | String | nullable, max 100 |
| `last_error_at` | Date | nullable |
| `completed_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ consumer_name: 1, event_id: 1 }` | **unique** | Chặn xử lý trùng |
| `{ status: 1, lease_expires_at: 1 }` | compound | Quét claim kẹt (lease hết hạn) |
| `{ created_at: 1 }` | **TTL, `expireAfterSeconds: 604800`** | Xoá sau 7 ngày |

**Quy tắc:**
1. `completed` là **trạng thái cuối** — event đã `completed` không bao giờ được xử lý lại.
2. Lease mặc định **30 giây** — đủ cho side effect nhẹ (insert notification, insert audit log).
3. Claim cũ hơn 30 giây (`lease_expires_at <= now`) được **chiếm lại** (stale reclaim) — chống consumer chết giữa chừng làm kẹt event vĩnh viễn.
4. `status = 'failed'` cho phép thử lại ở lượt tiếp theo, `attempts` tăng dần.
5. `attempts > 5` với status `failed` → giữ nguyên trong DB để điều tra, **không** tự retry thêm.
6. Job AI và PDF **không** dùng inbox — chúng idempotent theo trạng thái `ai_job.status` và `report.status` (Phần 9 mục 3.5.3, 3.5.4).

### 3.9. Transaction boundary, concurrency và consistency

#### 3.9.1. Nguyên tắc

| # | Quy tắc |
|---|---|
| 1 | Mọi thay đổi trạng thái nghiệp vụ + ghi outbox event **phải cùng một transaction** |
| 2 | Transaction **không** bao gồm: ghi file lên R2, gọi AI, gửi email, sinh PDF |
| 3 | Import dataset **không** ghi toàn bộ record trong 1 transaction — xem mục 3.9.4 |
| 4 | MongoDB transaction yêu cầu **replica set** — bắt buộc cấu hình vận hành (Phần 10) |
| 5 | Timeout transaction: **15 giây** — vượt → abort, trả `DEPENDENCY_UNAVAILABLE` |

#### 3.9.2. Bảng transaction boundary theo use case

| Use case | Collection ghi | Transaction | Ghi chú |
|---|---|---|---|
| `WS-01` Tạo workspace | `workspace`, `workspace_member` | ✅ | + outbox |
| `WS-07` Thêm thành viên | `workspace_member` | ✅ | + gửi email lời mời **ngoài** transaction |
| `WS-09` Nhượng Owner | `workspace`, `workspace_member` | ✅ | + audit change + outbox |
| `WS-10` Rời workspace | `workspace`, `workspace_member` | ✅ | |
| `PROJ-01` Tạo project | `project`, `project_member` | ✅ | + outbox |
| `PROJ-10` Đổi vai trò | `project_member` | ✅ | + audit + outbox |
| `PROJ-11` Nhượng Owner | `project`, `project_member` | ✅ | + audit + outbox |
| `PROJ-13` Import dataset | `dataset`, `dataset_sheet`, `dataset_record` | ⚠️ xem 3.9.4 | |
| `VIEW-05` Xoá dòng | `dataset_record` | ❌ | Ghi hàng loạt, xem 3.9.5 |
| `VIEW-06` Sửa ô | `dataset_record` | ❌ | Ghi 1 document |
| `VIEW-07` Reset dataset | `dataset_record` | ❌ | Ghi hàng loạt |
| `ANALYSIS-01` Cấu hình | `analysis_run` | ✅ | |
| `ANALYSIS-02` Chạy phân tích | `analysis_run`, `analysis_result`, `cell_evidence` | ✅ (giai đoạn ghi kết quả) | |
| `AI-01` Thử lại | `ai_job` | ✅ | |
| `FB-01` Nhận xét phát hiện | `finding_feedback` | ✅ (ghi append-only) | |
| `FB-02` Nhận xét lần phân tích | `finding_feedback` | ✅ (ghi append-only) | |
| `SUMMARY-01` Tạo Tổng kết | `project_save` | ✅ | |
| `PROJ-12` Lưu trạng thái | `project_save` | ✅ | + đánh dấu `is_current` (không ghi `dataset_record`) |
| ~~`PROJ-08` Rollback~~ | ~~`dataset_record`, `dataset_version`, `project`~~ | **Bỏ 2026-11-05** — tính năng đã gỡ | |
| `ISSUE-01` Tạo báo cáo | `issue_report` | ✅ | Ghi file R2 **trước**, ngoài transaction |
| `ISSUE-04` Đổi trạng thái | `issue_report` | ✅ | + audit + outbox |
| `NOTIF-02` Đánh dấu đã đọc | `notification` | ❌ | 1 document, không cần transaction |

#### 3.9.3. Quy tắc đọc

| # | Quy tắc |
|---|---|
| 1 | Mặc định đọc từ **primary** (read-your-writes) — đặc biệt sau khi ghi trong cùng request |
| 2 | Không dùng read preference `secondaryPreferred` trong luồng yêu cầu xác thực/quyền |
| 3 | Cache (Redis) chỉ dùng cho rate-limit, không cache dữ liệu nghiệp vụ |

#### 3.9.4. Luồng import dataset (ngoại lệ transaction)

**Quy trình 5 bước — tránh transaction quá lớn:**

```
1. [ngoài transaction]  Kiểm tra quota workspace
2. [ngoài transaction]  Ghi file gốc lên R2 (storage_key đã biết trước)
3. [transaction A]       Tạo dataset { status: 'ingesting' } + dataset_sheet[]
                        └─ nếu lỗi: xoá file R2, trả lỗi
4. [ngoài transaction]  Đọc file, chèn dataset_record theo lô 5.000 dòng
                        └─ nếu lỗi giữa chừng: xoá các record đã chèn,
                           đặt status='failed' + ingest_error, xoá file R2
5. [transaction B]       Đặt status='ready', cập nhật row_count/column_count,
                        ghi outbox event, cập nhật project.status='in_progress'
```

**Quy tắc:**
1. Lô chèn 5.000 dòng — đây là giá trị thực nghiệm hợp lý cho `insertMany` với `ordered: false`.
2. Dùng `insertMany({ ordered: false })` để tăng tốc độ; lỗi một dòng (duplicate) được bỏ qua và đếm.
3. Nếu chèn lỗi → xoá toàn bộ record đã chèn theo `dataset_id` (ngoài transaction, `deleteMany` — idempotent).
4. **Chỉ** đặt `status='ready'` khi chèn xong toàn bộ.
5. Mọi lần ghi `dataset_record` dùng `upsert` theo `{ dataset_id, sheet_id, row_index }` → chạy lại import an toàn.

#### 3.9.5. Luồng ghi hàng loạt (import — đường ghi duy nhất)

**Quy tắc:**
1. Các thao tác ghi hàng loạt **không** dùng transaction — quá lớn, giữ lock lâu, dễ vượt 16MB oplog.
2. Thay vào đó dùng mô hình **"ghi rồi chốt"**:
   - Ghi từng lô, theo dõi tiến độ.
   - Chỉ cập nhật trạng thái tổng thể (ví dụ `project.status`) **sau khi** tất cả lô hoàn tất.
3. Nếu lỗi giữa chừng → thao tác bị coi là thất bại, trạng thái tổng thể **không** đổi, và một thao tác khôi phục phải có thể chạy lại.
4. **Cập nhật 2026-11-05:** bỏ quy tắc rollback phiên bản (module `versions` bị xoá). Luồng ghi hàng loạt nay chỉ dùng cho **Import** — đường ghi duy nhất vào `dataset_record`.

#### 3.9.6. Concurrency

| Tình huống | Cơ chế xử lý |
|---|---|
| 2 người sửa cùng project | `version` + `expectedVersion` → `409 CONFLICT` |
| 2 người thêm cùng 1 user vào workspace | Unique partial index → `409 CONFLICT` (mã `CONFLICT`) |
| 2 người nhận quyền Owner đồng thời | Transaction + kiểm tra invariant "đúng 1 owner" → 1 thành công, 1 thất bại |
| 2 lần chạy phân tích cùng lúc | Index `{ input_fingerprint, status }` → trả về run đang chạy |
| 2 lần tạo job AI cùng lúc | Tương tự, theo `input_fingerprint` |
| Worker xử lý lại event | Idempotent theo `outbox_event._id` |
| Ghi record song song khi import | `upsert` theo `{ dataset_id, sheet_id, row_index }` |

#### 3.9.7. Consistency của kết quả phân tích

| # | Quy tắc |
|---|---|
| 1 | `analysis_result` luôn gắn với 1 `analysis_run` cụ thể — không bao giờ là kết quả "trực tiếp" |
| 2 | Khi fingerprint đầu vào hiện tại ≠ fingerprint của kết quả đã lưu → đánh dấu `is_stale = true`, **không xoá** |
| 3 | Tạo Tổng kết mới khi phân tích hệ thống chưa chạy lại với đầu vào hiện tại → từ chối (`CONFLICT`) |
| 4 | ~~Sửa ô **không** làm mất hiệu lực kết quả (`keep` + `warn_only`)~~ — **gỡ 2026-11-05**, không còn sửa ô. Mọi thay đổi đầu vào đều gây `stale` |
| 5 | Dữ liệu bất biến: `dataset_record` chỉ được ghi lúc Import và không bao giờ bị sửa hay xoá (Phần 2 mục 3.40) |

---

### 3.10. Layout lưu trữ trên R2

**Cấu trúc khoá:**

```
raw_files/{workspaceId}/{projectId}/{datasetId}.{ext}
issue_attachments/{issueId}/{attachmentId}.{ext}
reports/{projectId}/{reportId}.pdf
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | **Giữ đúng extension gốc** — sửa lỗi hiện tại ghi `.csv` cho cả `.xlsx` (Phần 7 mục 3.8) |
| 2 | Bucket R2 **không public** — mọi lần tải đi qua endpoint có kiểm tra quyền (Phần 7 mục 3.9) |
| 3 | Tên file do **server** sinh, không tin tên client gửi |
| 4 | Lỗi giữa chừng phải **dọn file tạm** trong bucket (Phần 12 mục 3.12) |
| 5 | File gốc dataset **không** bao giờ bị ghi đè — mỗi project 1 dataset |
| 6 | Mỗi lần sinh PDF tạo khoá mới — không ghi đè |
| 7 | `storage_key` lưu trong DB; **không** trả ra API |
| 8 | Adapter local fallback dùng cùng cấu trúc khoá để chuyển đổi R2 ↔ local không cần sửa code |

**Sơ đồ vòng đời file:**

```
Upload:
  1. Kiểm tra quota (trước khi ghi)        ── quá quota → 429 LIMIT_EXCEEDED, không ghi
  2. Sinh storage_key
  3. Ghi file lên R2                        ── lỗi → xoá file tạm, trả lỗi
  4. Transaction A: tạo dataset (ingesting)
  5. Đọc file, chèn records theo lô         ── lỗi → xoá records, xoá file R2, status=failed
  6. Transaction B: status=ready + outbox

Xoá dataset (soft delete):
  - File gốc GIỮ LẠI (khôi phục được)      ── xoá vật lý sau khi hết retention
```

**Bảng retention của file:**

| Loại file | Xoá vật lý | Lý do |
|---|---|---|
| `raw_files/` | Khi dataset bị xoá cứng sau khi hết retention (90 ngày) | Khôi phục được trong 90 ngày |
| `issue_attachments/` | 180 ngày sau khi báo cáo đóng | Báo cáo đã xử lý xong |
| `reports/` | 90 ngày sau khi sinh | Tái sinh được từ Tổng kết |

---

### 3.11. Retention và chính sách giữ dữ liệu

| Collection | Cơ chế | Thời hạn |
|---|---|---|
| `user_session` | TTL index | `expires_at` (30 ngày) |
| `notification` | TTL index | 90 ngày |
| `audit_log` | TTL index | 365 ngày |
| `audit_change` | TTL index | 365 ngày (theo `audit_log`) |
| `outbox_event` | TTL index | 7 ngày sau khi publish |
| `processed_event` | TTL index | 7 ngày |
| `ai_job` | Xoá mềm + dọn sau 90 ngày | 90 ngày |
| `finding_feedback` | Xoá mềm + dọn sau 365 ngày | 365 ngày |
| `feedback_example` | Dọn sau 180 ngày (mẫu cũ cần đánh giá lại) | 180 ngày |
| `analysis_run` / `analysis_result` / `cell_evidence` | Xoá mềm, dọn sau 180 ngày | 180 ngày |
| `project_save` | Xoá mềm, dọn sau 180 ngày (giữ bản `is_current`) | 180 ngày |
| Thực thể nghiệp vụ (`user`, `workspace`, `project`, `dataset`, `issue_report`) | Xoá mềm, dọn sau 90 ngày | 90 ngày |

**Cơ chế dọn dẹp:** một job Kafka chạy hằng ngày (`cleanup`, consumer group `maintenance`), xoá mềm → xoá cứng các bản ghi quá hạn, và xoá file trên R2 tương ứng. Job phải **idempotent** và chạy an toàn khi chạy lại.

**Quy tắc bắt buộc:**
1. **Không** xoá cứng bất kỳ bản ghi nào còn được tham chiếu: `project` đang có `dataset`; `dataset` đang có `dataset_record`; `analysis_result` đang được `project_save` tham chiếu.
2. Xoá cứng collection log (`audit_log`, `notification`, `outbox_event`) được phép bởi TTL index — không cần job dọn riêng.
3. Thời hạn ở trên là **mặc định khởi điểm**, ghi đè được qua biến môi trường.

---

### 3.12. Đối chiếu với schema hiện tại

| Collection hiện tại | Trạng thái | Collection mới | Ghi chú |
|---|---|---|---|
| `users` | Cũ | `user` | Đổi tên, thêm `phone`/`bio`/`notifications_enabled`/`last_login_at`, `_id` → `usr_` |
| `user_sessions` | Cũ | `user_session` | `_id` → `ses_`, thêm `device_label`/`revoked_at`/`revoke_reason` |
| `workspaces` | Cũ | `workspace` + `workspace_member` | **Tách** `members[]` ra collection riêng, đổi `owner\|editor\|viewer` → `owner\|member` |
| `projects` | Cũ | `project` + `project_member` | Bỏ `has_dataset`, thêm `status`, tách membership |
| `datasets` | Cũ | `dataset` + `dataset_sheet` + `dataset_record` | **Tách 3 collection**, thêm `content_fingerprint`, bỏ `file_checksum` |
| `dataset_records` | Cũ | `dataset_record` | Đổi `data` (key = tên cột) → `props` (key = `c0`…), thêm `sheet_id` |
| `dataset_versions` | Cũ | ~~`dataset_version`~~ | **Bỏ 2026-11-05** — collection không còn tồn tại; dữ liệu cũ chỉ giữ để đối chiếu, không migrate |
| `outbox_events` | Cũ | `outbox_event` | `_id` → `obx_`, chuẩn hoá `event_type` |
| `clean_rules` | **Xoá** | — | Module LEGACY (Phần 4 mục 3.9) |
| `lineage` / `lineage_nodes` | **Xoá** | — | Module LEGACY |
| `exports` / `export_tasks` | **Xoá** | — | Module LEGACY |
| `ai_jobs` | Cũ | `ai_job` | Thêm `input_fingerprint`, `kafka_topic`/`kafka_partition`/`kafka_offset`, `model_id`, `prompt_version`, `attempt` |
| `analysis_results` | Cũ | `analysis_run` + `analysis_result` + `cell_evidence` | **Tách 3 collection** |
| — | Mới | `notification` | Module mới |
| — | Mới | `issue_report` | Module mới |
| — | Mới | `audit_log` + `audit_change` | Module mới |
| — | Mới | `processed_event` | Inbox chống xử lý trùng (Phần 9) |
| — | Mới | `project_save` | Module `summary` |

**Thay đổi cấu trúc quan trọng:**

| # | Thay đổi | Lý do | Ảnh hưởng migration |
|---|---|---|---|
| 1 | `workspace.members[]` → `workspace_member` | Phình document, index kém, truy vấn theo user chậm | Phần 11 |
| 2 | `workspace_member.role`: `owner\|editor\|viewer` → `owner\|member` | Sai mô hình quyền Phần 6 v3 | Phần 11 — cần quy tắc map `editor` → `member` |
| 3 | `project.has_dataset` → `project.status` | Một nguồn sự thật duy nhất | Phần 11 — cần quy tắc suy ra `status` |
| 4 | `dataset_record.data` (key = tên cột) → `props` (key = `c0`…) | Sửa tên cột không phải viết lại toàn bộ bản ghi | Phần 11 — cần map tên cột → `c0`… |
| 5 | `_id` ObjectId → String có tiền tố | Đọc log dễ, nhận diện loại | Phần 11 — cần bảng map id |
| 6 | Tách `datasets` thành 3 collection | Sheet/record tách bạch, index tốt | Phần 11 |
| 7 | Bỏ `file_checksum` → `content_fingerprint` | Định dạng `sha256:<hex>` thống nhất | Phần 11 |

---

### 3.13. Quy tắc kiểm thử schema

| # | Kiểm tra |
|---|---|
| S1 | Mọi collection có `_id` đúng định dạng `<prefix>_<ULID26>` |
| S2 | Mọi collection có `created_at`, `updated_at` (trừ `outbox_event` không có `updated_at`) |
| S3 | Mọi collection có `version` (trừ `audit_log`, `audit_change`, `outbox_event`) |
| S4 | Mọi tham chiếu chéo collection là String, không phải `ObjectId` |
| S5 | Mọi collection có soft delete đều lọc `deleted_at: null` trong repository adapter |
| S6 | Mọi unique constraint đều là **partial index** có điều kiện `deleted_at: null` (trừ `user_session.refresh_token_hash`) |
| S7 | Mọi collection có soft delete đều có index phủ `{ ... , deleted_at }` cho truy vấn mặc định |
| S8 | Mọi collection log có TTL index |
| S9 | Không collection nào có trường chứa dữ liệu nhạy cảm không mã hoá: `password_hash`, `refresh_token_hash`, `google_id`, `password_reset_otp_hash` đều `select: false` |
| S10 | Mọi trường trong schema Mongoose có `select: false` hoặc nằm trong danh sách cho phép trả ra API |
| S11 | Mọi collection có `_id` String — không dùng `_id` mặc định của MongoDB |
| S12 | Mọi ghi trạng thái nghiệp vụ đều có outbox event ghi kèm trong cùng transaction |
| S13 | Không truy vấn trực tiếp collection của module khác từ repository adapter |
| S14 | Mọi unique index trên `project_id` trong `dataset` đảm bảo "mỗi project 1 dataset" |
| S15 | Mọi collection có trường `storage_key` đều không xuất hiện trong contract response |
| S16 | `outbox_event.status` chỉ nhận 4 giá trị `pending`/`publishing`/`published`/`failed`; không có đường chuyển trực tiếp `pending` → `published` |
| S17 | Mọi consumer có inbox đều khai báo `consumer_name` trong danh mục; `processed_event` có unique `(consumer_name, event_id)` |
| S18 | `notification.source_event_id` tham chiếu tới `outbox_event._id` tồn tại; unique partial `(user_id, source_event_id)` |

---

### 3.11c. Tác động quyết định "chỉ đọc" đến schema (2026-11-05)

#### 3.11c.1. Collection bị gỡ

| Collection | Module | Lý do |
|---|---|---|
| `dataset_version` | `versions` | Không còn phiên bản dữ liệu để snapshot/diff; rollback là ghi đè dữ liệu |

**Tổng: 22 → 21 → 20 → 21 collection** (v3 bỏ `dataset_version`; v4 gộp `dataset_sheet` rồi thêm 2 collection feedback).

#### 3.11c.2. Trường bị gỡ

| Collection | Trường | Lý do |
|---|---|---|
| `project_save` | `deleted_row_indexes` | Không còn xoá dòng |
| `project_save` | `cell_overrides` | Không còn sửa ô |

#### 3.11c.3. Bất biến dữ liệu — ràng buộc thiết kế

| Ràng buộc | Mô tả |
|---|---|
| `dataset_record` chỉ được **INSERT** | Mọi đường ghi vào bản ghi dữ liệu đều là insert lúc Import. Không có `updateOne`, `findOneAndUpdate`, `deleteOne`, `deleteMany` lên `dataset_record` trong bất kỳ đường dẫn nào. |
| Bản ghi không bị soft-delete | `dataset_record` **không** nằm trong danh sách collection có soft delete. Xoá dataset (xoá project) bằng cách xoá mềm `dataset` ở cấp cha, không xoá bản ghi. |
| `project_save` chỉ chứa cấu hình + kết quả | Không chứa trạng thái dữ liệu. Dữ liệu luôn đọc từ `dataset_record`. |
| `input_fingerprint` không chứa thành phần dữ liệu | Chỉ gồm sheet, tập cột, cột nhãn, cấu hình phân tích. |
| Cơ chế `stale` đơn giản | Mọi thay đổi đầu vào đều gây `is_stale = true`. Không còn nhánh `keep` + `warn_only`. |
| Không có index theo trạng thái "đã xoá dòng" | Vì không có dòng bị xoá. |

#### 3.11c.4. Đường ghi `dataset_record` còn lại

```
Upload → Storage (file gốc, bất biến)
       → Parse & validate schema
       → Bulk INSERT dataset_record  (lô 5.000, upsert idempotent theo {dataset_id, sheet_id, row_index})
       → Ghi dataset_sheet, dataset
```

Không còn đường ghi nào khác. Điều này loại bỏ hẳn các nhóm lỗi: ghi đè dữ liệu, mất dữ liệu do transaction lỗi giữa chừng, race condition khi sửa ô đồng thời.

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 2 v4 — 77 tính năng, trường mới yêu cầu (`project.status`, `user.phone`, `user.bio`, `user.notifications_enabled`, `workspace.last_accessed_at`), ngưỡng ảnh hưởng, quy tắc tìm kiếm.
- Phần 3 v2 — vòng đời trạng thái, quy tắc nghiệp vụ theo use case.
- Phần 4 v3 — 20 module, ranh giới sở hữu collection, outbox pattern, quy tắc dependency R1–R12.
- Phần 5 v1 — rich domain model, `version`/optimistic locking, offset pagination, `dispatchDomainEvents()`.
- Phần 6 v3 — 5 vai trò, TTL token, audit 8 hành động.
- Phần 7 v1 — quy ước camelCase, cấu trúc response/lỗi, ràng buộc `expectedVersion`.
- Phần 9 v1 — cơ chế outbox 4 trạng thái, inbox pattern, quy tắc idempotency consumer.
- Phần 12 v2 — `input_fingerprint`, quy tắc import file, xoá dòng/sửa ô, che PII, cơ chế AI.
- Mã nguồn hiện tại — 10 schema Mongoose (`user`, `user_session`, `workspace`, `project`, `dataset`, `dataset_record`, `dataset_version`, `outbox_event`, `clean_rule`, `export_task`).

**Đầu ra**
- 9 quyết định schema nền tảng.
- Quy ước định danh, đặt tên, trường chuẩn, soft delete, `version`.
- Danh mục **21 collection** kèm module sở hữu và cơ chế xoá.
- Schema chi tiết từng collection: trường, kiểu, ràng buộc, index.
- Transaction boundary theo 19 use case; 2 luồng đặc biệt (import, ghi hàng loạt). **Cập nhật 2026-11-05: bỏ luồng rollback** — xem mục 3.11c.
- Quy tắc concurrency (7 tình huống) và consistency kết quả phân tích.
- Layout lưu trữ R2 + vòng đời file + retention.
- Bảng retention cho 21 collection.
- Đối chiếu schema hiện tại (7 collection tách/chuyển, 3 collection mới, 3 collection xoá).
- 18 quy tắc kiểm thử schema S1–S18.

## 5. Điều kiện hoàn tất phần này

Schema và invariant đáp ứng use case; các thay đổi so với dữ liệu hiện tại được ghi rõ.

**Trạng thái v3:** schema 21 collection, index, unique constraint, transaction boundary, retention và layout storage đã chốt. Bảng đối chiếu schema hiện tại đã ghi rõ 7 thay đổi cấu trúc cần xử lý ở Phần 11. Còn 4 câu hỏi mở tại mục 6.2.

**Thay đổi v1 → v2 (2026-11-05):** đồng bộ với **Phần 9 v1** (cơ chế outbox/inbox) và **Phần 4 v2** (ranh giới sở hữu):
1. `outbox_event.status` mở rộng từ 3 → **4** giá trị: thêm `publishing`; thêm trường `lease_expires_at`; thêm index partial `{ status: 'publishing' }`.
2. `notification` thêm `source_event_id` kèm unique partial `(user_id, source_event_id)` — lớp chống trùng thứ hai bên cạnh inbox.
3. Thêm collection `processed_event` (inbox) — 21 → **22 collection** (v3: rút xuống **21** sau khi bỏ `dataset_version`); có TTL 7 ngày, unique `(consumer_name, event_id)`.
4. Thêm 3 quy tắc kiểm thử S16–S18; tổng số quy tắc 15 → 18.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Kiểu khóa chính | **String có tiền tố** `usr_`/`ws_`/`prj_`… + ULID26 (mục 3.2.1) |
| 2 | Thành viên workspace/project | **Collection riêng** (mục 3.5.2, 3.5.4) |
| 3 | Lưu dữ liệu bảng | **Collection riêng**, 1 doc = 1 dòng (mục 3.6.3) |
| 4 | Xoá dữ liệu | **Soft delete** cho thực thể; TTL cho collection log (mục 3.2.4) |
| 5 | Phạm vi trường `version` | **Mọi resource** (mục 3.2.5) |
| 6 | Sở hữu `outbox_event` | Module **`shared`** (mục 3.8.5) |
| 7 | Hình dạng audit log | **Tách 2 collection** `audit_log` + `audit_change` (mục 3.4.3) |
| 8 | Chiến lược index | **Chuẩn**, không text index (mục 3.1 #8) |
| 9 | Cấu trúc `dataset_record` | `props` với key ổn định `c0`, `c1`… (mục 3.6.3) |
| 10 | Cách lọc/sắp xếp Data View | Lọc trong JS, không query `props.c*` (mục 3.6.3) |

### 6.2. Đã chốt ở v6 (2026-11-07)

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | ~~Ngưỡng **200.000 dòng/sheet** lọc trong JS~~ **Đã chốt v6: KHÔNG lọc 200k trong JS — chuyển server-side + cursor** (`POST /records/query`); JS chỉ giữ tối đa 1 trang hiển thị | Đã chốt | Phần 7 v6 §3.13c / Phần 14 |
| 2 | ~~Giới hạn **10 MB / 3 tệp** + định dạng?~~ **Đã chốt v6: 10MB/tệp × 3, MIME `image/png,image/jpeg,application/pdf`** → `issue_report.attachments[]` + validation ISSUE-01 | Đã chốt | Phần 11 |
| 3 | ~~Thời hạn retention mục 3.11~~ **Đã chốt v6: KHÔNG xóa tự động — giới hạn bằng quota workspace** (Phần 6 v6); TTL chỉ cho session/token theo bảo mật | Đã chốt | Phần 10 |
| 4 | ~~Có cần lưu **lịch sử thay đổi ô dữ liệu** (`cell_overrides`) dạng append-only để truy vết?~~ | ~~`project_save.cell_overrides`~~ | **ĐÃ CHỐT 2026-11-05: không lưu** — dữ liệu bất biến, không có thao tác sửa ô nên không có lịch sử để lưu |

**Phụ thuộc cứng:**
- Câu hỏi 2 phải chốt trước khi viết adapter Storage và validation `ISSUE-01` (Phần 11).
- Câu hỏi 3 ảnh hưởng thiết kế job `cleanup` ở Phần 9.
- Phần 11 (migration) **phụ thuộc** bảng đối chiếu mục 3.12 — bảng map id và quy tắc map vai trò.

| Quy ước mới v6 | `issue_report.attachments[]`: `{ fileId, mime in [png,jpeg,pdf], size ≤ 10MB, ≤3 tệp}` — từ chối 413/415 |

### 6.3. Phụ thuộc bên ngoài

- MongoDB 9 với **replica set** — bắt buộc cho transaction.
- `mongoose` 9 — adapter persistence; `domain/` không import.
- `packages/core` — `id-generator.ts` (ULID), hằng số nghiệp vụ, kiểu lỗi domain.
- `packages/contracts` — schema Zod của response, phải khớp 1-1 với trường trả ra API.
- R2 / S3 — file gốc, tệp đính kèm, PDF.
- Redis — cache, rate-limit và adapter Socket.IO (multi-instance).

## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v4 / 2026-11-05:** Gộp collection `dataset_sheet` vào `dataset` (CSV 1 bảng); thêm `finding_feedback` (append-only, lưu nhận xét người dùng) và `feedback_example` (kho mẫu chuẩn hoá cho học lại T1); `ai_job` thêm `model_id`/`prompt_version`/`kafka_offset` và trạng thái `skipped`, timeout 60s → 180s; bỏ `sheet_id` khỏi `dataset_record` và `ai_job`; thêm index cursor theo `(dataset_id, row_index)` / Theo các quyết định 2026-11-05 / Bổ sung mục 3.6.2, 3.7.4, 3.7.5, 3.7.6.
- **v3 / 2026-11-05:** Chuyển sang mô hình **dữ liệu bất biến**. Xoá collection `dataset_version` (22 → 21 collection); xoá `deleted_row_indexes` và `cell_overrides` khỏi `project_save`; bỏ luồng rollback phiên bản; bổ sung mục 3.11c — ràng buộc **insert-only** trên `dataset_record` (không `updateOne`/`deleteMany`/`findOneAndUpdate`, không soft-delete). Đóng câu hỏi mở #4 về `cell_overrides`.
- **v1 / 2026-11-02:** Tạo khung phần 8 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v2 / 2026-11-05:** Đồng bộ với Phần 9 v1. (1) `outbox_event.status` thêm `publishing` + `lease_expires_at` + index partial — giải quyết lỗ hổng mất event khi relay chết giữa lúc đánh dấu và lúc publish; (2) `notification.source_event_id` + unique partial `(user_id, source_event_id)`; (3) thêm collection `processed_event` (inbox) — 21 → 22 collection; (4) thêm quy tắc S16–S18; (5) cập nhật tham chiếu Phần 4 v2 (module `shared` sở hữu 2 collection hạ tầng).
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 10 quyết định schema; thiết kế **21 collection** đầy đủ với trường, index, unique constraint; xác định transaction boundary cho 19 use case; 3 luồng đặc biệt (import 5 bước, ghi hàng loạt, rollback); quy tắc concurrency 7 tình huống; layout storage R2 + retention 21 collection (v3: 21 → giữ nguyên sau khi bỏ `dataset_version`); bảng đối chiếu schema hiện tại (7 thay đổi cấu trúc, 3 collection mới, 3 collection xoá); 15 quy tắc kiểm thử schema S1–S15.
