# 7. Phase P5 — Tier 3: `analysis` & `auth` (3 giờ)

> **Thời gian:** 3 giờ · **Mức rủi ro:** CAO — nhưng **chỉ di chuyển file, KHÔNG gộp**.
> **Nguyên tắc R4:** Hai module này chỉ được *flatten thư mục*. Không viết lại logic.

---

## 7.1. Tại sao giữ riêng cho T3?

| Lý do | `analysis` | `auth` |
|---|---|---|
| **Chuỗi nghiệp vụ dài** | 7 handler nối tiếp: Run → BuildPrompt → AI worker → Ingest → Summary → Report → Download | 11 handler: register/login/refresh/logout/forgot/reset + session lifecycle |
| **Có tiến trình ngoài** | AI worker chạy tiến trình riêng, có RAM guard, có cardinality guard | — |
| **Có bảo mật** | — | OAuth 2.0, bcrypt, refresh rotation, session policy |
| **Đã qua kiểm thử** | `corr-vif-ai.spec.ts` + `analysis-wave6-10.spec.ts` + `ai-worker.spec.ts` | `auth-admin-bootstrap.spec.ts` + auth tests |
| **Rủi ro khi gộp** | 🔴 Rất cao — sai 1 dòng = kết quả phân tích sai | 🔴 Rất cao — lỗi bảo mật |

> **Chiến lược:** T3 vẫn **phẳng hóa thư mục** (để đạt M3) nhưng **không gộp file**. Đổi tên `*.handler.ts` → giữ nguyên? Không — xem §7.3.

---

## 7.2. Quy tắc đặc biệt cho T3

| Quy tắc | Chi tiết |
|---|---|
| **T3-1** | Chỉ `git mv` — **không sửa nội dung logic** |
| **T3-2** | Handler **giữ nguyên tên file** dạng `*.handler.ts` (để diff review được) — hoặc đổi thành `*.service.ts` nếu module có nhiều handler |
| **T3-3** | **Không** gộp port + adapter + handler thành 1 file |
| **T3-4** | **Không** chạm util thuần (thuật toán DQ) — giữ nguyên tên & vị trí |
| **T3-5** | Schema Mongoose giữ nguyên tên |
| **T3-6** | Chỉ sửa `import` path — mọi thứ khác giữ nguyên |

> **Tại sao T3-2?** Vì Ở T3, việc đổi tên file tạo diff lớn mà **không giảm rủi ro**. Giữ tên file giúp:
> - Diff review nhanh (thấy ngay là chỉ move)
> - Rollback dễ
> - Đủ để đạt M3 (module phẳng = không có thư mục con)

---

## 7.3. Module `analysis` — 1 giờ 45 phút

### Cấu trúc hiện tại
```
src/modules/analysis/
├── application/
│   ├── analysis-limit.util.ts
│   ├── analysis.types.ts
│   ├── analysis.utils.ts
│   ├── commands/               6 handler
│   ├── pdf-builder.util.ts
│   ├── policy-loaders/         2 loader
│   ├── ports/                  2 port (ai-inference, resource-guard)
│   ├── queries/                5 handler
│   ├── report-content.util.ts
│   ├── report-worker.service.ts
│   └── services/               2 service (ai-worker, rag-few-shot)
├── domain/                     14 util + 2 port + 1 spec
├── infrastructure/
│   ├── ai/                     2 adapter
│   └── persistence/            1 repository + 1 mapper + 7 schema
├── presentation/
│   ├── controllers/            3 controller
│   └── dtos/                   1 DTO
├── analysis.module.ts
├── index.ts
└── README.md
```

### Đích — phẳng, giữ nguyên tên file

```
src/modules/analysis/
├── analysis.module.ts
├── analysis.routes.ts              ← từ presentation/controllers/analysis.controller.ts
├── analysis.report.routes.ts       ← từ presentation/controllers/report.controller.ts
├── analysis.summary.routes.ts      ← từ presentation/controllers/summary.controller.ts
├── analysis.dto.ts                 ← từ presentation/dtos/run-analysis.dto.ts
│
├── analysis.service.ts              ← 6 command handler GỘP (tên file đổi, logic giữ)
├── analysis.query.service.ts        ← 5 query handler GỘP
├── ai-worker.service.ts             ← giữ nguyên tên
├── rag-few-shot.service.ts          ← giữ nguyên tên
├── report-worker.service.ts         ← giữ nguyên tên
├── admin-bootstrap…                 ← (thuộc auth, không có ở đây)
│
├── analysis-job-policy.loader.ts    ← từ application/policy-loaders/
├── analysis-run-policy.loader.ts    ← từ application/policy-loaders/
├── resource-guard.port.ts           ← từ application/ports/
├── ai-inference.port.ts             ← từ application/ports/
│
├── analysis.repository.ts           ← từ infrastructure/persistence/
├── analysis.mapper.ts               ← từ infrastructure/persistence/
├── local-inference.adapter.ts       ← từ infrastructure/ai/
├── system-resource-guard.adapter.ts ← từ infrastructure/ai/
│
├── ai-job.schema.ts                 ← 7 schema
├── analysis-result.schema.ts
├── analysis-run.schema.ts
├── cell-evidence.schema.ts
├── few-shot-example.schema.ts
├── project-save.schema.ts
├── report-job.schema.ts
│
├── analysis.types.ts                ← từ application/analysis.types.ts
├── analysis-limit.util.ts
├── analysis.utils.ts
├── pdf-builder.util.ts
├── report-content.util.ts
├── analysis.repository.port.ts      ← từ domain/ports/
├── rag-few-shot.port.ts             ← từ domain/ports/
├── + 14 util thuần từ domain/       ← giữ nguyên tên: column-role.util.ts, correlation.util.ts,
│                                       date-parse.util.ts, dq.util.ts, impact.util.ts,
│                                       input-fingerprint.util.ts, pii-mask.util.ts,
│                                       rag-few-shot.util.ts, stats.util.ts,
│                                       suspicion.util.ts, top-n.util.ts, vif.util.ts,
│                                       ai-grounding.util.ts
├── analysis.domain.spec.ts          ← từ domain/corr-vif-ai.spec.ts
├── index.ts
└── README.md
```

### ⚠️ Cảnh báo T3

| Vấn đề | Xử lý |
|---|---|
| **14 util thuần** là **domain cốt lõi của sản phẩm** (correlation, VIF, DQ rules, column role) | Giữ nguyên tên file, chỉ đổi vị trí từ `domain/` ra gốc module |
| `corr-vif-ai.spec.ts` đặt trong `domain/` | Di chuyển ra `analysis.domain.spec.ts` — nhưng **giữ nguyên nội dung test** |
| `analysis.repository.port.ts` có **~20 type export** | Gộp vào `analysis.types.ts`? → **KHÔNG** — giữ file riêng, vì quá lớn |
| `pdf-builder.util.ts` + `report-content.util.ts` | Giữ riêng — logic tạo PDF |
| `resource-guard.port.ts` — RAM guard | Giữ riêng — ràng buộc tài nguyên |
| `ai-inference.port.ts` | Giữ riêng — port AI |
| 7 schema | Giữ nguyên tên, chỉ đổi vị trí |
| `local-inference.adapter.ts` — đọc `ConfigService` trực tiếp | **Không** đưa vào DI qua port — giữ nguyên |
| `report-worker.service.ts` + `ai-worker.service.ts` | Giữ riêng — 2 worker khác nhau |

### ⚠️ Rủi ro cao nhất của toàn bộ kịch bản

> `analysis` có **outbox + transaction + RAM guard + cardinality guard** đang hoạt động.
> Nếu chạm sai, bạn có thể phá vỡ cascade xóa dataset hoặc gây OOM khi xử lý dataset lớn.
>
> **Quy tắc:** nếu có bất kỳ thắc mắc nào về logic → **dừng module này lại**, đánh dấu "chưa làm", sang module khác. `analysis` phẳng hóa là **optional**, không phải bắt buộc.

---

## 7.4. Module `auth` — 1 giờ 15 phút

### Đích — phẳng, giữ nguyên tên file

```
src/modules/auth/
├── auth.module.ts
├── auth.routes.ts                  ← từ presentation/controllers/auth.controller.ts
├── auth.dto.ts                     ← 4 DTO gộp
├── google-redirect.util.ts         ← từ presentation/
│
├── auth.service.ts                 ← 9 command handler GỘP
├── auth.query.service.ts           ← 2 query handler GỘP
├── admin-bootstrap.service.ts      ← giữ nguyên tên
├── security-alert.service.ts       ← giữ nguyên tên
│
├── auth.types.ts                   ← từ application/auth.types.ts
├── auth-policy.vo.ts               ← từ domain/value-objects/
├── password-policy.vo.ts           ← từ domain/value-objects/
├── auth-events.ts                  ← từ domain/events/
├── auth-session.port.ts            ← từ domain/ports/
├── google-oauth.port.ts            ← từ domain/ports/
│
├── jwt.strategy.ts                 ← từ infrastructure/auth/
├── bcrypt-hasher.adapter.ts        ← từ infrastructure/security/
├── env-auth-session-policy.adapter.ts
├── google-oauth.adapter.ts
├── jwt-issuer.adapter.ts
├── users-auth-lookup.adapter.ts    ← ⚠️ implement port của module `users`
├── users-auth-session.adapter.ts   ← ⚠️ implement port của module `users`
├── index.ts
└── README.md
```

### ⚠️ Cảnh báo T3 — `auth`

| Vấn đề | Xử lý |
|---|---|
| `users-auth-lookup.adapter.ts` & `users-auth-session.adapter.ts` — cầu nối tới module `users` | Giữ nguyên tên class & logic. Chúng implement port của `users` → import qua `../users` |
| `jwt.strategy.ts` — PassportStrategy | Giữ nguyên |
| `admin-bootstrap.service.ts` — tạo tài khoản admin đầu tiên từ `ADMIN_EMAIL`/`ADMIN_PASSWORD` | **Không đụng logic** — bảo mật |
| `password-policy.vo.ts` — luật mật khẩu | Giữ nguyên invariant |
| `auth-policy.vo.ts` | Giữ nguyên invariant |
| `login-with-google.handler.ts` — OAuth 2.0 | **Không đụng** |
| `refresh-access-token.handler.ts` — refresh token rotation | **Không đụng** — logic bảo mật nhạy cảm |
| `security-alert.service.ts` — cảnh báo bảo mật | Giữ riêng |

---

## 7.5. Checklist T3 (ngắn hơn — ít thao tác hơn)

```
☐  Chỉ git mv — KHÔNG sửa logic
☐  Giữ nguyên tên file util / schema / adapter / port (trừ controller + DTO + handler)
☐  Handler gộp thành <mod>.service.ts + <mod>.query.service.ts — nội dung method giữ nguyên
☐  Sửa import path
☐  Sửa index.ts
☐  Sửa <mod>.module.ts
☐  rm -rf thư mục rỗng
☐  pnpm type-check → 0 lỗi
☐  pnpm lint → 0 cảnh báo
☐  pnpm exec jest --maxWorkers=2 → xanh (chú ý: ai-worker.spec.ts, analysis-*.spec.ts)
☐  pnpm arch:api-coverage → 82/82 (§12.1) + diff move-only
☐  Commit + tag
```

---

## 7.6. Đường cắt T3

| Tình huống | Hành động |
|---|---|
| Giờ 20 đến mà P5 chưa xong | **Bỏ P5 hoàn toàn** — 2 module này giữ nguyên 4 tầng |
| P5 xong `analysis` nhưng chưa xong `auth` | Giữ `analysis` phẳng, `auth` giữ nguyên — ghi rõ vào ADR |
| Bất kỳ test nào đỏ sau 15 phút | Revert module đó về trạng thái trước, đánh dấu "optional" |

> **Lưu ý cho báo cáo đồ án:** nếu 2 module cuối cùng không phẳng, hãy nói rõ trong ADR:
> *"11/13 module đã flatten; `analysis` và `auth` giữ cấu trúc 4 tầng do rủi ro bảo mật/hiệu năng trong khung 30 giờ — đã ghi nhận nợ kỹ thuật cụ thể."*
>
> Đây là **quyết định kỹ thuật có chủ ý**, không phải dấu hiệu làm dở. Nêu rõ lý do sẽ ăn điểm.

---

## 7.7. Cổng kiểm soát P5

| Điều kiện | Giá trị kỳ vọng |
|---|---|
| File `.ts` trong `src/modules/` | ~225 → ~180 |
| LOC | ~22 500 → ~20 000 |
| Thư mục con | ~22 → ~20 |
| `pnpm type-check` | 0 lỗi |
| `pnpm lint` | 0 cảnh báo |
| `pnpm exec jest --maxWorkers=2` | 67 suites / 1 069 tests |
| `pnpm arch:api-coverage` | 82 / 82 / 0 / 0 (§12.1) |
| Coverage | ≥ 71% (không giảm) |
| Tag | `v1.2.0-p5` hoặc `v1.2.0-p5-partial` |

---

## 7.8. Đối chiếu nghiệp vụ Tier 3 — chỉ di chuyển, không gộp (xem `12_business_invariants.md` §12.2–§12.6)

- **analysis:** 11 handler + 3 service (`ai-worker`, `rag-few-shot`, `report-worker`) + 7 schema + 2 port AI/guard + 2 policy loader + 14 util thuần (correlation, VIF, DQ, column-role, pii-mask, input-fingerprint, top-n, suspicion, impact, stats, date-parse, ai-grounding). Giữ `MAX_CORRELATION_CELLS`, `MAX_FEW_SHOT_STORE`, `DEFAULT_TOP_K/MIN_TRUST/MAX_AGE_DAYS`; giữ `LocalInferenceAdapter` đọc `ConfigService` trực tiếp; giữ `RESOURCE_GUARD_PORT`.
- **auth:** 11 handler + `admin-bootstrap` + `security-alert` + 7 token + 2 VO chính sách + 4 adapter cầu nối `users-auth-*`. Giữ thứ tự `sessions/me` trước `sessions/:id`; giữ `rememberMe=false` mặc định; giữ `PASSWORD 8–100`; giữ refresh rotation.
- **Quy tắc diff:** `git diff -M` phải 100% rename (trừ đổi import path). Có dòng `+`/`-` thực chất là vi phạm T3-1 — revert ngay.

---

> **Khóa chống vỡ test/API/hạ tầng:** trước mỗi commit của phase này, tick hết [`13_refactor_constraints.md`](13_refactor_constraints.md) §13.6 (TC giữ test/token/session/subscriber · AC giữ 82 route/envelope/filter/guard · FC giữ AppModule/main/worker/env/tunnel/test-infra · BC giữ ingest/cascade/policy · PC 1 module/1 commit, đỏ >15' thì revert).
