---
name: viet-tai-lieu-do-an
description: Viết bộ tài liệu đặc tả chuẩn đồ án (SRS) trong docs/srs/ cho hệ thống phát hiện và xử lý chất lượng dữ liệu - bối cảnh, phạm vi, chức năng, FR, NFR, luồng nghiệp vụ (chính/lỗi), input/output từng API. Dùng khi người dùng yêu cầu viết, bổ sung hoặc rà soát các tài liệu này.
---

# Viết tài liệu đồ án (SRS)

## Mục tiêu
Sinh bộ tài liệu đặc tả bằng tiếng Việt (giữ thuật ngữ tiếng Anh) trong `docs/srs/`. Chỉ viết tài liệu, không sửa code. Mọi luồng viết dạng bước đánh số để người dùng tự vẽ hình (activity/sequence/use case) sau.

## Nguồn (thứ tự ưu tiên)
1. `docs/feature_spec_v4.md` — **nguồn chuẩn** cho chức năng, endpoint, input/output, ràng buộc (kể cả tính năng "đề xuất thêm").
2. `docs/report_overview_v5.md` — phân kỳ giai đoạn 1/2, giới hạn dữ liệu, rủi ro.
3. `docs/01..08_*.md` — bối cảnh, kiến trúc, dữ liệu, cơ chế bảo mật, kiểm thử, AI.
4. `docs/modules/*.md`, `docs/report/*.md`, `docs/api/*.md`.
5. Code `src/backend/src/modules/*` (controller + `dto/`) và `src/frontend` — chỉ để đối chiếu, ghi chú khi lệch spec.

Khi nguồn mâu thuẫn hoặc thiếu: ghi `[CẦN XÁC NHẬN: ...]` tại chỗ và hỏi người dùng. Không bịa số liệu, endpoint, mã lỗi.

## Cấu trúc thư mục `docs/srs/`
| File | Nội dung |
|---|---|
| `00_muc-luc.md` | Mục lục, quy ước ID, trạng thái từng tài liệu |
| `01_boi-canh.md` | Bài toán, hiện trạng, mục tiêu, các bên liên quan, actor |
| `02_pham-vi.md` | In-scope / out-of-scope, giai đoạn, giới hạn, giả định, ràng buộc |
| `03_chuc-nang.md` | Danh sách chức năng theo module, actor, ưu tiên, use case |
| `04_yeu-cau-chuc-nang.md` | FR |
| `05_yeu-cau-phi-chuc-nang.md` | NFR |
| `06_luong-nghiep-vu.md` | Flow tổng thể, flow chính, flow lỗi theo module |
| `07_api/<nn>_<module>.md` | Đặc tả từng API |
| `08_truy-vet.md` | Ma trận truy vết chức năng ↔ FR ↔ API ↔ flow |

## Quy ước ID
- Module: M1 Auth, M2 Users, M3 Workspace, M4 Project, M5 Dataset, M6 Visualization, M7 Transformation, M8 Version & Lineage, M9 Export.
- Chức năng: giữ nguyên mã spec `F<m>.<n>`.
- FR: `FR-<m>.<n>` ánh xạ 1-1 với `F<m>.<n>`; FR bổ sung ngoài spec dùng `FR-<m>.X<n>`.
- NFR: `NFR-<NHÓM>-<n>` (SEC, PERF, REL, USA, MAIN, COMP, PORT).
- Flow: `UC-<m>.<n>` (luồng chính), `UC-<m>.<n>-E<k>` (luồng lỗi), `BF-<n>` (luồng nghiệp vụ tổng thể).
- API: `API-<số thứ tự bảng tổng kết spec>`.

## Template

### FR
| ID | Tên | Mô tả (Hệ thống phải ...) | Actor | Ưu tiên (Bắt buộc/Đề xuất) | Tiêu chí chấp nhận | Nguồn |

### NFR
Nhóm theo ISO/IEC 25010. Mỗi dòng: ID, yêu cầu, chỉ số đo được, cách kiểm chứng, nguồn.

### Flow (dùng cho 06 và từng API)
```
UC-x.y <Tên>
Actor: ...   Tiền điều kiện: ...   Hậu điều kiện: ...
Luồng chính:
  1. [Actor] ...
  2. [FE] ...
  3. [BE] ...
Luồng lỗi:
  E1 (tại bước n) <điều kiện> → <mã HTTP> <phản hồi> → <kết thúc/quay lại bước>
```

### API
```
### API-nn: <Tên> (F<m>.<n>)
- Method + Path:
- Auth / Quyền:
- Input: Path params | Query | Headers | Body (bảng: trường, kiểu, bắt buộc, ràng buộc)
- Output thành công: mã HTTP + cấu trúc JSON
- Mã lỗi: bảng (mã, điều kiện, message)
- Luồng chính / Luồng lỗi: bước đánh số
- FR liên quan:
```

## Quy trình vòng lặp
Tối đa 6 vòng; mỗi vòng: đọc nguồn → viết → tự review → `git add` đúng file của vòng → commit `docs: SRS vòng N - ...` → báo cáo + câu hỏi.

## Checklist tự review
- [ ] Mọi nội dung có nguồn; chỗ không chắc đã gắn `[CẦN XÁC NHẬN]`.
- [ ] ID nhất quán với `00_muc-luc.md` và các file trước.
- [ ] Link tương đối đúng.
- [ ] Không chứa secret/giá trị `.env`.
- [ ] Flow có actor rõ từng bước, đủ để vẽ hình.
