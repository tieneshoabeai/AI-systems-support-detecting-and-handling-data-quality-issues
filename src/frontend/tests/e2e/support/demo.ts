import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export const shoppingProjectPath = '/processing/projects/shopping-trends'

export async function openDemoLogin(page: Page) {
  await page.goto('/auth/login?demo=shopping')
  // LoginView gives WebGL 10 seconds before revealing the fallback form.
  // Allow that real deadline plus 5 seconds for browser scheduling, without sleeping.
  await expect(page.getByRole('form', { name: 'Đăng nhập', exact: true })).toBeVisible({ timeout: 15_000 })
}

export async function displayedDemoCredentials(page: Page) {
  const note = page.getByRole('note').filter({ hasText: 'Demo — không kết nối backend' })
  await expect(note).toBeVisible()
  const text = await note.innerText()
  const email = /Email:\s*(\S+)/u.exec(text)?.[1]
  const password = /Mật khẩu demo:\s*(\S+)/u.exec(text)?.[1]
  if (!email || !password) throw new Error('The demo login instructions are missing.')
  return { email, password }
}

export async function loginDemo(page: Page) {
  await openDemoLogin(page)
  const credentials = await displayedDemoCredentials(page)
  const form = page.getByRole('form', { name: 'Đăng nhập', exact: true })
  await form.getByLabel('Email', { exact: true }).fill(credentials.email)
  await form.getByLabel('Mật khẩu', { exact: true }).fill(credentials.password)
  await form.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/processing')
  await expect(page.getByRole('button', { name: 'Đăng xuất demo', exact: true })).toBeVisible()
}

export async function openShoppingProject(page: Page) {
  await loginDemo(page)
  await page.getByRole('link', { name: 'Mở Shopping Trends', exact: true }).click()
  await expect(page).toHaveURL(shoppingProjectPath)
  await expect(page.getByRole('heading', { name: 'Shopping Trends', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Không gian trực quan Dataset 3D', exact: true })).toBeVisible()
}
