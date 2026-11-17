# BỘ TÀI LIỆU ĐẶC TẢ YÊU CẦU (SRS) — HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU

**Phạm vi:** Giai đoạn 1 (Core Platform MVP)
**Nguồn chuẩn:** [feature_spec_v4.md](../feature_spec_v4.md)

## Mục lục

| # | Tài liệu | Nội dung | Trạng thái |
|---|---|---|---|
| 01 | [Bối cảnh](01_boi-canh.md) | Bài toán, hiện trạng, mục tiêu, bên liên quan, actor, thuật ngữ | Hoàn thành |
| 02 | [Phạm vi](02_pham-vi.md) | In/out-of-scope, phân kỳ, giới hạn dữ liệu, ràng buộc, giả định | Hoàn thành |
| 03 | Chức năng | Danh sách chức năng, use case theo module | Chưa viết |
| 04 | Yêu cầu chức năng (FR) | FR có ID và tiêu chí chấp nhận | Chưa viết |
| 05 | Yêu cầu phi chức năng (NFR) | Bảo mật, hiệu năng, độ tin cậy, khả dụng, bảo trì | Chưa viết |
| 06 | Luồng nghiệp vụ | Flow tổng thể, flow chính, flow lỗi | Chưa viết |
| 07 | Đặc tả API | Input/output, flow chính/lỗi của từng API | Chưa viết |
| 08 | Ma trận truy vết | Chức năng ↔ FR ↔ API ↔ Flow | Chưa viết |

## Quy ước ID

| Loại | Định dạng | Ví dụ |
|---|---|---|
| Module | `M1`…`M9` | M5 = Dataset |
| Chức năng | `F<m>.<n>` (giữ mã spec) | F5.1 Upload Dataset |
| Yêu cầu chức năng | `FR-<m>.<n>` (1-1 với F) | FR-5.1 |
| Yêu cầu phi chức năng | `NFR-<NHÓM>-<n>` | NFR-SEC-01 |
| Luồng nghiệp vụ tổng thể | `BF-<n>` | BF-1 |
| Use case / luồng chính | `UC-<m>.<n>` | UC-5.1 |
| Luồng lỗi | `UC-<m>.<n>-E<k>` | UC-5.1-E2 |
| API | `API-<nn>` (số thứ tự bảng tổng kết spec) | API-30 |

Ký hiệu `[CẦN XÁC NHẬN]` đánh dấu chỗ nguồn mâu thuẫn hoặc thiếu, chờ nhóm quyết định.
