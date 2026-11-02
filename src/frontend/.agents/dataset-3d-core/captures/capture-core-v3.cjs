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

function watch(page, errors) {
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(String(error)))
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
  watch(page, errors)
  await page.goto(URL, { waitUntil: 'load' })
  await ready(page)
  await shoot(page, 'after-attached.png', 0)
  await shoot(page, 'after-attached-b.png', 400)

  // Orbit away from the hero angle to check the lanes against the tower ring.
  await page.mouse.move(640, 450)
  await page.mouse.down()
  await page.mouse.move(900, 450, { steps: 16 })
  await page.mouse.up()
  await shoot(page, 'after-orbit.png', 1200)

  // Zoom toward the core for band/bead detail.
  await page.mouse.move(640, 450)
  await page.mouse.wheel(0, -700)
  await shoot(page, 'after-closeup.png', 1200)

  await page.getByRole('button', { name: 'Tách mô hình' }).click()
  await page.waitForTimeout(2500)
  await shoot(page, 'after-exploded.png', 0)

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const mobilePage = await mobile.newPage()
  watch(mobilePage, errors)
  await mobilePage.goto(URL, { waitUntil: 'load' })
  await ready(mobilePage)
  await mobilePage.screenshot({ path: path.join(OUT, 'after-mobile.png') })

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const reducedPage = await reduced.newPage()
  watch(reducedPage, errors)
  await reducedPage.goto(URL, { waitUntil: 'load' })
  await ready(reducedPage)
  const label = await reducedPage.locator('.dataset-3d-header p').textContent()
  await reducedPage.screenshot({ path: path.join(OUT, 'after-reduced-a.png') })
  await reducedPage.waitForTimeout(400)
  await reducedPage.screenshot({ path: path.join(OUT, 'after-reduced-b.png') })

  console.log('reduced-motion label:', label)
  console.log('console errors:', errors.length ? errors : 'none')
  await browser.close()
})().catch(error => {
  console.error(error)
  process.exit(1)
})
