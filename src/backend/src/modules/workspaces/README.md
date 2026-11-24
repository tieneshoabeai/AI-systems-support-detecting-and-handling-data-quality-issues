# Module `workspaces` — Không Gian Làm Việc

Sở hữu workspace, thành viên, hạn mức lưu trữ và luồng chuyển quyền/rời nhóm. Cung cấp `WORKSPACE_CONTEXT_PORT` cho CASL để mọi module khác kiểm tra quyền theo workspace.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/workspaces/`
- Loại kiến trúc: CQRS đầy đủ, 38 tệp `.ts`.
- Sở hữu: collection `workspaces`.
- Cung cấp: `WORKSPACE_REPOSITORY_PORT`, `WORKSPACE_ACCESS_PORT`, `WorkspacePolicyLoader`, `WorkspaceContextAdapter`.

## 2. Cây thư mục đầy đủ

```text
workspaces/
├── domain/
│   ├── entities/workspace.entity.ts               # Workspace (name, ownerId, members, quota, storageUsed)
│   ├── value-objects/workspace-role.vo.ts         # owner/member
│   ├── value-objects/workspace-quota.vo.ts        # Hạn mức, assertQuota
│   ├── ports/workspace.repository.port.ts         # CRUD + phân trang keyset
│   ├── ports/workspace.access.port.ts            # Facade kiểm tra quyền
│   └── events/workspace-events.ts                 # WORKSPACE_CREATED/DELETED/MEMBER_* 
├── application/
│   ├── commands/ (8)
│   │   ├── create-workspace.handler.ts            # Tạo workspace, gán người tạo làm owner
│   │   ├── update-workspace.handler.ts            # Đổi tên/mô tả
│   │   ├── delete-workspace.handler.ts            # Xóa mềm + phát event cascade
│   │   ├── add-member.handler.ts / remove-member.handler.ts
│   │   ├── transfer-owner.handler.ts              # Nhượng quyền owner
│   │   ├── leave-workspace.handler.ts             # Rời nhóm (owner phải nhượng trước)
│   │   └── increment-storage-used.handler.ts      # Cộng/trừ dung lượng khi upload/xóa dataset
│   ├── queries/ (6)
│   │   ├── get-workspace-by-id / get-workspaces / list-workspaces
│   │   ├── list-members.handler.ts
│   │   ├── check-workspace-upload-quota.handler.ts # Kiểm tra quota trước upload
│   │   └── resolve-user-workspace-role.handler.ts # Vai trò của user trong workspace
│   └── policy-loaders/workspace-policy.loader.ts  # Nạp workspace cho @PolicyResource
├── infrastructure/
│   ├── persistence/workspace.schema.ts | workspace.mapper.ts | workspaces.repository.ts
│   └── adapters/
│       ├── workspace-access.adapter.ts            # Hiện thực WORKSPACE_ACCESS_PORT
│       └── workspace-context.adapter.ts           # Hiện thực WORKSPACE_CONTEXT_PORT (fail-safe)
├── presentation/
│   ├── controllers/workspaces.controller.ts       # @Controller('workspaces'), 10 route
│   ├── dtos/ (6: create, update, add-member, list-members-query, list-workspaces-query, transfer-owner)
│   └── responses/workspace.response.ts
├── workspaces.module.ts
└── index.ts
```

## 3. Tầng domain

- `workspace.entity.ts`: `Workspace.create(name, ownerId)`, `addMember/removeMember`, `transferOwner`, `leave`, `incrementStorageUsed`. Owner luôn là member đặc biệt.
- `workspace-role.vo.ts`: chỉ hai vai trò `owner`/`member`. Quyền project được suy ra: owner workspace → owner mọi project bên trong.
- `workspace-quota.vo.ts`: giới hạn dung lượng, số project, số dataset; `assertQuota()` ném lỗi khi vượt.

## 4. Tầng application

- `CreateWorkspaceHandler`: tạo workspace + thêm owner vào members + ghi audit + phát event.
- `DeleteWorkspaceHandler`: xóa mềm, phát `WORKSPACE_DELETED` để `projects` xóa dây chuyền.
- `CheckWorkspaceUploadQuotaHandler`: được `datasets` gọi trước upload để chặn vượt quota.
- `ResolveUserWorkspaceRoleHandler`: được CASL gọi để quyết định `can()`.

## 5. Route đầy đủ (`@Controller('workspaces')`)

| Phương thức | Đường dẫn đầy đủ | Bảo vệ | Mô tả |
|---|---|---|---|
| POST | `/api/v1/workspaces` | JWT + `can(Create, Workspace)` | Tạo workspace mới (WS-01). |
| GET | `/api/v1/workspaces` | JWT | Danh sách workspace của tôi, keyset/tìm kiếm/lọc/sắp xếp (WS-02). |
| GET | `/api/v1/workspaces/:id` | JWT + PolicyResource | Chi tiết workspace (WS-03). |
| PATCH | `/api/v1/workspaces/:id` | JWT + PolicyResource | Cập nhật tên/mô tả (WS-04). |
| DELETE | `/api/v1/workspaces/:id` | JWT + PolicyResource | Xóa mềm, cascade project (WS-05, 204). |
| GET | `/api/v1/workspaces/:id/members` | JWT + PolicyResource | Danh sách thành viên (WS-06). |
| POST | `/api/v1/workspaces/:id/members` | JWT + PolicyResource | Thêm thành viên (WS-07). |
| DELETE | `/api/v1/workspaces/:id/members/:userId` | JWT + PolicyResource | Xóa thành viên. |
| POST | `/api/v1/workspaces/:id/transfer-owner` | JWT + PolicyResource | Nhượng quyền owner (WS-09). |
| POST | `/api/v1/workspaces/:id/leave` | JWT + PolicyResource | Rời workspace (WS-10). |

## 6. Sự kiện và cascade

- Phát: `WORKSPACE_DELETED`, `WORKSPACE_MEMBER_ADDED/REMOVED`, `WORKSPACE_OWNER_TRANSFERRED`.
- Nhận: không nhận trực tiếp; `projects` lắng nghe `WORKSPACE_DELETED` để xóa project, rồi phát `PROJECT_DELETED` để `datasets` xóa tiếp.
- Test cascade: `test/unit/workflows/cascade-workspace-delete.spec.ts`, `test/integration/cascade-delete.spec.ts`.

## 7. Bất biến

- Owner không thể rời nhóm khi chưa nhượng quyền.
- Không xóa cứng, chỉ xóa mềm để giữ audit.
- `WorkspaceContextAdapter` chịu lỗi: lỗi truy vấn trả tập rỗng, không chặn oan.

## 8. Test liên quan

`test/unit/workspaces/` (3 tệp), `test/e2e/workspace-project.e2e-spec.ts`, `test/integration/cascade-delete.spec.ts`.
