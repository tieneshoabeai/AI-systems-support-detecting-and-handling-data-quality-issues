# `test/unit/feedback/` — 2 tệp kiểm thử phản hồi

Thư mục này kiểm thử entity phản hồi và toàn bộ luồng wave7. Chuỗi `describe` dưới đây chép nguyên văn từ code (trong code không dấu nên giữ nguyên để đối chiếu).

| Tệp | Các `describe` thật trong code |
|---|---|
| `feedback-entity.spec.ts` | `factory` ; `truy vấn` ; `updateByAuthor()` ; `softDelete()` ; `toProps()` (5 describe — vòng đời tạo, sửa bởi tác giả, xóa mềm) |
| `feedback-wave7.spec.ts` | `Wave7 FB-01/FB-02: tao nhan xet` ; `Wave7 FB-03/FB-04: xem + tong hop + an danh` ; `Wave7 FB-05: sua/xoa` ; `Wave7 FB-06 + append-only/TTL` (4 describe — tạo nhận xét, xem và tổng hợp ẩn danh, sửa/xóa, ghi nối tiếp) |

Nội dung được giữ: tạo nhận xét cho finding/run, `false_positive` bắt buộc có `reason`, chỉ chủ sở hữu được đọc, dữ liệu chỉ ghi thêm và tự hết hạn.

Liên quan: `test/e2e/feedback-notifications-overview.e2e-spec.ts`.

Chạy: `npx jest test/unit/feedback --no-coverage`.
