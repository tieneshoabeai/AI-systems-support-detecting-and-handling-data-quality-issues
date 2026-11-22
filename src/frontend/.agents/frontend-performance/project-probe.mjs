import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { chromium } from '@playwright/test'
import { loadEnv } from 'vite'

const [reportDirectory, lighthouseDirectory] = process.argv.slice(2)
if (!reportDirectory || !lighthouseDirectory) throw new Error('Cần đường dẫn báo cáo và thư mục Lighthouse đã pin.')
const root = resolve(reportDirectory)
const lighthousePath = resolve(lighthouseDirectory)
const { default: lighthouse, desktopConfig } = await import(pathToFileURL(resolve(lighthousePath, 'core/index.js')).href)
const require = createRequire(resolve(lighthousePath, 'package.json'))
if (require('./package.json').version !== '13.6.0') throw new Error('Cần Lighthouse 13.6.0.')
const { launch } = await import(pathToFileURL(require.resolve('chrome-launcher')).href)
const puppeteer = require('puppeteer-core')
const base = process.env.PROJECT_PROBE_BASE ?? 'https://127.0.0.1:4181'
const compareBase = process.env.PROJECT_PROBE_COMPARE_BASE
if (![base, ...(compareBase ? [compareBase] : [])].every(url => /^https:\/\/127\.0\.0\.1:\d+$/.test(url))) {
  throw new Error('Probe chỉ chạy trên HTTPS loopback.')
}
const api = loadEnv('production', process.cwd(), ['VITE_API_', 'E2E_TEST_'])
const apiRoot = (api.VITE_API_BASE_URL ?? '').replace(/\/+$/, '') + '/' + (api.VITE_API_PREFIX ?? '').replace(/^\/+|\/+$/g, '')
if (!api.E2E_TEST_EMAIL || !api.E2E_TEST_PASSWORD || !apiRoot.startsWith('https://')) throw new Error('Thiếu cấu hình BE test.')
await mkdir(root, { recursive: true })
const chrome = await launch({ chromeFlags: ['--headless', '--ignore-certificate-errors'], logLevel: 'silent' })
let stage = 'kết nối Chrome'
try {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`)
  const control = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` })
  try {
    const context = browser.contexts()[0]
    const page = context.pages()[0] ?? await context.newPage()
    const auditPage = (await control.pages())[0]
    const viewport = { width: 1350, height: 940 }
    await page.setViewportSize(viewport)
    page.setDefaultTimeout(20_000)
    await page.addInitScript(() => {
      const phases = []
      Object.defineProperty(window, 'projectScenePhases', { value: phases })
      new MutationObserver(entries => {
        for (const entry of entries) {
          const phase = entry.target.getAttribute?.('data-project-scene-phase')
          if (phase && !phases.some(value => value.phase === phase)) {
            phases.push({ phase, ms: Math.round(performance.now()) })
            performance.mark(`project-scene-${phase}`)
          }
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-project-scene-phase'] })
    })
    async function login(origin) {
      stage = 'đăng nhập BE test'
      await page.goto(origin + '/auth/login')
      await page.locator('#login-email').fill(api.E2E_TEST_EMAIL)
      await page.locator('#login-password').fill(api.E2E_TEST_PASSWORD)
      const loginResponse = page.waitForResponse(r => r.url() === apiRoot + '/auth/login' && r.request().method() === 'POST')
      await page.getByRole('form', { name: 'Đăng nhập' }).locator('button[type=submit]').click()
      if (!(await loginResponse).ok()) throw new Error('Login response failed')
      await page.waitForURL(origin + '/processing')
    }
    if (compareBase) await login(compareBase)
    await login(base)
    console.log('Đăng nhập BE test thành công.')

    stage = 'chọn project có dataset từ danh sách'
    const indexResponse = page.waitForResponse(r => r.url().split('?')[0] === apiRoot + '/projects' && r.request().method() === 'GET' && r.ok())
    await page.goto(base + '/management/projects')
    const body = await (await indexResponse).json()
    const projects = body.data?.items ?? body.items
    const smokeOnly = process.env.PROJECT_PROBE_SMOKE_ONLY === '1'
    const interactionsOnly = smokeOnly || process.env.PROJECT_PROBE_INTERACTIONS_ONLY === '1'
    const previousId = interactionsOnly
      ? new URL(JSON.parse(await readFile(resolve(root, 'run-01.report.json'), 'utf8')).finalDisplayedUrl).pathname.split('/').at(-1)
      : null
    const fixture = projects?.find(item => item.hasDataset === true && /^[\w-]+$/.test(item.id)
      && (!previousId || item.id === previousId))
    if (!fixture) throw new Error('No accessible dataset project')
    console.log('Index có project đã gắn dataset.')
    const variants = compareBase ? [
      { name: 'baseline', origin: compareBase, dir: resolve(root, 'baseline'), samples: [] },
      { name: 'candidate', origin: base, dir: resolve(root, 'candidate'), samples: [] },
    ] : [{ name: 'project', origin: base, dir: root, samples: [] }]
    for (const variant of variants) {
      variant.destination = variant.origin + '/processing/projects/' + fixture.id
      await mkdir(variant.dir, { recursive: true })
    }
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    const canvas = page.locator('.pj-stage canvas').first()
    const ready = async (destination) => {
      if (page.url() !== destination) throw new Error('Unexpected audit URL')
      const caption = await Promise.race([
        page.locator('.pj-dataset strong').filter({ hasText: /^Dataset:/ }).waitFor().then(() => 'dataset'),
        page.locator('.pj-dataset strong').filter({ hasText: /^Dataset$/ }).waitFor().then(() => 'empty'),
      ])
      if (caption === 'empty') throw new Error('Detail không có metadata dataset dù index báo đã gắn.')
      const scene = await Promise.race([
        canvas.waitFor().then(() => 'canvas'),
        page.locator('.dataset-3d-fallback').waitFor().then(() => 'fallback'),
      ])
      if (scene === 'fallback') throw new Error('WebGL fallback')
    }

    stage = 'xác minh Project Detail và WebGL'
    await page.goto(variants.at(-1).destination, { waitUntil: 'domcontentloaded' })
    await ready(variants.at(-1).destination)
    console.log('Project Detail có dataset và canvas.')
    if (smokeOnly) {
      stage = 'kiểm tra theme, tách mô hình và rời route'
      const completed = page.locator('canvas[data-project-scene-phase="ready"]')
      await completed.waitFor()
      const themeButton = page.getByRole('button', { name: 'Chế độ màu' })
      for (const [option, theme] of [['Sáng', 'light'], ['Tối', 'dark']]) {
        await themeButton.click()
        const dialog = page.getByRole('dialog', { name: 'Chế độ màu' })
        await dialog.getByRole('radio', { name: option, exact: true }).click()
        await page.locator(`[data-preview="2d"][data-theme="${theme}"]`).waitFor()
        await completed.waitFor()
        if (await dialog.isVisible()) await page.keyboard.press('Escape')
      }
      const detach = page.getByRole('button', { name: 'Tách mô hình', exact: true })
      await detach.click()
      await page.getByRole('button', { name: 'Lắp lại mô hình', exact: true }).click()

      await page.addInitScript(() => {
        new MutationObserver((_, observer) => {
          if (!document.querySelector('canvas[data-project-scene-phase="core"]')) return
          observer.disconnect()
          window.leftProjectDuringCore = true
          history.pushState({}, '', '/processing')
          dispatchEvent(new PopStateEvent('popstate'))
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-project-scene-phase'] })
      })
      await page.goto(variants.at(-1).destination, { waitUntil: 'commit' })
      await page.waitForURL(base + '/processing')
      if (!(await page.evaluate(() => window.leftProjectDuringCore))) throw new Error('Không ghi được rời route tại mốc core')
      await page.locator('.pj-stage').waitFor({ state: 'detached' })
      await writeFile(resolve(root, 'smoke.json'), JSON.stringify({
        lightTheme: true, darkTheme: true, detachAndReassemble: true, leftDuringCore: true,
      }, null, 2) + '\n')
      console.log('Project smoke: light, dark, detach, reassemble, leave during core passed')
    } else {
      if (!interactionsOnly) {
        const viewer = await browser.newPage({ viewport: { width: 1120, height: 900 }, colorScheme: 'dark' })
        for (let sample = 1; sample <= 5; sample++) {
          const order = sample % 2 === 1 ? variants : [...variants].reverse()
          for (const variant of order) {
            stage = `Lighthouse ${variant.name} lượt ${sample}`
            const { destination, dir } = variant
            await page.bringToFront()
            await page.goto('about:blank')
            await cdp.send('Network.clearBrowserCache')
            const result = await lighthouse(destination, {
              port: chrome.port, logLevel: 'silent', output: ['json', 'html'], disableStorageReset: true,
              onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            }, desktopConfig, auditPage)
            if (!result || result.lhr.runtimeError || result.lhr.finalDisplayedUrl !== destination) throw new Error('Audit target mismatch')
            await ready(destination)
            const name = 'run-' + String(sample).padStart(2, '0')
            for (const [index, extension] of ['json', 'html'].entries()) {
              await writeFile(resolve(dir, `${name}.report.${extension}`), result.report[index])
            }
            await viewer.goto(pathToFileURL(resolve(dir, `${name}.report.html`)).href)
            await viewer.locator('.lh-scores-wrapper').waitFor()
            await viewer.waitForTimeout(1000)
            await viewer.screenshot({ path: resolve(dir, name + '.png'), animations: 'disabled' })
            console.log(`Lighthouse ${variant.name} ${sample}/5`)
          }
        }
        await viewer.close()
      }

      async function measure({ destination, dir }, trace = false) {
        await page.bringToFront()
        await cdp.send('Network.clearBrowserCache')
        if (trace) await browser.startTracing(page, {
          path: resolve(dir, 'chrome-performance.trace.json'),
          screenshots: true,
          categories: ['devtools.timeline', 'blink.user_timing', 'loading', 'disabled-by-default-v8.cpu_profiler'],
        })
        try {
          const start = performance.now()
          await page.goto(destination, { waitUntil: 'commit' })
          await page.locator('.pj-head-row .crumb-current').waitFor()
          const projectNameMs = Math.round(performance.now() - start)
          await ready(destination)
          const canvasMs = Math.round(performance.now() - start)
          console.log('Project và canvas sẵn sàng.')
          const idleFrames = await page.evaluate(() => new Promise(resolve => {
            const samples = []
            let previous
            const end = performance.now() + 500
            function frame(now) {
              if (previous !== undefined) samples.push(now - previous)
              previous = now
              if (now < end) requestAnimationFrame(frame)
              else resolve(samples)
            }
            requestAnimationFrame(frame)
            setTimeout(() => resolve(samples), 850)
          }))
          const box = await canvas.boundingBox()
          if (!box) throw new Error('Missing scene bounds')
          await page.evaluate(() => {
            window.projectFrames = []
            const end = performance.now() + 1000
            let previous
            function frame(now) {
              if (previous !== undefined) window.projectFrames.push(now - previous)
              previous = now
              if (now < end) requestAnimationFrame(frame)
            }
            requestAnimationFrame(frame)
          })
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await page.mouse.down()
          await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 20, { steps: 12 })
          await page.mouse.up()
          await page.waitForTimeout(1000)
          const viewStart = performance.now()
          await page.locator('.pj-modules button[data-module="data-view"]').click()
          const panel = page.locator('.project-module-panel[data-module="data-view"][data-open="true"]')
          const firstRow = panel.locator('tbody tr').first()
          await firstRow.waitFor()
          const dataViewMs = Math.round(performance.now() - viewStart)
          const firstRowObservedMs = await page.evaluate(() => performance.now())
          const firstIndex = await firstRow.locator('td').first().textContent()
          const next = panel.getByRole('button', { name: 'Trang tiếp' })
          let pageMs = null
          if (await next.count() && await next.isEnabled()) {
            const nextStart = performance.now()
            await next.click()
            await page.waitForFunction(index => {
              const current = document.querySelector('.project-module-panel[data-module="data-view"] tbody tr td')
              return Boolean(current && current.textContent !== index)
            }, firstIndex)
            pageMs = Math.round(performance.now() - nextStart)
          }
          const browserMetrics = await page.evaluate(({ apiRoot, trace }) => {
            const webgl = document.querySelector('.pj-stage canvas')?.getContext('webgl2')
            const vendor = webgl?.getExtension('WEBGL_debug_renderer_info')
            const renderer = vendor ? webgl.getParameter(vendor.UNMASKED_RENDERER_WEBGL) : null
            const endpoints = performance.getEntriesByType('resource')
              .filter(entry => entry.name.startsWith(apiRoot + '/')).map(entry => ({
                endpoint: new URL(entry.name).pathname.slice(new URL(apiRoot).pathname.length)
                  .replace(/\/(projects|workspaces|datasets)\/[^/]+/g, '/$1/:id'),
                startMs: Math.round(entry.startTime), durationMs: Math.round(entry.duration),
                endMs: Math.round(entry.responseEnd),
              }))
            return { renderer, dragFrames: window.projectFrames ?? [], phases: window.projectScenePhases, endpoints, trace }
          }, { apiRoot, trace })
          return { projectNameMs, canvasMs, dataViewMs, firstRowObservedMs: Math.round(firstRowObservedMs), pageMs, idleFrames, ...browserMetrics }
        } finally {
          if (trace) await browser.stopTracing()
        }
      }
      stage = 'đo thao tác Project'
      for (let index = 0; index < 5; index++) {
        const order = index % 2 === 0 ? variants : [...variants].reverse()
        for (const variant of order) {
          variant.samples.push(await measure(variant))
          await writeFile(resolve(variant.dir, 'journey.json'), JSON.stringify({ samples: variant.samples, trace: null }, null, 2) + '\n')
          console.log(`Project interaction ${variant.name} ${index + 1}/5`)
        }
      }
      for (const variant of variants) {
        const trace = await measure(variant, true)
        await writeFile(resolve(variant.dir, 'journey.json'), JSON.stringify({ samples: variant.samples, trace }, null, 2) + '\n')
      }
      console.log('Project interaction: 5/5 and trace')
    }
  } catch (error) {
    console.error(`Lỗi ở bước: ${stage}.`)
    if (stage !== 'đăng nhập BE test' && error instanceof Error) console.error(error.message.split('\n')[0])
    throw error
  } finally {
    control.disconnect()
    await browser.close()
  }
} catch (error) {
  console.error(`Benchmark dừng tại bước: ${stage}.`)
  if (stage !== 'đăng nhập BE test' && error instanceof Error) {
    console.error(error.message.split('\n')[0])
  }
  process.exitCode = 1
} finally {
  await chrome.kill()
}
