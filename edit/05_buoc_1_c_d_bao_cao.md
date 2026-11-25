# Bước 1 — Nhóm C + D (Báo cáo thực thi)

> Ngày thực thi: 2026-11-15
> Phạm vi: **Nhóm C** (Remember me / phiên đăng nhập dài hạn) + **Nhóm D** (Báo cáo lỗi — trạng thái "Cần bổ sung" & sửa/gửi lại).
> Kết quả: **0 lỗi TypeScript**, **0 lỗi ESLint**, **191/191 unit test pass**, **52/52 E2E test pass**, **13/13 arch test pass** (0 vi phạm mới).

---

## 0. Tóm tắt

| Nhóm | Hạng mục | Trạng thái |
|---|---|---|
| **C** | C1–C7 — Remember me / session dài hạn | ✅ Hoàn tất |
| **D** | D1–D6 — Issue `needs_info` + sửa/gửi lại | ✅ Hoàn tất |
| **H1** | `GET /auth/sessions/:id` (chặn IDOR) | ✅ Làm luôn trong Nhóm C (cùng file) |

**Kết quả kiểm thử:**

| Hạng mục | Trước | Sau |
|---|---|---|
| Unit test | 160 | **191** (+31 test mới) |
| E2E test | 52 | **52** (không regress) |
| Arch test | 13 | **13** (0 vi phạm mới) |
| ESLint | 0 error / 150 warn | **0 error / 153 warn** (+3 từ file mới, đều là `explicit-function-return-type` cảnh báo) |
| `tsc --noEmit` | sạch | **sạch** |

---

## 1. Nhóm C — Remember me / phiên đăng nhạp dài hạn

### 1.1 Vấn đề phát hiện được

Qua đối chiếu code thực tế với đặc tả, phát hiện **2 lỗi tiền ẩn** ngoài phạm vi "thêm cờ remember me":

| # | Vấn đề | Mức độ |
|---|---|---|
| **V1** | TTL index MongoDB sai: `expires_at: { index: { expires: '7d' } }` — TTL của Mongo là `expireAfterSeconds` (cộng thêm vào giá trị ngày). Với giá trị `expires_at` đã là mốc hết hạn tuyệt đối, mọi phiên bị xoá **sớm hơn 7 ngày**, kể cả phiên 30 ngày. | 🔴 Nghiêm trọng |
| **V2** | Refresh token là **chuỗi ngẫu nhiên** lưu dạng hash trong `user_sessions` — **không phải JWT**. Nghĩa là biến `JWT_REFRESH_EXPIRATION` trong `.env` thực ra **không có tác dụng**; hạn thực tế đến từ hằng số `REFRESH_TOKEN_TTL_MS` hard-code trong domain VO. | 🟡 Trung bình |

→ Vì vậy thiết kế được chốt lại: **nguồn sự thật của hạn phiên là `user_sessions.expires_at`**, không phải `exp` của JWT. `JWT_REFRESH_EXPIRATION` / `JWT_REFRESH_REMEMBER_EXPIRATION` chỉ cấu hình **TTL tạo phiên**.

### 1.2 Thay đổi dữ liệu (MongoDB)

**`user-session.schema.ts`**

```typescript
export interface IUserSession extends Document {
  // ...
  /** Cờ "ghi nhớ đăng nhập" — phiên sống lâu hơn (mặc định 30 ngày thay vì 7 ngày). */
  remember_me: boolean;
  /** Lần cuối phiên được dùng (refresh token). */
  last_used_at?: Date | null;
  expires_at: Date;
}
```

Sửa TTL index (V1):

```typescript
// TRƯỚC (sai — TTL 7 ngày tính TỪ expires_at ⇒ phiên 30 ngày bị xoá sớm)
expires_at: { type: Date, required: true, index: { expires: '7d' } },

// SAU (đúng — xoá đúng lúc expires_at tới hạn)
expires_at: { type: Date, required: true },
// ...
UserSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
```

> **Lưu ý vận hành:** index TTL cũ (`expires_at_1` với `expireAfterSeconds: 604800`) đã tồn tại trong DB Atlas.
> Mongoose `autoIndex` sẽ tạo index mới nhưng **không tự xoá index cũ**. Cần chạy 1 lần:
> `db.user_sessions.dropIndex("expires_at_1")` rồi `db.user_sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })`.

### 1.3 Luồng nghiệp vụ

```
POST /auth/login  { email, password, remember_me? }
   │
   ├─ remember_me = false (mặc định) → TTL = JWT_REFRESH_EXPIRATION   (7d)
   └─ remember_me = true              → TTL = JWT_REFRESH_REMEMBER_EXPIRATION (30d)
                                          │
                                          ▼
                              user_sessions.expires_at  ← nguồn sự thật
                                          │
POST /auth/refresh { refresh_token }
   │
   ├─ Tìm session theo hash → kiểm tra expires_at > now  (nếu hết hạn → 401 TOKEN_EXPIRED)
   ├─ Rotation: revoke session cũ, tạo session mới GIỮ NGUYÊN cờ remember_me + hạn theo cờ
   ├─ Cập nhật last_used_at
   └─ Trả access_token mới (hạn 15m, không đổi theo remember-me)
```

### 1.4 Kiến trúc — port mới cho policy (tránh vi phạm CA2/CA11)

Tầng `application` **không được** đọc `process.env` / `ConfigService` trực tiếp (nguyên tắc Dependency Rule).
→ Tạo port `AUTH_SESSION_POLICY_PORT` ở tầng `domain`, adapter đọc env ở tầng `infrastructure`:

```typescript
// domain/ports/auth-session.port.ts
export const AUTH_SESSION_POLICY_PORT = Symbol('AuthSessionPolicyPort');

export interface AuthSessionPolicyPort {
  /** Hạn phiên (mili giây) cho từng trường hợp: thường (7 ngày) hoặc "ghi nhớ đăng nhập" (30 ngày). */
  refreshTtlMs(rememberMe: boolean): number;
}
```

```typescript
// infrastructure/security/env-auth-session-policy.adapter.ts
@Injectable()
export class EnvAuthSessionPolicyAdapter implements AuthSessionPolicyPort {
  private readonly normalMs: number;
  private readonly rememberMs: number;

  constructor(config: ConfigService) {
    this.normalMs = parseDurationMs(config.get<string>('JWT_REFRESH_EXPIRATION'), REFRESH_TOKEN_TTL_MS);
    this.rememberMs = parseDurationMs(config.get<string>('JWT_REFRESH_REMEMBER_EXPIRATION'), REMEMBER_ME_REFRESH_TOKEN_TTL_MS);
  }

  refreshTtlMs(rememberMe: boolean): number {
    return rememberMe ? this.rememberMs : this.normalMs;
  }
}
```

Utility thuần mới `src/shared/utils/duration.util.ts` — `parseDurationMs('30d') → 2_592_000_000`.
Được đặt trong `shared/utils/` nên tầng `domain` được phép import (theo CA11: `utils` là thư mục "pure" được phép dùng).

### 1.5 API thay đổi

| Endpoint | Thay đổi |
|---|---|
| `POST /auth/login` | Nhận `remember_me` (hoặc `rememberMe`) — boolean, mặc định `false`.<br>Response thêm: `remember_me: boolean`, `expires_at: string` (ISO-8601). |
| `POST /auth/refresh` | Response thêm: `remember_me: boolean`, `expires_at: string`.<br>Kiểm tra `session.expires_at` → hết hạn trả `401 { error: 'TOKEN_EXPIRED' }`. |
| `GET /auth/sessions` | Response đổi sang shape chuẩn hóa (snake_case), thêm `remember_me`, `last_used_at`, `expires_at`, `created_at`. |
| `GET /auth/sessions/:id` | **Endpoint mới** (H1) — chi tiết 1 phiên. Trả `404` nếu phiên không thuộc user hiện tại (chống IDOR, không lộ sự tồn tại của phiên người khác). |

### 1.6 Biến môi trường

```diff
JWT_REFRESH_EXPIRATION=7d
+# Hạn phiên khi chọn "ghi nhớ đăng nhập" (remember me)
+JWT_REFRESH_REMEMBER_EXPIRATION=30d
```

Đã cập nhật cả `env.validation.ts` (default `30d`) và `.env.example`.

---

## 2. Nhóm D — Trạng thái "Cần bổ sung" (`needs_info`) & sửa/gửi lại

### 2.1 Vấn đề phát hiện được

Trước đây, khi admin muốn yêu cầu user bổ sung thông tin, hệ thống dùng **trạng thái `new`** làm tín hiệu (`in_progress → new` ⇒ gửi notification `issue_needs_info`).
Hệ quả: `new` vừa là "chưa xử lý" vừa là "cần bổ sung" — **ngữ nghĩa bị chồng lấn**, người dùng không biết báo cáo của mình đang chờ ai.

→ Tách thành trạng thái riêng `needs_info`.

### 2.2 Domain — `issue-status.vo.ts`

```typescript
export const ISSUE_STATUSES = ['new', 'needs_info', 'in_progress', 'resolved', 'closed'] as const;

/** Trạng thái mà người dùng được phép tự sửa báo cáo. */
export const USER_EDITABLE_ISSUE_STATUSES: IssueStatus[] = ['needs_info'];

export const ALLOWED_ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  new: ['in_progress', 'needs_info'],
  needs_info: ['in_progress'],
  in_progress: ['resolved', 'new', 'needs_info'],
  resolved: ['closed'],
  closed: [],
};
```

Luồng mới:

```
        ┌──────────── admin yêu cầu bổ sung ────────────┐
        │                                               │
   new ─┴─► needs_info ──► (user sửa & gửi lại) ──► in_progress ──► resolved ──► closed
                                                     ▲
                                       admin xử lý tiếp│
```

### 2.3 Luồng nghiệp vụ đầy đủ

```
① Admin:  PATCH /admin/issues/:id/status  { status: 'needs_info', expectedVersion: n }
          → kiểm tra transition hợp lệ (new|needs_info|in_progress → needs_info)
          → cập nhật optimistic locking (version + 1)
          → gửi notification mandatory 'issue_needs_info' cho người báo cáo
          → ghi audit log ISSUE_STATUS_CHANGED (from/to)

② User:   GET /issues  → thấy status = 'needs_info'
          → hiển thị nút "Bổ sung thông tin"

③ User:   PATCH /issues/:id  { title?, description?, removeAttachmentIds?, expectedVersion: n }
          → chỉ được sửa khi status = 'needs_info'  (nếu không → 403)
          → chỉ sửa title / description / gỡ tệp đính kèm
          → KHÔNG cho sửa issueType (bản chất sự cố không đổi)
          → KHÔNG cho sửa status (luồng gửi lại tự quay về 'in_progress')
          → version lệch → 409
          → gỡ tệp đính kèm khỏi storage (best-effort)
          → ghi audit log ISSUE_REPORT_UPDATED
```

### 2.4 Thay đổi repository (optimistic locking)

`IssueReportRepositoryPort` thêm method mới:

```typescript
/**
 * Người dùng tự sửa báo cáo của chính mình (chỉ khi `status = needs_info`).
 * Ghi đè `title`/`description`, gỡ tệp đính kèm theo yêu cầu, tăng `version`
 * và chuyển trạng thái về `in_progress` (luồng "gửi lại sau khi bổ sung").
 */
updateByUser(id: string, input: UpdateIssueByUserInput): Promise<IssueReportRecord | null>;
```

Điều kiện lọc ở tầng infrastructure (Mongoose):

```typescript
findOneAndUpdate(
  {
    _id: new Types.ObjectId(id),
    user_id: new Types.ObjectId(input.userId),  // ← chỉ chính chủ báo cáo
    status: 'needs_info',                        // ← chỉ khi đang chờ bổ sung
    version: input.expectedVersion,              // ← optimistic locking
    deleted_at: null,
  },
  { $set: { status: 'in_progress', title, description }, $inc: { version: 1 }, $pull: { attachments: {...} } },
  { new: true },
)
```

→ **4 điều kiện bảo vệ trong 1 truy vấn**: đúng chủ, đúng trạng thái, đúng version, chưa xoá mềm.

### 2.5 Audit log (D6)

Action mới trong `AuditAction`:

```typescript
| 'ISSUE_STATUS_CHANGED'
| 'ISSUE_REPORT_UPDATED'   // ← mới
```

- `ISSUE_STATUS_CHANGED` — ghi ở controller `updateStatus`, kèm `changes: [{ field: 'status', beforeValue, afterValue }]`.
- `ISSUE_REPORT_UPDATED` — ghi ở controller `updateMine`, kèm metadata (tiêu đề mới, có sửa mô tả không, số tệp đã gỡ).

### 2.6 API thay đổi

| Endpoint | Thay đổi |
|---|---|
| `PATCH /admin/issues/:id/status` | Chấp nhận `status: 'needs_info'`. Gửi notification mandatory. Có audit log. |
| `GET /issues` (`?status=`) | Chấp nhận lọc `status=needs_info`. |
| `GET /admin/issues` (`?status=`) | Chấp nhận lọc `status=needs_info`. |
| `PATCH /issues/:id` | **Endpoint mới** — người dùng tự sửa báo cáo của chính mình (chỉ khi `needs_info`). |

---

## 3. Danh sách file đã thay đổi

### 3.1 File tạo mới (5)

| File | Nội dung |
|---|---|
| `src/shared/utils/duration.util.ts` | Utility thuần `parseDurationMs` (hỗ trợ `ms/s/m/h/d/w`). |
| `src/modules/auth/infrastructure/security/env-auth-session-policy.adapter.ts` | Adapter đọc TTL phiên từ env. |
| `test/step1-remember-me-and-issue-needs-info.spec.ts` | 16 test — utility, policy, DTO, domain VO. |
| `test/step1-services.spec.ts` | 15 test — `AuthService` (remember-me) + `IssuesService` (`needs_info`). |
| `edit/05_buoc_1_c_d_bao_cao.md` | Báo cáo này. |

### 3.2 File sửa (18)

| File | Nội dung |
|---|---|
| `src/modules/users/infrastructure/persistence/user-session.schema.ts` | +`remember_me`, +`last_used_at`, sửa TTL index. |
| `src/modules/users/domain/ports/user.repository.port.ts` | +`rememberMe`, +`lastUsedAt`, +`findSessionById`, +`touchSession`, +`rememberMe` trong `CreateSessionInput`. |
| `src/modules/users/infrastructure/persistence/users.repository.ts` | Mapping + persist field mới, thêm 2 method. |
| `src/modules/users/application/users.service.ts` | Pass-through `remember_me`, thêm 2 method. |
| `src/modules/users/domain/value-objects/session-policy.vo.ts` | +`REMEMBER_ME_SESSION_TTL_MS`, `sessionExpiry(from, rememberMe)`. |
| `src/modules/auth/domain/ports/auth-session.port.ts` | +`rememberMe`, +`lastUsedAt`, +`createdAt`, +`AUTH_SESSION_POLICY_PORT`, +`findSessionById`, +`touchSession`. |
| `src/modules/auth/domain/value-objects/auth-policy.vo.ts` | +`REMEMBER_ME_REFRESH_TOKEN_TTL_MS`, `refreshTokenExpiry(from, rememberMe)`. |
| `src/modules/auth/application/auth.service.ts` | `login` nhận `remember_me`; `refresh` kiểm tra `expires_at` + giữ cờ remember-me; `getSessions` shape mới; `getSessionById` mới. |
| `src/modules/auth/infrastructure/security/users-auth-session.adapter.ts` | Pass-through field mới + 2 method. |
| `src/modules/auth/infrastructure/http/dtos/login.dto.ts` | +`remember_me` / `rememberMe` (transform chuẩn hoá). |
| `src/modules/auth/infrastructure/http/auth.controller.ts` | +`GET /auth/sessions/:id`. |
| `src/modules/auth/auth.module.ts` | Đăng ký `AUTH_SESSION_POLICY_PORT`. |
| `src/shared/config/env.validation.ts` | +`JWT_REFRESH_REMEMBER_EXPIRATION`. |
| `src/backend/.env.example` | +`JWT_REFRESH_REMEMBER_EXPIRATION=30d`. |
| `src/modules/issues/domain/value-objects/issue-status.vo.ts` | +`needs_info`, `USER_EDITABLE_ISSUE_STATUSES`, `isUserEditableIssueStatus`. |
| `src/modules/issues/domain/entities/issue-report.entity.ts` | Dùng chung `ALLOWED_ISSUE_TRANSITIONS` (bỏ bản hard-code trùng lặp). |
| `src/modules/issues/domain/ports/issue-report.repository.port.ts` | +`UpdateIssueByUserInput`, +`updateByUser`. |
| `src/modules/issues/infrastructure/persistence/issue-report.schema.ts` | +`needs_info` vào enum. |
| `src/modules/issues/infrastructure/persistence/issues.repository.ts` | +`updateByUser` (4 điều kiện lọc). |
| `src/modules/issues/application/issues.service.ts` | +`updateMyReport`; `updateStatus` gửi notification cho `needs_info`. |
| `src/modules/issues/infrastructure/http/dtos/create-issue.dto.ts` | +`needs_info` vào enum; +`UpdateMyIssueSchema`. |
| `src/modules/issues/infrastructure/http/issues.controller.ts` | +`PATCH /issues/:id`; audit log cho status change. |
| `src/modules/audit/domain/ports/audit.repository.port.ts` | +`ISSUE_REPORT_UPDATED`. |

---

## 4. Kiểm thử

### 4.1 Test mới (31)

**`test/step1-remember-me-and-issue-needs-info.spec.ts` (16 test)**

| Nhóm | Ca kiểm thử |
|---|---|
| `parseDurationMs` | parse đủ 6 đơn vị; không đơn vị → giây; chuỗi rỗng/sai → fallback; giá trị âm → fallback |
| Policy TTL | 7 ngày vs 30 ngày; `sessionExpiry` trả đúng mốc |
| DTO login | `remember_me` mặc định `false`; nhận cả 2 spelling; email sai → fail |
| Domain `needs_info` | có trạng thái mới; transition hợp lệ/không hợp lệ; chỉ `needs_info` cho phép tự sửa |
| DTO issues | lọc `needs_info`; status lạ → fail; `UpdateMyIssueSchema` yêu cầu ít nhất 1 trường + `expectedVersion` |

**`test/step1-services.spec.ts` (15 test)**

| Nhóm | Ca kiểm thử |
|---|---|
| `AuthService` | login không remember → 7 ngày; login remember → 30 ngày; refresh giữ cờ + hạn; refresh hết hạn → 401; `getSessions` có `remember_me`/`last_used_at`; `getSessionById` của người khác → 404 (IDOR); của chính mình → OK |
| `IssuesService` | admin → `needs_info` gửi notification mandatory; transition `new → needs_info` hợp lệ; user sửa → quay về `in_progress`; sửa ở trạng thái khác → 403; version lệch → 409; không tìm thấy → 404; chỉ gỡ được tệp thuộc báo cáo |

### 4.2 Kết quả toàn bộ

```
Test Suites: 21 passed, 21 total
Tests:       191 passed, 191 total          (trước: 160)
```

```
E2E: Test Suites: 2 passed, 2 total
     Tests:       52 passed, 52 total
```

```
Arch: Test Suites: 1 passed, 1 total
      Tests:       13 passed, 13 total
      [Clean Architecture] 68 vi phạm (0 mới, 0 đã được sửa)
```

```
tsc --noEmit  →  sạch (0 lỗi)
eslint         →  0 error, 153 warning
```

### 4.3 Baseline kiến trúc

Regenerate sau khi sửa → **68 vi phạm, không đổi** (CA3: 9, CA5: 2, CA6: 3, CA7: 16, CA8: 38, CA11: 0).
→ Bước 1 **không tạo thêm nợ kỹ thuật kiến trúc**.

---

## 5. Ảnh hưởng API (cần bàn giao cho frontend)

### 5.1 Auth

| Thay đổi | Chi tiết |
|---|---|
| **Breaking (nhẹ)** | `GET /auth/sessions` đổi shape: trước trả array object thô (`userId`, `deviceName`, `isRevoked`, `expiresAt` — camelCase), nay trả snake_case chuẩn API (`device_name`, `is_revoked`, `remember_me`, `last_used_at`, `expires_at`, `created_at`). Frontend cần đổi key. |
| **Mới** | `GET /auth/sessions/:id` |
| **Mới (request)** | `POST /auth/login` nhận `remember_me` (hoặc `rememberMe`) |
| **Mới (response)** | `POST /auth/login` & `POST /auth/refresh` trả thêm `remember_me`, `expires_at` |

### 5.2 Issues

| Thay đổi | Chi tiết |
|---|---|
| **Mới** | `PATCH /issues/:id` — body `{ title?, description?, removeAttachmentIds?, expectedVersion }` |
| **Mới** | Giá trị `status = 'needs_info'` trong mọi response + query filter |
| **Mới** | `POST /issues` response không đổi |

---

## 6. Việc cần làm thủ công (vận hành)

1. **MongoDB Atlas — sửa TTL index** (bắt buộc, nếu không phiên remember-me vẫn bị xoá sớm):
   ```javascript
   db.user_sessions.dropIndex("expires_at_1");
   db.user_sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
   ```
2. **Deploy — biến môi trường**: thêm `JWT_REFRESH_REMEMBER_EXPIRATION=30d` vào `.env` production.
3. **Chạy migration Mongo** để các phiên cũ có `remember_me: false` / `last_used_at: null` (Mongoose tự set default khi đọc/ghi, nên không bắt buộc — nhưng nên chạy để index/queries nhất quán).

---

## 7. Ghi chú & quyết định thiết kế

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Hạn phiên lưu ở `session.expires_at`, không dùng `exp` JWT | Refresh token **không phải JWT** — là chuỗi ngẫu nhiên hash. JWT `exp` là global theo env, không thể per-session. |
| 2 | Access token **không** đổi hạn khi remember-me | Access token là " vé vào cửa" ngắn hạn (15 phút); refresh mới là vé dài hạn. Giữ nguyên giảm rủi ro lộ token. |
| 3 | Rotation giữ nguyên cờ `remember_me` | Tránh tình huống phiên remember-me bị hạn xuống 7 ngày sau lần refresh đầu. |
| 4 | `refresh` kiểm tra `expires_at` **và** trả `401 TOKEN_EXPIRED` | `findSessionByTokenHash` đã lọc `expires_at > now`, nhưng kiểm tra tường minh ở application để không phụ thuộc vào chi tiết implementation của adapter. |
| 5 | Policy TTL đọc qua **port**, không đọc `process.env` trong application | Nguyên tắc Dependency Rule — application chỉ phụ thuộc domain. |
| 6 | `LoginSchema` dùng `.transform()` để nhận cả `remember_me` & `rememberMe` | Frontend có thể dùng convention khác nhau; chuẩn hoá tại biên. |
| 7 | `needs_info` **thay thế** vai trò của `new` trong luồng "cần bổ sung" (giữ tương thích `new` để không phá client cũ) | `new` vừa "chưa xử lý" vừa "cần bổ sung" → ngữ nghĩa chồng lấn. |
| 8 | `PATCH /issues/:id` **không** cho sửa `status` | Để luồng "gửi lại" tự động quay về `in_progress` — tránh user tự chọn trạng thái hợp lệ giả. |
| 9 | `PATCH /issues/:id` **không** cho sửa `issueType` | Bản chất sự cố không đổi sau khi bổ sung thông tin. |
| 10 | `getSessionById` trả **404** (không phải 403) khi phiên thuộc user khác | Không lộ sự tồn tại của phiên của người khác (chống enumeration). |

---

## 8. Bước tiếp theo

Theo kế hoạch (`edit/02_ke_hoach_thuc_thien.md` §4):

> **Bước 2 — Nhóm A**: Unify Keyset Cursor pagination cho `workspaces` + `projects`
> (đụng `workspaces.repository.ts` + `projects.repository.ts` — làm sớm để tránh sửa 2 lần).
