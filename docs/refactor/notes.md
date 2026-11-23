# Ghi chú quá trình refactor

## Baseline (2026-11-23)
- File .ts src/modules: 340 · LOC: 31 505 · thư mục con: ~60
- Handler: 107 (61 cmd + 46 query) + 3 subscriber · Route: 82 HTTP + 1 WS gateway (xem 12_business_invariants.md §12.1–12.2) · Test: 1 277 / 79 suite
- Coverage stmts: 71.03%

## Quyết định
| Phase | Quyết định | Lý do |
|---|---|---|
| P0 | Giữ nguyên `shared/` | rủi ro cao, không đóng góp M1–M4 |
| P0 | Giữ `index.ts` của mỗi module | đã enforce tốt (116 import qua index.ts) |

## Kết quả từng phase
| Phase | File | LOC | Ghi chú |
|---|---|---|---|
| P0.1 baseline | 340 | 31 505 | tag v1.1.0-baseline |
| P0 full (ADR+diagram+notes) | 340 | 31 505 | ADR-0001, architecture-diagram.md |
| 2026-11-24 | Hybrid 6+7 (ADR-0002), revert về P1 `31cd2f3` | ép 1 template cho 13 module là sai |
| P1 enforce (MM2+MM5/MM6+measure) | 340 | 31 505 | ESLint MM2 (chỉ chặn deep import tầng khác module), test/modular-monolith.spec.ts (MM5 chuyển tiếp + FINAL skip, MM6), scripts/measure-refactor.sh |
| 2026-11-24 hybrid (viết lại kịch bản) | ~305 (mục tiêu) | ~28 500 (mục tiêu) | ADR-0002 + 00–11 viết lại, 12/13 cập nhật, chỉ flatten 6 Simple |
| P2 audit (Simple) | 338 | 31 439 | file handler 107->106 (LogHandler gop thanh AuditService.log) | type-check 0, lint 0, arch+guard+contract xanh, api 84/84 |
| P3.1 overview (Simple) | 338 | 31 416 | handler 106->104, subdirs 150->146 | type-check 0, lint 0, step3 34/34, arch+guard+contract xanh, api 84/84 (tooling ho tro *.routes.ts) |
| P3.2 realtime (Simple) | 338 | 31 416 | subdirs 146->139 | type-check 0, lint 0, realtime 47/47, arch+guard+contract xanh, api 84/84 |
| P3.3 data-view (Simple) | 329 | 31 306 | handler 104->100, subdirs 139->131 | type-check 0, lint 0, data-view/chart/datasets 52+42 xanh, arch+guard+contract xanh, api 84/84 |
