# Security findings — FE/API boundary

> **Snapshot lịch sử 17/11.** Cập nhật 19/11/2026 tại [frontend-api-revalidation.md](frontend-api-revalidation.md): build PASS; 402 test PASS/26 file; connected-api 13 PASS có overlap; E2E thật trước ghép 6 PASS/1 FAIL, cleanup fixture chưa retest. Health prefix đã xử lý; generated request aliases có consumer, members cursor/lifecycle đã bổ sung. Nội dung lịch sử dưới đây không thay thế trạng thái mới.


Các mức dưới đây là đánh giá có giới hạn từ source và mock tests; không là chứng nhận bảo mật. Không phân tích internals BE.

| ID | Mức | Finding | Source từ repo root | Giới hạn / đề xuất |
|---|---|---|---|---|
| FE-01 | BÁC BỎ — không phải finding hiện tại | Client đã xử lý empty 204 trước unwrap | `src/frontend/src/lib/axios-client.ts:125`, `src/frontend/src/__tests__/foundation/api.test.ts:177` | Phase 5: 55 test API pass; nhận định cũ đọc thiếu source; live DELETE UNVERIFIED |
| FE-02 | WARNING | Health root bị ghép vào API prefix | `src/frontend/src/services/health/health.service.ts`, `src/frontend/src/configs/api.config.ts`, `src/frontend/src/lib/openapi.json` | Có thể ảnh hưởng renewal; chưa xác minh proxy |
| FE-03 | WARNING | Management DTO được tin qua generic, generated response thiếu payload schema | `src/frontend/src/services/management/management.store.ts`, `src/frontend/src/lib/openapi.ts` | Bổ sung runtime guards và contract schema, không chỉ cast |
| FE-04 | WARNING | Access/refresh token JS-readable trong sessionStorage | `src/frontend/src/lib/session-storage.ts` | XSS/storage policy thực chưa test; không tự đổi auth strategy |
| FE-05 | WARNING | FE role flags không đủ chứng minh API authorization | `src/frontend/src/services/management/management.store.ts` | Live authorization outside scope/report boundary |
| FE-06 | WARNING | Partial writes/retry state mất qua reload | `src/frontend/src/services/management/management.store.ts` | Contract idempotency cần được define; không bảo đảm exactly-once |
| FE-07 | PASS giới hạn | Explicit auth, token account check, path safety, stale auth guard | `src/frontend/src/lib/axios-client.ts`, `src/frontend/src/views/application/management-data-provider.tsx`, `src/frontend/src/services/auth/session-coordinator.ts` | Source/mock proof, không exhaustive penetration test |
| FE-08 | PASS giới hạn | Che 5xx và không giữ raw error/config | `src/frontend/src/lib/api-error.ts` | Chỉ HTTP mapping đã đọc; không kiểm tra mọi log/sink |

XSS tổng thể, CSRF/cookies, headers CSP/HSTS, CORS, TLS thực và dependency vulnerabilities: **NOT VERIFIED**. Upload preflight giới hạn đuôi/kích thước/một số MIME ở UI không chứng minh server chặn file độc hại. Không công bố nội dung hoặc giá trị `.env`.

Các findings về completeness/phân trang/performance không tự được gọi là security exploit. Ưu tiên đề xuất và bằng chứng thêm tại [chương VIII](../08-security-performance.md)/[chương IX](../09-results-evaluation.md).
