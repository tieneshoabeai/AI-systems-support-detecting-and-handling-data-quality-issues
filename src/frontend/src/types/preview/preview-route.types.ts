import type { PreviewSectionId, SettingsSectionId } from './preview.types'

export type PreviewRoute = {
  section: PreviewSectionId
  workspaceId: string | null
  projectId: string | null
  notificationId: string | null
  settingsSection: SettingsSectionId | null
}

export type PreviewRouteIds = { workspaceId?: string | null, projectId?: string | null, notificationId?: string | null, settingsSection?: SettingsSectionId | null }
