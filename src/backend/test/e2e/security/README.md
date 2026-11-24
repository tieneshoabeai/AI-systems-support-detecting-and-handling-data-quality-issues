# `test/e2e/security/` — 4 file: bảo mật (chạy bằng `pnpm test:security`)

Chạy: `pnpm test:security` = `jest --config ./test/jest-e2e.json --runInBand test/e2e/security` (xem `package.json`).

| File | `describe` thật trong code | Nó làm gì thật (đọc đầu file) |
|---|---|---|
| `authorization.e2e-spec.ts` | `Tang 7 - 48 tinh huong phan quyen (guard + CASL)` | NGOẠI LỆ: không dùng controller/supertest. Dùng `CaslAbilityFactory` thật + `buildSubject`, build 8 nhóm case (`XWS-8`, `XPRJ-6`, `ROLE-6`, `ADMIN-4`, `NOAUTH-4`, `REVOKE-3`, `DELETED-3`, `IDOR-14` = 48), assert `ability.can()` + `http/code` tương ứng + `expect(cases).toHaveLength(48)`. IDOR-8/IDOR-14 là case cho phép (200 OK) có chú thích rõ trong code. |
| `cookie-parser-regression.e2e-spec.ts` | `E2E — REGRESSION P1: cookieParser giup req.cookies doc duoc` | Dùng `AuthController` thật + 11 handler stub. Tạo 2 app: KHÔNG `cookieParser()` → `req.cookies` undefined (bug P1) vs CÓ → đọc đúng cookie `google_oauth_state`. Lý do ghi trong comment: Express 5 chỉ có `res.cookie()` native. |
| `google-oauth.e2e-spec.ts` | `E2E — AUTH-03 Google OAuth (GET /auth/google)` | Dùng `AuthController` thật + handler mock. `GET /auth/google` thiếu credential → 501, đủ → 302 redirect kèm `state`; `GET /auth/google/callback` với `error=access_denied` → 401. Không cần Mongo/Google thật. |
| `google-oauth-cookie.e2e-spec.ts` | `E2E — AUTH-03 Google OAuth cookie state` | Dùng `AuthController` thật + `cookieParser()` + `ConfigService` stub (`APP_URL=http://localhost:5173`). Vòng đời 4 bước trong comment: `GET /auth/google` → 302 + `Set-Cookie google_oauth_state (HttpOnly, SameSite=Lax, Path=/)`; callback cookie đúng → 200 + xóa cookie; cookie sai → 401 + vẫn xóa; có `error=` → 401 + xóa. |

Quy tắc zero-any giống e2e chung: cấm `any`, guard mock dùng `ExecutionContext`.
