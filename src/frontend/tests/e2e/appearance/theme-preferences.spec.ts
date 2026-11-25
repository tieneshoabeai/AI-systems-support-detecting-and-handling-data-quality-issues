import { expect, test } from '@playwright/test'
import { authenticated } from '../support/live-api'

test.describe('Appearance and navigation', () => {
  test('Switch light, dark and system appearance without losing the workspace', async ({ page }) => {
    await authenticated(page, async () => {
      const heading = page.getByRole('heading', { name: 'Khám phá vũ trụ dữ liệu của bạn', exact: true })
      await expect(heading).toBeVisible()
      await page.getByRole('button', { name: 'Chế độ màu', exact: true }).click()
      const appearance = page.getByRole('dialog', { name: 'Chế độ màu', exact: true })
      const surface = page.locator('[data-preview="2d"]')
      // Every observed option updates its radio state without changing the workspace.
      for (const name of ['Sáng', 'Tối', 'Theo hệ thống']) {
        const radio = appearance.getByRole('radio', { name, exact: true })
        await radio.check()
        await expect(radio).toBeChecked()
        // PreviewSession resolves system appearance using the configured dark OS mode.
        await expect(surface).toHaveAttribute('data-theme', name === 'Sáng' ? 'light' : 'dark')
        for (const other of ['Sáng', 'Tối', 'Theo hệ thống'].filter(option => option !== name)) {
          await expect(appearance.getByRole('radio', { name: other, exact: true })).not.toBeChecked()
        }
        await expect(heading).toBeVisible()
        await expect(page).toHaveURL('/processing')
      }
      // A document reload restores both the real login and the local theme preference.
      await page.reload()
      await expect(heading).toBeVisible()
      await expect(surface).toHaveAttribute('data-theme', 'dark')
      await page.getByRole('button', { name: 'Chế độ màu', exact: true }).click()
      await expect(appearance.getByRole('radio', { name: 'Theo hệ thống', exact: true })).toBeChecked()
      await expect(appearance.getByRole('radio', { name: 'Sáng', exact: true })).not.toBeChecked()
      await expect(appearance.getByRole('radio', { name: 'Tối', exact: true })).not.toBeChecked()
      await expect(page).toHaveURL('/processing')
    })
  })
})
