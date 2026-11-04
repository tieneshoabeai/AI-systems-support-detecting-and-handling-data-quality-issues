// One tower, as a function of its own dimensions (CODE ARCHITECTURE IMPROVEMENT PLAN, Phase 4 / S1).
// It takes no ids and no angles — placement belongs to tower-ring.ts — and its material values come from
// tower-config.ts, so nothing here needs a back-reference into the Core factory.
import * as THREE from 'three'
import type { ProceduralModelRuntime } from './generated-core'
import { addTechnicalLine, addTechnicalRods } from './technical-lines'
import { TOWER_PALETTE } from './tower-config'
import { GAUGE_COLOR, HERO_FORM, heroGaugeDimensions } from './tower-gauge-config'

export type TowerTone = {
  glass: THREE.MeshPhysicalMaterial
  core: THREE.MeshStandardMaterial
  frame: THREE.MeshStandardMaterial
  window: THREE.MeshBasicMaterial
}

export type TowerMaterials = {
  tone: TowerTone
  cornerPost: THREE.MeshBasicMaterial
  plinth: THREE.MeshStandardMaterial
  heroMetal: THREE.MeshStandardMaterial
  heroProxy: THREE.MeshBasicMaterial
  heroCore: THREE.MeshBasicMaterial
  heroEdge: THREE.LineBasicMaterial
}

// One call per model. Context architecture keeps its shared palette; composite heroes share
// their own metal, white core, edge and non-rendered hit-proxy materials.
export function createTowerMaterials(): TowerMaterials {
  return {
    heroMetal: new THREE.MeshStandardMaterial({ color: GAUGE_COLOR.body, metalness: 0.85, roughness: 0.4 }),
    heroCore: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(HERO_FORM.coreGain), toneMapped: false }),
    heroEdge: new THREE.LineBasicMaterial({ color: GAUGE_COLOR.edge, toneMapped: false, depthWrite: false }),
    // Object visibility stays true for picking; only the material is excluded from rendering.
    heroProxy: new THREE.MeshBasicMaterial({ visible: false }),
    tone: {
      glass: new THREE.MeshPhysicalMaterial({
        color: TOWER_PALETTE.glass.color, transparent: true, opacity: TOWER_PALETTE.glass.opacity,
        roughness: TOWER_PALETTE.glass.roughness, metalness: TOWER_PALETTE.glass.metalness,
        clearcoat: TOWER_PALETTE.glass.clearcoat, clearcoatRoughness: TOWER_PALETTE.glass.clearcoatRoughness,
        emissive: TOWER_PALETTE.glass.emissive, emissiveIntensity: TOWER_PALETTE.glass.emissiveIntensity,
        depthWrite: false, side: THREE.DoubleSide,
      }),
      core: new THREE.MeshStandardMaterial({
        color: TOWER_PALETTE.core.color, emissive: TOWER_PALETTE.core.emissive,
        emissiveIntensity: TOWER_PALETTE.core.emissiveIntensity, transparent: true,
        opacity: TOWER_PALETTE.core.opacity, roughness: TOWER_PALETTE.core.roughness,
        metalness: TOWER_PALETTE.core.metalness, depthWrite: false, side: THREE.DoubleSide,
      }),
      frame: new THREE.MeshStandardMaterial({
        color: TOWER_PALETTE.frame.color, emissive: TOWER_PALETTE.frame.emissive,
        emissiveIntensity: TOWER_PALETTE.frame.emissiveIntensity, transparent: true,
        opacity: TOWER_PALETTE.frame.opacity, roughness: TOWER_PALETTE.frame.roughness,
        metalness: TOWER_PALETTE.frame.metalness, depthWrite: false, side: THREE.DoubleSide,
      }),
      window: new THREE.MeshBasicMaterial({
        color: TOWER_PALETTE.window.color, transparent: true, opacity: TOWER_PALETTE.window.opacity,
        depthWrite: false, blending: THREE.NormalBlending, toneMapped: false,
      }),
    },
    cornerPost: new THREE.MeshBasicMaterial({
      color: TOWER_PALETTE.cornerPost.color, transparent: true, opacity: TOWER_PALETTE.cornerPost.opacity,
      depthWrite: false, blending: THREE.NormalBlending, toneMapped: false,
    }),
    plinth: new THREE.MeshStandardMaterial({
      color: TOWER_PALETTE.plinth.color, emissive: TOWER_PALETTE.plinth.emissive,
      emissiveIntensity: TOWER_PALETTE.plinth.emissiveIntensity, transparent: true,
      opacity: TOWER_PALETTE.plinth.opacity, roughness: TOWER_PALETTE.plinth.roughness,
      metalness: TOWER_PALETTE.plinth.metalness, depthWrite: false, side: THREE.DoubleSide,
    }),
  }
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
export function createBeveledTowerGeometry(width: number, height: number, depth: number) {
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

export type TowerShape = 'box' | 'octagon'

// Union of a cross with 2/3-wide arms and four triangular fillers. These are eight flat
// sides, not a regular octagon; a single solid avoids coincident transparent faces.
function octagonalFootprint(width: number, depth: number): THREE.Vector2[] {
  return [
    [-width / 3, -depth / 2], [width / 3, -depth / 2],
    [width / 2, -depth / 3], [width / 2, depth / 3],
    [width / 3, depth / 2], [-width / 3, depth / 2],
    [-width / 2, depth / 3], [-width / 2, -depth / 3],
  ].map(([x, z]) => new THREE.Vector2(x, z))
}

export function createOctagonalTowerGeometry(width: number, height: number, depth: number) {
  const shape = new THREE.Shape(octagonalFootprint(width, depth))
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, -height / 2, 0)
  return geometry
}

// Flat-shaded rings make one closed eight-sided prism/frustum, including caps.
function octagonalRingsGeometry(width: number, depth: number, rings: Array<{ y: number; scale: number }>) {
  const footprint = octagonalFootprint(width, depth)
  const positions: number[] = []
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray())
  }
  const points = rings.map(ring => footprint.map(p => new THREE.Vector3(p.x * ring.scale, ring.y, p.y * ring.scale)))
  for (let level = 0; level < points.length - 1; level += 1) {
    for (let i = 0; i < 8; i += 1) {
      const j = (i + 1) % 8
      triangle(points[level][i], points[level + 1][i], points[level + 1][j])
      triangle(points[level][i], points[level + 1][j], points[level][j])
    }
  }
  for (let i = 0; i < 8; i += 1) {
    const j = (i + 1) % 8
    triangle(new THREE.Vector3(0, rings[0].y, 0), points[0][i], points[0][j])
    const last = points.length - 1
    triangle(new THREE.Vector3(0, rings[last].y, 0), points[last][j], points[last][i])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildCompositeHero(mesh: THREE.Mesh, width: number, height: number, depth: number, materials: Pick<TowerMaterials, 'heroMetal' | 'heroProxy' | 'heroCore' | 'heroEdge'>) {
  const form = heroGaugeDimensions(width, height, depth)
  // The only pickable object keeps the tower id and an exact envelope for the selection outline.
  mesh.geometry = octagonalRingsGeometry(width, depth, [
    { y: -height / 2, scale: 1 },
    { y: form.bodyTopY, scale: 1 },
    { y: form.capTopY, scale: HERO_FORM.capTopRatio },
    { y: height / 2, scale: HERO_FORM.capTopRatio },
  ])
  mesh.material = materials.heroProxy

  const core = new THREE.Mesh(new THREE.BoxGeometry(form.coreWidth, form.bodyHeight, form.coreDepth), materials.heroCore)
  core.position.y = form.bodyCenterY
  core.name = 'hero-square-core'
  core.raycast = () => {}
  mesh.add(core)

  // A positive-X/positive-Z unit right triangle. Rotate it into each corner; no negative
  // instance scales, which InstancedMesh cannot reliably render with back-face culling.
  const triangle = new THREE.Shape([
    new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, -1),
  ])
  triangle.closePath()
  const cornerGeometry = new THREE.ExtrudeGeometry(triangle, { depth: 1, bevelEnabled: false, steps: 1 })
  cornerGeometry.rotateX(-Math.PI / 2)
  cornerGeometry.translate(0, -0.5, 0)
  const corners = new THREE.InstancedMesh(cornerGeometry, materials.heroMetal, 4)
  const anchors = [[1, 1], [1, -1], [-1, -1], [-1, 1]]
  anchors.forEach(([sx, sz], index) => {
    towerPosition.set(sx * form.coreWidth / 2, form.bodyCenterY, sz * form.coreDepth / 2)
    towerQuaternion.setFromAxisAngle(TOWER_UP, index * Math.PI / 2)
    towerScale.set(index % 2 ? form.armDepth : form.armWidth, form.bodyHeight, index % 2 ? form.armWidth : form.armDepth)
    towerMatrix.compose(towerPosition, towerQuaternion, towerScale)
    corners.setMatrixAt(index, towerMatrix)
  })
  corners.instanceMatrix.needsUpdate = true
  corners.name = 'hero-metal-corners'
  corners.raycast = () => {}
  corners.frustumCulled = false
  mesh.add(corners)

  const cap = new THREE.Mesh(octagonalRingsGeometry(width, depth, [
    { y: form.bodyTopY, scale: 1 },
    { y: form.capTopY, scale: HERO_FORM.capTopRatio },
  ]), materials.heroMetal)
  cap.name = 'hero-cap'
  cap.raycast = () => {}
  mesh.add(cap)

  // Only the physical edges of the four metal corners and cap; no facade grid or mullions.
  const edgePositions: number[] = []
  const appendEdges = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
    const edges = new THREE.EdgesGeometry(geometry)
    const positions = edges.getAttribute('position')
    const point = new THREE.Vector3()
    for (let i = 0; i < positions.count; i += 1) {
      point.fromBufferAttribute(positions, i).applyMatrix4(matrix)
      edgePositions.push(point.x, point.y, point.z)
    }
    edges.dispose()
  }
  for (let i = 0; i < corners.count; i += 1) {
    corners.getMatrixAt(i, towerMatrix)
    appendEdges(cornerGeometry, towerMatrix)
  }
  appendEdges(cap.geometry, new THREE.Matrix4())
  const edgeGeometry = new THREE.BufferGeometry()
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3))
  const edges = new THREE.LineSegments(edgeGeometry, materials.heroEdge)
  edges.name = 'hero-metal-edge'
  edges.renderOrder = 3
  edges.raycast = () => {}
  mesh.add(edges)
}

// Floors, mullions, parapet and crown share one instanced draw; window rows get a second one.
export function buildTowerArchitecture(
  runtime: ProceduralModelRuntime,
  id: string,
  width: number,
  height: number,
  depth: number,
  crowned: boolean,
  tone: TowerTone,
  shape: TowerShape = 'box',
  heroMaterials?: Pick<TowerMaterials, 'heroMetal' | 'heroProxy' | 'heroCore' | 'heroEdge'>,
) {
  const mesh = runtime.meshes[id]
  if (!mesh) return
  mesh.geometry.dispose()
  mesh.material = tone.glass
  mesh.renderOrder = 1
  if (shape === 'octagon') {
    if (!heroMaterials) throw new Error('Composite hero requires metal and hit-proxy materials')
    buildCompositeHero(mesh, width, height, depth, heroMaterials)
    return
  }
  mesh.geometry = createBeveledTowerGeometry(width, height, depth)

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
  if (crowned) {
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

  const roofY = crowned ? height / 2 + 0.112 : height / 2
  const roofHalfWidth = (crowned ? width * 0.5 : width) / 2
  const roofHalfDepth = (crowned ? depth * 0.5 : depth) / 2
  addTechnicalRods(mesh, [
    -roofHalfWidth, roofY, -roofHalfDepth, roofHalfWidth, roofY, -roofHalfDepth,
    roofHalfWidth, roofY, -roofHalfDepth, roofHalfWidth, roofY, roofHalfDepth,
    roofHalfWidth, roofY, roofHalfDepth, -roofHalfWidth, roofY, roofHalfDepth,
    -roofHalfWidth, roofY, roofHalfDepth, -roofHalfWidth, roofY, -roofHalfDepth,
  ], { thickness: 0.008, opacity: 0.45, name: 'tower-roof-outline', color: '#6fa8ff', blending: THREE.NormalBlending })
}

export function addTowerCornerPosts(parent: THREE.Object3D, width: number, height: number, depth: number, material: THREE.Material, shape: TowerShape = 'box') {
  const thickness = THREE.MathUtils.clamp(0.05 * Math.min(width, depth), 0.014, 0.03)
  const corners = shape === 'octagon' ? octagonalFootprint(width, depth) : [
    new THREE.Vector2(-width / 2, -depth / 2), new THREE.Vector2(-width / 2, depth / 2),
    new THREE.Vector2(width / 2, -depth / 2), new THREE.Vector2(width / 2, depth / 2),
  ]
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(thickness, height, thickness), material, corners.length)
  const matrix = new THREE.Matrix4()
  let index = 0
  for (const { x, y: z } of corners) {
    matrix.makeTranslation(x, 0, z)
    posts.setMatrixAt(index, matrix)
    index += 1
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

export function addTowerDataMarks(parent: THREE.Object3D, width: number, height: number, depth: number, density: number) {
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
