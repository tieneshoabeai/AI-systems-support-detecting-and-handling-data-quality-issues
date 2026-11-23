# 9. Rủi ro & rollback (bản hybrid)

## 9.1. Top rủi ro

| # | Rủi ro | Module liên quan | Phòng ngừa |
|---|---|---|---|
| 1 | Xóa nhầm `session/outbox/tx` khi gộp Simple | `feedback, notifications, audit` | Đối chiếu §12 + tick TC/BC trước commit; GIỮ nguyên `resolveMongoSession` trong repository (audit) + best-effort (không đổi thành strict) |
| 2 | Gộp nhầm 2 mapper `notifications` | `notifications` | Giữ 2 file riêng; reviewer check đúng dòng này |
| 3 | Mất `ensureNotAdmin`/camel-snake/`deleted_at` | `feedback` | Giữ trong `types.ts` + service/repository; test liên quan phải xanh |
| 4 | Đổi nhầm thứ tự route/guard | `notifications` (`unread-count` vs `:id`), `auth` (`sessions/me` vs `:id`) | `arch:api-coverage` phải khớp thứ tự |
| 5 | Gộp nhầm module Hexagonal | 7 module H | Cấm gộp (R4 mới); P4/P5 chỉ chuẩn hóa |
| 6 | Import chéo vỡ MM2 khi flatten | `data-view→datasets` (13 chỗ) | Luôn qua `../<mod>`; lint MM2 phải xanh |
| 7 | Test đỏ kéo dài | mọi module | Không fix > 15 phút → revert tag gần nhất (R2) |
| 8 | Quá giờ | — | Đường cắt §0.6: cắt theo P5→P4→feedback→P3, giữ P6 |

## 9.2. Kịch bản rollback

| Tình huống | Lệnh | Sau đó |
|---|---|---|
| 1 module đỏ > 15 phút | `git reset --hard v1.2.0-<mod-trước>` | ghi `notes.md`, sang module sau |
| Cả phase đỏ | `git reset --hard v1.2.0-p<k-1>` | cắt phase đó theo §0.6 |
| Muốn về P1 sạch | `git reset --hard 31cd2f3` | baseline hybrid (MM2 đã enforce) |
| Muốn về trước refactor | `git reset --hard v1.1.0-baseline` | mất hết P1–P5 |

> Mỗi module 1 commit + 1 tag (`v1.2.0-audit`, `-overview`, ...) nên rollback luôn rẻ.
