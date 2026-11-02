import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export const NEON_CUBE = {
  baseSide: 2,
  baseHeight: 0.16,
  baseCornerRadius: 0.06,
  extrusionDepth: 0.12,
  baseBevel: 0.02,
  holeSide: 1.64,
  holeCornerRadius: 0.04,
  innerBaseSide: 1.48,
  innerBaseHeight: 0.14,
  innerBaseCornerRadius: 0.04,
  platformStep: 0.02,
  cubeSide: 1.32,
  cubeBottomY: 0.14,
  cubeCenterY: 0.8,
  cubeTopY: 1.46,
  cubeHalf: 0.66,
  coreSide: 0.88,
  coreCenterY: 0.8,
  coreBottomY: 0.36,
  coreTopY: 1.24,
  coreGap: 0.22,
  paneSize: 0.424,
  paneThickness: 0.02,
  panePitch: 0.436,
  paneGap: 0.012,
  paneCenterRadius: 0.65,
  paneCount: 54,
  seamBarSize: 0.006,
  seamBarLength: 1.308,
  seamOffset: 0.218,
  seamCenterRadius: 0.666,
  seamCount: 24,
  outerEdgeRod: 0.01,
  outerEdgeCount: 12,
  innerEdgeRod: 0.007,
  innerEdgeCount: 12,
  cornerSize: 0.03,
  cornerCount: 8,
  lightSheetWidth: 2,
  lightSheetHeight: 0.44,
  lightSheetThickness: 0.004,
  lightSheetBottomY: 0.16,
  lightSheetOffset: 1.026,
  lightSheetCount: 4,
  rimOuterRadius: 0.009,
  rimHoleRadius: 0.007,
  rimInnerRadius: 0.007,
  rimOuterY: 0.16,
  rimHoleY: 0.16,
  rimInnerY: 0.14,
  glowSpriteSize: 0.3,
  neonLinear: [1.35, 1.15, 1.85] as const,
  camera: {
    fov: 8,
    distance: 20,
    azimuth: 45,
    elevation: 24,
    target: [0, 0.6, 0] as const,
  },
} as const

export type NeonCubeThemeId = 'violet' | 'cyan' | 'orange' | 'blue'

export type NeonCubeTheme = {
  id: NeonCubeThemeId
  pane: string
  paneEmissive: string
  base: string
  baseEmissive: string
  baseInner: string
  baseInnerEmissive: string
  core: string
  coreEmissive: string
  glow: string
  neonLinear: readonly [number, number, number]
  lightSheet: readonly [number, number, number]
}

export const NEON_CUBE_THEMES: Record<NeonCubeThemeId, NeonCubeTheme> = {
  violet: {
    id: 'violet',
    pane: '#6e1eff',
    paneEmissive: '#6e1eff',
    base: '#5614c8',
    baseEmissive: '#5614c8',
    baseInner: '#170528',
    baseInnerEmissive: '#0a0212',
    core: '#8b3dff',
    coreEmissive: '#a83cff',
    glow: '#b36bff',
    neonLinear: [1.35, 1.15, 1.85],
    lightSheet: [0.75, 0.38, 1.35],
  },
  cyan: {
    id: 'cyan',
    pane: '#00b8e6',
    paneEmissive: '#00e5ff',
    base: '#007a99',
    baseEmissive: '#00aacc',
    baseInner: '#03232c',
    baseInnerEmissive: '#001014',
    core: '#00d9ff',
    coreEmissive: '#7af7ff',
    glow: '#7af7ff',
    neonLinear: [0.2, 1.55, 1.9],
    lightSheet: [0.18, 0.95, 1.3],
  },
  orange: {
    id: 'orange',
    pane: '#ff7a1a',
    paneEmissive: '#ff9a3c',
    base: '#a83200',
    baseEmissive: '#d94a00',
    baseInner: '#2a0a02',
    baseInnerEmissive: '#140400',
    core: '#ffb347',
    coreEmissive: '#ff7a1a',
    glow: '#ffb347',
    neonLinear: [2, 0.85, 0.2],
    lightSheet: [1.3, 0.5, 0.12],
  },
  blue: {
    id: 'blue',
    pane: '#2f6bff',
    paneEmissive: '#5b8cff',
    base: '#1236a8',
    baseEmissive: '#2f6bff',
    baseInner: '#050d28',
    baseInnerEmissive: '#01030f',
    core: '#2f6bff',
    coreEmissive: '#5b8cff',
    glow: '#5b8cff',
    neonLinear: [0.25, 0.75, 2.2],
    lightSheet: [0.18, 0.5, 1.3],
  },
}

export type NeonCubeModel = {
  group: THREE.Group
  parts: Record<string, THREE.Object3D>
  materials: Record<string, THREE.Material>
  theme: NeonCubeTheme
  triangleCount: number
  drawCalls: number
  dispose(): void
}

export type NeonCubeOptions = {
  theme?: NeonCubeThemeId | NeonCubeTheme
}

type Vec3 = readonly [number, number, number]
type ThemeLinear = readonly [number, number, number]
type Hotspot = { x: number; z: number; radius: number; strength: number }

const UNIT_SCALE = new THREE.Vector3(1, 1, 1)

// Intensity multipliers normalise the spec's local overrides against the 2.1 outer-rim value.
const RIM_OUTER_MULTIPLIER = 1
const RIM_HOLE_MULTIPLIER = 2.6 / 2.1
const RIM_INNER_MULTIPLIER = 2.2 / 2.1
const SEAM_MULTIPLIER = 1.4 / 2.1
const OUTER_EDGE_MULTIPLIER = 2.9 / 2.1
const INNER_EDGE_MULTIPLIER = 3.2 / 2.1
const CORNER_MULTIPLIER = 3.4 / 2.1

function transformMatrix(position: Vec3, rotation: Vec3 = [0, 0, 0]) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    UNIT_SCALE,
  )
}

function roundedSquareShape(half: number, radius: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-half + radius, -half)
  shape.lineTo(half - radius, -half)
  shape.quadraticCurveTo(half, -half, half, -half + radius)
  shape.lineTo(half, half - radius)
  shape.quadraticCurveTo(half, half, half - radius, half)
  shape.lineTo(-half + radius, half)
  shape.quadraticCurveTo(-half, half, -half, half - radius)
  shape.lineTo(-half, -half + radius)
  shape.quadraticCurveTo(-half, -half, -half + radius, -half)
  return shape
}

function paintGeometry(geometry: THREE.BufferGeometry, multiplier: number, linear: ThemeLinear, hotspot?: Hotspot) {
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index += 1) {
    let boost = 1
    if (hotspot) {
      const distance = Math.hypot(position.getX(index) - hotspot.x, position.getZ(index) - hotspot.z)
      if (distance < hotspot.radius) boost = 1 + hotspot.strength * (1 - distance / hotspot.radius)
    }
    colors[index * 3] = linear[0] * multiplier * boost
    colors[index * 3 + 1] = linear[1] * multiplier * boost
    colors[index * 3 + 2] = linear[2] * multiplier * boost
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

function coloredBox(width: number, height: number, depth: number, position: Vec3, rotation: Vec3) {
  const geometry = new THREE.BoxGeometry(width, height, depth)
  geometry.applyMatrix4(transformMatrix(position, rotation))
  return geometry
}

function mergePainted(geometries: THREE.BufferGeometry[], multiplier: number, linear: ThemeLinear, hotspot?: Hotspot) {
  for (const geometry of geometries) paintGeometry(geometry, multiplier, linear, hotspot)
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) throw new Error('Không gộp được geometry neon')
  return merged
}

function createBaseOuterGeometry() {
  const shape = roundedSquareShape(NEON_CUBE.baseSide / 2, NEON_CUBE.baseCornerRadius)
  shape.holes.push(roundedSquareShape(NEON_CUBE.holeSide / 2, NEON_CUBE.holeCornerRadius))
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: NEON_CUBE.extrusionDepth,
    bevelEnabled: true,
    bevelThickness: NEON_CUBE.baseBevel,
    bevelSize: NEON_CUBE.baseBevel,
    bevelOffset: 0,
    bevelSegments: 4,
    curveSegments: 12,
  })
  // Extrude spans -bevel..depth+bevel on Z; rotate onto +Y and lift so the slab fills 0..0.16.
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, NEON_CUBE.baseBevel, 0)
  geometry.computeVertexNormals()
  return geometry
}

function createRimGeometry(
  half: number,
  cornerRadius: number,
  tubeRadius: number,
  linear: ThemeLinear,
  multiplier: number,
  hotspot?: Hotspot,
) {
  const points = roundedSquareShape(half, cornerRadius).getPoints(24)
  if (points.length > 1 && points[0].distanceTo(points[points.length - 1]) < 1e-6) points.pop()
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, 0, point.y)),
    true,
    'centripetal',
  )
  const geometry = new THREE.TubeGeometry(curve, 96, tubeRadius, 6, true)
  paintGeometry(geometry, multiplier, linear, hotspot)
  return geometry
}

function createGlowTexture() {
  const size = 256
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      // Neutral white core: the sprite material colour tints it per theme.
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.28, 'rgba(255, 255, 255, 0.8)')
      gradient.addColorStop(0.62, 'rgba(255, 255, 255, 0.28)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    }
  }
  const fallbackSize = 64
  const data = new Uint8Array(fallbackSize * fallbackSize * 4)
  const center = (fallbackSize - 1) / 2
  for (let y = 0; y < fallbackSize; y += 1) {
    for (let x = 0; x < fallbackSize; x += 1) {
      const distance = Math.hypot(x - center, y - center) / center
      const alpha = Math.max(0, 1 - distance) ** 2
      const offset = (y * fallbackSize + x) * 4
      data[offset] = 255
      data[offset + 1] = 255
      data[offset + 2] = 255
      data[offset + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new THREE.DataTexture(data, fallbackSize, fallbackSize, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createLightSheetTexture() {
  const width = 16
  const height = 256
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context) {
      // v=0 is the base: a sharp emitter line that diffuses upward into haze.
      const gradient = context.createLinearGradient(0, height, 0, 0)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.02, 'rgba(255, 255, 255, 0.9)')
      gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.55)')
      gradient.addColorStop(0.32, 'rgba(255, 255, 255, 0.18)')
      gradient.addColorStop(0.65, 'rgba(255, 255, 255, 0.05)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      // Discrete vertical streaks read as sharp rays inside the soft haze.
      context.globalCompositeOperation = 'lighter'
      for (const [index, u] of [0.12, 0.28, 0.44, 0.6, 0.74, 0.88].entries()) {
        const ray = context.createLinearGradient(0, height, 0, 0)
        ray.addColorStop(0, 'rgba(255, 255, 255, 0.5)')
        ray.addColorStop(0.32, 'rgba(255, 255, 255, 0.16)')
        ray.addColorStop(1, 'rgba(255, 255, 255, 0)')
        context.fillStyle = ray
        context.fillRect(u * width, 0, index % 2 === 0 ? 1 : 2, height)
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    }
  }
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1)
    const falloff = v < 0.02 ? 1 : Math.max(0, 1 - v) ** 2.4
    for (let x = 0; x < width; x += 1) {
      const ray = 0.78 + 0.22 * Math.sin((x / width) * Math.PI * 7) ** 2
      const alpha = falloff * ray
      const offset = (y * width + x) * 4
      data[offset] = 255
      data[offset + 1] = 255
      data[offset + 2] = 255
      data[offset + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function buildPanes(material: THREE.Material) {
  const geometry = new RoundedBoxGeometry(NEON_CUBE.paneSize, NEON_CUBE.paneThickness, NEON_CUBE.paneSize, 2, 0.004)
  const mesh = new THREE.InstancedMesh(geometry, material, NEON_CUBE.paneCount)
  const offsets = [-NEON_CUBE.panePitch, 0, NEON_CUBE.panePitch]
  const radius = NEON_CUBE.paneCenterRadius
  const faces: Array<{ rotation: Vec3; map: (a: number, b: number) => Vec3 }> = [
    { rotation: [Math.PI / 2, 0, 0], map: (a, b) => [a, b, radius] },
    { rotation: [Math.PI / 2, 0, 0], map: (a, b) => [a, b, -radius] },
    { rotation: [0, 0, -Math.PI / 2], map: (a, b) => [radius, a, b] },
    { rotation: [0, 0, -Math.PI / 2], map: (a, b) => [-radius, a, b] },
    { rotation: [0, 0, 0], map: (a, b) => [a, radius, b] },
    { rotation: [0, 0, 0], map: (a, b) => [a, -radius, b] },
  ]
  let instance = 0
  for (const face of faces) {
    for (const offsetA of offsets) {
      for (const offsetB of offsets) {
        mesh.setMatrixAt(instance, transformMatrix(face.map(offsetA, offsetB), face.rotation))
        const noise = Math.sin(instance * 127.1 + 311.7) * 43758.5453
        const factor = 0.94 + (noise - Math.floor(noise)) * 0.12
        mesh.setColorAt(instance, new THREE.Color(factor, factor, factor))
        instance += 1
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  return mesh
}

function buildSeams(linear: ThemeLinear) {
  const geometries: THREE.BufferGeometry[] = []
  const length = NEON_CUBE.seamBarLength
  const bar = NEON_CUBE.seamBarSize
  const offset = NEON_CUBE.seamOffset
  const radius = NEON_CUBE.seamCenterRadius
  for (const sign of [1, -1]) {
    for (const line of [1, -1]) {
      // front/back faces: bars along X and Y
      geometries.push(coloredBox(length, bar, bar, [0, line * offset, sign * radius], [0, 0, 0]))
      geometries.push(coloredBox(length, bar, bar, [line * offset, 0, sign * radius], [0, 0, Math.PI / 2]))
      // left/right faces: bars along Z and Y
      geometries.push(coloredBox(length, bar, bar, [sign * radius, line * offset, 0], [0, Math.PI / 2, 0]))
      geometries.push(coloredBox(length, bar, bar, [sign * radius, 0, line * offset], [0, 0, Math.PI / 2]))
      // top/bottom faces: bars along X and Z
      geometries.push(coloredBox(length, bar, bar, [0, sign * radius, line * offset], [0, 0, 0]))
      geometries.push(coloredBox(length, bar, bar, [line * offset, sign * radius, 0], [0, Math.PI / 2, 0]))
    }
  }
  return mergePainted(geometries, SEAM_MULTIPLIER, linear)
}

function buildEdgeFrame(side: number, rod: number, multiplier: number, linear: ThemeLinear) {
  const geometries: THREE.BufferGeometry[] = []
  const half = side / 2
  for (const a of [1, -1]) {
    for (const b of [1, -1]) {
      geometries.push(coloredBox(side, rod, rod, [0, a * half, b * half], [0, 0, 0]))
      geometries.push(coloredBox(side, rod, rod, [a * half, 0, b * half], [0, 0, Math.PI / 2]))
      geometries.push(coloredBox(side, rod, rod, [a * half, b * half, 0], [0, Math.PI / 2, 0]))
    }
  }
  return mergePainted(geometries, multiplier, linear)
}

function buildCornerMarkers(inset: number, surfaceY: number, linear: ThemeLinear) {
  const geometries: THREE.BufferGeometry[] = []
  const size = NEON_CUBE.cornerSize
  const centerY = surfaceY + size / 2 - 0.001
  for (const x of [1, -1]) {
    for (const z of [1, -1]) {
      geometries.push(coloredBox(size, size, size, [x * inset, centerY, z * inset], [0, 0, 0]))
    }
  }
  return mergePainted(geometries, CORNER_MULTIPLIER, linear)
}

function buildLightSheets() {
  const geometries: THREE.BufferGeometry[] = []
  const offset = NEON_CUBE.lightSheetOffset
  const height = NEON_CUBE.lightSheetHeight
  const width = NEON_CUBE.lightSheetWidth
  const thickness = NEON_CUBE.lightSheetThickness
  const centerY = NEON_CUBE.lightSheetBottomY + height / 2
  // FrontSide keeps the 4 mm sheet from stacking its two coincident faces additively.
  for (const sign of [1, -1]) {
    geometries.push(new THREE.BoxGeometry(width, height, thickness).translate(0, centerY, sign * offset))
    geometries.push(new THREE.BoxGeometry(thickness, height, width).translate(sign * offset, centerY, 0))
  }
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) throw new Error('Không gộp được geometry tấm sáng')
  return merged
}

function resolveTheme(theme?: NeonCubeThemeId | NeonCubeTheme): NeonCubeTheme {
  if (!theme) return NEON_CUBE_THEMES.violet
  return typeof theme === 'string' ? NEON_CUBE_THEMES[theme] : theme
}

export function createNeonCubeModel(options: NeonCubeOptions = {}): NeonCubeModel {
  const theme = resolveTheme(options.theme)
  const group = new THREE.Group()
  group.name = 'neon-glass-cube'
  group.userData.partId = 'root'

  const glassPanel = new THREE.MeshPhysicalMaterial({
    color: theme.pane,
    emissive: theme.paneEmissive,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.5,
    toneMapped: false,
  })
  const glassBase = new THREE.MeshPhysicalMaterial({
    color: theme.base,
    emissive: theme.baseEmissive,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.88,
    depthWrite: true,
    side: THREE.FrontSide,
    roughness: 0.18,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.5,
  })
  // The small base reads as a near-black violet plinth, darker than the outer ring.
  const glassBaseInner = new THREE.MeshPhysicalMaterial({
    color: theme.baseInner,
    emissive: theme.baseInnerEmissive,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
    side: THREE.FrontSide,
    roughness: 0.24,
    metalness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.45,
  })
  const neonEdge = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const coreGlass = new THREE.MeshPhysicalMaterial({
    color: theme.core,
    emissive: theme.coreEmissive,
    emissiveIntensity: 1.15,
    transparent: true,
    opacity: 0.9,
    depthWrite: true,
    side: THREE.FrontSide,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.5,
  })
  const glowTexture = createGlowTexture()
  const glowSprite = new THREE.SpriteMaterial({
    map: glowTexture,
    color: theme.glow,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const lightSheetTexture = createLightSheetTexture()
  const lightSheetMaterial = new THREE.MeshBasicMaterial({
    map: lightSheetTexture,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  })
  lightSheetMaterial.color.setRGB(...theme.lightSheet)

  const baseOuter = new THREE.Group()
  baseOuter.name = 'base-outer'
  baseOuter.userData.partId = 'base-outer'
  group.add(baseOuter)

  const baseOuterMesh = new THREE.Mesh(createBaseOuterGeometry(), glassBase)
  baseOuterMesh.name = 'base-outer-shell'
  baseOuterMesh.userData.partId = 'base-outer'
  baseOuter.add(baseOuterMesh)

  const rimOuterMesh = new THREE.Mesh(
    mergeGeometries(
      [
        createRimGeometry(
          NEON_CUBE.baseSide / 2,
          NEON_CUBE.baseCornerRadius,
          NEON_CUBE.rimOuterRadius,
          theme.neonLinear,
          RIM_OUTER_MULTIPLIER,
          {
            x: 0.94,
            z: 0.94,
            radius: 0.28,
            strength: CORNER_MULTIPLIER - 1,
          },
        ),
        createRimGeometry(
          NEON_CUBE.holeSide / 2,
          NEON_CUBE.holeCornerRadius,
          NEON_CUBE.rimHoleRadius,
          theme.neonLinear,
          RIM_HOLE_MULTIPLIER,
        ),
      ],
      false,
    ),
    neonEdge,
  )
  if (!rimOuterMesh.geometry) throw new Error('Không dựng được viền neon đế ngoài')
  rimOuterMesh.name = 'rim-outer'
  rimOuterMesh.userData.partId = 'rim-outer'
  rimOuterMesh.position.y = NEON_CUBE.rimOuterY
  baseOuter.add(rimOuterMesh)

  const baseCornerMesh = new THREE.Mesh(
    buildCornerMarkers(NEON_CUBE.baseSide / 2 - NEON_CUBE.baseCornerRadius, NEON_CUBE.baseHeight, theme.neonLinear),
    neonEdge,
  )
  baseCornerMesh.name = 'corner-markers-base'
  baseCornerMesh.userData.partId = 'corner-markers-base'
  baseOuter.add(baseCornerMesh)

  const lightSheets = new THREE.Mesh(buildLightSheets(), lightSheetMaterial)
  lightSheets.name = 'light-sheets'
  lightSheets.userData.partId = 'light-sheets'
  baseOuter.add(lightSheets)

  const baseInner = new THREE.Group()
  baseInner.name = 'base-inner'
  baseInner.userData.partId = 'base-inner'
  baseOuter.add(baseInner)

  const baseInnerMesh = new THREE.Mesh(
    new RoundedBoxGeometry(NEON_CUBE.innerBaseSide, NEON_CUBE.innerBaseHeight, NEON_CUBE.innerBaseSide, 4, NEON_CUBE.innerBaseCornerRadius),
    glassBaseInner,
  )
  baseInnerMesh.name = 'base-inner-slab'
  baseInnerMesh.userData.partId = 'base-inner'
  baseInnerMesh.position.y = NEON_CUBE.innerBaseHeight / 2
  baseInner.add(baseInnerMesh)

  const rimInnerMesh = new THREE.Mesh(
    createRimGeometry(
      NEON_CUBE.innerBaseSide / 2,
      NEON_CUBE.innerBaseCornerRadius,
      NEON_CUBE.rimInnerRadius,
      theme.neonLinear,
      RIM_INNER_MULTIPLIER,
    ),
    neonEdge,
  )
  rimInnerMesh.name = 'rim-inner'
  rimInnerMesh.userData.partId = 'rim-inner'
  rimInnerMesh.position.y = NEON_CUBE.rimInnerY
  baseInner.add(rimInnerMesh)

  const cubeOuter = new THREE.Group()
  cubeOuter.name = 'cube-outer'
  cubeOuter.userData.partId = 'cube-outer'
  cubeOuter.position.y = NEON_CUBE.cubeBottomY
  baseInner.add(cubeOuter)

  const panels = buildPanes(glassPanel)
  panels.name = 'panel-grid'
  panels.userData.partId = 'panel-grid'
  panels.position.y = NEON_CUBE.cubeHalf
  cubeOuter.add(panels)

  const seamMesh = new THREE.Mesh(buildSeams(theme.neonLinear), neonEdge)
  seamMesh.name = 'seam-grid'
  seamMesh.userData.partId = 'seam-grid'
  seamMesh.position.y = NEON_CUBE.cubeHalf
  cubeOuter.add(seamMesh)

  const edgeMesh = new THREE.Mesh(
    buildEdgeFrame(NEON_CUBE.cubeSide, NEON_CUBE.outerEdgeRod, OUTER_EDGE_MULTIPLIER, theme.neonLinear),
    neonEdge,
  )
  edgeMesh.name = 'cube-edges'
  edgeMesh.userData.partId = 'cube-edges'
  edgeMesh.position.y = NEON_CUBE.cubeHalf
  cubeOuter.add(edgeMesh)

  const cubeCornerMesh = new THREE.Mesh(
    buildCornerMarkers(NEON_CUBE.cubeSide / 2, NEON_CUBE.cubeSide, theme.neonLinear),
    neonEdge,
  )
  cubeCornerMesh.name = 'corner-markers-cube'
  cubeCornerMesh.userData.partId = 'corner-markers-cube'
  cubeOuter.add(cubeCornerMesh)

  const cubeInner = new THREE.Group()
  cubeInner.name = 'cube-inner'
  cubeInner.userData.partId = 'cube-inner'
  cubeInner.position.y = NEON_CUBE.cubeHalf
  cubeOuter.add(cubeInner)

  const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(NEON_CUBE.coreSide, NEON_CUBE.coreSide, NEON_CUBE.coreSide), coreGlass)
  coreMesh.name = 'core-cube'
  coreMesh.userData.partId = 'cube-inner'
  cubeInner.add(coreMesh)

  const innerEdgeMesh = new THREE.Mesh(
    buildEdgeFrame(NEON_CUBE.coreSide, NEON_CUBE.innerEdgeRod, INNER_EDGE_MULTIPLIER, theme.neonLinear),
    neonEdge,
  )
  innerEdgeMesh.name = 'inner-edges'
  innerEdgeMesh.userData.partId = 'inner-edges'
  cubeInner.add(innerEdgeMesh)

  const coreGlow = new THREE.Group()
  coreGlow.name = 'core-glow'
  coreGlow.userData.partId = 'core-glow'
  cubeInner.add(coreGlow)

  const coreSprite = new THREE.Sprite(glowSprite)
  coreSprite.name = 'core-halo'
  coreSprite.scale.setScalar(NEON_CUBE.glowSpriteSize)
  coreGlow.add(coreSprite)

  const coreLight = new THREE.PointLight(theme.coreEmissive, 1.5, 2.2, 2)
  coreLight.name = 'core-light'
  coreGlow.add(coreLight)

  let triangleCount = 0
  let drawCalls = 0
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry
      const perInstance = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3
      triangleCount += object instanceof THREE.InstancedMesh ? perInstance * object.count : perInstance
      drawCalls += 1
    } else if (object instanceof THREE.Sprite) {
      triangleCount += 2
      drawCalls += 1
    }
  })

  const parts: Record<string, THREE.Object3D> = {
    root: group,
    'base-outer': baseOuter,
    'base-inner': baseInner,
    'cube-outer': cubeOuter,
    'cube-inner': cubeInner,
    'panel-grid': panels,
    'seam-grid': seamMesh,
    'cube-edges': edgeMesh,
    'inner-edges': innerEdgeMesh,
    'rim-outer': rimOuterMesh,
    'rim-hole': rimOuterMesh,
    'rim-inner': rimInnerMesh,
    'corner-markers-base': baseCornerMesh,
    'corner-markers-cube': cubeCornerMesh,
    'light-sheets': lightSheets,
    'core-glow': coreGlow,
  }

  const materials: Record<string, THREE.Material> = {
    'glass-panel': glassPanel,
    'glass-base': glassBase,
    'glass-base-inner': glassBaseInner,
    'neon-edge': neonEdge,
    'core-glass': coreGlass,
    'glow-sprite': glowSprite,
    'light-sheet': lightSheetMaterial,
  }

  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>()
    const disposableMaterials = new Set<THREE.Material>()
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry)
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        const material = object.material
        if (Array.isArray(material)) material.forEach((entry) => disposableMaterials.add(entry))
        else disposableMaterials.add(material)
      }
    })
    geometries.forEach((geometry) => geometry.dispose())
    disposableMaterials.forEach((material) => {
      const map = (material as THREE.MeshBasicMaterial).map
      if (map) map.dispose()
      material.dispose()
    })
  }

  return { group, parts, materials, theme, triangleCount, drawCalls, dispose }
}
