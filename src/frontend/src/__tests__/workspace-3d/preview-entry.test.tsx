import { afterEach, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ app: vi.fn(), preview: vi.fn(), render: vi.fn() }))
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: calls.render }) }))
vi.mock('../../app/application-bootstrap', () => { calls.app(); return { Application: () => null } })
vi.mock('../../views/workspace-3d/workspace-3d-preview', () => { calls.preview(); return { Workspace3DPreview: () => null } })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.clearAllMocks()
  document.body.innerHTML = ''
  window.history.replaceState({}, '', '/')
})

it('branches before importing application runtime on the dev preview URL', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  window.history.replaceState({}, '', '/preview/workspaces-3d')
  vi.stubEnv('DEV', true)
  await import('../../app/main')
  await vi.waitFor(() => expect(calls.render).toHaveBeenCalledTimes(2))
  expect(calls.preview).toHaveBeenCalledTimes(1)
  expect(calls.app).not.toHaveBeenCalled()
})

it('loads the normal application for that same URL in production', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  window.history.replaceState({}, '', '/preview/workspaces-3d')
  vi.stubEnv('DEV', false)
  await import('../../app/main')
  await vi.waitFor(() => expect(calls.render).toHaveBeenCalledTimes(2))
  expect(calls.app).toHaveBeenCalledTimes(1)
  expect(calls.preview).not.toHaveBeenCalled()
})

it.each([true, false])('loads auth runtime for private URLs with DEV=%s', async dev => {
  vi.stubEnv('DEV', dev)
  for (const url of ['/management', '/processing', '/workspaces/3d-dataset', '/#/preview/projects']) {
    vi.resetModules()
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="root"></div>'
    window.history.replaceState({}, '', url)
    await import('../../app/main')
    await vi.waitFor(() => expect(calls.render).toHaveBeenCalledTimes(2))
    const { Application } = await import('../../app/application-bootstrap')
    expect(calls.render.mock.lastCall?.[0]).toMatchObject({ props: { children: { type: Application } } })
    expect(calls.preview).not.toHaveBeenCalled()
  }
})
