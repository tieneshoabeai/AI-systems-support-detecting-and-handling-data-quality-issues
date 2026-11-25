import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { test } from '../support/live-fixture'
import { apiUrl, data, directRequest, get, openResourceMenu, record, text } from '../support/live-api'

const pending = (page: Page) => page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open('data-quality.offline-writes.v1')
    open.onsuccess = () => resolve(open.result); open.onerror = () => reject(new Error('queue could not open'))
  })
  try {
    return await new Promise<{ state: string; kind: string; fileBytes: number }[]>((resolve, reject) => {
      const read = db.transaction('writes').objectStore('writes').getAll()
      read.onsuccess = () => resolve((read.result as { state: string; command: { kind: string; file?: Blob } }[])
        .map(row => ({ state: row.state, kind: row.command.kind, fileBytes: row.command.file instanceof Blob ? row.command.file.size : 0 })))
      read.onerror = () => reject(new Error('queue could not read'))
    })
  } finally { db.close() }
})

test('reconciles an upload committed by the real backend when its HTTP response is lost', async ({ page, live }) => {
  test.setTimeout(180000)
  const prefix = `TaiFE-E2E-${randomUUID()}`
  const headers = { Authorization: `Bearer ${live.session.token}` }
  let workspaceId = ''; let projectId = ''; let datasetId = ''; let uploads = 0
  live.deferCleanup(async () => {
    if (projectId && !datasetId) {
      const dataset = record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset']
      if (dataset) datasetId = text(record(dataset)['id'])
    }
    for (const [resource, id] of [['datasets', datasetId], ['projects', projectId], ['workspaces', workspaceId]]) {
      if (id) expect([200, 204, 404]).toContain((await directRequest(page, `/${resource}/${id}`, { method: 'DELETE', headers })).status())
    }
  })
  workspaceId = text(record(record(await data(await directRequest(page, '/workspaces', { method: 'POST', headers,
    data: { name: prefix, description: 'Owned acknowledgement-loss QA' },
  })))['workspace'])['id'])
  projectId = text(record(record(await data(await directRequest(page, `/workspaces/${workspaceId}/projects`, { method: 'POST', headers,
    data: { name: `${prefix}-project`, description: 'Owned acknowledgement-loss QA' },
  })))['project'])['id'])
  const uploadPath = `/projects/${projectId}/datasets/upload`
  await page.route('**/*', async route => {
    if (route.request().method() !== 'POST' || route.request().url() !== apiUrl(uploadPath)) { await route.continue(); return }
    uploads++
    // Commit to the actual API, then drop only its response at the client boundary.
    let response
    try { response = await route.fetch({ timeout: 60000 }) } catch {
      // Playwright's raw transport error may include Authorization headers.
      throw new Error('Owned QA upload transport failed; credential details omitted.')
    }
    expect(response.status()).toBe(201)
    await response.dispose()
    await route.abort('connectionfailed')
  })
  await page.goto(`/processing/projects/${projectId}`)
  await page.getByRole('button', { name: 'Upload data', exact: true }).click()
  const csv = 'record_id,value\nACK001,7\nACK002,9\n'
  await page.locator('input[type=file]').setInputFiles({ name: 'lost-ack.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('dialog').getByRole('button', { name: 'Upload data', exact: true }).click()
  await expect.poll(() => pending(page)).toMatchObject([{ kind: 'upload', state: 'uncertain' }])
  datasetId = text(record(record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset'])['id'])
  await expect.poll(() => pending(page), { timeout: 60000 }).toEqual([])
  expect(uploads).toBe(1)
  expect((await (await directRequest(page, `/datasets/${datasetId}/file`, { headers })).body()).toString()).toBe(csv)
  await test.info().attach('real-upload-lost-response-reconciled', { body: Buffer.from(JSON.stringify({ backendStatus: 201, clientReceivedResponse: false,
    reconciledUsingOriginalFile: true, uploadAttempts: uploads })), contentType: 'application/json' })
})

test('synchronizes Workspace metadata then deletes its Project and Workspace in order', async ({ page, live }) => {
  test.setTimeout(180000)
  const prefix = `TaiFE-E2E-${randomUUID()}`
  const headers = { Authorization: `Bearer ${live.session.token}` }
  let workspaceId = ''; let projectId = ''; let disconnected = false
  const origin = new URL(apiUrl('/')).origin
  const writes: { method: string; path: string; status: number }[] = []
  page.on('response', response => {
    if (new URL(response.url()).origin === origin && ['PATCH', 'DELETE'].includes(response.request().method())) {
      writes.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() })
    }
  })
  await page.route('**/*', async route => {
    if (disconnected && new URL(route.request().url()).origin === origin) await route.abort('connectionfailed')
    else await route.continue()
  })
  live.deferCleanup(async () => {
    disconnected = false
    for (const [resource, id] of [['projects', projectId], ['workspaces', workspaceId]]) {
      if (!id) continue
      const current = await directRequest(page, `/${resource}/${id}`, { headers })
      if (current.status() === 404) continue
      expect(current.status()).toBe(200)
      expect([200, 204, 404]).toContain((await directRequest(page, `/${resource}/${id}`, { method: 'DELETE', headers })).status())
    }
    await test.info().attach('workspace-and-project-write-order', { body: Buffer.from(JSON.stringify(writes)), contentType: 'application/json' })
  })
  workspaceId = text(record(record(await data(await directRequest(page, '/workspaces', { method: 'POST', headers,
    data: { name: prefix, description: 'Owned ordered queue QA' },
  })))['workspace'])['id'])
  projectId = text(record(record(await data(await directRequest(page, `/workspaces/${workspaceId}/projects`, { method: 'POST', headers,
    data: { name: `${prefix}-project`, description: 'Owned ordered queue QA' },
  })))['project'])['id'])
  await page.goto('/management/projects')
  await expect(page.getByRole('heading', { name: `${prefix}-project`, exact: true })).toBeVisible()
  await page.goto('/management/workspaces')
  await expect(page.getByRole('button', { name: `Thao tác với ${prefix}`, exact: true })).toBeVisible()
  disconnected = true
  await openResourceMenu(page, prefix)
  await page.getByRole('menuitem', { name: 'Thông tin Workspace', exact: true }).click()
  await page.getByRole('textbox', { name: /Tên Workspace/ }).fill(`${prefix}-edited`)
  await page.getByRole('dialog').locator('textarea').fill('Edited while the real API was unreachable')
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect.poll(() => pending(page)).toMatchObject([{ kind: 'patch', state: 'queued' }])
  await page.goto('/management/projects')
  await openResourceMenu(page, `${prefix}-project`)
  await page.getByRole('menuitem', { name: 'Xóa Project', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Gỡ khỏi danh sách', exact: true }).click()
  await page.goto('/management/workspaces')
  await openResourceMenu(page, prefix)
  await page.getByRole('menuitem', { name: 'Xóa Workspace', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Gỡ khỏi danh sách', exact: true }).click()
  await expect.poll(() => pending(page)).toMatchObject([{ kind: 'patch' }, { kind: 'delete' }, { kind: 'delete' }])
  expect((await directRequest(page, `/projects/${projectId}`, { headers })).status()).toBe(200)
  disconnected = false
  await expect.poll(async () => (await directRequest(page, `/workspaces/${workspaceId}`, { headers })).status(), { timeout: 60000 }).toBe(404)
  expect((await directRequest(page, `/projects/${projectId}`, { headers })).status()).toBe(404)
  await expect.poll(() => pending(page)).toEqual([])
  expect(writes.map(row => [row.method, row.path.replace('/api/v1', ''), row.status])).toEqual([
    ['PATCH', `/workspaces/${workspaceId}`, 200], ['DELETE', `/projects/${projectId}`, 204], ['DELETE', `/workspaces/${workspaceId}`, 204],
  ])
})

test('persists real writes across reload and automatically uploads, edits and deletes after API connectivity returns', async ({ page, live }) => {
  test.setTimeout(240000)
  const prefix = `TaiFE-E2E-${randomUUID()}`
  const headers = { Authorization: `Bearer ${live.session.token}` }
  let workspaceId = ''; let projectId = ''; let datasetId = ''
  let disconnected = false
  const origin = new URL(apiUrl('/')).origin
  const network: { method: string; path: string; status: number }[] = []
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === origin && ['POST', 'PATCH', 'DELETE'].includes(response.request().method())) {
      network.push({ method: response.request().method(), path: url.pathname, status: response.status() })
    }
  })
  const outage = async (route: Route) => {
    if (disconnected && new URL(route.request().url()).origin === origin) await route.abort('connectionfailed')
    else await route.continue()
  }
  await page.route('**/*', outage)
  live.deferCleanup(async () => {
    disconnected = false
    if (projectId && !datasetId) {
      const response = await directRequest(page, `/projects/${projectId}/datasets`, { headers })
      if (response.ok()) {
        const dataset = record(await data(response))['dataset']
        if (dataset) datasetId = text(record(dataset)['id'])
      }
    }
    for (const [resource, id] of [['datasets', datasetId], ['projects', projectId], ['workspaces', workspaceId]]) {
      if (!id) continue
      expect([200, 204, 404]).toContain((await directRequest(page, `/${resource}/${id}`, { method: 'DELETE', headers })).status())
    }
    await test.info().attach('real-write-responses-without-credentials', { body: Buffer.from(JSON.stringify(network)), contentType: 'application/json' })
  })
  workspaceId = text(record(record(await data(await directRequest(page, '/workspaces', { method: 'POST', headers,
    data: { name: prefix, description: 'Owned offline queue QA' },
  })))['workspace'])['id'])
  projectId = text(record(record(await data(await directRequest(page, `/workspaces/${workspaceId}/projects`, { method: 'POST', headers,
    data: { name: `${prefix}-project`, description: 'Owned offline queue QA' },
  })))['project'])['id'])
  await page.goto(`/processing/projects/${projectId}`)
  await expect(page.getByRole('button', { name: 'Upload data', exact: true })).toBeVisible()
  await page.goto('/management/projects')
  await expect(page.getByRole('heading', { name: `${prefix}-project`, exact: true })).toBeVisible()
  disconnected = true
  await openResourceMenu(page, `${prefix}-project`)
  await page.getByRole('menuitem', { name: /Đổi tên/ }).click()
  await page.getByLabel('Tên mới', { exact: true }).fill(`${prefix}-renamed`)
  await page.getByRole('button', { name: 'Lưu tên', exact: true }).click()
  await expect.poll(() => pending(page)).toMatchObject([{ kind: 'patch', state: 'queued' }])
  expect(record(record(await get(page, live.session, `/projects/${projectId}`))['project'])['name']).toBe(`${prefix}-project`)
  await page.reload()
  await expect(page.getByRole('heading', { name: `${prefix}-project`, exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.onLine)).toBe(true)
  expect(await pending(page)).toMatchObject([{ kind: 'patch', state: 'queued' }])
  disconnected = false // No online event or reconnect button: the background retry must detect BE recovery.
  await expect.poll(async () => record(record(await get(page, live.session, `/projects/${projectId}`))['project'])['name'], { timeout: 45000 }).toBe(`${prefix}-renamed`)
  await expect.poll(() => pending(page)).toEqual([])
  await expect(page.getByRole('heading', { name: `${prefix}-renamed`, exact: true })).toBeVisible()

  await page.goto(`/processing/projects/${projectId}`)
  await expect(page.getByRole('button', { name: 'Upload data', exact: true })).toBeVisible()
  disconnected = true
  await page.getByRole('button', { name: 'Upload data', exact: true }).click()
  const csv = 'record_id,value\nQUEUE001,10\nQUEUE002,20\n'
  await page.locator('input[type=file]').setInputFiles({ name: 'offline-queue.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('dialog').getByRole('button', { name: /Upload data|Lưu chờ upload/ }).click()
  await expect.poll(() => pending(page)).toMatchObject([{ kind: 'upload', state: 'queued', fileBytes: Buffer.byteLength(csv) }])
  await page.reload()
  await expect(page.getByRole('button', { name: 'Upload data', exact: true })).toBeVisible()
  expect(await pending(page)).toMatchObject([{ kind: 'upload', fileBytes: Buffer.byteLength(csv) }])
  disconnected = false
  await expect.poll(async () => {
    const dataset = record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset']
    return dataset ? record(dataset)['status'] : null
  }, { timeout: 60000 }).toBe('READY')
  datasetId = text(record(record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset'])['id'])
  const original = await directRequest(page, `/datasets/${datasetId}/file`, { headers })
  expect((await original.body()).toString()).toBe(csv)
  await expect.poll(() => pending(page)).toEqual([])
  await page.getByRole('button', { name: 'Data View', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'QUEUE001', exact: true })).toBeVisible()

  // Genuine browser offline: cache remains usable and DELETE stays pending until online again.
  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Xóa dataset', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click()
  await expect.poll(() => pending(page)).toMatchObject([{ kind: 'delete', state: 'queued' }])
  expect(record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset']).not.toBeNull()
  await page.context().setOffline(false)
  await expect.poll(async () => record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset'], { timeout: 45000 }).toBeNull()
  await expect.poll(() => pending(page)).toEqual([])
  const uploads = network.filter(item => item.method === 'POST' && item.path.endsWith('/datasets/upload'))
  expect(uploads).toHaveLength(1); expect(uploads[0]?.status).toBe(201)
  expect(network.filter(item => item.method === 'PATCH' && item.path.endsWith(`/projects/${projectId}`))).toHaveLength(1)
  await test.info().attach('offline-queue-verified', { body: Buffer.from(JSON.stringify({ nativeIndexedDB: true, reloadSurvived: true,
    browserOnlineDuringBEOutage: true, automaticRecovery: true, realMultipart: true, exactUploadedContent: true, deleteWhileNetworkOffline: true })), contentType: 'application/json' })
})
