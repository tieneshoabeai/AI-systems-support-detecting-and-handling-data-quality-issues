# Kế hoạch tinh chỉnh — Quyết định đã chốt (2026-11-15)

> Tài liệu này là **kế hoạch thực thi** sinh ra từ nhật ký bàn luận `00_ban_luan.md`.
> Mọi mục dưới đây đã được người dùng phê duyệt. Giai đoạn tiếp theo là **thực thi code + cập nhật tài liệu**.

---

## 0. Quyết định cấp cao

| # | Quyết định | Lý do |
|---|---|---|
| Q0.1 | **Phân trang: cursor toàn hệ thống** | Khớp `tech.md` v4 (keyset, ổn định, không cần `countDocuments`). Sửa `workspaces`/`projects` từ `page`/`limit` → `cursor`/`limit`. |
| Q0.2 | **Lịch sử/phiên bản project: giữ đã gỡ** | `remember/risk.md` §3 đã phân tích storage bloat + compute bottleneck. Sửa mô tả Excel cho khớp. |
| Q0.3 | **Google Login: LÀM THẬT trong vòng này** | Người dùng sẽ cấp `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` qua `.env`. Không hard-code. |
| Q0.4 | **"Ghi nhớ đăng nhập": cả backend** | Refresh token dài hạn + cờ `rememberMe` trên session. |
| Q0.5 | **Tài liệu: sinh phiên bản mới** | Theo quy ước `docs/restructures/README.md`: file cũ giữ để đối chiếu, thêm `_vN+1`. |
| Q0.6 | **`packages/core` + `packages/contracts`: cập nhật tài liệu cho khớp thực tế** | Không tách monorepo trong vòng này. Giữ cấu trúc `src/backend/src/`. |
| Q0.7 | **Phạm vi**: tài liệu `docs/restructures/` + code backend. | Không gồm tài liệu bàn giao riêng cho frontend (làm ở vòng sau). |
| Q0.8 | **Offline mode + hướng AI**: giữ hoãn. | `remember/reask.md` giữ nguyên. |

---

## 1. Hạng mục triển khai

### Nhóm A — Phân trang cursor (Q0.1)

| Mã | Việc | File liên quan |
|---|---|---|
| A1 | `ListWorkspacesQuerySchema`: bỏ `page`, thêm `cursor` + giữ `limit` | `workspaces/infrastructure/http/dtos/list-workspaces-query.dto.ts` |
| A2 | `ListProjectsQuerySchema`: bỏ `page`, thêm `cursor` + giữ `limit` | `projects/infrastructure/http/dtos/list-projects-query.dto.ts` |
| A3 | `WorkspaceRepositoryPort` + `WorkspacesRepository`: đổi offset → keyset (sort `last_accessed_at` + `id` làm tiebreaker) | `workspaces/domain/ports/workspace.repository.port.ts`, `workspaces/infrastructure/persistence/workspaces.repository.ts` |
| A4 | `ProjectRepositoryPort` + `ProjectsRepository`: tương tự | `projects/domain/ports/project.repository.port.ts`, `projects/infrastructure/persistence/projects.repository.ts` |
| A5 | Response `{ items, meta: { nextCursor, hasMore } }` — dùng `createCursorPaginatedResponse()` sẵn có | `shared/pagination/cursor-paginated.response.ts` |
| A6 | Bỏ `total` khỏi response list workspaces/projects (hiện trả `total`) | `workspaces.controller.ts`, `projects.controller.ts` |
| A7 | Cập nhật `7_api_contracts` (v7) + `13_testing_acceptance_plan` (v8) + `2_feature_catalog` (v10) | `docs/restructures/` |

**Lưu ý kỹ thuật:** `sort` hiện có 5 giá trị (`last_accessed`, `updated`, `name_asc`, `name_desc`, `joined`).
Keyset cursor phải mã hoá **giá trị sort + id tiebreaker**. Với `name_asc/name_desc` cần so sánh chuỗi;
`last_accessed` có thể `null` → cần chuẩn hoá thành giá trị sort được.

---

### Nhóm B — Google Login OAuth (Q0.3)

| Mã | Việc |
|---|---|
| B1 | Thêm env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` vào `env.validation.ts` (optional, validate khi có) + `.env.example` |
| B2 | `AuthUserLookupPort`: thêm `findByGoogleId(googleId)` và `createWithGoogle(...)` (tạo user từ Google profile, `email_verified` bắt buộc `true`) |
| B3 | `user.schema.ts`: thêm `google_id?: string` (unique sparse index) + `auth_provider: 'local' \| 'google'` |
| B4 | `auth.controller.ts`: `GET /auth/google` → redirect tới Google; `GET /auth/google/callback` → đổi code → lấy profile → tạo/tìm user → phát access+refresh token |
| B5 | `auth.service.ts`: hàm `loginWithGoogle(code)` — tái dùng `createSession` + `signToken`; **chặn liên kết tự động** khi `google_id` đã gắn user khác (theo rủi ro đã ghi trong `2_feature_catalog_v9` §AUTH-03) |
| B6 | Không hard-code secret. Không có credential → endpoint trả `501 DEPENDENCY_UNAVAILABLE` (giữ hành vi hiện tại) |
| B7 | Test: unit test luồng callback (mock Google token endpoint) + E2E `401` khi thiếu credential |

**Ràng buộc:** Google bắt buộc `redirect_uri` HTTPS, trừ `http://localhost`.

---

### Nhóm C — Remember me / session dài hạn (Q0.4)

| Mã | Việc |
|---|---|
| C1 | `user-session.schema.ts`: thêm `remember_me: boolean` (default `false`) + `last_used_at: Date` |
| C2 | TTL index `expires_at` hiện cứng `{ expires: '7d' }` → phải đổi sang TTL index theo `expires_at` thật (Mongo TTL index dùng field date, không dùng `expires` option trên field khác). Sửa thành index `{ expiresAt: 1 }, { expireAfterSeconds: 0 }` và bỏ `expires: '7d'`, vì session remember-me có hạn 30 ngày. |
| C3 | `POST /auth/login`: nhận `rememberMe?: boolean` (default `false`) |
| C4 | Hạn refresh token: `JWT_REFRESH_EXPIRATION` mặc định `7d`; khi `rememberMe=true` dùng hạn dài hơn (vd `30d`) — cần cơ chế **per-session** vì JWT `exp` là global theo env. → Thiết kế: `rememberMe` dùng `session.expires_at` làm nguồn sự thật, access token vẫn theo `JWT_ACCESS_EXPIRATION`. |
| C5 | `POST /auth/refresh`: kiểm tra `session.expires_at` (không chỉ JWT `exp`) |
| C6 | `GET /auth/sessions` response: thêm `rememberMe`, `lastUsedAt` |
| C7 | Env: thêm `JWT_REFRESH_REMEMBER_EXPIRATION` (default `30d`) |

---

### Nhóm D — Báo cáo lỗi: trạng thái "Cần bổ sung" + sửa/gửi lại (2.7)

| Mã | Việc |
|---|---|
| D1 | `issue-status.vo.ts`: thêm `needs_info` vào `ISSUE_STATUSES`; cập nhật `ALLOWED_ISSUE_TRANSITIONS`: `new → needs_info`, `needs_info → in_progress`, `in_progress → needs_info` (admin yêu cầu bổ sung → user bổ sung → admin xử lý tiếp) |
| D2 | `issues.schema.ts` + DTO admin status: thêm `needs_info` vào enum |
| D3 | `PATCH /issues/:id` — **người dùng sửa báo cáo của chính mình** khi status = `needs_info`. Chỉ cho phép sửa `title`, `description`, `attachments`; **không** cho sửa `issueType`. Có `expectedVersion` (optimistic locking) |
| D4 | Luồng: admin chuyển `needs_info` → user sửa & gửi lại → status tự quay về `new` hoặc `in_progress` (chốt khi code) |
| D5 | `GET /issues` (của tôi) response có `status: 'needs_info'` → frontend hiển thị nút "Bổ sung thông tin" |
| D6 | Audit log cho mọi chuyển trạng thái + sửa báo cáo |

---

### Nhóm E — Tìm kiếm/lọc thành viên + endpoint tổng quan workspace (2.5, 2.6)

| Mã | Việc |
|---|---|
| E1 | `GET /workspaces/:id/members` → thêm query `search` (tên hoặc email, partial, case-insensitive) + `role` (`owner`\|`member`) |
| E2 | `GET /projects/:id/members` → thêm query `search` (tên hoặc email) |
| E3 | `GET /workspaces/overview` — 5 chỉ số: tổng workspace, tổng project, số workspace sở hữu, số workspace được chia, số project của tôi |
| E4 | `GET /workspaces/:id/overview` — tổng project / chưa xử lý / đang xử lý / đã xử lý |
| E5 | Cần `WorkspaceRepositoryPort` có method đếm + `ProjectRepositoryPort` có method đếm theo `workspace_id` + `status` |
| E6 | Cần populate tên/email thành viên → kiểm tra `users.repository` có hỗ trợ `findByIds` |

> **Xung đột đường dẫn:** `GET /workspaces/overview` phải khai báo **trước** `GET /workspaces/:id` trong controller, nếu không Nest sẽ hiểu `overview` là `id`.

---

### Nhóm F — Tạo project chỉ định Project Owner (2.8)

| Mã | Việc |
|---|---|
| F1 | `CreateProjectSchema`: thêm `ownerId?: string` (ObjectId hex). Nếu bỏ trống → Workspace Owner làm Project Owner (mặc định hiện tại) |
| F2 | Validate `ownerId` phải là **thành viên của workspace** → nếu không `400` |
| F3 | Người gọi phải là Workspace Owner (không đổi quy tắc hiện tại) |
| F4 | `memberIds` **KHÔNG** làm trong vòng này — thêm thành viên qua `POST /projects/:id/members` (đã có) |
| F5 | Import dataset **KHÔNG** gộp vào request tạo project — tách 2 bước (upload là streaming 50MB) |

---

### Nhóm G — Hồ sơ cá nhân: Phone + Giới thiệu (2.9)

| Mã | Việc |
|---|---|
| G1 | `user.schema.ts`: thêm `phone?: string` (validate E.164-ish, unique sparse) + `bio?: string` (max 500) |
| G2 | `UpdateUserSchema`: thêm `phone`, `bio` (optional) |
| G3 | **Không** cho user tự sửa `role` (giữ nguyên — `role` chỉ admin sửa qua `admin-users.controller.ts`) |
| G4 | `GET /users/me` + `GET /admin/users/:id` trả `phone`, `bio` |
| G5 | `GET /admin/users` → thêm filter `search`/`role` nếu chưa có (kiểm tra khi code) |

---

### Nhóm H — 3 API nhỏ (2.10, 2.11, 2.12)

| Mã | Việc |
|---|---|
| H1 | `GET /auth/sessions/:id` — chi tiết 1 phiên đăng nhập (chỉ chính user đó). Chặn IDOR: `findById` + kiểm `user_id` khớp |
| H2 | `CreateWorkspaceSchema`: thêm `memberEmails?: string[]` (email mời) — validate email, thành viên không tồn tại thì tạo `pending` hoặc báo lỗi rõ ràng |
| H3 | `GET /projects/:id` response: thêm `workspaceName` (populate tên workspace) |

---

### Nhóm I — Vệ sinh tài liệu (G1, G2, G3)

| Mã | Việc |
|---|---|
| I1 | `5_ports_adapters_design_v3.md`: bỏ mô tả `packages/core`/`packages/contracts`, thay bằng mô tả cấu trúc thực tế `src/backend/src/{shared,modules}` — ghi rõ lý do (không tách monorepo trong phạm vi hiện tại) |
| I2 | `README.md`: sửa bảng "Báo cáo xuất ra (Word)" — trỏ đúng phiên bản mới, bỏ các file đã xoá |
| I3 | `7_api_contracts_v7.md`: cập nhật bảng endpoint (85 → số thực tế sau khi thêm các endpoint mới ở Nhóm D/E/H) |
| I4 | `2_feature_catalog_v10.md`: thêm các tính năng mới (Google login thật, remember-me, tổng quan workspace, tìm kiếm thành viên, sửa báo cáo) |
| I5 | `13_testing_acceptance_plan_v8.md`: thêm ca test cho các hạng mục mới + cập nhật ma trận phân trang cursor |
| I6 | `8_database_schema_v7.md`: thêm field mới (`user.phone`, `user.bio`, `user.google_id`, `user_session.remember_me`, `user_session.last_used_at`) |
| I7 | `10_runtime_operations_v7.md`: thêm biến env Google + refresh-remember |
| I8 | `6_security_authorization_v7.md`: ghi rõ chính sách liên kết tài khoản Google (chặn liên kết tự động) + quyền sửa báo cáo của chính mình |
| I9 | `00_cong_nghe_ky_thuat_kien_truc_hien_tai.md` (+ `.slides.html`): cập nhật theo các thay đổi trên |

---

## 3. Nhóm J–M — Chất lượng code & Clean Architecture

Chi tiết đầy đủ: **`edit/03_yeu_cau_chat_luong_code_clean_architecture.md`**

| Nhóm | Nội dung | Trạng thái |
|---|---|---|
| **J** | ESLint 9 (flat config) + `typescript-eslint` v8 + prettier. Rule: `no-explicit-any`, `no-unsafe-*`, `consistent-type-imports`, `no-restricted-imports` (theo layer), `no-floating-promises`… | Cài + cấu hình (Bước 0), siết rule (Bước 7) |
| **K** | `noImplicitAny` **đã bật**; siết thêm `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `noUnusedLocals/Parameters` | Bật từng đợt nhỏ (Bước 0) |
| **L** | Clean Architecture: 4/5 nguyên tắc đã đúng. Cần sửa **L2** (2 vi phạm cross-schema), **L3** (8 vi phạm cross-service), **L4** (~19 vi phạm public contract), **L1** (tách `commands/`+`queries/`), **L6** (rule cho `shared/`) | L2+L3 ở Bước 4, L1 ở Bước 5 |
| **M** | Quy tắc dependency 2 lớp: ESLint `no-restricted-imports` + test `test/clean-architecture.spec.ts` với 11 quy tắc **CA1–CA11** (mẫu: `test/zero-any.spec.ts`) | Test ở Bước 0 (mức báo cáo), fail CI ở Bước 7 |

---

## 4. Thứ tự thực thi đề xuất

```
Bước 0  J0+K0+M0  Cài ESLint + prettier, siết cờ TS, viết test kiến trúc ở mức "báo cáo"
                  (chi tiết: edit/03_yeu_cau_chat_luong_code_clean_architecture.md §4)
Bước 1  C+D  Nhóm C (remember-me) + D (issue needs_info)   → schema + DTO + domain
Bước 2  A    Nhóm A (cursor pagination)                     → đụng repository, làm sớm để tránh phải sửa 2 lần
Bước 3  E+F+G+H                                                → search/overview, ownerId, profile, 3 API nhỏ
Bước 4  L2+L3a+L4  Sửa cross-module coupling: cross-schema + cross-service + public contract
Bước 5  L1  Tách commands/ + queries/ trong application/       (đã chốt: làm thật vòng này)
Bước 6  B    Nhóm B (Google OAuth)                           → cần credential thật, làm cuối
Bước 7  J1  Bật ESLint rule nghiêm + --max-warnings 0        (đã chốt: sau khi dọn)
Bước 8  I    Nhóm I (vệ sinh tài liệu)                       → sau khi code xong để số liệu khớp
```

**Ràng buộc:** Bước 2 (cursor) nên sớm vì nó đụng `workspaces.repository.ts` + `projects.repository.ts` —
nếu làm sau Bước 3 sẽ phải sửa lại 2 lần cùng một file.
**Ràng buộc 2:** Nhóm L (Clean Architecture) **không làm song song** với A–I vì L3a đụng chính các
file mà A–I sửa (`workspaces.repository.ts`, `projects.repository.ts`, `issues.*`, `users.*`).
→ **Thiết kế port mới cho L3a phải làm cùng lúc với code A–I** để không sửa 2 lần.

---

## 3. Ước lượng khối lượng

| Nhóm | Số file dự kiến | Rủi ro |
|---|---|---|
| A — Cursor pagination | ~10 file | 🟡 Trung bình — phải xử lý cursor theo 5 kiểu sort |
| B — Google OAuth | ~8 file | 🔴 Cao — cần credential, HTTPS, xử lý liên kết tài khoản |
| C — Remember me | ~7 file | 🟡 Trung bình — TTL index Mongo |
| D — Issue needs_info | ~6 file | 🟢 Thấp |
| E — Search + overview | ~8 file | 🟡 Trung bình — cần method đếm mới |
| F — Project owner | ~4 file | 🟢 Thấp |
| G — Profile fields | ~5 file | 🟢 Thấp |
| H — 3 API nhỏ | ~4 file | 🟢 Thấp |
| I — Tài liệu | ~10 file | 🟢 Thấp |

---

## 4. Điều kiện nghiệm thu chung

- `pnpm test` (unit + arch + e2e) **không regress** — hiện 197 test pass.
- `tsc --noEmit` sạch.
- `zero-any.spec.ts` vẫn pass (không dùng `any`).
- Swagger hiển thị đúng schema mới (`@ApiBody`, `@ApiZodQuery` cho cursor).
- Mọi endpoint mới có test E2E hoặc unit tương ứng.
- `docs/restructures/README.md` trỏ đúng phiên bản mới nhất.
