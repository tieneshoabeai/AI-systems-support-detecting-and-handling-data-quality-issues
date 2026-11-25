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

type DirectApiResponse = Pick<APIResponse, 'ok' | 'status' | 'json' | 'body'>
type DirectOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  data?: Record<string, unknown>
  multipart?: Record<string, { name: string; mimeType: string; buffer: Buffer }>
  timeoutMs?: number
}
export async function directRequest(_page: Page, path: string, options: DirectOptions = {}): Promise<DirectApiResponse> {
  try {
    const headers = { ...options.headers, Connection: 'close', ...(options.data ? { 'Content-Type': 'application/json' } : {}) }
    let body: string | FormData | undefined = options.data ? JSON.stringify(options.data) : undefined
    if (options.multipart) {
      const form = new FormData()
      for (const [key, file] of Object.entries(options.multipart)) {
        form.append(key, new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.name)
      }
      body = form
    }
    // Independent Node transport also works while the browser context is offline.
    const response = await fetch(apiUrl(path), {
      method: options.method ?? 'GET', headers, ...(body ? { body } : {}), signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    })
    const bytes = Buffer.from(await response.arrayBuffer())
    return { ok: () => response.ok, status: () => response.status,
      body: () => Promise.resolve(bytes), json: () => Promise.resolve(JSON.parse(bytes.toString()) as unknown) }
  } catch (error) {
    // Playwright transport errors include Authorization headers. Keep them out of reports.
    const kind = error instanceof Error ? error.message.split('\n')[0]?.replace(/Bearer\s+\S+/gi, 'Bearer [omitted]') : 'transport error'
    // eslint-disable-next-line preserve-caught-error -- Raw transport causes can expose Authorization headers in reports.
    throw new Error(`Direct QA request did not complete: ${options.method ?? 'GET'} ${path}; ${kind}; credentials omitted.`)
  }
}

export async function openResourceMenu(page: Page, name: string): Promise<void> {
  const trigger = page.getByRole('button', { name: `Thao tác với ${name}`, exact: true })
  await trigger.scrollIntoViewIfNeeded()
  // Scroll dismisses fixed surfaces. Drain the automatic scroll before opening one.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await trigger.click()
}

export async function data(response: Response | DirectApiResponse): Promise<unknown> {
  if (!response.ok()) throw new Error(`Real API request failed (HTTP ${response.status()}); body omitted.`)
  const body = record(await response.json() as unknown)
  if (body['success'] !== true || !Object.hasOwn(body, 'data')) throw new Error('BE did not return the success/data envelope.')
  return body['data']
}

export async function get(page: Page, session: LiveSession, path: string): Promise<unknown> {
  return data(await directRequest(page, path, { headers: { Authorization: `Bearer ${session.token}` } }))
}

export async function closeSession(page: Page, session: LiveSession): Promise<void> {
  const response = await directRequest(page, '/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } })
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
