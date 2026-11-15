# Yêu cầu mới — Chất lượng code & Clean Architecture (vòng 1, bổ sung)

> Bổ sung vào `02_ke_hoach_thuc_thien.md` như **Nhóm J, K, L** (mã: J = ESLint, K = noImplicitAny,
> L = Clean Architecture + quy tắc dependency).
> Nhóm J/K/L là **tiền đề** cho Nhóm A–I: ESLint + rule dependency sẽ chặn sai ngay khi code A–I được viết.

---

## 1. Yêu cầu đã chốt

| # | Yêu cầu | Nội dung chi tiết |
|---|---|---|
| J | **Dùng ESLint** | Chưa có ESLint trong repo. Script `pnpm lint` đang trỏ tới `eslint` nhưng **package không được cài** → script chạy sẽ lỗi. Cần cài + cấu hình + tích hợp CI/pre-commit. |
| K | **noImplicitAny** | `tsconfig.json` **đã có** `"noImplicitAny": true` (cùng `strict: true`). Nhưng cần **siết thêm**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`. |
| L | **Tái kiến trúc chuẩn Clean Architecture** | Không cần giống dự án mẫu — thiết kế theo nguyên tắc Clean Architecture, giữ cấu trúc module đã có. |
| M | **Quy tắc phụ thuộc/độc lập giữa các tầng** | Bắt buộc có, kiểm được bằng test tự động (đã có sẵn `zero-any.spec.ts` làm mẫu). |

---

## 2. Hiện trạng đã khảo sát (chi tiết)

### 2.1 ESLint — CHƯA CÓ
```
package.json scripts:  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
node_modules:           KHÔNG có package eslint
node_modules/.bin:      KHÔNG có eslint
prettier:               KHÔNG có (nhưng script "format" vẫn gọi prettier)
```
→ Script `lint` và `format` hiện **gọi binary không tồn tại** → chạy sẽ `command not found`.

### 2.2 TypeScript — ĐÃ ỔN ĐỊNH, CẦN SIẾT THÊM
`tsconfig.json` hiện có:
```json
"strict": true, "strictNullChecks": true, "noImplicitAny": true,
"strictBindCallApply": true, "noFallthroughCasesInSwitch": true
```
Thiếu (nên bật): `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`,
`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.

**Đã có test kiểm chứng:** `test/zero-any.spec.ts` — quét regex mọi file `.ts` trong
`src/`, `scripts/`, `test/`, cấm `: any`, `as any`, `<any>`, `Array<any>`, `Record<..., any>`.
→ Test này là **mẫu chuẩn** để viết test dependency rule mới.

### 2.3 Clean Architecture — ĐANG ĐÚNG HƯỚNG, CÒN 3 VI PHẠM

Cấu trúc module hiện tại (đã khớp `5_ports_adapters_design_v2.md` §3.2):
```
modules/<module>/
├── domain/          entities/ value-objects/ events/ ports/
├── application/     services/ (chưa tách commands/ + queries/)
├── infrastructure/  http/ persistence/
├── <module>.module.ts
```

**Đã đúng (không cần sửa):**
- ✅ `domain/` **không** import `@nestjs/*`, `mongoose`, hay bất kỳ thư viện ngoài nào — **0 vi phạm**.
- ✅ `domain/` **không** import `application/` hay `infrastructure/` — **0 vi phạm**.
- ✅ `domain/` **không** import `domain/` của module khác — **0 vi phạm**.
- ✅ `application/` **không** import `infrastructure/` — **0 vi phạm**.
- ✅ `application/` **không** import `application/` của module khác — **0 vi phạm**.

**3 vi phạm còn lại:**

| # | Vi phạm | Vị trí | Mức |
|---|---|---|---|
| V1 | `infrastructure/` của module **đọc schema Mongoose của module khác** | `data-view.module.ts:3` → `../datasets/infrastructure/persistence/dataset-record.schema`<br>`analysis.module.ts:7` → `../datasets/infrastructure/persistence/dataset-record.schema` | 🔴 Vi phạm R3 (No cross-collection access) |
| V2 | `application/` của module khác import **service class** của module khác (gọi trực tiếp, không qua port) | `analysis.service.ts:5`, `summary.service.ts:3`, `report.service.ts:4`, `datasets.service.ts:19-20`, `feedback.service.ts:13-15`, `realtime-auth.service.ts:4` → `ProjectsService` / `WorkspacesService` / `UsersService` | 🔴 Vi phạm R2 (No cross-module service import) |
| V3 | `application/` import **port của module khác** | `analysis.service.ts:3,6,7`, `feedback.service.ts:10,12,47`, `workspaces.service.ts:22`, `notifications.service.ts:12,16`, `projects.service.ts:12,16`, `data-view.service.ts:11`, `issues.service.ts:24,28,32,33` | 🟡 Chấp nhận được nếu qua `import type` từ **public contract** của module sở hữu (đúng như `5_ports` §3.6 quy định) — cần **kiểm chứng bằng test** thay vì để miễn nhiễm |

> ⚠️ **Cập nhật sau khi đo thực tế (Bước 0 — xem `04_buoc_0_j0_k0_m0_bao_cao.md` §4):**
> Hai mục đánh dấu "✅ Đạt" trong bảng CA1–CA11 ở §3.4 **thực tế SAI**:
> - **CA3** (infrastructure không import domain/application module khác): có **9 vi phạm thật** → đã ghi vào baseline.
> - **CA5** (shared không import modules/): có **2 vi phạm thật** (`shared/events` → `modules/realtime/…/realtime.port`) → đã ghi vào baseline.
> - **Ngoài ra**: `application/realtime/realtime.service.ts` import `socket.io` → vi phạm CA2 → **đã sửa ngay trong Bước 0** (tách `SocketIoRealtimeTransport` ra infrastructure + `RealtimeTransportPort` ở domain).
>
> Vì vậy cơ chế kiểm tra được nâng từ "2 mức (fail/warn)" lên **cơ chế baseline** — xem §3.5.

### 2.4 Điểm cần lưu ý về `shared/`
`src/shared/` có 20 thư mục con (`casl`, `guards`, `pipes`, `events`, `database`, `storage`…).
Phần lớn là **cross-cutting framework glue** — không thuộc domain của module nào.
→ Cần quy tắc riêng: `shared/` được phép import `@nestjs/*`, `mongoose`, và **không** được import từ `modules/`.

---

## 3. Thiết kế đề xuất

### 3.1 Nhóm J — ESLint

**Công cụ:** ESLint 9 (flat config `eslint.config.mjs`) + `typescript-eslint` v8.
Bỏ `eslint --fix` khỏi script `lint` (fix tự động che giấu lỗi); tách `lint` (kiểm tra) và `lint:fix`.

**Bộ rule cốt lõi:**

| Nhóm | Rule | Mục đích |
|---|---|---|
| Type safety | `@typescript-eslint/no-explicit-any` (**error**) | Trùng `zero-any.spec.ts` nhưng chặn sớm ở editor/CI |
| | `@typescript-eslint/no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-argument`, `no-unsafe-return`, `no-unsafe-call` | Chặn `any` lan truyền ngầm qua biến |
| | `@typescript-eslint/consistent-type-imports` (`prefer: type-imports`) | Bắt buộc `import type` cho import chỉ dùng làm kiểu → hỗ trợ R6 (public contract) |
| | `@typescript-eslint/no-unused-vars` | Chặn biến/import thừa |
| | `@typescript-eslint/explicit-function-return-type` | Bắt buộc khai báo kiểu trả về → chặn suy luận `any` |
| | `@typescript-eslint/no-non-null-assertion` | Cấm `!` |
| | `@typescript-eslint/no-floating-promises` | Promise không được bỏ rơi — liên quan outbox/event |
| Clean Arch. | `no-restricted-imports` (overrides theo thư mục) | **Cơ chế chính để cưỡng chế dependency rule** |
| NestJS | `@typescript-eslint/no-extraneous-class`, `unbound-method` | Chặn class rỗng, method mất `this` |
| Chất lượng | `eqeqeq`, `no-var`, `prefer-const`, `no-console` (warn ở `src/**`) | Chuẩn hoá |

**Cấu hình `eslint.config.mjs` — 4 khối (flat config):**

```
1. ignores        → dist/, node_modules/, coverage/, *.d.ts
2. base (JS/TS)   → tsc-eslint.configs.recommended + stylistic
3. src/**         → + rule no-console warn, + no-restricted-imports theo layer
4. test/**        → nới lỏng (cho phép non-null assertion trong fixture)
```

**Quy tắc `no-restricted-imports` theo layer** (nhúng trong ESLint, phát hiện lỗi ngay khi gõ):

| Layer | Cấm import |
|---|---|
| `src/modules/**/domain/**` | `application/`, `infrastructure/`, `@nestjs/*`, `mongoose`, `@aws-sdk/*`, `kafkajs`, `socket.io`, `ioredis`, `bcrypt` |
| `src/modules/**/application/**` | `infrastructure/`, `mongoose`, `@aws-sdk/*`, `kafkajs` |
| `src/modules/**/infrastructure/**` | — (được import mọi thứ) |
| `src/shared/**` | `src/modules/**` (shared không được biết module nghiệp vụ) |

**Tích hợp:**
- `pnpm lint` → chạy ESLint (không fix).
- `pnpm lint:fix` → có `--fix`.
- `pnpm type-check` → giữ nguyên `tsc --noEmit`.
- `.husky/pre-commit` → thêm `pnpm run lint` trước `test:unit`.
- `package.json` scripts: sửa `lint` (bỏ `--fix`), thêm `lint:fix`, `lint:ci`.

**Rủi ro:** codebase hiện tại có thể có hàng trăm vi phạm (đặc biệt `no-unsafe-*` và
`explicit-function-return-type`). → Chạy ESLint ở mức **warn** trước, `--max-warnings 0` chỉ áp dụng
sau khi dọn xong, để không chặn tiến độ Nhóm A–I.

### 3.2 Nhóm K — `noImplicitAny` siết chặt

`noImplicitAny` đã bật. Bổ sung các cờ khác để tăng độ an toàn kiểu:

| Flag | Tác dụng | Rủi ro |
|---|---|---|
| `noUncheckedIndexedAccess` | `arr[0]` → `T \| undefined` | 🟡 Trung bình — ảnh hưởng nhiều chỗ xử lý cursor/page |
| `exactOptionalPropertyTypes` | Phân biệt `undefined` với "không có" | 🟡 Trung bình |
| `noImplicitOverride` | Bắt buộc `override` khi ghi đè | 🟢 Thấp |
| `noPropertyAccessFromIndexSignature` | `obj['x']` bắt buộc cho index signature | 🟢 Thấp |
| `useUnknownInCatchVariables` | `catch (e)` → `e: unknown` | 🟢 Thấp (đã có `as Error` ở nhiều chỗ) |
| `noUnusedLocals` / `noUnusedParameters` | Bắt code thừa | 🟢 Thấp |
| `verbatimModuleSyntax` | Bắt buộc `import type` rõ ràng | 🟢 Thấp |

**Quy trình an toàn:** bật từng cờ một, chạy `tsc --noEmit`, sửa lỗi, commit. Không bật tất cả một lúc.

**Bổ sung rule ESLint tương ứng:** `@typescript-eslint/no-unsafe-*` phát hiện `any` ngầm
(có thể do `JSON.parse`, `catch`, thư viện không có type) — đây là "anh em" của `noImplicitAny`.

### 3.3 Nhóm L — Tái kiến trúc chuẩn Clean Architecture

**Nguyên tắc chuẩn Clean Architecture (Robert C. Martin) — ánh xạ vào cấu trúc hiện có:**

| Nguyên tắc | Thể hiện trong dự án | Hiện trạng |
|---|---|---|
| **Entities** (nguồn sự thật nghiệp vụ) | `domain/entities/` — class thật, giữ invariant, có hành vi | ✅ Đã có |
| **Use Cases** (điều phối ứng dụng) | `application/` — service mỗi UC | ✅ Đã có (`services/`) |
| **Interface Adapters** | `infrastructure/http/` (controller, DTO Zod, mapper) + `infrastructure/persistence/` | ✅ Đã có |
| **Frameworks & Drivers** | `infrastructure/` + `src/shared/` (NestJS, Mongoose, Kafka, S3) | ✅ Đã có |
| **Dependency Rule** (mũi tên luôn hướng vào trong) | `infrastructure → application → domain` | ✅ Cơ bản đúng — còn 3 vi phạm |
| **Bounded Context** | 12 module độc lập | ✅ Đã có |

**Phần cần làm lại (tái kiến trúc):**

| Mã | Việc | Mức |
|---|---|---|
| L1 | **Tách `application/` thành `commands/` + `queries/`** theo `5_ports` §3.10 (Command/Query pattern, không dùng CQRS framework) — **ĐÃ CHỐT: làm thật trong vòng này** | 🔴 Cao |
| L2 | **Sửa V1** — không import schema Mongoose của module khác. `data-view` và `analysis` cần đọc `dataset_record` → phải đi qua **port** của `datasets` (`DatasetRepositoryPort` đã có `RECORD_QUERY_PORT`), không tự khai báo Mongoose model. | 🔴 |
| L3 | **Sửa V2** — thay việc gọi `ProjectsService`/`WorkspacesService`/`UsersService` chéo module bằng **port** đã export từ module sở hữu. `5_ports` §3.6 đã quy định nguyên tắc này nhưng code chưa làm. | 🔴 |
| L4 | **Sửa V3** — bắt buộc import port qua **public contract** (`index.ts` công khai của module), không import sâu vào file nội bộ | 🟡 |
| L5 | **Bổ sung `application/ports/`** cho các port hạ tầng dùng chung (`StoragePort` đang ở `shared/ports/` — cần chốt vị trí) | 🟡 |
| L6 | **`shared/` có quy tắc riêng**: không import từ `modules/`; đây là lớp "cross-cutting" nằm ngoài module | 🟢 |

**Về L3 (sửa V2) — ĐÃ CHỐT: L3a — ĐẦY ĐỦ.**

| Phương án | Nội dung | Công sức | Rủi ro |
|---|---|---|---|
| ~~L3a — Đầy đủ~~ **→ ĐÃ CHỐT** | Mọi cross-module call đi qua port. Module sở hữu export port từ `index.ts`. Xoá hết import service chéo. | 🔴 Cao (~12-16 file) | Phải refactor cả Nhóm A–I theo |
| ~~L3b — Từng phần~~ | Chỉ xoá import service chéo ở các module **cốt lõi** (`analysis`, `datasets`, `feedback`, `realtime`); module phụ thuộc 1 chiều được phép dùng service. | 🟡 TB | Còn nợ kỹ thuật |
| ~~L3c — Chỉ test~~ | Không refactor code, chỉ **ghi nhận** vi phạm vào `docs` + test báo cáo danh sách vi phạm (không fail CI). | 🟢 Thấp | Không cải thiện thực tế |

**Chi tiết cách thực hiện L3a:**

| Mã | Việc |
|---|---|
| L3a-1 | Mỗi module sở hữu port tạo file `src/modules/<module>/index.ts` export **public contract**: port token + interface + record type. Đây là cửa duy nhất để module khác truy cập. |
| L3a-2 | `analysis` cần `ProjectsService` → thay bằng `PROJECT_READER_PORT` (đọc) do `projects` định nghĩa. Tương tự `WorkspacesService`, `UsersService`. |
| L3a-3 | Xoá toàn bộ import `from '../../<module>/application/<x>.service'` (8 vị trí). |
| L3a-4 | Test **CA7** (không import service class của module khác) + **CA8** (chỉ import qua `index.ts`) chuyển từ warn → **fail CI**. |
| L3a-5 | Cập nhật `4_module_boundaries_v5.md` (bảng port + sơ đồ dependency) và `5_ports_adapters_design_v3.md`. |

**Lưu ý thứ tự:** L3a **phải làm sau Nhóm A–I** vì A–I sửa chính các file sẽ bị L3a đụng
(`workspaces.repository.ts`, `projects.repository.ts`, `issues.*`, `users.*`).
Các port mới cho L3a nên thiết kế **cùng lúc** với code A–I để không phải sửa 2 lần.

### 3.4 Nhóm M — Quy tắc phụ thuộc giữa các tầng (bắt buộc, kiểm tự động)

**Cơ chế kiểm tra 2 lớp:**

**Lớp 1 — ESLint `no-restricted-imports`** (mục 3.1): bắt lỗi ngay lúc viết code, hiện editor gạch đỏ.

**Lớp 2 — Test kiến trúc** (mẫu: `test/zero-any.spec.ts`), file mới `test/clean-architecture.spec.ts`:

| Quy tắc | Nội dung | Cấu hình hiện tại |
|---|---|---|
| **CA1** | `domain/` không import `application/`, `infrastructure/`, `@nestjs/*`, `mongoose`, hay thư viện hạ tầng nào | ✅ Đạt |
| **CA2** | `application/` không import `infrastructure/`, `mongoose`, `@aws-sdk/*`, `kafkajs` | ✅ Đạt |
| **CA3** | `infrastructure/` không import `domain/` của module khác, không import `application/` của module khác | ✅ Đạt |
| **CA4** | `domain/` của module A không import `domain/` của module B (trừ `shared/`) | ✅ Đạt |
| **CA5** | `shared/` không import từ `modules/` | ✅ Đạt (cần xác minh) |
| **CA6** | **Không import schema Mongoose của module khác** (vi phạm R3) | ❌ **2 vi phạm** |
| **CA7** | **Không import service class của module khác** (vi phạm R2) | ❌ **8 vi phạm** |
| **CA8** | **Không import sâu vào file nội bộ của module khác** — chỉ qua `index.ts` công khai (vi phạm R6) | ❌ **~19 vi phạm** |
| **CA9** | **Không có vòng phụ thuộc** giữa các module (R4) | 🟡 Cần script dựng đồ thị |
| **CA10** | Không import SDK AI bên ngoài (R7) | ✅ Đạt |
| **CA11** | `domain/` không import từ `shared/` nếu `shared/` kéo framework vào (kiểm tra transitively) | 🟡 |

**Cấu trúc file test:**
```
test/clean-architecture.spec.ts
├── helpers/resolve-import.ts     # resolve đường dẫn import → file thật
├── rules/ca1-domain-isolation.spec.ts
├── rules/ca2-application-isolation.spec.ts
├── rules/ca6-no-cross-schema.spec.ts
├── rules/ca7-no-cross-service.spec.ts
├── rules/ca8-public-contract.spec.ts
└── rules/ca9-no-cycle.spec.ts
```

**Chế độ kiểm tra:**
- `test:arch` hiện gồm `zero-any`, `guard-coverage`, `zod-openapi` → thêm `clean-architecture`.
- Chia 2 mức: `CA1–CA5, CA10` (đang đạt) → **fail CI**; `CA6–CA9` → **warn + ghi danh sách**
  cho tới khi refactor xong (không chặn tiến độ).

### 3.5 Cơ chế baseline (thực thi ở Bước 0) — nâng cấp so với thiết kế ban đầu

Khi đo thực tế, phát hiện **CA3 và CA5 KHÔNG đạt** (mục §2.3 ghi "✅ Đạt" là sai).
Nếu bật `fail CI` ngay thì sẽ chặn tiến độ; nếu để `warn` thì không chặn được gì.

→ Thay bằng **cơ chế baseline** (đã hiện thực):

| Tình huống | Hành vi |
|---|---|
| Vi phạm **đã có** trong `test/fixtures/arch-baseline.json` | Chỉ log cảnh báo |
| Vi phạm **MỚI** | **FAIL CI** |
| Vi phạm **đã được sửa** | Cảnh báo "nên gỡ khỏi baseline" |

- Sinh lại baseline: `pnpm run arch:baseline` (script `scripts/generate-arch-baseline.ts`).
- Baseline hiện tại: **68 vi phạm** (CA3: 9, CA5: 2, CA6: 3, CA7: 16, CA8: 38).
- CA9 (chu trình phụ thuộc) và CA11: **0 vi phạm** → đã chặn CI ngay.

---

## 4. Thứ tự thực thi đề xuất (bổ sung vào `02_ke_hoach_thuc_thien.md`)

```
Bước 0  J0  Cài ESLint + prettier + cấu hình flat config (chưa bật rule nghiêm)
Bước 0  K0  Bật thêm cờ TS theo từng đợt nhỏ (noImplicitOverride → useUnknownInCatchVariables → …)
Bước 0  M0  Viết test/clean-architecture.spec.ts ở mức "báo cáo" (chưa fail)
Bước 1  C+D  Nhóm C (remember-me) + D (issue needs_info)      [đã chốt]
Bước 2  A    Nhóm A (cursor pagination)                        [đã chốt]
Bước 3  E+F+G+H                                                [đã chốt]
Bước 4  L2+L3 Sửa V1 + V2 (cross-module coupling)              ← phụ thuộc A–I xong
Bước 5  L1  Tách commands/ + queries/                          ← tốn công, làm sau
Bước 6  B    Nhóm B (Google OAuth)                              [đã chốt]
Bước 7  J1  Bật ESLint rule nghiêm + `--max-warnings 0`
Bước 8  I    Nhóm I (vệ sinh tài liệu)                          [đã chốt]
```

**Quan trọng:** Nhóm L (Clean Architecture) **không nên làm song song** với A–I,
vì A–I có sửa `workspaces.repository.ts`, `projects.repository.ts`, `issues.*`, `users.*` —
L3 sẽ đụng chính các file đó. Làm L sau A–I để tránh merge conflict & sửa 2 lần.

---

## 5. Câu hỏi cần chốt — ĐÃ CHỐT

| # | Câu hỏi | Quyết định |
|---|---|---|
| LQ1 | **Mức độ sửa cross-module coupling (L3)** | **L3a — ĐẦY ĐỦ** (xoá hết import service chéo, mọi call đi qua port + `index.ts` công khai) |
| LQ2 | ESLint: bật rule nghiêm (`--max-warnings 0`) khi nào? | **Sau khi dọn** (Bước 7). Ban đầu để `warn` để không chặn tiến độ A–I |
| LQ3 | `noUncheckedIndexedAccess` bật vòng này hay để vòng sau? | **Vòng này** — tác dụng lớn với code phân trang cursor (Nhóm A) |
| LQ4 | Vị trí `StoragePort` — giữ `shared/ports/` hay chuyển `application/ports/` theo `5_ports`? | **Giữ `shared/ports/`** — đã dùng rộng, di chuyển tốn công không đem lại giá trị |
| LQ5 | `commands/` + `queries/` tách thật hay ghi nhận trong docs rồi để sau? | **Tách thật trong vòng này** (L1 → Bước 5) |
| LQ6 | Có bắt buộc `import type` 100% (ESLint `consistent-type-imports`) không? | **Có** — hỗ trợ R6 public contract |

---

## 6. Ước lượng lại (sau khi chốt L3a + L1)

| Nhóm | Số file dự kiến | Rủi ro | Ghi chú |
|---|---|---|---|
| J — ESLint | ~5 file (config + script + hook + deps) | 🟢 Thấp | |
| K — TS flags | ~15-25 file sửa lỗi | 🟡 TB | Bật từng cờ một |
| L1 — commands/queries | ~30 file (di chuyển + đổi import) | 🔴 Cao | Bước 5, sau A–I |
| L2 — cross-schema | ~4 file | 🟡 TB | |
| L3a — cross-service + public contract | ~20-25 file | 🔴 Cao | Bước 4, thiết kế port cùng lúc với A–I |
| L4 — public contract | ~15 file (`index.ts` mới) | 🟡 TB | Gộp vào L3a |
| M — test kiến trúc | ~8 file | 🟢 Thấp | Mẫu `zero-any.spec.ts` |
| **A–I** (vòng trước) | ~90 file | 🔴 | Không đổi |

**Tổng ước lượng vòng này:** ~190 file, trong đó phần lớn là di chuyển/tái cấu trúc, không phải viết mới.
