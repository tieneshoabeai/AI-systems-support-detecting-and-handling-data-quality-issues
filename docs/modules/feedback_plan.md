# KẾ HOẠCH MODULE FEEDBACK
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ
**Tập tin:** `docs/modules/feedback_plan.md`
**Phiên bản:** v1.0 (2026-11-24)

---

## 1. Hiện trạng module

- Mã nguồn: `src/backend/src/modules/feedback/` (Template Simple):
  - `feedback.controller.ts`: 7 route `FB-01`…`FB-07` kèm DTO Zod;
  - `feedback.service.ts`;
  - `feedback.types.ts`: entity `Feedback`, port, input;
  - `feedback.repository.ts`, `feedback.mapper.ts`, `finding-feedback.schema.ts`;
  - `feedback.utils.ts` (`toPlain`).
- Phụ thuộc:
  - `analysis`: `ANALYSIS_REPOSITORY_PORT` (run, kết quả, kho mẫu few-shot), `RAG_FEW_SHOT_PORT`, các hàm `rag-few-shot.util.ts`;
  - `projects` / `workspaces`: kiểm tra quyền;
  - `users`: tên hiển thị;
  - `realtime`: `feedback.created`;
  - `audit`: `AUDIT_LOGGER_PORT`, từ v1.0.
- Hợp đồng:
  - Phần 6 v9 §3.5b (quyền);
  - Phần 7 v14 §3.13 dòng 80–86, §3.17.1, **§3.24**;
  - Phần 8 v13 §3.7.5–3.7.6;
  - Phần 12 v15 §3.16, **§3.24**.

## 2. Đợt sửa 2026-11-24 — rà soát module feedback

- **Trạng thái:** Đã thực hiện 2026-11-24.
- **Test:** Phần 13 v16 mục 3.29 (FBT-01…FBT-13).
- **Quyết định của người dùng:**
  - mẫu RAG theo khuôn, không dùng `reason`;
  - ngưỡng vào kho ≥ 3 người;
  - nhận xét phát hiện cần run `succeeded`, nhận xét cả run cho `succeeded` hoặc `failed`;
  - sửa/xoá nhận xét của mình cần còn quyền xem project (theo Phần 6).

### 2.1. Lỗi đã xác nhận từ mã nguồn

| # | Mức | Lỗi | Vị trí (trước khi sửa) |
|---|---|---|---|
| L1 | Cao | `reason` (chỉ che email/SĐT) thành mô tả mẫu RAG, rồi bị chèn nguyên văn vào prompt AI của cả workspace. Trái Phần 6/12 và có rủi ro prompt injection | `promoteFindingToStore`; `rag-few-shot.service.ts` → `renderFewShotBlock` |
| L2 | Cao | Chủ nhận xét đã bị gỡ khỏi project, hoặc project đã xoá, vẫn sửa/xoá được | `updateMine`, `remove` (nhánh chủ) |
| L3 | Trung bình | 2 người đã đủ vào kho RAG (`computeTrustScore(2) = 0.65`), trong khi hợp đồng yêu cầu ≥ 3 | `rag-few-shot.util.ts` |
| L4 | Trung bình | 3 người cùng nhãn nhưng khác `reason` tạo ra 3 mẫu; sửa/xoá nhận xét không cập nhật kho mẫu | `promoteFindingToStore` |
| L5 | Trung bình | Xoá vi phạm không ghi audit log; sửa nhận xét không giữ lịch sử | `remove`, `updateMine` |
| L6 | Trung bình | Gửi được nhận xét vào run `pending`/`running` | `resolveRunProject` |
| L7 | Thấp | Thiếu `meta.limit`; `summary` bị lọc theo `?label`; GET không kiểm tra `findingId` > 200; N+1 khi lấy tên tác giả; `promptVersion` gán cứng; ID sai trả 404; `assertReasonForLabel` ném `Error` trần | service, controller, types |

### 2.2. Hướng sửa

- `syncFindingExample`:
  - mô tả theo khuôn `(loại lỗi, đặc tính cột, nhãn)`;
  - đặc tính cột được làm sạch, tối đa 80 ký tự;
  - gom trùng theo mô tả;
  - đếm lại số người và cập nhật trust khi tạo, sửa (nhãn cũ và nhãn mới) và xoá.
- `computeTrustScore(2) = 0.55`; `isEligibleForStore` = `≥ 3 người` **và** `trust ≥ 0.6`.
- `updateMine` / `remove`:
  - ID sai → 400;
  - chủ nhận xét phải còn quyền project, kiểm tra bằng `resolveProjectAccess`.
- `resolveRunProject` nhận danh sách trạng thái cho phép; sai trạng thái → `ConflictError`.
- Audit qua `AUDIT_LOGGER_PORT` (`@Optional`): `FEEDBACK_MODERATION_DELETED` (kèm nội dung), `FEEDBACK_UPDATED` (kèm giá trị trước/sau).
- Danh sách:
  - `meta.limit`;
  - `summary` đếm toàn phạm vi;
  - `findingId` ≤ 200 ở GET;
  - lấy tên tác giả bằng `users.findByIds`.

### 2.3. Không làm trong đợt này

- **OPEN-FB-01:** quét một lần các mẫu cũ trong `few_shot_examples` có `reason` nguyên văn.
- Xoá cứng feedback khi xoá project. Hiện feedback đã bị chặn truy cập vì project trả NotFound, và TTL 365 ngày sẽ dọn.
- Trường `is_anonymized` (Phần 8). Không thêm `finding_key`/`version` vào schema vì Phần 8 không có.
- Đối chiếu `findingId` với kết quả phân tích (RISK `FB-006`), vì kết quả không sinh sẵn mã phát hiện.
- Dispatch domain event của entity `Feedback` (hiện không có nơi tiêu thụ).

### 2.4. Kết quả

- `tsc` 0 lỗi, `lint` 0 cảnh báo, `test:arch` 23/23, `arch:api-coverage` 84/84.
- Unit `test/feedback-v14.spec.ts`: 28/28 ca mới. Các test cũ của feedback/RAG vẫn đạt; riêng `corr-vif-ai.spec.ts` đổi assert ngưỡng có chủ đích.
- Integration `repositories-domain` + `repositories-analysis`: 56/56 (thêm 3 ca FBT-13).
- `test:unit` toàn bộ: chỉ 2 lỗi môi trường đã biết (`/proc/meminfo`). Integration toàn bộ: 170/173 (3 lỗi MinIO đã biết).

---

## 3. Lịch sử thay đổi

- **v1.0 / 2026-11-24:** Tạo kế hoạch module. Đợt sửa sau rà soát được người dùng yêu cầu (kèm plan Antigravity).
