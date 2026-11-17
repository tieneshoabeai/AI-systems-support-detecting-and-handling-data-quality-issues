import { expect, test } from '@playwright/test'
import { displayedDemoCredentials, openDemoLogin } from '../support/demo'

test.describe('Demo authentication and routing', () => {
  test('Reject an incorrect demo password and retain a usable login form', async ({ page }) => {
    // Open a fresh demo login and use only the fixture displayed by the app.
    await openDemoLogin(page)
    const { email, password } = await displayedDemoCredentials(page)
    const form = page.getByRole('form', { name: 'Đăng nhập', exact: true })
    await form.getByLabel('Email', { exact: true }).fill(email)
    await form.getByLabel('Mật khẩu', { exact: true }).fill('incorrect-demo-password')
    // A rejected login must remain on the login page with an actionable error.
    await form.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Email hoặc mật khẩu không chính xác' })).toBeVisible()
    await expect(page).toHaveURL('/auth/login?demo=shopping')
    await expect(page.getByRole('button', { name: 'Đăng xuất demo', exact: true })).toHaveCount(0)
    // Correcting the password must recover without recreating the form.
    await form.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await form.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(page).toHaveURL('/processing')
    await expect(page.getByRole('heading', { name: 'Khám phá vũ trụ dữ liệu của bạn', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Đăng xuất demo', exact: true })).toBeVisible()
  })
})
