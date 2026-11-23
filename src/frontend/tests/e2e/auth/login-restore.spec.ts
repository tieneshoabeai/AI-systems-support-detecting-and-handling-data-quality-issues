import { expect, test } from '@playwright/test'
import { authenticated, data, record, responseFor } from '../support/live-api'

test.describe('Real authentication', () => {
  test('restores the same account from BE after a document reload', async ({ page }) => {
    await authenticated(page, async session => {
      const profile = responseFor(page, '/users/me', 'GET')
      await page.reload()
      const user = record(await data(await profile))
      expect(user['id']).toBe(session.accountId)
      await expect(page).toHaveURL('/processing')
      await expect(page.getByRole('heading', { name: 'Khám phá vũ trụ dữ liệu của bạn', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Tài khoản .+$/ })).toBeVisible()
    })
  })
})
