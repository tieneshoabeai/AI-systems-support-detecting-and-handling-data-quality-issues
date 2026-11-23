# 12. Catalogue nghiệp vụ bất biến — Không được làm mất khi refactor

> **Mục đích:** Liệt kê toàn bộ nghiệp vụ đã đọc từ mã nguồn thật (340 file, 107 handler + 3 subscriber, 82 route HTTP + 1 WS gateway) để khi flatten sang vertical slice **không sót logic**.
> **Nguyên tắc dùng:** Trước khi gộp mỗi module, đối chiếu checklist của module đó ở đây. Sau khi gộp, chạy cổng kiểm soát ở `03_phase_p0_p1.md` §3.4.
>
> **Số liệu đã hiệu chỉnh ngày 2026-11-23 (đo thật):** `src/modules` = **340 file / 31 505 LOC**, `src/shared` = **88 file / 5 567 LOC**, handler = **107 (61 cmd + 46 query) + 3 subscriber**, route HTTP thật = **82 decorator**, model Mongoose = **18 model / 17 file schema**.

---

## 12.1. Bản đồ route bất biến (82 route — giữ nguyên prefix + method + path)

> Không thêm, không bớt, không đổi prefix. `arch:api-coverage` sau mỗi phase phải khớp danh sách này.

- **analysis** (9, không prefix): `POST projects/:projectId/analysis` · `GET projects/:projectId/analysis/result` · `GET analysis/jobs/:jobId` · `POST analysis/jobs/:jobId/retry` · `POST analysis/jobs/:jobId/result` · `POST projects/:projectId/report` · `GET projects/:projectId/report/:reportId/file` · `POST projects/:projectId/summary` · `GET projects/:projectId/summary`.
- **auth** (13, prefix `auth`): `POST register` · `POST login` · `POST refresh` · `POST forgot-password` · `POST reset-password` · `POST change-password` · `GET google` · `GET google/callback` · `POST logout` · `GET sessions` · `GET sessions/me` (**phải khai báo trước** `sessions/:id`) · `GET sessions/:id` · `DELETE sessions/:id`.
- **data-view** (4, prefix `datasets/:datasetId`): `GET records` · `POST records/query` · `GET columns/:columnKey/stats` · `GET charts`.
- **datasets** (6): `POST projects/:projectId/datasets/upload` · `GET projects/:projectId/datasets` · `GET datasets/:id` · `DELETE datasets/:id` · `GET datasets/:id/file` · `GET datasets/:id/schema`.
- **feedback** (7): `POST analyses/:analysisId/findings/:findingId/feedback` · `POST analyses/:analysisId/feedback` · `GET analyses/:analysisId/findings/:findingId/feedback` · `GET analyses/:analysisId/feedback` · `PATCH feedback/:id` · `DELETE feedback/:id` · `GET projects/:projectId/ai-quality-metrics`.
- **issues** (9): `POST issues` · `GET issues` · `POST issues/:id/attachments` · `GET issues/:id/attachments/:attachmentId` · `GET issues/:id` · `PATCH issues/:id` · `GET admin/issues` · `GET admin/issues/:id` · `PATCH admin/issues/:id/status`.
- **notifications** (5): `GET notifications` · `GET notifications/unread-count` (**phải khai báo trước** `notifications/:id`) · `GET notifications/:id` · `PATCH notifications/:id/read` · `PATCH users/me/notification-preferences`.
- **overview** (2): `GET overview/workspaces` · `GET workspaces/:id/overview`.
- **projects** (12): `POST/GET workspaces/:workspaceId/projects` · `GET projects` · `GET/PATCH/DELETE projects/:id` · `PUT projects/:id/snapshot` · `GET/POST projects/:id/members` · `PATCH/DELETE projects/:id/members/:userId` · `POST projects/:id/transfer-owner`.
- **users** (5): `GET users/me` · `PATCH users/me` · `DELETE users/me` · `GET admin/users` · `GET admin/users/:id`.
- **workspaces** (10, prefix `workspaces`): `POST /` · `GET /` · `GET :id` · `PATCH :id` · `DELETE :id` · `GET :id/members` · `POST :id/members` · `DELETE :id/members/:userId` · `POST :id/transfer-owner` · `POST :id/leave`.
- **realtime**: WS gateway + 4 message `joinProject` · `joinAnalysis` · `leaveProject` · `leaveAnalysis` + handshake auth + `disconnectUser(userId, status)` — giữ nguyên.
- **audit**: không có HTTP route — chỉ facade nội bộ `AUDIT_LOGGER_PORT.log()` (best-effort, không ném lỗi).

**Bẫy thứ tự route (dễ vỡ khi gộp controller):** `auth/sessions/me` trước `sessions/:id`; `notifications/unread-count` trước `notifications/:id`. Khi viết lại `*.routes.ts` phải giữ đúng thứ tự khai báo.

---

## 12.2. Catalogue handler thành service method (107 handler — map 1-1, giữ chữ ký `execute()`)

> Mỗi handler thành **1 method** trong service, **giữ nguyên tên logic + tham số + thứ tự**. Không đổi `execute()` thành tên khác (trừ `audit` đã chốt ở P2).

### `analysis` (11: 6 cmd + 5 query) — T3 chỉ di chuyển
- `BuildPromptForJobHandler.execute(jobId)` · `CreateSummaryHandler.execute(projectId)` · `IngestAiResultHandler.execute(jobId, raw, modelId?)` · `RequestReportHandler.execute(projectId)` · `RetryJobHandler.execute(jobId)` · `RunAnalysisHandler.execute(projectId, dto, userId?)`.
- `DownloadReportFileHandler.execute(projectId, reportId)` · `GetJobHandler.execute(jobId)` · `GetReportFileMetaHandler.execute(projectId, reportId)` · `GetResultHandler.execute(projectId)` · `GetSummaryHandler.execute(projectId)`.
- Kèm 3 service giữ riêng: `ai-worker`, `rag-few-shot`, `report-worker`; 2 port `AiInferencePort`, `RESOURCE_GUARD_PORT`; 2 policy loader `AnalysisJobPolicyLoader`, `AnalysisRunPolicyLoader`.

### `audit` (1) — pilot, đã chốt template
- `LogHandler.execute(input, changes?)` → `AuditService.log()` (điểm lệch duy nhất, implement `AUDIT_LOGGER_PORT`). Module `@Global()`, best-effort try/catch warn.

### `auth` (11: 9 cmd + 2 query) — T3 chỉ di chuyển
- `ChangePasswordHandler.execute(userId, currentSessionId, currentPassword, newPassword, confirmPassword)` · `ForgotPasswordHandler.execute(emailRaw)` · `LoginHandler.execute(dto, ip?, ua?)` · `LoginWithGoogleHandler.execute(code, state, expectedState, ip?, ua?, rememberMe=false)` · `LogoutHandler.execute(sessionId?)` · `RefreshAccessTokenHandler.execute(rawRefreshToken)` · `RegisterHandler.execute(dto)` · `ResetPasswordHandler.execute(emailRaw, otp, newPassword)` · `RevokeSessionHandler.execute(userId, sessionId)`.
- `GetSessionByIdHandler.execute(userId, sessionId)` · `GetSessionsHandler.execute(userId)`.
- Kèm `admin-bootstrap.service`, `security-alert.service`; VO `password-policy` (8–100 ký tự); adapter `users-auth-lookup/session` implement port của `users`.

### `datasets` (8 handler + 1 subscriber) — T2 nhạy cảm nhất
- `CascadeProjectDatasetsHandler.execute(projectId, workspaceId?)` (giữ riêng) · `DeleteDatasetHandler.execute(id)` (transaction: soft-delete + `setHasDataset(false)` + trừ storage) · `IngestDatasetStreamHandler.execute({projectId, fileStream, fileName, mimeType, contentLength?})` (**2 pha**: suy schema từ `SAMPLE_ROWS_CAP` dòng rồi ép kiểu + ghi batch `IMPORT_BATCH_SIZE`; delimiter cố định `,`; giữ dòng rỗng làm finding; header trùng chấp nhận thành finding) · `MapPropsToOriginalNamesHandler.execute()` (không tham số — migration/backfill, giữ riêng).
- `DownloadDatasetFileHandler.execute(id)` · `GetDatasetByIdHandler.execute(id)` · `GetDatasetByProjectIdHandler.execute(projectId)` · `GetDatasetSchemaHandler.execute(id)` · `CascadeDatasetEventSubscriber` (giữ riêng).

### `data-view` (4 query) — T1
- `GetChartDataHandler.execute(datasetId, {columns?, topN?, maxRows?})` · `GetColumnStatsHandler.execute(datasetId, columnRef)` · `GetRecordsHandler.execute(datasetId, query)` · `QueryRecordsHandler.execute(datasetId, body)`.
- Không có schema/repository riêng — đọc qua `RECORD_QUERY_PORT` của `datasets`. Hằng số `DEFAULT_RECORD_LIMIT=50`, `MAX_RECORD_LIMIT=500`, `normalizeRecordLimit()` giữ nguyên.

### `feedback` (7: 5 cmd + 2 query) — T2
- `AiQualityMetricsHandler.execute(userId, role, projectId)` · `CreateFindingFeedbackHandler.execute(userId, role, analysisId, findingId, dto)` · `CreateRunFeedbackHandler.execute(userId, role, analysisId, dto)` · `RemoveHandler.execute(userId, role, id)` · `UpdateMineHandler.execute(userId, roleOrId, idOrDto, dtoOrRole?)` (**chữ ký 4 tham số quá tải — giữ nguyên thứ tự khi gộp, không chuẩn hoá**).
- `ListFindingFeedbackHandler.execute(userId, role, analysisId, findingId, query)` · `ListRunFeedbackHandler.execute(userId, role, analysisId, query)`.
- Bất biến: `ensureNotAdmin(role)` — admin hệ thống bị `ForbiddenError` với FB-*; guard `isObjectIdHex`; repository hỗ trợ cả camel + snake + ObjectId cũ — không được “làm sạch” logic này.

### `issues` (9: 4 cmd + 5 query) — T2
- `CreateReportHandler.execute(userId, dto)` (entity `IssueReport.create()` kiểm tra title ≤ 200, desc ≤ 5000) · `UpdateMyReportHandler.execute(userId, id, {title?, description?, removeAttachmentIds?, expectedVersion})` (optimistic locking) · `UpdateStatusHandler.execute(id, role, status, expectedVersion)` · `UploadAttachmentHandler.execute(userId, role, issueId, {filename, mimeType, size, stream})`.
- `DownloadAttachmentHandler.execute(userId, role, issueId, attachmentId)` · `GetForAdminHandler.execute(id, role)` · `GetMineHandler.execute(userId, id)` · `ListForAdminHandler.execute(query)` · `ListMineHandler.execute(userId, query)`.

### `notifications` (6: 3 cmd + 3 query) — T1
- `DispatchHandler.execute(params)` · `MarkAsReadHandler.execute(userId, id)` · `UpdatePreferencesHandler.execute(userId, enabled)` (route `PATCH users/me/notification-preferences` nằm ở controller notifications — khi gộp giữ nguyên route, không chuyển sang users).
- `CountUnreadHandler.execute(userId)` · `GetDetailHandler.execute(userId, id)` · `ListForUserHandler.execute(userId, query)`.
- 2 mapper khác nhau: `notification.mapper.ts` (DB) vs `notification-email.mapper.ts` (email) — **không gộp**.

### `overview` (2 query) — T1 đơn giản nhất
- `GetUserOverviewHandler.execute(userId)` (Promise.all 3 count) · `GetWorkspaceOverviewHandler.execute(workspaceId)` — chỉ đọc qua `WORKSPACE_REPOSITORY_PORT` + `PROJECT_REPOSITORY_PORT`, không có DB riêng.

### `projects` (17: 10 cmd + 7 query) — T2
- `AddProjectMemberHandler.execute(projectId, dto)` · `CascadeWorkspaceProjectsHandler.execute(workspaceId)` (giữ riêng) · `CreateProjectHandler.execute(workspaceId, userId, dto)` · `DeleteProjectHandler.execute(id)` (transaction + outbox `PROJECT_DELETED`) · `MarkCompletedHandler.execute(projectId, expectedVersion?)` · `RemoveProjectMemberHandler.execute(projectId, memberUserId)` · `SetHasDatasetHandler.execute(projectId, hasDataset)` · `TransferProjectOwnerHandler.execute(projectId, actorUserId, dto)` · `UpdateProjectHandler.execute(id, dto)` · `UpdateProjectMemberRoleHandler.execute(projectId, memberUserId, dto)`.
- `GetProjectByIdHandler.execute(id, touch=false)` · `GetProjectsByWorkspaceHandler.execute(workspaceId)` · `GetWorkspaceNameHandler.execute(workspaceId)` · `ListAllProjectsHandler.execute(userId, workspaceIds, q, isAdmin)` · `ListMembersHandler.execute(projectId, q)` · `ListProjectsByWorkspaceHandler.execute(workspaceId, q)` · `ResolveUserProjectRoleHandler.execute(projectId, userId, workspaceRole?)`.
- 3 policy loader giữ nguyên 3 class khi gộp vào `projects.policy.ts`; `cascade-project-event.subscriber.ts` giữ riêng.

### `users` (17: 11 cmd + 6 query) — T2
- `BlockUserHandler.execute(userId)` · `CreateSessionHandler.execute({user_id, refresh_token_hash, device_name?, ip_address?, user_agent?, remember_me?})` (snake_case — giữ nguyên) · `CreateUserHandler.execute({id, email, password_hash, first_name, last_name, role?})` · `RevokeAllUserSessionsHandler.execute(userId)` · `RevokeSessionByIdHandler.execute(sessionId)` · `RevokeSessionHandler.execute(userId, sessionId)` · `SoftDeleteUserHandler.execute(userId)` (transaction + outbox `USER_REMOVED`) · `TouchSessionHandler.execute(sessionId, lastUsedAt)` · `UnblockUserHandler.execute(userId)` · `UpdateNotificationPreferencesHandler.execute(userId, enabled)` · `UpdateProfileHandler.execute(userId, {...})`.
- `FindActiveSessionsHandler.execute(userId)` · `FindByEmailHandler.execute(email, includePassword=false)` · `FindByIdHandler.execute(id)` · `FindPagedHandler.execute(opts)` · `FindSessionByIdHandler.execute(sessionId)` · `FindSessionByTokenHashHandler.execute(refreshTokenHash)`.
- `UserAccessRevocationService` giữ file riêng (ghi outbox `USER_BLOCKED`/`USER_REMOVED` + publish realtime); VO session `SESSION_TTL 7 ngày`, `REMEMBER_ME 30 ngày`.

### `workspaces` (14: 8 cmd + 6 query) — T2
- `AddMemberHandler.execute(workspaceId, dto, invitedByUserId?)` · `CreateWorkspaceHandler.execute(userId, dto)` (kiểm tra quota `MAX_WORKSPACES_PER_USER=20`, chỉ tính owned, admin miễn) · `DeleteWorkspaceHandler.execute(id)` (transaction + outbox `WORKSPACE_DELETED` strict — lỗi ghi outbox thì rollback) · `IncrementStorageUsedHandler.execute(workspaceId, deltaBytes)` · `LeaveWorkspaceHandler.execute(workspaceId, userId)` · `RemoveMemberHandler.execute(workspaceId, memberUserId)` · `TransferOwnerHandler.execute(workspaceId, actorUserId, dto)` · `UpdateWorkspaceHandler.execute(id, dto)`.
- `CheckWorkspaceUploadQuotaHandler.execute(workspaceId, incomingBytes, quotaBytes)` · `GetWorkspaceByIdHandler.execute(id, touch=false)` · `GetWorkspacesHandler.execute(user)` · `ListMembersHandler.execute(workspaceId, q)` · `ListWorkspacesHandler.execute(user, q)` · `ResolveUserWorkspaceRoleHandler.execute(workspaceId, userId)`.
- Adapter `workspace-context` là fail-safe (lỗi → tập rỗng) — giữ try/catch.

### `realtime` (0 handler + 1 subscriber)
- `realtime.service.ts`, `realtime-auth.service.ts` (kiểm tra trạng thái tài khoản lúc handshake), `realtime-revocation.subscriber.ts` (lắng nghe `USER_BLOCKED`/`USER_REMOVED`, `extractUserId` chấp nhận cả `user_id` + `userId`, idempotent), transport `socket-io-realtime.transport.ts`, gateway giữ nguyên 4 message.

---

## 12.3. DI tokens và wiring bất biến (giữ nguyên Symbol + `useExisting`/`useClass`)

- `AUDIT_LOGGER_PORT` / `AUDIT_REPOSITORY_PORT`: `audit` định nghĩa, `AuditLoggerAdapter` / `AuditRepository` cài đặt. `AuditModule` là `@Global()` — giữ.
- `AUTH_*` (7 token): `auth` định nghĩa; `bcrypt-hasher`, `jwt-issuer`, `google-oauth`, `users-auth-lookup/session`, `env-auth-session-policy` cài đặt. Cầu nối `users-auth-*` implement port của `users` — import qua `../users`.
- `DATASET_REPOSITORY_PORT` / `RECORD_QUERY_PORT`: `datasets` định nghĩa; `DatasetsRepository` / `RecordQueryRepository` cài đặt. `RECORD_QUERY_PORT` do `datasets` sở hữu — `data-view`/`analysis` chỉ tiêu thụ.
- `WORKSPACE_*` / `PROJECT_*` (REPOSITORY/ACCESS/CONTEXT): token context nằm ở `shared/application/ports`, module chỉ implement — không di chuyển token vào module.
- `TRANSACTION_PORT` / `OUTBOX_PORT`: ở `shared`; các handler xoá/ingest dùng `tx.runInTransaction()` — không tách transaction.
- `REALTIME_PORT` / `REALTIME_TRANSPORT_PORT`, `DOMAIN_EVENT_HANDLER_REGISTRY`: ở `shared`; `users` chỉ phát event, không import socket.
- `STORAGE_PORT` / `EMAIL_SENDER` / `PUSH_SENDER`: giữ ở `shared` (dùng từ 3 module trở lên).
- `ANALYSIS_REPOSITORY_PORT` / `RAG_FEW_SHOT_PORT` / `AiInferencePort` / `RESOURCE_GUARD_PORT`: ở `analysis`; `RagFewShotService` (`useExisting`), `LocalInferenceAdapter` (`useClass`), `SystemResourceGuardAdapter`. `LocalInferenceAdapter` đọc `ConfigService` trực tiếp — giữ.
- Đồ thị import giữ nguyên, không tạo chu trình: `analysis→projects/datasets`; `datasets→projects/workspaces`; `data-view→datasets`; `feedback→projects/workspaces/users/analysis`; `issues→notifications/users`; `notifications→users`; `overview→workspaces/projects`; `projects→workspaces/users`; `realtime→workspaces/users/projects`; `auth→users`; `workspaces→users`. Sau flatten, `*.module.ts` chỉ đổi đường dẫn import, không đổi danh sách `imports/exports/providers`.

---

## 12.4. Guards / Policy / RBAC 3 tầng (giữ nguyên thứ tự decorator)

- Mọi controller (trừ `@Public()` login/register/google/forgot/reset + một số GET) dùng `@UseGuards(JwtAuthGuard, PoliciesGuard)` + cặp `@PolicyResource(...)` + `@CheckPolicies(...)`.
- Policy loader giữ nguyên class: `WorkspacePolicyLoader`; `ProjectPolicyLoader` + `ProjectScopePolicyLoader` + `WorkspaceScopePolicyLoader`; `DatasetPolicyLoader`; `AnalysisJobPolicyLoader` + `AnalysisRunPolicyLoader`.
- Các adapter context/access của `workspaces`/`projects` giữ file riêng, giữ tên class.
- `Roles('admin')` chỉ ở `admin/*` (issues admin, users admin) — không gộp nhầm vào routes user.

---

## 12.5. Transaction / Outbox / Cascade / Soft-delete (không được đụng logic)

- Xoá workspace: `softDelete` + `recordEvent(WORKSPACE_DELETED)` trong cùng `tx.runInTransaction`; strict — lỗi outbox thì rollback.
- Xoá project: tương tự với `PROJECT_DELETED`; `projects` tiêu thụ `WORKSPACE_DELETED` qua subscriber + handler cascade; query có lớp phòng thủ loại project mồ côi.
- Xoá dataset: `softDeleteDatasetWithRecords` + `setHasDataset(false)` + `incrementStorageUsed(-fileSize)` trong cùng transaction.
- Ingest dataset: entity `Dataset.create→markReady/markFailed`; kèm ghi outbox.
- Khoá/xoá user: ghi outbox `USER_BLOCKED`/`USER_REMOVED` rồi publish realtime; subscriber đóng socket idempotent.
- Audit: **best-effort** (ngược với outbox): try/catch warn, không ném — vì ghi sau khi mutation đã commit.
- Soft-delete: `deleted_at: Date | null` + index partial unique. Mọi `list/find` phải lọc `deleted_at: null`; khi gộp repository không được bỏ điều kiện này.

---

## 12.6. Hằng số nghiệp vụ (giữ nguyên giá trị)

- `datasets`: `MAX_FILE_BYTES=50MB`, `MAX_COLUMNS=1000`, `IMPORT_BATCH_SIZE=5000`, `SAMPLE_ROWS_CAP=500`, `TYPE_INFERENCE_THRESHOLD=0.8`, `DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh`, delimiter `,`, `stableColumnKey(i)=c{i}`, `coerceValue` (rỗng→null, không ép được→giữ gốc).
- `data-view`: `DEFAULT_RECORD_LIMIT=50`, `MAX_RECORD_LIMIT=500`.
- `workspaces`: `MAX_WORKSPACES_PER_USER=20` (chỉ tính owned, admin miễn).
- `auth/users`: mật khẩu 8–100 ký tự, session 7 ngày, remember-me 30 ngày.
- `issues`: title ≤ 200, description ≤ 5000, `expectedVersion` optimistic locking.
- `analysis`: `MAX_CORRELATION_CELLS` (cardinality guard), `MAX_FEW_SHOT_STORE`, `DEFAULT_TOP_K/MIN_TRUST/MAX_AGE_DAYS` của RAG — T3 không đụng.

---

## 12.7. Schemas và Repository (18 model / 17 file — giữ nguyên tên + collection + index)

`AiJob` · `AnalysisResult` · `AnalysisRun` · `CellEvidence` · `FewShotExample` · `ProjectSave` · `ReportJob` (7 ở `analysis`) · `AuditLog` + `AuditChange` (2 chung 1 file ở `audit`) · `Dataset` + `DatasetRecord` (2 ở `datasets`, `DatasetRecord` chỉ khai báo ở đây) · `FindingFeedback` · `IssueReport` · `Notification` · `Project` · `Workspace` · `User` + `UserSession`. `MongooseModule.forFeature` trong `*.module.ts` giữ nguyên; `*.schema.ts` chỉ đổi đường dẫn; `*.mapper.ts` T1/T2 được gộp vào repository, T3 giữ riêng; `record-query.repository.ts` giữ riêng phục vụ Virtual Grid.

---

## 12.8. Cách dùng file này khi refactor (5 phút/module)

1. Mở §12.2 tìm module → tick từng `execute()` khi chuyển thành method (giữ chữ ký).
2. Mở §12.1 tick từng route khi chuyển controller → `*.routes.ts` (giữ prefix + thứ tự).
3. Mở §12.3–12.5 kiểm tra token/wiring/guard/transaction còn đủ.
4. Chạy cổng kiểm soát P0–P1 rồi mới commit + tag.

---

> **Ràng buộc thực thi đi kèm:** file này nói *giữ cái gì*; cách giữ + cấm làm gì + kiểm tra bằng gì nằm ở [`13_refactor_constraints.md`](13_refactor_constraints.md) (TC/AC/FC/BC/PC + checklist §13.6). Trước mỗi commit phải tick hết §13.6.
