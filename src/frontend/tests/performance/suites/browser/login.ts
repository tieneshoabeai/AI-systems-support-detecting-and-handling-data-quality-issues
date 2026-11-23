import { check } from 'k6'
import { browser } from 'k6/browser'
import { Trend } from 'k6/metrics'

const iterations = Number(__ENV.ITERATIONS ?? '1')
if (!Number.isSafeInteger(iterations) || iterations < 1) {
  throw new Error('ITERATIONS phải là số nguyên dương.')
}

export const options = {
  scenarios: {
    login: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations,
      maxDuration: '10m',
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
  },
  summaryTrendStats: ['count', 'med', 'p(90)', 'p(95)', 'p(99)'],
}

const baseUrl = (__ENV.BASE_URL ?? '').replace(/\/$/, '')
if (!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(baseUrl)) {
  throw new Error('BASE_URL phải là origin của frontend local, ví dụ http://127.0.0.1:4173.')
}

const loginFormReady = new Trend('login_form_ready', true)
const timeout = 30_000

export default async function () {
  const page = await browser.newPage({
    ignoreHTTPSErrors: __ENV.ALLOW_LOCAL_SELF_SIGNED_CERT === '1',
  })
  let formReady = false

  try {
    const start = Date.now()
    const response = await page.goto(`${baseUrl}/auth/login`, { timeout })
    if (response?.status() !== 200 || page.url() !== `${baseUrl}/auth/login`) {
      throw new Error('Không mở được /auth/login với HTTP 200.')
    }

    const form = page.locator('form[aria-label="Đăng nhập"]')
    await form.locator('#login-email:enabled').waitFor({ state: 'visible', timeout })
    await form.locator('#login-password:enabled').waitFor({ state: 'visible', timeout })
    await form.locator('button[type="submit"]:enabled').waitFor({ state: 'visible', timeout })

    formReady = true
    loginFormReady.add(Date.now() - start)
  } finally {
    check(formReady, { 'form đăng nhập hiển thị và có thể thao tác': ready => ready })
    await page.close()
  }
}
