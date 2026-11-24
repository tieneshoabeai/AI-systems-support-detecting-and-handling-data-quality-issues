# 11. Nhật ký quyết định (Decision Log, bản hybrid)

## 11.1. Quyết định đã chốt TRƯỚC khi chạy lại (giữ D1–D12, sửa hướng)

| # | Quyết định | Lý do | Ngày |
|---|---|---|---|
| D1 | Vỏ **Modular Monolith** (13 module + index.ts + MM2 + shared + 1 deploy) | Yêu cầu đồ án + ranh giới đã enforce tốt | 2026-11-21 |
| D2 | Không rewrite — refactor có kiểm soát | Rủi ro + rollback + kịp giờ | 2026-11-21 |
| D3 | Giữ `shared/` nguyên | 88 file, rủi ro cao, không đóng góp M1–M4 | 2026-11-21 |
| D4 | Giữ `index.ts` mỗi module | 116 import đã qua contract | 2026-11-21 |
| D5 | Chia 2 template: Simple × 6 + Hexagonal × 7 (thay tier cũ T1/T2/T3) | Ép 1 template cho 13 module là sai — đã revert 5 commit | 2026-11-24 |
| D6 | 7 Hexagonal (`analysis, auth, datasets, projects, workspaces, users, issues`) chỉ chuẩn hóa, cấm gộp (R4 mới) | Bảo vệ tx/outbox/policy/worker/session | 2026-11-24 |
| D7 | Không sửa assert của test | Chống cải thiện ngầm (R2) | 2026-11-21 |
| D8 | 82 HTTP + 1 WS bất biến | R1 + contract đã chốt | 2026-11-21 |
| D9 | P6 tài liệu không bị cắt | Deliverable trực tiếp | 2026-11-21 |
| D10 | 1 nhánh duy nhất | Tránh conflict | 2026-11-21 |
| D11 | Hiệu chỉnh baseline theo mã thật (340/31 505/107+3/18 model) | Quét thật 2026-11-23 | 2026-11-23 |
| D12 | `12_business_invariants.md` + `13_refactor_constraints.md` là catalogue bất biến cho cả 2 template | Chống sót nghiệp vụ khi gộp Simple | 2026-11-23 |
| D13 | ADR-0002 thay hướng slice-toàn-bộ bằng hybrid 6+7; ADR-0001 giữ làm lịch sử | Revert về P1 `31cd2f3` | 2026-11-24 |
| D14 | `issues` ở lại Hexagonal (khác hướng cũ để ở P3) | optimistic locking + 1 controller chứa 2 nhóm route user + `admin/*` + cascade — đủ ngưỡng giữ H | 2026-11-24 |

---

## 11.2. Quyết định trong quá trình thực thi (điền khi chạy)

| Giờ | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| | | | |

## 11.3. Đường cắt đã kích hoạt (điền nếu có)

| Mốc | Đã làm xong | Cắt gì | Kết quả |
|---|---|---|---|
| | | | |

## 11.4. Bất ngờ phát hiện (điền nếu có)

| Giờ | Phát hiện | Xử lý |
|---|---|---|
| | | |

Đã biết trước (từ `12_business_invariants.md`):
- `audit`: `execute()` → `log()` (facade duy nhất đổi tên).
- `notifications`: 2 mapper khác nghĩa — cấm gộp.
- `feedback`: 2 entity/1 repo + `ensureNotAdmin` + camel/snake.
- Thứ tự route: `sessions/me` trước `:id` (auth), `unread-count` trước `:id` (notifications).

## 11.5. Kết quả đo lại (điền sau mỗi module)

| Module/Phase | File .ts | LOC | Thư mục con | Test | Route | Ghi chú |
|---|---|---|---|---|---|---|
| Baseline P1 (`31cd2f3`) | 340 | 31 505 | ~60 | 1 277 ✅ | 82+1 ✅ | — |
| P2 audit | 338 | 31 439 | -5 subdirs (audit phang) | xanh (arch+guard+contract) | 84/84 | LogHandler+adapter gop thanh AuditService.log() |
| P3 overview | 338 | 31 416 | subdirs 150->146 | xanh (step3 34/34 + arch/guard/contract) | 84/84 | 2 handler gop thanh OverviewService; tooling + guard ho tro *.routes.ts |
| P3 realtime | 338 | 31 416 | subdirs 146->139 | xanh (realtime 47/47 + arch/guard/contract) | 84/84 | git mv 6 file ra goc, giu @Global + gateway config + subscriber OnModuleInit |
| P3 data-view | 329 | 31 306 | subdirs 139->131 | xanh (data-view/chart 52 + arch/guard/contract) | 84/84 | 4 handler gop thanh DataViewService; 3 DTO gop vao routes; VO/entity gop vao types |
| P3 notifications | 320 | 31 200 | subdirs 131->127 | xanh (notifications 48/48 + guard/step1) | 84/84 | 6 handler gop thanh NotificationsService; 2 mapper GIU RIENG; 2 DTO gop vao routes |
| P3 feedback | 311 | ~31 000 | subdirs 127->123 | xanh (feedback 33/33 + guard/contract) | 84/84 | 7 handler gop thanh FeedbackService; 2 entity chung 1 repo/model; 3 DTO gop vao routes |
| P4 (4 H) | | | | | | file không đổi |
| P5 (3 H) | | | | | | file không đổi |

## 11.6. Tự đánh giá (điền cuối)

| Câu hỏi | Trả lời |
|---|---|
| Phần nào khó nhất? | |
| Phần nào dễ hơn dự kiến? | |
| Nếu làm lại, làm khác gì? | |
| Có nên flatten thêm module H sau khi nộp? | |
