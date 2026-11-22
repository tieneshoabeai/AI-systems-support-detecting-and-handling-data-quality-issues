# 10. Checklist tổng hợp — bảng điều khiển 30 giờ

> **In file này ra, hoặc giữ nguyên trong editor cạnh terminal.** Tick theo thứ tự.

---

## 10.1. Trước khi bắt đầu (10 phút)

```
☐  Đọc 00_overview.md (nguyên tắc R1–R5)
☐  Đọc 01_target_architecture.md
☐  Đọc 09_risk_and_rollback.md §9.2 (cải thiện ngầm)
☐  Xác nhận: deadline thật sự còn bao lâu
☐  Xác nhận: làm một mình hay có team
☐  Tạo git branch: git checkout -b refactor/modular-monolith
☐  Ghi giờ bắt đầu vào notes.md
```

---

## 10.2. P0 — Baseline (2 giờ) ⏱ `0h → 2h`

```
☐  0.1  git commit baseline + tag v1.1.0-baseline
☐  0.2  Tạo docs/refactor/notes.md với số liệu baseline
☐  0.3  Viết docs/adr/0001-modular-monolith.md
☐  0.4  Tạo docs/refactor/architecture-diagram.md (trước/sau)
☐  0.5  Ghi bảng "reset point" vào 09_risk_and_rollback.md §9.4
☐  VERIFY: git tag --list 'v1.1.0*'
```

---

## 10.3. P1 — Công cụ enforce (3 giờ) ⏱ `2h → 5h`

```
☐  1.1  ESLint rule MM2: cấm deep cross-module import
☐  1.2  test/modular-monolith.spec.ts — MM5 (module phẳng)
☐  1.3  test/modular-monolith.spec.ts — MM6 (service không HTTP exception)
☐  1.4  scripts/measure-refactor.sh + chmod +x
☐  1.5  Chạy eslint --fix nếu có lỗi mới
☐  VERIFY: type-check 0 · lint 0 · arch test xanh
☐  COMMIT + TAG v1.2.0-p1
```

---

## 10.4. P2 — PILOT `audit` (2 giờ) ⏱ `5h → 7h` 🔴 **QUAN TRỌNG NHẤT**

```
☐  2.1  git mv 7 file vào vị trí mới
☐  2.2  Viết audit.types.ts (gộp 2 port file)
☐  2.3  Viết audit.service.ts (AuditService implement AuditLoggerPort)
☐  2.4  Sửa audit.repository.ts + audit.schema.ts (import path)
☐  2.5  Sửa audit.module.ts (provider)
☐  2.6  Sửa index.ts (public contract)
☐  2.7  rm -rf domain/ application/ infrastructure/
☐  2.8  grep -rn "LogHandler\|AuditLoggerAdapter" src/ test/  → 0
☐  VERIFY: type-check 0 · lint 0 · test xanh · coverage 84/84 · MM5 pass
☐  COMMIT + TAG v1.2.0-p2-pilot
```

> **⏸ DỪNG TẠI ĐÂY.** Nếu pilot chưa qua → đọc §4.8, cân nhắc phương án B (đóng băng).

---

## 10.5. P3 — Tier 1 (3 giờ) ⏱ `7h → 10h`

```
☐  3.1  overview      (20 phút)  → tag
☐  3.2  realtime      (30 phút)  → tag
☐  3.3  data-view     (35 phút)  → tag
☐  3.4  notifications (40 phút)  → tag
☐  3.5  feedback      (45 phút)  → tag
☐  3.6  issues        (50 phút)  → tag
☐  VERIFY Tổng P3: 7 module phẳng · 1 069 test · 84 route
☐  COMMIT + TAG v1.2.0-p3
☐  ⏰ CHECKPOINT: giờ 12 → nếu trễ, cắt sang P6
```

---

## 10.6. P4 — Tier 2 (8 giờ) ⏱ `10h → 18h`

```
☐  4.1  users      (2 giờ)     → tag
☐  4.2  workspaces (1h45)       → tag
☐  4.3  projects   (2 giờ)     → tag
☐  4.4  datasets   (2h15)       → tag
☐  VERIFY Tổng P4: 11 module phẳng · 1 069 test · 84 route
☐  COMMIT + TAG v1.2.0-p4
☐  ⚠  datasets: KIỂM TRA kỹ — không thêm route, giữ transaction/outbox
```

---

## 10.7. P5 — Tier 3 (3 giờ) ⏱ `18h → 21h`

```
☐  5.1  analysis (1h45)  → tag     [CÓ THỂ BỎ]
☐  5.2  auth     (1h15)  → tag     [CÓ THỂ BỎ]
☐  VERIFY: 13–14 module phẳng · 1 069 test · 84 route
☐  COMMIT + TAG v1.2.0-p5
☐  ⚠  DIFF CHECK: git diff -M HEAD~1 -- src/modules/analysis/ | grep '^[+-][^+-]'
☐     → Phải rỗng (move-only). Có dòng → đã sửa logic → review
```

---

## 10.8. P6 — Tài liệu (6 giờ) ⏱ `21h → 27h` 🔴 **KHÔNG CẮT**

```
☐  6.1  docs/ARCHITECTURE.md            (2 giờ)
☐  6.2  docs/ONBOARDING.md               (2 giờ)
☐  6.3  Cập nhật 30 README               (1h30)
☐  6.4  Regenerate 19_handler_inventory  (20 phút)
☐  6.5  Bảng số liệu trước/sau          (30 phút)
☐  6.6  Link checker → 0 broken          (15 phút)
☐  COMMIT + TAG v1.2.0-p6
```

---

## 10.9. P7 — Verify (3 giờ) ⏱ `27h → 30h`

```
☐  7.1  pnpm type-check                    → 0 lỗi
☐  7.2  pnpm lint                          → 0 cảnh báo
☐  7.3  pnpm exec jest --maxWorkers=2      → 67 suite / 1 069 test
☐  7.4  pnpm arch:api-coverage             → 84 | 84 | 0 | 0
☐  7.5  pnpm test:cov                      → ≥ 71%
☐  7.6  bash scripts/test-infra-up.sh
☐  7.7  pnpm test:integration              → 7 suite / 138 test
☐  7.8  pnpm test:e2e                      → 5 suite / 70 test
☐  7.9  bash scripts/test-infra-down.sh    → giải phóng RAM
☐  7.10 Link checker lần cuối              → 0 broken
☐  7.11 Cập nhật số liệu cuối vào README + notes.md
☐  7.12 COMMIT + TAG v1.2.0-final
```

---

## 10.10. Bàn giao (15 phút)

```
☐  Bảo vệ đồ án: chuẩn bị trình bày 5 phút
     - Vấn đề: người mới khó hiểu + yêu cầu modular monolith
     - Quyết định: ADR-0001
     - Bằng chứng: bảng số liệu trước/sau
     - Bằng chứng: ESLint + arch test output thật
     - Bằng chứng: 1 277 test xanh, 84 route khớp 1-1
☐  README root cập nhật phần "Kiến trúc"
☐  notes.md hoàn tất
```

---

## 10.11. Đường cắt — tra cứu nhanh

| Giờ | Đã làm | Hành động |
|---|---|---|
| 7h | Pilot chưa qua | **Dừng.** Đọc §9. Cân nhắc phương án B. |
| 10h | P3 chưa xong | Cắt `issues` + `feedback` (làm sau P4) |
| 12h | P4 chưa xong | Cắt P4 còn `users` + `workspaces` |
| 18h | P4 chưa xong | **Bỏ P4 & P5** → P6 (tài liệu) |
| 21h | P5 chưa xong | Bỏ P5 → P6 |
| 27h | P6 chưa xong | Dừng viết tài liệu mới → verify + polish |
| Bất kỳ | Test đỏ > 15 phút | Revert về tag gần nhất |

---

## 10.12. Bảng theo dõi nhanh (điền khi chạy)

| Giờ | Phase | Module đã flatten | File .ts | LOC | Test | Route | Tag | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| 0 | baseline | 0/14 | 339 | 31 076 | 1 277 ✅ | 84 ✅ | v1.1.0-baseline | |
| 5 | P1 | 0/14 | | | | | | |
| 7 | P2 | 1/14 | | | | | | |
| 10 | P3 | 7/14 | | | | | | |
| 18 | P4 | 12/14 | | | | | | |
| 21 | P5 | 14/14 | | | | | | |
| 27 | P6 | | | | | | | |
| 30 | P7 | | | | | | | |

---

## 10.13. Lời nhắc cuối cùng

> **Ba điều tuyệt đối không làm:**
>
> 1. ❌ Sửa assert của test — chỉ đổi import path.
> 2. ❌ Thêm route mới — `arch:api-coverage` phải luôn là 84.
> 3. ❌ Đụng logic `analysis` / `auth` — chỉ di chuyển file.
>
> **Ba điều luôn làm:**
>
> 1. ✅ Commit + tag sau mỗi phase.
> 2. ✅ Chạy cổng kiểm soát trước mỗi commit.
> 3. ✅ Ghi quyết định vào `notes.md` ngay khi có.
