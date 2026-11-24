# Module `audit` — Nhật Ký Kiểm Toán (Chỉ Ghi Nối Tiếp)

Ghi nhật ký mọi hành động quan trọng để truy vết và đối soát. Chỉ ghi nối tiếp (append-only), không sửa/xóa, không có REST controller. 6 tệp + index.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/audit/`
- Loại kiến trúc: phẳng/service-based, chỉ ghi.
- Sở hữu: collection `audit_logs`.
- Cung cấp: `AUDIT_LOGGER_PORT` (ghi), `AUDIT_REPOSITORY_PORT` (đọc nội bộ/test), `AuditService`, `AuditRepository`.
- Được dùng bởi: mọi controller (`auth`, `workspaces`, `projects`, `datasets`, `analysis`, `issues`) tiêm `AUDIT_LOGGER_PORT` để ghi.

## 2. Từng tệp làm gì (7 tệp)

| Tệp | Vai trò chi tiết |
|---|---|
| `audit.service.ts` | Hiện thực `AUDIT_LOGGER_PORT.log(action, actor, target, change)`: thêm `requestId`, `at`, `ip`, rồi `insert` (không await chặn request, lỗi chỉ log). |
| `audit.repository.ts` | `insert/listByTarget/listByActor` bằng Mongoose. Không có update/delete. |
| `audit.schema.ts` | Schema `AuditLog`: `action, actor_id, target_type, target_id, change {before/after}, request_id, ip, created_at`. Index `(target_type, target_id, created_at)`. |
| `audit.types.ts` | `AuditAction` (LOGIN, CRUD_WORKSPACE/PROJECT/DATASET, ANALYSIS, REPORT, ISSUE_STATUS, FEEDBACK_UPDATED, FEEDBACK_MODERATION_DELETED, AI_JOB_RETRIED, AI_RESULT_INGESTED...), `AuditTargetType`, `CreateAuditLogInput`, 2 PORT token. |
| `audit.module.ts` | Đăng ký schema + service/repository, export `AUDIT_LOGGER_PORT`. |
| `index.ts` | Public contract (PORT, kiểu, service, repository). |

## 3. Tích hợp (không có controller)

- Controller tiêm `@Inject(AUDIT_LOGGER_PORT) logger` rồi gọi `logger.log(...)` sau mỗi hành động: đăng nhập, CRUD workspace/project/dataset, chạy analysis, sinh report, đổi trạng thái issue, tải tệp.
- Trong e2e, mock bằng `{ log: jest.fn() }` để không ghi DB thật nhưng vẫn assert đã gọi.
- Không đọc audit qua API công khai; chỉ test/service nội bộ đọc để đối soát.

## 4. Bất biến

- Chỉ insert, không update/delete (append-only, giữ chuỗi truy vết).
- Ghi audit không bao giờ chặn request chính: lỗi audit chỉ log, request vẫn 200/201.
- Không ghi dữ liệu nhạy cảm (password, token thô, PII thô) vào `change`.

## 5. Test liên quan

`test/unit/infra/` (audit fail-safe), mọi suite e2e đều mock `AUDIT_LOGGER_PORT` và assert số lần gọi.
