import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { NEON_CUBE, createNeonCubeModel } from './neon-cube.model'

type View = { azimuth: number; elevation: number }

const VIEWS: Record<string, View> = {
  '45': { azimuth: 45, elevation: 24 },
  '135': { azimuth: 135, elevation: 24 },
  '225': { azimuth: 225, elevation: 24 },
  '315': { azimuth: 315, elevation: 24 },
  top: { azimuth: 45, elevation: 60 },
}

const params = new URLSearchParams(window.location.search)
const viewName = params.get('angle') ?? '45'
const view = VIEWS[viewName] ?? VIEWS['45']
const viewDistance = viewName === 'top' ? NEON_CUBE.camera.distance * 1.15 : NEON_CUBE.camera.distance
const zoom = params.get('zoom')
if (params.get('ui') === '0') document.body.classList.add('ui-hidden')

function requireElement(id: string) {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Preview thiếu phần tử #${id}`)
  return element
}

const stage = requireElement('stage')
const status = requireElement('status')
const viewLabel = document.getElementById('view-label')
if (viewLabel) {
  viewLabel.textContent =
    zoom === 'base'
      ? 'base close-up · azimuth 45° / elevation 42°'
      : `azimuth ${view.azimuth}° / elevation ${view.elevation}°`
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setClearColor('#04010a', 1)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
stage.appendChild(renderer.domElement)

const numericParam = (key: string, fallback: number) => {
  const value = Number(params.get(key))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const scene = new THREE.Scene()
scene.background = new THREE.Color('#04010a')
scene.fog = new THREE.FogExp2('#060212', numericParam('fog', 0.012))

const camera = new THREE.PerspectiveCamera(numericParam('fov', NEON_CUBE.camera.fov), 1, 0.1, 100)
const target = new THREE.Vector3(
  NEON_CUBE.camera.target[0],
  numericParam('targetY', NEON_CUBE.camera.target[1]),
  NEON_CUBE.camera.target[2],
)
const distance =
  zoom === 'base' ? numericParam('distance', 12.6) : numericParam('distance', viewDistance)
const elevation = THREE.MathUtils.degToRad(zoom === 'base' ? 42 : numericParam('elevation', view.elevation))
const azimuth = THREE.MathUtils.degToRad(view.azimuth)
if (zoom === 'base') target.set(0, 0.16, 0)
camera.position.set(
  target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
  target.y + distance * Math.sin(elevation),
  target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
)
camera.lookAt(target)

function createFloorTexture() {
  const size = 1024
  const span = 30
  const cell = size / span
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null
  context.clearRect(0, 0, size, size)
  context.lineWidth = 1
  for (let index = 0; index <= span; index += 1) {
    const strong = index % 5 === 0
    context.strokeStyle = strong ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.18)'
    const offset = index * cell + 0.5
    context.beginPath()
    context.moveTo(offset, 0)
    context.lineTo(offset, size)
    context.stroke()
    context.beginPath()
    context.moveTo(0, offset)
    context.lineTo(size, offset)
    context.stroke()
  }
  context.globalCompositeOperation = 'destination-in'
  const fade = context.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size / 2)
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
  fade.addColorStop(0.55, 'rgba(0, 0, 0, 0.55)')
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = fade
  context.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

const floorTexture = createFloorTexture()
let floor: THREE.Mesh | null = null
if (floorTexture) {
  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({
      map: floorTexture,
      color: '#5a2bb0',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      fog: true,
    }),
  )
  floor.name = 'preview-floor'
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
}

const ambientLight = new THREE.AmbientLight('#341470', 0.35)
scene.add(ambientLight)

const keyLight = new THREE.PointLight('#b07bff', 1.5, 12, 2)
keyLight.position.set(-2.6, 3.4, 2.8)
scene.add(keyLight)

const rimLight = new THREE.PointLight('#ff4fd8', 0.15, 10, 2)
rimLight.position.set(-2.6, 1.4, -2.4)
scene.add(rimLight)

const underBaseLight = new THREE.PointLight('#b23cff', 1.8, 3, 2)
underBaseLight.position.set(0, 0.12, 0.85)
scene.add(underBaseLight)

const model = createNeonCubeModel()
scene.add(model.group)
;(window as unknown as Record<string, unknown>).__neonCubeScene = scene
;(window as unknown as Record<string, unknown>).__neonCubeRender = () => composer.render()

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const numberParam = (key: string, fallback: number) => {
  const value = Number(params.get(key))
  return Number.isFinite(value) && params.has(key) ? value : fallback
}
const bloom = new UnrealBloomPass(
  new THREE.Vector2(1, 1),
  numberParam('bloom', 0.05),
  numberParam('bloomRadius', 0.25),
  numberParam('bloomThreshold', 1.0),
)
composer.addPass(bloom)
composer.addPass(new OutputPass())

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.copy(target)
controls.enableDamping = false
controls.minDistance = 2
controls.maxDistance = 60
controls.minPolarAngle = THREE.MathUtils.degToRad(5)
controls.maxPolarAngle = THREE.MathUtils.degToRad(85)
controls.update()

const explodeParts = {
  innerBase: model.parts['base-inner'] as THREE.Group,
  outerCube: model.parts['cube-outer'] as THREE.Group,
  innerCube: model.parts['cube-inner'] as THREE.Group,
}
const collapsedOffsets = {
  innerBase: explodeParts.innerBase.position.y,
  outerCube: explodeParts.outerCube.position.y,
  innerCube: explodeParts.innerCube.position.y,
}
// Lifts stack the four primary parts along +Y: base-inner off the hole, cube-outer
// off its seat, and cube-inner clear above the glass shell.
const EXPLODE_LIFT = { innerBase: 0.42, outerCube: 0.62, innerCube: 0.92 }

function applyExplode(progress: number) {
  explodeParts.innerBase.position.y = collapsedOffsets.innerBase + EXPLODE_LIFT.innerBase * progress
  explodeParts.outerCube.position.y = collapsedOffsets.outerCube + EXPLODE_LIFT.outerCube * progress
  explodeParts.innerCube.position.y = collapsedOffsets.innerCube + EXPLODE_LIFT.innerCube * progress
}

type CameraFrame = { target: THREE.Vector3; distance: number }

const homeDirection = camera.position.clone().sub(target).normalize()
const homeFrame: CameraFrame = {
  target: target.clone(),
  distance: camera.position.distanceTo(target),
}

function measureExplodedFrame(): CameraFrame {
  applyExplode(1)
  const box = new THREE.Box3().setFromObject(model.group)
  applyExplode(0)
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
  return {
    target: new THREE.Vector3(0, sphere.center.y, 0),
    distance: (sphere.radius / Math.sin(halfFov)) * 1.12,
  }
}

const explodedFrame = measureExplodedFrame()
let explodeProgress = 0
let exploded = false
let clay = false
let animationId = 0

const explodeToggle = document.getElementById('explode-toggle') as HTMLButtonElement | null
const resetButton = document.getElementById('view-reset') as HTMLButtonElement | null

function updateViewLabel() {
  if (!viewLabel) return
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
  const azimuthDegrees = ((THREE.MathUtils.radToDeg(spherical.theta) % 360) + 360) % 360
  const elevationDegrees = 90 - THREE.MathUtils.radToDeg(spherical.phi)
  viewLabel.textContent = `azimuth ${Math.round(azimuthDegrees)}° / elevation ${Math.round(elevationDegrees)}°${
    exploded ? ' · tách khối' : ''
  }`
}

function renderStatus() {
  status.textContent = `${model.triangleCount.toLocaleString('vi-VN')} tam giác · ${model.drawCalls} draw call · ${
    exploded ? 'tách khối' : 'ghép khối'
  }${clay ? ' · clay' : ''}`
}

// Clay is a preview-only inspection mode: neutral matte shading, no neon, no bloom.
// It swaps materials on the same model so orbit/explode stay intact.
const originalMaterials = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>()
model.group.traverse((object) => {
  if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) originalMaterials.set(object, object.material)
})
const clayMaterial = new THREE.MeshStandardMaterial({
  color: '#c9c5be',
  roughness: 0.82,
  metalness: 0,
  side: THREE.DoubleSide,
})
const neonLights = [ambientLight, keyLight, rimLight, underBaseLight]
const clayAmbient = new THREE.AmbientLight('#ffffff', 1.5)
const clayKey = new THREE.DirectionalLight('#ffffff', 2.6)
clayKey.position.set(3.2, 5.2, 3.8)
const clayFill = new THREE.DirectionalLight('#ffffff', 0.85)
clayFill.position.set(-4, 2.4, -3.2)
const clayLights = [clayAmbient, clayKey, clayFill]
for (const light of clayLights) {
  light.visible = false
  scene.add(light)
}
const neonBackground = scene.background
const clayBackground = new THREE.Color('#232327')
const neonFog = scene.fog
const lightSheetsPart = model.parts['light-sheets']
const coreGlowPart = model.parts['core-glow']
const clayToggle = document.getElementById('clay-toggle') as HTMLButtonElement | null

function setClay(next: boolean) {
  if (next === clay) return
  clay = next
  for (const [object, material] of originalMaterials) {
    if (object instanceof THREE.Sprite) object.visible = !next
    else if (object instanceof THREE.Mesh) object.material = next ? clayMaterial : material
  }
  if (lightSheetsPart) lightSheetsPart.visible = !next
  if (coreGlowPart) coreGlowPart.visible = !next
  for (const light of neonLights) light.visible = !next
  for (const light of clayLights) light.visible = next
  if (floor) floor.visible = !next
  scene.background = next ? clayBackground : neonBackground
  scene.fog = next ? null : neonFog
  bloom.enabled = !next
  if (clayToggle) {
    clayToggle.textContent = next ? 'Neon' : 'Clay'
    clayToggle.setAttribute('aria-pressed', String(next))
  }
  renderStatus()
  composer.render()
}

function animateExplode(next: boolean) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const duration = reduceMotion ? 0 : 360
  const fromProgress = explodeProgress
  const toProgress = next ? 1 : 0
  const fromFrame: CameraFrame = {
    target: controls.target.clone(),
    distance: camera.position.distanceTo(controls.target),
  }
  const toFrame = next ? explodedFrame : homeFrame
  const direction = camera.position.clone().sub(controls.target).normalize()
  const startedAt = performance.now()
  cancelAnimationFrame(animationId)
  controls.enabled = false

  function step(now: number) {
    const raw = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration)
    const eased = 1 - (1 - raw) ** 3
    explodeProgress = fromProgress + (toProgress - fromProgress) * eased
    applyExplode(explodeProgress)
    const frameTarget = fromFrame.target.clone().lerp(toFrame.target, eased)
    const frameDistance = THREE.MathUtils.lerp(fromFrame.distance, toFrame.distance, eased)
    controls.target.copy(frameTarget)
    camera.position.copy(frameTarget).addScaledVector(direction, frameDistance)
    camera.lookAt(frameTarget)
    composer.render()
    if (raw < 1) {
      animationId = requestAnimationFrame(step)
      return
    }
    controls.target.copy(toFrame.target)
    camera.position.copy(toFrame.target).addScaledVector(direction, toFrame.distance)
    controls.update()
    controls.enabled = true
    updateViewLabel()
    composer.render()
  }

  animationId = requestAnimationFrame(step)
}

function setExploded(next: boolean) {
  if (next === exploded) return
  exploded = next
  if (explodeToggle) {
    explodeToggle.textContent = next ? 'Ghép lại' : 'Tách khối'
    explodeToggle.setAttribute('aria-pressed', String(next))
  }
  renderStatus()
  animateExplode(next)
}

function resetView() {
  cancelAnimationFrame(animationId)
  controls.enabled = true
  explodeProgress = exploded ? 1 : 0
  applyExplode(explodeProgress)
  const frame = exploded ? explodedFrame : homeFrame
  controls.target.copy(frame.target)
  camera.position.copy(frame.target).addScaledVector(homeDirection, frame.distance)
  camera.lookAt(frame.target)
  controls.update()
  updateViewLabel()
  composer.render()
}

explodeToggle?.addEventListener('click', () => setExploded(!exploded))
clayToggle?.addEventListener('click', () => setClay(!clay))
resetButton?.addEventListener('click', resetView)
if (params.get('clay') === '1') setClay(true)
window.addEventListener('keydown', (event) => {
  if (event.key === 'e' || event.key === 'E') setExploded(!exploded)
  if (event.key === 'r' || event.key === 'R') resetView()
})
controls.addEventListener('change', () => {
  composer.render()
  updateViewLabel()
})
updateViewLabel()

function resize() {
  const width = stage.clientWidth
  const height = stage.clientHeight
  if (width === 0 || height === 0) return
  renderer.setSize(width, height, false)
  composer.setSize(width, height)
  bloom.resolution.set(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

resize()

let frames = 0
function frame() {
  composer.render()
  frames += 1
  if (frames === 2) {
    document.body.classList.add('neon-cube-ready')
    renderStatus()
    ;(window as unknown as Record<string, unknown>).__neonCube = {
      ready: true,
      triangleCount: model.triangleCount,
      drawCalls: model.drawCalls,
      view: viewName,
      get exploded() {
        return exploded
      },
      get clay() {
        return clay
      },
      setExploded,
      setClay,
      resetView,
    }
  }
  if (frames < 2) requestAnimationFrame(frame)
}

window.addEventListener('resize', () => {
  resize()
  composer.render()
})

requestAnimationFrame(frame)
