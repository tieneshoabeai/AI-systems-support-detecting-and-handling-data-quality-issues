# `test/unit/auth/` — 2 file: khởi tạo admin + OAuth

| File | Các `describe` thật trong code |
|---|---|
| `auth-admin-bootstrap.spec.ts` | `OPEN-01 — AdminBootstrapService` ; `OPEN-01 — RegisterSchema không nhận \`role\`` |
| `step6-google-oauth.spec.ts` | `Buoc 6 / Nhom B — Google OAuth 2.0 (AUTH-03)` |

Giữ: admin tạo 1 lần idempotent từ `ADMIN_EMAIL/PASSWORD`, schema register không nhận role; OAuth PKCE + state + verify `id_token`, thiếu 1 trong 3 biến `GOOGLE_*` → 501.

Liên quan e2e: `test/e2e/auth-flow.e2e-spec.ts` + `test/e2e/security/google-oauth*.e2e-spec.ts`.

Chạy: `npx jest test/unit/auth --no-coverage`.
