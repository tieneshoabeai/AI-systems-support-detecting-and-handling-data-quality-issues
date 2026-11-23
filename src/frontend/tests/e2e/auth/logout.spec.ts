import { expect, test } from '@playwright/test'
import { closeSession, get, login, record, responseFor, text } from '../support/live-api'

test.describe('Real authentication', () => {
  test('logs out through BE, revokes its session and blocks the private route', async ({ page }) => {
    const session = await login(page)
    let loggedOut = false
    try {
      const current = record(await get(page, session, '/auth/sessions/me'))
      const id = text(current['id'])
      expect(current['is_revoked']).toBe(false)
      await page.getByRole('button', { name: /^Tài khoản .+$/ }).click()
      const pending = responseFor(page, '/auth/logout', 'POST')
      await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
      expect((await pending).status()).toBe(200)
      loggedOut = true
      await expect(page).toHaveURL('/auth/login')
      // BE exposes revoked session details to its owner; no refresh-token replay is used.
      const revoked = record(await get(page, session, `/auth/sessions/${encodeURIComponent(id)}`))
      expect(revoked['id']).toBe(id)
      expect(revoked['is_revoked']).toBe(true)
      await page.goto('/management')
      await expect(page).toHaveURL('/auth/login')
      await expect(page.getByRole('form', { name: 'Đăng nhập', exact: true })).toBeVisible()
    } finally {
      if (!loggedOut) await closeSession(page, session)
    }
  })
})
