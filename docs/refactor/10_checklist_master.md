# 10. Checklist tổng (bản hybrid 6+7)

> Tick theo module, không theo giờ cứng. Mỗi module xong phải qua cổng `03_phase_p0_p1.md` §3.3.

## P1 (đã xong ở 31cd2f3)

- [x] MM2 ESLint + arch test ranh giới
- [x] `measure-refactor.sh` + notes baseline
- [x] ADR-0001 (lịch sử) + ADR-0002 (hướng chốt)

## P2 pilot — audit (Simple mẫu)

- [ ] Đối chiếu §12 audit + tick §13.6
- [ ] `audit.types/service/routes` + DI + index.ts
- [ ] Xóa thư mục cũ sau type-check xanh
- [ ] `README.md` (Template: Simple)
- [ ] type-check / lint / test(audit) / api-coverage 82+1
- [ ] measure + notes + tag `v1.2.0-audit`

## P3 — 5 Simple (overview → realtime → data-view → notifications → feedback)

- [ ] `overview` — giữ Promise.all + 2 port → tag `v1.2.0-overview`
- [ ] `realtime` — giữ extractUserId/disconnect/handshake → tag `v1.2.0-realtime`
- [ ] `data-view` — giữ RECORD_QUERY_PORT + limit + tách route query → tag `v1.2.0-data-view`
- [ ] `notifications` — giữ 2 mapper riêng + route preferences + thứ tự unread-count → tag `v1.2.0-notifications`
- [ ] `feedback` — giữ create/updateByAuthor/requiresReason/ensureNotAdmin + camel-snake + deleted_at → tag `v1.2.0-feedback` (quá 100' thì cắt sang P6)
- [ ] Tag `v1.2.0-p3`; arch MM5' pass cho 6 Simple

## P4 — 4 Hexagonal vừa (không gộp)

- [ ] `datasets` — tx strict + 2 schema/repo + RECORD_QUERY_PORT → tag `v1.2.0-datasets-h`
- [ ] `projects` — 3 policy loader + best-effort outbox + cascade → tag `v1.2.0-projects-h`
- [ ] `workspaces` — quota 20 + 2 adapter fail-safe + WORKSPACE_DELETED trong tx → tag `v1.2.0-workspaces-h`
- [ ] `users` — password policy + revocation + 2 controller + USER events → tag `v1.2.0-users-h`
- [ ] Mỗi module: README Template Hexagonal; file/LOC không đổi
- [ ] Tag `v1.2.0-p4`

## P5 — 3 Hexagonal khó (không gộp)

- [ ] `issues` — locking + 1 controller (2 nhóm route) + Roles admin (D14) → tag `v1.2.0-issues-h`
- [ ] `analysis` — worker + RAM/cardinality + 7 schema/14 util giữ tách → tag `v1.2.0-analysis-h`
- [ ] `auth` — OAuth/session rotation + 7 token/4 adapter + thứ tự sessions/me → tag `v1.2.0-auth-h`
- [ ] Tag `v1.2.0-p5`

## P6 — Tài liệu

- [ ] 13 README module (Template + lý do + bất biến + cấm)
- [ ] ADR-0002 phụ lục số liệu thực tế
- [ ] architecture-diagram (vỏ MM + ruột S/H)
- [ ] Báo cáo đồ án (lý do hybrid + bảng 6+7 + số liệu + nợ)

## P7 — Verify

- [ ] type-check 0 / lint 0 / full test xanh / api-coverage 82+1
- [ ] measure ~305/~28 500/~30 + tick §13.6 toàn repo
- [ ] Tag `v1.2.0-final`
