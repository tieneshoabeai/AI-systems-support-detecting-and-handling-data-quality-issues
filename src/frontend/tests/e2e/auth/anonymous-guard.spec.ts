import { expect, test } from '@playwright/test'
import { matchesApi } from '../support/live-api'

test.describe('Real authentication boundaries', () => {
  test('redirects an anonymous private route and rejects empty login without a request', async ({ page }) => {
    // A fresh context must not inherit a manually captured session.
    let loginRequests = 0
    page.on('request', request => {
      if (request.method() === 'POST' && matchesApi(request.url(), '/auth/login')) loginRequests += 1
    })
    await page.goto('/management')
    await expect(page).toHaveURL('/auth/login')
    const form = page.getByRole('form', { name: 'Đăng nhập', exact: true })
    await expect(form).toBeVisible()
    await form.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(form.getByLabel('Email', { exact: true })).toHaveValue('')
    await expect(form.getByLabel('Mật khẩu', { exact: true })).toHaveValue('')
    await expect(page).toHaveURL('/auth/login')
    expect(loginRequests).toBe(0)
  })
})
