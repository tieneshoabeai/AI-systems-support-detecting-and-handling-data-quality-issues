const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright')

const OUT = __dirname
const URL = 'http://localhost:5173/workspaces/3d-dataset'

fs.mkdirSync(OUT, { recursive: true })

async function ready(page) {
  await page.waitForSelector('.dataset-3d-canvas canvas', { timeout: 30000 })
  await page.waitForTimeout(6000)
}

async function shoot(page, name, wait) {
  if (wait) await page.waitForTimeout(wait)
  await page.screenshot({ path: path.join(OUT, name) })
}

;(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-color-profile=srgb'],
  })
  const errors = []

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  const page = await desktop.newPage()
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto(URL, { waitUntil: 'load' })
  await ready(page)
  await shoot(page, 'desktop-attached-a.png', 0)
  await shoot(page, 'desktop-attached-b.png', 400)
  await page.getByRole('button', { name: 'Tách mô hình' }).click()
  await page.waitForTimeout(2500)
  await shoot(page, 'desktop-exploded-a.png', 0)
  await shoot(page, 'desktop-exploded-b.png', 400)

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const mobilePage = await mobile.newPage()
  await mobilePage.goto(URL, { waitUntil: 'load' })
  await ready(mobilePage)
  await mobilePage.screenshot({ path: path.join(OUT, 'mobile-attached.png') })

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const reducedPage = await reduced.newPage()
  await reducedPage.goto(URL, { waitUntil: 'load' })
  await ready(reducedPage)
  const label = await reducedPage.locator('.dataset-3d-header p').textContent()
  await reducedPage.screenshot({ path: path.join(OUT, 'reduced-a.png') })
  await reducedPage.waitForTimeout(400)
  await reducedPage.screenshot({ path: path.join(OUT, 'reduced-b.png') })

  console.log('reduced-motion label:', label)
  console.log('console errors:', errors.length ? errors : 'none')
  await browser.close()
})().catch(error => {
  console.error(error)
  process.exit(1)
})
