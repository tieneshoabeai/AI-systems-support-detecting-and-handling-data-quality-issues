import { check } from 'k6'
import { browser } from 'k6/browser'
import { Trend } from 'k6/metrics'

const iterations = Number(__ENV.ITERATIONS ?? '1')
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 5) {
  throw new Error('ITERATIONS phải là số nguyên từ 1 đến 5.')
}

export const options = {
  scenarios: {
    projects: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations,
      maxDuration: '3m',
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: { checks: ['rate==1'], dropped_iterations: ['count==0'] },
  summaryTrendStats: ['count', 'min', 'med', 'p(95)', 'max'],
}

const base = __ENV.BASE_URL
const api = __ENV.PERF_API_ROOT
const email = __ENV.E2E_TEST_EMAIL?.trim()
const password = __ENV.E2E_TEST_PASSWORD
if (!/^https:\/\/127\.0\.0\.1:\d+$/.test(base ?? '') || !api || !email || !password) {
  throw new Error('Cần frontend HTTPS loopback, địa chỉ API và tài khoản test.')
}

const loginReady = new Trend('login_submit_to_ready', true)
const projectsReady = new Trend('projects_navigation_to_ready', true)
const apiDuration = new Trend('projects_flow_api_duration', true)
const cardDetailsReady = new Trend('projects_navigation_to_card_details_ready', true)
const requestsBeforeCard = new Trend('projects_requests_before_card')
const requestsThroughDetails = new Trend('projects_requests_through_details')
const timeout = 30_000

export default async function () {
  const page = await browser.newPage({ ignoreHTTPSErrors: __ENV.ALLOW_LOCAL_SELF_SIGNED_CERT === '1' })
  let loggedIn = false
  let listReady = false
  let loggedOut = false
  let projectsTimingRecorded = false
  let detailsReady = false
  let requestCount = 0
  const statuses = new Map<string, number>()
  const endpoint = (url: string) => {
    const path = url.split('?')[0]
    return path.startsWith(api + '/') ? path.slice(api.length) : ''
  }
  const tag = (path: string) => {
    if (/^\/(auth\/login|auth\/logout|users\/me|projects|workspaces)$/.test(path)) return path
    return path.match(/^\/(projects|workspaces)\/[^/]+\/(members|datasets|projects)$/)
      ?.slice(1).join('/:id/')
  }
  page.on('response', response => {
    const path = endpoint(response.url())
    if (response.request().method() !== 'OPTIONS' && tag(path)) statuses.set(path, response.status())
  })
  page.on('request', () => { requestCount++ })

  try {
    await page.goto(base + '/auth/login', { timeout })
    const form = page.locator('form[aria-label="Đăng nhập"]')
    try {
      await form.locator('#login-email').fill(email!, { timeout })
      await form.locator('#login-password').fill(password!, { timeout })
    } catch {
      throw new Error('Không nhập được thông tin vào form đăng nhập.')
    }
    const loginStart = Date.now()
    await form.locator('button[type=submit]').click({ timeout })
    await page.waitForURL(base + '/processing', { timeout })
    await page.getByRole('heading', { name: 'Khám phá vũ trụ dữ liệu của bạn', exact: true })
      .waitFor({ state: 'visible', timeout })
    loggedIn = statuses.get('/auth/login') === 200
    if (!loggedIn) throw new Error('Không quan sát được phản hồi đăng nhập HTTP 200 từ BE.')
    loginReady.add(Date.now() - loginStart)

    statuses.delete('/projects')
    const projectsStart = Date.now()
    const requestsAtNavigation = requestCount
    await page.goto(base + '/management/projects', { timeout })
    await page.locator('article.resource-card .card-title').first().waitFor({ state: 'visible', timeout })
    listReady = page.url() === base + '/management/projects' && statuses.get('/projects') === 200
      && !(await page.locator('.management-data-notice').isVisible())
    if (!listReady) throw new Error('Danh sách chưa được xác nhận từ API thật.')
    projectsReady.add(Date.now() - projectsStart)
    requestsBeforeCard.add(requestCount - requestsAtNavigation)
    const observedAt = await page.evaluate(() => performance.now())
    await page.locator('article.resource-card[data-card-details="ready"]').first().waitFor({ state: 'visible', timeout })
    await page.locator('article.resource-card[data-card-details]:not([data-card-details="ready"])').first()
      .waitFor({ state: 'hidden', timeout })
    cardDetailsReady.add(Date.now() - projectsStart)
    requestsThroughDetails.add(requestCount - requestsAtNavigation)
    detailsReady = true

    // All offsets are relative to the projects document's time origin.
    const resources = await page.evaluate(() => performance.getEntriesByType('resource')
        .filter((entry): entry is PerformanceResourceTiming =>
          entry instanceof PerformanceResourceTiming
          && ['fetch', 'xmlhttprequest'].includes(entry.initiatorType))
        .map(entry => ({
          url: entry.name,
          duration: entry.duration,
          start: entry.startTime,
          end: entry.responseEnd,
        })))
    const timings = resources.flatMap(resource => {
      const path = endpoint(resource.url)
      const route = tag(path)
      const status = statuses.get(path)
      if (!route || status === undefined || !Number.isFinite(resource.duration) || resource.duration <= 0) return []
      apiDuration.add(resource.duration, { endpoint: route })
      return [{
        endpoint: route,
        status,
        durationMs: Math.round(resource.duration),
        startMs: Math.round(resource.start),
        endMs: Math.round(resource.end),
      }]
    })
    projectsTimingRecorded = timings.some(timing => timing.endpoint === '/projects' && timing.status === 200)
    console.log('projects_api_timing ' + JSON.stringify({
      cardObservedMs: Math.round(observedAt),
      requests: timings,
    }))
  } finally {
    try {
      if (statuses.get('/auth/login') === 200) {
        await page.getByRole('button', { name: /^Tài khoản .+$/ }).click({ timeout })
        const [logoutResponse] = await Promise.all([
          page.waitForEvent('response', {
            predicate: response => endpoint(response.url()) === '/auth/logout'
              && response.request().method() === 'POST',
            timeout,
          }),
          page.getByRole('button', { name: 'Đăng xuất', exact: true }).click({ timeout }),
        ])
        await page.waitForURL(base + '/auth/login', { timeout })
        loggedOut = logoutResponse.status() === 200
      }
    } finally {
      check(loggedIn, { 'đăng nhập qua BE thật': passed => passed })
      check(listReady, { 'danh sách dự án thật có thẻ hiển thị': passed => passed })
      check(projectsTimingRecorded, { 'ghi được timing dương của GET /projects': passed => passed })
      check(detailsReady, { 'dữ liệu bổ sung của thẻ đang hiển thị đã sẵn sàng': passed => passed })
      check(loggedOut, { 'BE xác nhận đăng xuất': passed => passed })
      await page.close()
    }
  }
}
