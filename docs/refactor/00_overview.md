# 0. Tổng quan kịch bản thực thi

> **Mục đích:** Tái cấu trúc backend từ **Clean Architecture 4 tầng** → **Modular Monolith (vertical slice)** theo yêu cầu đồ án, trong 30 giờ, **không đổi hành vi quan sát được từ bên ngoài**.
>
> **Ngày lập:** 2026-11-21 · **Trạng thái:** Sẵn sàng thực thi

---

## 0.1. Bối cảnh & động lực

| Vấn đề thực tế | Bằng chứng |
|---|---|
| **Người mới khó hiểu codebase** | 4 tầng × 14 module = 4 thư mục phải grep cho mỗi request; 339 file `.ts` trong `src/modules/` |
| **Yêu cầu đồ án: modular monolith** | Bài nộp cần cấu trúc modular monolith rõ ràng, có thể chứng minh bằng công cụ |
| **Over-engineering** | 107 handler sinh bằng codemod, phần lớn là wrapper 1-1; 14 rule kiến trúc để bảo vệ cấu trúc đã thành gánh nặng đồng bộ |

## 0.2. Baseline đã đo (điểm xuất phát)

| Chỉ số | Giá trị | Cách đo |
|---|---|---|
| File `.ts` trong `src/modules/` | **339** | `find src/modules -name '*.ts'` |
| LOC trong `src/modules/` | **31 076** | `wc -l` |
| File `.ts` trong `src/shared/` | **88** | — |
| LOC trong `src/shared/` | **5 567** | — |
| HTTP route | **84** | `pnpm arch:api-coverage` |
| Command/Query handler | **107** (61 cmd + 46 query) | `19_handler_inventory.md` |
| Cross-module import | **116**, đều qua `index.ts` | quét AST |
| Test | **1 277** (1 069 unit/arch + 138 integration + 70 e2e) | `pnpm test*` |
| Mongoose model | **20** (19 file schema) | `MongooseModule.forFeature` |

## 0.3. Nguyên tắc bất di bất dịch

> **R1 — Hành vi bên ngoài không đổi.** Route, request/response shape, status code, side-effect, DB schema: giữ nguyên tuyệt đối.
>
> **R2 — Test là điểm tựa.** Không bao giờ commit khi test đỏ. Test đỏ → revert ngay, không debug lâu.
>
> **R3 — Commit + tag sau mỗi phase.** Luôn có một bản nộp được ở mọi thời điểm.
>
> **R4 — Không đụng `analysis` và `auth` logic.** Hai module này chỉ được *di chuyển file*, không *gộp*.
>
> **R5 — Đường cắt sẵn.** Định nghĩa trước dự phòng để không phải quyết định lúc 27h.

## 0.4. Bản đồ tài liệu của kịch bản này

| File | Nội dung | Dùng khi nào |
|---|---|---|
| `00_overview.md` | File này — tổng quan, nguyên tắc, bản đồ | Đọc đầu tiên |
| `01_target_architecture.md` | Cấu trúc đích + quy tắc + lý do | Trước P1 |
| `02_inventory_and_metrics.md` | Số liệu baseline chi tiết từng module | Trước P2 |
| `03_phase_p0_p1.md` | P0 baseline + P1 ESLint/arch rule | Phase 0–1 |
| `04_phase_p2_pilot.md` | P2 pilot `audit` — tạo template | Phase 2 (**quan trọng nhất**) |
| `05_phase_p3_tier1.md` | P3 — 5 module dễ | Phase 3 |
| `06_phase_p4_tier2.md` | P4 — 5 module vừa | Phase 4 |
| `07_phase_p5_tier3.md` | P5 — `analysis`/`auth` chỉ di chuyển | Phase 5 |
| `08_phase_p6_p7_docs_verify.md` | P6 tài liệu + P7 verify | Phase 6–7 |
| `09_risk_and_rollback.md` | Rủi ro + kịch bản rollback | Bất cứ lúc nào |
| `10_checklist_master.md` | Checklist tổng hợp theo giờ | Dùng như bảng điều khiển |

## 0.5. Lịch trình 30 giờ

```
Giờ:  0    5    10   15   20   25   30
       │    │    │    │    │    │    │
P0 ────┤ 2h│    │    │    │    │    │  ADR + baseline + sơ đồ
P1 ────┤    ├ 3h │    │    │    │    │  ESLint rule + arch test
P2 ────┤    │    ├ 2h│    │    │    │    │  PILOT: module audit
P3 ────┤    │    │    ├ 3h│    │    │    │  Tier 1 (5 module dễ)
       │    │    │    │    │    │    │
P4 ────┤    │    │    │    ├ 8h│    │    │  Tier 2 (5 module vừa)
P5 ────┤    │    │    │    │    ├ 3h│    │  Tier 3 (chỉ di chuyển)
P6 ────┤    │    │    │    │    │    ├ 6h│    │  Tài liệu
P7 ────┤    │    │    │    │    │    │    ├ 3h  Verify + buffer
```

**Tổng: 30h** (buffer 3h nằm trong P7)

### Đường cắt (định nghĩa trước — không quyết định lúc chạy)

| Mốc thời gian | Đã làm xong | Hành động |
|---|---|---|
| **Giờ 12** | Chưa xong P3 | **Cắt P4 → chỉ làm 2 module dễ nhất của Tier 2** (`issues`, `notifications`) |
| **Giờ 20** | Chưa xong P4 | **Cắt P4 & P5 hoàn toàn** → sang P6 (tài liệu) — tài liệu luôn có giá trị |
| **Giờ 26** | Chưa xong P6 | **Dừng code, chỉ verify + polish** — không viết tài liệu mới |
| **Bất kỳ lúc nào** | Test đỏ > 15 phút | **Revert về tag gần nhất**, ghi nhận vào `notes.md`, sang phase sau |

> **Nguyên tắc cắt:** *Cắt theo thứ tự P5 → P4 → P3. Tài liệu (P6) luôn được giữ lại cuối cùng vì nó là deliverable trực tiếp cho đồ án.*

## 0.6. Rủi ro số 1: "trough of sorrow"

Sau ~18–22 giờ bạn sẽ ở trạng thái: code đã đổi một nửa, chưa xong, deadline đang đến. Đây là lúc 60% người ta muốn bỏ cuộc.

**Phòng ngừa (bắt buộc làm):**

| Cơ chế | Hành động cụ thể |
|---|---|
| Luôn có bản chạy được | Tag `v1.1.0` → `v1.2.0-p1` → `v1.2.0-p2` → … sau **mỗi** phase |
| Không debug quá 15 phút | Test đỏ → revert hoặc ghi TODO rồi đi tiếp |
| Không refactor sau giờ 20 | Từ giờ 20 chỉ viết tài liệu + verify |
| Ghi nhận quyết định | `docs/refactor/notes.md` — quyết định + lý do, để viết ADR sau cùng |
