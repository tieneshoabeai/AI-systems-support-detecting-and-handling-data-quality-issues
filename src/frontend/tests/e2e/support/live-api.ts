import { expect } from '@playwright/test'
import type { APIResponse, Page, Response } from '@playwright/test'
import { loadEnv } from 'vite'

export type LiveSession = { token: string; accountId: string; role: string }

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('BE returned an invalid object. Response bodies are omitted for privacy.')
  }
  return value as Record<string, unknown>
}

export function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('BE omitted a required string field.')
  return value
}

export function apiUrl(path: string): string {
  const env = loadEnv('development', process.cwd(), 'VITE_API_')
  const base = env['VITE_API_BASE_URL']
  const prefix = env['VITE_API_PREFIX']?.replace(/^\/+|\/+$/g, '')
  if (!base || !prefix) throw new Error('Configure VITE_API_BASE_URL and VITE_API_PREFIX locally.')
  const url = new URL(base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('The configured API origin is invalid.')
  }
  return new URL(`/${prefix}${path}`, url.origin).href
}

export function matchesApi(url: string, path: string): boolean {
  const actual = new URL(url)
  const expected = new URL(apiUrl(path))
  return actual.origin === expected.origin && actual.pathname === expected.pathname
}

export function responseFor(page: Page, path: string, method: string): Promise<Response> {
  return page.waitForResponse(response => matchesApi(response.url(), path) && response.request().method() === method)
}

export async function data(response: Response | APIResponse): Promise<unknown> {
  if (!response.ok()) throw new Error(`Real API request failed (HTTP ${response.status()}); body omitted.`)
  const body = record(await response.json() as unknown)
  if (body['success'] !== true || !Object.hasOwn(body, 'data')) throw new Error('BE did not return the success/data envelope.')
  return body['data']
}

export async function get(page: Page, session: LiveSession, path: string): Promise<unknown> {
  return data(await page.request.get(apiUrl(path), { headers: { Authorization: `Bearer ${session.token}` } }))
}

export async function closeSession(page: Page, session: LiveSession): Promise<void> {
  const response = await page.request.post(apiUrl('/auth/logout'), { headers: { Authorization: `Bearer ${session.token}` } })
  if (!response.ok()) throw new Error(`Test-session cleanup failed (HTTP ${response.status()}).`)
}

export async function login(page: Page): Promise<LiveSession> {
  const env = loadEnv('development', process.cwd(), 'E2E_TEST_')
  const email = env['E2E_TEST_EMAIL']?.trim()
  const password = env['E2E_TEST_PASSWORD']
  if (!email || !password) throw new Error('Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in local env before running authenticated E2E.')
  await page.goto('/auth/login')
  const form = page.getByRole('form', { name: 'Đăng nhập', exact: true })
  await expect(form).toBeVisible()
  // Do not let locator failure diagnostics echo a credential value.
  try {
    await form.getByLabel('Email', { exact: true }).fill(email)
    await form.getByLabel('Mật khẩu', { exact: true }).fill(password)
  } catch {
    throw new Error('Could not fill the real login form; credential details omitted.')
  }
  const pending = responseFor(page, '/auth/login', 'POST')
  await form.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  const result = record(await data(await pending))
  const user = record(result['user'])
  const session = { token: text(result['access_token']), accountId: text(user['id']), role: text(user['role']) }
  try {
    await expect(page).toHaveURL('/processing')
    await expect(page.getByRole('heading', { name: 'Khám phá vũ trụ dữ liệu của bạn', exact: true })).toBeVisible()
    return session
  } catch (error) {
    await closeSession(page, session)
    throw error
  }
}

export async function authenticated(page: Page, run: (session: LiveSession) => Promise<void>): Promise<void> {
  const session = await login(page)
  try { await run(session) } finally { await closeSession(page, session) }
}
