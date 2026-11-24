# 0. Tổng quan kịch bản thực thi (Hybrid 6+7)

> **Mục đích:** Tái cấu trúc backend từ **Clean 4 tầng đồng nhất** → **Modular Monolith lai (heterogeneous)** trong 30 giờ, **không đổi hành vi quan sát được từ bên ngoài**.
>
> **Ngày lập:** 2026-11-21 · **Viết lại:** 2026-11-24 theo ADR-0002 (thay hướng slice-toàn-bộ bằng hybrid 6+7) · **Trạng thái:** Sẵn sàng thực thi (đang ở P1 `31cd2f3`)

---

## 0.1. Bối cảnh & động lực

| Vấn đề thực tế | Bằng chứng |
|---|---|
| **Người mới khó hiểu nhóm module đơn giản** | 4 tầng × 6 module đơn giản = 4 thư mục phải grep cho 1 request chỉ đọc/view; `audit` 8 file/353 LOC vẫn chia 4 tầng |
| **Yêu cầu đồ án: modular monolith** | Bài nộp cần cấu trúc modular monolith rõ ràng, chứng minh bằng công cụ (ESLint MM2 + arch test + `index.ts`) |
| **Over-engineering có chọn lọc** | 107 handler + 3 subscriber; nhóm đơn giản phần lớn là wrapper 1-1; nhóm phức tạp thì hexagonal đang gánh thật (transaction/outbox/policy/AI worker) |
| **Ép 1 template cho cả 13 module là sai** | Đã revert 5 commit slice-toàn-bộ về P1 — module phức tạp mất chỗ bảo vệ invariant, module đơn giản không có gì để bảo vệ |

## 0.2. Hướng đi đã chốt (ADR-0002): vỏ Modular Monolith + ruột heterogeneous

- **Vỏ giữ strict:** 1 process/deploy, 1 `AppModule`, 1 `shared/` kernel, 13 module, `index.ts` public contract, cấm import sâu (MM2).
- **Ruột chia 2 template:**
  - **Simple (monolith bên trong): 6 module** — `audit, overview, data-view, realtime, notifications, feedback`
  - **Hexagonal (giữ 4 tầng): 7 module** — `analysis, auth, datasets, projects, workspaces, users, issues`
- Chi tiết ngưỡng Simple-vs-Hexagonal + cấu trúc đích xem `01_target_architecture.md`. Catalogue bất biến xem `12_business_invariants.md`.

## 0.3. Baseline đã đo (điểm xuất phát P1)

| Chỉ số | Giá trị | Cách đo |
|---|---|---|
| File `.ts` trong `src/modules/` | **340** | `find src/modules -name '*.ts'` |
| LOC trong `src/modules/` | **31 505** | `wc -l` |
| File `.ts` trong `src/shared/` | **88** | — |
| LOC trong `src/shared/` | **5 567** | — |
| HTTP route | **82 HTTP + 1 WS gateway** | `pnpm arch:api-coverage` |
| Command/Query handler | **107** (61 cmd + 46 query) + 3 subscriber | inventory handler |
| Cross-module import | **116**, 100% qua `index.ts` (MM2 đã đạt ở P1) | quét AST |
| Test | **1 277** (1 069 unit/arch + 138 integration + 70 e2e) | `pnpm test*` |
| Mongoose model | **18 (17 file schema)** | `MongooseModule.forFeature` |
| Mục tiêu mới (hybrid) | **~305 file / -~3 000 LOC / -~30 thư mục con** (thay vì ~180 file của hướng cũ) | chỉ flatten 6 Simple, 7 Hexagonal chỉ chuẩn hóa |

## 0.4. Nguyên tắc bất di bất dịch (giữ + sửa R4)

> **R1 — Hành vi bên ngoài không đổi.** Route, request/response shape, status code, side-effect, DB schema: giữ nguyên tuyệt đối.
>
> **R2 — Test là điểm tựa.** Không bao giờ commit khi test đỏ. Test đỏ → revert ngay, không debug > 15 phút.
>
> **R3 — Commit + tag sau mỗi module/phase.** Luôn có một bản nộp được ở mọi thời điểm.
>
> **R4 (sửa) — 7 module Hexagonal không gộp.** `analysis, auth, datasets, projects, workspaces, users, issues` chỉ được *chuẩn hóa import + tài liệu*, không gộp entity/port/handler. 6 module Simple mới được flatten.
>
> **R5 — Đường cắt sẵn.** Định nghĩa trước dự phòng để không phải quyết định lúc 27h.
>
> **R6 (mới) — Bất biến 13_refactor_constraints.** `session/outbox`, `ensureNotAdmin/isObjectIdHex/deleted_at/camel-snake`, thứ tự guard + route, TTL/index: giữ nguyên cho cả 2 template.

## 0.5. Bản đồ tài liệu của kịch bản này (đã viết lại 2026-11-24)

| File | Nội dung | Dùng khi nào |
|---|---|---|
| `00_overview.md` | File này — tổng quan hybrid 6+7 | Đọc đầu tiên |
| `01_target_architecture.md` | Vỏ MM + 2 template ruột + ngưỡng Simple/Hexagonal | Trước P2 |
| `02_inventory_and_metrics.md` | Baseline + phân loại 6 Simple / 7 Hexagonal + mục tiêu ~305 file | Trước P2 |
| `03_phase_p0_p1.md` | P0 baseline + P1 ESLint/arch rule (đã xong ở `31cd2f3`, giữ nguyên) | Tham khảo |
| `04_phase_p2_pilot.md` | P2 pilot `audit` (Simple template) — quan trọng nhất | Phase 2 |
| `05_phase_p3_tier1.md` | P3 — 5 Simple còn lại: `overview → realtime → data-view → notifications → feedback` | Phase 3 |
| `06_phase_p4_tier2.md` | P4 — chuẩn hóa 4 Hexagonal: `datasets, projects, workspaces, users` (không gộp) | Phase 4 |
| `07_phase_p5_tier3.md` | P5 — chuẩn hóa 3 Hexagonal khó nhất: `issues, analysis, auth` + lý do `issues` ở lại Hexagonal | Phase 5 |
| `08_phase_p6_p7_docs_verify.md` | P6 tài liệu + P7 verify (82+1 route + type-check + lint + test) | Phase 6–7 |
| `09_risk_and_rollback.md` | Rủi ro + rollback (bổ sung rủi ro xóa nhầm invariant ở Simple) | Bất cứ lúc nào |
| `10_checklist_master.md` | Checklist tổng hợp theo giờ (bản hybrid) | Dùng như bảng điều khiển |
| `11_decision_log.md` | Nhật ký quyết định (D1–D12 giữ + thêm D13, D14 hybrid) | Điền khi chạy |
| `12_business_invariants.md` | Catalogue bất biến — **đọc kèm mọi phase, cả 2 template** | Mọi phase |
| `13_refactor_constraints.md` | Ràng buộc TC/AC/BC/PC — áp dụng cho cả Simple lẫn Hexagonal | Mọi phase |

## 0.6. Lịch trình 30 giờ (bản hybrid — việc ít hơn, chắc hơn)

```
Giờ:  0    5    10   15   20   25   30
       │    │    │    │    │    │    │
P0+P1 ─┤ ĐÃ XONG (31cd2f3) │    │    │    │  ADR + baseline + MM2
P2 ────┤    │    ├ 2h│    │    │    │    │  PILOT: audit (Simple template)
P3 ────┤    │    │    ├ 5h│    │    │    │  5 Simple còn lại
P4 ────┤    │    │    │    ├ 6h│    │    │  Chuẩn hóa 4 Hexagonal (không gộp)
P5 ────┤    │    │    │    │    ├ 4h│    │  Chuẩn hóa 3 Hexagonal khó
P6 ────┤    │    │    │    │    │    ├ 6h│  Tài liệu (README template/module)
P7 ────┤    │    │    │    │    │    │  ├ 3h Verify + buffer
```

**Tổng: ~20h việc + buffer.** Phần việc code giảm so với hướng cũ vì 7 Hexagonal không gộp.

### Đường cắt (định nghĩa trước)

| Mốc thời gian | Đã làm xong | Hành động |
|---|---|---|
| **Giờ 12** | Chưa xong P3 | **Cắt `feedback` (Simple khó nhất) sang P6** → làm tài liệu ghi nợ, không cố gộp |
| **Giờ 18** | Chưa xong P4 | **Cắt P4/P5 còn lại** → sang P6 viết tài liệu — tài liệu luôn có giá trị |
| **Giờ 26** | Chưa xong P6 | **Dừng code, chỉ verify + polish** |
| **Bất kỳ lúc nào** | Test đỏ > 15 phút | **Revert về tag gần nhất**, ghi `notes.md`, sang module sau |

> **Nguyên tắc cắt:** *Cắt theo thứ tự P5 → P4 → feedback → P3. Tài liệu (P6) luôn giữ lại cuối cùng.*

## 0.7. Rủi ro số 1: "trough of sorrow" + rủi ro số 2: xóa nhầm invariant ở Simple

| Rủi ro | Phòng ngừa (bắt buộc) |
|---|---|
| Nửa chừng nản (giờ 18–22) | Tag sau **mỗi module** (`v1.2.0-audit`, `-overview`, …); không debug > 15 phút |
| Xóa nhầm `session/outbox/policy/guard` khi gộp Simple | Đối chiếu `12_business_invariants.md` + `13_refactor_constraints.md` trước khi gộp; checklist cấm xóa trong `04/05` |
| Nhầm 2 mapper `notifications` / 2 entity `feedback` | Giữ file riêng như `04/05` đã ghi; reviewer check đúng dòng này |
| Không refactor sau giờ 20 | Từ giờ 20 chỉ viết tài liệu + verify |
| Ghi nhận quyết định | `docs/refactor/notes.md` + `11_decision_log.md` — để viết ADR sau cùng |
