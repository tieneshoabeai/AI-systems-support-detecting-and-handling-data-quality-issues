# Nội dung slide thuyết trình — bản demo (.md)

> Bản nháp nội dung để duyệt **trước khi** làm `thuyet-trinh.slides.html`.
> Mỗi slide có: **Thông điệp** (1 câu chốt) · **Visual (80%)** · **Chữ trên slide (20%)** · **Lời nói** · **Nguồn**.
> Ký hiệu: ✅ đã làm · ⚠️ làm một phần / khác tài liệu · ❌ chưa làm.
> Số liệu lấy từ code nhánh `backend` (BE) và `origin/frontend` (FE), cùng các file kết quả test ngày 2026-11-25. Đường dẫn BE tính từ `src/backend/`, FE tính từ `src/frontend/src/`.

---

## S0 — Bìa

- **AI hỗ trợ phát hiện & xử lý vấn đề chất lượng dữ liệu**
- Nhóm · Giảng viên · Ngày
- Visual: nền vàng, một lưới CSV mờ phía sau, vài ô đổi màu như "lỗi" đang được quét.

---

## S1 — Bối cảnh

**Thông điệp:** Người phân tích đưa **1 dataset** vào, hệ thống **tìm lỗi chất lượng**, **AI giải thích & gợi ý**, người dùng **phản hồi** và nhận **báo cáo** để quyết định cách xử lý.

**Visual (80%):**
- Trái: bảng CSV nhỏ 6×5. Có ô **trống** (đỏ), **dòng trùng** (cam), **"abc" trong cột số** (tím), **giá trị 99999** (xanh).
- Giữa: mũi tên lớn ghi "Garbage in → Garbage out" bị gạch, thay bằng "Phát hiện → Giải thích → Quyết định".
- Phải: tờ báo cáo PDF có thanh mức độ Thấp / TB / Cao.

**Chữ trên slide:**
- Mục tiêu: **phát hiện** lỗi → **giải thích** → **hỗ trợ ra quyết định**
- Người dùng chính: **Data Analyst**
- Ràng buộc: dữ liệu **chỉ đọc** · AI **chạy cục bộ** · che **PII**

**Lời nói:** Dữ liệu bẩn làm sai mọi phân tích phía sau. Hệ thống không tự sửa dữ liệu. Nó chỉ ra lỗi nằm ở đâu, nặng tới mức nào, và gợi ý cách xử lý để người phân tích tự quyết.

**Nguồn:** `docs/prompt/slide_outline.md` S3–S5; `be-facts.md` §9.5, §11, NFR-14.

---

## S2 — Yêu cầu chức năng

**Thông điệp:** 21 chức năng, gom thành **6 nhóm**, xoay quanh vòng đời một dataset.

**Visual (80%):** 6 thẻ lớn có icon, xếp vòng tròn quanh chữ "Dataset". Bấm vào thẻ thì lật ra danh sách mã FR.

| Thẻ | Nội dung | Mã |
|---|---|---|
| 🔐 Tài khoản & phiên | Đăng ký/đăng nhập, Google, refresh xoay vòng, OTP quên mật khẩu, quản lý phiên, hồ sơ | FR-01..06 |
| 👥 Cộng tác | Workspace, Project, thành viên 3 vai trò, chuyển chủ | FR-07..08 |
| 📄 Dữ liệu | Upload 1 CSV/project, suy luận kiểu + PII; lưới dữ liệu lọc 14 toán tử, sắp xếp, biểu đồ | FR-09..10 |
| 🔎 Phân tích | **DQ-01..04**, mức độ; tương quan **Pearson/Spearman/Cramér's V/Eta²**, **VIF** | FR-11..12 |
| 🤖 AI + học từ phản hồi | Nhận xét AI có **grounding**, feedback, kho **few-shot RAG** | FR-13..15 |
| 📑 Đầu ra & hỗ trợ | Tổng kết + **PDF**, báo sự cố, thông báo, realtime, overview, admin | FR-16..21 |

**Chữ trên slide:** chỉ tên 6 thẻ + mã FR.

**Lời nói:** Nhóm 3 và nhóm 4 là lõi. Các nhóm còn lại phục vụ cho việc dùng chung, bảo mật và đầu ra.

**Nguồn:** `be-facts.md` §16.1.

---

## S3 — Yêu cầu phi chức năng

**Thông điệp:** Mỗi yêu cầu phi chức năng đều có **con số đo được**.

**Visual (80%):** 5 ô KPI, mỗi ô có một số thật lớn và một dòng nhỏ bên dưới.

| Nhóm | Số lớn | Dòng nhỏ |
|---|---|---|
| ⚡ Hiệu năng | **< 8 s** | p95 phân tích, đo thực tế **1,60 s / 50 000 dòng** ✅ |
| 📏 Giới hạn | **50 MB · 50 000 dòng** | 1 phân tích/instance, vượt thì **429 + Retry-After** |
| 🔐 Bảo mật | **15 phút** | JWT access; refresh lưu **SHA-256**; **bcrypt 12**; **200 req/phút** |
| 🤖 AI an toàn | **±0,01** | grounding: AI lệch hệ số thì bị loại; ≤20 mẫu/cột đã che PII; timeout 180 s; RAM guard |
| 🧱 Tin cậy & mã | **0 `any`** | outbox trong transaction, audit 365 ngày, lint ranh giới tầng |

**Lời nói:** Sau khi tối ưu, NFR-07 (tải 50 người dùng đồng thời) đã đạt: data-view p95 0,38 s < ngưỡng 2 s. Còn NFR-08 (stress 80 VU) chưa đạt — 3,30 s > 2 s; phần kết quả test sẽ nói rõ nguyên nhân.

**Nguồn:** `be-facts.md` §16.2 (NFR-01..22); **k6 đo lại 2026-11-26** (`docs/test-reports/test-pyramid-report-2026-11-26.md` §2, §2c, §8): NFR-07 đạt sau tối ưu (data-view p95 0,38 s < 2 s); NFR-08 chưa đạt (3,30 s / 2 s, checks 96,0 %).

---

## S4 — Nghiệp vụ cốt lõi (Analyst)

**Thông điệp:** Một vòng **6 bước**, từ file CSV tới báo cáo.

**Visual (80%):** timeline ngang 6 chặng. Mỗi chặng có icon, tên bước và endpoint ở dưới. Chặng 4 vẽ nét đứt (chạy nền).

| # | Bước | Endpoint | Ghi chú |
|---|---|---|---|
| 1 | Upload CSV | `POST /projects/:projectId/datasets/upload` | stream, ≤50 MB, suy luận kiểu + PII |
| 2 | Xem dữ liệu | `POST /datasets/:datasetId/records/query` | keyset, lọc, sắp xếp |
| 3 | Chạy phân tích | `POST /projects/:projectId/analysis` | **đồng bộ**: DQ + tương quan + VIF |
| 4 | AI nhận xét | `GET /analysis/jobs/:jobId` | **bất đồng bộ**: worker + Ollama |
| 5 | Phản hồi | `POST /analyses/:analysisId/findings/:findingId/feedback` | đúng / sai / bỏ sót → few-shot |
| 6 | Tổng kết + PDF | `POST /summary` → `POST /report` (202) | worker sinh PDF tiếng Việt |

Thẻ nhỏ 5 mã DQ:
- **DQ-01** Thiếu dữ liệu ✅
- **DQ-02** Trùng dòng ✅
- **DQ-03** Sai kiểu/định dạng ✅
- **DQ-04** Ngoại lai (IQR / Modified Z) ✅
- **DQ-05** Mâu thuẫn giữa các cột ⚠️ *chưa đánh giá*

**Lời nói:** Bước 5 khép vòng lặp. Feedback của người dùng thành ví dụ mẫu cho lần chạy AI sau.

**Nguồn:** `be-facts.md` §10.1, §13.4–13.7.

---

## S5 — Flow hệ thống (MVP)

**Thông điệp:** Client chỉ nói chuyện với **một backend NestJS**. Backend giữ dữ liệu ở **MongoDB**, file ở **R2/S3**, và giao việc AI cho **worker**.

**Visual (80%):** sơ đồ khối từ trái sang phải.
```
[Client/Browser] → [FE React + Vite] ──HTTPS /api/v1──► [NestJS API (main.ts)]
                         ▲  Socket.IO (realtime) ┄┄┄┄┄┄┄┄┘   │        │         │
                                                             ▼        ▼         ▼
                                                        [MongoDB] [R2 / S3] [Redis]
                                                        dữ liệu,   CSV gốc,  chỉ cho
                                                        job, kết   PDF, tệp  Socket.IO
                                                        quả        đính kèm  adapter
                                                             ▲
                         [Worker (worker.ts, WORKER_MODE)] ──poll job──┘ ──► [Ollama / vLLM cục bộ]
```
- Nét đứt màu xám: **Kafka ⚠️ tuỳ chọn, chưa bật** (mặc định dùng event bus in-process).

**Chữ trên slide:**
- **1 backend**, 2 cách chạy: API · Worker
- File lớn ở **R2 (S3-compatible)**, khi không cấu hình thì ghi ra ổ local
- AI **không ra Internet**: Ollama/vLLM chạy cục bộ

**Lời nói:** Đây là MVP nên chỉ có một backend. API và worker dùng chung code, chỉ khác biến `WORKER_MODE`, nên sau này tách ra chạy riêng khá dễ.

**Nguồn:** `be-facts.md` §2.3, §6.2, §6.3, §7.4, §11.1.

---

## S6 — Kiến trúc

**Thông điệp:** **Modular Monolith** ở vòng ngoài. Bên trong, module nào phức tạp thì dùng **Hexagonal**, module đơn giản thì **phẳng**.

**Visual (80%):**
- Hộp lớn "Modular Monolith — 1 lần deploy". Bên trong là 13 ô module, mỗi ô có một "cửa" `index.ts` (public contract). Mũi tên giữa các module chỉ đi qua cửa đó.
- 7 ô màu đậm là **Hexagonal**: analysis, auth, datasets, issues, projects, users, workspaces.
- 6 ô màu nhạt là **Simple**: audit, data-view, feedback, notifications, overview, realtime.
- Đáy: thanh `shared/` (lỗi, phân trang, guard, outbox, storage).
- Góc phải: 2 cửa vào `main.ts` (HTTP) và `worker.ts` (job nền).

**Chữ trên slide:** Giữ Hexagonal khi module có ít nhất 1 trong 4 điều sau:
1. **invariant** nghiệp vụ
2. **transaction + outbox**
3. **RBAC** 3 tầng
4. **tích hợp ngoài** dễ lỗi (AI, S3, SMTP)

**Lời nói:** Nhóm từng thử tách hết thành vertical slice rồi quay lại (ADR-0001 bị thay). ADR-0002 chọn kiến trúc lai để module đơn giản không phải gánh 4 tầng.

**Nguồn:** `docs/adr/0002-hybrid-modular-monolith.md` dòng 17-34; `be-facts.md` §2.1, §2.5.

---

## S7 — Modules

**Thông điệp:** `src/modules/` có 13 thư mục, mỗi thư mục là một module nghiệp vụ, theo 2 khuôn cấu trúc.

**Visual (80%) — chia 2 nửa:**

**Nửa trái: cây thư mục `src/backend/src/modules/`, trình bày theo từng module.**
Mặc định thu gọn: mỗi dòng là một thư mục module, cạnh đó là nhãn loại (Hex/Simple), chức năng 1 dòng và số route. Bấm 📁 để mở ra các thư mục con thật của module đó.
```
src/backend/src/modules/
├── 📁 analysis/       [Hex]    DQ-01..04, tương quan, VIF, AI job, Tổng kết, PDF ··· 9 route
│   ├── presentation/   controllers · dtos
│   ├── application/    commands · queries · services (AiWorker, RagFewShot) · report-worker
│   ├── domain/         dq · correlation · vif · ai-grounding · pii-mask · stats · suspicion (.util)
│   ├── infrastructure/ ai (Ollama/vLLM adapter, RAM guard) · persistence
│   └── assets/fonts/   DejaVuSans (PDF tiếng Việt)
├── 📁 auth/           [Hex]    đăng ký/đăng nhập, refresh xoay vòng, OTP, Google, phiên ··· 13
│   ├── presentation/   controllers · dtos · google-redirect.util
│   ├── application/    commands · queries · security-alert.service
│   ├── domain/         events · ports · value-objects (auth-policy, password-policy)
│   └── infrastructure/ auth (JwtStrategy) · security (bcrypt, Google OAuth)
├── 📁 datasets/       [Hex]    upload CSV streaming, suy luận kiểu + PII ··· 6
│   ├── presentation/   controllers · responses
│   ├── application/    commands (ingest-stream, cascade) · queries · services · policy-loaders
│   ├── domain/         entities · events · ports · services · value-objects
│   └── infrastructure/ persistence (dataset, dataset-record)
├── 📁 issues/         [Hex]    báo sự cố + tệp đính kèm, admin đổi trạng thái ··· 9
├── 📁 projects/       [Hex]    project, thành viên owner/member/viewer, chuyển chủ ··· 12
├── 📁 users/          [Hex]    hồ sơ, xoá mềm, admin xem user ··· 5
├── 📁 workspaces/     [Hex]    workspace, thành viên, quota dung lượng ··· 10
│      (issues · projects · users · workspaces cùng khuôn presentation/application/domain/infrastructure)
├── 📄 data-view/      [Simple] lưới dữ liệu keyset, lọc/sắp xếp, thống kê cột, biểu đồ ··· 4
│      controller · service · chart.schema · types · utils
├── 📄 feedback/       [Simple] phản hồi phát hiện → kho few-shot RAG ··· 7
│      controller · service · repository · finding-feedback.schema · mapper · types · utils
├── 📄 notifications/  [Simple] thông báo trong app, email, ntfy, tuỳ chọn ··· 5
│      controller · service · repository · schema · mapper · email.mapper
├── 📄 overview/       [Simple] số liệu tổng quan theo user/workspace ··· 2
│      controller · service · types
├── 📄 realtime/       [Simple] Socket.IO gateway, room, thu hồi socket ··· WS
│      gateway · service · auth.service · revocation.subscriber · transport
└── 📄 audit/          [Simple] ghi audit log (best-effort, không có controller) ··· 0
       service · repository · schema · types
```
Mọi module đều có `index.ts` (public contract) + `*.module.ts` + `README.md`, nhưng không hiện trên cây cho gọn.

**Nửa phải: ví dụ điển hình, nút chuyển `[ Hexagonal ⇄ Simple ]`**
- **Hexagonal (`datasets/`)**: 4 vòng đồng tâm. `presentation` → `application` → **`domain`** ← `infrastructure`. Mũi tên phụ thuộc đều hướng vào domain. Một request đi qua controller → `IngestDatasetStreamHandler` → port `DatasetRepositoryPort` → adapter Mongoose.
- **Simple (`feedback/`)**: một hàng file phẳng `controller → service → repository → schema`.
- Dòng luật dưới cùng: **CA1** domain không import infra · **CA2** application không import infra · **MM2** cấm import sâu sang module khác. ESLint báo **error**.

**Chữ trên slide:** **7 Hexagonal** · **6 Simple** · giao tiếp giữa các module chỉ qua **`index.ts`**.

**Lời nói:** Bên trái là cấu trúc thư mục thật. Nhìn vào là thấy module nào làm gì và được tổ chức ra sao. Bên phải so sánh 2 khuôn: module nào có nghiệp vụ phức tạp hoặc gọi hệ thống ngoài thì tách 4 tầng, module đơn giản thì để phẳng.

**Nguồn:** `ls src/backend/src/modules/*` (đọc 2 cấp, 2026-11-25); `be-facts.md` §2.1, §2.4, §3.2, §3.3, §4.

---

## S8 — 8 nguyên tắc thiết kế API

**Thông điệp:** Mổ xẻ **một API thật** qua 8 nguyên tắc.

**Visual (80%):** ở giữa là thẻ request/response của API mẫu. 8 nhãn bao quanh, mỗi nhãn có đường chỉ vào đúng phần nó nói tới. Bấm nhãn thì phần đó sáng lên.
```
POST /api/v1/projects/{projectId}/analysis
Authorization: Bearer <jwt>
{ "correlation_method": "pearson", "outlier_method": "iqr", "top_n": 10 }

→ 201 { "success": true, "data": { analysisRunId, dqSummary, correlationMatrix, vif,
                                     aiCorrelationAssessment: {status:"pending"},
                                     pollUrl: "/api/v1/analysis/jobs/{jobId}" } }
```

| # | Nguyên tắc | Chỉ vào | Trạng thái |
|---|---|---|---|
| 1 | Domain-model driven | `projects/{id}/analysis` (tài nguyên lồng nhau) | ✅ |
| 2 | HTTP method phù hợp | `POST` = tạo một lần phân tích | ✅ |
| 3 | Idempotency | `input_fingerprint` nhận ra lần chạy trùng input | ⚠️ chưa có `Idempotency-Key` |
| 4 | Status code đúng | 201 · 413 quá 50 000 dòng · 429 đang bận · 404 chưa có dataset | ✅ |
| 5 | Versioning | `/api/v1` | ✅ |
| 6 | Semantic path | `analysis/jobs/:id` và `analyses/:id/feedback` chưa thống nhất số ít/nhiều | ⚠️ |
| 7 | Batch | chưa có endpoint `/bulk` | ❌ |
| 8 | Query / pagination | keyset cursor, lọc/sắp xếp ở `records/query` | ✅ |

Ô phụ: việc chạy lâu (AI, PDF) trả **202 + `pollUrl`**.

**Nguồn:** ByteByteGo "8 tips for efficient API design" và RFC 9110 (link trong `slide_outline.md` S8); `be-facts.md` §4, §5.4, §13.5.

---

## S9 — Danh sách API theo module

**Thông điệp:** **84 route HTTP** + 1 WebSocket gateway, tất cả dưới `/api/v1`.

**Visual (80%):** hàng nút `[Tất cả 84] [auth 13] [users 5] [workspaces 10] [projects 12] [datasets 6] [data-view 4] [analysis 9] [feedback 7] [issues 9] [notifications 5] [overview 2] [app 2]`. Bấm nút nào thì hiện bảng của module đó. Method có màu riêng: GET xanh lá, POST xanh dương, PATCH/PUT cam, DELETE đỏ. Cột cuối là Guard và Sync/202.

Dữ liệu (rút gọn, prefix `/api/v1`):
- **app**: GET `/health`, GET `/health/ready` (Public)
- **auth**: POST register · login · refresh · forgot-password · reset-password · change-password · logout; GET google · google/callback; GET sessions · sessions/me · sessions/:id; DELETE sessions/:id
- **users**: GET/PATCH/DELETE `/users/me`; GET `/admin/users`, `/admin/users/:id` (admin)
- **workspaces**: POST/GET `/workspaces`; GET/PATCH/DELETE `/:id`; GET/POST `/:id/members`; DELETE `/:id/members/:userId`; POST `/:id/transfer-owner`, `/:id/leave`
- **projects**: POST/GET `/workspaces/:workspaceId/projects`; GET `/projects`; GET/PATCH/DELETE `/projects/:id`; PUT `/:id/snapshot`; GET/POST `/:id/members`; PATCH/DELETE `/:id/members/:userId`; POST `/:id/transfer-owner`
- **datasets**: POST `/projects/:projectId/datasets/upload`; GET `/projects/:projectId/datasets`; GET/DELETE `/datasets/:id`; GET `/datasets/:id/file`, `/datasets/:id/schema`
- **data-view**: GET `/datasets/:datasetId/records`; POST `/records/query`; GET `/columns/:columnKey/stats`; GET `/charts`
- **analysis**: POST `/projects/:projectId/analysis`; GET `/analysis/result`; GET `/analysis/jobs/:jobId`; POST `/jobs/:jobId/retry` (202); POST `/jobs/:jobId/result`; POST `/projects/:projectId/report` (202); GET `/report/:reportId/file` (200/202); POST/GET `/projects/:projectId/summary`
- **feedback**: POST/GET `/analyses/:analysisId/findings/:findingId/feedback`; POST/GET `/analyses/:analysisId/feedback`; PATCH/DELETE `/feedback/:id`; GET `/projects/:projectId/ai-quality-metrics`
- **issues**: POST/GET `/issues`; POST `/:id/attachments`; GET `/:id/attachments/:attachmentId`; GET/PATCH `/issues/:id`; GET `/admin/issues`, `/admin/issues/:id`; PATCH `/admin/issues/:id/status`
- **notifications**: GET `/notifications`, `/unread-count`, `/:id`; PATCH `/:id/read`; PATCH `/users/me/notification-preferences`
- **overview**: GET `/overview/workspaces`, `/workspaces/:id/overview`
- **WebSocket**: path `/api/v1/realtime`, các room `user:` · `project:` · `analysis:`

**Nguồn:** `be-facts.md` §4 (bảng đầy đủ có file:dòng và guard; slide HTML sẽ chép nguyên bảng này).

---

## S10 — Schema (ERD)

**Thông điệp:** **20 collection MongoDB** chia 5 cụm. Dữ liệu sở hữu chung thì **embed**, dữ liệu lớn hoặc sống độc lập thì **ref**.

**Visual (80%):** ERD đầy đủ thuộc tính. Mỗi bảng là một hộp có thanh tiêu đề màu theo cụm, bên trong liệt kê thuộc tính:
- cột trái là **kiểu**, cột giữa là **tên**, cột phải là nhãn **PK / FK / UK / IDX / TTL**;
- mảng embed (`members[]`, `columns[]`, `findings[]`) vẽ thành hộp con thụt vào bên trong hộp cha;
- hover lên một quan hệ thì sáng đường nối và hiện ký hiệu 1–N.

5 cụm màu: 🟦 Định danh · 🟩 Cộng tác · 🟨 Dữ liệu · 🟧 Phân tích & AI · ⬜ Hạ tầng.
Mọi bảng đều có `_id` (PK), `created_at`, `updated_at`. Các bảng xoá mềm có thêm `deleted_at`.

```mermaid
erDiagram
  %% ───── Định danh ─────
  USER {
    ObjectId _id PK
    string email UK "lowercase, unique partial khi deleted_at=null"
    string password_hash "select:false, bcrypt"
    string google_id UK "sparse"
    enum auth_provider "local | google"
    string first_name
    string last_name
    enum role "admin | analyst"
    enum status "active | blocked"
    bool notifications_enabled
    date deleted_at "xoá mềm"
  }
  USER_SESSION {
    ObjectId _id PK
    ObjectId user_id FK
    string refresh_token_hash "SHA-256, select:false"
    string device_name
    string ip_address
    bool is_revoked
    bool remember_me
    date expires_at "TTL"
  }

  %% ───── Cộng tác ─────
  WORKSPACE {
    ObjectId _id PK
    string name "<=100"
    ObjectId owner_id FK
    array members "embed: user_id, role owner|member, joined_at"
    number storage_used_bytes "quota 500 MB"
    number version "optimistic lock"
    date deleted_at
  }
  PROJECT {
    ObjectId _id PK
    ObjectId workspace_id FK
    string name "<=100"
    bool has_dataset
    enum status "not_started | in_progress | completed"
    array members "embed: user_id, role owner|member|viewer"
    ObjectId created_by FK
    number version
    date deleted_at
  }

  %% ───── Dữ liệu ─────
  DATASET {
    ObjectId _id PK
    ObjectId project_id FK
    ObjectId workspace_id FK
    string original_file_name
    string file_checksum IDX
    string storage_key "raw_files/{id}.csv tren R2"
    number row_count
    number column_count
    array columns "embed: key c0.., name, data_type, missing_count, is_pii"
    array column_issues "embed: empty_name | duplicate_name | whitespace_only"
    array findings "embed: type, severity, column_key, message"
    enum status "INGESTING | READY | FAILED"
    date deleted_at
  }
  DATASET_RECORD {
    ObjectId _id PK
    ObjectId dataset_id FK "UK cung row_index"
    number row_index "UK cung dataset_id"
    mixed props "c0, c1, ... gia tri tung o"
  }

  %% ───── Phân tích & AI ─────
  ANALYSIS_RUN {
    ObjectId _id PK
    ObjectId project_id FK
    ObjectId dataset_id FK
    enum status "pending | running | succeeded | failed"
    string input_fingerprint IDX
    mixed config "correlation_method, outlier_method, top_n"
    ObjectId started_by FK
    number duration_ms
  }
  ANALYSIS_RESULT {
    ObjectId _id PK
    ObjectId analysis_run_id FK
    string input_fingerprint IDX
    bool is_stale
    mixed dq_summary "DQ-01..04"
    mixed dq05 "unassessed"
    mixed correlationMatrix
    mixed vif
    mixed aiCorrelationAssessment "status + notablePairs"
    mixed descriptive
  }
  AI_JOB {
    ObjectId _id PK
    ObjectId analysis_run_id FK
    enum status "pending | running | succeeded | failed | skipped"
    number attempt
    string model_id "qwen3:8b ..."
    string prompt_version "corr-v1"
    date heartbeat_at
    date lease_expires_at IDX
  }
  CELL_EVIDENCE {
    ObjectId _id PK
    ObjectId analysis_run_id FK
    string column
    number row_index
    enum kind "missing | duplicate | invalid_type | outlier"
    string value_masked "da che PII"
  }
  FINDING_FEEDBACK {
    ObjectId _id PK
    ObjectId analysis_run_id FK
    string finding_id "DQ-0x:cot"
    enum label "correct | partially_correct | false_positive | missed_issue | other"
    string reason "<=2000"
    enum suggested_severity "low..critical"
    ObjectId author_id FK
    date created_at "TTL 365 ngay"
  }
  FEW_SHOT_EXAMPLE {
    ObjectId _id PK
    ObjectId workspace_id FK
    string error_type "DQ-01..05"
    enum label "correct | false_positive | missed_issue"
    array embedding "vector chuan hoa L2"
    number trust_score "0..1, mac dinh 0.6"
    number agreement_count
  }
  PROJECT_SAVE {
    ObjectId _id PK
    ObjectId project_id FK
    ObjectId analysis_result_id FK
    bool is_stale
    mixed summary "ban Tong ket"
  }
  REPORT_JOB {
    ObjectId _id PK
    ObjectId project_save_id FK
    enum status "pending | running | succeeded | failed"
    string storage_key "reports/{projectId}/{id}.pdf"
    number file_size_bytes
  }

  %% ───── Hạ tầng ─────
  ISSUE_REPORT {
    ObjectId _id PK
    ObjectId user_id FK
    enum issue_type "function_error | display_error | data_error | ..."
    string title "<=200"
    enum status "new | needs_info | in_progress | resolved | closed"
    array attachments "embed: filename, storage_key, size <=10MB"
    number version
  }
  NOTIFICATION {
    ObjectId _id PK
    ObjectId user_id FK
    enum type "10 loai"
    string title
    string source_event_id UK "partial cung user_id, idempotent"
    date read_at
    date expires_at "TTL"
  }
  AUDIT_LOG {
    ObjectId _id PK
    ObjectId actor_id FK
    string action
    string target_type
    string target_id
    string ip_address
    mixed metadata
    date expires_at "TTL 365 ngay"
  }
  AUDIT_CHANGE {
    ObjectId _id PK
    ObjectId audit_log_id FK
    string field
    mixed before_value
    mixed after_value
  }
  OUTBOX_EVENT {
    ObjectId _id PK
    string event_type IDX "DATASET_INGESTED, PROJECT_DELETED, ..."
    string aggregate_id
    mixed payload
    enum status "PENDING | PUBLISHING | PUBLISHED | PROCESSED | FAILED"
    number retry_count "toi da 5"
    date lease_expires_at
  }
  PROCESSED_EVENT {
    ObjectId _id PK
    string consumer_name UK "cung event_id"
    string event_id UK
    enum status "processing | completed | failed"
    date lease_expires_at
  }

  USER ||--o{ USER_SESSION : "dang nhap"
  USER ||--o{ WORKSPACE : "so huu"
  WORKSPACE ||--o{ PROJECT : "chua"
  PROJECT ||--o| DATASET : "1 CSV / project"
  DATASET ||--o{ DATASET_RECORD : "moi dong 1 doc"
  PROJECT ||--o{ ANALYSIS_RUN : "chay"
  DATASET ||--o{ ANALYSIS_RUN : "tren"
  ANALYSIS_RUN ||--o| ANALYSIS_RESULT : "ket qua"
  ANALYSIS_RUN ||--o{ AI_JOB : "job AI"
  ANALYSIS_RUN ||--o{ CELL_EVIDENCE : "bang chung o"
  ANALYSIS_RUN ||--o{ FINDING_FEEDBACK : "phan hoi"
  FINDING_FEEDBACK }o..o{ FEW_SHOT_EXAMPLE : "promote (khong ref)"
  WORKSPACE ||--o{ FEW_SHOT_EXAMPLE : "kho rieng"
  ANALYSIS_RESULT ||--o{ PROJECT_SAVE : "tong ket"
  PROJECT_SAVE ||--o{ REPORT_JOB : "xuat PDF"
  USER ||--o{ ISSUE_REPORT : "bao loi"
  USER ||--o{ NOTIFICATION : "nhan"
  USER ||--o{ AUDIT_LOG : "thao tac"
  AUDIT_LOG ||--o{ AUDIT_CHANGE : "chi tiet"
  OUTBOX_EVENT }o..o{ PROCESSED_EVENT : "event_id (inbox)"
```
(Trên slide HTML: mỗi hộp hiện tối đa 6–8 thuộc tính chính, hover để xem đủ. Bản Mermaid trên là bản đầy đủ để đối chiếu.)

**Nhận xét thiết kế (5 thẻ nhỏ bên phải ERD):**
1. **Embed** `members[]` trong Workspace/Project vì luôn đọc cùng nhau và số lượng nhỏ. **Ref** cho Dataset → Record vì có thể tới hàng trăm nghìn dòng.
2. Mỗi dòng CSV là một document, khoá **unique `{dataset_id, row_index}`**, nên phân trang keyset được. Key cột dùng `c0, c1…` cố định nên đổi tên cột không phá dữ liệu.
3. **TTL index** tự dọn dữ liệu hết hạn: phiên, audit (365 ngày), feedback (365 ngày), thông báo.
4. **Unique partial** `email` với điều kiện `deleted_at: null`: xoá mềm xong vẫn đăng ký lại được email đó. `source_event_id` unique giúp thông báo không bị tạo trùng.
5. **`input_fingerprint` + `is_stale`**: biết kết quả nào đã cũ khi dữ liệu hoặc cấu hình thay đổi.

⚠️ Comment trong code ghi record "INSERT-ONLY", nhưng khi xoá dataset thì record bị **xoá cứng**. Tên collection do Mongoose tự sinh (chữ thường, số nhiều), chưa đối chiếu với DB thật.

**Nguồn:** `be-facts.md` §6.1 (file schema + dòng index từng model), §10.5, §17 mục 15.

---

## S11 — Kỹ thuật (1 slide, 8 tab)

**Thông điệp:** Mỗi kỹ thuật giải quyết **một vấn đề cụ thể** của dự án.

**Visual (80%):** thanh 8 tab ngang. Mỗi tab mở ra 3 ô **Vai trò · Làm gì · Ở đâu** và một hình minh hoạ nhỏ.

| Tab | Vai trò trong dự án | Làm gì | Ở đâu |
|---|---|---|---|
| **JWT** | xác thực mỗi request | access token 15 phút `{sub,email,role,sessionId}`; mỗi request tra user, chặn nếu bị khoá | `auth.module.ts:40-50`, `jwt.strategy.ts:30-49` |
| **SHA-256** | không lưu bí mật dạng thô | refresh token = 40 byte ngẫu nhiên, DB **chỉ lưu hash**; OTP cũng chỉ lưu hash | `login.handler.ts:54-55`, `forgot-password.handler.ts:87` |
| **Refresh rotation** | chống token bị đánh cắp | mỗi lần refresh cấp token mới; token cũ bị dùng lại thì **thu hồi mọi phiên** + gửi email cảnh báo | `refresh-access-token.handler.ts:70-116` |
| **bcrypt** | băm mật khẩu | 12 vòng salt | `bcrypt-hasher.adapter.ts:11-17` |
| **CASL (RBAC/ABAC)** | phân quyền theo vai trò trong workspace/project | `@CheckPolicies(can(Execute,'Analysis'))` + `PoliciesGuard` | `shared/interfaces/casl/` |
| **ESLint ranh giới** | giữ kiến trúc không bị phá dần | luật CA1/CA2/MM2 + cấm `any`; test kiến trúc chạy trong CI | `eslint.config.mjs:69,100-219`, `test/unit/arch/` |
| **Event bus + Outbox/Inbox** | gửi sự kiện không mất, không trùng | ghi event **trong cùng transaction** → relay 30 s, thử tối đa 5 lần → inbox chặn xử lý trùng. In-process mặc định, ⚠️ Kafka tuỳ chọn | `outbox.service.ts`, `inbox.service.ts`, `hybrid-event.publisher.ts` |
| **Realtime Socket.IO** | đẩy trạng thái tới client | xác thực JWT khi connect; room `user/project/analysis`; event `analysis.completed`, `ai.job.status`; ngắt socket khi user bị xoá | `realtime.gateway.ts:45-186` |

⚠️ Nói thật: FE hiện chưa dùng socket mà **poll 2 s**. Access token vẫn còn hiệu lực tới khi hết hạn dù đã logout.

**Nguồn:** `be-facts.md` §7, §8; `fe-facts.md` §5.

---

## S12 — Framework

**Thông điệp:** **NestJS 11** (chạy trên Express) cho sẵn các "điểm cắm". Dự án gắn đúng thứ cần vào từng điểm.

**Visual (80%):** hình ống request đi qua các điểm cắm của Nest. Mỗi điểm cắm có nhãn ghi rõ dự án dùng nó để làm gì.

| Thành phần Nest | Dự án dùng để |
|---|---|
| **Module + DI** | 13 module; inject port → adapter (vd `AiInferencePort` → `LocalInferenceAdapter`) |
| **Middleware** | helmet (HSTS), CORS whitelist, cookie-parser, `RequestIdMiddleware` |
| **Guard** | `ThrottlerGuard` (200 req/phút), `JwtAuthGuard`, `PoliciesGuard`, `RolesGuard` |
| **Pipe** | `ZodValidationPipe`: validate body/query bằng **Zod** |
| **Interceptor** | `TransformInterceptor` bọc `{success,data}`; `LoggingInterceptor` |
| **Exception Filter** | `AllExceptionsFilter`: mọi lỗi ra một khuôn JSON |
| **Gateway** | Socket.IO realtime |
| **Swagger** | tài liệu `/api/v1/docs` sinh từ Zod |

Thư viện đi kèm: **Mongoose 9** · **Zod** · **@aws-sdk (S3/R2)** · **simple-statistics, ml-matrix** · **PDFKit** · **Jest / k6**.

**Nguồn:** `be-facts.md` §1, §2.3; `main.ts:67-112`; `app.module.ts:29-76`.

---

## S13 — Exception

**Thông điệp:** Code ném lỗi gì thì client cũng nhận **một khuôn JSON duy nhất** có `code` ổn định.

**Visual (80%):** 4 nguồn lỗi rót vào một phễu.
```
DomainError (16 mã) ─┐
HttpException ───────┤
ZodError ────────────┼──►  AllExceptionsFilter  ──►  { success:false, error:{ code, message, details, timestamp, path } }
Mongo E11000 ────────┘         (+ log, + Retry-After)
```

**Ví dụ thật** (bấm nút "Gửi lần 2" để diễn): đang có một lượt phân tích chạy, gửi thêm lượt nữa.
```http
POST /api/v1/projects/6650…/analysis   ← slot đã đầy (ANALYSIS_MAX_CONCURRENCY = 1)

HTTP/1.1 429 Too Many Requests
Retry-After: 5
{ "success": false,
  "error": { "code": "LIMIT_EXCEEDED",
             "message": "…",
             "details": { "retryAfterSeconds": 5 },
             "timestamp": "…", "path": "/api/v1/projects/6650…/analysis" } }
```
(Phần `message` và id hiển thị theo đúng output khi chạy thật lúc dựng HTML.)

**Bảng mã ⇄ HTTP (nhỏ):** `VALIDATION_ERROR` 400 · `UNAUTHENTICATED`/`TOKEN_EXPIRED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT`/`DUPLICATE_RESOURCE` 409 · `ANALYSIS_TOO_LARGE` 413 · `LIMIT_EXCEEDED` 429 · `DEPENDENCY_UNAVAILABLE` 503 · khác → 500 `INTERNAL_ERROR`.

**Nguồn:** `be-facts.md` §5.2, §5.3, §10.6; `analysis-limit.util.ts:119-171`; `all-exceptions.filter.ts:122-138`.

---

## S14 — Luồng 1 tính năng: "Chạy phân tích" (dạng video)

**Thông điệp:** Theo chân **một cú click** từ nút bấm tới MongoDB rồi quay về màn hình.

**Visual (80%):**
- Thanh điều khiển: `▶ Play` `⏸` `◀` `▶` cùng thanh tiến độ "Bước x/15". Play tự chuyển bước mỗi ~3 s.
- **Trái:** sơ đồ đường đi chia 3 làn: **FE**, **HTTP**, **BE**. Bước nào đang chạy thì node đó sáng, một chấm tròn "request" chạy dọc mũi tên. Chiều đi màu xanh, chiều về màu cam.
- **Phải:** khung code của bước đang sáng (code thật rút gọn hoặc pseudo-code), có tên file:dòng phía trên.
- **Dưới:** một câu giải thích ngắn cho bước đó.

| # | Làn | Node | Khung code (rút gọn) | File |
|---|---|---|---|---|
| 1 | Client | Bấm **"Chạy phân tích"** (đã chọn pearson / iqr / top_n=10) | — (mock nút bấm) | Project Workspace |
| 2 | FE · Component | `LiveAnalysisPanel` → `runAnalysis()` | `const result = await service!.run(project.id, { correlation_method, outlier_method, top_n, chart_top_n })` | `views/processing/project/sections/live-analysis-panel.tsx:123-140` |
| 3 | FE · Hook | `useManagementStore()` cấp `analysisService`; `useState` giữ kết quả | `const store = useManagementStore(); const service = store.analysisService` | `hooks/preview/use-preview-store.ts:12`; panel `:34-35` |
| 4 | FE · Service/API | `createAnalysisService().run()` | `request(projectPath(id,'analysis'), { method:'POST', data })` | `services/processing/analysis.service.ts` (`run`) |
| 5 | FE · HTTP client | `ApiClient.request()` gắn **Bearer**, gọi axios | `headers['Authorization'] = \`Bearer ${token}\`` | `lib/axios-client.ts:102-113` |
| 6 | HTTP | `POST /api/v1/projects/:projectId/analysis` | (gói request bay qua) | — |
| 7 | BE · Middleware | Express: helmet → cookie-parser → CORS → `RequestIdMiddleware` | `app.use(helmet(…)); app.use(cookieParser()); app.enableCors(…)` | `main.ts:67-100`; `app.module.ts:75` |
| 8 | BE · Guard | `ThrottlerGuard` → `JwtAuthGuard` → `PoliciesGuard` | `@CheckPolicies(a => a.can(Action.Execute,'Analysis'))` | `app.module.ts:64`; `analysis.controller.ts:34, 53-54` |
| 9 | BE · Interceptor (vào) | `TransformInterceptor`, `LoggingInterceptor` bắt đầu bọc | `app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor())` | `main.ts:112` |
| 10 | BE · Pipe | `ZodValidationPipe(RunAnalysisSchema)` | `@Body(new ZodValidationPipe(RunAnalysisSchema)) dto` | `analysis.controller.ts:59` |
| 11 | BE · Controller | `runAnalysis()` gọi handler | `return this.runAnalysisHandler.execute(projectId, dto, user.userId)` | `analysis.controller.ts:45-62` |
| 12 | BE · Handler (service) | semaphore (đầy → 429) → kiểm ≤50 000 dòng (413) → đọc record → DQ-01..04, tương quan, VIF | `concurrencyGuard.run(() => executeAnalysis(…))`; `assertAnalysisRowLimit(…)`; `records.listAllRecords(id)` | `run-analysis.handler.ts:131-136, 183, 208` |
| 13 | BE · Repository → DB | tạo Run → lưu Result → tạo AiJob `pending` → đánh dấu kết quả cũ stale | `analysisRepository.create / saveResult / createJob / markResultsStale` | `run-analysis.handler.ts:316, 679, 776, 787` |
| 14 | BE · chiều về | Repository → Handler → Controller → `TransformInterceptor` bọc `{success:true,data}` → **201** | `{ success:true, data:{ analysisRunId, dqSummary, correlationMatrix, vif, pollUrl } }` | `transform.interceptor.ts:37-40` |
| 15 | FE · chiều về | `unwrapEnvelope` kiểm khung → service trả data → `setLatestResult` → vẽ bảng DQ + ma trận; sau đó **poll** `GET /analysis/jobs/:jobId` mỗi 2 s (≤30 lần) tới khi AI `succeeded` | `if (value.success !== true) throw …; return value.data` → `setLatestResult(record); setJobId(jobFromResult(record))` | `axios-client.ts:51-66`; panel `:72-115, 123-140` |

Nhánh phụ (bật bằng nút "Xem phần AI chạy nền"): Worker poll DB → claim job (`findOneAndUpdate`) → dựng prompt (đã che PII + few-shot) → Ollama → **grounding ±0,01** → cập nhật result.

**Lời nói:** Phần thống kê có kết quả ngay trong request (khoảng 1,6 s với 50 000 dòng). Phần AI chạy sau nên không bắt người dùng chờ.

**Nguồn:** code đã đối chiếu trên `backend` và `origin/frontend`; `be-facts.md` §13.5; `fe-facts.md` §4–5.

---

## S15 — Kết quả test Backend (dashboard)

**Thông điệp:** Test chạy ở **5 tầng**, từ hàm thuần tới cả hệ thống đóng gói Docker. Logic và phân quyền đều đạt. Ở tầng hiệu năng, k6 đã chỉ ra điểm nghẽn, và sau khi sửa thì **đo lại bằng A/B**: p95 giảm **37×**, threshold chuyển từ FAIL sang PASS.

**Visual (80%):**
- Trái: **kim tự tháp test** 5 tầng. Bấm tầng nào thì phần bên phải hiện chi tiết tầng đó.
```
              ▲  k6 hiệu năng           4 / 5 script đạt (sau tối ưu)
             ▲▲  E2E toàn hệ thống      39 / 39   (Docker: API + Mongo + Redis)
            ▲▲▲  E2E HTTP pipeline      94 / 94   (12 suite)
           ▲▲▲▲  Integration            138 / 138 (Mongo rs + Redis + S3 thật)
          ▲▲▲▲▲  Unit + Kiến trúc       1 091 / 1 092 (1 skip có chủ đích)
```
- Phải: hàng KPI tile.

| Tầng | Kết quả | Kiểm cái gì | Ghi chú |
|---|---|---|---|
| **Unit + Arch** | **1 091 / 1 092** đạt, 69 suite, 30 s | hàm DQ, tương quan, VIF, grounding, handler (port mock), luật kiến trúc | coverage **60 %** stmts · **44,6 %** branch |
| **Integration** | **138 / 138**, 7 suite, 11,9 s | repository trên Mongo replica set thật, keyset, cascade xoá, rollback transaction, upload/download S3 | MinIO không tải được nên dùng SeaweedFS (tương thích S3) |
| **E2E HTTP pipeline** | **94 / 94**, 12 suite, 10,3 s | controller thật, routing, guard, Zod, khuôn `{success,data}`, mã lỗi; gồm 4 suite bảo mật (phân quyền CASL, cookie Google OAuth) | handler mock nên không chạm DB |
| **E2E toàn hệ thống** | **39 / 39**, ~49 s | app đóng gói Docker: hành trình 12 bước (register → login → workspace → project → upload → upload lần 2 409 → analysis → summary → report 202 → PDF 200 …) + ma trận phân quyền 26 ca theo OWASP API (BOLA 8, Broken Auth 3, BFLA 3, vai trò 11, quy tắc 1) | có 1 ca `it.failing` ghi nhận hạn chế "access token còn dùng được sau logout"; chưa có ca realtime và rate-limit |
| **k6** | **4 / 5** script đạt (đo lại 26/11) | smoke, analysis-latency, full-journey, load, stress | xem biểu đồ |

- Dưới: biểu đồ cột ngang, p95 k6 so với vạch ngưỡng.

| Script | p95 đo | Ngưỡng | |
|---|---|---|---|
| smoke · records | 44,5 ms | 1 000 ms | ✅ |
| analysis 50k dòng | 1,60 s | 8 s | ✅ |
| full-journey · dataview | 42 ms | 1,5 s | ✅ (checks 100 %) |
| load 50 VU · dataview | 383 ms | 2 s | ✅ (checks 100 %) |
| stress · read_records | 3,30 s | 2 s | ❌ (checks 96,0 %) |

- **A/B đo được trước → sau tối ưu** (cùng dataset 50 000 dòng, cùng 50 VU, cùng 5 phút — chỉ khác bật/tắt cache):

  | Chỉ số | Trước | Sau | Cải thiện |
  |---|---|---|---|
  | `http_req_duration` p95 | 13,09 s | **350 ms** | **37×** |
  | `dataview` p95 | 20,68 s | **383 ms** | **54×** |
  | Throughput | 13,88 req/s | **127,73 req/s** | **9,2×** |
  | Tổng request / 5 phút | 4 207 | **38 320** | 9,1× |
  | Threshold k6 | ❌ FAIL (4 scenario) | ✅ PASS | — |

  Cách sửa: `RecordQueryPort.getColumnValuesBatch()` đọc **nhiều cột trong một lần quét** MongoDB (thay vì N lần quét cho N cột), cộng `DataViewService.chartCache` — **LRU in-memory + TTL 60 s** khoá theo `datasetId|fileChecksum|columns|topN|maxRows` (dataset bất biến sau ingest nên số liệu biểu đồ không đổi). Đo riêng 1 endpoint: **862 ms** (cold) → **19,9 ms** (warm) = **43×**. Có thêm biến môi trường `CHART_CACHE_TTL_MS` (đặt `0` để tắt cache) và `THROTTLE_DEFAULT_LIMIT` / `THROTTLE_DEFAULT_TTL_MS` để đo tải mà không bị rate-limiter làm sai lệch p95; **mặc định giữ nguyên giá trị production**.

- ⚠️ **Lưu ý về số liệu cũ:** lần chạy 25/11 báo p95 `load` chỉ 32 ms và `2xx 15,8 %` — đó là **số ảo**, vì access token TTL 15 phút đã hết hạn nên API trả 401 tức thì. Đo lại với token còn hạn cho `checks` 100 %, không lỗi 5xx; p95 thật **trước tối ưu** là 13,09 s. Vì vậy trên slide phải dùng **`checks` + `p95` theo từng scenario**, không dùng `http_req_failed` (429 do throttle 200 req/60 s và 401/403/404 là negative test có chủ đích).

**Lời nói:** Đây là ví dụ test có ích thật nhất của dự án. k6 chỉ ra điểm nghẽn ở đúng chỗ cần sửa — `GET /charts` quét lại 50 000 dòng cho từng cột. Bốn tầng chức năng đều 100 %. Ở tầng hiệu năng, phải đo lại sau khi cấp token hợp lệ thì mới biết năng lực thật, rồi sửa và **đo lại bằng A/B**: p95 rơi từ 13,09 s xuống 350 ms, throughput tăng 9,2 lần, threshold từ FAIL sang PASS. Còn stress 80 VU thì vẫn chưa đạt, và tôi nói thẳng điều đó.

**Nguồn:** `ket-qua-unit-coverage-2026-11-25.md`; `ket-qua-integration-2026-11-25.md`; E2E pipeline: chạy `pnpm test:e2e` ngày 2026-11-25 (12 suite, 94 test); E2E toàn hệ thống: `ke-hoach-kiem-thu.md` dòng 184-186 (`test/e2e-live/`); **k6 đo lại 2026-11-26**: `docs/test-reports/test-pyramid-report-2026-11-26.md` §2, §2c, §8 + `src/backend/test-results/k6/load-20261126-065140-cached.txt`, `load-20261126-065859-baseline.txt`, `stress-20261126-070452.txt`, `full-journey-20261126-070714.txt`.

---

## S16 — Kết quả test AI

**Thông điệp:** AI được chấm theo **9 chỉ số có trọng số** trên bộ mẫu vàng.

**Visual (80%):** bảng 9 hàng. Mỗi hàng có thanh trọng số (tổng 100) và cột kết quả. Bên cạnh là khung biểu đồ Pareto (latency × F1), hiện để trống.

| Trọng số | Chỉ số | Ngưỡng | Kết quả |
|---|---|---|---|
| 30 | F1 phát hiện (micro) | ≥ 0,75 | *chưa đo* |
| 10 | F1 macro DQ-01→05 | ≥ 0,70 | *chưa đo* |
| 12 | JSON hợp lệ | ≥ 98 % | *chưa đo* |
| 10 | Tỉ lệ ảo giác (grounding) | ≤ 2 % | *chưa đo* |
| 13 | Chất lượng giải thích tiếng Việt (LLM-judge) | ≥ 4/5 | *chưa đo* |
| 10 | p95 latency / job | ≤ 180 s | *chưa đo* |
| 5 | Throughput | ≥ 4 tok/s | *chưa đo* |
| 5 | RAM đỉnh | ≤ 11 GB | *chưa đo* |
| 5 | Tỉ lệ lỗi/retry | ≤ 2 % | *chưa đo* |

**Chữ trên slide:** phương pháp gồm **gold set** · **LLM-judge** · **McNemar** so sánh model · **Pareto** chọn model.

> ⏳ Chờ bạn chạy lại `pnpm bench:models` rồi gửi số. Lần chạy 2026-11-25 (qwen3:8b, 3 mẫu) lỗi 100 % nên không dùng.

**Nguồn:** `docs/test-reports/benchmark-summary-2026-11-25.md` (bảng ngưỡng); `src/backend/scripts/benchmark/`.

---

## S17 — Ưu & nhược điểm

**Thông điệp:** Phần lõi chắc chắn. Những điểm yếu đều **đã biết và chỉ ra được trong code**.

**Visual (80%):** 2 cột. Trái là ✅ Ưu (nền xanh nhạt), phải là ⚠️ Nhược (nền cam nhạt). Mỗi ý 1 dòng, keyword in đậm.

| ✅ Ưu điểm | ⚠️ Nhược điểm |
|---|---|
| Kiến trúc **tách lớp có lint + test kiểm tra tự động** | Stress **80 VU chưa đạt** ngưỡng: `read_records` p95 **3,30 s** > 2 s; cache biểu đồ **nằm trong RAM từng instance**, chưa có Redis |
| AI **cục bộ** + **grounding** chống bịa số | Access token **vẫn dùng được sau logout** (tới 15 phút) |
| Phiên an toàn: **rotation + phát hiện reuse** | OTP sinh bằng **`Math.random()`** thay vì crypto |
| Upload **streaming**, phân tích **50k dòng ≈ 1,6 s** | `NotificationsService.dispatch` **chưa có nơi gọi** |
| **Outbox/Inbox**: sự kiện không mất, không trùng | Domain event của entity **chưa được phát**; Kafka/Redis mới dùng một phần |
| Test **5 tầng**, E2E chạy trên app đóng gói Docker | **DQ-05 chưa làm**; branch coverage **44,6 %** |
| Tối ưu **data-view có đo A/B**: batch query + LRU cache | Upload **10 MB** trong stress bị **timeout** của k6 khi tải cao |

**Lời nói:** Mỗi nhược điểm đã có hướng sửa cụ thể. Ví dụ: charts đã gộp truy vấn và thêm cache — **đo lại bằng A/B thì p95 giảm từ 13,09 s xuống 350 ms**, còn lại là kiểm `sessionId` trong JwtStrategy, đổi sang `crypto.randomInt`. Tôi cũng nói thẳng phần chưa đạt: stress 80 VU vẫn 3,30 s, và cache hiện nằm trong RAM từng instance nên khi scale nhiều instance sẽ cần Redis.

**Nguồn:** `be-facts.md` §17 (mục 6, 7, 17, 18, 19); `ket-qua-k6-2026-11-25.md` §5; `docs/test-reports/test-pyramid-report-2026-11-26.md` §2c.

---

## Ghi chú cho bước làm HTML (sau khi chốt nội dung)

- 1 file `docs/prompt/thuyet-trinh.slides.html`, JS thuần, sơ đồ SVG inline, chuyển slide bằng phím ←/→.
- Nền **vàng Claude**. Chữ ≤ 20 % diện tích. Keyword **in đậm**.
- Tương tác theo slide: S2 lật thẻ · S7 lưới + nút đổi Hexagonal/Simple · S8 bấm nhãn để làm sáng · S9 nút lọc module · S11 tab · S13 nút "Gửi lần 2" · S14 stepper Play/Pause · S15 biểu đồ cột.
