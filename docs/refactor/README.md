# Kịch bản thực thi — Refactor sang Modular Monolith

> **Mục đích:** Tái cấu trúc backend từ Clean Architecture 4 tầng → Modular Monolith (vertical slice).
> **Khung:** 30 giờ · **Nguyên tắc:** không đổi hành vi quan sát được từ bên ngoài.

---

## Danh mục

| File | Nội dung | Dùng khi nào |
|---|---|---|
| [00_overview.md](00_overview.md) | Tổng quan, baseline, nguyên tắc R1–R5, lịch trình 30h, đường cắt | Đọc đầu tiên |
| [01_target_architecture.md](01_target_architecture.md) | Cấu trúc đích, quy tắc MM1–MM6, quy tắc đặt tên file | Trước P1 |
| [02_inventory_and_metrics.md](02_inventory_and_metrics.md) | Số liệu baseline từng module, bảng quy đổi file, script đo | Trước P2 |
| [03_phase_p0_p1.md](03_phase_p0_p1.md) | P0 baseline/ADR + P1 ESLint & arch test | Phase 0–1 |
| [04_phase_p2_pilot.md](04_phase_p2_pilot.md) | **P2 pilot `audit`** — tạo template | Phase 2 ⭐ |
| [05_phase_p3_tier1.md](05_phase_p3_tier1.md) | P3 — 6 module dễ | Phase 3 |
| [06_phase_p4_tier2.md](06_phase_p4_tier2.md) | P4 — 5 module trung bình | Phase 4 |
| [07_phase_p5_tier3.md](07_phase_p5_tier3.md) | P5 — `analysis`/`auth` chỉ di chuyển | Phase 5 |
| [08_phase_p6_p7_docs_verify.md](08_phase_p6_p7_docs_verify.md) | P6 tài liệu + P7 verify | Phase 6–7 |
| [09_risk_and_rollback.md](09_risk_and_rollback.md) | 11 rủi ro + kịch bản rollback A/B/C/D | Bất cứ lúc nào |
| [10_checklist_master.md](10_checklist_master.md) | Checklist theo từng giờ + đường cắt | Bảng điều khiển |
| [11_decision_log.md](11_decision_log.md) | Nhật ký quyết định | Điền khi chạy |

---

## Tóm tắt trong 60 giây

| | |
|---|---|
| **Vấn đề** | 339 file, 4 tầng/module, 14 luật kiến trúc → người mới khó hiểu; đồ án yêu cầu modular monolith |
| **Quyết định** | Flatten mỗi module thành 1 thư mục phẳng (routes + service + schema + types) |
| **Bất biến** | 84 route · 107 handler · 20 model · 1 277 test · không đổi logic |
| **Rủi ro chính** | Hết giờ + "cải thiện ngầm" → đã có đường cắt + quy tắc git |
| **Cổng kiểm soát** | type-check 0 · lint 0 · 1 069 test · 84/84 route · link 0 broken |

---

## 5 nguyên tắc bất di bất dịch

1. **R1** — Hành vi bên ngoài không đổi (route, response, DB, side-effect)
2. **R2** — Test là điểm tựa; không commit khi test đỏ
3. **R3** — Commit + tag sau mỗi phase → luôn có bản nộp được
4. **R4** — Không đụng logic `analysis` / `auth`
5. **R5** — Đường cắt định nghĩa trước, không quyết định lúc 27h

---

## Trạng thái

| Hạng mục | Trạng thái |
|---|---|
| Kịch bản | ✅ Hoàn tất — sẵn sàng thực thi |
| ADR | ⬜ Viết ở P0 (có mẫu trong `03_phase_p0_p1.md` §3.2) |
| `notes.md` | ⬜ Tạo ở P0 |
| Baseline tag | ⬜ Tạo ở P0 |
| ESLint rule MM2 | ⬜ Viết ở P1 |
| `modular-monolith.spec.ts` | ⬜ Viết ở P1 |
| `measure-refactor.sh` | ⬜ Viết ở P1 |
| Pilot `audit` | ⬜ Thực hiện ở P2 |
