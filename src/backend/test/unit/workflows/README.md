# `test/unit/workflows/` — 6 file: kịch bản liên module

Khác các thư mục khác (1 module), đây test **dòng chảy cắt ngang** nhiều module. Tên file giữ theo lịch sử wave/step — đừng đổi tên kẻo mất `git blame`.

| File | Các `describe` thật trong code |
|---|---|
| `cascade-workspace-delete.spec.ts` | `Cascade — Workspace sang Project` ; `Cascade — Project sang Dataset (file R2 + storage_used)` ; `Phat event cascade` ; `Lop phong thu - loc project theo workspace cha da xoa` (4 describe) |
| `step1-services.spec.ts` | `Buoc 1 / Nhom C — AuthService remember-me` ; `Buoc 1 / Nhom D — IssuesService needs_info` |
| `step1-remember-me-and-issue-needs-info.spec.ts` | `parseDurationMs` ; `policy TTL phi dang nhap` ; `DTO login` ; `issue status` ; `DTO issues` (5 describe, nhóm C + D) |
| `step3-efgh.spec.ts` | `Nhóm E1/E2 — Danh sách thành viên` ; `Nhóm E3/E4 — Endpoint tổng quan (Overview)` ; `Nhóm F — CreateProject chỉ định owner_id (PROJ-01)` ; `Nhóm G — Profile phone & bio` ; `Nhóm G — DTO profile` ; `Nhóm H — API nhỏ` ; `Util keyset generic (in-memory)` (7 describe) |
| `gap-analysis-p2-p3.spec.ts` | `P2 — GET /auth/sessions/me` ; `P3 — GET /admin/users keyset cursor + sortBy/sortOrder` |
| `notifications-issues-wave6.spec.ts` | `Wave6 NOTIF-01: cursor + unreadCount + sort createdAt` ; `Wave6 NOTIF-02/03: chi doc cua minh + cong tac` ; `Wave6 ISSUE-01..04: tao/xem/doi trang thai` (3 describe) |

Chạy: `npx jest test/unit/workflows --no-coverage`.
