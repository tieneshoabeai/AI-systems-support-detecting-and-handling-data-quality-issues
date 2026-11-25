---
title: "Công nghệ sẽ áp dụng cho dự án sau khi tái cấu trúc"
subtitle: "Data Quality Platform — Tái sử dụng triển khai công nghệ từ dự án cũ"
version: v4.0
date: 2026-11-07
status: "Đã chốt"
---

# 1. Mục tiêu và phạm vi

Tài liệu này mô tả **toàn bộ công nghệ sẽ áp dụng cho dự án Data Quality Platform sau khi tái cấu trúc**, kèm theo định hướng **tái sử dụng triển khai công nghệ từ dự án cũ**.

Mục tiêu tài liệu:

1. Chốt bộ công nghệ của dự án mới — công nghệ nào, phiên bản nào, dùng để làm gì.
2. Chỉ rõ **thành phần nào tái sử dụng nguyên vẹn**, **thành phần nào phải viết lại**, **thành phần nào bị loại bỏ**.
3. Ghi nhận **một thay đổi đặc biệt**: hàm băm hash chuyển từ SHA-256 sang **SHA-512**.
4. Nêu rõ tác động, phương án migration và điều kiện nghiệm thu.

**Các quyết định đảo ngược trong v2 (2026-11-05):**

| # | Vốn là (v1) | Nay là (v2) | Lý do |
|---|---|---|---|
| 1 | Google Gemini API (AI bên ngoài) | **AI cục bộ** — vLLM/Ollama + 5 model ứng viên benchmark (Qwen3-14B / Gemma-3-12B / Qwen3-8B / Llama-3.1-8B / Vistral-7B) | Dữ liệu người dùng không được rời hệ thống; model chốt theo số liệu đo |
| 2 | BullMQ + Redis (1 hàng đợi) | **Kafka** (KRaft, 5 topic, DLQ) | Cần replay, DLQ, nhiều consumer group, độ bền trên disk |
| 3 | Offset pagination `{ items, meta }` | **Cursor (keyset)** `{ items, nextCursor, hasMore }` | Truy vấn ổn định, không cần `countDocuments` |
| 4 | Hỗ trợ CSV **và** Excel (có `dataset_sheet`) | **Chỉ `.csv`** | Giảm phụ thuộc, bỏ khái niệm sheet, đơn giản hoá mô hình |
| 5 | Không có phản hồi người dùng lên AI | **Vòng lặp Human-in-the-Loop** (RAG T1) | AI học lại từ phản hồi thật của người dùng |
| 6 | Không có realtime | **Socket.IO** đẩy thông báo/tiến độ tới client | Trải nghiệm phân tích không phải chờ polling |

Phạm vi: backend Node.js/TypeScript. `packages/contracts` là hợp đồng dữ liệu dùng chung với frontend.

---

# 2. Quyết định trọng tâm: băm hash SHA-256 → SHA-512

## 2.1. Nội dung quyết định

| Hạng mục | Dự án cũ | Dự án mới |
|---|---|---|
| Thuật toán băm hash | SHA-256 | **SHA-512** |
| Mật khẩu người dùng | bcrypt, 12 rounds | **bcrypt, 12 rounds — không đổi** |
| Mã hoá tệp | AES-256-GCM + PBKDF2-SHA512 | **không đổi** |

Quyết định này áp dụng **toàn bộ các vị trí đang dùng SHA-256** trong dự án cũ.

## 2.2. Danh sách đầy đủ các vị trí bị ảnh hưởng

Đã đối chiếu trực tiếp mã nguồn dự án cũ:

| # | Mục đích | Vị trí trong dự án cũ | Kết quả mong đợi |
|---|---|---|---|
| 1 | Checksum tệp nạp lên | `src/modules/datasets/datasets.service.ts` — `computeSha256Stream` | 128 hex chars |
| 2 | Checksum tệp export | `src/modules/exports/exports.service.ts` — `crypto.createHash('sha256')` | 128 hex chars |
| 3 | `data_checksum` của phiên bản dataset | `src/modules/versions/versions.service.ts` — hash luồng | 128 hex chars |
| 4 | `rules_hash` | `src/modules/versions/versions.service.ts` — `JSON.stringify(ruleIds)` đã sort | 128 hex chars |
| 5 | `version_hash` (Merkle root) | `src/modules/versions/versions.service.ts` — `SHA256(data_checksum + parent_hash + rules_hash)` | 128 hex chars |
| 6 | Đối soát chuỰ hash lineage | `src/modules/lineage/lineage.service.ts` — `crypto.createHash('sha256')` | 128 hex chars |
| 7 | `refresh_token_hash` | `src/modules/users/users.service.ts` | 128 hex chars |
| 8 | `password_reset_token_hash` | `src/modules/users/schemas/user.schema.ts` | 128 hex chars |

Hàm tiện ích dùng chung: `src/shared/crypto/crypto.util.ts` — `computeSha256Buffer()` và `computeSha256Stream()`.

**Không thuộc phạm vi thay đổi:**

| Hạng mục | Thuật toán | Lý do giữ nguyên |
|---|---|---|
| Mật khẩu người dùng | bcrypt, 12 rounds | Quyết định riêng — không đổi, giảm rủi ro migration |
| Mã hoá tệp tại rest | AES-256-GCM | Mã hoá xác thực, không phải băm |
| Dẫn xuất khóa | PBKDF2-SHA512, 100 000 vòng | Đã là SHA-512 họ |

## 2.3. Lý do lựa chọn

| Lý do | Giải thích |
|---|---|
| An toàn biên độ lớn hơn | SHA-512 cho output 512 bit so với 256 bit — biên an toàn lớn hơn cho thuật toán băm đã được phân tích nhiều nhất |
| Họ thuật toán không đổi | SHA-2 → SHA-2: cùng cấu trúc Merkle, cùng cách tính streaming, cùng hành vi xác định (deterministic) |
| Tương thích Node.js native | `crypto.createHash('sha512')` có sẵn trong module `crypto` — **không thêm dependency** |
| Rủi ro migration thấp | Cùng họ thuật toán, cùng cách ghép chuỗi, cùng định dạng hex — chỉ đổi độ dài chuỗi hash |
| Tương thích ngược hoàn toàn | Giá trị cũ (64 hex chars) vẫn đọc được; hệ thống nhận diện độ dài để phân biệt |

## 2.4. Tác động kỹ thuật

### 2.4.1. Độ dài chuỗi hash thay đổi

| Thuật toán | Độ dài hex | Độ dài byte |
|---|---|---|
| SHA-256 | 64 ký tự | 32 byte |
| **SHA-512** | **128 ký tự** | **64 byte** |

### 2.4.2. Điểm cần sửa trong schema

Các trường lưu hash phải đổi validate từ `maxlength: 64` sang `maxlength: 128`:

| Collection | Trường |
|---|---|
| `dataset_version` | `version_hash`, `parent_hash`, `rules_hash`, `data_checksum` |
| `user_session` | `refresh_token_hash` |
| `user` | `password_reset_token_hash` |
| `outbox_event` | `payload` (chứa hash) |

Hai trường đặc biệt cần chú ý:

- `parent_hash` của phiên bản đầu tiên hiện là `'0'.repeat(64)` → phải đổi thành `'0'.repeat(128)`.
- Kiểm tra "chain break" của lineage hiện so sánh `parent_hash.substring(0, 8)` với `version_hash` — giữ nguyên logic, chỉ đổi độ dài chuỗi gốc.

### 2.4.3. Tác động lên cấu trúc Merkle

Công thức giữ nguyên, chỉ đổi hàm băm:

$$
\text{version\_hash}_N = \text{SHA512}\!\left(\text{data\_checksum}_N \,\|\, \text{parent\_hash}_N \,\|\, \text{rules\_hash}_N\right)
$$

Dùng ký tự phân tách `|` thay vì nối trực tiếp chuỗi — tránh va chạm ranh giới (boundary collision) khi độ dài hash thay đổi. Đây là cải tiến nhỏ nhưng đúng đắn, và **làm thay đổi toàn bộ giá trị hash cũ** — phù hợp với phương án buộc reset đã chốt.

### 2.4.4. Tác động lên hiệu năng

SHA-512 chậm hơn SHA-256 khoảng 30–50% trên CPU hiện đại. Đánh giá tác động:

| Tác vụ | Quy mô | Tác động |
|---|---|---|
| Checksum tệp nạp lên | 100 MB | +150–300 ms — chấp nhận được, chạy streaming không nạp vào RAM |
| Checksum tệp export | 100 MB | +150–300 ms |
| `rules_hash` (danh sách rule) | Vài KB | Không đáng kể |
| `version_hash` | 1 chuỗi | Không đáng kể |
| Băm refresh token | 32 byte | Không đáng kể |

**Kết luận:** không có thay đổi kiến trúc nào cần thiết để đáp ứng SHA-512. Không cần thêm worker chuyên dụng cho hashing.

### 2.4.5. Tác động lên hợp đồng API

`data_checksum`, `version_hash`, `parent_hash`, `rules_hash` là trường **có trả về trong response API**. Do độ dài chuỗi thay đổi (64 → 128 ký tự), hợp đồng API thay đổi theo.

Xử lý: trường trong DTO giữ kiểu `string` kèm ràng buộc `max(128)`; ví dụ JSON trả về thay đổi về độ dài — client phải đọc theo schema, không hard-code độ dài. Đây là thay đổi **phá vỡ** (breaking) có kiểm soát, được ghi nhận trong bảng hợp đồng.

## 2.5. Phương án migration

Quyết định đã chốt: **buộc reset mật khẩu toàn bộ người dùng** khi chuyển đổi — không rehash-on-login, không ghi song song hai cột hash.

### 2.5.1. Ba nhóm dữ liệu bị ảnh hưởng

| Nhóm | Xử lý | Lý do |
|---|---|---|
| **Mật khẩu người dùng** | Buộc reset — gửi email reset mật khẩu cho tất cả tài khoản | Đã chốt không đổi bcrypt, nhưng yêu cầu "toàn bộ cái mã hoá đều bị thay đổi" áp dụng cho hash mật khẩu → không tương thích ngược |
| **Refresh token / reset token** | Vô hiệu hoá toàn bộ phiên đăng nhập hiện có; người dùng đăng nhập lại | Hash tính bằng thuật toán cũ không verify được bằng thuật toán mới |
| **Checksum phiên bản / lineage** | Tính lại toàn bộ checksum và `version_hash`; `parent_hash` đầu tiên đổi sang `'0'.repeat(128)` | Giá trị cũ không còn ý nghĩa khi đã đổi thuật toán và công thức |

### 2.5.2. Trình tự thực hiện

| Bước | Hành động | Điều kiện |
|---|---|---|
| 1 | Triển khai adapter hash mới (`Sha512Hasher`) phía sau interface `HashingPort` | Code mới đã sẵn sàng |
| 2 | Viết script migration tính lại checksum + `version_hash` cho toàn bộ dataset version | Script chạy `--dry-run` thành công |
| 3 | Chạy `--apply` cho tính lại hash trong DB | Không có lỗi dữ liệu |
| 4 | Xoá toàn bộ `user_session` | — |
| 5 | Đặt cờ `force_password_reset = true` cho mọi user | — |
| 6 | Gửi email reset mật khẩu hàng loạt (qua job hàng đợi) | SMTP + template email đã sẵn sàng |
| 7 | Đổi cờ `legacy_hash_enabled` sang `false` | Tất cả client đã lên phiên bản mới |
| 8 | Xoá nhánh code hash cũ (SHA-256) sau khi xác nhận không còn client nào dùng | Đã qua 7 ngày vận hành ổn định |

### 2.5.3. Cơ chế an toàn cho giai đoạn lao song

Trong giai đoạn lao song (hệ thống cũ và mới cùng chạy), adapter hash của hệ thống mới phải **verify được cả hai định dạng**:

```typescript
export interface HashingPort {
  hash(data: Buffer | string): string;
  verify(data: Buffer | string, storedHash: string): boolean;
}

export class Sha512Hasher implements HashingPort {
  hash(data: Buffer | string): string {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  verify(data: Buffer | string, storedHash: string): boolean {
    // hash moi: 128 hex chars
    if (storedHash.length === 128) {
      return timingSafeEqualHex(this.hash(data), storedHash);
    }
    // hash cu: 64 hex chars — chi dung trong giai doan lao song
    if (storedHash.length === 64) {
      return timingSafeEqualHex(
        crypto.createHash('sha256').update(data).digest('hex'),
        storedHash,
      );
    }
    return false;
  }
}
```

Bắt buộc so sánh bằng `crypto.timingSafeEqual` — tránh rò rỉ thông tin qua thời gian thực thi.

### 2.5.4. Điều kiện nghiệm thu phần hash

1. Không còn lời gọi `createHash('sha256')` nào trong mã nguồn dự án mới — kiểm chứng bằng script quét mã nguồn.
2. Tất cả trường hash trong schema có ràng buộc `max(128)`.
3. `parent_hash` khởi tạo bằng `'0'.repeat(128)`.
4. Script migration chạy `--dry-run` và `--verify` cho kết quả khớp 100%.
5. `verify()` chấp nhận cả định dạng 64 và 128 ký tự trong giai đoạn lao song; sau khi tắt cờ chỉ còn 128.
6. Test đảm bảo hash SHA-512 của dữ liệu rỗng khớp giá trị vector kiểm thử chuẩn.

---

# 3. Nguyên tắc công nghệ của dự án mới

| # | Nguyên tắc | Thể hiện |
|---|---|---|
| 1 | Đơn giản trước mạnh mẽ | Modular monolith thay vì microservices; Kafka single-node thay vì cụm broker |
| 2 | Cô lập bằng port | Mọi dịch vụ bên ngoài đi qua port; không import SDK ở domain/application |
| 3 | Tái sử dụng có kiểm soát | Giữ nguyên thuật toán, hàm, cấu trúc đã kiểm chứng — chỉ đổi chỗ, không viết lại |
| 4 | Không sao chép stack | Mỗi công nghệ có lý do lựa chọn riêng |
| 5 | Cấu hình an toàn | Zod validate lúc khởi động; thiếu credential chỉ log cảnh báo |
| 6 | Kiểm thử được | Domain test thuần Node; AI luôn mock |
| 7 | **Dữ liệu không rời hệ thống** | AI suy luận cục bộ (vLLM/Ollama); không SDK AI bên ngoài; `ai-engine` không egress |
| 8 | **Một bus sự kiện duy nhất** | Kafka làm cả event bus, hàng đợi nền và DLQ — không thêm broker khác |
| 9 | Observability tối giản | Log JSON + health endpoint, không Prometheus/Grafana |
| 10 | Người dùng là nguồn chất lượng | Phản hồi append-only + RAG few-shot động để học lại |

---

# 4. Bảng công nghệ tổng hợp

## 4.1. Runtime, ngôn ngữ, công cụ build

| Hạng mục | Công nghệ | Phiên bản | Ghi chú |
|---|---|---|---|
| Ngôn ngữ | TypeScript | 6.x (alias `npm:@typescript/typescript6@^6.0.2`) | Biên dịch chuẩn + kiểm tra type |
| Trình biên dịch tăng tốc | TypeScript Native | 7.x (alias `npm:typescript@^7.0.2`) | Kiểm tra type tức thì khi lập trình |
| Runtime | Node.js | 22 LTS | — |
| Quản lý gói | pnpm | 11.3.0 | **Workspaces** — mỗi package `node_modules` riêng |
| Test runner | Jest | 30.x | + ts-jest |
| Test HTTP | Supertest | — | E2E gọi HTTP thật |
| Test hiệu năng | k6 | — | Smoke + stress trước release |
| Lint / format | ESLint + Prettier | — | + `eslint-plugin-boundaries` cho ranh giới tầng |

## 4.2. Framework và kiến trúc

| Hạng mục | Công nghệ | Ghi chú |
|---|---|---|
| Framework | NestJS | 11.x |
| Kiến trúc | Modular Monolith + Ports & Adapters (Hexagonal) | Ranh giới phụ thuộc: `infrastructure → application → domain` |
| Hợp đồng API | Zod | 3.23.x — nguồn sự thật cho validation |
| Sinh OpenAPI | zod-to-json-schema | Sinh `openapi.json` từ `packages/contracts` |
| DI token | `Symbol` | Bắt buộc cho interface (không tồn tại ở runtime) |

## 4.3. Dữ liệu và lưu trữ

| Hạng mục | Công nghệ | Ghi chú |
|---|---|---|
| Cơ sở dữ liệu chính | MongoDB Atlas | M0 (dev) / M10 (prod) — **bắt buộc replica set** |
| ODM | Mongoose | 9.x |
| Lưu trữ đối tượng | Cloudflare R2 | S3 API — egress $0, bucket không public |
| Fallback lưu trữ | LocalStorageAdapter | Khi `STORAGE_DRIVER=local` |
| Băm hash | **SHA-512** | Thay SHA-256 — xem mục 2 |
| Mã hoá tệp | AES-256-GCM + PBKDF2-SHA512 | Không đổi |
| Mật khẩu | bcrypt, 12 rounds | Không đổi |

## 4.4. Hàng đợi và tích hợp

| Hạng mục | Công nghệ | Ghi chú |
|---|---|---|
| Bus sự kiện & hàng đợi | **Kafka 3.7 (KRaft single-node)** | 5 topic: `domain.events`, `ai.jobs`, `notification.dispatch`, `realtime.push`, `dlq.dead-letter` |
| Dead-letter | Topic `dlq.dead-letter` | Message chết được giữ để điều tra, phát lại |
| Realtime | **Socket.IO 4.x** + Redis adapter | Gắn tại `/api/v1/realtime?token=…`; phòng `user:{id}`, `project:{id}`, `analysis:{id}` |
| Chống xử lý trùng | Inbox pattern | `processed_event` — unique `(consumer_name, event_id)` |
| Ghi outbox | Transactional Outbox | Ghi trong cùng transaction với dữ liệu |
| Relay | Change Stream + polling fallback | M0 không có replica set → cần polling |
| AI — suy luận | **vLLM** (prod) / **Ollama** (dev) | HTTP OpenAI-compatible nội bộ `:8000` / `:11434`; timeout 180s, retry 2 |
| AI — model | **5 ứng viên:** Qwen3-14B · Gemma-3-12B · Qwen3-8B · Llama-3.1-8B · Vistral-7B (Q4_K_M / QAT Q4) | Model cục bộ, CPU-only; **model chốt do benchmark quyết định** (9 chỉ số, đường Pareto) |
| AI — embedding | **Qwen3-Embedding-0.6B** | Sinh vector cho kho học lại |
| AI — học lại | RAG T1 — few-shot động | top-5 mẫu từ `feedback_example` theo cosine similarity |
| Email | SMTP | OTP, lời mời, reset mật khẩu |
| PDF | PDFKit | Sinh báo cáo |
| OAuth | Google OAuth | Tuỳ chọn — chạy được nếu không cấu hình |

## 4.5. Bảo mật và vận hành

| Hạng mục | Công nghệ | Ghi chú |
|---|---|---|
| Phân quyền | CASL | 7.x — ability-based |
| Xác thực | Passport-JWT + `@nestjs/jwt` | Access + refresh token |
| Băm mật khẩu | bcrypt | 12 rounds |
| Security header | Helmet | HSTS + CSP |
| Rate-limit | Redis-backed | Qua `RateLimiterPort` |
| Che PII | `mask-pii.ts` | Tái sử dụng nguyên vẹn |
| Triển khai | Docker Compose | VPS Ubuntu 22.04 |
| TLS | Nginx/Caddy + Cloudflare Tunnel | Không mở port VPS |
| Logging | JSON structured ra stdout | Chuẩn hoá từ console hiện tại |

---

# 5. Tái sử dụng triển khai công nghệ từ dự án cũ

Đây là phần cốt lõi của tài liệu. Mỗi thành phần được phân loại vào một trong ba nhóm:

| Nhóm | Ký hiệu | Ý nghĩa |
|---|---|---|
| **Tái sử dụng nguyên vẹn** | 🟢 | Giữ nguyên mã nguồn, chỉ di chuyển sang vị trí mới |
| **Tái sử dụng có điều chỉnh** | 🟡 | Giữ thuật toán/ý logic, đổi chữ ký hoặc vị trí |
| **Phải viết lại** | 🔴 | Không tương thích với cấu trúc domain/application/infrastructure mới |

## 5.1. Bảng tái sử dụng chi tiết

| # | Thành phần | Nguồn (dự án cũ) | Vị trí mới | Loại | Ghi chú |
|---|---|---|---|---|---|
| 1 | Băm SHA-512 buffer | `src/shared/crypto/crypto.util.ts` — `computeSha256Buffer` | `packages/core/src/hash/sha512.util.ts` | 🟡 | Đổi tên + đổi thuật toán |
| 2 | Băm SHA-512 streaming | `src/shared/crypto/crypto.util.ts` — `computeSha256Stream` | `packages/core/src/hash/sha512.util.ts` | 🟡 | Giữ nguyên cấu trúc streaming |
| 3 | Dẫn xuất khóa PBKDF2 | `src/shared/crypto/crypto.util.ts` — `deriveKeyPbkdf2` | `packages/core/src/crypto/pbkdf2.util.ts` | 🟢 | Không đổi |
| 4 | Mã hoá / giải mã AES-256-GCM | `src/shared/crypto/crypto.util.ts` — `encryptAes256GcmBuffer`, `decryptAes256GcmBuffer` | `packages/core/src/crypto/aes-gcm.util.ts` | 🟢 | Giữ nguyên định dạng gói tin |
| 5 | Transform stream mã hoá | `src/shared/crypto/crypto.util.ts` — `createAes256GcmEncryptStream` | `packages/core/src/crypto/aes-gcm.util.ts` | 🟢 | Giữ nguyên |
| 6 | Che PII | `src/shared/crypto/mask-pii.ts` — `maskPhone`, `maskEmail`, `maskCitizenId`, `maskPiiForLog`, `sanitizeObjectForLog` | `packages/core/src/pii/mask-pii.ts` | 🟢 | Tái sử dụng nguyên vẹn, dùng lại cho ranh giới AI |
| 7 | Validate biến môi trường | `src/shared/config/env.validation.ts` | `packages/config/src/env.schema.ts` | 🟡 | Bỏ `NEO4J_*`, thêm biến mới |
| 8 | Base repository MongoDB | `src/shared/database/base-mongo.repository.ts` | `apps/api/src/modules/<module>/infrastructure/persistence/` | 🟡 | Bỏ `mongoose` khỏi signature → dùng port |
| 9 | Transaction helper | `src/shared/database/mongoose-transaction.service.ts`, `mongo-session-context.ts` | `packages/core/src/transaction/` | 🟡 | Bỏ phụ thuộc NestJS |
| 10 | Outbox service | `src/shared/application/outbox/outbox.service.ts` | `apps/api/src/modules/shared/infrastructure/messaging/` | 🟡 | `recordEvent` giữ nguyên; relay chuyển sang Kafka producer |
| 11 | Outbox schema | `src/shared/application/outbox/outbox-event.schema.ts` | `apps/api/src/modules/shared/infrastructure/persistence/schemas/` | 🟡 | Đổi định danh sang ULID |
| 12 | CASL ability factory | `src/shared/casl/casl-ability.factory.ts` | `apps/api/src/modules/shared/application/authorization/` | 🟡 | Bỏ `Logger` của NestJS → port `AuditPort` |
| 13 | CASL guard + decorator | `shared/casl/policies.guard.ts`, `check-policies.decorator.ts`, `current-resource.decorator.ts`, `policy-resource.decorator.ts` | `apps/api/src/modules/shared/infrastructure/http/guards/` | 🟡 | Chuyển sang dùng ability từ port |
| 14 | Storage interface | `src/shared/storage/storage.interface.ts` | `apps/api/src/modules/shared/application/ports/storage.port.ts` | 🟡 | Đổi `IStorageService` → `StoragePort` |
| 15 | Storage service (R2 + local) | `src/shared/storage/storage.service.ts` | `apps/api/src/modules/shared/infrastructure/storage/r2-storage.adapter.ts` | 🟡 | Tách thành 2 adapter; giữ logic quota |
| 16 | Storage quota | `storage.service.ts` — `checkUploadQuota`, `getCurrentUsageBytes`, `calculateDirectorySize` | `apps/api/src/modules/shared/infrastructure/storage/` | 🟡 | Giữ nguyên logic |
| 17 | Zod validation pipe | `src/shared/pipes/zod-validation.pipe.ts` | `apps/api/src/modules/shared/infrastructure/http/pipes/` | 🟡 | Dùng schema từ `packages/contracts` |
| 18 | Chuẩn hoá exception | `src/shared/filters/all-exceptions.filter.ts` | `apps/api/src/modules/shared/infrastructure/http/filters/` | 🟡 | Bỏ phụ thuộc NestJS trực tiếp |
| 19 | Logging interceptor | `src/shared/interceptors/logging.interceptor.ts` | `apps/api/src/modules/shared/infrastructure/http/interceptors/` | 🟡 | Đổi output sang JSON structured |
| 20 | Transform interceptor | `src/shared/interceptors/transform.interceptor.ts` | `apps/api/src/modules/shared/infrastructure/http/interceptors/` | 🟢 | Giữ nguyên |
| 21 | Cursor pagination | `src/shared/pagination/cursor-codec.ts`, `cursor-paginated.response.ts` | `apps/api/src/modules/shared/infrastructure/pagination/` | 🟡 | **Giữ lại** (đảo ngược quyết định v1) — mở rộng `nextCursor` + `hasMore`, ký HMAC chống giả mạo |
| 22 | Neo4j service + Cypher | `src/shared/database/neo4j.service.ts`, `modules/lineage/lineage-queries.cypher.ts` | — | 🔴 | **Loại bỏ hoàn toàn** — module `lineage` gỡ khỏi phạm vi (dữ liệu bất biến) |
| 4 | JWKS / JWT strategy | `src/modules/auth/auth.service.ts` — `bcrypt.hash` / `bcrypt.compare` | `apps/api/src/modules/auth/infrastructure/security/` | 🟢 | Giữ bcrypt 12 rounds |

## 5.2. Thành phần phải viết lại

| # | Thành phần | Lý do phải viết lại | Hướng tiếp cận |
|---|---|---|---|
| 1 | Cấu trúc module | Dự án cũ dùng cấu trúc phẳng (controller/service/repository); dự án mới cần 3 tầng domain/application/infrastructure | Tách từng module cũ thành 3 tầng, giữ logic trong `application/` |
| 2 | Repository của từng module | Dự án cũ import `mongoose` trực tiếp, gắn chặt domain với công nghệ lưu trữ | Đặt interface port ở `domain/ports/` hoặs `application/ports/`, adapter Mongoose ở `infrastructure/persistence/` |
| 3 | DI của từng module | Dự án cũ dùng class token; dự án mới dùng `Symbol` token cho interface | Viết lại `<module>.module.ts` |
| 4 | Controller + DTO | Dự án cũ dùng class-validator/class-transformer? Dự án mới dùng Zod ở `packages/contracts` | Chuyển DTO sang Zod schema, tách khỏi `domain/` |
| 5 | Phân trang | Dự án cũ đã có cursor; v2 chốt **giữ cursor**, bổ sung `hasMore` và ký HMAC | Mở rộng `cursor-codec.ts` + đổi contract `{ items, nextCursor, hasMore }` |
| 6 | Hàng đợi / job | Dự án cũ không có worker tách riêng; job chạy trong API process | Viết `apps/worker` + `KafkaEventBusAdapter` (kafkajs) |
| 6b | Realtime | Dự án cũ không có | `SocketIoRealtimeAdapter` + Redis adapter, gateway tại `/api/v1/realtime` |
| 6c | AI cục bộ | Dự án cũ gọi Gemini API | `LocalInferenceAiAnalyzerAdapter` (vLLM/Ollama) + `LocalEmbeddingAdapter` |
| 6d | Feedback & học lại | Dự án cũ không có | Module `feedback` mới: `finding_feedback`, `feedback_example` |
| 7 | Worker outbox | Dự án cũ có `modules/lineage/services/outbox-processor.worker.ts` chạy trong API | Tách sang `apps/worker` |
| 8 | Logging | Console chưa chuẩn JSON | Chuyển output sang JSON structured |
| 9 | Health check | Dự án cũ không chuẩn hoá | Viết `/health` + `/health/ready` |

## 5.3. Thành phần loại bỏ

| # | Thành phần | Lý do |
|---|---|---|
| 1 | Neo4j + Cypher lineage | Hạ tầng thừa cho nhu cầu hiện tại; lineage hợp nhất vào MongoDB |
| 2 | ~~Cursor pagination~~ | **Giữ lại ở v2** — chuyển sang offset là quyết định sai |
| 3 | Module `exports` | Gỡ khỏi code, xoá collection, không thêm tính năng mới |
| 4 | Module `versions` | **Gỡ 2026-11-05** — không còn phiên bản dữ liệu để snapshot/diff/rollback |
| 5 | Module `clean-rules` | **Gỡ 2026-11-05** — không còn thao tác áp dụng quy tắc làm sạch |
| 6 | Module `cell-edit` | **Gỡ 2026-11-05** — dữ liệu bất biến, không sửa ô |
| 7 | Module `lineage` | **Gỡ 2026-11-05** — không cần đồ thị lineage |
| 4 | Ntfy (thông báo dev) | Dự án mới dùng hệ thống `notifications` chuẩn với email + issue report |

## 4.3. 5.4. Kiểm thử: tái sử dụng

| File test (dự án cũ) | Vị trí mới | Loại |
|---|---|---|
| `test/zero-any.spec.ts` | `packages/core` + `apps/api` | 🟢 Giữ nguyên — chuyển sang check cả package |
| `test/zod-openapi.spec.ts` | `packages/contracts` | 🟢 Giữ nguyên |
| `test/mask-pii.spec.ts` | `packages/core` | 🟢 Giữ nguyên |
| `test/crypto.spec.ts` | `packages/core` | 🟡 Điều chỉnh: thêm vector SHA-512, bỏ assertion SHA-256 |
| `test/casl.spec.ts` | `apps/api/src/modules/shared` | 🟡 Điều chỉnh: ability qua port |
| `test/storage.spec.ts` | `apps/api/src/modules/shared/infrastructure/storage/` | 🟡 Điều chỉnh: tách 2 adapter |
| `test/guard-coverage.spec.ts` | `apps/api/src/modules/shared` | 🟡 Điều chữnh: guard mới |
| `test/versions.spec.ts` | `apps/api/src/modules/versions` | 🟡 Điều chỉnh: SHA-512 + công thức có dấu `|` |
| `test/lineage.spec.ts` | `apps/api/src/modules/versions` | 🟡 Điều chỉnh: hợp nhất vào MongoDB |

## 5.4. Kiểm thử: tái sử dụng

| File test (dự án cũ) | Vị trí mới | Loại |
|---|---|---|
| `test/zero-any.spec.ts` | `packages/core` + `apps/api` | 🟢 Giữ nguyên — chuyển sang check cả package |
| `test/zod-openapi.spec.ts` | `packages/contracts` | 🟢 Giữ nguyên |
| `test/mask-pii.spec.ts` | `packages/core` | 🟢 Giữ nguyên |
| `test/crypto.spec.ts` | `packages/core` | 🟡 Điều chỉnh: thêm vector SHA-512, bỏ assertion SHA-256 |
| `test/casl.spec.ts` | `apps/api/src/modules/shared` | 🟡 Điều chỉnh: ability qua port |
| `test/storage.spec.ts` | `apps/api/src/modules/shared/infrastructure/storage/` | 🟡 Điều chỉnh: tách 2 adapter |
| `test/guard-coverage.spec.ts` | `apps/api/src/modules/shared` | 🟡 Điều chỉnh: guard mới |
| `test/versions.spec.ts` | `apps/api/src/modules/versions` | 🟡 Điều chỉnh: SHA-512 + công thức có dấu `|` |
| `test/lineage.spec.ts` | `apps/api/src/modules/versions` | 🟡 Điều chỉnh: hợp nhất vào MongoDB |

## 5.5. Quy trình tái sử dụng an toàn

Quy trình áp dụng cho từng thành phần 🟢 và 🟡:

| Bước | Hành động | Điều kiện đạt |
|---|---|---|
| 1 | Copy mã nguồn sang vị trí mới, **chưa sửa gì** | File được commit riêng, dễ diff |
| 2 | Viết/điều chỉnh test theo vị trí mới | Test pass với logic cũ, chưa đổi hành vi |
| 3 | Tách phần phụ thuộc framework (NestJS, Mongoose) ra khỏi logic | Logic còn lại thuần TypeScript |
| 4 | Chuyển sang port + adapter | `domain/` không còn import framework |
| 5 | Xoá bản cũ | Không còn tham chiếu nào tới đường dẫn cũ |

**Nguyên tắc:** một thay đổi hành vi (ví dụ đổi thuật toán băm) phải nằm ở **commit riêng**, không trộn vào commit di chuyển. Nhờ vậy khi có sự cố có thể revert chính xác phần hành vi mà không mất công sức di chuyển.

---

# 6. Kiến trúc công nghệ của dự án mới

## 6.1. Monorepo

```
apps/
├── api/                      # NestJS — HTTP, composition root
│   └── src/modules/<module>/ # 21 module nghiệp vụ
└── worker/                   # Kafka consumer (nhiều consumer group), không HTTP công khai
packages/
├── core/                     # Thuần TS — hash, crypto, PII, transaction, ULID
├── contracts/                # DTO Zod + nguồn sinh openapi.json
└── config/                   # Parser biến môi trường bằng Zod
```

**Vì sao `packages/core` là nơi đặt hàm băm:** hàm băm được dùng bởi cả `apps/api` và `apps/worker` (worker cũng cần tính checksum khi xử lý job). Đặt ở `packages/core` giúp hai app dùng chung **một bản thuật toán** — tránh trường hợp API dùng SHA-512 còn worker dùng SHA-256 do lệch phiên bản.

## 6.2. Cấu trúc tầng trong một module

```
apps/api/src/modules/<module>/
├── domain/                          # Không phụ thuộc framework
│   ├── entities/                    # Model nghiệp vụ + invariant + domain event
│   ├── value-objects/               # Kiểu giá trị có validate, transition hợp lệ
│   ├── events/                      # Domain event
│   └── ports/                       # Port repository — cổng ra ngoài cho aggregate
├── application/                     # Điều phối use case
│   ├── commands/                    # Use case thay đổi trạng thái
│   ├── queries/                     # Use case đọc
│   └── ports/                       # Port hạ tầng — storage, email, AI, queue, audit
├── infrastructure/                  # Adapter
│   ├── http/                        # Controller, DTO (Zod), response mapper
│   ├── persistence/                 # Schema Mongoose, repository adapter, entity mapper
│   └── messaging/                   # Kafka producer/consumer adapter, outbox relay
├── <module>.module.ts               # Composition root
└── README.md                        # Trách nhiệm, hợp đồng công khai, dependency
```

## 6.3. Quy tắc chiều dependency

```
domain         ──✗──▶  application, infrastructure, @nestjs/*, mongoose
application    ──✗──▶  infrastructure, @nestjs/*, mongoose
infrastructure ──✓──▶  domain, application, @nestjs/*, mongoose
```

**Hệ quả kiểm thử:** toàn bộ `domain/` của 21 module test được bằng unit test thuần Node — không cần MongoDB, không cần NestJS testing module.

## 6.4. NestJS — ranh giới sử dụng

| Tầng | Dùng NestJS? | Quy tắc |
|---|---|---|
| `domain/` | **Không** | Không import `@nestjs/*`, không import `mongoose` |
| `application/` | **Không** | Chỉ dùng interface do domain/application định nghĩa |
| `infrastructure/` | Có | Nơi duy nhất chạm NestJS và Mongoose |

## 6.5. Dependency Injection

```typescript
export const PROJECT_REPOSITORY_PORT = Symbol('ProjectRepositoryPort');

// composition root — <module>.module.ts
providers: [
  { provide: PROJECT_REPOSITORY_PORT, useExisting: ProjectRepository },
]
```

Không dùng class token cho interface — interface TypeScript không tồn tại ở runtime nên bắt buộc phải có token.

---

# 7. Dữ liệu, lưu trữ và băm hash

## 7.1. MongoDB

| Quyết định | Chi tiết |
|---|---|
| Bản dev | MongoDB Atlas **M0** (miễn phí) |
| Bản production | MongoDB Atlas **M10** |
| Bắt buộc | **Replica set** — cần cho transaction và change stream |
| Xử lý M0 | M0 không có replica set → fallback về job table polling |
| Kết nối | IP allowlist theo IP VPS; không expose port ra Internet |

## 7.2. 21 collection

| Nhóm | Collection | Loại | Xoá |
|---|---|---|---|
| Identity | `user`, `user_session`, `audit_log`, `audit_change` | Thực thể / Log | soft / TTL |
| Workspace & Project | `workspace`, `workspace_member`, `project`, `project_member` | Thực thể | soft |
| Dataset | `dataset` | Thực thể | soft |
| Dataset (dữ liệu thô) | `dataset_record` | Thực thể — **insert-only** | **không xoá** |
| Analysis & AI | `analysis_run`, `analysis_result`, `cell_evidence`, `ai_job` | Thực thể | soft |
| Hợp đồng & tổng kết | `project_save` | Thực thể | soft |
| Giao tiếp | `notification`, `issue_report` | Log / Thực thể | TTL / soft |
| Hạ tầng | `outbox_event`, `processed_event` | Log, append-only | TTL |

> **Bất biến dữ liệu (2026-11-05):** `dataset_record` **không** soft-delete. Đường ghi duy nhất là Import (lô 5.000 bản ghi). Collection `dataset_version` **không còn tồn tại** (module `versions` bị gỡ).

## 7.3. Quy ước schema

| Quy ước | Nội dung |
|---|---|
| Định danh | Tiền tố theo loại + 26 ký tự ULID: `ws_`, `prj_`, `ds_`, `sh_`, `run_`, `job_` |
| Đặt tên field | `snake_case` trong MongoDB, `camelCase` ở API — mapper chuyển đổi |
| Field chuẩn | `created_at`, `updated_at`, `created_by`, `updated_by` trên mọi collection |
| Xoá mềm | `is_deleted` + `deleted_at` + `deleted_by` cho thực thể nghiệp vụ |
| Optimistic locking | Trường `version` tăng mỗi lần ghi |
| Index | Bắt buộc theo truy vấn: workspace/project, record theo dataset, analysis theo run, TTL theo collection log, **cursor: hợp lệ theo (sort_key, _id)** |

## 7.4. Transaction và consistency

| Nguyên tắc | Chi tiết |
|---|---|
| Transaction chỉ trong repository adapter | Application không mở transaction trực tiếp |
| Ghi outbox trong cùng transaction | Không có trạng thái trung gian mất dữ liệu |
| Ngoại lệ: import dataset | Lưu theo lô để tránh transaction quá dài |
| Ghi hàng loạt | Xoá dòng, reset dataset, rollback — ghi theo lô, không giữ transaction mở |
| Đọc | Mặc định không dùng transaction; chỉ dùng khi cần nhất quán đọc |

## 7.5. Cloudflare R2

| Quyết định | Lý do |
|---|---|
| Dùng R2 thay vì S3 | Egress $0 — API tương thích S3 nên giữ nguyên cấu hình `S3_*` |
| Bucket **không public** | Mọi lần tải đi qua API có kiểm tra quyền |
| Fallback local | Adapter `LocalStorageAdapter` khi `STORAGE_DRIVER=local` |
| Nội dung lưu | Tệp gốc đã upload, PDF sinh ra, tệp đính kèm báo cáo sự cố |

## 7.6. Retention

| Loại dữ liệu | Thời gian giữ |
|---|---|
| Audit log | 365 ngày |
| Phiên đăng nhập | 90 ngày (TTL index) |
| Thông báo | 180 ngày |
| Outbox / processed event | TTL index, dọn dẹp hằng ngày 02:00 giờ VN |
| Bản lưu project và dataset version | Giữ theo vòng đời project, xoá mềm |

---

# 8. Hàng đợi và tích hợp bên ngoài

## 8.1. Danh mục dịch vụ ngoài và port

| Dịch vụ | Port | Adapter | Bắt buộc | Ghi chú |
|---|---|---|---|---|
| Cloudflare R2 | `StoragePort` | `R2StorageAdapter` + `LocalStorageAdapter` | ✅ | Có fallback local |
| MongoDB | qua repository port | `MongooseXxxRepository` | ✅ | Bắt buộc replica set |
| Kafka | `EventBusPort` | `KafkaEventBusAdapter` | ✅ | KRaft single-node, 5 topic, DLQ |
| Redis (cache + rate-limit) | `CachePort` / `RateLimiterPort` | `RedisCacheAdapter`, `RedisRateLimiterAdapter` | ✅ | Cache, rate-limit, Socket.IO adapter |
| AI suy luận cục bộ | `AiAnalyzerPort` | `LocalInferenceAiAnalyzerAdapter` | ✅ | vLLM `:8000` / Ollama `:11434` |
| AI embedding cục bộ | `EmbeddingPort` | `LocalEmbeddingAdapter` | ✅ | Qwen3-Embedding-0.6B |
| Realtime | `RealtimePublisherPort` | `SocketIoRealtimeAdapter` | ✅ | Redis adapter, phòng theo user/project/analysis |
| SMTP | `EmailSenderPort` | `SmtpEmailSenderAdapter` | ✅ | OTP, lời mời, reset mật khẩu |
| Google OAuth | `GoogleOAuthPort` | `GoogleOAuthAdapter` | ❌ | Tuỳ chọn — chạy được nếu không cấu hình |
| PDF | `PdfRendererPort` | `PdfKitPdfRendererAdapter` | ✅ | PDFKit |
| Clock | `ClockPort` | `SystemClockAdapter` | ✅ | Test được thời gian |
| Id generator | `IdGeneratorPort` | `UlidIdGeneratorAdapter` | ✅ | `packages/core` |
| **Băm hash** | **`HashingPort`** | **`Sha512Hasher`** | ✅ | **Thay SHA-256 — xem mục 2** |


## 8.2. Cơ chế outbox / inbox

| Thành phần | Cơ chế |
|---|---|
| Ghi outbox | Entity gom domain event → handler ghi vào `outbox_event` **trong cùng transaction** |
| Relay | 2 kênh: **Change Stream** (chính) + **polling fallback** quét event mồ côi |
| Bus sự kiện | **Kafka** — topic `domain.events`; consumer tự lọc theo `eventType` |
| Hàng đợi nền | **Kafka** — `ai.jobs`, `notification.dispatch`, `realtime.push` |
| Dead-letter | Topic `dlq.dead-letter` — message vượt ngưỡng retry |
| Chống xử lý trùng | Collection `processed_event` (inbox pattern), khoá unique `(consumer_name, event_id)` |
| Bảo đảm giao | **at-least-once** → consumer phải idempotent |
| Claim/lease | 4 trạng thái, xử lý lỗ hổng at-least-once |

## 8.3. Topic Kafka và consumer group

| Topic | Nội dung | Consumer group | Kết quả |
|---|---|---|---|
| `domain.events` | Sự kiện nghiệp vụ (relay outbox, kết quả phân tích) | `domain-event-consumer` | 202 + `pollUrl` |
| `ai.jobs` | Phân tích AI, sinh PDF, embedding | `ai-consumer` | 202 + `pollUrl` |
| `notification.dispatch` | Gửi email (kể cả reset mật khẩu hàng loạt), thông báo | `notification-consumer` | — |
| `realtime.push` | Đẩy sự kiện realtime qua Socket.IO | `realtime-publisher` | — |
| `dlq.dead-letter` | Message chết — giữ để điều tra, phát lại | `dlq-monitor` | — |

Dọn dẹp retention chạy theo lịch 02:00 VN (Kafka scheduler hoặc cron gọi job `ai.jobs`).

**Consumer idempotent**: ghi `processed_event` với khoá unique `(consumer_name, event_id)` trước khi xử lý. Lỗi tạm thời → retry backoff luỹ thừa (tối đa 3) → `dlq.dead-letter`. Lỗi vĩnh viễn → thẳng DLQ.

---

# 9. Công nghệ AI

## 9.1. AI cục bộ — engine và mô hình

> **v2:** cấm hoàn toàn AI API bên ngoài. Mọi suy luận diễn ra trong container `ai-engine`.

| Hạng mục | Quyết định |
|---|---|
| Engine production | **vLLM** (CPU) — HTTP tương thích OpenAI tại `http://ai-engine:8000` |
| Engine dev/local | **Ollama** tại `http://localhost:11434` |
| Engine dự phòng | `llama.cpp` server |
| Tầng sâu | **Do benchmark quyết định** — F1 + điểm giải thích cao nhất đạt p95 ≤ 180 s, RSS ≤ 11 GB |
| Tầng nhanh | **Do benchmark quyết định** — p95 thấp nhất đạt JSON ≥ 98 %, ảo giác ≤ 2 % |
| Model embedding | **Qwen3-Embedding-0.6B** (~1.2 GB RSS) |
| Routing | **Theo loại tác vụ**: gợi ý nhãn / phân loại / JSON ngắn → tầng nhanh; giải thích / gợi ý / nhận xét → tầng sâu. Fallback: sâu → nhanh → suy giảm có kiểm soát (`ai_unavailable`) |
| Timeout | 180 giây |
| Retry | 2 lần, backoff luỹ thừa |
| Đồng thời | 1 job AI |
| RAM guard | Dừng job AI mới khi RSS engine > 85% RAM host |
| Chi phí | Chỉ tiền điện — không phí API |

**Năm ứng viên benchmark** — mỗi model đại diện một giả thuyết khác nhau để kết quả kiểm chứng được một kết luận:

| Mã | Model | Quant | RSS ước tính | Giả thuyết được kiểm chứng |
|---|---|---|---|---|
| M1 | Qwen3-14B | Q4_K_M | ~10 GB | Quy mô + đa ngữ thắng |
| M2 | Gemma-3-12B-IT | QAT Q4 | ~8 GB | Lượng tử QAT bù được phần thiếu tham số |
| M3 | Qwen3-8B | Q4_K_M | ~6 GB | Một nửa tham số có đủ cho tác vụ có cấu trúc? |
| M4 | Llama-3.1-8B-Instruct | Q4_K_M | ~5.5 GB | Baseline hệ sinh thái lớn |
| M5 | Vistral-7B-Chat | Q4_K_M | ~5 GB | Chuyên biệt tiếng Việt thắng quy mô? |

**Loại trước benchmark:** Qwen3-30B-A3B (18 GB > RAM) · DeepSeek-R1-Distill-Qwen-14B (p95 quá cao) · Phi-4-mini / PhoGPT-4B (quá nhỏ).

**Chín chỉ số (trọng số 100):** F1 micro (30) · F1 macro theo DQ-01→05 (10) · JSON hợp lệ (12) · ảo giác (10) · chất lượng giải thích tiếng Việt chấm chéo (13) · p95 latency (10) · throughput (5) · RSS đỉnh (5) · độ ổn định (5).

**Quy tắc chốt:** rớt bất kỳ ngưỡng tuyệt đối → loại; chênh F1 < 0,03 → không coi là khác biệt; McNemar + Wilcoxon, chỉ tuyên bố thắng khi **ΔF1 ≥ 0,03 và p < 0,05**; chọn theo **đường Pareto** (p95 × F1, kích thước = RSS).

**Quy trình chọn model (bắt buộc):** thu tập **200 mẫu vàng** từ nhận xét người dùng (chống rò rỉ đáp án với kho few-shot) → chạy **cả 5 model** trên **đúng VPS production CPU-only**, cùng prompt/tham số, 3 lần/model → chấm 9 chỉ số → kiểm định thống kê → vẽ Pareto → chốt **cặp model cho định tuyến hai tầng** → lưu `docs/benchmarks/benchmark-<model>-<ngày>.md` → chạy lại khi đổi model/quant/prompt/engine hoặc mỗi quý.

## 9.1.1. Học lại từ phản hồi người dùng (RAG T1)

Mỗi finding đi kèm khối đánh giá: `verdict` (`correct`/`incorrect`/`partially_correct`/`not_applicable`), `confidence` (1–5), `issueCategory`, `comment`, `correctedExplanation`, `evidenceRefs`, `rating`, `responseTimeMs`.

| Collection | Vai trò | Chính sách |
|---|---|---|
| `finding_feedback` | Nhận xét gốc | **append-only** — không sửa, không xoá |
| `feedback_example` | Kho mẫu few-shot đã khử định danh | append-only, có `source_feedback_id` |

Vòng lặp: phản hồi → `finding_feedback` → lọc (`verdict=incorrect` hoặc có `correctedExplanation`) → khử định danh → embed bằng Qwen3-Embedding-0.6B → truy vấn top-5 theo cosine similarity → chèn vào prompt. Budget cứng: ≤ 5 mẫu, ≤ 4.000 token. Chống tự khuếch đại: 1 mẫu mỗi `finding_signature` trong 30 ngày.

## 9.2. Ranh giới dữ liệu — không rời hệ thống

**Không có dữ liệu nào ra khỏi host.** `ai-engine` chạy trong cùng Docker network, không có egress.

| Được truyền vào mô hình | Bị chặn |
|---|---|
| Thống kê tổng hợp có cấu trúc | Tệp gốc (toàn bộ nội dung CSV) |
| Tối đa **20 ô lỗi/cột đã che PII** | Toàn bộ tập bản ghi |
| Mô tả lỗi đã lọc | Ảnh chụp màn hình lỗi |
| — | Bất kỳ request nào tới miền bên ngoài |

Chi tiết định danh luôn được che trước khi đưa vào prompt — tái sử dụng `mask-pii.ts` 🟢. `ai-engine` được cấu hình không NAT outbound.

## 9.3. Phân tách trách nhiệm backend ↔ AI

| Phần | Ai quyết định |
|---|---|
| Phát hiện lỗi theo tiêu chí DQ-01 → DQ-04 | **Backend** — thuật toán tất định, tái lập được, kiểm thử được |
| Mức độ ảnh hưởng | **Backend** — theo quy tắc tái lập được (Thấp / Trung bình / Cao / Chưa đủ cơ sở) |
| Phát hiện bổ sung, giải thích, nhận xét, đề xuất | **AI** — dựa trên thống kê backend cung cấp |
| Ma trận tương quan + VIF (v7, 2026-11-07, đã triển khai) | Backend **`simple-statistics@8.0.0`** (Pearson/Spearman) + **`ml-matrix@6.15.1`** (nghịch đảo ma trận cho VIF); mỗi ô kèm `n/totalScanned/missingAOnly/missingBOnly/missingBoth`; VIF kèm `commonNRate/lossWarning` (20%/50%); cột `date` loại với lý do riêng; prompt `corr-v1` qua `AiWorkerService` + `LocalInferenceAdapter` (vLLM/Ollama, timeout 180s, retry 2, dung sai grounding 0.01) |
| Sửa dữ liệu | **Không ai tự động** — AI không tự sửa dữ liệu |

**Lý do:** quy tắc backend giúp kết quả nhất quán và kiểm thử được, nhưng có thể bỏ sót ý nghĩa nghiệp vụ. Đây là đánh đổi được chấp nhận có chủ đích.

## 9.4. Xử lý khi AI lỗi

| Tình huống | Hành vi |
|---|---|
| AI lỗi hoặc timeout | Tổng kết vẫn được tạo từ kết quả hệ thống, **không có** giải thích/đề xuất AI; job vào DLQ sau 3 retry |
| RAM quá tải | RAM guard chặn job AI mới; job chờ trong Kafka; hệ thống không sụp |
| Đầu vào không đổi | Cho phép thử lại riêng phần AI (UC-22) |
| Phản hồi hợp lệ một phần | Giữ nhận xét hợp lệ, loại phần không đạt, báo phần chưa đầy đủ tại Tổng kết |
| Phản hồi hỏng toàn bộ | Chỉ dùng kết quả hệ thống |

---

# 10. Bảo mật

## 10.1. Xác thực

| Cơ chế | Chi tiết |
|---|---|
| Access token | JWT Bearer trong header `Authorization` |
| Refresh token | Làm mới qua `POST /auth/refresh` — trả cặp token mới |
| Google OAuth | Tuỳ chọn — hệ thống chạy được nếu không cấu hình |
| Mật khẩu | bcrypt, 12 rounds — **không đổi** |
| OTP quên mật khẩu | Mã ngẫu nhiên có hạn, dùng một lần |
| Phân biệt lỗi | `TOKEN_INVALID` (sai/đã dùng/bị thu hồi) vs `TOKEN_EXPIRED` (hết hạn) |

## 10.2. Phân quyền

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Ability engine | CASL 7.x | Ability-based, khai báo theo action + subject |
| Guard | NestJS guard | Kiểm tra ability trước khi vào handler |
| Policy pattern | Policy class theo module | Tách quy tắc phức tạp ra khỏi guard |
| Audit | Module `audit` | Ghi log thay đổi quyền và thao tác nhạy cảm |

Mô hình 5 vai trò: `WS-OWNER`, `WS-MEMBER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`, cộng `SYS-ADMIN` tách biệt ở tầng hệ thống.

## 10.3. Bảo vệ dữ liệu nhạy cảm

| Biện pháp | Chi tiết |
|---|---|
| Che PII trước khi đưa vào prompt | Tối đa 20 ô đã che |
| `ai-engine` không egress | Dữ liệu không rời host |
| Lỗi 500 không lộ chi tiết | Không stack trace, không tên collection, không giá trị nghiệp vụ |
| Lỗi `DEPENDENCY_UNAVAILABLE` | Nêu dịch vụ nào lỗi, không nêu host/credential |
| Lỗi xác thực trung tính | Không tiết lộ email có tồn tại hay không |
| Audit log | Ghi lại thao tác trên dữ liệu và thay đổi quyền |
| Rate-limit | Redis-backed, áp dụng trên endpoint nhạy cảm |

## 10.4. Bảo mật vận hành

| Biện pháp | Chi tiết |
|---|---|
| Không expose MongoDB/Redis ra Internet | Chỉ trong mạng nội bộ Docker |
| Cloudflare Tunnel | Không cần mở port trên VPS |
| Nginx/Caddy | Cổng vào duy nhất từ Internet; TLS termination |
| Worker không có port HTTP công khai | Chỉ port health check nội bộ |
| IP allowlist MongoDB Atlas | Giới hạn theo IP của VPS |
| R2 bucket không public | Mọi lần tải qua API có kiểm tra quyền |
| Secret trong `.env` | File gitignored, không commit |

---

# 11. Kiến trúc vận hành

## 11.1. Sơ đồ triển khai

```
┌────────────────────────────────────────────────────────────────────┐
│              VPS (1 máy, Ubuntu 22.04, 16 vCPU / 15 GB RAM)         │
│                                                                     │
│  ┌──────────────────────┐      ┌────────────────────────────────┐   │
│  │  Cloudflare Tunnel   │      │        Docker Compose          │   │
│  │  (tunnel → origin)   │─────►│                                │   │
│  └──────────────────────┘      │  ┌────────┐ ┌──────────┐      │   │
│                                │  │  api   │ │  worker  │      │   │
│  ┌──────────────────┐          │  │ :3000  │ │ (no HTTP)│      │   │
│  │  Nginx/Caddy     │◄─────────┤  │  + WS  │ └────┬─────┘      │   │
│  │  (TLS + static)  │  TLS    │  └────┬───┘      │            │   │
│  └──────────────────┘          │       │          │            │   │
│                                │       └────┬─────┘            │   │
│                                │  ┌─────────┼──────────┬──────────────┐
│                                │  │  Kafka  │  Redis 7 │  ai-engine  │   │
│                                │  │ KRaft  │ cache +  │  vLLM :8000  │   │
│                                │  │ :9092  │ rate +   │  Qwen3-14B   │   │
│                                │  │ 5 topic│ SocketIO │  Qwen3-8B    │   │
│                                │  │  + DLQ │  adapter │  Embed-0.6B  │   │
│                                │  └────────┴──────────┴──────────────┘   │
│                                └──────────────────┬────────────────────┘
└──────────────────────────────────────────────────┼─────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────┐
            ┌───────▼────────┐      ┌─────────────▼───────────┐   ┌────────▼────────┐
            │ MongoDB Atlas  │      │    Cloudflare R2        │   │  SMTP           │
            │ M0 (dev)       │      │    file gốc, PDF,        │   │                │
            │ M10 (prod)     │      │    tệp đính kèm          │   └─────────────────┘
            └────────────────┘      └─────────────────────────┘

    ❌ KHÔNG có mũi tên dữ liệu ra Internet. ai-engine không egress,
       không cài SDK AI bên ngoài nào.
```

## 11.2. Các quyết định vận hành

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Nền tảng triển khai: **Docker Compose trên VPS** | 1 file compose cho api + worker + Redis |
| 2 | Observability **tối giản** — log JSON + health endpoint | Không Prometheus/Grafana/Loki/Sentry |
| 3 | Định dạng log: **JSON structured** ra stdout | Máy đọc được, thu thập tập trung dễ |
| 4 | Database: **Atlas M0 cho dev**, **M10 cho production** | M0 không có replica set → cần fallback |
| 5 | Quota dung lượng **theo workspace** (500 MB) | Khớp thiết kế xử lý dữ liệu |
| 6 | **Có** dead-letter queue trên Kafka | Topic `dlq.dead-letter` — giữ để điều tra, phát lại |
| 7 | Secret: file `.env` (gitignored) | Chuẩn, đơn giản |
| 8 | Redis: **một instance** cho cache + rate-limit + Socket.IO adapter | Đủ cho quy mô hiện tại |
| 8b | Kafka: **KRaft single-node**, không ZooKeeper | 1 broker, đủ cho 1 VPS |
| 8c | `ai-engine` giới hạn bộ nhớ `mem_limit` | Chặn OOM làm sập cả VPS |
| 8d | RAM guard dừng job AI khi RSS > 85% RAM host | Giữ API sống hơn giữ AI chạy |
| 9 | R2 giữ nguyên cấu hình `S3_*` | Egress $0 — rẻ hơn S3 |

## 11.3. Health check

| Endpoint | Ý nghĩa |
|---|---|
| `/health` | Tiến trình còn sống |
| `/health/ready` | Sẵn sàng nhận traffic — đã kết nối MongoDB, Redis, Kafka |
| `/health/ai` | Trạng thái `ai-engine`: model đang nạp, RSS, RAM guard |

## 11.4. Sao lưu và khôi phục

| Đối tượng | Cơ chế |
|---|---|
| MongoDB Atlas | Snapshot tự động theo lịch + `mongodump` định kỳ ra R2 |
| R2 | Versioning bật; bucket không public |
| `.env` | Sao lưu riêng, mã hoá, lưu ngoài VPS |
| Kiểm thử khôi phục | Định kỳ — quy trình khôi phục phải được thử, không chỉ tài liệu hoá |

---

# 12. Hiệu năng và giới hạn

| Hạng mục | Ngưỡng |
|---|---|
| Timeout AI | 180 giây, retry 2 lần |
| Số ô lỗi đưa vào prompt | Tối đa 20 ô/cột |
| Đồng thời AI | 1 job |
| RAM guard | Dừng job AI mới khi RSS engine > 85% RAM host |
| Quota dung lượng | 500 MB mỗi workspace |
| Rate-limit | Redis-backed, theo endpoint |
| Phân trang | **cursor-based**: `limit` 1–100, mặc định 15; trả `nextCursor` + `hasMore` |
| Few-shot budget | ≤ 5 mẫu, ≤ 4.000 token |
| Job dọn dẹp | Hằng ngày 02:00 giờ VN |
| **Chi phí hash SHA-512** | +30–50% so với SHA-256 — không cần thay đổi kiến trúc |

Chiến lược hiệu năng: index MongoDB theo truy vấn · projection chỉ lấy trường cần · streaming upload/download không nạp toàn bộ tệp vào bộ nhớ · **phân trang cursor (keyset)** ổn định khi dữ liệu thay đổi và không cần `countDocuments` · index hợp lệ theo `(sort_key, _id)` · job Kafka thay xử lý đồng bộ · cache Redis cho rate-limit counter và trạng thái feature flag.

**Về hạn ngạch phân trang cursor:** cursor là chuỗi base64url ký HMAC chứa cặp `(sort_key cuối, _id cuối)`. Mặc định sort `created_at DESC, _id DESC`. Đổi bộ lọc giữa 2 lần gọi → HTTP 400 `INVALID_CURSOR`. Không còn tham số `offset`/`page` ở bất kỳ endpoint nào.

---

# 13. Công cụ kiểm thử

| Công cụ | Vai trò |
|---|---|
| Jest + ts-jest | Unit test, integration test |
| Supertest | E2E — gọi HTTP thật |
| k6 | Smoke và stress test, chạy thủ công trước release |
| zod-to-json-schema | Sinh `openapi.json` từ `packages/contracts` |
| Docker Compose test | MongoDB replica set 1 node + Redis + MinIO + Kafka KRaft 1 node |
| Script checker kiến trúc | Kiểm tra 12 quy tắc dependency R1–R12 |
| Script security check | 34 tình huống truy cập trái phép |
| **Script quét hash** | **Chắc chắn không còn `createHash('sha256')` trong mã nguồn mới** |

**Quy tắc:** test AI **luôn mock** — không bao giờ gọi engine thật trong test. Bộ benchmark model (§9.1) là nơi duy nhất gọi engine thật, chạy thủ công theo lịch, không nằm trong CI.

Thêm: script `check-no-external-ai` — đảm bảo `package.json` của monorepo **không** chứa `@google/generative-ai`, `openai`, `anthropic` hay bất kỳ SDK AI bên ngoài nào.

## 13.1. Ngưỡng coverage theo tầng

| Tầng | Ngưỡng |
|---|---|
| Domain | ≥ 90% |
| Application | ≥ 80% |
| Infrastructure | ≥ 60% |
| Contracts | ≥ 95% |
| **Tổng** | **≥ 70%** |

## 13.2. Tám tầng kiểm thử

1. API snapshot contract (`openapi.json`) · 2. Domain (pure TS) · 3. Application use case (mock qua interface fakes) · 4. Infrastructure adapter (container Mongo replica set + Redis + MinIO) · 5. E2E + runtime Zod validation · 6. Architecture rules (script checker R1–R12) · 7. Security (36 kịch bản) · 8. Performance (k6 manual smoke/stress)

---

# 14. Chiến lược chuyển đổi công nghệ

## 14.1. Hybrid — chuyển đổi theo lô module

Chiến lược **không Big Bang**. Hệ thống mới và hệ thống cũ cùng chạy, định tuyến bằng cờ tính năng theo workspace:

```
legacy  ──▶  canary (10% workspace)  ──▶  new
```

- Bộ định tuyến chạy **trong tiến trình** (in-process), đọc collection `feature_flag`.
- Chuyển đổi 3 trạng thái, quay lại `legacy` mất vài giây, không cần triển khai lại.
- Chuyển đổi theo **lô module** (7 lô) thay vì một cửa sổ dừng hệ thống duy nhất.
- Các thay đổi hạ tầng lớn cũng được chuyển đổi theo cờ tính năng: `LEGACY_AI_PROVIDER_ENABLED` (Gemini cũ), `LEGACY_QUEUE_ENABLED` (BullMQ cũ) — cho phép rollback nhanh.

## 14.2. Trình tự chuyển đổi tổng thể

| Lô | Nội dung | Phụ thuộc hash |
|---|---|---|
| Lô 0 | Dựng monorepo, `packages/core` (hash, crypto, PII), `packages/config`, `packages/contracts` | ✅ Thiết lập SHA-512 |
| Lô 1 | Module `users`, `auth`, `audit` | ✅ Băm mật khẩu + token |
| Lô 2 | Module `workspaces`, `projects` | — |
| Lô 3 | Module `datasets` | — (không còn Merkle/checksum phiên bản) |
| Lô 4 | Module `analysis`, `ai`, `notifications`, `issues` | ✅ |
| Lô 5 | Module `shared`, `data-view`, `reports` + dọn dẹp module loại bỏ | ✅ Dọn hash cũ |
| Lô 6 | Hạ tầng v2: Kafka (KRaft + DLQ), Socket.IO, tiện ích cursor, `ai-engine` cục bộ, chỉ `.csv` | — |
| Lô 7 | Module `feedback` + kho học lại RAG T1 | — |

## 14.3. Công cụ chuyển đổi dữ liệu

8 script `ts-node`, 3 chế độ: `--dry-run` (mặc định, chỉ báo cáo) · `--apply` (thực thi) · `--verify` (đối chiếu sau chuyển đổi).

---

# 15. Bảng đối chiếu dự án cũ → dự án mới

| Hạng mục | Dự án cũ | Dự án mới | Lý do |
|---|---|---|---|
| Cấu trúc module | Phẳng: controller/service/repository | 3 tầng domain/application/infrastructure | Sửa gốc rễ phụ thuộc chặt |
| Truy cận kho | Repository import Mongoose trực tiếp | Repository qua port, adapter Mongoose ở infrastructure | Cho phép test domain không cần DB |
| **Thuật toán băm** | **SHA-256** | **SHA-512** | **Quyết định đặc biệt — mục 2** |
| Phân trang | Cursor (`cursor-codec.ts`) | **Giữ cursor**, bổ sung `hasMore` + ký HMAC | Đảo ngược quyết định v1 — offset không ổn định |
| Worker | Chưa tách, job trong API process | `apps/worker` riêng, consumer Kafka nhiều group | Cho phép scale ngang |
| Hàng đợi | Chưa có | **Kafka** (KRaft, 5 topic, DLQ) | Replay, nhiều consumer group, độ bền disk |
| Realtime | Chưa có | **Socket.IO** + Redis adapter | Đẩy thông báo/tiến độ tới client |
| AI | Gemini API (Flash, Free Tier) |
| DQ-05 + tương quan/VIF (v4 mới) | DQ-05 có điều kiện + ma trận tương quan/VIF do AI đánh giá (Phần 2 v7) | Backend tính, AI diễn giải; tương quan/VIF không tự thành vi phạm | **vLLM/Ollama + 5 model ứng viên benchmark** (Qwen3-14B / Gemma-3-12B / Qwen3-8B / Llama-3.1-8B / Vistral-7B) | Dữ liệu không rời hệ thống; model chốt theo 9 chỉ số đo được |
| Định dạng tệp | CSV + Excel (có sheet) | **Chỉ `.csv`** | Giảm phụ thuộc, bỏ khái niệm sheet |
| Phản hồi người dùng | Chưa có | Module `feedback` + RAG T1 few-shot động | AI học lại từ phản hồi thật |
| Outbox | Có `outbox.service.ts` | Giữ, chuyển vào `shared`, ghi trong cùng transaction | Đã có nền tảng |
| Logging | Console qua interceptor | JSON structured ra stdout | Thu thập tập trung dễ |
| Health check | Chưa chuẩn hoá | `/health` + `/health/ready` | Sẵn sàng cho Docker healthcheck |
| Hợp đồng API | `zod-openapi.spec.ts` kiểm tra đồng bộ | `packages/contracts` sinh `openapi.json` + snapshot test | Hợp đồng là chuẩn, có gate |
| Kiểm tra dependency | Chưa có | Script checker R1–R12 trong `test:all` | Bảo vệ ranh giới tầng tự động |
| Cấu trúc gói | Một package `src/backend` | pnpm workspaces: apps/ + packages/ | Tái sử dụng `packages/core` giữa API và worker |
| Config | `env.validation.ts` trong shared | `packages/config` dùng chung | API và worker parse cùng một schema |
| Test | 18 file, unit + E2E | 8 tầng, 93 quy tắc, coverage theo tầng | Ràng buộc chất lượng ở tầng quan trọng nhất |
| Hiệu năng | Chưa đo | k6 smoke + stress trước release | Biết ngưỡng vận hành |
| Neo4j | Đang dùng cho lineage | **Loại bỏ hoàn toàn** — module `lineage` gỡ khỏi phạm vi | Dữ liệu bất biến → không cần đồ thị lineage |

---

# 16. Công nghệ chưa áp dụng — và lý do

| Công nghệ | Lý do không dùng |
|---|---|
| ~~Kafka~~ | **Đã áp dụng ở v2** — event bus + hàng đợi nền + DLQ |
| CQRS framework | Thêm lớp trừu tượng chưa cần |
| Kubernetes | Quá nặng cho 1 VPS; Docker Compose đủ |
| Prometheus + Grafana | Chưa có nhu cầu vận hành liên tục |
| Elasticsearch | Truy vấn theo substring + index MongoDB đáp ứng |
| Redis Cluster | 1 instance đủ cho quy mô hiện tại |
| GPU / tăng tốc | VPS không có GPU; CPU-only là ràng buộc chấp nhận được |
| Vector database riêng (Qdrant/Milvus) | Vector nhúng trong MongoDB (`feedback_example`) đủ cho kho mẫu hiện tại |
| gRPC | Nội bộ một tiến trình + worker; REST đủ và frontend thân thiện hơn |
| Argon2 | Quyết định giữ bcrypt 12 rounds — không thay đổi phần mật khẩu |

---

# 17. Điều kiện nghiệm thu

## 17.1. Nghiệm thu công nghệ nói chung

1. Toàn bộ công nghệ trong tài liệu này hiện diện trong `package.json` của monorepo mới với phiên bản đã khoá.
2. Không module nào ở `domain/` hoặc `application/` import SDK của dịch vụ ngoài — kiểm chứng bằng quy tắc R7–R12.
3. Hệ thống khởi động thành công khi thiếu `SMTP_HOST` và khi `ai-engine` chưa sẵn sàng — chỉ log cảnh báo.
4. Biến môi trường sai kiểu làm fail sớm lúc khởi động.
5. `docker-compose.test.yml` dựng được MongoDB replica set 1 node + Redis + MinIO + Kafka KRaft 1 node.
6. Test AI không bao giờ gọi engine thật.
6b. **Không phụ thuộc nào tới SDK AI bên ngoài** trong `package.json` — kiểm chứng bằng script `check-no-external-ai`.
6c. `ai-engine` không có egress ra Internet; không có request nào tới miền bên ngoài.
6d. Mọi endpoint danh sách trả `nextCursor`/`hasMore`; không còn tham số `offset`/`page`.
6e. Endpoint upload từ chối tệp không phải `.csv` với HTTP 415 trước khi ghi vào R2.
6f. Benchmark model chạy được và có kết quả lưu tại `docs/benchmarks/`.
6g. `finding_feedback` bất biến — không có đường `update`/`delete` trong mã nguồn.
7. Coverage đạt ngưỡng theo tầng; tổng ≥ 70%.
8. `openapi.json` sinh tự động từ `packages/contracts` và được snapshot trong CI.
9. `worker` không lắng nghe port HTTP công khai.
10. Log ở định dạng JSON ra stdout, có `X-Request-Id` xuyên suốt.

## 17.2. Nghiệm thu riêng cho thay đổi thuật toán băm

| # | Điều kiện |
|---|---|
| 1 | Không còn lời gọi `createHash('sha256')` nào trong mã nguồn dự án mới — kiểm chứng bằng script quét mã nguồn |
| 2 | Tất cả trường hash trong schema có ràng buộc `max(128)` |
| 3 | `parent_hash` khởi tạo bằng `'0'.repeat(128)` |
| 4 | Công thức Merkle dùng ký tự phân tách `|` giữa 3 thành phần |
| 5 | Script migration chạy `--dry-run` và `--verify` cho kết quả khớp 100% |
| 6 | `verify()` chấp nhận cả định dạng 64 và 128 ký tự trong giai đoạn lao song; sau khi tắt cờ chỉ còn 128 |
| 7 | So sánh hash dùng `crypto.timingSafeEqual` — không dùng `===` |
| 8 | Test vector SHA-512 chuẩn khớp giá trị kỳ vọng |
| 9 | Toàn bộ `user_session` cũ đã bị xoá; mọi tài khoản đã nhận email reset mật khẩu |
| 10 | Nhánh code hash cũ (SHA-256) đã bị xoá sau 7 ngày vận hành ổn định |

---

# 18. Tóm tắt

Dự án mới **không phải là một dự án mới về công nghệ** — nó là dự án cũ được tái cấu trúc. Toàn bộ nền tảng kỹ thuật đã có sẵn và được kiểm chứng: MongoDB, Mongoose, Cloudflare R2, CASL, Zod, AES-256-GCM, PBKDF2, masking PII, outbox, transaction helper, base repository, quota storage, health check.

**Chiến lược tái sử dụng:** phần lớn thành phần được đánh dấu 🟢 hoặc 🟡 — giữ nguyên thuật toán và logic, chỉ di chuyển vị trí và tách phần phụ thuộc framework ra khỏi; phần còn lại phải viết lại 🔴 hoặc bị loại bỏ.

**Năm thay đổi v2 đã chốt (đảo ngược một số quyết định của v1):**

1. **AI cục bộ** thay Gemini API — **5 model ứng viên** (Qwen3-14B / Gemma-3-12B / Qwen3-8B / Llama-3.1-8B / Vistral-7B) + Qwen3-Embedding-0.6B, chạy bằng vLLM/Ollama. Model chốt **theo benchmark 9 chỉ số + đường Pareto trên CPU thật**, không chốt trước; kiến trúc định tuyến hai tầng do benchmark quyết định.
2. **Kafka** thay BullMQ — 5 topic, 6 consumer group, dead-letter queue, idempotent consumer.
3. **Cursor pagination** thay offset — `{ items, nextCursor, hasMore }`, cursor ký HMAC.
4. **Socket.IO** cho realtime — đẩy thông báo và tiến độ tới client, kèm Redis adapter.
5. **Chỉ `.csv`** — bỏ Excel và khái niệm sheet; 1 tệp = 1 bảng.

Cùng với đó là **vòng lặp Human-in-the-Loop**: mỗi kết quả có khối đánh giá, phản hồi lưu append-only, và RAG T1 inject tối đa 5 mẫu few-shot động vào prompt — để AI học lại từ chính người dùng.

**Thay đổi đặc biệt duy nhất về thuật toán:** SHA-256 → **SHA-512** ở toàn bộ 8 vị trí, với:

- Mật khẩu **giữ nguyên bcrypt 12 rounds** — không đổi.
- Hash cũ trong DB xử lý bằng **buộc reset mật khẩu + tính lại checksum**, không rehash-on-login.
- Giai đoạn lao song, adapter verify được **cả hai định dạng** (64 và 128 hex chars) bằng `timingSafeEqual`.

Điểm khác biệt cốt lõi so với dự án cũ không nằm ở thư viện được dùng, mà ở **ranh giới trách nhiệm**: mọi module có cùng một cấu trúc 3 tầng, mọi dịch vụ bên ngoài đều đi sau port, mọi quy tắc đều được kiểm tra tự động bằng script. Đó là thứ làm cho hệ thống có thể mở rộng tiếp mà không phải viết lại lần nữa.
