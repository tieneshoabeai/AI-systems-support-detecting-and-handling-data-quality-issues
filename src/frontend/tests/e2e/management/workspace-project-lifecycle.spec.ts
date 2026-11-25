import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import { test } from '../support/live-fixture'
import { data, directRequest, get, matchesApi, openResourceMenu, record, responseFor, text } from '../support/live-api'

test.describe('Real workspace and project API', () => {
  test('persists workspace and CSV project edits and deletes only its own test resources', async ({ page, live }) => {
    const session = live.session
    const prefix = `E2E-${randomUUID()}`
    const workspaceName = `${prefix}-workspace`
    const renamedWorkspace = `${prefix}-renamed`
    const projectName = `${prefix}-project`
    const renamedProject = `${prefix}-project-renamed`
    const witnessName = `${prefix}-witness`
    const headers = { Authorization: `Bearer ${session.token}` }
    let workspaceId = ''
    let projectId = ''
    let datasetId = ''
    let witnessId = ''

    const ownedWorkspace = (value: unknown, name: string): string => {
      const workspace = record(record(value)['workspace'])
      if (workspace['name'] !== name || workspace['ownerId'] !== session.accountId) throw new Error('Refusing to track an unexpected workspace for cleanup.')
      return text(workspace['id'])
    }
    const deleteOwned = async (kind: 'datasets' | 'projects' | 'workspaces', id: string) => {
      if (!id) return
      const response = await directRequest(page, `/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
      const status = response.status()
      if (![204, 404].includes(status)) {
        throw new Error(`Cleanup failed for owned ${kind} ID ${id} (HTTP ${status}); parent resources are retained.`)
      }
    }
    const cleanup = async () => {
      // Recover metadata if the UI failed after a successful upload.
      if (projectId && !datasetId) {
        const current = record(await get(page, session, `/projects/${projectId}/datasets`))['dataset']
        if (current !== null) {
          const remaining = record(current)
          if (remaining['projectId'] !== projectId) throw new Error('Refusing to clean up an unrelated dataset.')
          datasetId = text(remaining['id'])
        }
      }
      await deleteOwned('datasets', datasetId)
      await deleteOwned('projects', projectId)
      await deleteOwned('workspaces', workspaceId)
      await deleteOwned('workspaces', witnessId)
    }

    live.deferCleanup(cleanup)
    // A separate owned witness proves that scoped deletion leaves another workspace intact.
    const witnessResponse = await directRequest(page, '/workspaces', { method: 'POST',
      headers, data: { name: witnessName, description: 'Isolated E2E deletion witness.' },
    })
    witnessId = ownedWorkspace(await data(witnessResponse), witnessName)

    // Empty input must be rejected by the real form without creating a record.
    await page.goto('/management/workspaces')
    await page.getByRole('button', { name: 'Tạo Workspace', exact: true }).click()
    const createWorkspace = page.getByRole('dialog', { name: 'Tạo Workspace', exact: true })
    let createRequests = 0
    const countCreates = (request: import('@playwright/test').Request) => {
      if (request.method() === 'POST' && matchesApi(request.url(), '/workspaces')) createRequests += 1
    }
    page.on('request', countCreates)
    await createWorkspace.getByRole('button', { name: 'Tạo Workspace', exact: true }).click()
    await expect(createWorkspace.getByRole('alert')).toHaveText('Tên Workspace không được để trống.')
    expect(createRequests).toBe(0)
    await createWorkspace.getByRole('textbox', { name: 'Tên Workspace', exact: true }).fill(workspaceName)
    await createWorkspace.getByRole('textbox', { name: 'Mô tả', exact: true }).fill('Isolated E2E data, safe to clean up by captured IDs.')
    const createdPending = responseFor(page, '/workspaces', 'POST')
    await createWorkspace.getByRole('button', { name: 'Tạo Workspace', exact: true }).click()
    workspaceId = ownedWorkspace(await data(await createdPending), workspaceName)
    await expect(createWorkspace.getByRole('heading', { name: 'Tạo Workspace thành công!', exact: true })).toBeVisible()
    expect(createRequests).toBe(1)
    page.off('request', countCreates)
    await createWorkspace.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click()

    // Rename, independently read from BE, then reload the actual document.
    await openResourceMenu(page, workspaceName)
    await page.getByRole('menuitem', { name: 'Thông tin Workspace', exact: true }).click()
    const editWorkspace = page.getByRole('dialog', { name: 'Thông tin Workspace', exact: true })
    await editWorkspace.getByRole('textbox', { name: 'Tên Workspace', exact: true }).fill(renamedWorkspace)
    const renamedPending = responseFor(page, `/workspaces/${workspaceId}`, 'PATCH')
    await editWorkspace.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
    expect((await renamedPending).ok()).toBe(true)
    const savedWorkspace = record(record(await get(page, session, `/workspaces/${workspaceId}`))['workspace'])
    expect(savedWorkspace['name']).toBe(renamedWorkspace)
    await page.reload()
    await page.getByRole('heading', { name: renamedWorkspace, exact: true }).dblclick()
    await expect(page).toHaveURL(`/management/workspaces/${workspaceId}`)
    await expect(page.getByRole('heading', { name: renamedWorkspace, exact: true })).toBeVisible()

    // Upload synthetic data through the existing project wizard, never a personal file.
    await page.getByRole('button', { name: 'Tạo Project', exact: true }).click()
    const wizard = page.getByRole('dialog', { name: 'Tạo Project', exact: true })
    await wizard.getByRole('textbox', { name: 'Tên Project', exact: true }).fill(projectName)
    await wizard.getByRole('textbox', { name: 'Mô tả', exact: true }).fill('Three synthetic CSV rows for real API integration.')
    await wizard.getByRole('button', { name: 'Tiếp theo', exact: true }).click()
    await wizard.getByLabel('Chọn tập dữ liệu CSV', { exact: true }).setInputFiles({ name: 'e2e-records.csv', mimeType: 'text/csv',
      buffer: Buffer.from('record_id,label,score\nQA001,Sample Alpha,10\nQA002,Sample Beta,20\nQA003,Sample Gamma,30\n') })
    await expect(wizard.getByText('3 dòng', { exact: true })).toBeVisible()
    await wizard.getByRole('button', { name: 'Tiếp theo', exact: true }).click()
    await wizard.getByRole('button', { name: 'Tiếp theo', exact: true }).click()
    const projectPending = responseFor(page, `/workspaces/${workspaceId}/projects`, 'POST')
    await wizard.getByRole('button', { name: 'Tạo Project', exact: true }).click()
    const createdProject = record(record(await data(await projectPending))['project'])
    if (createdProject['name'] !== projectName || createdProject['workspaceId'] !== workspaceId || createdProject['createdBy'] !== session.accountId) {
      throw new Error('Refusing to track an unexpected project for cleanup.')
    }
    projectId = text(createdProject['id'])
    await expect(wizard.getByRole('heading', { name: 'Tạo Project thành công!', exact: true })).toBeVisible()
    const dataset = record(record(await get(page, session, `/projects/${projectId}/datasets`))['dataset'])
    if (dataset['projectId'] !== projectId) throw new Error('BE returned a dataset for a different project.')
    datasetId = text(dataset['id'])
    expect(dataset['rowCount']).toBe(3)
    expect(dataset['columnCount']).toBe(3)
    await wizard.getByRole('button', { name: 'Xem Project', exact: true }).click()
    await page.getByRole('button', { name: 'Data View', exact: true }).click()
    const table = page.getByRole('table')
    await expect(table.getByRole('row')).toHaveCount(4)
    await expect(table.getByRole('columnheader')).toHaveText(['Dòng', 'record_id', 'label', 'score'])
    await expect(table.getByRole('row').filter({ hasText: 'QA001' })).toContainText('Sample Alpha')
    await expect(table.getByRole('row').filter({ hasText: 'QA002' })).toContainText('Sample Beta')
    await expect(table.getByRole('row').filter({ hasText: 'QA003' })).toContainText('Sample Gamma')
    const queryResponse = await directRequest(page, `/datasets/${datasetId}/records/query`, { method: 'POST', headers, data: { limit: 50 } })
    const records = record(await data(queryResponse))['items']
    if (!Array.isArray(records)) throw new Error('BE omitted dataset records.')
    expect((records as unknown[]).map(row => record(record(row)['props'])['c0'])).toEqual(['QA001', 'QA002', 'QA003'])

    // Rename the exact owned project and prove persistence independently of UI state.
    await page.goto(`/management/workspaces/${workspaceId}`)
    await openResourceMenu(page, projectName)
    await page.getByRole('menuitem', { name: 'Đổi tên', exact: true }).click()
    const rename = page.getByRole('dialog', { name: `Đổi tên “${projectName}”`, exact: true })
    await rename.getByRole('textbox', { name: 'Tên mới', exact: true }).fill(renamedProject)
    const projectRenamed = responseFor(page, `/projects/${projectId}`, 'PATCH')
    await rename.getByRole('button', { name: 'Lưu tên', exact: true }).click()
    expect((await projectRenamed).ok()).toBe(true)
    expect(record(record(await get(page, session, `/projects/${projectId}`))['project'])['name']).toBe(renamedProject)
    await page.reload()
    await expect(page.getByRole('button', { name: `Thao tác với ${renamedProject}`, exact: true })).toBeVisible()

    // Soft-delete the dataset first so record/quota cleanup is not blocked by a deleted parent.
    await deleteOwned('datasets', datasetId)
    datasetId = ''
    await openResourceMenu(page, renamedProject)
    await page.getByRole('menuitem', { name: 'Xóa Project', exact: true }).click()
    const deleteProject = responseFor(page, `/projects/${projectId}`, 'DELETE')
    await page.getByRole('button', { name: 'Gỡ khỏi danh sách', exact: true }).click()
    expect((await deleteProject).status()).toBe(204)
    expect((await directRequest(page, `/projects/${projectId}`, { method: 'GET', headers })).status()).toBe(404)
    projectId = ''
    await expect(page.getByRole('heading', { name: 'Project (0)', exact: true })).toBeVisible()
    await openResourceMenu(page, renamedWorkspace)
    await page.getByRole('menuitem', { name: 'Xóa Workspace', exact: true }).click()
    const deleteWorkspace = responseFor(page, `/workspaces/${workspaceId}`, 'DELETE')
    await page.getByRole('button', { name: 'Gỡ khỏi danh sách', exact: true }).click()
    expect((await deleteWorkspace).status()).toBe(204)
    expect((await directRequest(page, `/workspaces/${workspaceId}`, { method: 'GET', headers })).status()).toBe(404)
    workspaceId = ''
    const witness = record(record(await get(page, session, `/workspaces/${witnessId}`))['workspace'])
    expect(witness['name']).toBe(witnessName)
    expect(witness['ownerId']).toBe(session.accountId)
    await page.goto('/management/workspaces')
    await expect(page.getByRole('heading', { name: witnessName, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: renamedWorkspace, exact: true })).toHaveCount(0)
  })
})
