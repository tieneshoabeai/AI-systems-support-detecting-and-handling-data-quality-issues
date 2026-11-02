import * as THREE from 'three'
import {
  createHolographicOrbitalDataCoreV2Model,
  type ProceduralModelRuntime,
} from './generated-core'
import { createInboundStreams } from './inbound-streams'
import { CORE_VISUAL_REVISION, ISSUE_CONSTELLATION, resolveCoreGlow } from './core-visual-config'
import { createIssueConstellation } from './issue-constellation'
import {
  NON_SELECTABLE_PART_IDS,
  type HolographicPartComponent,
  type HolographicPartInfo,
} from '../../types/dataset-3d/holographic-part.types'

type HolographicCoreProductModel = {
  model: THREE.Group
  update(elapsedSeconds: number, deltaSeconds: number): void
  resetMotion(): void
  snapDetach(): void
  setDetached(detached: boolean): void
  setSelected(componentId: string | null): void
  resolvePart(object: THREE.Object3D): HolographicPartInfo | null
  dispose(): void
}

const CYAN = '#17d7ff'
const TOWER_OPACITY: Record<string, number> = {
  'tower-01-back-high': 0.36, 'tower-02': 0.38, 'tower-03': 0.42,
  'tower-04': 0.48, 'tower-05': 0.52, 'tower-06': 0.50,
  'tower-07': 0.44, 'tower-08': 0.40, 'tower-09': 0.36,
}
const TIER_OPACITY: Record<string, number> = {
  'core-upper': 0.70,
  'core-lower': 0.65,
  'core-foot': 0.22,
  'core-mid-collar': 0.34,
  'core-lower-collar': 0.30,
  'base-shell': 0.35,
  'base-deck': 0.07,
  'base-intermediate': 0.18,
  'base-sector-01': 0.12, 'base-sector-02': 0.12, 'base-sector-03': 0.12, 'base-sector-04': 0.12,
  'base-sector-05': 0.12, 'base-sector-06': 0.12, 'base-sector-07': 0.12, 'base-sector-08': 0.12,
}
const MATERIAL_PRESETS = {
  'blue-volume': { color: '#075bff', emissive: '#1065ff', intensity: 0.6, opacity: 0.24 },
  'cyan-contour': { color: '#2fe0ff', emissive: '#2fe0ff', intensity: 0.6, opacity: 0.30 },
  'violet-band': { color: '#a01fd8', emissive: '#c33ff0', intensity: 0.6, opacity: 0.45 },
  'blue-face': { color: '#0a63ff', emissive: '#1a7cff', intensity: 0.7, opacity: 0.40 },
  'field-fill': { color: '#0c5ced', emissive: '#1a7cff', intensity: 0.4, opacity: 0.10 },
  'base-intermediate': { color: '#0a5bff', emissive: '#1a7bff', intensity: 0.55, opacity: 0.30 },
} as const

function createIntermediateBase(runtime: ProceduralModelRuntime) {
  const baseNode = runtime.nodes['base-shell']
  if (!baseNode) throw new Error('Thiếu base-shell để gắn base-intermediate')
  const node = new THREE.Group()
  node.name = 'base-intermediate'
  node.position.y = 0.46 + 0.20 / 2 - 0.225
  const profile = [
    new THREE.Vector2(2.15, -0.10), new THREE.Vector2(2.70, -0.10),
    new THREE.Vector2(2.70, 0.10), new THREE.Vector2(2.15, 0.10),
    new THREE.Vector2(2.15, -0.10),
  ]
  const preset = MATERIAL_PRESETS['base-intermediate']
  const mesh = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 96),
    new THREE.MeshStandardMaterial({ color: preset.color, emissive: preset.emissive, emissiveIntensity: preset.intensity, transparent: true, opacity: preset.opacity, side: THREE.DoubleSide, depthWrite: false }),
  )
  mesh.name = 'base-intermediate'
  mesh.userData.sculptComponent = {
    id: 'base-intermediate',
    name: 'Intermediate base drum',
    role: 'projected-part',
    material: 'base-intermediate',
    level: 'macro',
    dimensions: { width: 5.4, height: 0.2, depth: 5.4, units: 'relative' },
  }
  node.add(mesh)
  baseNode.add(node)
  runtime.nodes['base-intermediate'] = node
  runtime.meshes['base-intermediate'] = mesh
}

function addPlanarGrid(parent: THREE.Object3D, radii: number[], spokes: number, y: number, opacity: number, color = CYAN) {
  const vertices: number[] = []
  for (const radius of radii) {
    for (let index = 0; index < spokes; index += 1) {
      const start = index / spokes * Math.PI * 2
      const end = (index + 1) / spokes * Math.PI * 2
      vertices.push(Math.cos(start) * radius, y, Math.sin(start) * radius)
      vertices.push(Math.cos(end) * radius, y, Math.sin(end) * radius)
    }
  }
  for (let index = 0; index < spokes; index += 1) {
    const angle = index / spokes * Math.PI * 2
    const outerRadius = radii.at(-1) ?? 0
    vertices.push(0, y, 0, Math.cos(angle) * outerRadius, y, Math.sin(angle) * outerRadius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const grid = new THREE.LineSegments(geometry, material)
  grid.name = 'technical-planar-grid'
  grid.renderOrder = 5
  parent.add(grid)
}

function addBaseWallGrid(parent: THREE.Object3D, radius: number, yBottom: number, yTop: number, color = CYAN) {
  const verticals: number[] = []
  const segments = 16
  for (let column = 0; column < segments; column += 1) {
    const angle = column / segments * Math.PI * 2
    verticals.push(Math.cos(angle) * radius, yBottom, Math.sin(angle) * radius, Math.cos(angle) * radius, yTop, Math.sin(angle) * radius)
  }
  addTechnicalRods(parent, verticals, { thickness: 0.014, opacity: 0.78, name: 'base-wall-post', color })

  const ringLayer = (y: number, thickness: number, opacity: number) => {
    const rims: number[] = []
    for (let segment = 0; segment < 96; segment += 1) {
      const start = segment / 96 * Math.PI * 2
      const end = (segment + 1) / 96 * Math.PI * 2
      rims.push(Math.cos(start) * radius, y, Math.sin(start) * radius, Math.cos(end) * radius, y, Math.sin(end) * radius)
    }
    addTechnicalRods(parent, rims, { thickness, opacity, name: 'base-wall-ring', color })
  }
  // The lower rim carries the most weight, so the base reads with depth top-down.
  ringLayer(yBottom, 0.016, 0.55)
  ringLayer((yBottom + yTop) / 2, 0.011, 0.42)
  ringLayer(yTop, 0.011, 0.3)
}

// The reference deck is a raised ring platform around a recessed moat, not a filled disc.
function addDeckRecess(parent: THREE.Object3D) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(1.45, 2.35, 96, 1),
    new THREE.MeshBasicMaterial({ color: '#01040e', transparent: true, opacity: 0.84, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.452
  mesh.name = 'deck-recess'
  mesh.renderOrder = 4
  parent.add(mesh)

  // Chevron plate seams across the raised platform ring, matching the reference deck.
  const seams: number[] = []
  for (let index = 0; index < 24; index += 1) {
    const start = index / 24 * Math.PI * 2
    const end = (index + 0.5) / 24 * Math.PI * 2
    for (const [radius, depth] of [[2.62, 0.06], [2.86, 0.06]] as const) {
      seams.push(Math.cos(start) * radius, 0.456, Math.sin(start) * radius, Math.cos(end) * (radius - depth), 0.456, Math.sin(end) * (radius - depth))
    }
  }
  addTechnicalRods(parent, seams, { thickness: 0.008, opacity: 0.6, name: 'deck-chevron-rod' })
}

function addHotspot(parent: THREE.Object3D, position: THREE.Vector3, radius: number, opacity: number, color = '#d8ffff') {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const hotspot = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material)
  hotspot.name = 'holographic-hotspot'
  hotspot.position.copy(position)
  hotspot.renderOrder = 8
  parent.add(hotspot)
  return hotspot
}

function addTechnicalLine(parent: THREE.Object3D, positions: number[], opacity: number, color = CYAN) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const lines = new THREE.LineSegments(geometry, material)
  lines.name = 'technical-linework'
  lines.renderOrder = 6
  parent.add(lines)
}

const ROD_UP = new THREE.Vector3(0, 1, 0)
const rodMidpoint = new THREE.Vector3()
const rodDirection = new THREE.Vector3()
const rodQuaternion = new THREE.Quaternion()
const rodScale = new THREE.Vector3()

// LineBasicMaterial ignores linewidth on most GPUs, so structural lines are box rods in one instanced draw.
function addTechnicalRods(
  parent: THREE.Object3D,
  positions: number[],
  options: { thickness: number; opacity: number; name: string; color?: string; blending?: THREE.Blending },
) {
  const count = positions.length / 6
  const material = new THREE.MeshBasicMaterial({
    color: options.color ?? CYAN,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    blending: options.blending ?? THREE.AdditiveBlending,
    toneMapped: false,
  })
  const rods = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, count)
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < count; index += 1) {
    const offset = index * 6
    const x1 = positions[offset]
    const y1 = positions[offset + 1]
    const z1 = positions[offset + 2]
    const x2 = positions[offset + 3]
    const y2 = positions[offset + 4]
    const z2 = positions[offset + 5]
    rodMidpoint.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2)
    rodDirection.set(x2 - x1, y2 - y1, z2 - z1)
    const length = rodDirection.length()
    if (length === 0) continue
    rodQuaternion.setFromUnitVectors(ROD_UP, rodDirection.divideScalar(length))
    rodScale.set(options.thickness, length, options.thickness)
    matrix.compose(rodMidpoint, rodQuaternion, rodScale)
    rods.setMatrixAt(index, matrix)
  }
  rods.instanceMatrix.needsUpdate = true
  rods.name = options.name
  rods.renderOrder = 6
  rods.frustumCulled = false
  rods.raycast = () => {}
  parent.add(rods)
  return rods
}

function addTowerCornerPosts(parent: THREE.Object3D, width: number, height: number, depth: number, material: THREE.Material) {
  const thickness = THREE.MathUtils.clamp(0.05 * Math.min(width, depth), 0.014, 0.03)
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(thickness, height, thickness), material, 4)
  const matrix = new THREE.Matrix4()
  let index = 0
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      matrix.makeTranslation(x, 0, z)
      posts.setMatrixAt(index, matrix)
      index += 1
    }
  }
  posts.instanceMatrix.needsUpdate = true
  posts.name = 'tower-corner-post'
  // Drawn after the grid so the dark corner edges stay readable on top of the bright linework.
  posts.renderOrder = 7
  posts.frustumCulled = false
  posts.raycast = () => {}
  parent.add(posts)
  return posts
}

type TowerTone = {
  glass: THREE.MeshPhysicalMaterial
  core: THREE.MeshStandardMaterial
  frame: THREE.MeshStandardMaterial
  window: THREE.MeshBasicMaterial
}

type TowerFace = { axis: 'x' | 'z'; sign: 1 | -1; index: number; rotation: number }

const TOWER_FACES: TowerFace[] = [
  { axis: 'z', sign: 1, index: 0, rotation: 0 },
  { axis: 'z', sign: -1, index: 1, rotation: Math.PI },
  { axis: 'x', sign: 1, index: 2, rotation: Math.PI / 2 },
  { axis: 'x', sign: -1, index: 3, rotation: -Math.PI / 2 },
]

const TOWER_UP = new THREE.Vector3(0, 1, 0)
const towerMatrix = new THREE.Matrix4()
const towerQuaternion = new THREE.Quaternion()
const towerPosition = new THREE.Vector3()
const towerScale = new THREE.Vector3()
const towerColor = new THREE.Color()

function towerPatternHash(id: string, first: number, second: number) {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619)
  const value = Math.sin((hash >>> 0) * 0.000011 + first * 12.9898 + second * 78.233) * 43758.5453
  return value - Math.floor(value)
}

// Solid beveled prism: rounded vertical corners plus chamfered top and bottom caps give the
// volume a real architectural edge instead of a wireframe cage.
function createBeveledTowerGeometry(width: number, height: number, depth: number) {
  const bevel = 0.01
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const corner = Math.min(THREE.MathUtils.clamp(0.08 * Math.min(width, depth), 0.012, 0.03), halfWidth - 0.002, halfDepth - 0.002)
  const shape = new THREE.Shape()
  shape.moveTo(-halfWidth + corner, -halfDepth)
  shape.lineTo(halfWidth - corner, -halfDepth)
  shape.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + corner)
  shape.lineTo(halfWidth, halfDepth - corner)
  shape.quadraticCurveTo(halfWidth, halfDepth, halfWidth - corner, halfDepth)
  shape.lineTo(-halfWidth + corner, halfDepth)
  shape.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth, halfDepth - corner)
  shape.lineTo(-halfWidth, -halfDepth + corner)
  shape.quadraticCurveTo(-halfWidth, -halfDepth, -halfWidth + corner, -halfDepth)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height - 2 * bevel, 0.02),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 3,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, bevel - height / 2, 0)
  return geometry
}

// Floors, mullions, parapet and crown share one instanced draw; window rows get a second one.
function buildTowerArchitecture(
  runtime: ProceduralModelRuntime,
  id: string,
  width: number,
  height: number,
  depth: number,
  seed: number,
  tone: TowerTone,
) {
  const mesh = runtime.meshes[id]
  if (!mesh) return
  mesh.geometry.dispose()
  mesh.geometry = createBeveledTowerGeometry(width, height, depth)
  mesh.material = tone.glass
  mesh.renderOrder = 1

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(width - 0.03, 0.02), Math.max(height - 0.02, 0.02), Math.max(depth - 0.03, 0.02)),
    tone.core,
  )
  core.name = 'tower-solid-core'
  core.renderOrder = 1
  mesh.add(core)

  const floorCount = THREE.MathUtils.clamp(Math.round(height / 0.22), 3, 16)
  const floorHeight = height / floorCount
  const slabs: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = []
  const addSlab = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    slabs.push({ x, y, z, sx, sy, sz })
  }
  addSlab(0, -height / 2 + 0.012, 0, width + 0.026, 0.024, depth + 0.026)
  for (let floor = 1; floor < floorCount; floor += 1) {
    addSlab(0, -height / 2 + floor * floorHeight, 0, width + 0.014, 0.012, depth + 0.014)
  }
  addSlab(0, height / 2 - 0.012, 0, width + 0.022, 0.024, depth + 0.022)
  addSlab(0, height / 2 - 0.03, 0, Math.max(width - 0.05, 0.04), 0.006, Math.max(depth - 0.05, 0.04))
  if (seed === 0) {
    // The tallest tower carries a setback crown so the skyline reads at a glance.
    addSlab(0, height / 2 + 0.05, 0, width * 0.62, 0.1, depth * 0.62)
    addSlab(0, height / 2 + 0.106, 0, width * 0.5, 0.012, depth * 0.5)
  }

  const bays = Math.max(2, Math.round(width / 0.11))
  const sideBays = Math.max(2, Math.round(depth / 0.11))
  const finHeight = Math.max(height - 0.08, 0.1)
  const finZ = depth / 2 + 0.005
  const finX = width / 2 + 0.005
  for (let bay = 1; bay < bays; bay += 1) {
    const offset = -width / 2 + (bay / bays) * width
    addSlab(offset, 0, finZ, 0.012, finHeight, 0.014)
    addSlab(offset, 0, -finZ, 0.012, finHeight, 0.014)
  }
  for (let bay = 1; bay < sideBays; bay += 1) {
    const offset = -depth / 2 + (bay / sideBays) * depth
    addSlab(finX, 0, offset, 0.014, finHeight, 0.012)
    addSlab(-finX, 0, offset, 0.014, finHeight, 0.012)
  }

  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tone.frame, slabs.length)
  towerQuaternion.identity()
  slabs.forEach((slab, index) => {
    towerPosition.set(slab.x, slab.y, slab.z)
    towerScale.set(slab.sx, slab.sy, slab.sz)
    towerMatrix.compose(towerPosition, towerQuaternion, towerScale)
    frames.setMatrixAt(index, towerMatrix)
  })
  frames.instanceMatrix.needsUpdate = true
  frames.name = 'tower-floor-frame'
  frames.renderOrder = 3
  frames.frustumCulled = false
  frames.raycast = () => {}
  mesh.add(frames)

  // Window panels sit behind the glass surface while the floor slabs and fins stand proud,
  // so every bay reads recessed into the facade.
  const windowCount = (floorCount - 1) * (bays * 2 + sideBays * 2)
  const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), tone.window, windowCount)
  const panelHeight = floorHeight * 0.52
  let windowIndex = 0
  for (let floor = 1; floor < floorCount; floor += 1) {
    const y = -height / 2 + (floor - 0.5) * floorHeight
    for (const face of TOWER_FACES) {
      const faceBays = face.axis === 'z' ? bays : sideBays
      const span = face.axis === 'z' ? width : depth
      const inset = (face.axis === 'z' ? depth / 2 : width / 2) - 0.005
      towerQuaternion.setFromAxisAngle(TOWER_UP, face.rotation)
      for (let bay = 0; bay < faceBays; bay += 1) {
        const offset = -span / 2 + ((bay + 0.5) / faceBays) * span
        if (face.axis === 'z') towerPosition.set(offset, y, face.sign * inset)
        else towerPosition.set(face.sign * inset, y, offset)
        towerScale.set((span / faceBays) * 0.62, panelHeight, 1)
        towerMatrix.compose(towerPosition, towerQuaternion, towerScale)
        windows.setMatrixAt(windowIndex, towerMatrix)
        const lit = towerPatternHash(id, floor, bay + face.index * 13) < 0.38
        towerColor.set(lit ? '#4f97e8' : '#0a2136')
        windows.setColorAt(windowIndex, towerColor)
        windowIndex += 1
      }
    }
  }
  windows.instanceMatrix.needsUpdate = true
  if (windows.instanceColor) windows.instanceColor.needsUpdate = true
  windows.name = 'tower-window-panel'
  windows.renderOrder = 2
  windows.frustumCulled = false
  windows.raycast = () => {}
  mesh.add(windows)

  const roofY = seed === 0 ? height / 2 + 0.112 : height / 2
  const roofHalfWidth = (seed === 0 ? width * 0.5 : width) / 2
  const roofHalfDepth = (seed === 0 ? depth * 0.5 : depth) / 2
  addTechnicalRods(mesh, [
    -roofHalfWidth, roofY, -roofHalfDepth, roofHalfWidth, roofY, -roofHalfDepth,
    roofHalfWidth, roofY, -roofHalfDepth, roofHalfWidth, roofY, roofHalfDepth,
    roofHalfWidth, roofY, roofHalfDepth, -roofHalfWidth, roofY, roofHalfDepth,
    -roofHalfWidth, roofY, roofHalfDepth, -roofHalfWidth, roofY, -roofHalfDepth,
  ], { thickness: 0.008, opacity: 0.45, name: 'tower-roof-outline', color: '#6fa8ff', blending: THREE.NormalBlending })
}

function addCylinderGrid(parent: THREE.Object3D, radius: number, height: number, horizontalCount: number, verticalCount: number, opacity: number) {
  const positions: number[] = []
  for (let row = 1; row <= horizontalCount; row += 1) {
    const y = -height / 2 + row * height / (horizontalCount + 1)
    for (let segment = 0; segment < 32; segment += 1) {
      const start = segment / 32 * Math.PI * 2
      const end = (segment + 1) / 32 * Math.PI * 2
      positions.push(radius * Math.cos(start), y, radius * Math.sin(start), radius * Math.cos(end), y, radius * Math.sin(end))
    }
  }
  for (let column = 0; column < verticalCount; column += 1) {
    const angle = column / verticalCount * Math.PI * 2
    positions.push(radius * Math.cos(angle), -height / 2, radius * Math.sin(angle), radius * Math.cos(angle), height / 2, radius * Math.sin(angle))
  }
  addTechnicalLine(parent, positions, opacity)
}

function addScatteredNodes(parent: THREE.Object3D, positions: number[], size: number) {
  const nodes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(size, 1),
    new THREE.MeshBasicMaterial({ color: '#89f7ff', transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    positions.length / 3,
  )
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < positions.length; index += 3) {
    matrix.makeTranslation(positions[index], positions[index + 1], positions[index + 2])
    nodes.setMatrixAt(index / 3, matrix)
  }
  nodes.instanceMatrix.needsUpdate = true
  nodes.name = 'scattered-holographic-nodes'
  nodes.renderOrder = 7
  parent.add(nodes)
  return nodes
}

function addTowerDataMarks(parent: THREE.Object3D, width: number, height: number, depth: number, density: number) {
  const positions: number[] = []
  for (let index = 0; index < density; index += 1) {
    const y = (-0.34 + index / Math.max(density - 1, 1) * 0.68) * height
    const start = -width * 0.3
    const end = start + width * [0.3, 0.62, 0.45, 0.76][index % 4]
    positions.push(start, y, depth / 2 + 0.012, end, y, depth / 2 + 0.012)
    if (index % 2 === 0) positions.push(end, y - height * 0.025, depth / 2 + 0.013, end, y + height * 0.025, depth / 2 + 0.013)
  }
  addTechnicalLine(parent, positions, 0.35, '#6fa8ff')
}

function addCapSolarRays(parent: THREE.Object3D) {
  for (const [innerRadius, outerRadius, opacity] of [[0.06, 0.26, 0.4], [0.26, 0.52, 0.22], [0.52, 0.82, 0.08]]) {
    const positions: number[] = []
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = ray / 12 * Math.PI * 2
      positions.push(innerRadius * Math.cos(angle), 0.038, innerRadius * Math.sin(angle), outerRadius * Math.cos(angle), 0.038, outerRadius * Math.sin(angle))
    }
    addTechnicalLine(parent, positions, opacity)
  }
}

type TowerRiser = {
  mesh: THREE.InstancedMesh
  baseX: Float32Array
  baseZ: Float32Array
  phases: Float32Array
  speeds: Float32Array
  lengths: Float32Array
  height: number
}

const riserMatrix = new THREE.Matrix4()
const riserPosition = new THREE.Vector3()
const riserScale = new THREE.Vector3()
const riserQuaternion = new THREE.Quaternion()

// Data motes drift up inside each glass tower, from the deck to the tower top.
function addTowerRiser(parent: THREE.Object3D, width: number, depth: number, height: number, seed: number): TowerRiser {
  const count = Math.max(14, Math.round(height * 12))
  const baseX = new Float32Array(count)
  const baseZ = new Float32Array(count)
  const phases = new Float32Array(count)
  const speeds = new Float32Array(count)
  const lengths = new Float32Array(count)
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.012, 1, 0.012),
    // Dim steel-blue motes so they read through the glass without turning into white sparks.
    new THREE.MeshBasicMaterial({ color: '#5b9cf0', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    count,
  )
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  for (let index = 0; index < count; index += 1) {
    const angle = (index * 2.399963 + seed * 1.7) % (Math.PI * 2)
    const radial = 0.10 + 0.30 * ((index * 0.618 + seed * 0.37) % 1)
    baseX[index] = Math.cos(angle) * width * radial
    baseZ[index] = Math.sin(angle) * depth * radial
    phases[index] = (index * 0.377 + seed * 0.21) % 1
    speeds[index] = 0.35 + ((index * 0.733 + seed * 0.19) % 1) * 0.55
    lengths[index] = 0.08 + ((index * 0.291 + seed * 0.53) % 1) * 0.12
  }
  mesh.name = 'tower-rising-particles'
  mesh.renderOrder = 7
  parent.add(mesh)
  const riser = { mesh, baseX, baseZ, phases, speeds, lengths, height }
  syncTowerRisers([riser], 0)
  return riser
}

function syncTowerRisers(risers: TowerRiser[], elapsedSeconds: number) {
  for (const riser of risers) {
    const { mesh, baseX, baseZ, phases, speeds, lengths, height } = riser
    for (let index = 0; index < phases.length; index += 1) {
      const travel = (phases[index] + elapsedSeconds * speeds[index] * 0.32) % 1
      riserPosition.set(
        baseX[index] + Math.sin(elapsedSeconds * 1.6 + phases[index] * 6.283) * 0.012,
        // Trails overshoot the tower roof by a fifth of the tower height.
        -height / 2 + travel * height * 1.2,
        baseZ[index] + Math.cos(elapsedSeconds * 1.3 + phases[index] * 6.283) * 0.012,
      )
      riserScale.set(1, lengths[index], 1)
      riserMatrix.compose(riserPosition, riserQuaternion, riserScale)
      mesh.setMatrixAt(index, riserMatrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
}

function applyHolographicMaterials(runtime: ProceduralModelRuntime) {
  for (const [componentId, mesh] of Object.entries(runtime.meshes)) {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!(material instanceof THREE.MeshStandardMaterial)) continue
    const component = mesh.userData.sculptComponent as { material?: unknown } | undefined
    const materialRole = typeof component?.material === 'string' ? component.material : 'base-intermediate'
    const preset = MATERIAL_PRESETS[materialRole as keyof typeof MATERIAL_PRESETS] ?? MATERIAL_PRESETS['base-intermediate']
    material.transparent = true
    // Only the upper drum writes depth, so the pedestal ring behind it stays hidden
    // while the lower glass sections keep their see-through look.
    material.depthWrite = componentId === 'core-upper'
    material.side = THREE.DoubleSide
    material.roughness = 0.34
    material.metalness = 0
    material.color.set(preset.color)
    material.emissive.set(preset.emissive)
    material.emissiveIntensity = preset.intensity
    material.opacity = TOWER_OPACITY[componentId] ?? TIER_OPACITY[componentId] ?? preset.opacity
    mesh.userData.holographicMaterialRole = materialRole
    mesh.renderOrder = 1
  }
  for (const [componentId, mesh] of Object.entries(runtime.meshes)) {
    // Towers get their architecture later in the factory, including a beveled outline;
    // a box EdgesGeometry here would double the silhouette with stale cube seams.
    if (componentId.startsWith('tower-')) continue
    const materialRole = mesh.userData.holographicMaterialRole as string | undefined
    const contourColor = materialRole === 'violet-band' ? '#ff6cf0' : CYAN
    const contourOpacity = materialRole === 'cyan-contour' ? 0.5 : materialRole === 'violet-band' ? 0.7 : 0.3
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 28),
      new THREE.LineBasicMaterial({ color: contourColor, transparent: true, opacity: contourOpacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    edges.name = 'holographic-contour'
    edges.renderOrder = 5
    mesh.add(edges)
  }
}

// Reference-derived proportions: tower tops reach from just below to well above the core cap,
// measured against the primary image (deck top y=0.45, cap top ≈2.86).
const TOWER_BASE_Y = 0.45
const TOWER_HEIGHTS: Record<string, [number, number]> = {
  'tower-01-back-high': [2.65, 3.3], 'tower-02': [1.95, 2.7], 'tower-03': [1.7, 2.5],
  'tower-04': [1.2, 2], 'tower-05': [0.85, 1.35], 'tower-06': [1, 1.6],
  'tower-07': [1.3, 1.9], 'tower-08': [1.8, 2.4], 'tower-09': [1.95, 2.75],
}

type AdditionalTower = {
  id: string
  name: string
  angleDegrees: number
  radius: number
  width: number
  height: number
  depth: number
  level: string
  baseY: number
}

// Second ring: one tower between every pair of the original nine, pulled within 9 degrees of the
// arc midpoint and widened until the nearest AABB gap lands in 0.10-0.38, so the ring reads as one
// dense tier instead of a sparse set of columns.
// Containment on the base: r + sqrt(2)*(w/2 + plinth 0.02) stays under 3.06, inside the rim at
// 3.091, and r - sqrt(2)*(w/2 + 0.02) stays above the sector band's inner radius 2.15. Those
// bounds cap the tall columns at w 0.596 and the low ones at w 0.41.
// baseY 0.50 is the sector plate top, so the ring stands on the sectors instead of the deck.
// tower-15 has no room on the ring between tower-18 (337.5) and tower-04 (355), so it drops onto
// the inner projection field (flat annulus r 0.96-2.15) at baseY 0.45 with no plinth; its footprint
// stays inside that annulus and it forms the lowest step of the tiered cluster.
const OUTER_TOWERS: AdditionalTower[] = [
  { id: 'tower-10', name: 'Outer ring tower 10', angleDegrees: 14.5, radius: 2.6, width: 0.58, height: 2.1, depth: 0.58, level: 'meso', baseY: 0.5 },
  { id: 'tower-11', name: 'Outer ring tower 11', angleDegrees: 63, radius: 2.74, width: 0.4, height: 1.2, depth: 0.4, level: 'meso', baseY: 0.5 },
  { id: 'tower-12', name: 'Outer ring tower 12', angleDegrees: 96.5, radius: 2.6, width: 0.58, height: 2.15, depth: 0.58, level: 'meso', baseY: 0.5 },
  { id: 'tower-13', name: 'Outer ring tower 13', angleDegrees: 151.5, radius: 2.74, width: 0.4, height: 1.35, depth: 0.4, level: 'meso', baseY: 0.5 },
  { id: 'tower-14', name: 'Outer ring tower 14', angleDegrees: 181.5, radius: 2.6, width: 0.58, height: 2, depth: 0.58, level: 'meso', baseY: 0.5 },
  { id: 'tower-15', name: 'Inner projection field tower 15', angleDegrees: 346, radius: 1.5, width: 0.34, height: 1.1, depth: 0.34, level: 'micro', baseY: 0.45 },
  { id: 'tower-16', name: 'Outer ring tower 16', angleDegrees: 241.5, radius: 2.6, width: 0.58, height: 1.95, depth: 0.58, level: 'meso', baseY: 0.5 },
  { id: 'tower-17', name: 'Outer ring tower 17', angleDegrees: 282.5, radius: 2.74, width: 0.4, height: 1.3, depth: 0.4, level: 'micro', baseY: 0.5 },
  { id: 'tower-18', name: 'Outer ring tower 18', angleDegrees: 337.5, radius: 2.6, width: 0.58, height: 2.05, depth: 0.58, level: 'meso', baseY: 0.5 },
]
const OUTER_TOWER_IDS = new Set(OUTER_TOWERS.map(tower => tower.id))
for (const tower of OUTER_TOWERS) TOWER_HEIGHTS[tower.id] = [tower.height, tower.height]

function createOuterTowers(runtime: ProceduralModelRuntime, model: THREE.Object3D) {
  const root = runtime.nodes['root'] ?? model
  const dimensions: Array<[string, number, number, number]> = []
  // Sector plates are 0.0425 above the deck, so towers in the plate gaps get a thin footing
  // instead of hovering over the deck.
  const plinthMaterial = new THREE.MeshStandardMaterial({
    color: '#041a3a', emissive: '#082f60', emissiveIntensity: 0.2, transparent: true, opacity: 0.9,
    roughness: 0.55, metalness: 0.08, depthWrite: false, side: THREE.DoubleSide,
  })
  for (const tower of OUTER_TOWERS) {
    const angle = THREE.MathUtils.degToRad(tower.angleDegrees)
    const node = new THREE.Group()
    node.name = tower.name
    node.position.set(Math.cos(angle) * tower.radius, tower.baseY + tower.height / 2, Math.sin(angle) * tower.radius)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(tower.width, tower.height, tower.depth))
    mesh.name = tower.name
    mesh.userData.sculptComponent = {
      id: tower.id,
      name: tower.name,
      level: tower.level,
      role: 'projected-part',
      importance: 0.6,
      confidence: 0.7,
      primitive: 'box',
      topologyClass: 'assembled-solid',
      dimensions: { width: tower.width, height: tower.height, depth: tower.depth, units: 'relative', confidence: 0.6 },
      material: 'blue-face',
      materialLayers: ['blue-face'],
    }
    // The plinth only bridges the 0.0425 gap between deck top and sector top; a tower based at
    // TOWER_BASE_Y already sits in the deck surface, so it must not hang a footing below it.
    if (tower.baseY > TOWER_BASE_Y) {
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(tower.width + 0.04, 0.0425, tower.depth + 0.04),
        plinthMaterial,
      )
      plinth.name = 'tower-plinth'
      plinth.position.y = -tower.height / 2 - 0.02125
      plinth.renderOrder = 1
      mesh.add(plinth)
    }
    node.add(mesh)
    root.add(node)
    runtime.nodes[tower.id] = node
    runtime.meshes[tower.id] = mesh
    dimensions.push([tower.id, tower.width, tower.height, tower.depth])
  }
  return dimensions
}

// The generated radii leave a 0.27-0.38 gap to the mid collar, so the original nine read as a
// loose ring. Pulling each one in until its nearest footprint edge lands at r ~1.49 puts all but
// tower-04 on a shared inner face 0.14 outside the collar (rendered outer radius 1.3485).
// tower-01 already sits at 1.484; tower-04 keeps its generated radius because tower-15 occupies
// the inner slot at 346 degrees (0.157 gap), so pulling it in would overlap.
const ORIGINAL_TOWER_RADII: Record<string, number> = {
  'tower-02': 1.75,
  'tower-03': 1.8308,
  'tower-05': 1.7639,
  'tower-06': 1.7498,
  'tower-07': 1.7984,
  'tower-08': 1.7843,
  'tower-09': 1.8007,
}

function conformToReference(runtime: ProceduralModelRuntime) {
  for (const [id, [, target]] of Object.entries(TOWER_HEIGHTS)) {
    // The outer ring is built later at its own sector-plate base height.
    if (OUTER_TOWER_IDS.has(id)) continue
    const mesh = runtime.meshes[id]
    const node = runtime.nodes[id]
    if (!mesh || !node) continue
    // Tower geometry is rebuilt at reference height, so it never needs to be stretched.
    mesh.scale.y = 1
    node.position.y = TOWER_BASE_Y + target / 2
    const pulledRadius = ORIGINAL_TOWER_RADII[id]
    if (pulledRadius !== undefined) {
      const pull = pulledRadius / Math.hypot(node.position.x, node.position.z)
      node.position.x *= pull
      node.position.z *= pull
    }
  }
  const upperMesh = runtime.meshes['core-upper']
  const upperNode = runtime.nodes['core-upper']
  if (upperMesh && upperNode) {
    upperMesh.scale.y = 1.3
    upperNode.position.y = 2.08
    const cap = runtime.nodes['core-cap']
    if (cap) cap.position.y = 0.76
  }
  const lowerMesh = runtime.meshes['core-lower']
  if (lowerMesh) {
    // Reference neck under the pedestal is narrower than the drum, so the wide collar reads as a disc.
    lowerMesh.scale.x = 0.75
    lowerMesh.scale.z = 0.75
  }
  const midCollarNode = runtime.nodes['core-mid-collar']
  if (midCollarNode) midCollarNode.position.y = 1.3
  const midCollar = runtime.meshes['core-mid-collar']
  if (midCollar) {
    midCollar.scale.set(0.93, 1.3, 0.93)
    const mat = midCollar.material as THREE.MeshStandardMaterial
    mat.color.set('#0a5cff')
    mat.emissive.set('#1a86ff')
    mat.emissiveIntensity = 0.3
    mat.opacity = 0.3
    midCollar.traverse(child => {
      if (child instanceof THREE.LineSegments) (child.material as THREE.LineBasicMaterial).opacity = 0.28
    })
  }
  const orbitBand = runtime.meshes['orbit-violet']
  if (orbitBand) {
    // The flat lathe band plus its two rim lines render as a doubled ring; the reference orbit is
    // a single glowing line, carried by the core-light torus and halo added below.
    ;(orbitBand.material as THREE.MeshStandardMaterial).opacity = 0.28
    orbitBand.traverse(child => {
      if (child instanceof THREE.LineSegments) (child.material as THREE.LineBasicMaterial).opacity = 0.7
    })
  }
  const lowerCollar = runtime.meshes['core-lower-collar']
  if (lowerCollar) {
    lowerCollar.scale.set(0.75, 0.6, 0.75)
    const mat = lowerCollar.material as THREE.MeshStandardMaterial
    mat.color.set(CYAN)
    mat.emissive.set(CYAN)
    mat.emissiveIntensity = 0.7
    mat.opacity = 0.24
    lowerCollar.traverse(child => {
      if (child instanceof THREE.LineSegments) {
        const line = child.material as THREE.LineBasicMaterial
        line.color.set('#7de6ff')
        line.opacity = 0.32
      }
    })
  }
  // Shared role materials are too hot on the crowned cap and foot, so give those two their own copy.
  const capMesh = runtime.meshes['core-cap']
  if (capMesh) {
    const mat = (capMesh.material as THREE.MeshStandardMaterial).clone()
    mat.emissiveIntensity = 0.45
    mat.opacity = 0.4
    capMesh.material = mat
    capMesh.traverse(child => {
      if (child instanceof THREE.LineSegments) (child.material as THREE.LineBasicMaterial).opacity = 0.35
    })
  }
  const footMesh = runtime.meshes['core-foot']
  if (footMesh) {
    const mat = (footMesh.material as THREE.MeshStandardMaterial).clone()
    mat.emissiveIntensity = 0.45
    mat.opacity = 0.18
    footMesh.material = mat
  }
}

function clonePartMaterial(mesh: THREE.Mesh, patch: { color?: string; emissive?: string; opacity?: number; emissiveIntensity?: number; roughness?: number }) {
  const material = (mesh.material as THREE.MeshStandardMaterial).clone()
  if (patch.color) material.color.set(patch.color)
  if (patch.emissive) material.emissive.set(patch.emissive)
  if (patch.opacity !== undefined) material.opacity = patch.opacity
  if (patch.emissiveIntensity !== undefined) material.emissiveIntensity = patch.emissiveIntensity
  if (patch.roughness !== undefined) material.roughness = patch.roughness
  mesh.material = material
}

function setPartContourOpacity(mesh: THREE.Object3D, opacity: number) {
  mesh.traverse(child => {
    if (child instanceof THREE.LineSegments) (child.material as THREE.LineBasicMaterial).opacity = opacity
  })
}

// The shell's inner rims sit on the wall faces themselves, so they carry the wall color instead of
// cyan linework; the outer rims keep the contour color.
const SHELL_FACE_LINE_COLOR = '#3a1a6e'

function matchInnerShellRings(mesh: THREE.Mesh) {
  const contour = mesh.children.find((child): child is THREE.LineSegments =>
    child instanceof THREE.LineSegments && child.name === 'holographic-contour')
  if (!contour) return
  const position = contour.geometry.getAttribute('position')
  const outerPositions: number[] = []
  const innerPositions: number[] = []
  for (let index = 0; index < position.count; index += 2) {
    const radius = (Math.hypot(position.getX(index), position.getZ(index))
      + Math.hypot(position.getX(index + 1), position.getZ(index + 1))) / 2
    const target = radius < 2.6 ? innerPositions : outerPositions
    for (const vertex of [index, index + 1]) {
      target.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
    }
  }
  const outerGeometry = new THREE.BufferGeometry()
  outerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outerPositions, 3))
  const innerGeometry = new THREE.BufferGeometry()
  innerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(innerPositions, 3))
  mesh.remove(contour)
  contour.geometry.dispose()
  const outer = new THREE.LineSegments(outerGeometry, contour.material)
  outer.name = 'holographic-contour'
  outer.renderOrder = contour.renderOrder
  mesh.add(outer)
  const inner = new THREE.LineSegments(
    innerGeometry,
    new THREE.LineBasicMaterial({
      color: SHELL_FACE_LINE_COLOR,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  )
  inner.name = 'holographic-contour'
  inner.renderOrder = contour.renderOrder
  mesh.add(inner)
}

// Rim edges that run along the shell faces take the wall color so they read as face edges.
function matchFaceContour(mesh: THREE.Object3D) {
  mesh.traverse(child => {
    if (!(child instanceof THREE.LineSegments) || child.name !== 'holographic-contour') return
    const material = child.material as THREE.LineBasicMaterial
    material.color.set(SHELL_FACE_LINE_COLOR)
    material.blending = THREE.NormalBlending
    material.opacity = 0.9
  })
}

// The pedestal reads with depth only if its bottom rim outweighs the top rim.
function applyBaseDepth(runtime: ProceduralModelRuntime) {
  const bottomRim = runtime.meshes['base-rim-outer-bottom']
  if (bottomRim) {
    clonePartMaterial(bottomRim, { opacity: 0.6, emissiveIntensity: 1.15 })
    setPartContourOpacity(bottomRim, 1)
  }
  const outerTopRim = runtime.meshes['base-rim-outer-top']
  if (outerTopRim) {
    clonePartMaterial(outerTopRim, { opacity: 0.36, emissiveIntensity: 0.9 })
    setPartContourOpacity(outerTopRim, 0.45)
  }
  const innerTopRim = runtime.meshes['base-rim-inner-top']
  if (innerTopRim) {
    clonePartMaterial(innerTopRim, { opacity: 0.32 })
    matchFaceContour(innerTopRim)
  }
  const shell = runtime.meshes['base-shell']
  if (shell) {
    // The shell wall stays a touch brighter than the sector wedges so the pedestal still reads
    // as one volume, but its faces no longer wash out the darker sector plates.
    clonePartMaterial(shell, { color: '#041d44', emissive: '#083b88', emissiveIntensity: 0.5, opacity: 0.4 })
    setPartContourOpacity(shell, 0.15)
    matchInnerShellRings(shell)
  }
  const intermediate = runtime.meshes['base-intermediate']
  if (intermediate) (intermediate.material as THREE.MeshStandardMaterial).opacity = 0.34
  for (let index = 1; index <= 8; index += 1) {
    const sector = runtime.meshes[`base-sector-0${index}`]
    if (sector) setPartContourOpacity(sector, 0.48)
  }
}

function addEdgeRods(mesh: THREE.Mesh, options: { thickness: number; opacity: number; color: string; name: string }) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 30)
  const positions = Array.from(edges.getAttribute('position').array)
  edges.dispose()
  addTechnicalRods(mesh, positions, { ...options, blending: THREE.NormalBlending })
}

// ExtrudeGeometry merges every cap and wall into two groups. The wedge needs four shading
// levels (top, underside, inner shell, outer shell), so triangles are re-bucketed here.
function splitSectorFaceGroups(mesh: THREE.Mesh) {
  const source = mesh.geometry
  const geometry = source.index ? source.toNonIndexed() : source.clone()
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const buckets: number[][] = [[], [], [], []]
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const normalZ = normal.getZ(vertex)
    let bucket: number
    if (normalZ > 0.5) bucket = 0
    else if (normalZ < -0.5) bucket = 1
    else {
      const centroidY = (position.getY(vertex) + position.getY(vertex + 1) + position.getY(vertex + 2)) / 3
      // The inner arc sits on the +y half of the extruded local profile.
      bucket = centroidY > 0.1 ? 2 : 3
    }
    for (let corner = 0; corner < 3; corner += 1) {
      const at = vertex + corner
      buckets[bucket].push(
        position.getX(at), position.getY(at), position.getZ(at),
        normal.getX(at), normal.getY(at), normal.getZ(at),
      )
    }
  }
  const positions: number[] = []
  const normals: number[] = []
  const groups: Array<[number, number]> = []
  for (const bucket of buckets) {
    groups.push([positions.length / 3, bucket.length / 6])
    for (let at = 0; at < bucket.length; at += 6) {
      positions.push(bucket[at], bucket[at + 1], bucket[at + 2])
      normals.push(bucket[at + 3], bucket[at + 4], bucket[at + 5])
    }
  }
  const rebuilt = new THREE.BufferGeometry()
  rebuilt.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rebuilt.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  let start = 0
  groups.forEach(([, count], materialIndex) => {
    rebuilt.addGroup(start, count, materialIndex)
    start += count
  })
  mesh.geometry = rebuilt
  geometry.dispose()
  source.dispose()
}

// The reference reads as dark glass volumes lit by bright linework, so dark faces replace
// the additive cyan wash on towers, collar, lower drum and pedestal sectors.
function applyFaceShading(runtime: ProceduralModelRuntime) {
  const lower = runtime.meshes['core-lower']
  if (lower) {
    clonePartMaterial(lower, { color: '#041a38', emissive: '#0a47a8', emissiveIntensity: 0.4, opacity: 0.75 })
    setPartContourOpacity(lower, 0.36)
  }
  const collar = runtime.meshes['core-mid-collar']
  if (collar) {
    clonePartMaterial(collar, { color: '#04152b', emissive: '#0a3f8c', emissiveIntensity: 0.42, opacity: 0.52 })
    setPartContourOpacity(collar, 0.1)
    addEdgeRods(collar, { thickness: 0.01, opacity: 0.85, color: '#ffffff', name: 'collar-edge-rod' })
  }
  const cap = runtime.meshes['core-cap']
  if (cap) cap.scale.y = 0.5

  // Order: top cap, underside, inner shell, outer shell.
  const sectorMaterials = [
    new THREE.MeshStandardMaterial({ color: '#062a63', emissive: '#0b4bb8', emissiveIntensity: 0.4, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, roughness: 0.34, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: '#020b1c', emissive: '#041a3e', emissiveIntensity: 0.15, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false, roughness: 0.34, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: '#020d1f', emissive: '#052046', emissiveIntensity: 0.18, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, roughness: 0.34, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: '#04193c', emissive: '#083a8c', emissiveIntensity: 0.3, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, roughness: 0.34, metalness: 0 }),
  ]
  for (let index = 1; index <= 8; index += 1) {
    const sector = runtime.meshes[`base-sector-0${index}`]
    if (!sector) continue
    splitSectorFaceGroups(sector)
    sector.material = sectorMaterials
    setPartContourOpacity(sector, 0.12)
    addEdgeRods(sector, { thickness: 0.0065, opacity: 0.9, color: '#0e6c86', name: 'sector-edge-rod' })
  }
}

// Three tiers read apart by value and hue: violet pedestal, steel-blue towers, cyan core.
const TIER_CONTOUR = { base: '#8a5bff', core: '#4de6ff' } as const

function paintPart(
  mesh: THREE.Mesh | undefined,
  patch: { color?: string; emissive?: string; opacity?: number; emissiveIntensity?: number; roughness?: number },
  contour?: { color: string; opacity: number },
) {
  if (!mesh) return
  clonePartMaterial(mesh, patch)
  if (!contour) return
  mesh.traverse(child => {
    if (!(child instanceof THREE.LineSegments) || child.name !== 'holographic-contour') return
    const material = child.material as THREE.LineBasicMaterial
    material.color.set(contour.color)
    material.opacity = contour.opacity
  })
}

function applyTierContrast(runtime: ProceduralModelRuntime) {
  // Core stays below bloom threshold 1.0 in v3; thin nucleus bands carry the HDR instead.
  for (const [id, entry] of Object.entries(resolveCoreGlow())) {
    paintPart(runtime.meshes[id], entry.patch, entry.contour)
  }

  // Base: deep violet mass, translucent enough for the core glow to pass overhead.
  paintPart(runtime.meshes['base-shell'],
    { color: '#2a0f52', emissive: '#6d3bff', emissiveIntensity: 0.45, opacity: 0.26 },
    { color: TIER_CONTOUR.base, opacity: 0.45 })
  paintPart(runtime.meshes['base-intermediate'],
    { color: '#1c0a3a', emissive: '#5b2ad9', emissiveIntensity: 0.4, opacity: 0.22 },
    { color: TIER_CONTOUR.base, opacity: 0.4 })
  // Deck and rims stay violet end to end; the bottom rim only keeps more weight for depth.
  paintPart(runtime.meshes['base-deck'],
    { color: '#241047', emissive: '#6a35e0', emissiveIntensity: 0.32, opacity: 0.38 },
    { color: TIER_CONTOUR.base, opacity: 0.5 })
  paintPart(runtime.meshes['base-rim-outer-bottom'],
    { color: '#3a1a78', emissive: '#8a5bff', emissiveIntensity: 0.6, opacity: 0.38 },
    { color: TIER_CONTOUR.base, opacity: 0.75 })
  paintPart(runtime.meshes['base-rim-outer-top'],
    { color: '#2a1058', emissive: '#7b46ff', emissiveIntensity: 0.5, opacity: 0.24 },
    { color: TIER_CONTOUR.base, opacity: 0.35 })
  paintPart(runtime.meshes['base-rim-inner-top'],
    { color: '#1c0a3a', emissive: '#5b2ad9', emissiveIntensity: 0.4, opacity: 0.24 },
    { color: SHELL_FACE_LINE_COLOR, opacity: 0.8 })
  const sectorTones = [
    { color: '#2f1666', emissive: '#7b46ff', emissiveIntensity: 0.45, opacity: 0.5 },
    { color: '#140626', emissive: '#3a1a7a', emissiveIntensity: 0.2, opacity: 0.78 },
    { color: '#1a0733', emissive: '#4a2496', emissiveIntensity: 0.22, opacity: 0.85 },
    { color: '#241047', emissive: '#6a35e0', emissiveIntensity: 0.35, opacity: 0.6 },
  ]
  for (let index = 1; index <= 8; index += 1) {
    const sector = runtime.meshes[`base-sector-0${index}`]
    if (!sector) continue
    const materials = Array.isArray(sector.material) ? sector.material : []
    materials.forEach((material, slot) => {
      const tone = sectorTones[slot]
      if (!tone || !(material instanceof THREE.MeshStandardMaterial)) return
      material.color.set(tone.color)
      material.emissive.set(tone.emissive)
      material.emissiveIntensity = tone.emissiveIntensity
      material.opacity = tone.opacity
    })
    sector.traverse(child => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return
      const material = child.material
      if (material instanceof THREE.MeshBasicMaterial) material.color.set(TIER_CONTOUR.base)
      else if (material instanceof THREE.LineBasicMaterial) {
        material.color.set(TIER_CONTOUR.base)
        material.opacity = 0.5
      }
    })
  }
}

export function createHolographicCoreProductModel(): HolographicCoreProductModel {
  const model = createHolographicOrbitalDataCoreV2Model({
    castShadow: false,
    receiveShadow: false,
    qualityPriority: 'reference-fidelity',
  })
  const runtime = model.userData.sculptRuntime as ProceduralModelRuntime
  createIntermediateBase(runtime)
  applyHolographicMaterials(runtime)
  conformToReference(runtime)
  applyBaseDepth(runtime)
  applyFaceShading(runtime)
  applyTierContrast(runtime)
  // The constellation lives in world space (core root is at the origin) so issue lanes can
  // reach the orange Detection cube. It is hidden while the model is exploded.
  const constellation = CORE_VISUAL_REVISION === 'v3-constellation' && ISSUE_CONSTELLATION.enabled
    ? createIssueConstellation()
    : null
  if (constellation) model.add(constellation.root)

  // Reference shows the collar and orbit as thin white-hot ring lights on top of their bands.
  const ringLight = (radius: number, tube: number, color: string, y: number, opacity: number) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 6, 128),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    mesh.rotation.x = Math.PI / 2
    mesh.position.y = y
    mesh.renderOrder = 7
    model.add(mesh)
    return mesh
  }
  const collarLight = ringLight(1.35, 0.014, '#84e4ff', 1.44, 0.18)
  collarLight.name = 'collar-ring-light'
  const pedestalLight = ringLight(1, 0.012, '#84e4ff', 0.955, 0.22)
  pedestalLight.name = 'pedestal-ring-light'
  const orbitLight = ringLight(2.53, 0.034, '#ff3ce0', 0.48, 0.5)
  orbitLight.name = 'orbit-violet-core-light'
  const orbitHalo = ringLight(2.53, 0.09, '#7a1fd0', 0.47, 0.18)
  orbitHalo.name = 'orbit-violet-halo'
  const pedestalOrbit = ringLight(1.42, 0.02, '#ff55e8', 1, 0.2)
  pedestalOrbit.name = 'pedestal-violet-light'
  const capRimLight = ringLight(0.915, 0.01, '#aeeeff', 2.865, 0.1)
  capRimLight.name = 'cap-rim-light'
  const lowerCollarLight = ringLight(1.02, 0.01, '#79dcff', 0.44, 0.2)
  lowerCollarLight.name = 'lower-collar-ring-light'
  const deckOuterLight = ringLight(3.06, 0.014, '#b18cff', 0.46, 0.2)
  deckOuterLight.name = 'deck-outer-rim-light'
  const deckInnerLight = ringLight(2.95, 0.012, '#8a5bff', 0.462, 0.1)
  deckInnerLight.name = 'deck-inner-rim-light'
  const baseRimHalo = ringLight(3.108, 0.016, '#b18cff', 0, 0.22)
  baseRimHalo.name = 'base-rim-bottom-halo'

  // Reference-derived technical layers: they are visual structure, not dataset records.
  addPlanarGrid(runtime.nodes['base-deck'] ?? model, [1.1, 1.55, 2.05], 16, 0.016, 0.12, '#a37bff')
  addPlanarGrid(runtime.nodes['base-intermediate'] ?? model, [2.18, 2.4, 2.66], 16, 0.106, 0.24, '#a37bff')
  addPlanarGrid(runtime.nodes['core-cap'] ?? model, [0.22, 0.46, 0.69, 0.9], 12, 0.012, 0.22)
  // The older core reference keeps only soft seam lines on the drum, so the cylinder grids stay faint.
  addCylinderGrid(runtime.meshes['core-upper'] ?? model, 0.906, 1.2, 6, 12, 0.1)
  addCylinderGrid(runtime.meshes['core-lower'] ?? model, 0.906, 0.95, 5, 12, 0.09)
  addCylinderGrid(runtime.meshes['core-foot'] ?? model, 0.966, 0.25, 2, 12, 0.07)
  addCapSolarRays(runtime.meshes['core-cap'] ?? model)
  addBaseWallGrid(model, 3.108, 0.03, 0.44, '#8a5bff')
  addDeckRecess(model)
  const capHotspot = addHotspot(runtime.meshes['core-cap'] ?? model, new THREE.Vector3(0, 0.036, 0), 0.052, 0.42)
  const inboundStreams = createInboundStreams(runtime.nodes['core-cap'] ?? model)
  const collarHotspot = addHotspot(runtime.meshes['core-mid-collar'] ?? model, new THREE.Vector3(0, 0.12, 0), 0.024, 0.22)
  const footHotspot = addHotspot(runtime.meshes['core-foot'] ?? model, new THREE.Vector3(0, 0.13, 0), 0.042, 0.3)
  const axialSpines = [[2.08, 1.6], [0.825, 0.86], [0.24, 0.2]].map(([centerY, height]) => {
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, height, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: '#3deeff', transparent: true, opacity: 0.56, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    spine.position.y = centerY
    spine.name = 'axial-light-spine'
    spine.renderOrder = 7
    model.add(spine)
    return spine
  })
  // Reference keeps a single white-hot beam running from the deck, through the core, into the sky.
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#a8ecff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.5, 8, 1, true), beamMaterial)
  beam.position.y = 1.9
  beam.name = 'core-vertical-beam'
  beam.renderOrder = 8
  model.add(beam)
  const luminousNodes = [
    addScatteredNodes(runtime.meshes['core-upper'] ?? model, [0.56, 0.32, 0.7, -0.7, 0.18, 0.56, 0.8, -0.16, 0.38, -0.44, -0.3, 0.78], 0.015),
    addScatteredNodes(runtime.meshes['core-upper'] ?? model, [0.04, 0.06, 0.91, -0.84, 0.24, 0.25], 0.023),
    addScatteredNodes(runtime.meshes['core-lower'] ?? model, [0.66, 0.28, 0.61, -0.74, 0.06, 0.49, 0.34, -0.25, 0.84, -0.31, -0.34, 0.84], 0.014),
    addScatteredNodes(runtime.meshes['base-deck'] ?? model, [1.58, 0.026, 1.18, -1.35, 0.026, 1.48, 2.3, 0.026, -1.42, -2.42, 0.026, -0.7, 0.44, 0.026, -2.18, -0.65, 0.026, 2.42], 0.018),
    addScatteredNodes(runtime.meshes['base-intermediate'] ?? model, [2.44, 0.108, 0.45, -2.31, 0.108, -0.72, 0.42, 0.108, -2.5], 0.014),
  ]
  const outerTowerDimensions = createOuterTowers(runtime, model)
  const towerDimensions: Array<[string, number, number, number]> = [
    ['tower-01-back-high', 0.76, 3.3, 0.76], ['tower-02', 0.48, 2.7, 0.48], ['tower-03', 0.45, 2.5, 0.45],
    ['tower-04', 0.42, 2, 0.42], ['tower-05', 0.36, 1.35, 0.36], ['tower-06', 0.4, 1.6, 0.4],
    ['tower-07', 0.42, 1.9, 0.42], ['tower-08', 0.46, 2.4, 0.46], ['tower-09', 0.46, 2.75, 0.46],
    ...outerTowerDimensions,
  ]
  // Shared architectural palette: deep-blue glass volumes, dark structural frames and a soft
  // window glow, so nine towers stay inside a handful of draw calls.
  const towerTone: TowerTone = {
    glass: new THREE.MeshPhysicalMaterial({
      // Steel-blue volume that stays well below the core's HDR cyan.
      color: '#0a2848', transparent: true, opacity: 0.36, roughness: 0.4, metalness: 0.04,
      clearcoat: 0.28, clearcoatRoughness: 0.5, emissive: '#031a42', emissiveIntensity: 0.42,
      depthWrite: false, side: THREE.DoubleSide,
    }),
    core: new THREE.MeshStandardMaterial({
      // No depth write so the interior glow stays visible; the block itself stays faint.
      color: '#010c24', emissive: '#031a3a', emissiveIntensity: 0.3, transparent: true, opacity: 0.3,
      roughness: 0.5, metalness: 0, depthWrite: false, side: THREE.DoubleSide,
    }),
    frame: new THREE.MeshStandardMaterial({
      color: '#2a6fdb', emissive: '#1b5fbf', emissiveIntensity: 0.55, transparent: true, opacity: 0.9,
      roughness: 0.55, metalness: 0.08, depthWrite: false, side: THREE.DoubleSide,
    }),
    window: new THREE.MeshBasicMaterial({
      // Outward-facing only: far-side rows no longer double up through the glass.
      color: '#ffffff', transparent: true, opacity: 0.34, depthWrite: false,
      blending: THREE.NormalBlending, toneMapped: false,
    }),
  }
  // Bright steel-blue corner posts; cyan is reserved for the core tier.
  const cornerPostMaterial = new THREE.MeshBasicMaterial({
    color: '#6fa8ff',
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  })
  towerDimensions.forEach(([id, width, height, depth], seed) => {
    const tower = runtime.meshes[id]
    if (!tower) return
    buildTowerArchitecture(runtime, id, width, height, depth, seed, towerTone)
    addTowerCornerPosts(tower, width, height, depth, cornerPostMaterial)
  })
  const towerDetailPlan: Array<[string, number]> = [
    ['tower-01-back-high', 8], ['tower-04', 6], ['tower-06', 7], ['tower-09', 4], ['tower-12', 5],
  ]
  towerDetailPlan.forEach(([id, density]) => {
    const tower = towerDimensions.find(([towerId]) => towerId === id)
    if (!tower) return
    const [, width, height, depth] = tower
    addTowerDataMarks(runtime.meshes[id] ?? model, width, height, depth, density)
  })
  const risers = towerDimensions.map(([id, width, , depth], seed) => {
    const target = TOWER_HEIGHTS[id]?.[1] ?? 1.5
    return addTowerRiser(runtime.nodes[id] ?? model, width, depth, target, seed + 1)
  })
  const runner = new THREE.Group()
  runner.name = 'orbit-violet-runner'
  runner.position.y = 0.769
  const runnerMaterial = new THREE.MeshBasicMaterial({ color: '#ff7ae8', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const runnerArc = new THREE.Mesh(
    new THREE.TorusGeometry(2.53, 0.026, 6, 36, Math.PI * 0.2),
    runnerMaterial,
  )
  runnerArc.rotation.x = Math.PI / 2
  runnerArc.renderOrder = 7
  runner.add(runnerArc)
  model.add(runner)

  // Ring lights and the runner belong to the parts they decorate, so they must ride
  // along when the model explodes instead of hovering at ground level.
  model.updateMatrixWorld(true)
  const attachToNode = (object: THREE.Object3D, id: string) => {
    const target = runtime.nodes[id]
    if (target) target.attach(object)
  }
  attachToNode(capRimLight, 'core-cap')
  attachToNode(collarLight, 'core-mid-collar')
  attachToNode(lowerCollarLight, 'core-lower-collar')
  attachToNode(pedestalLight, 'core-lower')
  attachToNode(pedestalOrbit, 'core-lower')
  attachToNode(orbitLight, 'orbit-violet')
  attachToNode(orbitHalo, 'orbit-violet')
  attachToNode(runner, 'orbit-violet')
  attachToNode(baseRimHalo, 'base-rim-outer-bottom')

  const DETACH_DURATION = 0.65
  const detachEntries: Array<{ node: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 }> = []
  const registerDetach = (id: string, offset: THREE.Vector3) => {
    const node = runtime.nodes[id]
    if (!node) return
    detachEntries.push({ node, base: node.position.clone(), offset })
  }
  const radialOffset = (id: string, distance: number, lift: number) => {
    const node = runtime.nodes[id]
    const offset = new THREE.Vector3(node?.position.x ?? 0, 0, node?.position.z ?? 0)
    if (offset.lengthSq() > 0) offset.normalize()
    offset.multiplyScalar(distance)
    offset.y = lift
    return offset
  }
  for (const id of Object.keys(TOWER_HEIGHTS)) {
    // The outer ring starts farther out, so it travels less to stay inside the frame.
    registerDetach(id, radialOffset(id, OUTER_TOWER_IDS.has(id) ? 0.5 : 0.85, 0.35))
  }
  for (let index = 1; index <= 8; index += 1) registerDetach(`base-sector-0${index}`, radialOffset(`base-sector-0${index}`, 0.5, 0))
  registerDetach('core-upper', new THREE.Vector3(0, 0.42, 0))
  registerDetach('core-cap', new THREE.Vector3(0, 0.2, 0))
  registerDetach('core-mid-collar', new THREE.Vector3(0, 0.26, 0))
  registerDetach('core-lower', new THREE.Vector3(0, 0.12, 0))
  registerDetach('core-lower-collar', new THREE.Vector3(0, -0.06, 0))
  registerDetach('core-foot', new THREE.Vector3(0, -0.1, 0))
  registerDetach('orbit-violet', new THREE.Vector3(0, 0.16, 0))
  registerDetach('base-deck', new THREE.Vector3(0, 0.15, 0))
  registerDetach('base-rim-outer-top', new THREE.Vector3(0, 0.1, 0))
  registerDetach('base-rim-outer-bottom', new THREE.Vector3(0, -0.1, 0))
  registerDetach('base-rim-inner-top', new THREE.Vector3(0, 0.05, 0))
  registerDetach('base-intermediate', new THREE.Vector3(0, 0.03, 0))

  let detachTarget = 0
  let detachProgress = 0
  const applyDetach = () => {
    const eased = detachProgress < 0.5
      ? 4 * detachProgress * detachProgress * detachProgress
      : 1 - Math.pow(-2 * detachProgress + 2, 3) / 2
    for (const entry of detachEntries) entry.node.position.copy(entry.base).addScaledVector(entry.offset, eased)
  }
  const snapDetach = () => {
    detachProgress = detachTarget
    applyDetach()
  }
  const advanceDetach = (deltaSeconds: number) => {
    const next = THREE.MathUtils.clamp(detachProgress + (detachTarget ? 1 : -1) * deltaSeconds / DETACH_DURATION, 0, 1)
    if (next === detachProgress) return
    detachProgress = next
    applyDetach()
  }

  const selectionContours = new Map<string, THREE.LineSegments>()
  for (const [id, mesh] of Object.entries(runtime.meshes)) {
    if (NON_SELECTABLE_PART_IDS.has(id)) continue
    const contour = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 24),
      // Normal blending keeps the amber outline readable on top of additive cyan; additive would wash to white.
      new THREE.LineBasicMaterial({ color: '#ffa41c', transparent: true, opacity: 1, depthWrite: false, depthTest: false, toneMapped: false }),
    )
    contour.name = 'selection-contour'
    contour.scale.setScalar(1.002)
    contour.renderOrder = 9
    contour.visible = false
    contour.raycast = () => {}
    mesh.add(contour)
    selectionContours.set(id, contour)
  }
  let selectedId: string | null = null
  const setSelected = (componentId: string | null) => {
    selectedId = componentId
    selectionContours.forEach((contour, id) => {
      contour.visible = id === selectedId
      ;(contour.material as THREE.LineBasicMaterial).opacity = 1
    })
  }
  const resolvePart = (object: THREE.Object3D): HolographicPartInfo | null => {
    let current: THREE.Object3D | null = object
    while (current) {
      const component = current.userData.sculptComponent as HolographicPartComponent | undefined
      if (component?.id) {
        if (NON_SELECTABLE_PART_IDS.has(component.id)) return null
        return {
          id: component.id,
          name: component.name ?? component.id,
          role: component.role ?? 'component',
          material: component.material ?? 'unknown',
          level: component.level ?? 'unknown',
          dimensions: {
            width: component.dimensions?.width ?? 0,
            height: component.dimensions?.height ?? 0,
            depth: component.dimensions?.depth ?? 0,
            units: component.dimensions?.units ?? 'relative',
          },
        }
      }
      current = current.parent
    }
    return null
  }

  // Only component meshes answer the pointer; decoration, lights and contours stay transparent to it.
  const pickableMeshes = new Set<THREE.Object3D>(Object.values(runtime.meshes))
  model.traverse(object => {
    if (!pickableMeshes.has(object)) object.raycast = () => {}
  })

  const motionNodes = {
    orbit: runtime.nodes['orbit-violet'],
    collar: runtime.nodes['core-mid-collar'],
    deck: runtime.nodes['base-deck'],
    cap: runtime.nodes['core-cap'],
  }
  const resetMotion = () => {
    Object.values(motionNodes).forEach(node => { if (node) node.rotation.y = 0 })
    runner.rotation.y = 0
    runnerMaterial.opacity = 0.8
    capHotspot.scale.setScalar(1)
    collarHotspot.scale.setScalar(1)
    footHotspot.scale.setScalar(1)
    axialSpines.forEach(spine => { (spine.material as THREE.MeshBasicMaterial).opacity = 0.56 })
    luminousNodes.forEach(nodes => { (nodes.material as THREE.MeshBasicMaterial).opacity = 0.72 })
    beamMaterial.opacity = 0.45
    selectionContours.forEach(contour => { (contour.material as THREE.LineBasicMaterial).opacity = 0.95 })
    syncTowerRisers(risers, 0)
    inboundStreams.reset()
    constellation?.reset()
  }
  resetMotion()

  return {
    model,
    update(elapsedSeconds, deltaSeconds) {
      advanceDetach(deltaSeconds)
      if (motionNodes.orbit) motionNodes.orbit.rotation.y = elapsedSeconds * Math.PI * 2 / 21
      if (motionNodes.collar) motionNodes.collar.rotation.y = -elapsedSeconds * Math.PI * 2 / 15
      if (motionNodes.deck) motionNodes.deck.rotation.y = elapsedSeconds * Math.PI * 2 / 32
      if (motionNodes.cap) motionNodes.cap.rotation.y = -elapsedSeconds * Math.PI * 2 / 24
      inboundStreams.update(elapsedSeconds)
      constellation?.update(elapsedSeconds, deltaSeconds)
      runner.rotation.y = elapsedSeconds * Math.PI * 2 / 6
      runnerMaterial.opacity = 0.66 + Math.sin(elapsedSeconds * Math.PI * 2 / 2.4) * 0.14
      const capPulse = 0.9 + Math.sin(elapsedSeconds * Math.PI * 2 / 3.2) * 0.1
      capHotspot.scale.setScalar(0.96 + capPulse * 0.08)
      ;(capHotspot.material as THREE.MeshBasicMaterial).opacity = 0.42 * capPulse
      collarHotspot.scale.setScalar(0.98 + (0.96 + Math.sin(elapsedSeconds * 1.1 + 1) * 0.04) * 0.035)
      ;(collarHotspot.material as THREE.MeshBasicMaterial).opacity = 0.24 + Math.sin(elapsedSeconds * 1.1 + 1) * 0.03
      footHotspot.scale.setScalar(0.98 + (0.96 + Math.sin(elapsedSeconds * 1.1 + 2) * 0.04) * 0.035)
      ;(footHotspot.material as THREE.MeshBasicMaterial).opacity = 0.29 + Math.sin(elapsedSeconds * 1.1 + 2) * 0.02
      axialSpines.forEach(spine => { (spine.material as THREE.MeshBasicMaterial).opacity = 0.48 + Math.sin(elapsedSeconds * 1.1) * 0.06 })
      luminousNodes.forEach((nodes, index) => { (nodes.material as THREE.MeshBasicMaterial).opacity = 0.52 + (Math.sin(elapsedSeconds * 1.4 + index * 0.9) + 1) * 0.08 })
      syncTowerRisers(risers, elapsedSeconds)
      beamMaterial.opacity = 0.42 + Math.sin(elapsedSeconds * 0.9) * 0.06
      selectionContours.forEach(contour => {
        if (contour.visible) (contour.material as THREE.LineBasicMaterial).opacity = 0.8 + Math.sin(elapsedSeconds * 4) * 0.2
      })
    },
    resetMotion,
    setDetached(detached) {
      detachTarget = detached ? 1 : 0
      constellation?.setDetached(detached)
    },
    snapDetach,
    setSelected,
    resolvePart,
    dispose() {
      if (constellation) {
        model.remove(constellation.root)
        constellation.dispose()
      }
      model.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(material => material.dispose())
        }
      })
    },
  }
}
