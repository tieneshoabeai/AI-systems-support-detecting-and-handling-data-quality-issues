# Module `projects` — Dự Án

Sở hữu dự án, thành viên dự án, ảnh chụp trạng thái (`snapshot` + `expectedVersion`) và xóa dây chuyền xuống dataset. Một dự án tối đa một dataset.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/projects/`
- Loại kiến trúc: CQRS đầy đủ, 43 tệp `.ts` (lớn thứ hai sau analysis).
- Sở hữu: collection `projects`.
- Cung cấp: `PROJECT_REPOSITORY_PORT`, `PROJECT_ACCESS_PORT`, 3 policy loader (project, project-scope, workspace-scope).

## 2. Cây thư mục đầy đủ

```text
projects/
├── domain/
│   ├── entities/project.entity.ts                 # Project (workspaceId, ownerId, members, status, hasDataset)
│   ├── value-objects/project-role.vo.ts           # owner/member/viewer + canAccess/canModerate
│   ├── value-objects/project-status.vo.ts         # active/completed/archived/deleted
│   ├── ports/project.repository.port.ts           # CRUD + list keyset + member query
│   ├── ports/project.access.port.ts               # Facade cho module khác
│   └── events/project-events.ts                   # PROJECT_CREATED/DELETED/MEMBER_* 
├── application/
│   ├── commands/ (11, gồm 2 subscriber/handler cascade)
│   │   ├── create-project / update-project / delete-project / mark-completed
│   │   ├── set-has-dataset                        # Bật/tắt cờ 1 project = 1 dataset
│   │   ├── add-project-member / remove-project-member / update-project-member-role
│   │   ├── transfer-project-owner
│   │   ├── cascade-workspace-projects.handler.ts  # Xóa project khi workspace bị xóa
│   │   └── cascade-project-event.subscriber.ts    # Đăng ký lắng nghe WORKSPACE_DELETED
│   ├── queries/ (7)
│   │   ├── get-project-by-id / get-projects-by-workspace / list-projects-by-workspace
│   │   ├── list-all-projects (toàn hệ thống) / list-members / get-workspace-name
│   │   └── resolve-user-project-role
│   └── policy-loaders/ (3)
│       ├── project-policy.loader.ts               # Nạp theo :id
│       ├── project-scope-policy.loader.ts         # Nạp theo :projectId
│       └── workspace-scope-policy.loader.ts       # Nạp theo :workspaceId
├── infrastructure/
│   ├── persistence/project.schema.ts | project.mapper.ts | projects.repository.ts
│   └── adapters/project-access.adapter.ts | project-context.adapter.ts
├── presentation/
│   ├── controllers/projects.controller.ts         # @Controller() bare, 12 route đường dẫn đầy đủ
│   ├── dtos/ (5: create, update, member, list-query, list-member-query)
│   └── responses/project.response.ts
├── projects.module.ts
└── index.ts
```

## 3. Tầng domain

- `project.entity.ts`: `Project.create(workspaceId, ownerId, name)`, `addMember/removeMember/updateRole`, `markCompleted(snapshot)`, `setHasDataset`. Kiểm tra owner workspace tự động thành owner project.
- `project-role.vo.ts`: `owner` (toàn quyền), `member` (đọc/ghi), `viewer` (chỉ đọc). `member` workspace không có tên trong `project.members` thì mặc định là `viewer`.
- `project-status.vo.ts`: vòng đời `active → completed → archived`, `deleted` chỉ qua xóa mềm.

## 4. Tầng application

- `SetHasDatasetHandler`: được `datasets` gọi sau upload/xóa để giữ ràng buộc 1-1.
- `CascadeWorkspaceProjectsHandler`: lắng nghe `WORKSPACE_DELETED`, xóa mềm toàn bộ project, phát `PROJECT_DELETED` cho `datasets`.
- `MarkCompletedHandler`: lưu snapshot kèm `expectedVersion` (khóa lạc quan, chống ghi đè đồng thời).
- `ResolveUserProjectRoleHandler`: suy vai trò hiệu dụng (owner workspace → owner project).

## 5. Route đầy đủ (`@Controller()` bare)

| Phương thức | Đường dẫn đầy đủ | Bảo vệ | Mô tả |
|---|---|---|---|
| POST | `/api/v1/workspaces/:workspaceId/projects` | JWT + PolicyResource(workspace) | Tạo dự án (PROJ-01). |
| GET | `/api/v1/workspaces/:workspaceId/projects` | JWT + PolicyResource | Danh sách project trong workspace, keyset/tìm kiếm/lọc/sắp xếp (PROJ-02). |
| GET | `/api/v1/projects` | JWT | Danh sách toàn hệ thống (PROJ-02b). |
| GET | `/api/v1/projects/:id` | JWT + PolicyResource | Chi tiết (PROJ-03). |
| PATCH | `/api/v1/projects/:id` | JWT + PolicyResource | Cập nhật (PROJ-04). |
| DELETE | `/api/v1/projects/:id` | JWT + PolicyResource | Xóa mềm (PROJ-05, 204). |
| PUT | `/api/v1/projects/:id/snapshot` | JWT + PolicyResource | Lưu snapshot, cần `expectedVersion` (PROJ-12). |
| GET | `/api/v1/projects/:id/members` | JWT + PolicyResource | Danh sách thành viên (PROJ-09). |
| POST | `/api/v1/projects/:id/members` | JWT + PolicyResource | Thêm thành viên. |
| PATCH | `/api/v1/projects/:id/members/:userId` | JWT + PolicyResource | Đổi vai trò (PROJ-10). |
| DELETE | `/api/v1/projects/:id/members/:userId` | JWT + PolicyResource | Xóa thành viên. |
| POST | `/api/v1/projects/:id/transfer-owner` | JWT + PolicyResource | Nhượng quyền owner (PROJ-11). |

## 6. Bất biến

- Một project tối đa một dataset (`hasDataset`, chặn upload thứ hai).
- Snapshot dùng khóa lạc quan: sai `expectedVersion` trả 409.
- Xóa project phát `PROJECT_DELETED` để `datasets` dọn dataset + file + trừ quota.

## 7. Test liên quan

`test/unit/projects/` (2 tệp), `test/e2e/workspace-project.e2e-spec.ts`, `test/integration/cascade-delete.spec.ts`.
