# MÔ-ĐUN `audit` — Nhật ký kiểm toán (Template: Simple)

> **P2 (2026-11-24):** Flatten từ Hexagonal 4 tầng → Simple Monolith theo ADR-0002.
> - Vì sao Simple: 1 cmd nội bộ best-effort, DB append-only mỏng, không invariant/transaction/policy.
> - Bất biến: facade `AUDIT_LOGGER_PORT`, method `AuditService.log()` (gộp từ `LogHandler.execute()` + `AuditLoggerAdapter.log()`); giữ `RETENTION_DAYS=365` + TTL `expires_at` + `toOid/isObjectIdHex` slice + `resolveMongoSession` + `@Global()` + best-effort try/catch warn.
> - Cấu trúc mới: `audit.service.ts + audit.repository.ts + audit.schema.ts + audit.types.ts + index.ts + audit.module.ts` (không có `routes.ts` vì không có HTTP route).
> - Cấm: đổi Symbol port (TC-03), bỏ session (TC-05), đổi strict/best-effort (BC-02).

---
# MÔ-ĐUN `audit` — Nhật ký kiểm toán

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/audit` (8 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun ghi lại **mọi thao tác nhạy cảm** vào một nhật ký chỉ ghi thêm (append-only): ai, làm gì, lúc nào, trên tài nguyên nào, kết quả ra sao.

> **Nguyên tắc:** nhật ký kiểm toán **không bao giờ** được sửa hoặc xoá. Không có API cập nhật hay xoá nhật ký.

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Ghi nhật ký | Ghi hành động của người dùng / hệ thống |
| Truy vấn | Đọc nhật ký theo tiêu chí lọc (admin) |

### 2.2. Cấu trúc thư mục

```text
audit/
|-- application/commands/log.handler.ts
|-- domain/ports/
|   |-- audit-logger.port.ts       # AUDIT_LOGGER_PORT
|   `-- audit.repository.port.ts   # cổng ghi + đọc
|-- infrastructure/
|   |-- adapters/audit-logger.adapter.ts
|   `-- persistence/
|       |-- audit-log.schema.ts
|       `-- audit.repository.ts
`-- audit.module.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Bảo đảm mọi thao tác nhạy cảm đều **truy vết được**, và việc ghi nhật ký không được làm hỏng luồng nghiệp vụ chính.

- **Lập luận kỹ thuật & Quyết định:**

1. **Hai cổng tách biệt.** `AuditLogger` (dùng cho mô-đun khác) và `AuditRepository` (dùng cho tầng trình bày). Cổng `AuditLogger` nằm ở **domain** — bất kỳ mô-đun nào cũng ghi nhật ký mà không cần biết MongoDB.

2. **Cổng mặt tiền (facade) để tránh phụ thuộc trực tiếp.** Controller của mô-đun khác **không** import trực tiếp `AuditService` của mô-đun `audit`. Mô-đun `audit` **sở hữu** hợp đồng này, xuất qua `modules/audit/index.ts` (hợp đồng công khai) và gắn token tới `AuditService` trong `AuditModule`. Cách này giữ ranh giới giữa các mô-đun mà vẫn dùng DI.

3. **Ghi nhật ký theo kiểu cố gắng tối đa (best-effort).** `log(input, changes)` có lỗi sẽ bị bắt và ghi lại, **không** ném ra ngoài. Một lỗi ghi nhật ký không được làm mất hành động của người dùng (ví dụ: đăng nhập vẫn thành công dù ghi audit log thất bại).

4. **Chỉ có đường ghi.** `AuditLogger` chỉ có `log(...)` — không mở repository cho đọc. Truy vấn chỉ qua `AuditRepository` (tầng trình bày, phía admin).

5. **Chỉ ghi thêm thuần tuý.** Collection không có `deleted_at`, không có `updated_at`. Không có API cập nhật hay xoá nhật ký.

- **Hiện vật đã tạo / đã sửa:**

- `domain/ports/audit-logger.port.ts` — `AUDIT_LOGGER_PORT` (`Symbol`), interface `AuditLoggerPort` với phương thức `log(input, changes?)`.
- `domain/ports/audit.repository.port.ts` — `CreateAuditLogInput`, `AuditChangeInput`.
- `infrastructure/adapters/audit-logger.adapter.ts` — hiện thực cổng, bắt lỗi.
- `infrastructure/persistence/audit-log.schema.ts` — schema MongoDB + 2 chỉ mục.
- `application/commands/log.handler.ts` — xử lý ghi nhật ký.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

Mô-đun audit **không có controller HTTP** — không tồn tại tuyến đường nào trên `/api/v1/audit/*`.

| Giao diện | Hình thức | Mô tả |
|---|---|---|
| `AUDIT_LOGGER_PORT.log(...)` | Cổng (nội bộ) | Mô-đun khác ghi nhật ký qua token cổng, **không** qua HTTP |
| `AuditRepositoryPort.findLogs(...)` | Cổng (nội bộ) | Truy vấn nhật ký cho mã nội bộ / báo cáo |

> **Lưu ý:** bảng trong bản "Đặc tả" của hợp đồng §3.13 cũng không có tuyến `/audit/logs` — 84 tuyến hiện hành không bao gồm audit. Truy vấn nhật ký cho quản trị chưa được mở tuyến HTTP; nếu cần, sẽ phải thêm controller + chính sách `@Roles('admin')` và đồng bộ lại hợp đồng.

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/audit/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `AuditModule` | Mô-đun Nest |
| `AUDIT_LOGGER_PORT` | Cổng ghi nhật ký (dùng bởi mô-đun khác) |
| `AuditLoggerPort` | Interface ghi nhật ký |

### 4.3. Sự kiện domain phát ra

> Mô-đun này **không phát sự kiện**. Nó **ghi** nhật ký về các sự kiện của mô-đun khác.

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

| Trường | Bắt buộc |
|---|---|
| `userId` | `null` cho hành động hệ thống |
| `action` | Không rỗng |
| `entityType` | Không rỗng |
| `createdAt` | Tự động |
| `expiresAt` | Cho phép null (lưu lâu dài) |

- Mọi bản ghi có `created_at` — **không** có `updated_at`.
- Mọi bản ghi có `expires_at` — cho phép xoá theo quy tắc lưu trữ (tự động, phục vụ cho phân quyền đọc, không phải xoá thủ công).
- `targetLabel` tối đa 200 ký tự; `ipAddress` tối đa 45 ký tự; `userAgent` tối đa 500 ký tự.
- Không có API sửa hoặc xoá nhật ký.
- Ghi nhật ký **không** được làm hỏng luồng nghiệp vụ chính.

### 5.2. Xoá mềm (Soft Delete)

Mô-đun này **không áp dụng xoá mềm** — nhật ký là append-only, không có `deleted_at`. Quy tắc `deleted_at: null` của repository nền không áp dụng ở đây.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Sửa nhật ký để che dấu vết | Append-only, không có API sửa / xoá |
| Lỗi audit làm mất hành động | `log()` bắt lỗi, ghi lại, không ném ra ngoài |
| Xoá nhật ký thủ công | Không có đường xoá thủ công; chỉ tự động theo `expires_at` |
| Rò rỉ PII trong nhật ký | Chỉ lưu id, loại, nhãn, metadata; không lưu giá trị dữ liệu nghiệp vụ |
| Truy vấn nhật ký không phải admin | Chưa mở tuyến HTTP; khi mở tuyến mới phải gắn `@Roles('admin')` |
| Truy vấn chậm trên nhật ký lớn | Chỉ mục `{ actor_id, created_at }` và `{ target_type, target_id, created_at }` |

### 5.4. Phân quyền

Mô-đun này **không có tuyến HTTP**, nên không có bảng phân quyền theo tuyến. Quyền được áp dụng ở tầng ghi:

| Giao diện | Chính sách |
|---|---|
| `AUDIT_LOGGER_PORT` | Chỉ mô-đun trong hệ thống mới gọi được (qua token DI, không phải HTTP) |
| Truy vấn nhật ký | Chưa mở tuyến; nếu mở phải có `@Roles('admin')` + ghi audit cho bản ghi đọc |

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `AUDIT_LOGGER_PORT` và `audit-logger.adapter.ts` kiểu best-effort / Mô-đun khác ghi nhật ký mà không phụ thuộc trực tiếp / `modules/audit`
- **v0.5.0** / 2026-11-XX / Bổ sung `expires_at` và chỉ mục theo tác nhân / theo đối tượng / Truy vấn nhật ký trên quy mô lớn không chậm / `modules/audit`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun / Truy vết thao tác nhạy cảm / `modules/audit`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
