# MÔ-ĐUN `overview` — Tổng quan (Template: Simple)

> **P3.1 (2026-11-24):** Flatten từ Hexagonal → Simple Monolith theo ADR-0002.
> - Vì sao Simple: 2 query chỉ-đọc, không DB riêng, không invariant/transaction/outbox.
> - Bất biến: E3 `GET /overview/workspaces` (tránh xung đột `/workspaces/:id`), E4 `GET /workspaces/:id/overview`; `Promise.all` đếm song song; 2 port WORKSPACE/PROJECT_REPOSITORY_PORT; `NotFoundError` E4; guard Jwt+Policies + WorkspacePolicyLoader.
> - Cấu trúc mới: `overview.service.ts + overview.routes.ts + overview.types.ts + index.ts + overview.module.ts` (imports WorkspacesModule + ProjectsModule, không exports).
> - Tooling: `*.routes.ts` được quét như controller (`check-api-coverage.cjs`, `extract-routes.cjs`, `api-contract-coverage.spec.ts`); `guard-coverage.spec.ts` đã thêm OverviewController — 84/84 route.
> - Cấm: đổi Symbol port (TC-03), bỏ guard/policy (BC), đổi strict/best-effort (BC-02).

---
# MÔ-ĐUN `overview` — Tổng quan

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/overview` (5 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun trả về số liệu tóm tắt cho màn hình dashboard: số liệu tổng hợp mà không cần chạm vào từng mô-đun.

Đây là mô-đun **chỉ đọc**. Không có command handler, không có domain event phát ra.

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Tổng quan người dùng | Số workspace, project, dataset, phân tích của tôi |
| Tổng quan workspace | Thống kê theo từng project trong workspace |

### 2.2. Cấu trúc thư mục

```text
overview/
|-- application/
|   |-- queries/
|   |   |-- get-user-overview.handler.ts
|   |   `-- get-workspace-overview.handler.ts
|   `-- overview.types.ts
|-- presentation/controllers/overview.controller.ts
`-- overview.module.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Cung cấp một API tóm tắt cho dashboard, để frontend không phải gọi 5–6 endpoint khác nhau chỉ để vẽ một màn hình tổng quan.

- **Lập luận kỹ thuật & Quyết định:**

1. **Không có `domain/` riêng.** Mô-đun này **không có quy tắc nghiệp vụ** riêng cần biên dịch — tất cả số liệu lấy từ repository của mô-đun khác qua port. Tạo `domain/` rỗng sẽ chỉ là nhiễu.

2. **Không có command handler, không có event.** Mô-đun chỉ đọc — không được tạo hay sửa dữ liệu.

3. **Tính nhiều chỉ số trong một lần quét.** Mô-đun dùng **pipeline aggregation** với `$facet` để tính nhiều chỉ số theo từng project trong một lần quét cơ sở dữ liệu, thay vì chạy nhiều truy vấn riêng lẻ. Với dataset lớn, cách này khác biệt giữa chạy được và không chạy được.

4. **Chỉ lấy số liệu cần cho dashboard.** Không đưa dữ liệu chi tiết (bảng bản ghi, danh sách đầy đủ) vào response tổng quan — response phải nhẹ.

- **Hiện vật đã tạo / đã sửa:**

- `application/queries/get-user-overview.handler.ts` — tổng quan người dùng.
- `application/queries/get-workspace-overview.handler.ts` — tổng quan workspace, dùng `$facet`.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/overview/workspaces` | Thành viên | Tổng quan của tôi |
| `GET` | `/api/v1/workspaces/:id/overview` | Thành viên workspace | Tổng quan workspace |

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/overview/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `OverviewModule` | Mô-đun Nest |

### 4.3. Sự kiện domain phát ra

> Mô-đun này **không phát sự kiện** — nó thuần là lớp đọc dữ liệu tổng hợp.

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

- Chỉ số phải phản ánh đúng trạng thái hiện tại của dữ liệu mà người dùng được xem.
- Không được lộ dữ liệu chi tiết vào response tổng quan.
- Chỉ tính số liệu của workspace mà người dùng **là thành viên**.
- Số liệu phải được tính trong **một** pipeline aggregation khi có thể.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Xem tổng quan workspace người khác | Policy loader kiểm tra instance |
| Lộ dữ liệu qua response | Chỉ trả số liệu tổng hợp |
| Truy vấn lặp quá nhiều lần | Aggregation `$facet` gom nhiều chỉ số trong một lần quét |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `GET /overview/workspaces` | Lọc theo vai trò của tôi |
| `GET /workspaces/:id/overview` | Thành viên workspace |

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `get-workspace-overview.handler.ts` dùng `$facet` / Một lần quét cơ sở dữ liệu cho nhiều chỉ số / `modules/overview`
- **v0.5.0** / 2026-11-XX / Bổ sung `get-user-overview.handler.ts` / Dashboard tổng quan cá nhân / `modules/overview`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun / Lớp đọc tổng hợp, tách khỏi `projects` / `modules/overview`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
