// One tower, as a function of its own dimensions (CODE ARCHITECTURE IMPROVEMENT PLAN, Phase 4 / S1).
// It takes no ids and no angles — placement belongs to tower-ring.ts — and its material values come from
// tower-config.ts, so nothing here needs a back-reference into the Core factory.
import * as THREE from 'three'
import type { ProceduralModelRuntime } from './generated-core'
import { addTechnicalLine, addTechnicalRods } from './technical-lines'
import { TOWER_PALETTE } from './tower-config'

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
}

// One call per model, not per tower: 18 towers share these six materials, and the fingerprint gate
// tracks them by object identity, so a second copy of `glass` would show up as 18 groups instead of one.
export function createTowerMaterials(): TowerMaterials {
  return {
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

// Floors, mullions, parapet and crown share one instanced draw; window rows get a second one.
export function buildTowerArchitecture(
  runtime: ProceduralModelRuntime,
  id: string,
  width: number,
  height: number,
  depth: number,
  crowned: boolean,
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

export function addTowerCornerPosts(parent: THREE.Object3D, width: number, height: number, depth: number, material: THREE.Material) {
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
