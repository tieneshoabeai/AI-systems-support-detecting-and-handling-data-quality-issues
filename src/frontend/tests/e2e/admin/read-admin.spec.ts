import { expect, test } from '@playwright/test'
import { authenticated, data, record, responseFor, text } from '../support/live-api'

test.describe('Real admin API', () => {
  test('reads account details and renders the actual issue page without writing', async ({ page }) => {
    await authenticated(page, async session => {
      expect(session.role, 'The configured test account must have the admin role.').toBe('admin')
      const usersPending = responseFor(page, '/admin/users', 'GET')
      const issuesPending = responseFor(page, '/admin/issues', 'GET')
      await page.goto('/management/members')
      const users = record(await data(await usersPending))
      const issues = record(await data(await issuesPending))
      if (!Array.isArray(users['items']) || !Array.isArray(issues['items'])) throw new Error('BE omitted admin page items.')
      const accounts: unknown[] = users['items']
      const reports: unknown[] = issues['items']
      expect(accounts.length, 'An admin system contains at least its authenticated account.').toBeGreaterThan(0)
      await expect(page.getByRole('tab', { name: 'Tài khoản', exact: true })).toBeVisible()
      await expect(page.getByRole('table').getByRole('row')).toHaveCount(accounts.length + 1)
      const user = record(accounts[0])
      const id = text(user['id'])
      const email = text(user['email'])
      const detailPending = responseFor(page, `/admin/users/${encodeURIComponent(id)}`, 'GET')
      await page.getByRole('row').filter({ hasText: email }).getByRole('button').click()
      const detail = record(await data(await detailPending))
      expect(detail['id']).toBe(id)
      expect(detail['email']).toBe(email)
      await expect(page.getByRole('definition').filter({ hasText: email })).toHaveText(email)
      await page.getByRole('tab', { name: 'Báo cáo vấn đề', exact: true }).click()
      await expect(page.getByRole('table').getByRole('row')).toHaveCount(reports.length + 1)
      // This supplements the unconditional exact row count with the empty-state contract.
      if (reports.length === 0) {
        await expect(page.getByText('Chưa có báo cáo vấn đề để hiển thị.', { exact: true })).toBeVisible()
      }
    })
  })
})
