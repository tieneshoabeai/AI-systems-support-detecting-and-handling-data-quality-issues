const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

const output = '.agents/dataset-3d-core/module-legend'
const source = fs.readFileSync('.agents/dataset-3d-core/captures/capture-p0.cjs', 'utf8')
const start = source.indexOf('const HOOK =')
const end = source.indexOf('// Draw calls and triangles per sculptComponent')
assert(start >= 0 && end > start)
const { HOOK } = new Function(source.slice(start, end) + '\nreturn { HOOK }')()

;(async () => {
  const browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-color-profile=srgb'],
  })
  const results = []
  try {
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
      const errors = []
      page.on('pageerror', error => errors.push(String(error)))
      await page.goto('http://localhost:5173/workspaces/3d-dataset', { waitUntil: 'load' })
      await page.waitForSelector('.dataset-3d-canvas canvas')
      await page.waitForTimeout(4000)
      const hook = await page.evaluate(HOOK)
      assert.equal(hook.scenes, 1)
      const camera = () => page.evaluate(() => ({
        position: window.__p0.camera.position.toArray(),
        quaternion: window.__p0.camera.quaternion.toArray(),
      }))
      const toggle = page.getByRole('button', { name: 'Mở bản đồ module', exact: true })
      const legend = page.getByRole('complementary', { name: 'Bản đồ module' })
      const content = page.locator('#dataset-3d-legend-content')
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
      assert.equal(await content.isVisible(), false)
      const collapsed = await legend.boundingBox()
      assert(collapsed.width <= 46 && collapsed.height <= 48)
      const before = await camera()
      await toggle.focus()
      await page.keyboard.press('Enter')
      const close = page.getByRole('button', { name: 'Thu gọn bản đồ module', exact: true })
      assert.equal(await close.getAttribute('aria-expanded'), 'true')
      assert.equal(await content.isVisible(), true)
      assert.equal(await legend.getByText('Tổng quan', { exact: true }).isVisible(), true)
      assert.deepEqual(await camera(), before)
      const expanded = await legend.boundingBox()
      const stage = await page.locator('.dataset-3d-stage').boundingBox()
      assert(expanded.x >= stage.x && expanded.x + expanded.width <= stage.x + stage.width)
      await page.screenshot({ path: path.join(output, viewport.width + '-expanded.png') })
      const detach = page.getByRole('button', { name: 'Tách mô hình', exact: true })
      const detachBox = await detach.boundingBox()
      const intersects = expanded.x < detachBox.x + detachBox.width && expanded.x + expanded.width > detachBox.x &&
        expanded.y < detachBox.y + detachBox.height && expanded.y + expanded.height > detachBox.y
      assert.equal(intersects, false, 'legend overlaps detach button')
      await detach.click()
      assert.equal(await close.getAttribute('aria-expanded'), 'true')
      await close.focus()
      await page.keyboard.press('Space')
      assert.equal(await content.isVisible(), false)
      assert.equal(await page.getByRole('button', { name: 'Lắp lại mô hình', exact: true }).count(), 1)
      await page.getByRole('button', { name: 'Lắp lại mô hình', exact: true }).click()
      const canvas = page.locator('.dataset-3d-canvas canvas')
      const box = await canvas.boundingBox()
      await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.65)
      await page.mouse.wheel(0, -100)
      await page.waitForTimeout(250)
      assert.equal(await content.isVisible(), false)
      const afterZoom = await camera()
      assert.notDeepEqual(afterZoom.position, before.position)
      await page.getByRole('button', { name: 'Mở bản đồ module', exact: true }).click()
      assert.equal(await content.isVisible(), true)
      assert.deepEqual(await camera(), afterZoom)
      await page.getByRole('button', { name: 'Thu gọn bản đồ module', exact: true }).click()
      await page.screenshot({ path: path.join(output, viewport.width + '-collapsed.png') })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
      assert.deepEqual(errors, [])
      results.push({ viewport, collapsed, expanded, keyboard: 'Enter + Space passed', cameraUnchangedByToggle: true, detachPreservesState: true, zoomPreservesState: true, errors })
      await page.close()
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
    console.log(JSON.stringify(results, null, 2))
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
