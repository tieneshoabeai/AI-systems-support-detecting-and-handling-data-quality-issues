import type { previewMockStore } from '../preview/preview-mock.service'
export type ManagementStore = typeof previewMockStore & {
  downloadAttachment?: (reportId: string, attachmentId: string) => Promise<Blob>

  uploadDataset?: (projectId: string, file: File) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
  transferOwner?: (kind: 'workspace' | 'project', id: string, email: string) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
  leaveWorkspace?: (id: string) => Promise<import('../../types/preview/preview.types').PreviewMutationResult>
}
