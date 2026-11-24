# Module `overview` — Tổng Quan Dashboard (Chỉ Đọc)

Tổng hợp số liệu cho dashboard, không sở hữu collection riêng, chỉ đọc từ `users/workspaces/projects/datasets/analysis` qua repository port. Dạng phẳng 5 tệp + index, không ghi dữ liệu.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/overview/`
- Loại kiến trúc: phẳng/service-based, chỉ đọc.
- Sở hữu: không có collection.
- Đọc từ: `USER_REPOSITORY_PORT`, `WORKSPACE_REPOSITORY_PORT`, `PROJECT_REPOSITORY_PORT`, `DATASET_REPOSITORY_PORT`, `ANALYSIS_REPOSITORY_PORT`.

## 2. Từng tệp làm gì (6 tệp)

| Tệp | Vai trò chi tiết |
|---|---|
| `overview.controller.ts` | `@Controller()` bare, 2 route. `userWorkspacesOverview` cần `can(Read, Workspace)`; `workspaceOverview` dùng `WorkspacePolicyLoader`. |
| `overview.service.ts` | `getUserWorkspacesOverview(userId)`: liệt kê workspace của user + đếm project/dataset/lần phân tích/feedback mở. `getWorkspaceOverview(workspaceId)`: 5 chỉ số E3/E4 (tổng project, dataset, lần phân tích thành công, issue mở, dung lượng đã dùng). Mọi lỗi hạ tầng đều try/catch trả rỗng, không chặn dashboard. |
| `overview.types.ts` | `UserOverview` (danh sách workspace + đếm), `WorkspaceOverview` (5 metric + `updatedAt`). |
| `overview.module.ts` | Import 5 module nguồn để lấy repository port, cung cấp controller/service. |
| `index.ts` | Export service + kiểu. |

## 3. Route đầy đủ (2 route)

| Phương thức | Đường dẫn đầy đủ | Bảo vệ | Mô tả |
|---|---|---|---|
| GET | `/api/v1/overview/workspaces` | JWT + `can(Read, Workspace)` | Tổng quan các workspace của tôi, 5 chỉ số (E3). |
| GET | `/api/v1/workspaces/:id/overview` | JWT + WorkspacePolicyLoader | Tổng quan một workspace (E4). |

## 4. Bất biến

- Chỉ đọc, không phát event, không ghi audit cho từng lần xem (tránh nhiễu).
- Chịu lỗi: module nguồn lỗi thì metric đó trả 0/rỗng, các metric khác vẫn trả.
- Không kiểm tra `hasDataset` hay fingerprint ở đây — đó là việc của `projects/datasets/analysis`.

## 5. Test liên quan

`test/e2e/feedback-notifications-overview.e2e-spec.ts` (overview), `test/unit/workflows/step3-efgh.spec.ts`.
