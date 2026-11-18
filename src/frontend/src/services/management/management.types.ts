import type { previewMockStore } from '../preview/preview-mock.service'

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

export type ManagementStore = typeof previewMockStore & {
  adminService?: import('./admin.service').AdminService
  getWorkspaceOverview?: () => Promise<WorkspaceOverview>
  getWorkspaceDetailOverview?: (workspaceId: string) => Promise<WorkspaceDetailOverview>
  getSessionDetail?: (sessionId: string) => Promise<SessionDetail>
  getNotificationDetail?: (id: string) => Promise<void>
  getIssueDetail?: (id: string) => Promise<void>
  datasetService?: import('../processing/dataset.service').DatasetService
  changePassword?: (input: import('../../types/services-type/auth').postAuthChangePasswordRequestBody) => Promise<void>
  loadSessions?: () => Promise<void>
  downloadAttachment?: (reportId: string, attachmentId: string) => Promise<Blob>

  uploadDataset?: (projectId: string, file: File) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
  transferOwner?: (kind: 'workspace' | 'project', id: string, email: string) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
  leaveWorkspace?: (id: string) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
}
