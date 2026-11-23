# 6. Phase P4 — Chuẩn hóa 4 module Hexagonal vừa (6 giờ, KHÔNG gộp)

> **Thời gian:** 6 giờ · **Điều kiện:** P3 qua cổng kiểm soát.
> **Nguyên tắc:** 4 module `datasets, projects, workspaces, users` GIỮ NGUYÊN 4 tầng. Chỉ chuẩn hóa import + index.ts + README. Cấm gộp entity/port/handler (R4 sửa đổi).

---

## 6.1. Vì sao không gộp 4 module này

| Module | Handler | Lý do giữ Hexagonal |
|---|---|---|
| `datasets` | 4 cmd + 4 qry + 1 sub | 2 schema/2 repo + tx strict + policy loader + cascade OPEN-09 |
| `projects` | 10 + 7 + 1 sub | 17 handler + 3 policy loader + best-effort outbox + cascade project→dataset |
| `workspaces` | 8 + 6 | quota 20 + tx strict + RBAC 3 tầng + 2 adapter fail-safe |
| `users` | 11 + 6 | password policy + revocation service + USER_BLOCKED/REMOVED dùng bởi realtime |

> Gộp 4 module này tiết kiệm ~40 file nhưng mất chỗ bảo vệ transaction/outbox/policy — sai 1 chỗ là vỡ cascade. Hướng cũ đã revert vì lý do này.

## 6.2. Việc làm cho mỗi module H (giống nhau cả 4)

| Bước | Hành động | Cấm |
|---|---|---|
| 1 | Đối chiếu `12_business_invariants.md` §module: liệt kê tx/outbox/policy/adapter/event | cấm đổi logic |
| 2 | Rà soát import chéo: tất cả qua `../<mod>` (index.ts). Sửa deep import còn sót (nếu có) | cấm đổi public contract |
| 3 | Rà soát `index.ts`: export đủ port symbol + entity dùng chéo (vd USER events cho realtime) | cấm bớt export |
| 4 | Rà soát `*.module.ts`: provider đầy đủ handler/service/adapter/policy | cấm gộp provider |
| 5 | Viết `README.md` | mẫu §6.3 |
| 6 | Verify + commit + tag `v1.2.0-<mod>-h` | — |

### 6.3. Mẫu README Hexagonal (bắt buộc giống nhau)

```md
# <mod> — Template: Hexagonal
- Vì sao Hexagonal: <1 dòng — vd datasets: 2 schema/2 repo + tx strict + policy>
- Bất biến chính: <tx/outbox/policy/quota/event, dẫn chiếu §12>
- Cấm: gộp entity/port/handler; đổi thứ tự guard/route; đổi hằng số quota/limit.
```

## 6.4. Lưu ý từng module (không được bỏ qua)

- **`datasets`:** giữ `resolveMongoSession` + tx strict; giữ 2 schema (`dataset` + `dataset-record`) / 2 repo (`datasets` + `record-query`) tách + 2 service (`dataset-finding`, `schema-inference`) + 3 VO + `csv-delimiter/finding/pii` utils; giữ subscriber ingest (`cascade-project-datasets` + `cascade-dataset-event`); giữ `RECORD_QUERY_PORT` cho `data-view` (13 import qua index.ts).
- **`projects`:** giữ 3 policy loader (`project`, `project-scope`, `workspace-scope`) + 2 adapter (`access` + `context`) riêng (không gộp vào types); giữ best-effort outbox (khác workspaces strict); giữ cascade xóa project→dataset.
- **`workspaces`:** giữ 2 adapter (`access` + `context`, context fail-safe try/catch); giữ hằng `MAX_WORKSPACES_PER_USER = 20`; giữ event `WORKSPACE_DELETED` trong transaction.
- **`users`:** giữ `session-policy.vo` + password policy; giữ 2 controller user/admin tách; giữ `user-access-revocation.service.ts` riêng (dùng cả users + realtime); giữ event USER_BLOCKED/REMOVED.

## 6.5. Cổng kiểm soát P4

- File/LOC **không đổi** (~305/~28 500) — chuẩn hóa không thêm/bớt file (trừ README).
- `pnpm type-check` 0 lỗi · `pnpm lint` 0 cảnh báo · test xanh · `arch:api-coverage` 82+1.
- Arch test: MM2 xanh; MM5' **bỏ qua** 4 module này (được phép có thư mục con).
- Tag `v1.2.0-p4`.
