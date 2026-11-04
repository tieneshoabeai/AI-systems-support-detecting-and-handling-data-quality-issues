// Deterministic single-frame capture for lighting A/B.
// The main harness drags/zooms and shoots whatever animation phase the page happens to be in, so
// two runs differ by particle positions (measured at up to +227 luminance per pixel), which swamps
// a lighting delta. With reducedMotion the scene freezes on its reset pose, so the only difference
// between two runs is what the config changed.
//
// Usage (from src/frontend):
//   NODE_PATH=<playwright dir> node .agents/dataset-3d-core/captures/capture-frozen.cjs <outDir>
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright')

const OUT = process.argv[2]
if (!OUT) {
  console.error('usage: node capture-frozen.cjs <outDir>')
  process.exit(1)
}
fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-color-profile=srgb'],
  })
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto('http://localhost:5173/workspaces/3d-dataset', { waitUntil: 'load' })
  await page.waitForSelector('.dataset-3d-canvas canvas', { timeout: 30000 })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: path.join(OUT, 'frozen.png') })
  // A second frame proves the pose really is frozen.
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, 'frozen-b.png') })
  console.log(path.join(OUT, 'frozen.png'), '| console errors:', errors.length ? errors : 'none')
  await browser.close()
})().catch(error => {
  console.error(error)
  process.exit(1)
})
