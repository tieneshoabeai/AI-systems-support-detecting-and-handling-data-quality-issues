# `test/unit/projects/` — 2 tệp kiểm thử dự án

Thư mục này kiểm thử entity dự án và service quản lý dự án. Chuỗi `describe` chép nguyên văn từ code.

| Tệp | Các `describe` thật trong code |
|---|---|
| `project-entity.spec.ts` | `factory & truy vấn` ; `rename()` ; `addMember()` ; `removeMember()` ; `changeMemberRole()` ; `transferOwnershipTo()` ; `setHasDataset() & markCompleted()` ; `assertCanModerate / assertCanAccess` (8 describe — đổi tên, thêm/xóa/đổi vai trò thành viên, chuyển quyền sở hữu, gắn dataset, kiểm tra quyền điều hành) |
| `projects.spec.ts` | `ProjectsService (Quản lý Project & Ràng buộc 1 Project = 1 Dataset)` — kiểm thử ràng buộc mỗi dự án chỉ gắn một dataset, tải dataset thứ hai bị chặn |

Liên quan: `test/e2e/workspace-project.e2e-spec.ts`.

Chạy: `npx jest test/unit/projects --no-coverage`.
