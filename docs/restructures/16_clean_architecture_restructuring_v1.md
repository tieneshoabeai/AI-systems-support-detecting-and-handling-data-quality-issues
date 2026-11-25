# 16. Lộ trình tái cấu trúc Clean Architecture thực chất

- **Version:** v1
- **Ngày tạo:** 2026-11-17
- **Cập nhật gần nhất:** 2026-11-18 — **Bước 3 (Rich Domain Model): HOÀN THÀNH** (lát cắt 0/1/2/3/4/5/6/7 ✅ — 546/546 test pass) **+ Đợt rà soát API: 86/86 route khớp hợp đồng, P1 (Google OAuth cookie) đã sửa** — xem mục 7.14 và 7.16
- **Trạng thái:** Đã được người dùng phê duyệt nguyên tắc ở phiên 2026-11-17 (đồng ý với lộ trình 4 bước). Tài liệu này ghi lại **thiết kế chi tiết Bước 1** và **nguyên tắc chiều phụ thuộc** áp dụng cho toàn bộ lộ trình.
- **Giai đoạn:** Tech solution → Implementation (Bước 3 — đang thực hiện theo lát cắt dọc từng aggregate)
- **Quan hệ với các phần khác:** Phần 5 (Ports & Adapters) mô tả cấu trúc tầng hiện hành — sẽ được nâng lên **v4** sau khi Bước 1 hoàn tất. Phần 4 (Module Boundaries) mô tả ranh giới module — sẽ được nâng lên **v5** cùng đợt. Bộ quy tắc kiến trúc CA1–CA11 trong `src/backend/test/clean-architecture.spec.ts` sẽ được mở rộng.
- **Phạm vi:** Chỉ backend (`src/backend/`). Không đụng frontend, không đụng hạ tầng vận hành.

---

## 1. Mục tiêu

Hệ thống hiện tại **chạy đúng** nhưng **chưa đúng chuẩn Clean Architecture** ở 3 điểm:

1. **Presentation bị gộp vào Infrastructure.** Toàn bộ controller/DTO nằm ở `modules/*/infrastructure/http/` — tức là tầng "giao tiếp người dùng" bị chôn vào tầng "adapter hệ thống ngoài". Hệ quả: controller có thể (và đang) import thẳng adapter hạ tầng, không có ranh giới nào chặn.
2. **`shared/` phẳng 18 thư mục, trộn 4 tầng.** `shared/casl/` (framework) nằm cạnh `shared/ports/` (contract) cạnh `shared/database/` (hạ tầng) cạnh `shared/application/outbox/` (logic dùng chung). Không có quy tắc nào phân biệt.
3. **Chiều phụ thuộc không được kiểm soát ở biên ngoài.** Rule CA hiện tại chỉ kiểm tra `modules/*/{domain,application,infrastructure}` và coi `shared/` là một khối trọn vẹn — nên `shared/casl/` (NestJS) có thể bị domain import mà không ai chặn.

Mục tiêu của lộ trình: **làm cho quy tắc chiều phụ thuộc trở thành điều kiện build**, không chỉ là quy ước trên giấy.

## 2. Nội dung cần bàn luận

- Định nghĩa chính xác 4 tầng trong Clean Architecture và ranh giới giữa chúng.
- Ánh xạ từng thư mục hiện có sang tầng đích.
- Cơ chế kiểm chứng bằng test kiến trúc (CA rules).
- Thứ tự thực hiện để mỗi bước đều verify được độc lập.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Định nghĩa 4 tầng (áp dụng thống nhất cho module và cho `shared/`)

| Tầng | Vị trí trong module | Trách nhiệm | Được phép import |
|---|---|---|---|
| **Domain** | `modules/<m>/domain/` | Thực thể, value object, invariant, domain event, **port repository**. Thuần TypeScript — không framework. | `shared/domain/` + `shared/application/ports/` |
| **Application** | `modules/<m>/application/` | Use case (command/query handler), orchestration, **port hạ tầng**. | `domain/`, `shared/application/`, `shared/domain/` |
| **Infrastructure** | `modules/<m>/infrastructure/` | Adapter ra hệ thống ngoài: Mongoose, R2/S3, Kafka, Ollama, SMTP, Redis. | `domain/`, `application/`, `shared/infrastructure/`, `shared/application/` |
| **Presentation** | `modules/<m>/presentation/` | Interface adapter phía người dùng: HTTP controller, DTO (Zod), WebSocket gateway. Biết framework, **không biết hạ tầng**. | `application/`, `domain/`, `shared/interfaces/` |

**Mũi tên phụ thuộc (bắt buộc):**

```
Presentation ─┐
               ├─→ Application ─→ Domain
Infrastructure ┘
```

`Infrastructure` và `Presentation` là **hai nhánh độc lập** cùng hướng vào trong. Một nhánh không được import nhánh kia — đó là điểm mấu chốt mà cấu trúc hiện tại đang vi phạm (controller import policy loader nằm trong `infrastructure/adapters/`).

**Ánh xạ tương ứng cho `shared/`:**

| Tầng | Thư mục đích | Nội dung |
|---|---|---|
| Domain | `shared/domain/` | `crypto/`, `pagination/`, `utils/`, `validation/`, `security/` (type thuần: `CurrentUser`, `SubjectName`, `Action`, `PolicyResourceLoader`) |
| Application | `shared/application/` | `ports/` (contract hạ tầng dùng chung) |
| Infrastructure | `shared/infrastructure/` | `database/`, `events/`, `outbox/`, `storage/`, `adapters/`, `config/` |
| Interfaces | `shared/interfaces/` | `casl/`, `decorators/`, `filters/`, `guards/`, `interceptors/`, `middleware/`, `pipes/`, `swagger/` |

`shared/shared.module.ts` giữ ở gốc `shared/` vì nó là **composition root** (điểm lắp rap adapter) — được phép import mọi tầng của `shared/`, giống `app.module.ts` ở gốc `src/`.

### 3.2. Quyết định về Policy Loader — chuyển sang `application/`

**Vấn đề.** `*policy.loader.ts` hiện nằm ở `modules/*/infrastructure/adapters/`. Chúng là tham số của decorator `@PolicyResource(...)` trên controller. Nếu giữ nguyên ở `infrastructure/`, controller buộc phải import từ infrastructure → vi phạm chính quy tắc ta đang muốn siết.

**Phân tích.** Loader không chứa logic hạ tầng: nó chỉ nhận `id` và gọi repository port (thuộc `domain/ports/`) để nạp thực thể cho guard kiểm tra ở tầng động. Về bản chất nó là **một use case phụ phục vụ authorization**, tức thuộc tầng Application — không phải Infrastructure.

**Quyết định.** Chuyển `modules/<m>/infrastructure/adapters/*policy.loader.ts` → `modules/<m>/application/policy-loaders/`.

**Hệ quả trực tiếp:**
- Controller import loader từ `application/` → đúng chiều (Presentation → Application).
- Interface `PolicyResourceLoader` (hợp đồng mà loader hiện thực) phải nằm ở tầng mà Application được phép import → `shared/domain/security/policy-resource-loader.ts`.
- Decorator `@PolicyResource` (framework) vẫn ở `shared/interfaces/casl/` và import interface từ `shared/domain/`.
- Public contract `index.ts` của từng module tiếp tục export loader (CA8 — cross-module import qua `index.ts` không đổi).

**Ngoại lệ giữ nguyên:** `project-context.adapter.ts`, `workspace-context.adapter.ts`, `project-access.adapter.ts`, `workspace-access.adapter.ts`, `audit-logger.adapter.ts` — đây là adapter hiện thực port của hệ thống khác, giữ nguyên ở `infrastructure/adapters/`.

### 3.3. Quyết định về WebSocket của module `realtime`

**Vấn đề.** `realtime.gateway.ts` (Presentation) đang inject trực tiếp class `SocketIoRealtimeTransport` (Infrastructure) → vi phạm chiều phụ thuộc nếu tách hai nhánh.

**Quyết định.**
- `realtime.gateway.ts` → `modules/realtime/presentation/gateways/`.
- `socket-io-realtime.transport.ts` **giữ nguyên** ở `modules/realtime/infrastructure/websocket/`.
- Gateway chuyển sang inject qua **token DI** `REALTIME_TRANSPORT_PORT` (đã có sẵn ở `modules/realtime/domain/ports/realtime-transport.port.ts`) thay vì inject class cụ thể.
- Bổ sung `attachServer(server: unknown): void` vào interface `RealtimeTransportPort` (contract phải mô tả đủ điều gateway cần). Adapter hiện thực với `attachServer(server: Server)` — TypeScript cho phép contravariance lỏng cho method (bivariance), nên không lỗi.
- Hành vi runtime **không đổi**: server Socket.IO vẫn được gắn đúng thời điểm `afterInit`.

**Lý do không đặt transport vào `presentation/`:** `socket.io` là thư viện hạ tầng thực sự. Nếu đặt vào `presentation/`, ranh giới "Presentation không chạm hạ tầng" sẽ bị phá ngay tại module đầu tiên.

### 3.4. Bảng ánh xạ chi tiết — `shared/`

| Đường dẫn hiện tại | Đường dẫn đích |
|---|---|
| `shared/crypto/*` | `shared/domain/crypto/*` |
| `shared/pagination/*` | `shared/domain/pagination/*` |
| `shared/utils/*` | `shared/domain/utils/*` |
| `shared/validation/*` | `shared/domain/validation/*` |
| `shared/ports/*` | `shared/application/ports/*` |
| `shared/database/*` | `shared/infrastructure/database/*` |
| `shared/events/*` | `shared/infrastructure/events/*` |
| `shared/application/outbox/*` | `shared/infrastructure/outbox/*` |
| `shared/storage/*` | `shared/infrastructure/storage/*` |
| `shared/adapters/*` | `shared/infrastructure/adapters/*` |
| `shared/config/*` | `shared/infrastructure/config/*` |
| `shared/casl/*` | `shared/interfaces/casl/*` |
| `shared/decorators/*` | `shared/interfaces/decorators/*` |
| `shared/filters/*` | `shared/interfaces/filters/*` |
| `shared/guards/*` | `shared/interfaces/guards/*` |
| `shared/interceptors/*` | `shared/interfaces/interceptors/*` |
| `shared/middleware/*` | `shared/interfaces/middleware/*` |
| `shared/pipes/*` | `shared/interfaces/pipes/*` |
| `shared/swagger/*` | `shared/interfaces/swagger/*` |

**File mới (tách type thuần ra khỏi framework):**

| File mới | Nguồn | Nội dung |
|---|---|---|
| `shared/domain/security/current-user.ts` | tách từ `shared/casl/casl-ability.factory.ts` | interface `CurrentUser` (dùng bởi tầng application của `workspaces`) |
| `shared/domain/security/subjects.ts` | tách từ `shared/casl/subjects.type.ts` + `actions.enum.ts` | `SubjectName`, `AppSubjects`, enum `Action` |
| `shared/domain/security/policy-resource-loader.ts` | tách từ `shared/casl/policy-resource.decorator.ts` | interface `PolicyResourceLoader` (hợp đồng mà policy loader hiện thực) |

**Ghi chú:** `shared/domain/crypto/` dùng `node:crypto` + `node:stream` — đây là **builtin của Node**, không phải framework và không I/O ra ngoài, nên vẫn hợp lệ ở tầng domain. Quy tắc CA mới sẽ cấm `@nestjs/*` và `mongoose` trong `shared/domain/`, không cấm `node:*`.

### 3.5. Bảng ánh xạ chi tiết — `modules/`

| Đường dẫn hiện tại | Đường dẫn đích |
|---|---|
| `modules/<m>/infrastructure/http/*.controller.ts` | `modules/<m>/presentation/controllers/*.controller.ts` |
| `modules/<m>/infrastructure/http/dtos/*` | `modules/<m>/presentation/dtos/*` |
| `modules/realtime/infrastructure/websocket/realtime.gateway.ts` | `modules/realtime/presentation/gateways/realtime.gateway.ts` |
| `modules/<m>/infrastructure/adapters/*policy.loader.ts` | `modules/<m>/application/policy-loaders/*` |
| `modules/<m>/infrastructure/{persistence,messaging,ai,adapters,auth,security,websocket}/` | giữ nguyên |

Các thư mục `presentation/` mới có: `controllers/`, `dtos/`, `gateways/` (chỉ `realtime`).

### 3.6. Quy tắc kiến trúc mới (bổ sung vào `clean-architecture.spec.ts`)

| Rule | Nội dung | Mức phạt |
|---|---|---|
| **CA12** | `presentation` không import `infrastructure` (cùng module hoặc module khác) | Chặn ngay (baseline rỗng) |
| **CA13** | `shared/domain` không import `@nestjs/*`, `mongoose`, `@aws-sdk/*`, `kafkajs`, `socket.io`, `ioredis` | Chặn ngay |
| **CA14** | `shared/domain` không import `shared/application`, `shared/infrastructure`, `shared/interfaces` | Chặn ngay |
| **CA15** | `shared/application` không import `shared/infrastructure`, `shared/interfaces` | Chặn ngay |
| **CA16** | `shared/interfaces` không import `shared/infrastructure` | Chặn ngay |
| **CA11 (cập nhật)** | `modules/*/domain` chỉ được import `shared/domain/` và `shared/application/ports/` — thay cho danh sách `shared/{utils,validation,crypto}` cũ | Chặn ngay |

Cơ chế baseline hiện có (vi phạm mới → FAIL CI; vi phạm cũ trong baseline → cảnh báo) được giữ nguyên và áp dụng cho các rule mới.

### 3.7. Thứ tự thực hiện của Bước 1

Mỗi bước con dưới đây là **một lần commit**, đều verify được:

| # | Việc | Kiểm chứng |
|---|---|---|
| 1.0 | Viết tài liệu này + cập nhật `README.md` (mục lục) | — |
| 1.1 | Tái cấu trúc `shared/` sang 4 tầng (di chuyển file + sửa import, **không đổi logic**) | `type-check`, `lint`, `test:unit`, `test:arch` |
| 1.2 | Tách `presentation/` khỏi `infrastructure/` trong 13 module + chuyển policy loader sang `application/` | `type-check`, `lint`, `test:unit`, `test:e2e` |
| 1.3 | Cập nhật `resolve-import.ts` + thêm CA12–CA16 vào `clean-architecture.spec.ts` | `test:arch` phải xanh |
| 1.4 | Cập nhật `shared/README.md`, Phần 4 → v5, Phần 5 → v4 | rà soát tham chiếu |

**Nguyên tắc bất di bất dịch của Bước 1: không đổi một dòng logic nghiệp vụ nào.** Chỉ di chuyển file và sửa đường dẫn import. Hai thay đổi hành vi duy nhất được phép:
- `realtime.gateway.ts` chuyển từ inject class sang inject token (mục 3.3) — hành vi runtime giống hệt.
- Việc tách interface `CurrentUser`/`PolicyResourceLoader`/`SubjectName` ra file mới — thuần di chuyển.

### 3.8. Lộ trình 4 bước đã được phê duyệt

| Bước | Nội dung | Trạng thái |
|---|---|---|
| **Bước 1** | Tái cấu trúc thư mục: tách `presentation/`, chuẩn hoá `shared/` theo 4 tầng. | ✅ **Hoàn thành 2026-11-17** |
| **Bước 2** | Độc lập tầng Application khỏi Framework/HTTP: tạo `shared/domain/errors/domain-error.ts` mang mã lỗi nghiệp vụ (không phụ thuộc mã HTTP); thay ~88 file handler đang ném `HttpException` bằng `DomainError`; lớp Error Mapping ở tầng Presentation ánh xạ `code → HTTP status`; thêm rule CA cấm `application` import exception của `@nestjs/common`. | ✅ **Hoàn thành 2026-11-17** |
| **Bước 3** | Rich Domain Model: chuyển `*Record` interface thành entity class mang hành vi + invariant; DTO ở Presentation chỉ kiểm tra định dạng, Domain kiểm tra nghiệp vụ. | ✅ **Hoàn thành** — Lát cắt 0/1/2/3/4/5/6/7 ✅ (`BaseEntity`, `Workspace`, `Project`, `Dataset`, `User`/`UserSession`, `Notification`, `IssueReport`, `Feedback`) — 546/546 test pass — xem mục 7 |
| **Bước 4** | Tinh chỉnh use case: nâng handler CRUD thuần thành quyết định kinh doanh hoặc gom về domain service. | Chờ |

**Bước 2 là bước có giá trị nghiệp vụ cao nhất** (hiện tại 88 file tầng application ném exception HTTP — mỗi exception là một ràng buộc tới framework ở tầng trung). Bước 1 là điều kiện tiên quyết vì nó tạo ra ranh giới Presentation/Application rõ ràng để đặt lớp Error Mapping vào đúng chỗ.

### 3.9. Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Import sai đường dẫn sau khi di chuyển 71 file `shared/` + 52 file HTTP | Trung bình | `type-check` bắt ngay (TS strict, `noUnusedLocals`); chạy sau **mỗi** nhóm di chuyển |
| Test tham chiếu đường dẫn cũ (`test/guard-coverage.spec.ts`, `test/analysis-wave5.spec.ts`, …) | Trung bình | rà bằng `grep -rn "infrastructure/http"` trên `test/` và sửa hết |
| `scripts/wire-handlers.ts` hardcode `infrastructure/http` | Thấp | cập nhật đường dẫn |
| Baseline CA cũ (CA3/CA5/CA6/CA7/CA8/CA11) vỡ do đường dẫn đổi | Trung bình | `arch:baseline` chạy lại; CA11 viết lại theo bảng 3.6 |
| Hành vi đổi ngoài ý muốn khi tách interface | Thấp | không đổi code logic; chỉ tách khai báo |
| Tài liệu `docs/restructures/*` lệch cấu trúc mới | Trung bình | cập nhật Phần 4 → v5, Phần 5 → v4, `shared/README.md` ở bước 1.4 |

### 3.10. Nội dung còn mở (defer)

| # | Câu hỏi | Ghi chú |
|---|---|---|
| 1 | `modules/overview` không có tầng `domain/` — có cần tạo không? | Bước 3 khi làm Rich Domain Model |
| 2 | `shared/domain/validation/common-schemas.ts` dùng `zod` — có nên tách sang `shared/interfaces/`? | `zod` là thư viện thuần, không phải framework → giữ ở domain. Xem lại ở Bước 2 |
| 3 | `shared/domain/pagination/cursor-paginated.response.ts` mang tên "response" nhưng nằm ở domain | đặt lại tên `cursor-paginated.result.ts` ở Bước 2 cho khỏi nhập nhằng |
| 4 | Có cần `modules/*/presentation/responses/` (mapper domain → HTTP) không? | Bước 3–4 |

---

## 4. Đầu vào và đầu ra

**Đầu vào:**
- Mã nguồn thực thi `src/backend/src/` (370 file, 13 module, 71 file `shared/`).
- Bộ rule CA1–CA11 trong `src/backend/test/clean-architecture.spec.ts` + `src/backend/test/helpers/resolve-import.ts`.
- Phần 4 v4, Phần 5 v3.

**Đầu ra:**
- Cấu trúc thư mục mới ở `src/backend/src/` (module 4 tầng, `shared/` 4 tầng).
- Bộ rule CA12–CA16 + CA11 cập nhật.
- Phần 4 v5, Phần 5 v4, `shared/README.md` cập nhật.
- Báo cáo test: `type-check` 0 lỗi · `lint` 0 cảnh báo · `test:unit` xanh · `test:e2e` xanh · `test:arch` xanh.


---

## 5. Kết quả thực thi — Bước 1 (2026-11-17)

### 5.1. Các bước con đã hoàn thành

| # | Việc | Kết quả |
|---|---|---|
| 1.0 | Tài liệu thiết kế | ✅ `16_clean_architecture_restructuring_v1.md` |
| 1.1 | Tái cấu trúc `shared/` → 4 tầng | ✅ **70 file** di chuyển, **4 file type thuần** tách mới, **167 file** viết lại import |
| 1.2 | Tách `presentation/` trong 13 module | ✅ **48 file** di chuyểc, **7 policy loader** → `application/policy-loaders/`, **gateway** → `presentation/gateways/` |
| 1.3 | Rule CA12–CA16 + cập nhật CA11 | ✅ `resolve-import.ts` có `layerOf` (nhận `presentation`) + `sharedLayerOf` (4 phân tầng) |
| 1.3b | **Fix sau review** — CA17 (vị trí file presentation), CA18 (rò domain ra presentation), CA19 (infrastructure không import `shared/interfaces`) | ✅ 3 rule mới, thêm `CurrentUserPayload` vào `shared/domain/security/` |
| 1.4 | Cập nhật tài liệu | ✅ `4_module_boundaries_v5.md`, `5_ports_adapters_design_v4.md`, `shared/README.md` (v1.4.0), `docs/restructures/README.md` |

### 5.2. File mới (tách type thuần ra khỏi framework)

| File | Nội dung | Nguồn |
|---|---|---|
| `shared/domain/security/current-user.ts` | interface `CurrentUser` | tách từ `casl-ability.factory.ts` |
| `shared/domain/security/subjects.ts` | `SubjectName`, `AppSubjects` | tách từ `casl/subjects.type.ts` |
| `shared/domain/security/action.ts` | enum `Action` | tách từ `casl/actions.enum.ts` |
| `shared/domain/security/policy-resource-loader.ts` | interface `PolicyResourceLoader` | tách từ `casl/policy-resource.decorator.ts` |

Các file framework tương ứng **re-export** lại để giữ public contract cũ
(`import { CurrentUser } from '.../casl-ability.factory'` vẫn chạy).

### 5.3. Hai thay đổi hành vi duy nhất (được phép theo §3.7)

1. **`realtime.gateway.ts`** chuyển từ inject class `SocketIoRealtimeTransport` sang inject token
   `REALTIME_TRANSPORT_PORT`. Interface `RealtimeTransportPort` được bổ sung
   `attachServer(server: unknown): void`. Hành vi runtime giống hệt — server Socket.IO
   vẫn được gắn đúng thời điểm `afterInit`.
2. **Tách 4 interface/enum thuần** sang `shared/domain/security/` — thuần di chuyển khai báo.

### 5.4. Vi phạm CA12 phát hiện và cách xử lý

Rule CA12 (presentation không import infrastructure) phát hiện **4 vi phạm thật** ngay
lần chạy đầu tiên — đây là giá trị lớn nhất của việc tự động hoá quy tắc:

| Vi phạm | Xử lý |
|---|---|
| `realtime.gateway.ts` → `socket-io-realtime.transport.ts` | ✅ Gateway inject qua token `REALTIME_TRANSPORT_PORT` (port ở `domain/ports/`) |
| `realtime.gateway.ts` → `'socket.io'` | ✅ Cho phép — `socket.io` là **giao thức** của interface WebSocket, không phải adapter hạ tầng. Đã tách `PRESENTATION_FORBIDDEN_PACKAGES` khỏi `APP_FORBIDDEN_PACKAGES` |
| `datasets.controller.ts` → `'busboy'` | ✅ Cho phép — `busboy` là **multipart parser** (định dạng đường truyền HTTP) |
| `issues.controller.ts` → `'busboy'` | ✅ Cho phép — như trên |

**Bài học:** CA2 (`application` không chạm hạ tầng) và CA12 (`presentation` không chạm hạ tầng)
**không dùng chung một danh sách package**. Danh sách cho `application` phải chặt hơn
(`socket.io`, `busboy` bị cấm), vì `application` không được biết giao diện.
`presentation` được phép biết giao thức của chính interface.

### 5.5. Báo cáo kiểm chứng

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Type check | `pnpm run type-check` | ✅ **0 lỗi** |
| Lint | `pnpm run lint` (`--max-warnings 0`) | ✅ **0 cảnh báo** |
| Unit test | `npx jest` | ✅ **341/341 pass** (27 suite) |
| E2E test | `npx jest --config ./test/jest-e2e.json` | ✅ **55/55 pass** (3 suite) |
| Architecture test | `npx jest --testPathPatterns 'clean-architecture'` | ✅ **18/18 pass** (CA1–CA16) |
| DI graph | `pnpm run arch:verify-di` | ✅ AppModule resolve thành công |

### 5.6. Công cụ codemod

`src/backend/scripts/_refactor_b1.py` — codemod di chuyển file + tự tính lại đường dẫn import:

1. **Resolve** toàn bộ import trên cây cũ (trước khi di chuyển).
2. **Ánh xạ** vị trí cũ → vị trí mới.
3. **Tính lại** đường dẫn tương đối từ vị trí MỚI của file nhập tới vị trí MỚI của file đích.

Cách này tránh sai sót thủ công trên hơn 370 file. Có chế độ `--dry-run` để xem trước
bản đồ di chuyển.

> **Bài học rút ra (2 lỗi đã gặp, đều do codemod):**
> 1. Specifier sinh ra phải **bỏ đuôi `.ts`** — TS không cho import kết thúc bằng `.ts`
>    (trừ khi bật `allowImportingTsExtensions`).
> 2. Khi restore backup bằng `tar`, phải **`rm -rf` thư mục đích trước** — `tar` ghi đè
>    nhưng **không xoá file thừa**, khiến file cũ (đã đổi) tồn tại song song.


---

## 5.7. Đợt fix sau review Bước 1 (2026-11-17)

Review Bước 1 phát hiện **3 vấn đề thật**. Đã sửa hết — nguyên tắc "không đổi logic
nghiệp vụ" vẫn giữ nguyên (chỉ di chuyển khai báo type + bổ sung rule).

### 5.7.1. Fix ① — `CurrentUserPayload` nằm sai tầng

**Vấn đề.** `modules/auth/infrastructure/auth/jwt.strategy.ts` import
`CurrentUserPayload` từ `shared/interfaces/decorators/current-user.decorator` →
`infrastructure` (tầng ngoài trong cùng) phụ thuộc ngược vào `interfaces`
(tầng giao diện framework). Đặc tả §3.1 **không cho phép** chiều này.

**Nguyên nhân gốc.** Kiểu `CurrentUserPayload` là dữ liệu thuần nhưng bị khai báo
nằm cạnh decorator `@CurrentUser()` trong `shared/interfaces/`. Đó là hệ quả của
việc trước đây chưa tách được ranh giới giữa "kiểu dữ liệu" và "decorator".

**Sửa.**
- Tạo `shared/domain/security/current-user-payload.ts` — khai báo thuần TypeScript.
- `shared/domain/security/current-user.ts` → `CurrentUser extends CurrentUserPayload`
  (loại bỏ lặp 4 trường, đảm bảo hai kiểu không trôi lệch nhau).
- `shared/interfaces/decorators/current-user.decorator.ts` → **re-export** type
  (giữ public contract cũ cho mọi controller đang import).
- `shared/interfaces/guards/roles.guard.ts` → import trực tiếp từ `shared/domain/`.
- `modules/auth/infrastructure/auth/jwt.strategy.ts` → import từ `shared/domain/`.

**Kết quả.** `infrastructure → shared/interfaces` = **0** (trước: 1).
→ Rule **CA19** chặn tái phạm.

### 5.7.2. Fix ② — Lỗ hổng trong rule CA12

**Vấn đề.** `layerOf()` trả `'module-root'` cho file đặt ngay ở gốc `modules/<m>/`.
Nếu ai đó đặt controller ở đó, CA12 ("presentation không import infrastructure")
sẽ **không bắt** → lỗ hổng trong rule, không phải trong cấu trúc.

**Sửa.** Thêm rule **CA17** — kiểm tra **vị trí file theo hình dạng tên**, độc lập
với phân loại tầng:

> Mọi file `*.controller.ts` / `*.gateway.ts` / `*.dto.ts` phải nằm trong
> `modules/<m>/presentation/`.

Ngoại lệ: `src/app.controller.ts` (health check HTTP server, không thuộc module
nghiệp vụ nào).

**Ghi chú kỹ thuật.** Đã thử thêm rule ESLint tương ứng (`no-restricted-imports`
với pattern `**/*.controller`) nhưng **bị loại** vì ESLint không phân biệt được
"import sai chỗ" với "import đúng chỗ" — nó chặn cả các import hợp lệ từ
`*.module.ts`. Rule trong test kiến trúc chính xác hơn vì kiểm tra *vị trí file*,
không kiểm tra *import*.

### 5.7.3. Fix ③ — `presentation` đang "rò" interface của `domain`

**Vấn đề.** Đặc tả §3.1 cho phép `presentation` import `domain/`. Nhưng thực tế
có **13 import runtime value** (không phải type-only) — dấu hiệu interface của
`domain` đang lộ ra ngoài tầng presentation:

| Nguồn rò | Số chỗ | Vì sao là rò |
|---|---|---|
| `shared/domain/security/action.ts` | 8 controller | Enum **quyền** — controller biết mã quyền, không biết ngữ nghĩa |
| `modules/*/domain/ports/*.repository.port.ts` | 3 DTO | Hằng sort đặt cạnh port repository |
| `modules/realtime/domain/ports/realtime-transport.port.ts` | 1 gateway | Token DI của tầng domain lộ ra ngoài |

**Phân biệt quan trọng — không phải cái nào cũng là vi phạm:**

| Loại | Ví dụ | Đánh giá |
|---|---|---|
| Hợp đồng dữ liệu thuần | `shared/domain/validation/` (Zod schema), `shared/domain/utils/` (hàm/hằng thuần) | ✅ Chấp nhận — không mang hành vi |
| Mang **hành vi quyền** hoặc **token DI** | `Action`, `*_SORT_OPTIONS`, `REALTIME_TRANSPORT_PORT` | ⚠️ Rò thật → Bước 2/3 |

**Sửa.** Thêm rule **CA18** với allowlist 4 file rò thật, ghi 13 vi phạm vào
`test/fixtures/arch-baseline.json` (theo dõi được nhưng **không chặn CI**).

**Vì sao chưa sửa triệt để?** Sửa cần đổi API của decorator `@CheckPolicies` và
bố trí lại DI token → **chạm vào hợp đồng phân quyền**, thuộc phạm vi Bước 2/3.
Ưu tiên giữ nguyên hành vi ở Bước 1.

### 5.7.4. Ma trận phụ thuộc sau khi fix

| FROM \ TO | M:domain | M:applic | M:infras | M:presen | S:domain | S:applic | S:infras | S:interf |
|---|---|---|---|---|---|---|---|---|
| **M:domain** | 25 | . | . | . | 3 | . | . | . |
| **M:application** | 42 | 89 | . | . | 58 | 16 | . | . |
| **M:infrastructure** | 16 | 9 | 39 | **.** | 13 | . | 15 | **.** ✅ |
| **M:presentation** | 5 | 92 | **.** ✅ | 20 | 16 | . | . | 64 |

Hai ô tô đậm là ranh giới then chốt:
- `presentation → infrastructure` = **0** (CA12).
- `infrastructure → shared/interfaces` = **0** (CA19 — mới).

### 5.7.5. Rule mới sau đợt fix này

| Rule | Nội dung | Trạng thái |
|---|---|---|
| **CA17** | `*.controller.ts` / `*.gateway.ts` / `*.dto.ts` phải nằm trong `modules/<m>/presentation/` | ✅ Chặn CI |
| **CA18** | `presentation` không import runtime value từ 4 file domain đang rò | ⚠️ Ghi nhận (baseline 13 vi phạm) → Bước 2/3 |
| **CA19** | `infrastructure` không import `shared/interfaces` | ✅ Chặn CI |

### 5.7.6. Báo cáo kiểm chứng

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Type check | `pnpm run type-check` | ✅ **0 lỗi** |
| Lint | `pnpm run lint` (`--max-warnings 0`) | ✅ **0 cảnh báo** |
| Unit test | `npx jest` | ✅ **344/344 pass** (27 suite) — +3 so với trước (CA17–CA19) |
| E2E test | `npx jest --config ./test/jest-e2e.json` | ✅ **55/55 pass** (3 suite) |
| Architecture test | `npx jest --testPathPatterns 'clean-architecture'` | ✅ **21/21 pass** (CA1–CA19) |
| DI graph | `pnpm run arch:verify-di` | ✅ AppModule resolve thành công |

---

## 6. Bước 2 — Độc lập tầng Application khỏi Framework/HTTP

**Ngày hoàn thành:** 2026-11-17
**Phạm vi:** `application` + `presentation` + `infrastructure` (toàn hệ thống lỗi)

### 6.1. Vấn đề đã giải quyết

Trước Bước 2, **202 throw site** trải khắp **81 file** `modules/*/application/` ném
exception của NestJS:

```ts
// ❌ Trước — tầng trung phụ thuộc HTTP
throw new NotFoundException('Chưa có Tổng kết cho project này');
```

Hai hệ quả:

1. **Vi phạm Dependency Rule** — tầng trung (`application`) bị ràng buộc vào framework.
   Mỗi endpoint mới lại phải viết lại logic lỗi thay vì dùng chung.
2. **Mã lỗi không ổn định** — NestJS mặc định gán `error.code = 'Not Found'` /
   `'Bad Request'` (Title Case), **không** theo hợp đồng API Phần 7 §3.3–§3.4
   (`SCREAMING_SNAKE_CASE`: `NOT_FOUND`, `VALIDATION_ERROR`, …).

### 6.2. Kiến trúc lỗi mới

```
shared/domain/errors/            ← Tầng DOMAIN: mã lỗi nghiệp vụ (thuần tuyệt đối)
  error-codes.ts                    ERROR_CODES + ErrorCode + ERROR_CODE_VALUES
  domain-error.ts                   DomainError + 13 subclass ngữ nghĩa
  index.ts                          Public contract

shared/application/errors/        ← Tầng APPLICATION: lỗi có HTTP status tường minh
  status.error.ts                   StatusError (escape hatch cho hợp đồng API bắt buộc)
  index.ts

shared/interfaces/errors/         ← Tầng INTERFACES: ranh giới duy nhất biết HTTP
  error-http-mapping.ts             ERROR_CODE_TO_HTTP_STATUS + httpStatusForErrorCode()
  index.ts

shared/interfaces/filters/
  all-exceptions.filter.ts          Bắt DomainError → JSON chuẩn hoá
```

**Nguyên tắc phân tách:**

| Tầng | Biết mã lỗi nghiệp vụ? | Biết HTTP status? |
|---|---|---|
| `shared/domain/` | ✅ | ❌ |
| `shared/application/` | ✅ | ⚠️ chỉ khi hợp đồng API **bắt buộc** (`StatusError`) |
| `shared/interfaces/` | ✅ (để ánh xạ) | ✅ **đây là ranh giới duy nhất** |

### 6.3. Danh mục mã lỗi

| Mã lỗi | HTTP | Subclass `DomainError` |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` |
| `TOKEN_INVALID` | 401 | `TokenInvalidError` (⊂ `UnauthenticatedError`) |
| `TOKEN_EXPIRED` | 401 | `TokenExpiredError` (⊂ `UnauthenticatedError`) |
| `FORBIDDEN` | 403 | `ForbiddenError` |
| `NOT_FOUND` | 404 | `NotFoundError` |
| `CONFLICT` | 409 | `ConflictError` |
| `DUPLICATE_RESOURCE` | 409 | `DuplicateResourceError` |
| `LIMIT_EXCEEDED` | 429 | `RateLimitExceededError` |
| `FILE_TOO_LARGE` | 413 | `FileTooLargeError` |
| `ATTACHMENT_TOO_LARGE` | 400 | — |
| `UNSUPPORTED_FILE_TYPE` | 400 | — |
| `UNSUPPORTED_MEDIA_TYPE` | 400 | — |
| `DEPENDENCY_NOT_CONFIGURED` | 501 | `DependencyNotConfiguredError` |
| `DEPENDENCY_UNAVAILABLE` | 503 | `DependencyUnavailableError` |
| `INTERNAL_ERROR` | 500 | — |

**Quy tắc bất di bất dịch:** tên mã lỗi **không** chứa số HTTP và **không** chứa
từ khoá HTTP. `NOT_FOUND` chứ không phải `HTTP_404`; `VALIDATION_ERROR` chứ không
phải `BAD_REQUEST` — vì "dữ liệu sai định dạng" là khái niệm nghiệp vụ, còn "400"
là khái niệm của giao thức.

### 6.4. Trường hợp đặc biệt — `StatusError`

Có 15 chỗ mà **HTTP status gốc ≠ status mặc định của mã lỗi**. Ví dụ:

```ts
// Google OAuth: UnauthorizedException (401) + error: 'VALIDATION_ERROR'
// → nếu dùng DomainError(VALIDATION_ERROR) thì status thành 400 ❌ (sai hợp đồng)
throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, '...');
```

`StatusError` nằm ở `shared/application/errors/` (không phải `shared/interfaces/`)
vì cả `application` và `infrastructure` đều cần dùng, còn `infrastructure` không
được import `shared/interfaces` (CA19).

**Chi tiết phát hiện trong lúc refactor:**

| Exception gốc | Payload gốc | Mặc định | Xử lý |
|---|---|---|---|
| `UnauthorizedException` (401) | `VALIDATION_ERROR` | 400 ❌ | → `StatusError(401, …)` |
| `NotImplementedException` (501) | `DEPENDENCY_UNAVAILABLE` | 503 ❌ | → `StatusError(501, …)` |
| `ServiceUnavailableException` (503) | `DEPENDENCY_UNAVAILABLE` | 503 ✅ | → `DomainError` |

### 6.5. Rule CA20 (mới)

| Rule | Nội dung | Trạng thái |
|---|---|---|
| **CA20** | Tầng `application` không được import `*Exception` hoặc `HttpStatus` từ `@nestjs/common` | ✅ Chặn CI |

Triển khai tại `test/helpers/resolve-import.ts` (`findNestjsHttpExceptionImports`)
và `test/clean-architecture.spec.ts`.

### 6.6. Công cụ codemod (một lần)

7 script trong `src/backend/scripts/` được viết để refactor an toàn 202 throw site:

| Script | Vai trò |
|---|---|
| `codemod-domain-error.mjs` | `HttpException` → `DomainError` / `StatusError` |
| `cleanup-nestjs-exception-imports.mjs` | Dọn import `@nestjs/common` còn sót (multi-line block) |
| `fix-http-status-regression.mjs` | Phát hiện & sửa **mismatch HTTP status** (so với bản gốc trong git) |
| `normalize-domain-error-classes.mjs` | `DomainError(CODE)` → subclass cụ thể |
| `cleanup-unused-error-code-imports.mjs` | Dọn `ERROR_CODES` không dùng (TS6133) |
| `codemod-test-domain-error.mjs` | Cập nhật assertion trong test |
| `codemod-test-assertions-multiline.mjs` | Assertion test nhiều dòng |

> **Bài học rút ra:** codemod chỉ là công cụ *đề xuất*, không phải công cụ *quyết định*.
> Script `fix-http-status-regression.mjs` đọc bản gốc trong git để đối chiếu
> **HTTP status** — vì thay đổi exception class không đảm bảo giữ nguyên status.
> 15 regression status chỉ được phát hiện nhờ bước đối chiếu này.

### 6.7. Kết quả kiểm chứng

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Type check | `pnpm run type-check` | ✅ **0 lỗi** |
| Lint | `pnpm run lint` (`--max-warnings 0`) | ✅ **0 cảnh báo** |
| Unit test | `pnpm run test:unit` | ✅ **324/324 pass** (24 suite) |
| Architecture test | `pnpm run test:arch` | ✅ **17/17 pass** (CA1–CA20) |
| E2E test | `pnpm run test:e2e` | ✅ **55/55 pass** (3 suite) |
| DI graph | `pnpm run arch:verify-di` | ✅ AppModule resolve thành công |

### 6.8. Ảnh hưởng hợp đồng API

`error.code` trong response body chuyển từ Title Case sang `SCREAMING_SNAKE_CASE`:

```jsonc
// Trước
{ "success": false, "error": { "code": "Not Found", "message": "..." } }
// Sau
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

Đây là **chủ ý** — hợp đồng API Phần 7 §3.4 quy định `SCREAMING_SNAKE_CASE`.
Frontend và test kiểm tra theo `code` (không theo `message`) nên không bị ảnh hưởng.

### 6.9. Nội dung còn mở (defer sang Bước 3/4)

| # | Câu hỏi | Kế hoạch |
|---|---|---|
| 1 | `shared/domain/pagination/cursor-paginated.response.ts` vẫn mang tên "response" | đổi tên ở Bước 3 |
| 2 | `StatusError` cho phép `application` biết HTTP status — có nên thu hẹp thêm không? | Bước 3: chuyển quyết định status sang tầng presentation |
| 3 | `presentation` vẫn dùng `@HttpCode(HttpStatus.X)` decorator | chấp nhận — decorator là ngôn ngữ framework, hợp lệ ở tầng giao diện |

---

## 7. Bước 3 — Rich Domain Model (đang thực hiện)

**Bắt đầu:** 2026-11-18

### 7.1. Nguyên tắc đã chốt

| Quyết định | Nội dung |
|---|---|
| **Scope** | Core aggregates (có invariant thật sự cần bảo vệ) — không áp dụng cho mọi record. |
| **Mapping** | **Full-migration**: Repository port trả **entity**; infrastructure adapter map document → entity qua `reconstitute()`; presentation có `responses/*.response.ts` map entity → Response DTO. |
| **Order** | Tuần tự từng aggregate: `Workspace` → `Project` → `Dataset` → `User` → `Notification` → `IssueReport` → `Feedback`. |
| **Error-semantics** | Dùng `DomainError` + subclass ngữ nghĩa (`ConflictError`, `ValidationError`, `NotFoundError`, `ForbiddenError`) — tuyệt đối không `HttpException`. |
| **Wire format** | Giữ nguyên 100% camelCase của HTTP API cũ — không làm gãy frontend/E2E test. |

### 7.2. Kiến trúc một aggregate (mẫu chuẩn — `Project`)

```
modules/<m>/domain/
  entities/<a>.entity.ts          ← aggregate root: state riêng tư + hành vi + invariant
  value-objects/*.vo.ts           ← quy tắc thuần (role, status, giới hạn)
  events/<a>-events.ts            ← tên domain event
  ports/<a>.repository.port.ts    ← contract: trả ENTITY, không trả record trần
modules/<m>/application/
  commands/*.handler.ts           ← orchestration, gọi hành vi entity
  queries/*.handler.ts            ← trả entity (không map DTO)
modules/<m>/infrastructure/
  persistence/<a>.mapper.ts       ← document → entity (reconstitute)
  persistence/<a>.repository.ts   ← implements port
modules/<m>/presentation/
  controllers/*.controller.ts      ← gọi handler → map qua responses/
  responses/<a>.response.ts       ← entity → Response DTO (mapper duy nhất)
```

**Luật bất di bất dịch:**
1. `props` là `protected readonly` — không có setter tự do.
2. `static create()` (tạo mới, phát event) và `static reconstitute()` (dựng lại từ DB, **không** phát event).
3. Invariant kiểm tra **trong entity**, ném `DomainError` — không phải `Error` trần, không phải `HttpException`.
4. Handler **không** viết lại điều kiện nghiệp vụ — gọi hành vi entity (`project.rename()`, `project.addMember()`…) rồi lưu.

### 7.3. Trạng thái từng lát cắt

| Lát cắt | Aggregate | Trạng thái | Ghi chú |
|---|---|---|---|
| **0** | `BaseEntity` (`shared/domain/entities/`) | ✅ Hoàn thành | `props` riêng tư, `version` (optimistic locking), `domainEvents`, `dispatchDomainEvents()`, `toObject()` (serialisation cho CASL) |
| **1** | `Workspace` | ✅ Hoàn thành | 341 dòng — `transferOwnershipTo()`, `addMember()`, `removeMember()`, `leave()` |
| **2** | `Project` | ✅ Hoàn thành | 368 dòng — 10 command + 6 query handler chuyển sang entity; thêm `presentation/responses/project.response.ts` |
| **3** | `Dataset` | ✅ Hoàn thành | `dataset.entity.ts` 39 → ~430 dòng, kế thừa `BaseEntity`; `assertIngestible()` đổi từ `Error` trần → `ValidationError`; thêm `presentation/responses/dataset.response.ts` (S14 do mapper đảm nhiệm) |
| **4** | `User` / `UserSession` | ✅ Hoàn thành | `user.entity.ts` 41 → ~350 dòng, `user-session.entity.ts` 20 → ~180 dòng; thêm `presentation/responses/user.response.ts`; mapper `user.mapper.ts`; adapter auth chuyển sang trả entity |
| **5** | `Notification` | ✅ Hoàn thành | `notification.entity.ts` 30 → ~230 dòng; `markAsRead()` idempotent ở handler, invariant "đọc 1 lần" ở entity; mapper `notification.mapper.ts` trả entity |
| **6** | `IssueReport` | ✅ Hoàn thành | `issue-report.entity.ts` 27 → ~380 dòng; `transitionTo()` bảo vệ luồng 5 trạng thái; `updateByUser()` chỉ khi `needs_info`; **fix bảo mật** — `storageKey` attachment không còn lộ ra API |
| **7** | `Feedback` | ✅ Hoàn thành | `feedback.entity.ts` 0 → ~300 dòng (mới); gỡ 2 bản `checkReason()` copy-paste; `assertReasonForLabel` đổi từ `Error` trần → `ValidationError` |

### 7.4. Lát cắt 2 — `Project` (chi tiết)

**File đã đổi:**

| Nhóm | File |
|---|---|
| Domain | `domain/entities/project.entity.ts` (mới), `domain/ports/project.repository.port.ts`, `domain/ports/project.access.port.ts`, `domain/value-objects/project-role.vo.ts` |
| Application | 10 command handler + 6 query handler (chuyển `*Record` → `Project`) |
| Infrastructure | `persistence/project.mapper.ts` (mới), `persistence/projects.repository.ts`, `adapters/project-access.adapter.ts` |
| Presentation | `controllers/projects.controller.ts`, `responses/project.response.ts` (mới) |

**Invariant được gom về entity** (trước đây rải rác trong handler):

| Invariant | Nguồn đặc tả |
|---|---|
| Luôn đúng **1 Owner** trong `members` | PROJ-11 |
| Không xoá được Owner | PROJ-11 |
| Không đổi vai trò Owner (phải nhượng quyền) | PROJ-10/PROJ-11 |
| Nhượng quyền nguyên tử: owner cũ → `member`, owner mới → `owner` | PROJ-11 |
| `status` suy ra từ `hasDataset` (`not_started` ↔ `in_progress`) | Phần 2 v11 §3.36.1 |
| Chỉ `in_progress` mới `markCompleted()` | PROJ-12 |
| Tên ≤ 100 ký tự, mô tả ≤ 500 ký tự | PROJ-04 |

**Hai điểm đáng chú ý phát hiện trong lúc làm:**

1. **`canAccessProject()` thiếu 2 trường hợp hợp lệ.** VO ban đầu chỉ cho phép
   `workspaceRole === 'owner'` hoặc `projectRole ∈ {owner, member}` — bỏ sót:
   - `PROJ-VIEWER` (chỉ-đọc) — CASL mục 4c cấp `Action.Read` cho `Project`.
   - `WS-MEMBER` — đặc tả `WS-07`: thành viên workspace *"mặc định là `PROJ-VIEWER`
     trong mọi project"*; CASL mục 3c cũng cấp `Action.Read` cho `Project`.
   → Đã sửa VO + bổ sung test khoá hành vi này.

2. **`BaseEntity.toObject()` là bắt buộc, không phải tuỳ chọn.** CASL `buildSubject()`
   dùng `typeof data.toObject === 'function'` để nhận diện entity → nếu thiếu, guard sẽ
   mất `id`/`workspace_id` khi kiểm tra quyền động qua `@PolicyResource` → **IDOR**.

### 7.6. Lát cắt 3 — `Dataset` (chi tiết)

**File đã đổi:**

| Nhóm | File |
|---|---|
| Domain | `domain/entities/dataset.entity.ts` (viết lại), `domain/ports/dataset.repository.port.ts` |
| Application | 5 command handler + 4 query handler, `services/schema-inference.service.ts` |
| Infrastructure | `persistence/dataset.mapper.ts` (thêm `toDatasetEntity()`), `persistence/datasets.repository.ts` |
| Presentation | `controllers/datasets.controller.ts`, `responses/dataset.response.ts` (mới) |

**Invariant được gom về entity:**

| Invariant | Nguồn đặc tả |
|---|---|
| Chỉ `.csv` | M28/O34 — §3.25 |
| ≤ 50 MB | §3.26 |
| ≤ 1000 cột | §3.31.2 |
| Phải có header | §3.25 |
| Key cột `c{i}` **ổn định theo vị trí** | S21/M14 |
| Tên hiển thị không rỗng, không trùng nhau | UC-10 |
| Tên dataset ≤ 100 ký tự | F4.4 |
| Vòng đời `INGESTING` → `READY` \| `FAILED` | F4.1 |
| Dataset có lỗi tên cột → **chưa được phân tích** | §3.25 |

**Điểm đáng chú ý:**

1. **`storageKey` (S14) chuyển tầng trách nhiệm.** Trước đây `GetDatasetByIdHandler`
   tự cắt field bằng destructuring (`const { storageKey: _sk, ...safe } = dataset`) —
   dễ sót. Nay mapper `toDatasetResponse()` ở presentation chịu trách nhiệm loại bỏ
   → **không thể quên** vì chỉ có một đường ra HTTP.

2. **Test S14 được chuyển sang kiểm tra đúng tầng.** Test cũ assert handler
   không trả `storageKey`; nay assert **mapper response** không chứa `storageKey`
   (handler/entity giữ trọn thông tin nội bộ — đúng mô hình Clean Architecture).

3. **`renameColumns()` chặn trùng tên ở tầng domain.** Trước đây handler chỉ
   *phát hiện* trùng tên sau khi đổi (ghi vào `columnIssues`) mà vẫn cho phép lưu.
   Nay entity **từ chối** ngay (`ConflictError`) — hành vi chặt hơn, đúng tinh thần
   "domain kiểm tra nghiệp vụ, DTO chỉ kiểm tra định dạng".

### 7.7. Báo cáo kiểm chứng (sau Lát cắt 3)

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Type check | `pnpm run type-check` | ✅ **0 lỗi** |
| Lint | `pnpm run lint` | ✅ **0 cảnh báo** (`--max-warnings 0`) |
| Unit test | `npx jest --runInBand` | ✅ **432/432 pass** (31 suite) |
| Architecture test | `pnpm run test:arch` | ✅ **17/17 pass** (CA1–CA20) |
| DI graph | `pnpm run arch:verify-di` | ✅ AppModule resolve thành công |

### 7.8. Lát cắt 4 — `User` / `UserSession` (chi tiết)

**File đã đổi:**

| Nhóm | File |
|---|---|
| Domain | `domain/entities/user.entity.ts` (viết lại), `domain/entities/user-session.entity.ts` (viết lại), `domain/ports/user.repository.port.ts` (port trả entity) |
| Application | 9 command handler + 6 query handler |
| Infrastructure | `persistence/user.mapper.ts` (mới), `persistence/users.repository.ts` |
| Presentation | `controllers/users.controller.ts`, `controllers/admin-users.controller.ts`, `responses/user.response.ts` (mới) |
| Cross-module | `auth/infrastructure/security/users-auth-lookup.adapter.ts`, `users-auth-session.adapter.ts` |

**Invariant được gom về entity:**

| Invariant | Nguồn đặc tả |
|---|---|
| Email chuẩn hoá (lowercase + trim) | G1, F4.2 |
| Email mới phải khác email cũ | G1 |
| Tên/họ không rỗng, ≤ 50 ký tự | `UserSchema` |
| Giới thiệu ≤ 500 ký tự | `UserSchema` |
| Chỉ `active` + chưa xoá mới đăng nhập được | `canUserLogin()` |
| Khoá tài khoản đã khoá → `ConflictError` | §3.34 |
| Xoá mềm 2 lần → `ConflictError` | F4.4 |
| Xoá mềm → chặn đăng nhập | F4.4 |
| Phiên: hạn 7 ngày / 30 ngày (remember-me) | `session-policy.vo.ts` |
| Phiên: `isActive()` = chưa thu hồi **và** chưa hết hạn | AUTH-08 |
| Phiên: thu hồi 2 lần → `ConflictError` | AUTH-09 |

**Điểm đáng chú ý:**

1. **`toSafeProfile()` bị loại bỏ khỏi `admin-users.controller.ts`.** Trước đây controller
   tự cắt `passwordHash` / `googleId` bằng destructuring — dễ sót khi thêm field.
   Nay mapper `toUserResponse()` là **đường ra HTTP duy nhất** → không thể quên.

2. **Entity có `props` riêng tư ⇒ `JSON.stringify(entity)` ra `{}`.** Đây là lý do
   bắt buộc có tầng `presentation/responses/*` cho mọi aggregate (đã áp dụng cho
   `Dataset` ở Lát cắt 3 và `User` ở Lát cắt 4).

3. **Adapter `auth` giữ nguyên hợp đồng phẳng.** `AuthUserLookup` / `AuthSessionRecord`
   vẫn là interface trần → tầng `auth` **không** phụ thuộc cấu trúc entity.
   Adapter là nơi dịch entity → shape phẳng.

4. **Dọn 3 khối `as unknown as {...}`** trong `forgot-password.handler.ts`,
   `reset-password.handler.ts`, `refresh-access-token.handler.ts` — port đã khai
   báo đủ method nên ép kiểu là thừa (và che lỗi type thật).

### 7.9. Báo cáo kiểm chứng (sau Lát cắt 4)

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Type check | `pnpm run type-check` | ✅ **0 lỗi** |
| Lint | `pnpm run lint` | ✅ **0 cảnh báo** (`--max-warnings 0`) |
| Unit test | `npx jest --runInBand` | ✅ **483/483 pass** (33 suite) |
| Architecture test | `pnpm run test:arch` | ✅ **17/17 pass** (CA1–CA20) |
| DI graph | `pnpm run arch:verify-di` | ✅ AppModule resolve thành công |

> **Test mới:** `test/user-entity.spec.ts` (30 test) + `test/user-session-entity.spec.ts` (21 test).

### 7.10. Lát cắt 5 — `Notification` (chi tiết)

**File đã đổi:**

| Nhóm | File |
|---|---|
| Domain | `domain/entities/notification.entity.ts` (viết lại), `domain/ports/notification.repository.port.ts` |
| Application | `commands/dispatch.handler.ts`, `commands/mark-as-read.handler.ts`, `queries/get-detail.handler.ts`, `queries/list-for-user.handler.ts`, `notifications.utils.ts` |
| Infrastructure | `persistence/notification.mapper.ts`, `persistence/notifications.repository.ts` |

**Invariant được gom về entity:**

| Invariant | Nguồn đặc tả |
|---|---|
| `type` phải nằm trong `NOTIFICATION_TYPES` | `NotificationSchema` enum |
| `title` không rỗng, ≤ 200 ký tự | `NotificationSchema` |
| `summary` ≤ 500 ký tự | `NotificationSchema` |
| Loại bắt buộc (`issue_needs_info`, `security_alert`) → `isMandatory` | §3.5.5 |
| Thông báo bắt buộc luôn gửi (bất kể công tắc) | §3.5.5 quy tắc 4 |
| Đánh dấu đã đọc 2 lần → `ConflictError` | NOTIF-02 |

**Điểm đáng chú ý:**

1. **`markAsRead()` bảo vệ invariant "đọc 1 lần" ở entity, nhưng endpoint
   `PATCH /notifications/:id/read` vẫn phải idempotent.** Handler kiểm tra
   `existing.isRead()` trước → đã đọc thì trả về luôn, chỉ gọi
   `markAsRead()` khi chưa đọc. Đây là ví dụ rõ ràng về việc **invariant ở
   domain, nhưng use-case vẫn quyết định hành vi nghiệp vụ** (Bước 4).

2. **Loại bỏ trùng lặp logic cắt chuỗi.** Trước đây `dispatch.handler.ts` cắt
   title/summary *và* `notification.mapper.ts` cắt lần nữa. Nay entity cắt
   một lần (`Notification.assertTitle/assertSummary`), mapper chỉ map thẳng.

3. **Sinh id ở tầng application, không phụ thuộc Mongoose.** Thêm helper
   `newObjectIdHex()` vào `shared/domain/utils/object-id.util.ts` — dùng chung
   cho `Notification` và `UserSession`.

### 7.11. Báo cáo kiểm chứng (sau Lát cắt 5)

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Type check | `pnpm run type-check` | ✅ **0 lỗi** |
| Lint | `pnpm run lint` | ✅ **0 cảnh báo** (`--max-warnings 0`) |
| Unit test | `npx jest --runInBand` | ✅ **500/500 pass** (34 suite) |
| Architecture test | `pnpm run test:arch` | ✅ **17/17 pass** (CA1–CA20) |
| DI graph | `pnpm run arch:verify-di` | ✅ AppModule resolve thành công |

> **Test mới:** `test/notification-entity.spec.ts` (17 test).

### 7.12. Lát cắt 6 — `IssueReport` (chi tiết)

**File đã đổi:**

| Nhóm | File |
|---|---|
| Domain | `domain/entities/issue-report.entity.ts` (viết lại), `domain/ports/issue-report.repository.port.ts` |
| Application | `commands/create-report.handler.ts`, `commands/update-status.handler.ts`, `commands/update-my-report.handler.ts`, `queries/download-attachment.handler.ts`, `queries/list-*.handler.ts`, `issues.utils.ts` |
| Infrastructure | `persistence/issue.mapper.ts`, `persistence/issues.repository.ts` |

**Invariant được gom về entity:**

| Invariant | Nguồn đặc tả |
|---|---|
| `issueType` hợp lệ (5 loại) | `IssueReportSchema` enum |
| `title` không rỗng, ≤ 200 ký tự | `IssueReportSchema` |
| `description` ≤ 5000 ký tự | `IssueReportSchema` |
| Luồng chuyển trạng thái hợp lệ (8 transition) | `issue-status.vo.ts` |
| Báo cáo đã `closed` không chuyển được | `ALLOWED_ISSUE_TRANSITIONS.closed = []` |
| Chỉ `needs_info` mới tự sửa được | `USER_EDITABLE_ISSUE_STATUSES` |
| Sửa xong → quay về `in_progress` | luồng "gửi lại sau khi bổ sung" |
| Tệp đính kèm ≤ 10 MB, tên ≤ 255 ký tự | `IssueAttachmentSchema` |
| Chỉ gỡ được tệp thuộc báo cáo | handler `update-my-report` |

**Điểm đáng chú ý:**

1. **Fix bảo mật quan trọng — `storageKey` attachment bị lộ ra API.** Mapper cũ
   trả nguyên object attachment (`...a`) → `storageKey` (đường dẫn R2) nằm
   trong response JSON. Nay `toResponse()` chỉ trả `id`, `filename`,
   `sizeBytes`, `contentType` + `downloadUrl`. Tương tự S14 của `Dataset`.

2. **`assertAllowedIssueTransition` ném `Error` trần** → `transitionTo()` bọc lại
   thành `ValidationError`. Đây là ví dụ "domain error, không phải error thường".

3. **`removeAttachments()` trả về `storageKey[]`** để handler dọn file R2
   (best-effort) — entity biết cái gì cần dọn, handler lo phần I/O.

### 7.13. Lát cắt 7 — `Feedback` (chi tiết)

**File đã đổi:**

| Nhóm | File |
|---|---|
| Domain | `domain/entities/feedback.entity.ts` (**mới**), `domain/ports/feedback.repository.port.ts` |
| Application | `commands/create-finding-feedback.handler.ts`, `commands/update-mine.handler.ts`, `commands/create-run-feedback.handler.ts`, `queries/list-*.handler.ts`, `feedback.utils.ts` |
| Infrastructure | `persistence/feedback.mapper.ts`, `persistence/feedback.repository.ts` |

**Invariant được gom về entity:**

| Invariant | Nguồn đặc tả |
|---|---|
| `label` hợp lệ (5 nhãn) | `FindingFeedbackSchema` enum |
| Nhãn `false_positive`/`missed_issue`/`other` **bắt buộc** có `reason` | `LABELS_REQUIRING_REASON` |
| `reason` ≤ 2000 ký tự | `FindingFeedbackSchema` |
| `aiRationale` ≤ 1000 ký tự | `FindingFeedbackSchema` |
| `findingId` ≤ 200 ký tự | FB-01 |
| Chỉ tác giả được sửa | FB-05 |

**Điểm đáng chú ý:**

1. **Loại bỏ 2 bản `checkReason()` copy-paste.** `create-finding-feedback.handler.ts`
   và `update-mine.handler.ts` đều có một bản riêng — dễ lệch khi sửa. Nay
   entity là nguồn sự thật duy nhất.

2. **`assertReasonForLabel` ném `Error` trần** (không phải `DomainError`) → đã
   thay bằng `ValidationError` trong entity.

3. **`aiConfidence` / `aiRationale` là dữ liệu hệ thống** — `updateByAuthor()`
   **không** cho sửa 2 field này (chỉ tác giả sửa label/reason/severity).

### 7.14. Báo cáo kiểm chứng (sau Lát cắt 7 — hoàn thành Bước 3)

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Type check | `pnpm run type-check` | ✅ **0 lỗi** |
| Lint | `pnpm run lint` | ✅ **0 cảnh báo** (`--max-warnings 0`) |
| Unit test | `npx jest --runInBand` | ✅ **546/546 pass** (36 suite) |
| Architecture test | `pnpm run test:arch` | ✅ **17/17 pass** (CA1–CA20) |
| DI graph | `pnpm run arch:verify-di` | ✅ AppModule resolve thành công |

**Tổng kết Bước 3 (Rich Domain Model):**

| Lát cắt | Entity | Test |
|---|---|---|
| 0 | `BaseEntity` + `DomainEvent` | (nền tảng) |
| 1 | `Workspace` | ✅ |
| 2 | `Project` | ✅ |
| 3 | `Dataset` | 29 test |
| 4 | `User` + `UserSession` | 30 + 21 test |
| 5 | `Notification` | 17 test |
| 6 | `IssueReport` | 26 test |
| 7 | `Feedback` | 20 test |

**Test count:** 403 (trước Bước 3) → **546** (+143).

### 7.15. Kế hoạch Bước 4 — Application Services → Use Cases

Bước 3 đã xong. Bước 4 tiếp tục thay `Service` cũ bằng **use case** (đã
triển khai phần lớn ở Bước 5 trước đó — cần đánh giá lại phần còn lại):

1. Rà soát các module còn `Service` cũ chưa được thay bằng Command/Query.
2. Bổ sung `application/use-cases/` cho các luồng đa-bước.
3. Bổ sung port cho external service chưa có adapter.

### 7.16. Đợt rà soát API — 2026-11-18 (ngoài lộ trình 4 bước)

**Động cơ.** Rà soát toàn bộ API theo yêu cầu "hoàn thiện các API" — đối chiếu mã nguồn
với `2_feature_catalog_v11.md` và `7_api_contracts_v8.md`.

**Kết quả đối chiếu route: 100%.** 86 route trong hợp đồng §3.13 ↔ 86 route trong mã nguồn,
khớp 1-1 về method + path. Không có endpoint chết (`NotImplementedException`) và không có
`TODO`/`FIXME` trong `src/`.

**Công cụ kiểm tra tự động** (đặt trong repo để chặn hồi quy):

| Script | Chức năng |
|---|---|
| `src/backend/scripts/check-api-coverage.cjs` | Đối chiếu route trong `*.controller.ts` với bảng §3.13 của hợp đồng → báo cáo thiếu/thừa |
| `src/backend/scripts/extract-routes.cjs` | Liệt kê toàn bộ route kèm `summary` của `@ApiOperation` |

**Phát hiện & xử lý:**

| Mã | Vấn đề | Trạng thái |
|---|---|---|
| **P1** | `GET /auth/google/callback` luôn trả 401 — thiếu `cookie-parser` ⇒ `req.cookies` là `undefined` ⇒ `expectedState = ''` ⇒ mọi callback hợp lệ bị từ chối | ✅ **Đã sửa 2026-11-18** |
| P2 | Hợp đồng §3.5 quy định `GET /auth/sessions/me` nhưng mã nguồn không có route này | ⬜ Chờ quyết định (thêm route hay sửa hợp đồng) |
| P3 | `GET /admin/users` dùng `page`/`limit`/`total`, không theo `sortBy`/`sortOrder` như §3.4 | ⬜ Chờ |
| P4 | `/workspaces` + `/projects` dùng tham số `sort` thay vì `sortBy`/`sortOrder` (lệch **đã biết**, §3.5b tự ghi nhận) | ⬜ Chờ — đề xuất cập nhật §3.4 ghi rõ ngoại lệ |
| P5 | Bảng §3.4 ghi `GET /issues` (Admin) nhưng route thật là `GET /admin/issues` | ⬜ Chờ — chỉ lệch tên trong tài liệu |

**Chi tiết P1 — thay đổi đã thực hiện:**

| # | Thay đổi | File |
|---|---|---|
| 1 | Thêm dependency `cookie-parser` + `@types/cookie-parser` | `package.json` |
| 2 | `app.use(cookieParser())` — bước 3, trước CORS và Global Prefix | `src/main.ts` |
| 3 | Cookie `google_oauth_state` set với `path: '/'` rõ ràng | `modules/auth/presentation/controllers/auth.controller.ts` |
| 4 | Helper `clearGoogleStateCookie()` — `clearCookie` dùng **cùng** thuộc tính với lúc set (`path`, `httpOnly`, `secure`, `sameSite`) | cùng file |
| 5 | Cookie được xoá ở **mọi** nhánh: happy path · `error=` từ Google · exception từ handler (trước đây chỉ clear ở happy path) | cùng file |
| 6 | Test E2E mới — 6 test vòng đời cookie + 3 test regression (kèm **guard** đọc source `main.ts`) | `test/e2e/security/google-oauth-cookie.e2e-spec.ts`, `test/e2e/security/cookie-parser-regression.e2e-spec.ts` |
| 7 | Ghi chú vận hành (cookie, `trust proxy`, checklist lỗi 401) | `.env.example` |
| 8 | Cập nhật hợp đồng §3.4 (thuộc tính cookie + yêu cầu middleware) | `7_api_contracts_v8.md` |

**Kiểm chứng sau P1:**

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Type check | `pnpm run type-check` | ✅ **0 lỗi** |
| Lint | `pnpm run lint` | ✅ **0 cảnh báo** (`--max-warnings 0`) |
| Unit test | `npx jest --runInBand` | ✅ **546/546 pass** (36 suite) |
| E2E test | `pnpm run test:e2e` | ✅ **64/64 pass** (5 suite) — *trước: 58/58 (4 suite)* |
| Architecture test | `pnpm run test:arch` | ✅ **17/17 pass** (CA1–CA20) |
| DI graph | `pnpm run arch:verify-di` | ✅ AppModule resolve thành công |
| Route coverage | `node scripts/check-api-coverage.cjs` | ✅ **86/86 — thiếu 0, thừa 0** |

**Báo cáo đầy đủ:** `docs/restructures/17_api_gap_analysis_v1.md`.
