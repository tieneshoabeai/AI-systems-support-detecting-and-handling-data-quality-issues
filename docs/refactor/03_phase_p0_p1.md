# 3. Phase P0 + P1 — Baseline & công cụ enforce (ĐÃ XONG, giữ nguyên)

> **Trạng thái:** Đã hoàn thành ở commit `31cd2f3` (`chore(refactor): P1 enforce ranh gioi module`). File này giữ để tham khảo, chỉ cập nhật thuật ngữ theo ADR-0002.
> **Viết lại:** 2026-11-24 — MM5 cũ (ép phẳng) đổi thành MM5' (chỉ check ranh giới module).

---

## 3.1. P0 — Đóng băng baseline (đã xong)

- Tag `v1.1.0-baseline` + `notes.md` + ADR-0001 + `architecture-diagram.md`: đã có.
- Bổ sung sau P1: ADR-0002 (`docs/adr/0002-hybrid-modular-monolith.md`) thay hướng slice-toàn-bộ bằng hybrid 6+7. ADR-0001 giữ làm lịch sử.

## 3.2. P1 — Công cụ enforce (đã xong)

- ESLint MM2 (cấm deep cross-module import, chỉ qua `index.ts`): giữ nguyên.
- Arch test ranh giới module + `scripts/measure-refactor.sh`: giữ nguyên.
- **Điều chỉnh duy nhất theo hybrid:**
  - Test "mỗi module không còn thư mục con" (MM5 cũ) **KHÔNG áp dụng toàn repo** nữa.
  - Chỉ áp dụng cho 6 module Simple (`audit, overview, data-view, realtime, notifications, feedback`) sau khi flatten.
  - 7 module Hexagonal (`analysis, auth, datasets, projects, workspaces, users, issues`) được phép giữ `application/ + domain/ + infrastructure/ + presentation/`.

## 3.3. Cổng kiểm soát chung — áp dụng MỌI module/phase (bản hybrid)

```bash
cd src/backend

# 1. TypeScript
pnpm type-check                       # phải: 0 lỗi

# 2. Lint
pnpm lint                             # phải: 0 cảnh báo

# 3. Unit + architecture
pnpm exec jest --maxWorkers=2         # suites/tests phải xanh

# 4. Contract API
pnpm arch:api-coverage                # phải khớp 82 HTTP + 1 WS ở 12_business_invariants.md §12.1

# 5. Đo lại
bash scripts/measure-refactor.sh      # ghi vào notes.md + 11_decision_log.md §11.5

# 6. Checklist khóa refactor (bắt buộc, khác nhau theo template)
# Simple: tick hết 13_refactor_constraints.md §13.6 (TC/AC/FC/BC/PC) + giữ entity nhẹ/mapper riêng như 04/05 đã ghi
# Hexagonal: tick kiểm tra không gộp nhầm + import qua index.ts + README ghi Template: Hexagonal
```

> **Nếu đỏ > 15 phút:** `git reset --hard <tag gần nhất>` → ghi `notes.md` → sang module sau (R2).
> **Tag sau mỗi module:** `v1.2.0-audit`, `v1.2.0-overview`, ... để luôn có bản chạy được.

## 3.4. Output của phase này

| Artifact | Đường dẫn | Trạng thái |
|---|---|---|
| ADR-0001 | `docs/adr/0001-modular-monolith.md` | giữ (lịch sử) |
| ADR-0002 | `docs/adr/0002-hybrid-modular-monolith.md` | mới, hướng chốt |
| Ghi chú | `docs/refactor/notes.md` | cập nhật sau mỗi module |
| ESLint MM2 | `eslint.config.mjs` | đã xong |
| Arch test | `test/modular-monolith.spec.ts` + `test/clean-architecture.spec.ts` (giữ cho H) | điều chỉnh MM5 → MM5' |
| Script đo | `scripts/measure-refactor.sh` | đã có |
| Tag | `v1.1.0-baseline` → `v1.2.0-p1` (`31cd2f3`) | đã xong |
