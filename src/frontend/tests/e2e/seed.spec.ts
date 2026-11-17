import { expect, test } from '@playwright/test'
import { loginDemo } from './support/demo'

test.describe('Shopping Demo readiness', () => {
  test('opens the authenticated Processing workspace', async ({ page }) => {
    // Each test owns a fresh context; demo state disappears when that context closes.
    await loginDemo(page)
    await expect(page.getByRole('heading', { name: 'Khám phá vũ trụ dữ liệu của bạn', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Mở Shopping Trends', exact: true })).toBeVisible()
  })
})
