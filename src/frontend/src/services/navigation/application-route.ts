import type { PreviewRoute, PreviewRouteIds } from '../../types/preview/preview-route.types'
import type { PreviewSectionId, SettingsSectionId } from '../../types/preview/preview.types'
import type { ProcessingStep } from '../../types/processing/processing-route.types'

export const processingSteps: readonly ProcessingStep[] = ['upload', 'analysis', 'review', 'results']
export const defaultAuthenticatedPath = '/processing'
const settingsSections: readonly SettingsSectionId[] = ['profile', 'security', 'sessions', 'notifications', 'color']
const resourceId = /^[A-Za-z0-9_-]+$/
const segment = (value: string): string => encodeURIComponent(value)

// Pure URL rules shared by the router, auth return targets and existing management UI.
// Workspace scope is a filter; a project has its own stable URL independent of its workspace.
export const managementHref = (section: PreviewSectionId, ids: PreviewRouteIds = {}): string => {
  if (section === 'home') return '/management'
  if (section === 'projects') {
    if (ids.projectId) return projectHref(ids.projectId)
    return `/management/projects${ids.workspaceId ? `?workspace=${segment(ids.workspaceId)}` : ''}`
  }
  const detail = section === 'workspaces' ? ids.workspaceId
    : section === 'notifications' ? ids.notificationId : ids.settingsSection
  return `/management/${section}${detail ? `/${segment(detail)}` : ''}`
}

export const parseManagementRoute = (source: string): PreviewRoute | null => {
  const [pathname, search = ''] = source.split('?')
  const parts = pathname.replace(/\/$/, '').split('/').slice(1)
  if (parts[0] !== 'management' || parts.length > 3) return null
  const section = parts[1] ?? 'home'
  const id = parts[2] ?? null
  if (id !== null && !resourceId.test(id)) return null
  const base: PreviewRoute = { section: 'home', workspaceId: null, projectId: null, notificationId: null, settingsSection: null }
  if (section === 'home') return parts.length === 1 ? base : null
  if (section === 'workspaces') return { ...base, section, workspaceId: id }
  if (section === 'projects') {
    if (id) return null
    const scope = new URLSearchParams(search).get('workspace')
    if (scope && !resourceId.test(scope)) return null
    return { ...base, section, projectId: id, workspaceId: id ? null : scope || null }
  }
  if (section === 'notifications') return { ...base, section, notificationId: id }
  if (section === 'settings') {
    const settingsSection = settingsSections.find(item => item === id) ?? null
    return id && !settingsSection ? null : { ...base, section, settingsSection }
  }
  return null
}

export const projectHref = (projectId: string): string => `/processing/projects/${segment(projectId)}`

export const parseProjectRoute = (pathname: string): string | null => {
  const match = pathname.match(/^\/processing\/projects\/([A-Za-z0-9_-]+)\/?$/)
  return match?.[1] ?? null
}

export const processingHref = (projectId: string, step: ProcessingStep): string =>
  `/processing/projects/${segment(projectId)}/${step}`

export const isProcessingPath = (pathname: string): boolean => {
  const parts = pathname.replace(/\/$/, '').split('/').slice(1)
  if (parts[0] !== 'processing') return false
  if (parts.length === 1 || (parts.length === 2 && parts[1] === 'new')) return true
  if (parseProjectRoute(pathname)) return true
  return parts.length === 4 && parts[1] === 'projects' && resourceId.test(parts[2])
    && processingSteps.some(step => step === parts[3])
}

export const isWorkbenchPath = (source: string): boolean =>
  parseManagementRoute(source) !== null || isProcessingPath(source.split('?')[0])
