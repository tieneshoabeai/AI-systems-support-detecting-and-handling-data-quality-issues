# Kịch bản refactor — Modular Monolith lai (6 Simple + 7 Hexagonal)

> Hướng chốt: ADR-0002 (`docs/adr/0002-hybrid-modular-monolith.md`). Vỏ MM strict + ruột heterogeneous.
> Đang ở P1 (`31cd2f3`). Đọc theo thứ tự: `00_overview.md` → `01_target_architecture.md` → `02_inventory_and_metrics.md` → `03..08` từng phase → `09..13` tra cứu.

| File | Nội dung |
|---|---|
| `00_overview.md` | Tổng quan hybrid + lịch 30h + đường cắt |
| `01_target_architecture.md` | Vỏ MM + 2 template + ngưỡng Simple/Hexagonal |
| `02_inventory_and_metrics.md` | Baseline + phân loại 6S/7H + mục tiêu ~305 file |
| `03_phase_p0_p1.md` | P0/P1 đã xong (tham khảo) + cổng kiểm soát chung |
| `04_phase_p2_pilot.md` | P2 pilot `audit` (Simple mẫu) |
| `05_phase_p3_tier1.md` | P3: 5 Simple còn lại |
| `06_phase_p4_tier2.md` | P4: chuẩn hóa 4 H (không gộp) |
| `07_phase_p5_tier3.md` | P5: chuẩn hóa 3 H khó (không gộp) |
| `08_phase_p6_p7_docs_verify.md` | P6 tài liệu + P7 verify |
| `09_risk_and_rollback.md` | Rủi ro + rollback |
| `10_checklist_master.md` | Checklist theo module |
| `11_decision_log.md` | D1–D14 + đo lại từng module |
| `12_business_invariants.md` | Catalogue bất biến (đọc kèm mọi module) |
| `13_refactor_constraints.md` | Ràng buộc TC/AC/FC/BC/PC (tick trước commit) |
