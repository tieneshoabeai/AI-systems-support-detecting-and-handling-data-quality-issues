# 8. Phase P6 + P7 — Tài liệu + Verify (9 giờ)

> **Thời gian:** P6 6h + P7 3h · **Nguyên tắc:** từ giờ 20 chỉ viết tài liệu + verify, không refactor code (R5).

---

## 8.1. P6 — Tài liệu (6 giờ)

### 8.1.1. README từng module (13 file, 3 giờ)

Mỗi `src/modules/<mod>/README.md` bắt buộc có:

| Mục | Simple (6) | Hexagonal (7) |
|---|---|---|
| `Template:` | `Simple` | `Hexagonal` |
| Vì sao template này | 1 dòng theo §1.3 | 1 dòng theo §1.3 + dẫn D14 nếu là `issues` |
| Cấu trúc file | liệt kê `<mod>.routes (nếu có HTTP)/service/repository/schema/adapter/types` — `audit` không có routes vì không có HTTP route | liệt kê 4 tầng giữ nguyên |
| Bất biến chính | route/handler/entity nhẹ/mapper | tx/outbox/policy/quota/adapter/event |
| Cấm | gộp mapper `notifications`, đổi `ensureNotAdmin`, đổi thứ tự route | gộp entity/port/handler, đổi session/tx/policy |

Thứ tự viết: 6 Simple trước (1.5h), 7 Hexagonal sau (1.5h).

### 8.1.2. Cập nhật ADR + diagram (1.5 giờ)

- ADR-0002 đã viết (P1). P6 chỉ bổ sung phụ lục: số liệu thực tế file/LOC sau P2–P5 + đường cắt đã kích hoạt (nếu có).
- `architecture-diagram.md`: 2 diagram — vỏ MM (1 AppModule + 13 module + shared) + ruột (Simple phẳng vs Hexagonal 4 tầng). Không vẽ 13 slice phẳng như hướng cũ.

### 8.1.3. Báo cáo đồ án (1.5 giờ)

- Lý do hybrid (vì sao không slice-toàn-bộ, vì sao không monolith-thuần): trích ADR-0002 §lựa chọn.
- Bảng 6 Simple + 7 Hexagonal + ngưỡng.
- Số liệu: 340 → ~305 file, LOC −~3 000, route 82+1 bất biến, test 1 277 xanh.
- Nợ kỹ thuật: `feedback` (nếu bị cắt), rút gọn `shared/`, tách microservice sau này.

## 8.2. P7 — Verify cuối (3 giờ, buffer)

| Bước | Lệnh | Kỳ vọng |
|---|---|---|
| 1 | `pnpm type-check` | 0 lỗi |
| 2 | `pnpm lint` | 0 cảnh báo |
| 3 | `pnpm exec jest --maxWorkers=2` | full suites xanh |
| 4 | `pnpm arch:api-coverage` | 82 HTTP + 1 WS khớp `12_business_invariants.md` §12.1 |
| 5 | `bash scripts/measure-refactor.sh` | ~305 file / ~28 500 LOC / ~30 thư mục con |
| 6 | Tick `13_refactor_constraints.md` §13.6 toàn repo | hết TC/AC/FC/BC/PC |
| 7 | Tag `v1.2.0-final` | bản nộp được |

> **Nếu P7 đỏ:** revert về tag module gần nhất, ghi nợ, nộp bản đó — không fix > 15 phút (R2).
