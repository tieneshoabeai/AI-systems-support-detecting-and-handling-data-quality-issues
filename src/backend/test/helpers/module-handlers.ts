/**
 * Auto-generated — xem `scripts/generate-test-handlers.py`.
 *
 * Map: tên method (như service cũ) → Handler class tương ứng,
 * dùng cho unit test khi service đã được tách theo Command/Query pattern.
 *
 * Tên class được alias theo module để tránh trùng giữa các module
 * (vd. `RevokeSessionHandler` tồn tại ở cả `auth` và `users`).
 */

// -------------------- analysis --------------------
import { BuildPromptForJobHandler as AnalysisBuildPromptForJobHandler } from '../../src/modules/analysis/application/commands/build-prompt-for-job.handler';
import { CreateSummaryHandler as AnalysisCreateSummaryHandler } from '../../src/modules/analysis/application/commands/create-summary.handler';
import { DownloadReportFileHandler as AnalysisDownloadReportFileHandler } from '../../src/modules/analysis/application/queries/download-report-file.handler';
import { GetJobHandler as AnalysisGetJobHandler } from '../../src/modules/analysis/application/queries/get-job.handler';
import { GetReportFileMetaHandler as AnalysisGetReportFileMetaHandler } from '../../src/modules/analysis/application/queries/get-report-file-meta.handler';
import { GetResultHandler as AnalysisGetResultHandler } from '../../src/modules/analysis/application/queries/get-result.handler';
import { GetSummaryHandler as AnalysisGetSummaryHandler } from '../../src/modules/analysis/application/queries/get-summary.handler';
import { IngestAiResultHandler as AnalysisIngestAiResultHandler } from '../../src/modules/analysis/application/commands/ingest-ai-result.handler';
import { RequestReportHandler as AnalysisRequestReportHandler } from '../../src/modules/analysis/application/commands/request-report.handler';
import { RetryJobHandler as AnalysisRetryJobHandler } from '../../src/modules/analysis/application/commands/retry-job.handler';
import { RunAnalysisHandler as AnalysisRunAnalysisHandler } from '../../src/modules/analysis/application/commands/run-analysis.handler';

export const analysisHandlers = {
  buildPromptForJob: AnalysisBuildPromptForJobHandler,
  createSummary: AnalysisCreateSummaryHandler,
  downloadReportFile: AnalysisDownloadReportFileHandler,
  getJob: AnalysisGetJobHandler,
  getReportFileMeta: AnalysisGetReportFileMetaHandler,
  getResult: AnalysisGetResultHandler,
  getSummary: AnalysisGetSummaryHandler,
  ingestAiResult: AnalysisIngestAiResultHandler,
  requestReport: AnalysisRequestReportHandler,
  retryJob: AnalysisRetryJobHandler,
  runAnalysis: AnalysisRunAnalysisHandler,
} as const;

// -------------------- audit --------------------
import { AuditService as AuditLogHandler } from '../../src/modules/audit/audit.service';

export const auditHandlers = {
  log: AuditLogHandler,
} as const;

// -------------------- auth --------------------
import { ChangePasswordHandler as AuthChangePasswordHandler } from '../../src/modules/auth/application/commands/change-password.handler';
import { ForgotPasswordHandler as AuthForgotPasswordHandler } from '../../src/modules/auth/application/commands/forgot-password.handler';
import { GetSessionByIdHandler as AuthGetSessionByIdHandler } from '../../src/modules/auth/application/queries/get-session-by-id.handler';
import { GetSessionsHandler as AuthGetSessionsHandler } from '../../src/modules/auth/application/queries/get-sessions.handler';
import { LoginHandler as AuthLoginHandler } from '../../src/modules/auth/application/commands/login.handler';
import { LogoutHandler as AuthLogoutHandler } from '../../src/modules/auth/application/commands/logout.handler';
import { RefreshAccessTokenHandler as AuthRefreshAccessTokenHandler } from '../../src/modules/auth/application/commands/refresh-access-token.handler';
import { RegisterHandler as AuthRegisterHandler } from '../../src/modules/auth/application/commands/register.handler';
import { ResetPasswordHandler as AuthResetPasswordHandler } from '../../src/modules/auth/application/commands/reset-password.handler';
import { RevokeSessionHandler as AuthRevokeSessionHandler } from '../../src/modules/auth/application/commands/revoke-session.handler';

export const authHandlers = {
  changePassword: AuthChangePasswordHandler,
  forgotPassword: AuthForgotPasswordHandler,
  getSessionById: AuthGetSessionByIdHandler,
  getSessions: AuthGetSessionsHandler,
  login: AuthLoginHandler,
  logout: AuthLogoutHandler,
  refreshAccessToken: AuthRefreshAccessTokenHandler,
  register: AuthRegisterHandler,
  resetPassword: AuthResetPasswordHandler,
  revokeSession: AuthRevokeSessionHandler,
} as const;

// -------------------- data-view --------------------
import { DataViewService as DataViewDataViewService } from '../../src/modules/data-view/data-view.service';

export const dataviewHandlers = {
  getChartData: DataViewDataViewService,
  getColumnStats: DataViewDataViewService,
  getRecords: DataViewDataViewService,
  queryRecords: DataViewDataViewService,
} as const;

// -------------------- datasets --------------------
import { DeleteDatasetHandler as DatasetsDeleteDatasetHandler } from '../../src/modules/datasets/application/commands/delete-dataset.handler';
import { DownloadDatasetFileHandler as DatasetsDownloadDatasetFileHandler } from '../../src/modules/datasets/application/queries/download-dataset-file.handler';
import { GetDatasetByIdHandler as DatasetsGetDatasetByIdHandler } from '../../src/modules/datasets/application/queries/get-dataset-by-id.handler';
import { GetDatasetByProjectIdHandler as DatasetsGetDatasetByProjectIdHandler } from '../../src/modules/datasets/application/queries/get-dataset-by-project-id.handler';
import { GetDatasetSchemaHandler as DatasetsGetDatasetSchemaHandler } from '../../src/modules/datasets/application/queries/get-dataset-schema.handler';
import { IngestDatasetStreamHandler as DatasetsIngestDatasetStreamHandler } from '../../src/modules/datasets/application/commands/ingest-dataset-stream.handler';
import { MapPropsToOriginalNamesHandler as DatasetsMapPropsToOriginalNamesHandler } from '../../src/modules/datasets/application/commands/map-props-to-original-names.handler';

export const datasetsHandlers = {
  deleteDataset: DatasetsDeleteDatasetHandler,
  downloadDatasetFile: DatasetsDownloadDatasetFileHandler,
  getDatasetById: DatasetsGetDatasetByIdHandler,
  getDatasetByProjectId: DatasetsGetDatasetByProjectIdHandler,
  getDatasetSchema: DatasetsGetDatasetSchemaHandler,
  ingestDatasetStream: DatasetsIngestDatasetStreamHandler,
  mapPropsToOriginalNames: DatasetsMapPropsToOriginalNamesHandler,
} as const;

// -------------------- feedback --------------------
import { AiQualityMetricsHandler as FeedbackAiQualityMetricsHandler } from '../../src/modules/feedback/application/commands/ai-quality-metrics.handler';
import { CreateFindingFeedbackHandler as FeedbackCreateFindingFeedbackHandler } from '../../src/modules/feedback/application/commands/create-finding-feedback.handler';
import { CreateRunFeedbackHandler as FeedbackCreateRunFeedbackHandler } from '../../src/modules/feedback/application/commands/create-run-feedback.handler';
import { ListFindingFeedbackHandler as FeedbackListFindingFeedbackHandler } from '../../src/modules/feedback/application/queries/list-finding-feedback.handler';
import { ListRunFeedbackHandler as FeedbackListRunFeedbackHandler } from '../../src/modules/feedback/application/queries/list-run-feedback.handler';
import { RemoveHandler as FeedbackRemoveHandler } from '../../src/modules/feedback/application/commands/remove.handler';
import { UpdateMineHandler as FeedbackUpdateMineHandler } from '../../src/modules/feedback/application/commands/update-mine.handler';

export const feedbackHandlers = {
  aiQualityMetrics: FeedbackAiQualityMetricsHandler,
  createFindingFeedback: FeedbackCreateFindingFeedbackHandler,
  createRunFeedback: FeedbackCreateRunFeedbackHandler,
  listFindingFeedback: FeedbackListFindingFeedbackHandler,
  listRunFeedback: FeedbackListRunFeedbackHandler,
  remove: FeedbackRemoveHandler,
  updateMine: FeedbackUpdateMineHandler,
} as const;

// -------------------- issues --------------------
import { CreateReportHandler as IssuesCreateReportHandler } from '../../src/modules/issues/application/commands/create-report.handler';
import { DownloadAttachmentHandler as IssuesDownloadAttachmentHandler } from '../../src/modules/issues/application/queries/download-attachment.handler';
import { GetForAdminHandler as IssuesGetForAdminHandler } from '../../src/modules/issues/application/queries/get-for-admin.handler';
import { GetMineHandler as IssuesGetMineHandler } from '../../src/modules/issues/application/queries/get-mine.handler';
import { ListForAdminHandler as IssuesListForAdminHandler } from '../../src/modules/issues/application/queries/list-for-admin.handler';
import { ListMineHandler as IssuesListMineHandler } from '../../src/modules/issues/application/queries/list-mine.handler';
import { UpdateMyReportHandler as IssuesUpdateMyReportHandler } from '../../src/modules/issues/application/commands/update-my-report.handler';
import { UpdateStatusHandler as IssuesUpdateStatusHandler } from '../../src/modules/issues/application/commands/update-status.handler';
import { UploadAttachmentHandler as IssuesUploadAttachmentHandler } from '../../src/modules/issues/application/commands/upload-attachment.handler';

export const issuesHandlers = {
  createReport: IssuesCreateReportHandler,
  downloadAttachment: IssuesDownloadAttachmentHandler,
  getForAdmin: IssuesGetForAdminHandler,
  getMine: IssuesGetMineHandler,
  listForAdmin: IssuesListForAdminHandler,
  listMine: IssuesListMineHandler,
  updateMyReport: IssuesUpdateMyReportHandler,
  updateStatus: IssuesUpdateStatusHandler,
  uploadAttachment: IssuesUploadAttachmentHandler,
} as const;

// -------------------- notifications --------------------
import { CountUnreadHandler as NotificationsCountUnreadHandler } from '../../src/modules/notifications/application/queries/count-unread.handler';
import { DispatchHandler as NotificationsDispatchHandler } from '../../src/modules/notifications/application/commands/dispatch.handler';
import { GetDetailHandler as NotificationsGetDetailHandler } from '../../src/modules/notifications/application/queries/get-detail.handler';
import { ListForUserHandler as NotificationsListForUserHandler } from '../../src/modules/notifications/application/queries/list-for-user.handler';
import { MarkAsReadHandler as NotificationsMarkAsReadHandler } from '../../src/modules/notifications/application/commands/mark-as-read.handler';
import { UpdatePreferencesHandler as NotificationsUpdatePreferencesHandler } from '../../src/modules/notifications/application/commands/update-preferences.handler';

export const notificationsHandlers = {
  countUnread: NotificationsCountUnreadHandler,
  dispatch: NotificationsDispatchHandler,
  getDetail: NotificationsGetDetailHandler,
  listForUser: NotificationsListForUserHandler,
  markAsRead: NotificationsMarkAsReadHandler,
  updatePreferences: NotificationsUpdatePreferencesHandler,
} as const;

// -------------------- overview --------------------
import { OverviewService as OverviewOverviewService } from '../../src/modules/overview/overview.service';

export const overviewHandlers = {
  getUserOverview: OverviewOverviewService,
  getWorkspaceOverview: OverviewOverviewService,
} as const;

// -------------------- projects --------------------
import { AddProjectMemberHandler as ProjectsAddProjectMemberHandler } from '../../src/modules/projects/application/commands/add-project-member.handler';
import { CreateProjectHandler as ProjectsCreateProjectHandler } from '../../src/modules/projects/application/commands/create-project.handler';
import { DeleteProjectHandler as ProjectsDeleteProjectHandler } from '../../src/modules/projects/application/commands/delete-project.handler';
import { GetProjectByIdHandler as ProjectsGetProjectByIdHandler } from '../../src/modules/projects/application/queries/get-project-by-id.handler';
import { GetProjectsByWorkspaceHandler as ProjectsGetProjectsByWorkspaceHandler } from '../../src/modules/projects/application/queries/get-projects-by-workspace.handler';
import { GetWorkspaceNameHandler as ProjectsGetWorkspaceNameHandler } from '../../src/modules/projects/application/queries/get-workspace-name.handler';
import { ListMembersHandler as ProjectsListMembersHandler } from '../../src/modules/projects/application/queries/list-members.handler';
import { ListProjectsByWorkspaceHandler as ProjectsListProjectsByWorkspaceHandler } from '../../src/modules/projects/application/queries/list-projects-by-workspace.handler';
import { MarkCompletedHandler as ProjectsMarkCompletedHandler } from '../../src/modules/projects/application/commands/mark-completed.handler';
import { RemoveProjectMemberHandler as ProjectsRemoveProjectMemberHandler } from '../../src/modules/projects/application/commands/remove-project-member.handler';
import { ResolveUserProjectRoleHandler as ProjectsResolveUserProjectRoleHandler } from '../../src/modules/projects/application/queries/resolve-user-project-role.handler';
import { SetHasDatasetHandler as ProjectsSetHasDatasetHandler } from '../../src/modules/projects/application/commands/set-has-dataset.handler';
import { TransferProjectOwnerHandler as ProjectsTransferProjectOwnerHandler } from '../../src/modules/projects/application/commands/transfer-project-owner.handler';
import { UpdateProjectHandler as ProjectsUpdateProjectHandler } from '../../src/modules/projects/application/commands/update-project.handler';
import { UpdateProjectMemberRoleHandler as ProjectsUpdateProjectMemberRoleHandler } from '../../src/modules/projects/application/commands/update-project-member-role.handler';

export const projectsHandlers = {
  addProjectMember: ProjectsAddProjectMemberHandler,
  createProject: ProjectsCreateProjectHandler,
  deleteProject: ProjectsDeleteProjectHandler,
  getProjectById: ProjectsGetProjectByIdHandler,
  getProjectsByWorkspace: ProjectsGetProjectsByWorkspaceHandler,
  getWorkspaceName: ProjectsGetWorkspaceNameHandler,
  listMembers: ProjectsListMembersHandler,
  listProjectsByWorkspace: ProjectsListProjectsByWorkspaceHandler,
  markCompleted: ProjectsMarkCompletedHandler,
  removeProjectMember: ProjectsRemoveProjectMemberHandler,
  resolveUserProjectRole: ProjectsResolveUserProjectRoleHandler,
  setHasDataset: ProjectsSetHasDatasetHandler,
  transferProjectOwner: ProjectsTransferProjectOwnerHandler,
  updateProject: ProjectsUpdateProjectHandler,
  updateProjectMemberRole: ProjectsUpdateProjectMemberRoleHandler,
} as const;

// -------------------- users --------------------
import { CreateSessionHandler as UsersCreateSessionHandler } from '../../src/modules/users/application/commands/create-session.handler';
import { CreateUserHandler as UsersCreateUserHandler } from '../../src/modules/users/application/commands/create-user.handler';
import { FindActiveSessionsHandler as UsersFindActiveSessionsHandler } from '../../src/modules/users/application/queries/find-active-sessions.handler';
import { FindByEmailHandler as UsersFindByEmailHandler } from '../../src/modules/users/application/queries/find-by-email.handler';
import { FindByIdHandler as UsersFindByIdHandler } from '../../src/modules/users/application/queries/find-by-id.handler';
import { FindPagedHandler as UsersFindPagedHandler } from '../../src/modules/users/application/queries/find-paged.handler';
import { FindSessionByIdHandler as UsersFindSessionByIdHandler } from '../../src/modules/users/application/queries/find-session-by-id.handler';
import { FindSessionByTokenHashHandler as UsersFindSessionByTokenHashHandler } from '../../src/modules/users/application/queries/find-session-by-token-hash.handler';
import { RevokeAllUserSessionsHandler as UsersRevokeAllUserSessionsHandler } from '../../src/modules/users/application/commands/revoke-all-user-sessions.handler';
import { RevokeSessionHandler as UsersRevokeSessionHandler } from '../../src/modules/users/application/commands/revoke-session.handler';
import { RevokeSessionByIdHandler as UsersRevokeSessionByIdHandler } from '../../src/modules/users/application/commands/revoke-session-by-id.handler';
import { SoftDeleteUserHandler as UsersSoftDeleteUserHandler } from '../../src/modules/users/application/commands/soft-delete-user.handler';
import { TouchSessionHandler as UsersTouchSessionHandler } from '../../src/modules/users/application/commands/touch-session.handler';
import { UpdateNotificationPreferencesHandler as UsersUpdateNotificationPreferencesHandler } from '../../src/modules/users/application/commands/update-notification-preferences.handler';
import { UpdateProfileHandler as UsersUpdateProfileHandler } from '../../src/modules/users/application/commands/update-profile.handler';

export const usersHandlers = {
  createSession: UsersCreateSessionHandler,
  createUser: UsersCreateUserHandler,
  findActiveSessions: UsersFindActiveSessionsHandler,
  findByEmail: UsersFindByEmailHandler,
  findById: UsersFindByIdHandler,
  findPaged: UsersFindPagedHandler,
  findSessionById: UsersFindSessionByIdHandler,
  findSessionByTokenHash: UsersFindSessionByTokenHashHandler,
  revokeAllUserSessions: UsersRevokeAllUserSessionsHandler,
  revokeSession: UsersRevokeSessionHandler,
  revokeSessionById: UsersRevokeSessionByIdHandler,
  softDeleteUser: UsersSoftDeleteUserHandler,
  touchSession: UsersTouchSessionHandler,
  updateNotificationPreferences: UsersUpdateNotificationPreferencesHandler,
  updateProfile: UsersUpdateProfileHandler,
} as const;

// -------------------- workspaces --------------------
import { AddMemberHandler as WorkspacesAddMemberHandler } from '../../src/modules/workspaces/application/commands/add-member.handler';
import { CheckWorkspaceUploadQuotaHandler as WorkspacesCheckWorkspaceUploadQuotaHandler } from '../../src/modules/workspaces/application/queries/check-workspace-upload-quota.handler';
import { CreateWorkspaceHandler as WorkspacesCreateWorkspaceHandler } from '../../src/modules/workspaces/application/commands/create-workspace.handler';
import { DeleteWorkspaceHandler as WorkspacesDeleteWorkspaceHandler } from '../../src/modules/workspaces/application/commands/delete-workspace.handler';
import { GetWorkspaceByIdHandler as WorkspacesGetWorkspaceByIdHandler } from '../../src/modules/workspaces/application/queries/get-workspace-by-id.handler';
import { GetWorkspacesHandler as WorkspacesGetWorkspacesHandler } from '../../src/modules/workspaces/application/queries/get-workspaces.handler';
import { IncrementStorageUsedHandler as WorkspacesIncrementStorageUsedHandler } from '../../src/modules/workspaces/application/commands/increment-storage-used.handler';
import { LeaveWorkspaceHandler as WorkspacesLeaveWorkspaceHandler } from '../../src/modules/workspaces/application/commands/leave-workspace.handler';
import { ListMembersHandler as WorkspacesListMembersHandler } from '../../src/modules/workspaces/application/queries/list-members.handler';
import { ListWorkspacesHandler as WorkspacesListWorkspacesHandler } from '../../src/modules/workspaces/application/queries/list-workspaces.handler';
import { RemoveMemberHandler as WorkspacesRemoveMemberHandler } from '../../src/modules/workspaces/application/commands/remove-member.handler';
import { ResolveUserWorkspaceRoleHandler as WorkspacesResolveUserWorkspaceRoleHandler } from '../../src/modules/workspaces/application/queries/resolve-user-workspace-role.handler';
import { TransferOwnerHandler as WorkspacesTransferOwnerHandler } from '../../src/modules/workspaces/application/commands/transfer-owner.handler';
import { UpdateWorkspaceHandler as WorkspacesUpdateWorkspaceHandler } from '../../src/modules/workspaces/application/commands/update-workspace.handler';

export const workspacesHandlers = {
  addMember: WorkspacesAddMemberHandler,
  checkWorkspaceUploadQuota: WorkspacesCheckWorkspaceUploadQuotaHandler,
  createWorkspace: WorkspacesCreateWorkspaceHandler,
  deleteWorkspace: WorkspacesDeleteWorkspaceHandler,
  getWorkspaceById: WorkspacesGetWorkspaceByIdHandler,
  getWorkspaces: WorkspacesGetWorkspacesHandler,
  incrementStorageUsed: WorkspacesIncrementStorageUsedHandler,
  leaveWorkspace: WorkspacesLeaveWorkspaceHandler,
  listMembers: WorkspacesListMembersHandler,
  listWorkspaces: WorkspacesListWorkspacesHandler,
  removeMember: WorkspacesRemoveMemberHandler,
  resolveUserWorkspaceRole: WorkspacesResolveUserWorkspaceRoleHandler,
  transferOwner: WorkspacesTransferOwnerHandler,
  updateWorkspace: WorkspacesUpdateWorkspaceHandler,
} as const;
