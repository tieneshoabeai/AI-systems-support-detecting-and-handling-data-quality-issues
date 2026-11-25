# Nhật ký bàn luận — vòng tinh chỉnh lại (2026-11-15)

> Quy ước: file này ghi lại **toàn bộ yêu cầu, vấn đề và quyết định** trong quá trình bàn luận.
> Giai đoạn này **chỉ bàn luận, chưa chỉnh sửa code**. Mọi thay đổi code/tài liệu sẽ chỉ thực hiện
> sau khi thống nhất xong và được phê duyệt.
>
> Quy ước đánh dấu trạng thái mục:
> - `[?]` — đang mở, cần người dùng làm rõ
> - `[x]` — đã thống nhất
> - `[-]` — loại bỏ / không áp dụng

## Danh mục file trong `edit/`
| File | Nội dung |
|---|---|
| `00_ban_luan.md` | File này — nhật ký, quyết định, câu hỏi mở |
| `01_doi_chieu_ba_nguon.md` | Bảng đối chiếu Excel ↔ tài liệu ↔ code (12 nhóm lệch) |
| `02_ke_hoach_thuc_thien.md` | **Kế hoạch thực thi chi tiết** — 9 nhóm công việc A–I, thứ tự, ước lượng |
| `03_yeu_cau_chat_luong_code_clean_architecture.md` | **Yêu cầu mới vòng 1 bổ sung**: ESLint, `noImplicitAny`, Clean Architecture, quy tắc dependency (Nhóm J–M) |

---

## A. Bối cảnh hiện tại (đã khảo sát)

### A1. Trạng thái mã nguồn
- Backend: `src/backend`, NestJS + MongoDB (Mongoose) + Socket.IO, 12 module:
  `analysis, audit, auth, datasets, data-view, feedback, issues, notifications, projects, realtime, users, workspaces`.
- **80 HTTP endpoint** thực tế; `audit` và `realtime` không có route HTTP (service nội bộ / WebSocket).
- **Không có thư mục `packages/`** dù `5_ports_adapters_design_v2.md` mô tả `packages/core` + `packages/contracts`.
- Chưa có frontend trong repo.
- Cơ sở dữ liệu: MongoDB (`User`, `UserSession`, `Workspace`, `Project`, `Dataset`, `DataRecord`…),
  session lưu trong collection `user_session` (TTL index `expires_at`).
- Phân trang hiện **không nhất quán**: `notifications`/`issues` dùng cursor; `workspaces`/`projects` dùng `page`/`limit`.

### A2. Trạng thái tài liệu `docs/restructures/`
15 nhóm tài liệu đa phiên bản (v1..v9). Phiên bản README đánh dấu "đang dùng":
`2_feature_catalog_v9` (85 tính năng) · `3_business_workflows_v6` (66 UC) · `4_module_boundaries_v4` (21 module) ·
`5_ports_adapters_design_v2` · `6_security_authorization_v6` · `7_api_contracts_v6` (85 endpoint + 1 WS) ·
`8_database_schema_v6` (21 collection) · `9_integrations_events_workers_v4` · `10_runtime_operations_v6` (O1–O35) ·
`11_migration_compatibility_v4` (M1–M29) · `12_processing_logic_ai_v8` · `13_testing_acceptance_plan_v7` (9 tầng) ·
`14_implementation_plan_v7` · `15_evaluation_handover_v1` · `00_cong_nghe_ky_thuat_kien_truc_hien_tai.md` (+ slides).

### A3. Vấn đề kỹ thuật đã xử lý xong trước vòng này (tham chiếu)
- Swagger không hiện nút upload → đã thêm `@ApiBody({ schema: { properties: { file: { format:'binary' } } } })`
  cho `POST /projects/:projectId/datasets/upload`.
- k6 `STAGING_TOKEN` dính ký tự lạ → đã thêm `cleanToken()` trong `test/k6/smoke.js` + `stress.js`.
- k6 `stress` xanh giả (`http_req_failed 100%`) do thiếu `DATASET_ID`/`PROJECT_ID`.

---

## B. Quyết định đã chốt trong phiên này

| # | Quyết định | Trạng thái |
|---|---|---|
| B1 | **Phạm vi vòng tinh chỉnh** = Tài liệu (`docs/restructures/`) + Code backend. Không gồm tài liệu bàn giao riêng cho frontend. | `[x]` |
| B2 | **Nguồn chuẩn** = đồng bộ hoá cả hai: `feature_nescessary.xlsx` ↔ tài liệu Markdown. | `[x]` |
| B3 | **Danh sách vấn đề**: người dùng liệt kê trước; tôi quét bổ sung (đã quét xong — `01_doi_chieu_ba_nguon.md`). | `[x]` |
| B4 | **Offline mode + hướng AI** (`remember/reask.md`): **giữ nguyên trạng thái hoãn**, không đưa vào vòng này. | `[x]` |
| B5 | **Phân trang**: chuyển toàn hệ thống sang **cursor** (keyset). Sửa `workspaces`/`projects`. | `[x]` |
| B6 | **Lịch sử/phiên bản project**: **giữ đã gỡ** (lý do storage bloat + compute bottleneck). Sửa mô tả Excel. | `[x]` |
| B7 | **Google Login**: **làm thật** trong vòng này; credential do người dùng cấp qua `.env`, không hard-code. | `[x]` |
| B8 | **"Ghi nhớ đăng nhập"**: **cả backend** — refresh token dài hạn + cờ `rememberMe` trên session. | `[x]` |
| B9 | **Báo cáo lỗi**: thêm trạng thái `needs_info` ("Cần bổ sung") + luồng user **sửa & gửi lại**. | `[x]` |
| B10 | **Tìm kiếm/lọc thành viên + endpoint tổng quan workspace**: làm **cả hai**. | `[x]` |
| B11 | **Tạo project**: mở rộng DTO với `ownerId` (**không** gộp `memberIds`, **không** gộp import dataset). | `[x]` |
| B12 | **Hồ sơ cá nhân**: thêm `phone` + `bio`. | `[x]` |
| B13 | **3 API nhỏ**: làm cả — `GET /auth/sessions/:id`, mời thành viên khi tạo workspace, `workspaceName` trong chi tiết project. | `[x]` |
| B14 | **`packages/core`/`packages/contracts`**: **cập nhật tài liệu cho khớp thực tế**, không tách monorepo. | `[x]` |
| B15 | **Tài liệu**: **sinh phiên bản mới** (v10/v7/v9…) theo quy ước `docs/restructures/README.md`. | `[x]` |
| B16 | **Dùng ESLint** — cài + flat config + tích hợp pre-commit/CI. Chưa có ESLint trong repo; script `lint`/`format` hiện gọi binary không tồn tại. | `[x]` |
| B17 | **`noImplicitAny`** — đã bật trong `tsconfig.json`; bổ sung siết thêm: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `noUnusedLocals/Parameters`. | `[x]` |
| B18 | **Tái kiến trúc chuẩn Clean Architecture** — không cần giống dự án mẫu. Giữ cấu trúc `domain/application/infrastructure` hiện có (đã khớp 4 nguyên tắc chính); tái cấu trúc phần còn lệch. | `[x]` |
| B19 | **Quy tắc phụ thuộc/độc lập giữa các tầng** — bắt buộc, kiểm tự động bằng 2 lớp: ESLint `no-restricted-imports` (lỗi lúc viết code) + test `test/clean-architecture.spec.ts` (chặn CI). | `[x]` |

---

## C. Kết quả quét — 12 nhóm lệch (chi tiết: `01_doi_chieu_ba_nguon.md`)

| # | Hạng mục | Mức độ | Kết luận |
|---|---|---|---|
| 2.1 | Phân trang: Excel yêu cầu **offset**, tài liệu chốt **cursor**, code **trộn cả hai** | 🔴 | → **Nhóm A** (cursor toàn hệ thống) |
| 2.2 | Google Login (`AUTH-03`) — code đang trả **501** | 🟡 | → **Nhóm B** (làm thật) |
| 2.3 | "Ghi nhớ đăng nhập" — code **không có** khái niệm | 🟢 | → **Nhóm C** (rememberMe ở backend) |
| 2.4 | Lịch sử hoạt động + phiên bản project + rollback — tài liệu **đã gỡ** | 🔴 | → **Giữ đã gỡ**, sửa mô tả Excel |
| 2.5 | Endpoint **tổng quan/thống kê** workspace — **không có** | 🟡 | → **Nhóm E3/E4** |
| 2.6 | **Tìm kiếm + lọc vai trò** danh sách thành viên — **không có** query param | 🟡 | → **Nhóm E1/E2** |
| 2.7 | Trạng thái "Cần bổ sung" + luồng sửa/gửi lại — **thiếu cả hai** | 🟡 | → **Nhóm D** |
| 2.8 | Tạo project chưa chỉ định được Project Owner | 🟡 | → **Nhóm F** (chỉ `ownerId`) |
| 2.9 | Hồ sơ cá nhân thiếu **Phone** + **Giới thiệu** | 🟢 | → **Nhóm G** |
| 2.10 | `GET /auth/sessions/:id` — **thiếu** | 🟢 | → **Nhóm H1** |
| 2.11 | Mời thành viên ngay khi tạo workspace — DTO thiếu | 🟢 | → **Nhóm H2** |
| 2.12 | `workspaceName` trong chi tiết project — **thiếu** | 🟢 | → **Nhóm H3** |

### Ghi chú bổ sung (ngoài Excel)
| # | Hạng mục | Kết luận |
|---|---|---|
| G1 | `packages/core` + `packages/contracts` trong docs vs **thực tế không có** | → **Nhóm I1** (cập nhật docs) |
| G2 | README bảng "Báo cáo xuất ra (Word)" trỏ tới file đã bị xóa | → **Nhóm I2** |
| G3 | Docs khai 85 endpoint, code có **80** | → **Nhóm I3** |

---

## D. Câu hỏi mở còn lại

| # | Câu hỏi | Trạng thái |
|---|---|---|
| D1 | `POST /auth/login` khi `rememberMe=true`: hạn refresh token 30 ngày hay 90 ngày? | `[?]` — đề xuất mặc định 30 ngày, cấu hình qua env |
| D2 | `user_session.expires_at` đang có TTL index `{ expires: '7d' }` — cần đổi sang TTL theo giá trị thật để hỗ trợ 30 ngày | Đã ghi vào **C2**, không cần hỏi |
| D3 | Google OAuth: khi `google_id` đã gắn cho user khác → trả `409` hay `403`? | `[?]` — đề xuất `409 CONFLICT` |
| D4 | `memberEmails` khi tạo workspace: email chưa có tài khoản → tạo `pending` hay báo lỗi? | `[?]` — đề xuất tạo pending-invite |
| D5 | `workspaceName` populate: cần thêm query tới `workspaces` hay dùng join trong repository? | Đã ghi vào **H3**, quyết định khi code |
| LQ1 | **Mức độ sửa cross-module coupling** (L3) — **L3a: ĐẦY ĐỦ** — xoá hết import service chéo, mọi cross-module call đi qua port đã export từ module sở hữu | `[x]` **L3a** |
| LQ2 | ESLint: bật rule nghiêm (`--max-warnings 0`) **sau khi dọn** (Bước 7) | `[x]` |
| LQ3 | `noUncheckedIndexedAccess` — **bật vòng này** | `[x]` |
| LQ4 | Vị trí `StoragePort` — giữ `shared/ports/` | `[x]` (chốt) |
| LQ5 | Tách `commands/` + `queries/` — **LÀM THẬT trong vòng này** | `[x]` |
| LQ6 | Bắt buộc `import type` 100% (`consistent-type-imports`) | `[x]` (chốt) |

---

## E. Trạng thái hiện tại

**Bàn luận yêu cầu: HOÀN TẤT (vòng 1).** Đã chốt 19 quyết định (B1–B19), 13 nhóm công việc A–M với
chi tiết từng mã việc, thứ tự thực thi và ước lượng khối lượng.

**Phát hiện quan trọng ở vòng bổ sung:**
- ESLint **chưa được cài** — script `lint`/`format` hiện gọi binary không tồn tại.
- `noImplicitAny` **đã bật**; phần cần làm là siết thêm các cờ TS khác.
- Clean Architecture: 4/5 nguyên tắc đã đúng, còn **3 vi phạm cụ thể** (2 vi phạm R3 cross-schema,
  8 vi phạm R2 cross-service, ~19 vi phạm R6 public contract).
- Quy tắc dependency kiểm được bằng **2 lớp**: ESLint `no-restricted-imports` + test kiến trúc
  (mẫu sẵn có: `test/zero-any.spec.ts`).

**Bước tiếp theo:** chờ người dùng phê duyệt `edit/02_ke_hoach_thuc_thien.md` +
`edit/03_yeu_cau_chat_luong_code_clean_architecture.md`, sau đó bắt đầu
**Bước 0 (J0 cài ESLint + K0 siết TS + M0 test kiến trúc ở mức báo cáo)** rồi mới tới
**Nhóm A + C + D**.
