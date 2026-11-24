# `test/unit/workspaces/` — 3 tệp kiểm thử không gian làm việc

Thư mục này kiểm thử entity và service của workspace. Chuỗi `describe` chép nguyên văn từ code.

| Tệp | Các `describe` thật trong code |
|---|---|
| `workspace-entity.spec.ts` | `Workspace — aggregate root (Rich Domain Model)` — kiểm thử tạo, sửa, xóa và quản lý thành viên ở mức aggregate root |
| `workspaces.spec.ts` | `WorkspacesService (CRUD & Phân quyền Thành viên)` — kiểm thử tạo/đọc/sửa/xóa, thêm thành viên, chuyển quyền sở hữu, rời nhóm; `owner` của workspace sẽ thành `owner` của mọi dự án con |
| `workspace-invitation-email.spec.ts` | `WS-07 — lời mời workspace qua email` ; `WS-01 — tạo workspace kèm email chưa có tài khoản` ; `Quota — giới hạn số workspace tối đa mỗi user (phương án B)` (3 describe — gửi thư mời đúng mẫu, tạo kèm tài khoản mới, chặn vượt hạn mức) |

Liên quan: `test/e2e/workspace-project.e2e-spec.ts`.

Chạy: `npx jest test/unit/workspaces --no-coverage`.
