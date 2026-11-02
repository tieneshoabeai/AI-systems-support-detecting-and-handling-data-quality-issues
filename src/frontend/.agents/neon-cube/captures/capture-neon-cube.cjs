const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { chromium } = require('playwright')

const OUT = __dirname
const BASE = 'http://localhost:5173/src/graphics/neon-cube/preview.html'

const SHOTS = [
  ['hero-45.png', '?angle=45&ui=0'],
  ['orbit-135.png', '?angle=135&ui=0'],
  ['orbit-225.png', '?angle=225&ui=0'],
  ['orbit-315.png', '?angle=315&ui=0'],
  ['top-60.png', '?angle=top&ui=0'],
  ['base-closeup.png', '?angle=45&zoom=base&ui=0'],
  ['clay-45.png', '?angle=45&clay=1&ui=0'],
  ['clay-exploded.png', '?angle=45&clay=1&ui=0', 'explode'],
]

fs.mkdirSync(OUT, { recursive: true })
const reference = path.join(OUT, '..', 'reference', 'reference.png')
if (fs.existsSync(reference)) fs.copyFileSync(reference, path.join(OUT, 'reference.png'))

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
}

;(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-color-profile=srgb'],
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  })
  const errors = []
  const stats = {}

  for (const [name, query, action] of SHOTS) {
    const page = await context.newPage()
    page.on('console', message => { if (message.type() === 'error') errors.push(`${name}: ${message.text()}`) })
    page.on('pageerror', error => errors.push(`${name}: ${String(error)}`))
    await page.goto(`${BASE}${query}`, { waitUntil: 'load' })
    await page.waitForSelector('body.neon-cube-ready', { timeout: 30000 })
    if (action === 'explode') {
      await page.evaluate(() => window.__neonCube?.setExploded?.(true))
      await page.waitForTimeout(450)
    }
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(OUT, name) })
    stats[name] = await page.evaluate(() => window.__neonCube ?? null)
    console.log(`${name}: ${stats[name]?.triangleCount ?? '?'} tri, ${stats[name]?.drawCalls ?? '?'} draw, view=${stats[name]?.view ?? '?'}`)
    await page.close()
  }

  const staticPage = await context.newPage()
  staticPage.on('pageerror', error => errors.push(`hero-45-static: ${String(error)}`))
  await staticPage.goto(`${BASE}?angle=45&ui=0`, { waitUntil: 'load' })
  await staticPage.waitForSelector('body.neon-cube-ready', { timeout: 30000 })
  const first = await staticPage.screenshot()
  await staticPage.waitForTimeout(400)
  const second = await staticPage.screenshot({ path: path.join(OUT, 'hero-45-static.png') })
  const identical = hash(first) === hash(second)
  console.log(`static 400ms: ${identical ? 'identical' : 'DIFFERENT'} (${hash(first)} vs ${hash(second)})`)
  await staticPage.close()

  await browser.close()

  console.log('console errors:', errors.length ? errors : 'none')
  if (!identical) {
    console.error('static check failed: frames differ')
    process.exit(1)
  }
  if (errors.length) process.exit(1)
})().catch(error => {
  console.error(error)
  process.exit(1)
})
