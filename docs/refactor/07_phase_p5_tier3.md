# 7. Phase P5 — Chuẩn hóa 3 module Hexagonal khó (4 giờ, KHÔNG gộp)

> **Thời gian:** 4 giờ · **Điều kiện:** P4 qua cổng kiểm soát.
> **Phạm vi:** `issues, analysis, auth` — GIỮ NGUYÊN 4 tầng, chỉ chuẩn hóa + tài liệu lý do giữ H.

---

## 7.1. Vì sao 3 module này ở lại Hexagonal (quyết định D14)

| Module | Handler | Lý do giữ H (ngưỡng §1.3) |
|---|---|---|
| `issues` | 4 cmd + 5 qry | Đổi so với hướng cũ: optimistic locking `expectedVersion` + invariant title/desc trong entity + **1 controller chứa cả 2 nhóm route user + `admin/*`** + cascade attachment — đủ ngưỡng (1)+(2). Gộp sẽ mất chỗ bảo vệ locking. |
| `analysis` | 6 cmd + 5 qry | AI worker + RAM guard + cardinality guard + 7 schema + 14 util + 3 service. Gộp service 8 242 LOC thành 1 file là tự sát. |
| `auth` | 9 cmd + 2 qry | OAuth/session rotation + 7 token + 4 adapter + revocation. Sai thứ tự guard/session là vỡ bảo mật (R4 gốc). |

## 7.2. Việc làm cho mỗi module (giống P4, thêm ghi nợ)

| Bước | `issues` (1 controller, 2 nhóm route) | `analysis` | `auth` |
|---|---|---|---|
| 1 | Đối chiếu §12: locking + 1 controller (2 nhóm route user + `admin/*` + Roles('admin')) | Đối chiếu §12: worker + RAM/cardinality + OPEN-06/GD7/GD9/GD12 | Đối chiếu §12: token/session/OAuth + thứ tự `sessions/me` trước `:id` |
| 2 | Sửa deep import còn sót → qua `index.ts`; GIỮ nguyên 1 controller (không tách file user/admin) | Giữ ~14 util (`application/*util` + `domain/*util`) + 3 service (`ai-worker`, `rag-few-shot`, `report-worker`) tách — cấm gộp | Giữ 6 adapter (`bcrypt`, `env-session-policy`, `google-oauth`, `jwt-issuer`, `users-auth-lookup/session`) + `jwt.strategy` + 2 service (`admin-bootstrap`, `security-alert`) tách |
| 3 | Viết README Template H + lý do D14 | Viết README Template H | Viết README Template H |
| 4 | Verify + tag `v1.2.0-issues-h` | Verify + tag `v1.2.0-analysis-h` | Verify + tag `v1.2.0-auth-h` |

## 7.3. Cổng kiểm soát P5

- File/LOC không đổi (~305/~28 500). Chỉ thêm 3 README.
- type-check 0 · lint 0 · test xanh · api-coverage 82+1.
- Tag `v1.2.0-p5`.
