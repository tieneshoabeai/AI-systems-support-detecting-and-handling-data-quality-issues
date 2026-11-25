import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { test } from '../support/live-fixture'
import type { LiveSession } from '../support/live-api'
import { apiUrl, data, directRequest, get, record, responseFor, text } from '../support/live-api'

const backendNotice = 'Chưa kết nối được backend · Đang dùng dữ liệu đã lưu'
const networkNotice = 'Đang ngoại tuyến · Thay đổi hỗ trợ sẽ lưu chờ đồng bộ'
type OwnedLive = { session: LiveSession; deferCleanup(operation: () => Promise<void>): void }
async function seed(page: Page, live: OwnedLive) {
  const name = `TaiFE-E2E-${randomUUID()}`
  const headers = { Authorization: `Bearer ${live.session.token}` }
  let workspaceId = ''; let projectId = ''; let datasetId = ''
  live.deferCleanup(async () => {
    for (const [resource, id] of [['datasets', datasetId], ['projects', projectId], ['workspaces', workspaceId]]) {
      if (id) expect([200, 204, 404]).toContain((await directRequest(page, `/${resource}/${id}`, { method: 'DELETE', headers })).status())
    }
  })
  workspaceId = text(record(record(await data(await directRequest(page, '/workspaces', { method: 'POST', headers,
    data: { name, description: 'Owned offline connectivity regression fixture' },
  })))['workspace'])['id'])
  projectId = text(record(record(await data(await directRequest(page, `/workspaces/${workspaceId}/projects`, { method: 'POST', headers,
    data: { name: `${name}-project`, description: 'Owned offline connectivity regression fixture' },
  })))['project'])['id'])
  const uploaded = record(await data(await directRequest(page, `/projects/${projectId}/datasets/upload`, { method: 'POST', headers,
    multipart: { file: { name: 'connectivity.csv', mimeType: 'text/csv', buffer: Buffer.from('record_id,value\nONLINE001,10\nONLINE002,20\nONLINE003,30\n') } },
  })))
  datasetId = text(record(uploaded['dataset'])['id'])
  await expect.poll(async () => record(record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset'])['status'], { timeout: 45000 }).toBe('READY')
  return { projectId, datasetId }
}
async function run(page: Page, projectId: string) {
  const response = responseFor(page, `/projects/${projectId}/analysis`, 'POST')
  await page.getByRole('button', { name: 'Chạy phân tích', exact: true }).click()
  expect((await response).status()).toBe(201)
  await expect(page.getByText('Dòng đã quét', { exact: true })).toBeVisible()
}
const noGlobalOffline = async (page: Page) => {
  await expect(page.getByText(backendNotice, { exact: true })).toHaveCount(0)
  await expect(page.getByText(networkNotice, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chạy phân tích', exact: true })).toBeEnabled()
}
async function queueSize(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('data-quality.offline-writes.v1')
    open.onerror = () => reject(new Error('queue unavailable'))
    open.onsuccess = () => {
      const db = open.result
      const count = db.transaction('writes').objectStore('writes').count()
      count.onsuccess = () => { resolve(count.result); db.close() }
      count.onerror = () => { reject(new Error('queue unavailable')); db.close() }
    }
  }))
}

test('an individual 500, 503, network error or real timeout never locks analysis while other APIs return 200', async ({ page, live }) => {
  test.setTimeout(240000)
  const { projectId, datasetId } = await seed(page, live)
  const path = `/projects/${projectId}/analysis/result`
  let fault: 'none' | '500' | '503' | 'network' | 'timeout' = '500'
  let healthUnavailable = false
  let healthFailures = 0; let profileSuccessesDuringHealthFailure = 0
  page.on('response', response => {
    const path = new URL(response.url()).pathname
    if (healthUnavailable && path === '/health' && response.status() === 503) healthFailures++
    if (healthUnavailable && path === '/api/v1/users/me' && response.status() === 200) profileSuccessesDuringHealthFailure++
  })
  await page.route(new URL('/health', apiUrl('/')).href, async route => {
    if (healthUnavailable) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Controlled health fault' } }) })
    else await route.continue()
  })
  await page.route(apiUrl(path), async route => {
    const mode = fault; fault = 'none'
    if (mode === 'none') { await route.continue(); return }
    if (mode === '500' || mode === '503') {
      await route.fulfill({ status: Number(mode), contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Controlled endpoint fault' } }) }); return
    }
    if (mode === 'timeout') await new Promise(resolve => setTimeout(resolve, 31000))
    await route.abort('connectionfailed').catch(() => {})
  })
  await page.goto(`/processing/projects/${projectId}`)
  const firstFailure = responseFor(page, path, 'GET')
  await page.getByRole('button', { name: 'Data Analysis', exact: true }).click()
  expect((await firstFailure).status()).toBe(500)
  await noGlobalOffline(page)
  await run(page, projectId)
  for (const mode of ['503', 'network', 'timeout'] as const) {
    healthUnavailable = mode === 'network' || mode === 'timeout'
    fault = mode
    await page.getByRole('button', { name: 'Tải lại kết quả', exact: true }).click()
    await expect(page.getByText(/Một phần dữ liệu đang dùng bản lưu/)).toBeVisible({ timeout: 45000 })
    await noGlobalOffline(page)
    // Clear the partial warning with a fresh response from that same endpoint.
    await page.getByRole('button', { name: 'Tải lại kết quả', exact: true }).click()
    await expect(page.getByText(/Một phần dữ liệu đang dùng bản lưu/)).toHaveCount(0)
  }
  healthUnavailable = false
  await page.getByRole('button', { name: 'Data View', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'ONLINE001', exact: true })).toBeVisible()
  const records = responseFor(page, `/datasets/${datasetId}/records`, 'GET')
  await page.getByRole('region', { name: 'Bản ghi dữ liệu', exact: true }).getByRole('button', { name: 'Tải lại', exact: true }).click()
  expect((await records).status()).toBe(200)
  await expect(page.getByRole('cell', { name: 'ONLINE001', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Data Analysis', exact: true }).click()
  await noGlobalOffline(page); await run(page, projectId)
  expect(await queueSize(page)).toBe(0)
  expect(healthFailures).toBeGreaterThan(0)
  expect(profileSuccessesDuringHealthFailure).toBeGreaterThan(0)
  await test.info().attach('partial-failures-do-not-lock-analysis', { body: Buffer.from(JSON.stringify({ faults: [500, 503, 'network', 'timeout after 30 seconds'],
    otherApiStatus: 200, healthFailures, profileSuccessesDuringHealthFailure, actualAnalysisStatus: 201, pendingWrites: 0 })), contentType: 'application/json' })
})

test('automatically recovers a fresh offline runtime without any queued writes and enables real analysis again', async ({ page, live }) => {
  test.setTimeout(180000)
  const { projectId } = await seed(page, live)
  let disconnected = false
  let offlineProfileProbes = 0
  page.on('request', request => {
    if (disconnected && new URL(request.url()).pathname === '/api/v1/users/me') offlineProfileProbes++
  })
  const origin = new URL(apiUrl('/')).origin
  await page.route('**/*', async route => {
    if (disconnected && new URL(route.request().url()).origin === origin) await route.abort('connectionfailed')
    else await route.continue()
  })
  await page.goto(`/processing/projects/${projectId}`)
  await page.getByRole('button', { name: 'Data View', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'ONLINE001', exact: true })).toBeVisible()
  disconnected = true
  await page.reload()
  await expect(page.getByText(backendNotice, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Data View', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'ONLINE001', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Data Analysis', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Chạy phân tích', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => navigator.onLine)).toBe(true)
  expect(await queueSize(page)).toBe(0)
  await page.waitForTimeout(100)
  expect(offlineProfileProbes).toBeLessThanOrEqual(3)
  disconnected = false // No online event, no reconnect button, and no queued mutation.
  await expect(page.getByText(backendNotice, { exact: true })).toHaveCount(0, { timeout: 45000 })
  await noGlobalOffline(page); await run(page, projectId)
  await test.info().attach('recovery-without-request-storm', { body: Buffer.from(JSON.stringify({ offlineProfileProbes, pendingWrites: 0,
    automaticallyRecovered: true, actualAnalysisStatus: 201 })), contentType: 'application/json' })
})

test('survives physical offline reload and does not trust an online event while BE is still unavailable', async ({ page, live }) => {
  test.setTimeout(180000)
  const { projectId } = await seed(page, live)
  let disconnected = false
  const origin = new URL(apiUrl('/')).origin
  await page.route('**/*', async route => {
    if (disconnected && new URL(route.request().url()).origin === origin) await route.abort('connectionfailed')
    else await route.continue()
  })
  await page.goto(`/processing/projects/${projectId}`)
  await page.getByRole('button', { name: 'Data View', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'ONLINE001', exact: true })).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  disconnected = true
  await page.context().setOffline(true)
  await page.reload()
  await expect(page.getByText(networkNotice, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Data View', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'ONLINE001', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Data Analysis', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Chạy phân tích', exact: true })).toBeDisabled()
  await page.context().setOffline(false)
  await expect(page.getByText(backendNotice, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chạy phân tích', exact: true })).toBeDisabled()
  disconnected = false
  await expect(page.getByText(backendNotice, { exact: true })).toHaveCount(0, { timeout: 45000 })
  await noGlobalOffline(page); await run(page, projectId)
})
