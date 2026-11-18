import { describe, expect, it } from 'vitest'
import { isProcessingPath, isWorkbenchPath, managementHref, parseManagementRoute, parseProjectRoute, processingHref, projectHref } from '../../services/navigation/application-route'

describe('application URL contracts', () => {
  it('keeps project URLs independent of workspace scope and encodes URL values', () => {
    expect(managementHref('home')).toBe('/management')
    expect(managementHref('projects')).toBe('/management/projects')
    expect(managementHref('projects', { workspaceId: 'ws A&B' })).toBe('/management/projects?workspace=ws%20A%26B')
    expect(managementHref('projects', { workspaceId: 'ws-a', projectId: 'prj-a' })).toBe('/processing/projects/prj-a')
    expect(projectHref('a/b ?')).toBe('/processing/projects/a%2Fb%20%3F')
    expect(managementHref('workspaces', { workspaceId: 'ws-a' })).toBe('/management/workspaces/ws-a')
    expect(managementHref('notifications', { notificationId: 'n-a' })).toBe('/management/notifications/n-a')
    expect(managementHref('settings', { settingsSection: 'color' })).toBe('/management/settings/color')
  })

  it.each([
    ['/management', 'home', null, null, null],
    ['/management/workspaces/', 'workspaces', null, null, null],
    ['/management/workspaces/ws-A_1', 'workspaces', 'ws-A_1', null, null],
    ['/management/projects?workspace=ws-a', 'projects', 'ws-a', null, null],
    ['/management/projects?workspace=', 'projects', null, null, null],
    ['/management/notifications/n-a', 'notifications', null, 'n-a', null],
    ['/management/settings/color', 'settings', null, null, 'color'],
  ])('parses the full route context for %s', (url, section, workspaceId, notificationId, settingsSection) => {
    expect(parseManagementRoute(url)).toEqual({ section, workspaceId, projectId: null, notificationId, settingsSection })
  })

  it.each(['/other', '/management/home', '/management/unknown', '/management/projects/prj-a', '/management/workspaces/a/extra', '/management/workspaces/a%2Fb', '/management/projects?workspace=../a', '/management/settings/unknown'])('rejects unsupported management URL %s', url => {
    expect(parseManagementRoute(url)).toBeNull()
    expect(isWorkbenchPath(url)).toBe(false)
  })

  it.each(['profile', 'security', 'sessions', 'notifications', 'color'])('recognizes settings section %s', section => {
    expect(parseManagementRoute(`/management/settings/${section}`)?.settingsSection).toBe(section)
  })

  it.each(['upload', 'analysis', 'review', 'results'] as const)('creates and recognizes the %s processing URL', step => {
    const url = processingHref('prj-A_1', step)
    expect(url).toBe(`/processing/projects/prj-A_1/${step}`)
    expect(isProcessingPath(url)).toBe(true)
    expect(parseProjectRoute(url)).toBeNull()
  })

  it.each(['/processing', '/processing/', '/processing/new', '/processing/projects/prj-A_1', '/processing/projects/prj-A_1/', '/processing/projects/prj-A_1/records'])('recognizes processing path %s', url => {
    expect(isProcessingPath(url)).toBe(true)
    expect(isWorkbenchPath(`${url}?theme=light`)).toBe(true)
  })

  it('extracts only the project detail ID', () => {
    expect(parseProjectRoute('/processing/projects/prj-A_1/')).toBe('prj-A_1')
    expect(isWorkbenchPath('/management/projects?workspace=ws-a')).toBe(true)
  })

  it.each(['/processing/unknown', '/processing/projects/', '/processing/projects/a.b', '/processing/projects/a%2Fb', '/processing/projects/a/unknown', '/processing/projects/a/records/extra', '//processing', 'https://example.test/processing', ''])('rejects unsupported processing path %s', url => {
    expect(isProcessingPath(url)).toBe(false)
    expect(parseProjectRoute(url)).toBeNull()
  })
})
