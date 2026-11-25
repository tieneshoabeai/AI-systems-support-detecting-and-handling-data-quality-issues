import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'
import { test } from '../support/live-fixture'
import { apiUrl, data, directRequest, get, matchesApi, record, responseFor, text } from '../support/live-api'
import { installOfflineRuntimeProbe, markOwnedIndexedDbRecord, readOfflineRuntimeProbe } from '../support/offline-runtime-probe'

test('runs analysis, feedback and offline reads using only its own synthetic CSV', async ({ page, live }) => {
  test.setTimeout(180_000)
  const prefix = `TaiFE-E2E-${randomUUID()}`
  await installOfflineRuntimeProbe(page)
  const headers = { Authorization: `Bearer ${live.session.token}` }
  const network: { method: string; path: string; status: number }[] = []
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === new URL(apiUrl('/')).origin) network.push({ method: response.request().method(), path: url.pathname, status: response.status() })
  })
  let workspaceId = ''; let projectId = ''; let datasetId = ''; let feedbackId = ''
  live.deferCleanup(async () => {
    if (feedbackId) {
      const response = await directRequest(page, `/feedback/${feedbackId}`, { method: 'DELETE', headers })
      expect([200, 204, 404]).toContain(response.status())
    }
    if (projectId && !datasetId) {
      const current = record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset']
      if (current) datasetId = text(record(current)['id'])
    }
    for (const [kind, id] of [['datasets', datasetId], ['projects', projectId], ['workspaces', workspaceId]]) {
      if (!id) continue
      const response = await directRequest(page, `/${kind}/${id}`, { method: 'DELETE', headers })
      expect([204, 404]).toContain(response.status())
    }
    await test.info().attach('sanitized-api-network', { body: Buffer.from(JSON.stringify(network, null, 2)), contentType: 'application/json' })
  })
  const workspace = record(record(await data(await directRequest(page, '/workspaces', { method: 'POST',
    headers, data: { name: prefix, description: 'Synthetic live integration fixture, owned by this test.' },
  })))['workspace'])
  expect(workspace['ownerId']).toBe(live.session.accountId)
  workspaceId = text(workspace['id'])
  const project = record(record(await data(await directRequest(page, `/workspaces/${workspaceId}/projects`, { method: 'POST',
    headers, data: { name: `${prefix}-project`, description: 'Synthetic analysis and offline fixture.' },
  })))['project'])
  expect(project['workspaceId']).toBe(workspaceId)
  expect(project['createdBy']).toBe(live.session.accountId)
  projectId = text(project['id'])
  const csv = 'record_id,segment,score,amount\nQA001,A,10,100\nQA002,A,20,200\nQA003,B,30,300\nQA003,B,30,300\nQA005,B,,400\nQA006,C,1000,500\n'
  const uploaded = record(await data(await directRequest(page, `/projects/${projectId}/datasets/upload`, { method: 'POST',
    headers, timeoutMs: 60_000, multipart: { file: { name: 'taife-synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) } },
  })))
  datasetId = text(record(uploaded['dataset'])['id'])
  await expect.poll(async () => record(record(await get(page, live.session, `/projects/${projectId}/datasets`))['dataset'])['status'], {
    timeout: 30_000, intervals: [1000, 2000, 3000],
  }).toBe('READY')
  await page.goto('/management/projects')
  await expect(page.getByRole('heading', { name: `${prefix}-project`, exact: true })).toBeVisible()
  await page.goto(`/processing/projects/${projectId}`)
  await page.getByRole('button', { name: 'Data View', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'QA001', exact: true })).toBeVisible()
  await page.getByLabel(/^Cột/).first().selectOption('c2')
  const statistics = responseFor(page, `/datasets/${datasetId}/columns/c2/stats`, 'GET')
  const charts = responseFor(page, `/datasets/${datasetId}/charts`, 'GET')
  await page.getByRole('button', { name: 'Tải thống kê cột', exact: true }).click()
  expect((await statistics).status()).toBe(200)
  expect((await charts).status()).toBe(200)
  await expect(page.getByText('Trung vị', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đánh dấu là PII', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kính', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Nền trắng', exact: true }).click()
  await expect(page.locator('.project-module-panel')).toHaveAttribute('data-surface', 'solid')
  await page.getByRole('button', { name: 'Kính', exact: true }).click()
  await page.getByRole('button', { name: 'Data Analysis', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Lưu cấu hình', exact: true })).toHaveCount(0)
  const running = responseFor(page, `/projects/${projectId}/analysis`, 'POST')
  await page.getByRole('button', { name: 'Chạy phân tích', exact: true }).click()
  const analysisResponse = await running
  const result = record(await data(analysisResponse))
  const runId = text(result['analysisRunId'])
  expect(Object.keys(record(analysisResponse.request().postDataJSON() as unknown)).sort()).toEqual([
    'chart_top_n', 'correlation_method', 'outlier_method', 'top_n',
  ])
  const quality = page.getByRole('region', { name: 'Chất lượng dữ liệu', exact: true })
  await expect(quality.getByText('Dòng đã quét', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Detection', exact: true })).toHaveCount(0)

  await page.getByText('Phản hồi', { exact: true }).click()
  await page.getByRole('button', { name: 'Viết phản hồi', exact: true }).click()
  const reason = `${prefix} feedback verified against its synthetic records`
  await page.getByLabel('Lý do', { exact: true }).fill(reason)
  const feedbackPending = responseFor(page, `/analyses/${runId}/feedback`, 'POST')
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  expect((await feedbackPending).ok()).toBe(true)
  await expect(page.getByRole('button', { name: 'Gửi phản hồi thành công', exact: true })).toBeVisible()
  const savedFeedback = record(await get(page, live.session, `/analyses/${runId}/feedback`))['items']
  if (!Array.isArray(savedFeedback)) throw new Error('BE omitted feedback items.')
  const ownedFeedback = savedFeedback.find(item => record(item)['reason'] === reason) as unknown
  feedbackId = text(record(ownedFeedback)['id'])
  await expect(page.getByText(reason, { exact: true })).toBeVisible()

  await page.getByText('Tổng kết và PDF', { exact: true }).click()
  const summarized = responseFor(page, `/projects/${projectId}/summary`, 'POST')
  await page.getByRole('button', { name: 'Tạo tổng kết', exact: true }).click()
  expect((await summarized).ok()).toBe(true)
  const requested = responseFor(page, `/projects/${projectId}/report`, 'POST')
  await page.getByRole('button', { name: 'Yêu cầu PDF', exact: true }).click()
  const reportId = text(record(await data(await requested))['reportId'])
  const filePath = `/projects/${projectId}/report/${reportId}/file`
  let reportStatus: unknown = 'pending'
  let pdfReady = false
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await directRequest(page, filePath, { method: 'GET', headers })
    if (response.status() === 200) {
      expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-')
      pdfReady = true; break
    }
    expect(response.status()).toBe(202)
    const body = record(await response.json() as unknown)
    const metadata = body['success'] === true ? record(body['data']) : body
    reportStatus = metadata['status']
    expect(['pending', 'running', 'failed']).toContain(reportStatus)
    if (reportStatus === 'failed') break
    await page.waitForTimeout(3000)
  }
  if (pdfReady) {
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Tải PDF', exact: true }).click()
    expect((await download).suggestedFilename()).toContain('.pdf')
  } else {
    test.info().annotations.push({ type: 'backend PDF state', description: `HTTP 202 / ${String(reportStatus)}; no completed PDF was asserted.` })
    const pendingFile = page.waitForResponse(response => matchesApi(response.url(), filePath))
    await page.getByRole('button', { name: 'Tải PDF', exact: true }).click()
    expect((await pendingFile).status()).toBe(202)
    if (reportStatus === 'failed') await expect(page.getByRole('alert').filter({ hasText: 'Không tạo được PDF' })).toBeVisible()
    else await expect(page.getByText('PDF đang được tạo. Kiểm tra lại sau.', { exact: true })).toBeVisible()
  }

  const productionShell = test.info().project.use.serviceWorkers === 'allow'
  if (productionShell) await page.evaluate(async () => { await navigator.serviceWorker.ready })
  const marker = `IDB-ONLY-${prefix}`
  const persisted = await markOwnedIndexedDbRecord(page, {
    accountId: live.session.accountId, namespace: apiUrl('/').replace(/\/$/, ''), datasetId, marker,
  })
  expect(persisted.patched).toBeGreaterThan(0)
  expect(persisted.paths).toContain(`/projects/${projectId}/analysis/result`)
  const onlineRuntime = await readOfflineRuntimeProbe(page)
  await page.waitForLoadState('networkidle')
  const receivedBeforeOffline = network.length
  const backendPattern = `${new URL(apiUrl('/')).origin}/**`
  const disconnectBackend = (route: Route) => route.abort('connectionfailed')
  await page.route(backendPattern, disconnectBackend)
  // A disconnected backend does not always change navigator.onLine. Reload with
  // only API traffic blocked to exercise the runtime's network-error fallback too.
  try {
    await page.reload()
    await expect(page.getByText('Chưa kết nối được backend · Đang dùng dữ liệu đã lưu', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Data View', exact: true }).click()
    await expect(page.getByRole('cell', { name: marker, exact: true })).toBeVisible()
    const disconnectedRuntime = await readOfflineRuntimeProbe(page)
    expect(disconnectedRuntime.online).toBe(true)
    expect(disconnectedRuntime.boot).not.toBe(onlineRuntime.boot)
    expect(disconnectedRuntime.reads).toBeGreaterThan(0)
    expect(network.length).toBe(receivedBeforeOffline)
    await test.info().attach('indexeddb-network-error-fallback', { body: Buffer.from(JSON.stringify(disconnectedRuntime)), contentType: 'application/json' })
  } finally { await page.unroute(backendPattern, disconnectBackend) }
  await page.context().setOffline(true)
  try {
    if (productionShell) await page.reload()
    await expect(page.getByText('Đang ngoại tuyến · Thay đổi hỗ trợ sẽ lưu chờ đồng bộ', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Data View', exact: true }).click()
    await expect(page.getByRole('cell', { name: marker, exact: true })).toBeVisible()
    const offlineRuntime = await readOfflineRuntimeProbe(page)
    expect(offlineRuntime.online).toBe(false)
    expect(offlineRuntime.reads).toBeGreaterThan(0)
    if (productionShell) expect(offlineRuntime.boot).not.toBe(onlineRuntime.boot)
    await page.getByRole('button', { name: 'Data Analysis', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Chạy phân tích', exact: true })).toBeDisabled()
    await expect(page.getByText('Dòng đã quét', { exact: true })).toBeVisible()
    if (pdfReady) {
      await page.getByText('Tổng kết và PDF', { exact: true }).click()
      await page.getByLabel('PDF đã lưu trên thiết bị', { exact: true }).selectOption(reportId)
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Tải PDF', exact: true }).click()
      expect((await download).suggestedFilename()).toContain('.pdf')
    }
    if (productionShell) {
      await page.goto('/management/projects')
      await expect(page.getByRole('heading', { name: `${prefix}-project`, exact: true })).toBeVisible()
    }
    expect(network.length).toBe(receivedBeforeOffline)
    await test.info().attach('indexeddb-runtime-proof', {
      body: Buffer.from(JSON.stringify({ freshRuntime: productionShell, onlineRuntime, offlineRuntime, persisted, serverResponsesWhileOffline: network.length - receivedBeforeOffline })),
      contentType: 'application/json',
    })
  } finally { await page.context().setOffline(false) }
  await expect(page.getByText('Đang ngoại tuyến · Thay đổi hỗ trợ sẽ lưu chờ đồng bộ', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Chưa kết nối được backend · Đang dùng dữ liệu đã lưu', { exact: true })).toHaveCount(0)
  await page.goto(`/processing/projects/${projectId}`)
  await page.getByRole('button', { name: 'Data View', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'QA001', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: marker, exact: true })).toHaveCount(0)
})
