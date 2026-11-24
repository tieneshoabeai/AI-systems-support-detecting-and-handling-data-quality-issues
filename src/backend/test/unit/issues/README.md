# `test/unit/issues/` — 1 file

| File | Các `describe` thật trong code |
|---|---|
| `issue-report-entity.spec.ts` | `factory` ; `truy vấn` ; `transitionTo()` ; `updateByUser()` ; `addAttachment()` ; `toProps()` (6 describe) — vòng đời `open -> needs_info -> resolved`, `needs_info` được sửa |

Liên quan: `workflows/step1-remember-me-and-issue-needs-info.spec.ts` + `test/e2e/issues-admin.e2e-spec.ts`.

Chạy: `npx jest test/unit/issues --no-coverage`.
