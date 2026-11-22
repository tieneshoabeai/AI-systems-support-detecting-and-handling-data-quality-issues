import type { previewMockStore } from '../preview/preview-mock.service'
import type { AnalysisService } from '../processing/analysis.service'

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

export type SavedAnalysisResult = { dq05?: { status?: string; violations?: unknown[] } }

export type ManagementStore = typeof previewMockStore & {
  loadCardData?: (ids: readonly string[], field: 'dataset' | 'members', signal: AbortSignal, retry?: boolean) => Promise<void>
  loadProjectWizardRoster?: (workspaceId: string, signal: AbortSignal) => Promise<import('../../types/preview/preview.types').Person[]>
  adminService?: import('./admin.service').AdminService
  getWorkspaceOverview?: () => Promise<WorkspaceOverview>
  getWorkspaceDetailOverview?: (workspaceId: string) => Promise<WorkspaceDetailOverview>
  getSessionDetail?: (sessionId: string) => Promise<SessionDetail>
  getNotificationDetail?: (id: string) => Promise<void>
  getIssueDetail?: (id: string) => Promise<void>
  updateIssue?: (id: string, input: import('../../types/services-type/issues').patchIssuesByIdMineRequestBody) => Promise<void>
  refreshProject?: (id: string, signal: AbortSignal) => Promise<void>
  completeProject?: (id: string) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
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

  uploadDataset?: (projectId: string, file: File) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
  transferOwner?: (kind: 'workspace' | 'project', id: string, email: string) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
  leaveWorkspace?: (id: string) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
}
