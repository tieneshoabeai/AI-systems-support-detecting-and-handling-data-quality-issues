# 11. Nhật ký quyết định (Decision Log)

> File này ghi lại **mọi quyết định** trong quá trình refactor — cả những quyết định bỏ cuộc.
> Mục đích: viết ADR và báo cáo đồ án mà không phải nhớ lại.

---

## 11.1. Các quyết định đã chốt TRƯỚC khi bắt đầu

| # | Quyết định | Lý do | Ngày |
|---|---|---|---|
| D1 | Chuyển sang **Modular Monolith (vertical slice)** | Yêu cầu đồ án + nỗi đau "người mới khó hiểu" | 2026-11-21 |
| D2 | **Không rewrite** — chỉ refactor có kiểm soát | Rủi ro cao, mất rollback, không kịp 30 giờ | 2026-11-21 |
| D3 | **Giữ `shared/` nguyên vẹn** | Rủi ro cao (88 file), không đóng góp M1–M4 | 2026-11-21 |
| D4 | **Giữ `index.ts` của mỗi module** | 116 cross-module import đều qua index.ts — đã enforce tốt | 2026-11-21 |
| D5 | **Phân loại 3 tier**: T1 dễ / T2 vừa / T3 khó | Ưu tiên template đã kiểm chứng trước phần rủi ro cao | 2026-11-21 |
| D6 | **T3 (`analysis`, `auth`) chỉ di chuyển file, không gộp** | R4 — bảo mật + hiệu năng + AI worker | 2026-11-21 |
| D7 | **Không sửa assert của test** | R2 — chống "cải thiện ngầm" | 2026-11-21 |
| D8 | **82 route HTTP + WS bất biến** | R1 + quét decorator thật, chi tiết §12.1 | 2026-11-21 |
| D9 | **P6 (tài liệu) không bị cắt** | Deliverable trực tiếp cho đồ án | 2026-11-21 |
| D10 | **1 nhánh git duy nhất** | Tránh conflict — nguyên nhân phổ biến nhất trễ deadline | 2026-11-21 |
| D11 | **Hiệu chỉnh số liệu baseline theo mã thật (2026-11-23)** | Quét decorator/file thật: 340 file / 31 505 LOC, 82 route HTTP + 1 WS, 18 model / 17 file, 107 handler + 3 subscriber, 13 module | 2026-11-23 |
| D12 | **Thêm `12_business_invariants.md` làm catalogue bất biến** | Liệt kê route/handler/token/guard/transaction/hằng số để đối chiếu trước khi gộp mỗi module, chống sót nghiệp vụ | 2026-11-23 |

---

## 11.2. Quyết định trong quá trình thực thi (điền khi chạy)

> Mỗi dòng: giờ · quyết định · lý do · ảnh hưởng.

| Giờ | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| | | | |

---

## 11.3. Đường cắt đã kích hoạt (điền nếu có)

| Mốc | Đã làm xong | Cắt gì | Kết quả | Tác động lên báo cáo |
|---|---|---|---|---|
| | | | | |

> **Nếu có đường cắt, ghi rõ trong ADR.** Ví dụ:
> *"Do khung 30 giờ, 11/13 module đã được flatten; `analysis` và `auth` giữ cấu trúc 4 tầng — đây là quyết định có chủ ý ưu tiên rủi ro bảo mật/hiệu năng trên phạm vi thời gian, đã ghi nhận nợ kỹ thuật."*

---

## 11.4. Bất ngờ phát hiện (điền nếu có)

> Những thứ tưởng là đúng nhưng hoá ra khác. Ghi lại để không mất thông tin.

| Giờ | Phát hiện | Xử lý |
|---|---|---|
| | | |

**Ví dụ (đã biết trước — chi tiết ở `12_business_invariants.md` §12.2–§12.7):**
- `audit` có facade port `AUDIT_LOGGER_PORT` → đổi `LogHandler.execute()` thành `AuditService.log()` — điểm lệch duy nhất với quy ước `execute()`.
- `issues` có 2 controller (user + admin) → tách 2 file routes.
- `feedback` có 2 entity nhưng 1 repository.
- `datasets` có 2 schema + 2 repository.
- `notifications` có 2 file mapper khác ý nghĩa (DB mapping vs email rendering) — không gộp.

---

## 11.5. Kết quả đo lại (điền sau mỗi phase)

| Phase | File .ts | LOC | Thư mục con | Test | Route | Coverage |
|---|---|---|---|---|---|---|
| Baseline (hiệu chỉnh 2026-11-23) | 340 | 31 505 | ~60 | 1 277 ✅ | 82 ✅ | 71.03% |
| P1 | | | | | | |
| P2 | | | | | | |
| P3 | | | | | | |
| P4 | | | | | | |
| P5 | | | | | | |
| P6 | | | | | | |
| P7 | | | | | | |

---

## 11.6. Ghi chú tự đánh giá (điền cuối)

| Câu hỏi | Trả lời |
|---|---|
| Phần nào khó nhất? | |
| Phần nào dễ hơn dự kiến? | |
| Nếu làm lại, làm khác gì? | |
| Có nên làm tiếp P5 sau khi nộp? | |
