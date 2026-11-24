# `test/unit/users/` — 2 file: entity

| File | Các `describe` thật trong code |
|---|---|
| `user-entity.spec.ts` | `factory` ; `truy vấn` ; `assertCanLogin()` ; `updateProfile()` ; `changeEmail()` ; `setPasswordHash()` ; `linkGoogleId()` ; `setNotificationsEnabled()` (+ `block/unblock`, `softDelete`, `toProps` trong file) — email duy nhất, không lộ `passwordHash`/`googleId`, block/soft-delete chặn login |
| `user-session-entity.spec.ts` | `factory` ; `truy vấn` ; `touch()` ; `revoke()` ; `assertUsable()` ; `toProps()` (6 describe) — TTL session |

Logic phiên (revoke/touch) chạy thật ở e2e `users-me` + `auth-flow`.

Chạy: `npx jest test/unit/users --no-coverage`.
