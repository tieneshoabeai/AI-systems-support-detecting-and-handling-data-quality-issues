// Phase 0 image + metrics capture (CODE ARCHITECTURE IMPROVEMENT PLAN, items 0.1 and 0.2).
//
// Everything runs under prefers-reduced-motion, which is what makes the images comparable: scene.tsx
// sets controls.enableDamping = !reducedMotion, so with reduce on a drag lands on an exact camera
// pose and the model is frozen on its reset pose. The harness re-hashes every PNG into
// fingerprint/p0-images.sha256, so a later phase can be checked against these bytes.
//
// The renderer numbers are measured at the WebGL command level (drawElements/drawArrays) instead of
// from renderer.info, because three.js assigns `render` per renderer instance, so there is no
// prototype to hook without editing app source — and Phase 0 forbids editing app source. The
// per-part attribution comes from the LIVE scene graph, reached through
// Object3D.prototype.updateMatrixWorld, which three calls every frame.
//
// Usage (from src/frontend, dev server on 5173):
//   NODE_PATH=/Users/mac/.npm/_npx/e41f203b7505f1fb/node_modules node .agents/dataset-3d-core/captures/capture-p0.cjs
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { chromium } = require('playwright')

const ROOT = process.cwd()
const IMG_DIR = path.join(ROOT, '.agents/dataset-3d-core/captures/p0-baseline')
const FP_DIR = path.join(ROOT, '.agents/dataset-3d-core/fingerprint')
const APP_URL = 'http://localhost:5173/workspaces/3d-dataset'
const MODEL_NAME = 'Holographic Orbital Data Core v2'

const STATES = [
  { id: 'normal', detach: false, select: null },
  { id: 'detached', detach: true, select: null },
  { id: 'sel-tower-01', detach: true, select: 'tower-01-back-high' },
  { id: 'sel-tower-10', detach: true, select: 'tower-10' },
  // A Core part, so the panel path is covered on both sides of the refactor. The list is tried in
  // order and the one that was actually picked is written into the metrics.
  { id: 'sel-core', detach: true, select: ['core-cap-drum', 'core-mid-collar', 'core-foot', 'base-deck', 'core-upper'] },
]
const CAMERAS = [
  { id: 'hero', gesture: null },
  { id: 'orbit', gesture: { type: 'drag', dx: 240, dy: -70 } },
  { id: 'closeup', gesture: { type: 'wheel', dy: -700 } },
]

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function watch(page, errors) {
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(String(error)))
}

// Installed before any app script: counts real GL draw commands per animation frame, split by the
// framebuffer they land in, because "draw calls per frame" only means something once you know how
// many times the scene itself is drawn.
const GL_COUNTER = () => {
  const state = { frames: [], totalCalls: 0 }
  window.__p0gl = state
  let per = {}
  let bound = 'screen'
  const ids = new Map()
  const nameOf = framebuffer => {
    if (!framebuffer) return 'screen'
    let name = ids.get(framebuffer)
    if (!name) {
      name = `rt${ids.size}`
      ids.set(framebuffer, name)
    }
    return name
  }
  const bump = (n, t) => {
    const entry = per[bound] || (per[bound] = { calls: 0, tris: 0 })
    entry.calls += n
    entry.tris += t
  }
  const snapshot = () => {
    let calls = 0
    let tris = 0
    for (const entry of Object.values(per)) {
      calls += entry.calls
      tris += entry.tris
    }
    state.frames.push({ calls, tris, byTarget: per })
    if (state.frames.length > 240) state.frames.shift()
    state.totalCalls += calls
    per = {}
    requestAnimationFrame(snapshot)
  }
  requestAnimationFrame(snapshot)
  const protos = [window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype,
    window.WebGLRenderingContext && window.WebGLRenderingContext.prototype].filter(Boolean)
  // POINTS and LINES are drawn but produce no triangles, so counting their vertices as triangles
  // would report a geometry load that does not exist.
  const GL_TRIANGLES = 4, GL_TRIANGLE_STRIP = 5, GL_TRIANGLE_FAN = 6
  const tris = (mode, vertices) => {
    if (mode === GL_TRIANGLES) return vertices / 3
    if (mode === GL_TRIANGLE_STRIP || mode === GL_TRIANGLE_FAN) return Math.max(0, vertices - 2)
    return 0
  }
  for (const proto of protos) {
    const wrap = (name, tri) => {
      const original = proto[name]
      if (!original) return
      proto[name] = function (...args) { bump(1, tri(args)); return original.apply(this, args) }
    }
    wrap('drawElements', a => tris(a[0], a[1]))
    wrap('drawArrays', a => tris(a[0], a[2]))
    wrap('drawElementsInstanced', a => tris(a[0], a[1]) * a[4])
    wrap('drawArraysInstanced', a => tris(a[0], a[2]) * a[3])
    const originalBind = proto.bindFramebuffer
    if (originalBind) {
      proto.bindFramebuffer = function (target, framebuffer) {
        if (target === this.FRAMEBUFFER) bound = nameOf(framebuffer)
        return originalBind.call(this, target, framebuffer)
      }
    }
  }
}

// three assigns renderer.render per instance, but updateMatrixWorld is a real prototype method that
// the render loop calls on the scene and, because the R3F camera has no parent, on the camera too.
const HOOK = async () => {
  const url = performance.getEntriesByType('resource').map(e => e.name).find(n => /deps\/three\.js/.test(n))
  const THREE = await import(url)
  const original = THREE.Object3D.prototype.updateMatrixWorld
  const scenes = new Set()
  const cameras = new Set()
  THREE.Object3D.prototype.updateMatrixWorld = function updateMatrixWorld(force) {
    if (this.isScene) scenes.add(this)
    if (this.isCamera) cameras.add(this)
    return original.call(this, force)
  }
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  window.__p0 = { THREE, scene: [...scenes][0], camera: [...cameras][0] }
  // onBeforeRender is a prototype method three calls once per render item, and its first argument is
  // the renderer itself — which is the only way to reach renderer.info without editing app source,
  // because three assigns `render` per instance instead of per prototype.
  const originalBefore = THREE.Object3D.prototype.onBeforeRender
  THREE.Object3D.prototype.onBeforeRender = function onBeforeRender(...args) {
    if (!window.__p0renderer && args[0] && args[0].info) window.__p0renderer = args[0]
    const sink = window.__p0draws
    if (sink) {
      const key = this.name || this.type
      sink.counts[key] = (sink.counts[key] || 0) + 1
      sink.hits += 1
    }
    return originalBefore.apply(this, args)
  }
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  if (!window.__p0renderer) return { module: url, scenes: scenes.size, cameras: cameras.size, error: 'renderer never reported' }
  // Now `render` can be wrapped on the instance, so every pass can be read apart.
  const originalRender = window.__p0renderer.render
  window.__p0renderer.render = function render(scene, camera, target) {
    const result = originalRender.call(this, scene, camera, target)
    if (window.__p0samples) {
      window.__p0samples.push({ calls: this.info.render.calls, tris: this.info.render.triangles, toScreen: target ? 0 : 1 })
    }
    return result
  }
  return { module: url, scenes: scenes.size, cameras: cameras.size, cameraPosition: window.__p0.camera.position.toArray() }
}

const SCENE_HELPERS = () => {
  const componentId = object => {
    for (let current = object; current; current = current.parent) {
      const part = current.userData && current.userData.sculptComponent
      if (part && part.id) return part.id
    }
    return null
  }
  const isVisible = object => {
    for (let current = object; current; current = current.parent) if (!current.visible) return false
    return true
  }
  const modelRoot = () => window.__p0.scene.children.find(c => c.name === window.__p0modelName)
  window.__p0helpers = { componentId, isVisible, modelRoot }
}

// Find the screen pixel a real user would have to click to select `wanted`: project the part's own
// vertices, then raycast back and keep the first projection whose nearest pickable hit is the part.
const FIND_PIXEL = wanted => {
  const { THREE, camera } = window.__p0
  const { componentId, isVisible, modelRoot } = window.__p0helpers
  const root = modelRoot()
  root.updateMatrixWorld(true)
  const rect = document.querySelector('.dataset-3d-canvas canvas').getBoundingClientRect()
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const point = new THREE.Vector3()
  const nearestComponent = () => {
    ray.setFromCamera(ndc, camera)
    for (const hit of ray.intersectObject(root, true)) {
      if (!isVisible(hit.object)) continue
      const id = componentId(hit.object)
      if (id) return id
    }
    return null
  }
  const targets = Array.isArray(wanted) ? wanted : [wanted]
  for (const id of targets) {
    const meshes = []
    root.traverse(object => {
      if (object.isMesh && componentId(object) === id) meshes.push(object)
    })
    if (!meshes.length) continue
    const candidates = []
    for (const mesh of meshes) {
      const position = mesh.geometry && mesh.geometry.attributes.position
      if (!position) continue
      const stride = Math.max(1, Math.ceil(position.count / 90))
      for (let index = 0; index < position.count; index += stride) {
        point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld).project(camera)
        if (Math.abs(point.x) > 0.86 || Math.abs(point.y) > 0.86 || point.z >= 1) continue
        candidates.push([point.x, point.y])
      }
    }
    if (!candidates.length) continue
    // Nearest to the cluster centre first: that is where the part is most likely front-most.
    const mean = candidates.reduce((sum, c) => [sum[0] + c[0] / candidates.length, sum[1] + c[1] / candidates.length], [0, 0])
    candidates.sort((a, b) => (a[0] - mean[0]) ** 2 + (a[1] - mean[1]) ** 2 - ((b[0] - mean[0]) ** 2 + (b[1] - mean[1]) ** 2))
    for (const [x, y] of candidates.slice(0, 300)) {
      // Playwright clicks whole pixels, so the pick is validated at the whole pixel it will use.
      const px = Math.round(rect.x + (x + 1) / 2 * rect.width)
      const py = Math.round(rect.y + (1 - (y + 1) / 2) * rect.height)
      ndc.set((px - rect.x) / rect.width * 2 - 1, -((py - rect.y) / rect.height * 2 - 1))
      if (nearestComponent() !== id) continue
      // A pixel covered by the legend or the detach button is not clickable, so keep looking.
      const top = document.elementFromPoint(px, py)
      if (!top || top.tagName !== 'CANVAS') continue
      return { id, x: px, y: py }
    }
  }
  return null
}

// Draw calls and triangles per sculptComponent id, from the live scene graph.
const ATTRIBUTION = () => {
  const { componentId, isVisible, modelRoot } = window.__p0helpers
  const root = modelRoot()
  root.updateMatrixWorld(true)
  const byPart = new Map()
  const byTopLevel = new Map()
  const topOf = object => {
    let current = object
    while (current.parent && current.parent !== root) current = current.parent
    return current.name || current.type
  }
  const bump = (map, key, triangles, draws) => {
    const entry = map.get(key) || { drawables: 0, drawCalls: 0, triangles: 0 }
    entry.drawables += 1
    entry.drawCalls += draws
    entry.triangles += triangles
    map.set(key, entry)
  }
  // three splits one object into several GL calls only when it carries a material array; groups on a
  // single-material mesh are merged into one call.
  // Only an object with a material array is split into several buffer submissions; counting geometry
  // groups unconditionally over-counts (973 against a measured 476), so this stays an estimate of
  // how much of the frame the scene graph can explain, not a claim about GL calls.
  const drawsOf = object => {
    if (!Array.isArray(object.material)) return 1
    const groups = object.geometry && object.geometry.groups
    return groups && groups.length ? groups.length : object.material.length
  }
  // The scene holds more than the model: the star field, the neon-cube cluster and the environment
  // mesh are siblings of it, and they are part of what the renderer actually submits.
  const scene = window.__p0.scene
  scene.updateMatrixWorld(true)
  const insideModel = object => {
    for (let current = object; current; current = current.parent) if (current === root) return true
    return false
  }
  scene.traverse(object => {
    const drawable = object.isMesh || object.isLine || object.isLineSegments || object.isPoints || object.isSprite
    if (!drawable || !isVisible(object)) return
    const geometry = object.geometry
    const position = geometry && geometry.attributes.position
    const raw = geometry && geometry.index ? geometry.index.count / 3 : position ? position.count / 3 : 0
    const solid = !(object.isLine || object.isLineSegments || object.isPoints || object.isSprite)
    const triangles = solid ? raw * (object.isInstancedMesh ? object.count : 1) : 0
    const key = insideModel(object) ? (componentId(object) || 'no-part') : 'outside-model'
    bump(byPart, key, triangles, drawsOf(object))
    bump(byTopLevel, insideModel(object) ? topOf(object) : 'outside-model', triangles, drawsOf(object))
  })
  const sum = (map, pick) => [...map.values()].reduce((total, entry) => total + pick(entry), 0)
  const groupDraws = pattern => [...byPart.entries()]
    .filter(([id]) => pattern.test(id))
    .reduce((total, [, entry]) => total + entry.drawCalls, 0)
  return {
    totalDrawables: sum(byPart, entry => entry.drawables),
    totalDrawCalls: sum(byPart, entry => entry.drawCalls),
    totalTriangles: Math.round(sum(byPart, entry => entry.triangles)),
    modelOnly: groupDraws(/^(?!outside-model$).*/),
    towers: groupDraws(/tower/),
    core: groupDraws(/^(core|spool)/),
    base: groupDraws(/^base/),
    noPart: groupDraws(/^no-part$/),
    outsideModel: groupDraws(/^outside-model$/),
    topLevel: [...byTopLevel.entries()].map(([name, entry]) => ({ name, ...entry, triangles: Math.round(entry.triangles) }))
      .sort((a, b) => b.drawables - a.drawables),
    byPart: [...byPart.entries()].map(([id, entry]) => ({ id, ...entry, triangles: Math.round(entry.triangles) }))
      .sort((a, b) => b.drawables - a.drawables),
  }
}

async function frameStats(page) {
  const frames = await page.evaluate(() => window.__p0gl.frames.slice(-90))
  const calls = frames.map(frame => frame.calls)
  const targets = {}
  for (const key of [...new Set(frames.flatMap(frame => Object.keys(frame.byTarget)))].sort()) {
    const value = frame => frame.byTarget[key] || { calls: 0, tris: 0 }
    targets[key] = {
      callsPerFrame: median(frames.map(frame => value(frame).calls)),
      trianglesPerFrame: Math.round(median(frames.map(frame => value(frame).tris))),
    }
  }
  return {
    callsPerFrame: median(calls),
    trianglesPerFrame: median(frames.map(frame => frame.tris)),
    minCalls: Math.min(...calls),
    maxCalls: Math.max(...calls),
    samples: frames.length,
    byTarget: targets,
  }
}

// Count three's own render items over a fixed number of animation frames.
async function drawCounts(page, frames = 60) {
  await page.evaluate(count => {
    window.__p0draws = { counts: {}, hits: 0, frames: 0, target: count, done: false }
    const tick = () => {
      window.__p0draws.frames += 1
      if (window.__p0draws.frames >= window.__p0draws.target) window.__p0draws.done = true
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, frames)
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await page.evaluate(() => window.__p0draws.done)) break
    await page.waitForTimeout(250)
  }
  const raw = await page.evaluate(() => ({ counts: window.__p0draws.counts, hits: window.__p0draws.hits, frames: window.__p0draws.frames }))
  const per = Math.max(1, raw.frames)
  return {
    frames: raw.frames,
    renderItemsPerFrame: +(raw.hits / per).toFixed(2),
    byName: Object.entries(raw.counts)
      .map(([name, count]) => ({ name, perFrame: +(count / per).toFixed(2) }))
      .sort((a, b) => b.perFrame - a.perFrame || a.name.localeCompare(b.name)),
  }
}

// renderer.info, the number the plan asks for, sampled over a window of animation frames.
async function rendererStats(page) {
  await page.evaluate(() => {
    window.__p0samples = []
    window.__p0ticks = 0
    const tick = () => {
      window.__p0ticks += 1
      if (window.__p0samples) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.waitForTimeout(2000)
  const raw = await page.evaluate(() => {
    const out = {
      samples: window.__p0samples.slice(),
      ticks: window.__p0ticks,
      memory: { ...window.__p0renderer.info.memory },
      programs: window.__p0renderer.info.programs.length,
      capabilities: { maxTextures: window.__p0renderer.capabilities.maxTextures, isWebGL2: window.__p0renderer.capabilities.isWebGL2 },
      shadows: window.__p0renderer.shadowMap.enabled,
      toneMapping: window.__p0renderer.toneMapping,
      autoClear: window.__p0renderer.autoClear,
    }
    window.__p0samples = null
    return out
  })
  const frames = Math.max(1, raw.ticks)
  return {
    renderPassesPerFrame: +(raw.samples.length / frames).toFixed(2),
    callsPerFrame: Math.round(raw.samples.reduce((total, s) => total + s.calls, 0) / frames),
    trianglesPerFrame: Math.round(raw.samples.reduce((total, s) => total + s.tris, 0) / frames),
    maxCallsPerPass: raw.samples.length ? Math.max(...raw.samples.map(s => s.calls)) : 0,
    frames,
    passes: raw.samples.length,
    memory: raw.memory,
    programs: raw.programs,
    renderer: { shadows: raw.shadows, toneMapping: raw.toneMapping, autoClear: raw.autoClear, ...raw.capabilities },
  }
}

async function applyGesture(page, gesture, center) {
  if (!gesture) return
  await page.mouse.move(center.x, center.y)
  if (gesture.type === 'drag') {
    await page.mouse.down()
    await page.mouse.move(center.x + gesture.dx, center.y + gesture.dy, { steps: 20 })
    await page.mouse.up()
  } else {
    await page.mouse.wheel(0, gesture.dy)
  }
  await page.waitForTimeout(700)
}

;(async () => {
  if (!fs.existsSync(path.join(ROOT, '.agents/dataset-3d-core'))) throw new Error('run from src/frontend')
  fs.mkdirSync(IMG_DIR, { recursive: true })
  fs.mkdirSync(FP_DIR, { recursive: true })

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-color-profile=srgb'],
  })
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  await context.addInitScript(GL_COUNTER)
  const page = await context.newPage()
  watch(page, errors)
  await page.goto(APP_URL, { waitUntil: 'load' })
  await page.waitForSelector('.dataset-3d-canvas canvas', { timeout: 30000 })
  await page.waitForTimeout(8000)

  const hook = await page.evaluate(HOOK)
  await page.evaluate(name => { window.__p0modelName = name }, MODEL_NAME)
  await page.evaluate(SCENE_HELPERS)
  if (hook.scenes !== 1 || hook.cameras !== 1) throw new Error(`scene/camera hook: ${JSON.stringify(hook)}`)
  const canvasBox = await page.locator('.dataset-3d-canvas canvas').boundingBox()
  const center = { x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y + canvasBox.height / 2 }

  const detachButton = page.getByRole('button', { name: 'Tách mô hình' })
  const attachButton = page.getByRole('button', { name: 'Lắp lại mô hình' })
  const setDetached = async wanted => {
    if (wanted && (await detachButton.count())) { await detachButton.click(); await page.waitForTimeout(900) }
    if (!wanted && (await attachButton.count())) { await attachButton.click(); await page.waitForTimeout(900) }
  }
  const clearSelection = async () => {
    const close = page.getByRole('button', { name: 'Đóng bảng thông tin' })
    if (await close.count()) { await close.click(); await page.waitForTimeout(400) }
  }
  const panelPartId = () => page.locator('#dataset-3d-part-panel').getAttribute('data-part-id')

  const metrics = { context: 'reducedMotion=reduce, viewport 1280x900, deviceScaleFactor 1', hook, states: {}, shots: {} }

  // Renderer numbers for the two poses the plan asks about.
  metrics.states.attached = {
    ...await frameStats(page),
    renderer: await rendererStats(page),
    draws: await drawCounts(page),
    scene: await page.evaluate(ATTRIBUTION),
  }
  await setDetached(true)
  metrics.states.detached = {
    ...await frameStats(page),
    renderer: await rendererStats(page),
    draws: await drawCounts(page),
    scene: await page.evaluate(ATTRIBUTION),
  }
  await setDetached(false)

  const manifest = []
  for (const camera of CAMERAS) {
    await applyGesture(page, camera.gesture, center)
    for (const state of STATES) {
      await setDetached(state.detach)
      await clearSelection()
      let pick = null
      if (state.select) {
        pick = await page.evaluate(FIND_PIXEL, state.select)
        if (!pick) throw new Error(`nothing to click for ${JSON.stringify(state.select)} from camera ${camera.id}`)
        await page.mouse.click(Math.round(pick.x), Math.round(pick.y))
        await page.waitForTimeout(400)
        const shown = await panelPartId()
        if (shown !== pick.id) throw new Error(`camera ${camera.id}: clicked ${pick.id}, panel says ${shown}`)
      }
      const file = path.join(IMG_DIR, `p0-${state.id}-${camera.id}.png`)
      await page.screenshot({ path: file })
      manifest.push(`${sha256(file)}  ${path.basename(file)}`)
      metrics.shots[`${state.id}/${camera.id}`] = {
        picked: pick && pick.id,
        pixel: pick && [Math.round(pick.x - canvasBox.x), Math.round(pick.y - canvasBox.y)],
      }
      console.log(`shot p0-${state.id}-${camera.id}.png pick=${pick ? pick.id : '-'}`)
    }
    // Each camera gesture starts from the hero pose, so undo it before the next one.
    if (camera.gesture) await applyGesture(page, camera.gesture.type === 'drag'
      ? { type: 'drag', dx: -camera.gesture.dx, dy: -camera.gesture.dy }
      : { type: 'wheel', dy: -camera.gesture.dy }, center)
  }

  fs.writeFileSync(path.join(FP_DIR, 'p0-images.sha256'), `${manifest.join('\n')}\n`, 'utf8')

  // One frame with motion and bloom on, for the eye only: it is not byte-stable, so it stays out of
  // the manifest.
  const motionContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  await motionContext.addInitScript(GL_COUNTER)
  const motionPage = await motionContext.newPage()
  watch(motionPage, errors)
  await motionPage.goto(APP_URL, { waitUntil: 'load' })
  await motionPage.waitForSelector('.dataset-3d-canvas canvas', { timeout: 30000 })
  await motionPage.waitForTimeout(9000)
  await motionPage.screenshot({ path: path.join(IMG_DIR, 'p0-motion-reference.png') })
  metrics.states.animated = await frameStats(motionPage)
  await motionContext.close()
  await context.close()
  await browser.close()

  metrics.errors = errors
  fs.writeFileSync(path.join(FP_DIR, 'p0-metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`, 'utf8')

  const a = metrics.states.attached
  const d = metrics.states.detached
  const targetLine = stats => Object.entries(stats.byTarget)
    .map(([name, entry]) => `${name}=${entry.callsPerFrame}`).join(' ')
  console.log([
    `attached  gl/frame ${a.callsPerFrame} calls, ${a.trianglesPerFrame} tris (min ${a.minCalls} max ${a.maxCalls}, n ${a.samples})`,
    `          per framebuffer: ${targetLine(a)}`,
    `          renderer.info: ${a.renderer.callsPerFrame} calls, ${a.renderer.trianglesPerFrame} tris in ${a.renderer.renderPassesPerFrame} passes/frame; geometries ${a.renderer.memory.geometries} textures ${a.renderer.memory.textures} programs ${a.renderer.programs}`,
    `          three render items/frame ${a.draws.renderItemsPerFrame} over ${a.draws.frames} frames; top: ${a.draws.byName.slice(0, 5).map(x => `${x.name}=${x.perFrame}`).join(', ')}`,
    `          scene walk: ${a.scene.totalDrawables} visible drawables (${a.scene.modelOnly} model + ${a.scene.outsideModel} outside), est. ${a.scene.totalDrawCalls} calls, ${a.scene.totalTriangles} tris`,
    `          towers ${a.scene.towers}  core ${a.scene.core}  base ${a.scene.base}  no-part ${a.scene.noPart}`,
    `detached  gl/frame ${d.callsPerFrame} calls, ${d.trianglesPerFrame} tris; renderer.info ${d.renderer.callsPerFrame}/${d.renderer.trianglesPerFrame}, geometries ${d.renderer.memory.geometries}`,
    `          per framebuffer: ${targetLine(d)}`,
    `animated  gl/frame ${metrics.states.animated.callsPerFrame} calls, ${metrics.states.animated.trianglesPerFrame} tris`,
    `          per framebuffer: ${targetLine(metrics.states.animated)}`,
    `top level: ${a.scene.topLevel.slice(0, 8).map(x => `${x.name}=${x.drawCalls}`).join(', ')}`,
    `console errors: ${errors.length ? errors.join(' | ') : 'none'}`,
  ].join('\n'))
})().catch(error => {
  console.error(error)
  process.exit(1)
})
