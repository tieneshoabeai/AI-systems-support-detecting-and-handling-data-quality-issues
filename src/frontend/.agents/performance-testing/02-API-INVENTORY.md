# Danh mục API và luồng nghiệp vụ

Đây là danh mục **tham chiếu cho FE** để chọn luồng, hiểu phụ thuộc và xác minh response mà UI sử dụng. Priority P0/P1/P2 là đề xuất phân tích. Việc sở hữu endpoint và phê duyệt đo tải trực tiếp thuộc người phụ trách BE.

Đối chiếu 86 cặp method/path trên 66 đường dẫn trong [OpenAPI của FE](../../src/lib/openapi.json) với decorator HTTP trong các controller ở working tree. Cả 86 cặp khớp tĩnh ở thời điểm khảo sát. Prefix mặc định là `/api/v1`, riêng health ở root. Controller, DTO và phản hồi trên môi trường test là căn cứ chốt assertion. Snapshot mô tả nhiều response chỉ bằng status; ô status trong bảng thể hiện đúng mức chi tiết snapshot. Tra response cụ thể qua link operation và phần hợp đồng ưu tiên dưới đây. Cột đầu vào ghi tên query/header/body đã khai báo trong snapshot, dấu * là bắt buộc, path params lấy từ URL. Một số schema multipart và ràng buộc có thể chỉ hiện ở controller.

**P0** ảnh hưởng truy cập và thao tác dữ liệu chính. **P1** nghiệp vụ quan trọng. **P2** hỗ trợ hoặc có tần suất giả định thấp. Priority là đề xuất theo tác động sản phẩm và cần duyệt. Cột JWT ghi cơ chế xác thực. Quyền theo resource, vai trò, trạng thái và version còn do guard, policy hoặc handler quy định. ¹ Công khai ở lớp bearer vẫn có thể cần refresh token, mã reset, OAuth state hoặc điều kiện khác.

## Hợp đồng và phụ thuộc cần ưu tiên

| Luồng | Input, output và dependency | Tần suất giả thuyết và nơi cần đo |
|---|---|---|
| Đăng nhập | Login DTO nhận `email`, `password`, tùy chọn `remember_me` hoặc `rememberMe`; 200 trả envelope với `data.access_token`, `refresh_token`, thông tin phiên và `user`. Token đến JWT guard cho `GET /users/me` và các bước có quyền. Refresh DTO nhận `refresh_token`, lưu token trả về theo từng danh tính. | Login là đầu phiên; refresh phụ thuộc TTL. Đo bcrypt, DB phiên, tỷ lệ 429, tuổi phiên. |
| Danh sách dự án | Luồng Browser đăng nhập qua form rồi vào `/management/projects`. FE có project index `GET /projects`, có fallback danh sách theo workspace khi 404. Index và workspace list dùng cursor; kiểm tra `data.items` và `data.meta.nextCursor/hasMore/limit`, cùng fixture thuộc đúng quyền. | Ứng viên tần suất cao; đo fan-out, phân trang, kích thước workspace và vai trò. Xác thực mix thật qua trace/log. |
| Đọc dữ liệu | Project → `GET /projects/{projectId}/datasets` → record GET hoặc POST query → stats tùy thao tác. POST dùng DTO truy vấn, ràng buộc điều kiện lọc theo toán tử. Kiểm tra dữ liệu trang, cursor, sort và tập kết quả fixture. | Ứng viên tần suất cao trong Processing; phân theo số hàng, cột, loại lọc và sort. |
| Upload | Project có quyền tạo dataset → multipart `file` theo controller → xác minh dataset và đọc bản ghi. | Tải phụ thuộc byte, số hàng/cột, object storage, xử lý CSV và ghi Mongo; giữ write suite riêng. |
| Analysis và report | Có project/dataset hợp lệ và quyền Execute → config/run → đọc result/job theo contract → report tạo trả 202 → file có nhánh pending 202 và thành công 200. | Đo thời gian submit riêng thời gian hoàn tất; job poll theo nhịp có giới hạn. Đo backlog, worker và inference/PDF theo profile. Volume production chưa có. |
| Thông báo, issues, feedback | ID và quyền lấy từ những bước trước; thao tác admin dùng tài khoản đúng vai trò. | Chỉ thêm vào load mix khi số liệu truy cập hoặc nhóm nghiệp vụ xác nhận. |

Nguồn hợp đồng: [login DTO](../../../backend/src/modules/auth/presentation/dtos/login.dto.ts), [query DTO](../../../backend/src/modules/data-view/presentation/dtos/query-records-body.dto.ts), [envelope](../../../backend/src/shared/interfaces/interceptors/transform.interceptor.ts), [FE management store](../../src/services/management/management.store.ts). Đối với 204 kiểm tra status/empty body. File tải xuống kiểm tra content type/chữ ký phù hợp fixture. Với API response chưa có schema trong snapshot, ghi contract runtime và assertion tối thiểu trong Phase 1 trước khi bật gate.

## Toàn bộ operations

| Mức | Method và path | Xác thực | Query, header và body | Response status/schema snapshot | Controller operation |
|---|---|---|---|---|---|
| P2 | GET `/api/v1/admin/users` | JWT + admin | — | 200 | [AdminUsersController_list](../../../backend/src/modules/users/presentation/controllers/admin-users.controller.ts) |
| P2 | GET `/api/v1/admin/users/{id}` | JWT + admin | — | 200 | [AdminUsersController_detail](../../../backend/src/modules/users/presentation/controllers/admin-users.controller.ts) |
| P1 | GET `/api/v1/analysis/jobs/{jobId}` | JWT | — | 200 | [getAiJob](../../../backend/src/modules/analysis/presentation/controllers/analysis.controller.ts) |
| P1 | POST `/api/v1/analysis/jobs/{jobId}/result` | JWT | — | 200 | [ingestAiResult](../../../backend/src/modules/analysis/presentation/controllers/analysis.controller.ts) |
| P1 | POST `/api/v1/analysis/jobs/{jobId}/retry` | JWT | — | 202 | [retryAiJob](../../../backend/src/modules/analysis/presentation/controllers/analysis.controller.ts) |
| P1 | POST `/api/v1/projects/{projectId}/analysis` | JWT | application/json selected_columns, correlation_method, outlier_method, top_n | 201 | [runAnalysis](../../../backend/src/modules/analysis/presentation/controllers/analysis.controller.ts) |
| P1 | POST `/api/v1/projects/{projectId}/analysis/config` | JWT | application/json selected_columns, label_column, time_column, time_granularity, value_column, correlation_method, outlier_method, top_n | 200 | [saveAnalysisConfig](../../../backend/src/modules/analysis/presentation/controllers/analysis.controller.ts) |
| P1 | GET `/api/v1/projects/{projectId}/analysis/config` | JWT | — | 200 | [getAnalysisConfig](../../../backend/src/modules/analysis/presentation/controllers/analysis.controller.ts) |
| P1 | GET `/api/v1/projects/{projectId}/analysis/result` | JWT | — | 200 | [getAnalysisResult](../../../backend/src/modules/analysis/presentation/controllers/analysis.controller.ts) |
| P2 | POST `/api/v1/auth/change-password` | JWT | application/json current_password*, new_password*, confirm_password* | 200 | [AuthController_changePassword](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P2 | POST `/api/v1/auth/forgot-password` | Công khai¹ | application/json email* | 200 | [AuthController_forgotPassword](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P2 | GET `/api/v1/auth/google` | Công khai¹ | — | 302, 501 | [AuthController_googleStart](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P2 | GET `/api/v1/auth/google/callback` | Công khai¹ | — | 200, 302, 401, 409 | [AuthController_googleCallback](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P0 | POST `/api/v1/auth/login` | Công khai¹ | application/json email*, password*, remember_me, rememberMe | 200 | [AuthController_login](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P1 | POST `/api/v1/auth/logout` | JWT | — | 200 | [AuthController_logout](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P0 | POST `/api/v1/auth/refresh` | Công khai¹ | application/json refresh_token* | 200 | [AuthController_refresh](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P1 | POST `/api/v1/auth/register` | Công khai¹ | application/json email*, password*, first_name*, last_name*, role | 201 | [AuthController_register](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P2 | POST `/api/v1/auth/reset-password` | Công khai¹ | application/json email*, otp*, new_password* | 200 | [AuthController_resetPassword](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P2 | GET `/api/v1/auth/sessions` | JWT | — | 200 | [AuthController_getSessions](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P2 | GET `/api/v1/auth/sessions/{id}` | JWT | — | 200, 404 | [AuthController_getSessionById](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P2 | DELETE `/api/v1/auth/sessions/{id}` | JWT | — | 200 | [AuthController_revokeSession](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P2 | GET `/api/v1/auth/sessions/me` | JWT | — | 200, 404 | [AuthController_getCurrentSession](../../../backend/src/modules/auth/presentation/controllers/auth.controller.ts) |
| P1 | GET `/api/v1/datasets/{datasetId}/columns/{columnKey}/stats` | JWT | — | 200 | [DataViewController_getColumnStats](../../../backend/src/modules/data-view/presentation/controllers/data-view.controller.ts) |
| P0 | GET `/api/v1/datasets/{datasetId}/records` | JWT | cursor · limit · sort_field · sort_order | 200 | [DataViewController_getRecords](../../../backend/src/modules/data-view/presentation/controllers/data-view.controller.ts) |
| P0 | POST `/api/v1/datasets/{datasetId}/records/query` | JWT | application/json filters, sort, search, cursor, limit | 200 | [DataViewController_queryRecords](../../../backend/src/modules/data-view/presentation/controllers/data-view.controller.ts) |
| P1 | GET `/api/v1/datasets/{id}` | JWT | — | 200 | [DatasetsController_getDatasetById](../../../backend/src/modules/datasets/presentation/controllers/datasets.controller.ts) |
| P1 | DELETE `/api/v1/datasets/{id}` | JWT | — | 204 | [DatasetsController_deleteDataset](../../../backend/src/modules/datasets/presentation/controllers/datasets.controller.ts) |
| P1 | PATCH `/api/v1/datasets/{id}/columns/pii` | JWT | application/json columns* | 200, 400, 404 | [DatasetsController_updateColumnPii](../../../backend/src/modules/datasets/presentation/controllers/datasets.controller.ts) |
| P1 | GET `/api/v1/datasets/{id}/file` | JWT | — | 200 | [DatasetsController_downloadDatasetFile](../../../backend/src/modules/datasets/presentation/controllers/datasets.controller.ts) |
| P1 | GET `/api/v1/datasets/{id}/schema` | JWT | — | 200 | [DatasetsController_getDatasetSchema](../../../backend/src/modules/datasets/presentation/controllers/datasets.controller.ts) |
| P1 | GET `/api/v1/projects/{projectId}/datasets` | JWT | — | 200 | [DatasetsController_getDatasetByProject](../../../backend/src/modules/datasets/presentation/controllers/datasets.controller.ts) |
| P1 | POST `/api/v1/projects/{projectId}/datasets/upload` | JWT | multipart/form-data file* | 201 | [DatasetsController_uploadDataset](../../../backend/src/modules/datasets/presentation/controllers/datasets.controller.ts) |
| P2 | POST `/api/v1/analyses/{analysisId}/feedback` | JWT | application/json label*, reason, suggestedSeverity | 201 | [FeedbackController_createRunFeedback](../../../backend/src/modules/feedback/presentation/controllers/feedback.controller.ts) |
| P2 | GET `/api/v1/analyses/{analysisId}/feedback` | JWT | limit · cursor · label · sortOrder | 200 | [FeedbackController_listRunFeedback](../../../backend/src/modules/feedback/presentation/controllers/feedback.controller.ts) |
| P2 | POST `/api/v1/analyses/{analysisId}/findings/{findingId}/feedback` | JWT | application/json label*, reason, suggestedSeverity | 201 | [FeedbackController_createFindingFeedback](../../../backend/src/modules/feedback/presentation/controllers/feedback.controller.ts) |
| P2 | GET `/api/v1/analyses/{analysisId}/findings/{findingId}/feedback` | JWT | limit · cursor · label · sortOrder | 200 | [FeedbackController_listFindingFeedback](../../../backend/src/modules/feedback/presentation/controllers/feedback.controller.ts) |
| P2 | PATCH `/api/v1/feedback/{id}` | JWT | application/json label, reason, suggestedSeverity | 200 | [FeedbackController_updateMine](../../../backend/src/modules/feedback/presentation/controllers/feedback.controller.ts) |
| P2 | DELETE `/api/v1/feedback/{id}` | JWT | — | 200 | [FeedbackController_remove](../../../backend/src/modules/feedback/presentation/controllers/feedback.controller.ts) |
| P2 | GET `/api/v1/projects/{projectId}/ai-quality-metrics` | JWT | — | 200 | [FeedbackController_aiQualityMetrics](../../../backend/src/modules/feedback/presentation/controllers/feedback.controller.ts) |
| P0 | GET `/health` | Công khai¹ | — | 200 | [AppController_getHealth](../../../backend/src/app.controller.ts) |
| P0 | GET `/health/ready` | Công khai¹ | — | 200, 503 | [AppController_getReady](../../../backend/src/app.controller.ts) |
| P2 | GET `/api/v1/admin/issues` | JWT + admin | cursor · limit · sortBy · sortOrder · status | 200 | [IssuesController_listForAdmin](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | GET `/api/v1/admin/issues/{id}` | JWT + admin | — | 200 | [IssuesController_getForAdmin](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | PATCH `/api/v1/admin/issues/{id}/status` | JWT + admin | application/json status*, expectedVersion* | 200 | [IssuesController_updateStatus](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | POST `/api/v1/issues` | JWT | application/json issueType*, title*, description*, workspaceId, apiPath, errorMessage, occurredAt | 201 | [IssuesController_createReport](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | GET `/api/v1/issues` | JWT | cursor · limit · sortBy · sortOrder · status | 200 | [IssuesController_listMine](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | GET `/api/v1/issues/{id}` | JWT | — | 200 | [IssuesController_getMine](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | PATCH `/api/v1/issues/{id}` | JWT | application/json title, description, removeAttachmentIds, expectedVersion* | 200 | [IssuesController_updateMine](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | POST `/api/v1/issues/{id}/attachments` | JWT | — | 201 | [IssuesController_uploadAttachment](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | GET `/api/v1/issues/{id}/attachments/{attachmentId}` | JWT | — | 200 | [IssuesController_downloadAttachment](../../../backend/src/modules/issues/presentation/controllers/issues.controller.ts) |
| P2 | GET `/api/v1/notifications` | JWT | cursor · limit · sortBy · sortOrder · read | 200 | [NotificationsController_listNotifications](../../../backend/src/modules/notifications/presentation/controllers/notifications.controller.ts) |
| P2 | GET `/api/v1/notifications/{id}` | JWT | — | 200 | [NotificationsController_getDetail](../../../backend/src/modules/notifications/presentation/controllers/notifications.controller.ts) |
| P2 | PATCH `/api/v1/notifications/{id}/read` | JWT | — | 200 | [NotificationsController_markAsRead](../../../backend/src/modules/notifications/presentation/controllers/notifications.controller.ts) |
| P2 | GET `/api/v1/notifications/unread-count` | JWT | — | 200 | [NotificationsController_getUnreadCount](../../../backend/src/modules/notifications/presentation/controllers/notifications.controller.ts) |
| P1 | PATCH `/api/v1/users/me/notification-preferences` | JWT | application/json notificationsEnabled* | 200 | [NotificationsController_updatePreferences](../../../backend/src/modules/notifications/presentation/controllers/notifications.controller.ts) |
| P1 | GET `/api/v1/overview/workspaces` | JWT | — | 200 | [OverviewController_userWorkspacesOverview](../../../backend/src/modules/overview/presentation/controllers/overview.controller.ts) |
| P1 | GET `/api/v1/workspaces/{id}/overview` | JWT | — | 200, 404 | [OverviewController_workspaceOverview](../../../backend/src/modules/overview/presentation/controllers/overview.controller.ts) |
| P0 | GET `/api/v1/projects` | JWT | search · status · sort · cursor · limit | 200 | [ProjectsController_listAllProjects](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | GET `/api/v1/projects/{id}` | JWT | — | 200 | [ProjectsController_getProjectById](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | PATCH `/api/v1/projects/{id}` | JWT | application/json name, description, expectedVersion | 200 | [ProjectsController_updateProject](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | DELETE `/api/v1/projects/{id}` | JWT | — | 204 | [ProjectsController_deleteProject](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | GET `/api/v1/projects/{id}/members` | JWT | search · role · sort · cursor · limit | 200 | [ProjectsController_listMembers](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | POST `/api/v1/projects/{id}/members` | JWT | application/json email*, role | 201 | [ProjectsController_addMember](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | PATCH `/api/v1/projects/{id}/members/{userId}` | JWT | application/json role*, expectedVersion* | 200 | [ProjectsController_updateMember](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | DELETE `/api/v1/projects/{id}/members/{userId}` | JWT | — | 200 | [ProjectsController_removeMember](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | PUT `/api/v1/projects/{id}/snapshot` | JWT | application/json expectedVersion* | 200 | [ProjectsController_markCompleted](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | POST `/api/v1/projects/{id}/transfer-owner` | JWT | application/json email*, expectedVersion* | 201 | [ProjectsController_transferOwner](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | POST `/api/v1/workspaces/{workspaceId}/projects` | JWT | application/json name*, description, owner_id | 201 | [ProjectsController_createProject](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | GET `/api/v1/workspaces/{workspaceId}/projects` | JWT | search · status · sort · cursor · limit | 200 | [ProjectsController_listByWorkspace](../../../backend/src/modules/projects/presentation/controllers/projects.controller.ts) |
| P1 | POST `/api/v1/projects/{projectId}/report` | JWT | — | 202 | [requestReport](../../../backend/src/modules/analysis/presentation/controllers/report.controller.ts) |
| P1 | GET `/api/v1/projects/{projectId}/report/{reportId}/file` | JWT | — | 200, 202 | [downloadReport](../../../backend/src/modules/analysis/presentation/controllers/report.controller.ts) |
| P1 | POST `/api/v1/projects/{projectId}/summary` | JWT | — | 201 | [createSummary](../../../backend/src/modules/analysis/presentation/controllers/summary.controller.ts) |
| P1 | GET `/api/v1/projects/{projectId}/summary` | JWT | — | 200 | [getSummary](../../../backend/src/modules/analysis/presentation/controllers/summary.controller.ts) |
| P0 | GET `/api/v1/users/me` | JWT | — | 200 | [UsersController_getProfile](../../../backend/src/modules/users/presentation/controllers/users.controller.ts) |
| P1 | PATCH `/api/v1/users/me` | JWT | application/json first_name, last_name, avatar_url, phone, bio | 200 | [UsersController_updateProfile](../../../backend/src/modules/users/presentation/controllers/users.controller.ts) |
| P1 | DELETE `/api/v1/users/me` | JWT | — | 200 | [UsersController_deleteAccount](../../../backend/src/modules/users/presentation/controllers/users.controller.ts) |
| P1 | POST `/api/v1/workspaces` | JWT | application/json name*, description, member_emails | 201 | [WorkspacesController_createWorkspace](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P0 | GET `/api/v1/workspaces` | JWT | search · role · sort · cursor · limit | 200 | [WorkspacesController_listWorkspaces](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P1 | GET `/api/v1/workspaces/{id}` | JWT | — | 200 | [WorkspacesController_getWorkspaceById](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P1 | PATCH `/api/v1/workspaces/{id}` | JWT | application/json name, description, expectedVersion | 200 | [WorkspacesController_updateWorkspace](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P1 | DELETE `/api/v1/workspaces/{id}` | JWT | — | 204 | [WorkspacesController_deleteWorkspace](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P1 | POST `/api/v1/workspaces/{id}/leave` | JWT | — | 201 | [WorkspacesController_leave](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P1 | GET `/api/v1/workspaces/{id}/members` | JWT | search · role · sort · cursor · limit | 200 | [WorkspacesController_listMembers](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P1 | POST `/api/v1/workspaces/{id}/members` | JWT | application/json email*, role | 201 | [WorkspacesController_addMember](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P1 | DELETE `/api/v1/workspaces/{id}/members/{userId}` | JWT | — | 200 | [WorkspacesController_removeMember](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |
| P1 | POST `/api/v1/workspaces/{id}/transfer-owner` | JWT | application/json email*, expectedVersion* | 201 | [WorkspacesController_transferOwner](../../../backend/src/modules/workspaces/presentation/controllers/workspaces.controller.ts) |

[Phân tích dự án](01-PROJECT-ANALYSIS.md) · [Chiến lược test](04-TESTING-STRATEGY.md)
