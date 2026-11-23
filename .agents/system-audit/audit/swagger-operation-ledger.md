# Swagger operation ledger — snapshot FE 19/11/2026

Source: HEAD `f017663` + working tree; `src/frontend/src/lib/openapi.json`. **66 paths / 86 operations**. Status là khai báo Swagger, không phải kết quả network. 86 operations không có success content trực tiếp; generated request aliases có consumer, response vẫn cần mapper/guards. Không chạy generator trong đợt audit tài liệu.

| Method | Path snapshot | operationId | Declared status | 2xx content trực tiếp |
|---|---|---|---|---|
| PATCH | `/api/v1/datasets/{id}/columns/pii` | `DatasetsController_updateColumnPii` | 200, 400, 404 | Không |
| GET | `/health` | `AppController_getHealth` | 200 | Không |
| GET | `/health/ready` | `AppController_getReady` | 200, 503 | Không |
| GET | `/api/v1/users/me` | `UsersController_getProfile` | 200 | Không |
| PATCH | `/api/v1/users/me` | `UsersController_updateProfile` | 200 | Không |
| DELETE | `/api/v1/users/me` | `UsersController_deleteAccount` | 200 | Không |
| GET | `/api/v1/admin/users` | `AdminUsersController_list` | 200 | Không |
| GET | `/api/v1/admin/users/{id}` | `AdminUsersController_detail` | 200 | Không |
| POST | `/api/v1/auth/register` | `AuthController_register` | 201 | Không |
| POST | `/api/v1/auth/login` | `AuthController_login` | 200 | Không |
| POST | `/api/v1/auth/refresh` | `AuthController_refresh` | 200 | Không |
| POST | `/api/v1/auth/forgot-password` | `AuthController_forgotPassword` | 200 | Không |
| POST | `/api/v1/auth/reset-password` | `AuthController_resetPassword` | 200 | Không |
| POST | `/api/v1/auth/change-password` | `AuthController_changePassword` | 200 | Không |
| GET | `/api/v1/auth/google` | `AuthController_googleStart` | 302, 501 | Không |
| GET | `/api/v1/auth/google/callback` | `AuthController_googleCallback` | 200, 302, 401, 409 | Không |
| POST | `/api/v1/auth/logout` | `AuthController_logout` | 200 | Không |
| GET | `/api/v1/auth/sessions` | `AuthController_getSessions` | 200 | Không |
| GET | `/api/v1/auth/sessions/me` | `AuthController_getCurrentSession` | 200, 404 | Không |
| GET | `/api/v1/auth/sessions/{id}` | `AuthController_getSessionById` | 200, 404 | Không |
| DELETE | `/api/v1/auth/sessions/{id}` | `AuthController_revokeSession` | 200 | Không |
| POST | `/api/v1/workspaces` | `WorkspacesController_createWorkspace` | 201 | Không |
| GET | `/api/v1/workspaces` | `WorkspacesController_listWorkspaces` | 200 | Không |
| GET | `/api/v1/workspaces/{id}` | `WorkspacesController_getWorkspaceById` | 200 | Không |
| PATCH | `/api/v1/workspaces/{id}` | `WorkspacesController_updateWorkspace` | 200 | Không |
| DELETE | `/api/v1/workspaces/{id}` | `WorkspacesController_deleteWorkspace` | 204 | Không |
| GET | `/api/v1/workspaces/{id}/members` | `WorkspacesController_listMembers` | 200 | Không |
| POST | `/api/v1/workspaces/{id}/members` | `WorkspacesController_addMember` | 201 | Không |
| DELETE | `/api/v1/workspaces/{id}/members/{userId}` | `WorkspacesController_removeMember` | 200 | Không |
| POST | `/api/v1/workspaces/{id}/transfer-owner` | `WorkspacesController_transferOwner` | 201 | Không |
| POST | `/api/v1/workspaces/{id}/leave` | `WorkspacesController_leave` | 201 | Không |
| POST | `/api/v1/workspaces/{workspaceId}/projects` | `ProjectsController_createProject` | 201 | Không |
| GET | `/api/v1/workspaces/{workspaceId}/projects` | `ProjectsController_listByWorkspace` | 200 | Không |
| GET | `/api/v1/projects` | `ProjectsController_listAllProjects` | 200 | Không |
| GET | `/api/v1/projects/{id}` | `ProjectsController_getProjectById` | 200 | Không |
| PATCH | `/api/v1/projects/{id}` | `ProjectsController_updateProject` | 200 | Không |
| DELETE | `/api/v1/projects/{id}` | `ProjectsController_deleteProject` | 204 | Không |
| PUT | `/api/v1/projects/{id}/snapshot` | `ProjectsController_markCompleted` | 200 | Không |
| GET | `/api/v1/projects/{id}/members` | `ProjectsController_listMembers` | 200 | Không |
| POST | `/api/v1/projects/{id}/members` | `ProjectsController_addMember` | 201 | Không |
| PATCH | `/api/v1/projects/{id}/members/{userId}` | `ProjectsController_updateMember` | 200 | Không |
| DELETE | `/api/v1/projects/{id}/members/{userId}` | `ProjectsController_removeMember` | 200 | Không |
| POST | `/api/v1/projects/{id}/transfer-owner` | `ProjectsController_transferOwner` | 201 | Không |
| POST | `/api/v1/projects/{projectId}/datasets/upload` | `DatasetsController_uploadDataset` | 201 | Không |
| GET | `/api/v1/projects/{projectId}/datasets` | `DatasetsController_getDatasetByProject` | 200 | Không |
| GET | `/api/v1/datasets/{id}` | `DatasetsController_getDatasetById` | 200 | Không |
| DELETE | `/api/v1/datasets/{id}` | `DatasetsController_deleteDataset` | 204 | Không |
| GET | `/api/v1/datasets/{id}/file` | `DatasetsController_downloadDatasetFile` | 200 | Không |
| GET | `/api/v1/datasets/{id}/schema` | `DatasetsController_getDatasetSchema` | 200 | Không |
| GET | `/api/v1/datasets/{datasetId}/records` | `DataViewController_getRecords` | 200 | Không |
| POST | `/api/v1/datasets/{datasetId}/records/query` | `DataViewController_queryRecords` | 200 | Không |
| GET | `/api/v1/datasets/{datasetId}/columns/{columnKey}/stats` | `DataViewController_getColumnStats` | 200 | Không |
| POST | `/api/v1/projects/{projectId}/analysis/config` | `saveAnalysisConfig` | 200 | Không |
| GET | `/api/v1/projects/{projectId}/analysis/config` | `getAnalysisConfig` | 200 | Không |
| POST | `/api/v1/projects/{projectId}/analysis` | `runAnalysis` | 201 | Không |
| GET | `/api/v1/projects/{projectId}/analysis/result` | `getAnalysisResult` | 200 | Không |
| GET | `/api/v1/analysis/jobs/{jobId}` | `getAiJob` | 200 | Không |
| POST | `/api/v1/analysis/jobs/{jobId}/retry` | `retryAiJob` | 202 | Không |
| POST | `/api/v1/analysis/jobs/{jobId}/result` | `ingestAiResult` | 200 | Không |
| POST | `/api/v1/projects/{projectId}/summary` | `createSummary` | 201 | Không |
| GET | `/api/v1/projects/{projectId}/summary` | `getSummary` | 200 | Không |
| POST | `/api/v1/projects/{projectId}/report` | `requestReport` | 202 | Không |
| GET | `/api/v1/projects/{projectId}/report/{reportId}/file` | `downloadReport` | 200, 202 | Không |
| GET | `/api/v1/notifications` | `NotificationsController_listNotifications` | 200 | Không |
| GET | `/api/v1/notifications/unread-count` | `NotificationsController_getUnreadCount` | 200 | Không |
| GET | `/api/v1/notifications/{id}` | `NotificationsController_getDetail` | 200 | Không |
| PATCH | `/api/v1/notifications/{id}/read` | `NotificationsController_markAsRead` | 200 | Không |
| PATCH | `/api/v1/users/me/notification-preferences` | `NotificationsController_updatePreferences` | 200 | Không |
| POST | `/api/v1/issues` | `IssuesController_createReport` | 201 | Không |
| GET | `/api/v1/issues` | `IssuesController_listMine` | 200 | Không |
| POST | `/api/v1/issues/{id}/attachments` | `IssuesController_uploadAttachment` | 201 | Không |
| GET | `/api/v1/issues/{id}/attachments/{attachmentId}` | `IssuesController_downloadAttachment` | 200 | Không |
| GET | `/api/v1/issues/{id}` | `IssuesController_getMine` | 200 | Không |
| PATCH | `/api/v1/issues/{id}` | `IssuesController_updateMine` | 200 | Không |
| GET | `/api/v1/admin/issues` | `IssuesController_listForAdmin` | 200 | Không |
| GET | `/api/v1/admin/issues/{id}` | `IssuesController_getForAdmin` | 200 | Không |
| PATCH | `/api/v1/admin/issues/{id}/status` | `IssuesController_updateStatus` | 200 | Không |
| POST | `/api/v1/analyses/{analysisId}/findings/{findingId}/feedback` | `FeedbackController_createFindingFeedback` | 201 | Không |
| GET | `/api/v1/analyses/{analysisId}/findings/{findingId}/feedback` | `FeedbackController_listFindingFeedback` | 200 | Không |
| POST | `/api/v1/analyses/{analysisId}/feedback` | `FeedbackController_createRunFeedback` | 201 | Không |
| GET | `/api/v1/analyses/{analysisId}/feedback` | `FeedbackController_listRunFeedback` | 200 | Không |
| PATCH | `/api/v1/feedback/{id}` | `FeedbackController_updateMine` | 200 | Không |
| DELETE | `/api/v1/feedback/{id}` | `FeedbackController_remove` | 200 | Không |
| GET | `/api/v1/projects/{projectId}/ai-quality-metrics` | `FeedbackController_aiQualityMetrics` | 200 | Không |
| GET | `/api/v1/overview/workspaces` | `OverviewController_userWorkspacesOverview` | 200 | Không |
| GET | `/api/v1/workspaces/{id}/overview` | `OverviewController_workspaceOverview` | 200, 404 | Không |
