# `test/e2e/` — 12 file: HTTP pipeline thật (7/8 controller thật + handler mock, 1 fake, 1 ability)

Công thức chung (7 file gốc trừ health + 3 file security trừ authorization): controller thật + `AllExceptionsFilter` + `TransformInterceptor` + `RequestIdMiddleware` + guard mock (`ExecutionContext`) + handler `{ execute: jest.fn() }`. Không cần Mongo/Google thật. 2 ngoại lệ ghi rõ dưới đây.

## Chạy (chép từ `package.json`)

```bash
pnpm test:e2e       # jest --config ./test/jest-e2e.json --runInBand (12 file)
pnpm test:security  # chỉ 4 file test/e2e/security
pnpm test:e2e:full  # tự bật/hạ hạ tầng rồi chạy e2e
```

Vì sao `pnpm test` không chạy nhầm e2e? `testRegex` mặc định trong `package.json` là `.*\.spec\.ts$` (cần dấu chấm trước `spec`), còn e2e tên `*.e2e-spec.ts` (gạch nối trước `spec`) → không khớp. E2E chỉ chạy qua `test/jest-e2e.json` (`testRegex: .e2e-spec.ts$`).

## Luật bắt buộc (do `unit/arch/zero-any.spec.ts` quét `src/`, `scripts/`, `test/`)

Cấm `any` (regex `(:|as|<|,)\s*any`). Guard mock phải viết `canActivate: (ctx: ExecutionContext) => ...` (import từ `@nestjs/common`). Viết `ctx: any` là vỡ ngay. Trong e2e hiện tại: 7 file dùng `ExecutionContext`, file `health` + 4 file `security` có file không cần guard mock (xem bảng).

## 8 file gốc

| File | `describe` thật | Phủ endpoint / đặc điểm thật |
|---|---|---|
| `health.e2e-spec.ts` | `E2E hop dong API (Tang 5) - envelope + X-Request-Id + phan trang cursor` | NGOẠI LỆ: dùng `FakeWorkspacesController` định nghĩa trong file (2 route `GET :id` + `GET /`), không phải controller thật. Kiểm envelope + `X-Request-Id` + cursor (`nextCursor/hasMore/limit`). |
| `auth-flow.e2e-spec.ts` | `E2E — Auth full flow (register/login/session)` | `AuthController` thật + 10 handler mock (`login/register/refresh/forgot/reset/change/logout/revoke/getById/getList`). Comment đầu file: 13 endpoint, phủ `register/login (remember_me + alias rememberMe)/refresh/forgot/reset/change/logout/sessions` (`/me` trước `/:id`). |
| `users-me.e2e-spec.ts` | `E2E — Users/me` | `GET/PATCH/DELETE /users/me`, không lộ `passwordHash`/`googleId`. |
| `workspace-project.e2e-spec.ts` | `E2E — Workspace + Project (WS-01..10, PROJ-01..12)` | WS CRUD/members/transfer/leave/204 + project CRUD/members/snapshot/204. |
| `dataset-dataview.e2e-spec.ts` | `E2E — Datasets + DataView` | F4 upload CSV (busboy)/get-by-project/get-by-id (ẩn `storageKey`)/schema `c0..cN`/delete 204 + F5 records keyset/query/column-stats/charts. |
| `analysis-report-summary.e2e-spec.ts` | `E2E — Analysis + Summary + Report` | Analysis run 201/result/retry 202/ingest + summary create/get + report 202 + download 202. |
| `issues-admin.e2e-spec.ts` | `E2E — Issues + Admin` | Issues user + admin (403 nếu analyst) + optimistic-locking (`expectedVersion`). |
| `feedback-notifications-overview.e2e-spec.ts` | `E2E — Feedback + Notifications + Overview` | FB-01..06 (`false_positive` cần `reason`) + NOTIF-01..03 + E3/E4 overview. |

## Thư mục `security/` — 4 file riêng

Đọc [security/README.md](security/README.md). Tóm tắt: `authorization` là test ability thuần (không HTTP, 48 case), 3 file còn lại dùng `AuthController` thật (regression cookie-parser, OAuth 302/501/401, OAuth cookie state 4 bước).
