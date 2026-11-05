const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const output = '.agents/taife-merge'
const source = fs.readFileSync('.agents/dataset-3d-core/captures/capture-p0.cjs', 'utf8')
const start = source.indexOf('const HOOK =')
const end = source.indexOf('// Draw calls and triangles per sculptComponent')
const { HOOK, SCENE_HELPERS } = new Function(source.slice(start, end) + '\nreturn { HOOK, SCENE_HELPERS }')()

;(async () => {
  const browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-color-profile=srgb'],
  })
  const errors = []
  const results = []
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    page.on('pageerror', error => errors.push(String(error)))
    const response = await page.goto('http://localhost:5173/workspaces/3d-dataset', { waitUntil: 'load' })
    assert.equal(response.status(), 200)
    await page.waitForSelector('.dataset-3d-canvas canvas')
    await page.waitForTimeout(4000)
    assert.equal(await page.getByRole('heading', { name: 'Dataset 3D', exact: true }).count(), 1)
    const hook = await page.evaluate(HOOK)
    assert.equal(hook.scenes, 1)
    await page.evaluate(() => { window.__p0modelName = 'Holographic Orbital Data Core v2' })
    await page.evaluate(SCENE_HELPERS)
    const scene = await page.evaluate(() => {
      const root = window.__p0helpers.modelRoot()
      const runtime = root.userData.sculptRuntime
      return {
        towers: Object.keys(runtime.meshes).filter(id => id.startsWith('tower-')).sort(),
        glass: !!root.getObjectByName('spool-chamber-glass'),
        lower: !!root.getObjectByName('spool-base-glass'),
        heroes: (() => { let n = 0; root.traverse(object => { if (object.name === 'hero-glass-arms') n++ }); return n })(),
      }
    })
    assert.equal(scene.towers.length, 14)
    assert.equal(scene.heroes, 6)
    assert(scene.glass && scene.lower)
    assert(!scene.towers.some(id => ['tower-05', 'tower-06', 'tower-11', 'tower-15'].includes(id)))
    await page.getByRole('button', { name: 'Mở bản đồ module', exact: true }).click()
    await page.getByRole('button', { name: 'Thu gọn bản đồ module', exact: true }).click()
    await page.getByRole('button', { name: 'Tách mô hình', exact: true }).click()
    await page.getByRole('button', { name: 'Lắp lại mô hình', exact: true }).click()
    await page.screenshot({ path: path.join(output, 'dataset-3d.png') })
    results.push({ route: '/workspaces/3d-dataset', status: response.status(), scene, controls: 'passed' })
    for (const [route, heading] of [
      ['/preview/home', 'Khám phá vũ trụ dữ liệu của bạn'],
      ['/preview/workspaces', 'Workspaces'],
    ]) {
      const response = await page.goto('http://localhost:5173' + route, { waitUntil: 'load' })
      await page.getByRole('heading', { name: heading, exact: true }).waitFor()
      assert.equal(await page.locator('[data-preview="2d"]').count(), 1)
      assert.equal(await page.locator('.dataset-3d-canvas canvas').count(), 0)
      await page.screenshot({ path: path.join(output, route.split('/').pop() + '-2d.png') })
      results.push({ route, status: response.status(), heading })
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ results, errors }, null, 2) + '\n')
    console.log(JSON.stringify({ results, errors }, null, 2))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
