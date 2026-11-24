# `test/unit/feedback/` — 4 tệp kiểm thử phản hồi

Thư mục này kiểm thử entity phản hồi và toàn bộ luồng wave7. Chuỗi `describe` dưới đây chép nguyên văn từ code (trong code không dấu nên giữ nguyên để đối chiếu).

| Tệp | Các `describe` thật trong code |
|---|---|
| `feedback-entity.spec.ts` | `factory` ; `truy vấn` ; `updateByAuthor()` ; `softDelete()` ; `toProps()` (5 describe — vòng đời tạo, sửa bởi tác giả, xóa mềm) |
| `feedback-wave7.spec.ts` | `Wave7 FB-01/FB-02: tao nhan xet` ; `Wave7 FB-03/FB-04: xem + tong hop + an danh` ; `Wave7 FB-05: sua/xoa` ; `Wave7 FB-06 + append-only/TTL` (4 describe — tạo nhận xét, xem và tổng hợp ẩn danh, sửa/xóa, ghi nối tiếp) |
| `feedback-v14.spec.ts` | `FBT-01 — sửa/xoá nhận xét của mình cần CÒN quyền project (FB-R6, FB-R7)` ; `FBT-02 — trạng thái lần phân tích khi tạo nhận xét (FB-R4)` ; `FBT-03 / FBT-04 / FBT-05 — danh sách (FB-R1, FB-R2, FB-R3)` ; `FBT-06 / FBT-07 / FBT-08 — mẫu RAG theo khuôn (FB-R11, Phần 12 v15 §3.24)` ; `FBT-09 — audit log (FB-R8, FB-R9)` ; `FBT-10 / FBT-11 — ảnh chụp AI và realtime (FB-R10, FB-R12)` (6 describe — Phần 13 v17 mục 3.29, 3.30) |
| `feedback-example-template.spec.ts` | `feedback-example-template (FST-01)` (1 describe — khuôn mẫu RAG dùng chung cho service và migration `scrub-few-shot`, Phần 13 v18 mục 3.31) |

Nội dung được giữ: tạo nhận xét cho finding/run, `false_positive` bắt buộc có `reason`, chỉ chủ sở hữu được đọc, dữ liệu chỉ ghi thêm và tự hết hạn.

Liên quan: `test/e2e/feedback-notifications-overview.e2e-spec.ts`.

Chạy: `npx jest test/unit/feedback --no-coverage`.
