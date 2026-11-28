import type { AnalysisService } from '../processing/analysis.service'
import type { NewProjectInput, NewProjectMemberInput, NewReportInput, NewWorkspaceInput, NewWorkspaceMemberInput, NotificationPrefKey, PreviewMutationResult, PreviewResourceKind, PreviewStoreState, ProfileEdit, Project, Workspace, WorkspaceEdit } from '../../types/management/management.types'

export const mutationRefreshFailedCode = 'MUTATION_REFRESH_FAILED'

export type ProjectMembersData = {
  project: Pick<Project, 'members' | 'owner' | 'canManage'>
  workspace: Pick<Workspace, 'name' | 'memberPreview'> | null
}

export type WorkspaceOverview = {
  totalWorkspaces: number
  totalProjects: number
  ownedWorkspaces: number
  sharedWorkspaces: number
  myProjects: number
}

export type WorkspaceDetailOverview = {
  workspaceId: string
  projectCount: number
  notStartedCount: number
  inProgressCount: number
  completedCount: number
  memberCount: number
  storageUsedBytes: number
  lastAccessedAt: string | null
}

export type SessionDetail = {
  id: string
  deviceName: string | null
  ipAddress: string | null
  userAgent: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string | null
  isRevoked: boolean
  rememberMe: boolean
}

export type SavedAnalysisResult = {
  analysisId?: string
  analysisRunId?: string
  inputFingerprint?: string
  jobId?: string
  pollUrl?: string
  aiCorrelationAssessment?: unknown
  dq05?: { status?: string; violations?: unknown[] }
}

export type ManagementStore = {
  subscribe: (listener: () => void) => () => void
  getState: () => PreviewStoreState
  selectWorkspace: (workspaceId: string) => void
  selectProject: (projectId: string) => void
  clearProject: () => void
  toggleFavorite: (workspaceId: string) => Promise<PreviewMutationResult>
  rename: (kind: PreviewResourceKind, id: string, name: string) => Promise<PreviewMutationResult>
  remove: (kind: PreviewResourceKind, id: string) => Promise<PreviewMutationResult>
  touchWorkspace: (id: string) => void
  updateWorkspace: (id: string, edit: WorkspaceEdit) => Promise<PreviewMutationResult>
  addWorkspaceMember: (input: NewWorkspaceMemberInput) => Promise<PreviewMutationResult>
  setWorkspaceMemberRole: (workspaceId: string, personId: string, role: string) => Promise<PreviewMutationResult>
  removeWorkspaceMember: (workspaceId: string, personId: string) => Promise<PreviewMutationResult>
  addProjectMember: (input: NewProjectMemberInput) => Promise<PreviewMutationResult>
  setProjectMemberRole: (projectId: string, personId: string, role: string) => Promise<PreviewMutationResult>
  removeProjectMember: (projectId: string, personId: string) => Promise<PreviewMutationResult>
  markAllNotificationsRead: () => Promise<PreviewMutationResult>
  markNotificationsRead: (ids: readonly string[]) => Promise<PreviewMutationResult>
  removeNotifications: (ids: readonly string[]) => Promise<PreviewMutationResult>
  createReport: (input: NewReportInput) => Promise<PreviewMutationResult>
  createProject: (input: NewProjectInput) => Promise<PreviewMutationResult>
  createWorkspace: (input: NewWorkspaceInput) => Promise<PreviewMutationResult>
  updateProfile: (edit: ProfileEdit) => Promise<PreviewMutationResult>
  revokeSession: (id: string) => Promise<PreviewMutationResult>
  revokeOtherSessions: () => Promise<PreviewMutationResult>
  setNotificationPref: (key: NotificationPrefKey, value: boolean) => Promise<PreviewMutationResult>
  loadProjectMembersData?: (project: Project, signal: AbortSignal) => Promise<ProjectMembersData>
  loadCardData?: (ids: readonly string[], field: 'dataset' | 'members', signal: AbortSignal, retry?: boolean) => Promise<void>
  loadProjectWizardRoster?: (workspaceId: string, signal: AbortSignal) => Promise<import('../../types/management/management.types').Person[]>
  adminService?: import('./admin.service').AdminService
  getWorkspaceOverview?: () => Promise<WorkspaceOverview>
  getWorkspaceDetailOverview?: (workspaceId: string) => Promise<WorkspaceDetailOverview>
  getSessionDetail?: (sessionId: string) => Promise<SessionDetail>
  getNotificationDetail?: (id: string) => Promise<void>
  getIssueDetail?: (id: string) => Promise<void>
  updateIssue?: (id: string, input: import('../../types/services-type/issues').patchIssuesByIdMineRequestBody) => Promise<void>
  refreshProject?: (id: string, signal: AbortSignal) => Promise<void>
  completeProject?: (id: string) => Promise<import('../../types/management/management.types').PreviewMutationResult>
  datasetService?: import('../processing/dataset.service').DatasetService
  listRecentProjects?: (cursor: string | null, signal: AbortSignal) => Promise<import('../processing/recent-projects.service').RecentProjectsPage>
  getRecentWorkspaceName?: (id: string) => Promise<string | undefined>
  loadProcessingPanels?: () => Promise<void>
  readAnalysisResult?: (projectId: string, signal: AbortSignal) => Promise<SavedAnalysisResult | null>
  analysisService?: AnalysisService
  runAnalysis?: (projectId: string) => Promise<SavedAnalysisResult>
  changePassword?: (input: import('../../types/services-type/auth').postAuthChangePasswordRequestBody) => Promise<void>
  loadSessions?: () => Promise<void>
  downloadAttachment?: (reportId: string, attachmentId: string) => Promise<Blob>

  uploadDataset?: (projectId: string, file: File, draftId?: string) => Promise<import('../../types/management/management.types').PreviewMutationResult>
  transferOwner?: (kind: 'workspace' | 'project', id: string, email: string) => Promise<import('../../types/management/management.types').PreviewMutationResult>
  leaveWorkspace?: (id: string) => Promise<import('../../types/management/management.types').PreviewMutationResult>
}
