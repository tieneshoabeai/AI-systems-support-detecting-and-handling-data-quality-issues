# Đối chiếu 3 nguồn: Excel (yêu cầu gốc) ↔ Tài liệu Markdown ↔ Code hiện tại

> Nguồn Excel: `docs/restructures/feature_nescessary.xlsx` — 53 dòng dữ liệu, gồm cột
> "Tên tính năng" + "Mô tả". Chia làm 6 nhóm nghiệp vụ.
>
> Nguồn tài liệu: `docs/restructures/*.md` (phiên bản mới nhất theo README).
>
> Nguồn code: `src/backend` — 80 HTTP endpoint / 12 module.

---

## 1. Phạm vi: Excel mô tả 53 tính năng, tài liệu mô tả 85 tính năng

Excel **chỉ mô tả phần "quản lý tài khoản – workspace – project – thông báo – báo cáo lỗi"**.
Không hề có phần lõi Data Quality (upload CSV, quy tắc DQ, phân tích, AI, báo cáo PDF).

| Nhóm trong Excel | Số tính năng | Tài liệu `2_feature_catalog_v9.md` |
|---|---|---|
| Tài khoản & xác thực | 9 | `AUTH-01`…`AUTH-11` |
| Thông báo | 7 | `NOTIF-*` |
| Báo cáo lỗi (Issue) | 7 | `ISSUE-*` |
| Hồ sơ người dùng & phiên | 8 | `USER-*`, `SESSION-*` |
| Project | 13 | `PROJ-*` |
| Workspace | 11 | `WS-*` |
| **Lõi Data Quality** | **0** | `FILE-*`, `DATA-*`, `VIEW-*`, `DQ-*`, `ANALYSIS-*`, `AI-*`, `SUMMARY-*`, `REPORT-*` (27 tính năng) |

**=> Vấn đề cần chốt:** Excel là bản yêu cầu **giai đoạn đầu** (sản phẩm quản lý),
còn tài liệu đã mở rộng thêm toàn bộ lõi Data Quality theo đề tài.
Hai nguồn **không mâu thuẫn** — chỉ là **khác phạm vi thời gian**.

---

## 2. Bảng đối chiếu chi tiết (nhóm có khả năng sai lệch)

### 2.1 Phân trang: Excel yêu cầu OFFSET, tài liệu chốt CURSOR, code đang trộn cả hai

| API | Excel yêu cầu | Tài liệu | Code hiện tại | Trạng thái |
|---|---|---|---|---|
| Thông báo | "phân trang offset 10 items mỗi trang" | `7_api_contracts_v6` → cursor `{ items, meta:{nextCursor,hasMore} }` | `cursor` + `limit` | ⚠️ Lệch Excel |
| Báo cáo lỗi | "Phân trang offset items 10 báo cáo mỗi trang" | cursor | `cursor` + `limit` | ⚠️ Lệch Excel |
| Danh sách project | "phân trang offset, 15 items project mỗi trang" | cursor | **`page` + `limit`** | ❌ Lệch cả 2 |
| Danh sách workspace | "15 items mỗi trang" (mô tả cắt) | cursor | **`page` + `limit`** | ❌ Lệch cả 2 |

> **Đây là điểm lệch lớn nhất.** Code hiện tại **không nhất quán nội bộ**: notifications/issues dùng
> cursor, workspaces/projects dùng `page`/`limit` (offset). Tài liệu `tech.md` v4 đã chốt cursor
> làm chuẩn toàn hệ thống với lý do "truy vấn ổn định, không cần `countDocuments`".
> Excel (bản gốc) lại yêu cầu offset.
> → **Cần chốt: giữ cursor toàn hệ thống, hay quay về offset theo Excel?**

### 2.2 Google Login — Excel yêu cầu, code trả 501

| Nguồn | Nội dung |
|---|---|
| Excel | Dòng 6–7: "Login bằng Google" — "Dùng gg để xác nhận và đăng nhập luôn mà không cần tạo đăng ký" |
| `2_feature_catalog_v9` | `AUTH-03` — **Đợt 2**, cần `GOOGLE_CLIENT_ID/SECRET` + HTTPS redirect URI |
| Code | `auth.controller.ts` → `googleStart()` / `googleCallback()` **throw 501 `DEPENDENCY_UNAVAILABLE`** |

→ **Cần chốt: có làm AUTH-03 trong vòng này không, hay giữ ở Đợt 2?**

### 2.3 "Ghi nhớ đăng nhập" — Excel yêu cầu, code KHÔNG có

- Excel dòng 8–9: "Ghi nhớ đăng nhập" / "Ghi nhớ thông tin email và password cho lần đăng nhập sau".
- Code: `rg "rememberMe|remember_me" src/` → **0 kết quả**. Không có cơ chế refresh token "dài hạn"
  / cookie persistent.
- `auth.controller.ts` có `POST /refresh` nhưng không có khái niệm session dài hạn.

→ **Cần chốt: đây là yêu cầu chỉ của frontend (lưu email/password ở trình duyệt) hay của backend
(session token sống lâu)?** Nếu chỉ frontend → không cần sửa backend.

### 2.4 Lịch sử hoạt động / phiên bản project — Excel yêu cầu 4 tính năng, tài liệu đã GỠ

Excel yêu cầu (dòng 61–68):
1. "Lịch sử hoạt động của project"
2. "Xem các phiên bản của project"
3. "Xem chi tiết lịch sử 1 hoạt động của project" (ai tạo, nội dung lần lưu, thời gian)
4. "Quay lại phiên bản của project" (khôi phục bản cũ)

| Nguồn | Nội dung |
|---|---|
| `3_business_workflows_v6` | **Đã gỡ** `UC-58`/`UC-59` — "lịch sử phiên bản project" |
| Code | Chỉ có `PUT /projects/:id/snapshot` (lưu 1 bản). **Không có** endpoint list history, **không có** rollback |
| `remember/risk.md` §3 | Đã phân tích đây là nguồn "Storage Bloat & Compute Bottleneck" → chọn Hybrid Checkpointing |

→ **Cần chốt: khôi phục 4 tính năng này, hay giữ trạng thái đã gỡ?**
Đây là quyết định **rất tốn công** (cần bảng `project_version`/`project_activity`, cơ chế rollback).

### 2.5 Thống kê tổng quan — Excel yêu cầu 2 nhóm, code KHÔNG có endpoint

| Excel | Yêu cầu | Code |
|---|---|---|
| Dòng 79–80 | "Xem tổng quan số liệu Workspace" — thanh số liệu ngang: Tổng Workspace, Tổng Project, số workspace sở hữu, số workspace được chia | ❌ Không có |
| Dòng 93–94 | "Tổng quan workspace" — tổng project trong workspace / chưa xử lý / đã xử lý | ❌ Không có |

Code `workspaces.controller.ts` có 10 route, **không route nào trả số liệu tổng quan**.
→ Cần chốt: thêm endpoint `GET /workspaces/overview` + `GET /workspaces/:id/overview`?

### 2.6 Tìm kiếm / lọc thành viên — Excel yêu cầu, code thiếu query param

| Excel | Yêu cầu | Code |
|---|---|---|
| Dòng 89–90 | "Danh sách thành viên trong workspace": tìm kiếm theo tên/email + **lọc theo vai trò** | `GET /workspaces/:id/members` → **không có query param**, trả toàn bộ `members` |
| Dòng 69–70 | "Tìm kiếm thành viên trong project": tìm theo tên/email từ khoá | `GET /projects/:id/members` → **không có query param** |

→ Cần chốt: bổ sung `?search=&role=` cho 2 endpoint này?

### 2.7 Trạng thái báo cáo — Excel có 4 trạng thái + luồng "sửa và gửi lại", code thiếu

Excel dòng 29: *"Có các status như **Cần bổ sung** (các báo cáo có trạng thái này thì **người dùng được phép sửa và gửi báo cáo lại**), đang xử lý, đã xử lý, Đã đóng"*

| Nguồn | Trạng thái |
|---|---|
| Excel | 4 trạng thái, có trạng thái **"Cần bổ sung"** (user được sửa & gửi lại) |
| `issue-status.vo.ts` | `['new','in_progress','resolved','closed']` — **thiếu "cần bổ sung"** |
| `issues.controller.ts` | Chỉ có `PATCH admin/issues/:id/status`. **Thiếu** `PATCH /issues/:id` cho người dùng sửa báo cáo của mình |

→ Cần chốt: thêm trạng thái `needs_info` + endpoint cho user sửa/gửi lại?

### 2.8 Tạo project — Excel cho phép chỉ định Project Owner, code không

- Excel dòng 55–56: "Chỉ Workspace Owner tạo project và **chỉ định ai làm Project Owner** (mặc định Workspace Owner làm Project Owner)".
- Code `CreateProjectSchema`: chỉ có `name`, `description`. Không có `ownerId`/`memberIds`.
- Excel dòng 95 (Tạo project trong Tổng quan workspace): "Nhập: Tên project, Mô tả, **import dataset**, **thêm thành viên có trong workspace**".

→ Cần chốt: mở rộng `POST /workspaces/:workspaceId/projects` để nhận `ownerId` + `memberIds`?
(import dataset nên tách thành 2 bước — upload là streaming 50MB, không hợp nhận chung request JSON.)

### 2.9 Hồ sơ cá nhân — Excel yêu cầu Phone + Giới thiệu, code thiếu

| Excel dòng 36–38 | Code `UpdateUserSchema` |
|---|---|
| Ảnh đại diện | ✅ `avatar_url` |
| Họ và Tên | ✅ `first_name`, `last_name` |
| **Phone** | ❌ không có |
| **Giới thiệu** | ❌ không có |
| **Role** | ⚠️ `role` có trong schema nhưng **không cho user tự sửa** (đúng — `UpdateUserSchema` không có `role`) |

`user.schema.ts` cũng không có field `phone` / `bio` / `introduction`.
→ Cần chốt: có thêm `phone` + `bio` vào schema + DTO không?

### 2.10 Chi tiết phiên đăng nhập — Excel yêu cầu, code thiếu 1 endpoint

- Excel dòng 41–42: "Xem chi tiết phiên đăng nhập" (chi tiết thông tin của 1 phiên).
- Code: `GET /auth/sessions` (list) + `DELETE /auth/sessions/:id` (thu hồi). **Không có** `GET /auth/sessions/:id`.

### 2.11 Thành viên workspace — Excel cho phép mời khi tạo workspace

- Excel dòng 81–82: "Tạo mới Workspace — Nhập: Tên workspace, Mô tả, **Nhập email để mời thành viên**".
- Code `CreateWorkspaceSchema`: chỉ `name`, `description`. `POST /workspaces/:id/members` là endpoint riêng.

### 2.12 Thông tin cơ bản project — Excel yêu cầu "Tên workspace"

- Excel dòng 60: "Tên project, mô tả, **Tên workspace**, Ngày tạo, Cập nhật gần nhất".
- Code `GET /projects/:id` → `projectsService.getProjectById(id, true)`. Cần xác minh response có `workspaceName`.

---

## 3. Những phần Excel **không** yêu cầu nhưng tài liệu/code đã có (giữ nguyên)

| Nhóm | Chi tiết |
|---|---|
| Lõi Data Quality | Upload CSV streaming, quy tắc DQ-01…, AI cục bộ, PDF, Virtual Grid, feedback, audit log, outbox/Kafka, Socket.IO |
| Hạ tầng | Docker Compose (Mongo/Redis/MinIO), k6, E2E, 48 ca phân quyền, backup/restore |
| Phân quyền | CASL 5 vai trò (admin/analyst + owner/member + project role) |

---

## 4. Bảng tổng hợp trạng thái

| # | Hạng mục | Mức độ | Loại |
|---|---|---|---|
| 2.1 | Phân trang offset (Excel) ↔ cursor (tài liệu + code trộn) | 🔴 Cao | Quyết định kiến trúc |
| 2.4 | Lịch sử hoạt động / phiên bản project (đã gỡ trong docs) | 🔴 Cao | Thêm tính năng + schema |
| 2.2 | Google Login (đang 501) | 🟡 TB | Hoàn thiện tính năng |
| 2.5 | Endpoint tổng quan/thống kê workspace | 🟡 TB | Thêm endpoint |
| 2.6 | Tìm kiếm + lọc thành viên (workspace & project) | 🟡 TB | Thêm query param |
| 2.7 | Trạng thái "Cần bổ sung" + sửa/gửi lại báo cáo | 🟡 TB | Thêm trạng thái + endpoint |
| 2.9 | Phone + Giới thiệu trong hồ sơ cá nhân | 🟢 TB | Thêm field + DTO |
| 2.3 | "Ghi nhớ đăng nhập" | 🟢 TB | Cần làm rõ frontend/backend |
| 2.10 | `GET /auth/sessions/:id` | 🟢 Thấp | Thêm endpoint |
| 2.11 | Mời thành viên ngay khi tạo workspace | 🟢 Thấp | Mở rộng DTO |
| 2.12 | `workspaceName` trong chi tiết project | 🟢 Thấp | Xác minh |

---

## 5. Ghi chú thêm (không thuộc Excel)

- `docs/restructures/5_ports_adapters_design_v2.md` mô tả `packages/core` + `packages/contracts` —
  **repo hiện KHÔNG có thư mục `packages/`**. Toàn bộ code nằm trong `src/backend/src/`.
  → Cần chốt: có tách monorepo trong vòng này không, hay cập nhật tài liệu cho khớp thực tế?
- `7_api_contracts_v6.md` liệt kê 85 endpoint; code thực tế có **80** route HTTP
  (audit 0, realtime 0 — realtime là WebSocket, audit là service nội bộ).
- `docs/restructures/README.md` bảng "Báo cáo xuất ra (Word)" còn trỏ tới các file cũ
  (`_cong_nghe_ky_thuat.md`, `7_api_contracts_v4.md`, `6_security_authorization_v5.md`…)
  trong khi các file đó đã bị xóa → cần cập nhật bảng này.
