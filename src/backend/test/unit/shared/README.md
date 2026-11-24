# `test/unit/shared/` — 7 file: primitive dùng chung

Đây là nền của backend — hỏng ở đây thì 13 module hỏng theo.

| File | Các `describe` thật trong code |
|---|---|
| `casl.spec.ts` | `CASL Authorization Engine (casl-ability.factory.ts)` |
| `policies-guard.spec.ts` | `B2.7 — PoliciesGuard (CASL/ABAC)` (2 tầng static + dynamic, chặn IDOR, subject phải trích `__type`) |
| `keyset-pagination.spec.ts` | `encode/decode` ; `parseListCursor` ; `điều kiện MongoDB` ; `extractSortValue` ; `resolveSortSpec` ; `in-memory (admin path)` (6 describe) |
| `crypto.spec.ts` | `Cryptographic Engine (crypto.util.ts)` (AES-256-GCM + SHA-256) |
| `mask-pii.spec.ts` | `PII Masking & Data Privacy (mask-pii.ts)` |
| `domain-error.spec.ts` | `DomainError — lỗi nghiệp vụ thuần` ; `Error Mapping — code → HTTP status` (không chứa HTTP status trong domain, ánh xạ ở `interfaces/errors/`) |
| `device-detector.spec.ts` | `Device Detector Utility (Unit Test)` |

Chạy: `npx jest test/unit/shared --no-coverage`.
