import { readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const [directory, mode] = process.argv.slice(2)
if (!directory) throw new Error('Cần thư mục báo cáo Lighthouse.')
const reportDir = resolve(directory)
const url = process.env.LOGIN_PROBE_URL ?? 'https://127.0.0.1:4181/auth/login'
if (!/^https:\/\/127\.0\.0\.1:\d+\/auth\/login$/.test(url)) throw new Error('Probe chỉ chạy trên HTTPS loopback.')
const launch = { channel: 'chrome', headless: true }
const files = (await readdir(reportDir)).filter(file => /^run-\d{2}\.report\.html$/.test(file)).sort()
if (files.length !== 5) throw new Error('Cần đủ 5 báo cáo Lighthouse.')

if (mode !== '--layouts-only') {
  const viewer = await chromium.launch(launch)
  try {
    const page = await viewer.newPage({ viewport: { width: 1120, height: 900 }, colorScheme: 'dark' })
    for (const file of files) {
      await page.goto(pathToFileURL(resolve(reportDir, file)).href)
      await page.locator('.lh-scores-wrapper').waitFor()
      // The Lighthouse scoreboard animates its ring and number after first paint.
      await page.waitForTimeout(1000)
      await page.screenshot({ path: resolve(reportDir, file.replace('.report.html', '.png')), animations: 'disabled' })
    }
  } finally {
    await viewer.close()
  }
}
if (mode === '--screenshots-only') process.exit(0)

async function measureInput(browser, trace = false) {
  const context = await browser.newContext({
    viewport: { width: 1350, height: 940 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  try {
    if (trace) await browser.startTracing(page, {
      path: resolve(reportDir, 'chrome-performance.trace.json'),
      categories: ['devtools.timeline', 'blink.user_timing', 'loading',
        'disabled-by-default-devtools.timeline', 'disabled-by-default-v8.cpu_profiler'],
    })
    await page.addInitScript(() => {
      document.addEventListener('input', event => {
        if (event.target instanceof HTMLInputElement && event.target.id === 'login-email') {
          performance.mark('login-first-input')
        }
      }, { capture: true })
    })
    await page.goto(url, { waitUntil: 'commit' })
    const email = page.locator('#login-email')
    await email.click({ timeout: 20_000 })
    await email.press('a')
    if (await email.inputValue() !== 'a') throw new Error('Ô email chưa nhận ký tự đầu tiên.')
    const firstInput = await page.evaluate(() => performance.getEntriesByName('login-first-input')[0]?.startTime)
    if (!Number.isFinite(firstInput)) throw new Error('Thiếu mốc nhập liệu.')
    await email.pressSequentially('bcdef', { delay: 40 })
    if (await email.inputValue() !== 'abcdef') throw new Error('Ô email mất ký tự khi nhập liên tiếp.')
    const maxInputGapMs = await page.evaluate(() => {
      const marks = performance.getEntriesByName('login-first-input')
      return Math.round(Math.max(...marks.slice(1).map((mark, index) => mark.startTime - marks[index].startTime)))
    })
    await page.locator('.auth-glass-visual').evaluate(async element => {
      const deadline = performance.now() + 12_000
      while (element.getAttribute('data-scene') === 'loading' && performance.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    })
    const scene = await page.locator('.auth-glass-visual').getAttribute('data-scene')
    const canvasCount = await page.locator('.auth-glass-visual canvas').count()
    if (trace) await browser.stopTracing()
    return { firstInputMs: Math.round(firstInput), maxInputGapMs, scene, canvasCount }
  } finally {
    await context.close()
  }
}

async function checkLoginLayouts(browser) {
  for (const [width, simulateMissingWebGL] of [[390, false], [1350, true]]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, ignoreHTTPSErrors: true })
    try {
      const page = await context.newPage()
      if (simulateMissingWebGL) {
        await page.addInitScript(() => { Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined }) })
      }
      await page.goto(url)
      await page.locator('#login-email').fill('layout@example.test')
      if (await page.locator('.auth-glass-login-stage').count()) throw new Error('Kịch bản 2D đã khởi tạo scene.')
    } finally {
      await context.close()
    }
  }
  const context = await browser.newContext({ viewport: { width: 1350, height: 940 }, ignoreHTTPSErrors: true })
  try {
    const page = await context.newPage()
    await page.goto(url)
    const visual = page.locator('.auth-glass-visual[data-scene="ready"]')
    await visual.locator('canvas').waitFor()
    await page.locator('.auth-glass-sign-in-register').getByRole('button', { name: 'Đăng ký', exact: true }).click()
    await page.getByRole('heading', { name: 'Tạo tài khoản' }).waitFor()
  } finally {
    await context.close()
  }
}

const browser = await chromium.launch(launch)
try {
  if (mode !== '--layouts-only') {
    const samples = []
    for (let index = 0; index < files.length; index++) samples.push(await measureInput(browser))
    const trace = await measureInput(browser, true)
    await writeFile(resolve(reportDir, 'input-timing.json'), JSON.stringify({ url, samples, trace }, null, 2) + '\n')
    console.log(JSON.stringify({ samples, trace }))
  }
  await checkLoginLayouts(browser)
  console.log('Mobile 2D, desktop fallback 2D, desktop 3D registration: passed')
} finally {
  await browser.close()
}
