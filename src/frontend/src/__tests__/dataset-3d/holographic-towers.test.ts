import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createHolographicCoreProductModel } from '../../graphics/holographic-core/holographic-core.model'
import { HERO_GAUGES } from '../../graphics/holographic-core/tower-gauge-config'

const HERO_IDS = new Set(HERO_GAUGES.map(target => target.towerId))

type TowerRuntime = {
  nodes: Record<string, THREE.Object3D>
  meshes: Record<string, THREE.Mesh>
}

const ORIGINAL_IDS = ['tower-01-back-high', 'tower-02', 'tower-03', 'tower-04', 'tower-07', 'tower-08', 'tower-09']
const OUTER_IDS = ['tower-10', 'tower-12', 'tower-13', 'tower-14', 'tower-16', 'tower-17', 'tower-18']
const RING_IDS = OUTER_IDS
const ALL_IDS = [...ORIGINAL_IDS, ...OUTER_IDS]

const TOWER_TARGETS: Record<string, number> = {
  'tower-01-back-high': 3.3,
  'tower-02': 2.7,
  'tower-03': 2.5,
  'tower-04': 2,
  'tower-07': 1.9,
  'tower-08': 2.4,
  'tower-09': 2.75,
  'tower-10': 2.1,
  'tower-12': 2.15,
  'tower-13': 1.35,
  'tower-14': 2,
  'tower-16': 1.95,
  'tower-17': 1.3,
  'tower-18': 2.05,
}

// Original towers stand on the deck (0.45); outer towers stand on the sector plates (0.50).
const BASE_Y: Record<string, number> = Object.fromEntries([
  ...ORIGINAL_IDS.map(id => [id, 0.45]),
  ...OUTER_IDS.map(id => [id, 0.5]),
])

const OUTER_LAYOUT: Record<string, { angle: number; radius: number }> = {
  'tower-10': { angle: 14.5, radius: 2.6 },
  'tower-12': { angle: 96.5, radius: 2.6 },
  'tower-13': { angle: 151.5, radius: 2.74 },
  'tower-14': { angle: 181.5, radius: 2.6 },
  'tower-16': { angle: 241.5, radius: 2.6 },
  'tower-17': { angle: 282.5, radius: 2.74 },
  'tower-18': { angle: 337.5, radius: 2.6 },
}

// Originals keep their generated angle; the seven pulled towers land on a shared inner face at
// r ~1.49. tower-01 already sat at 1.484 and tower-04 retains its approved radius.
const ORIGINAL_LAYOUT: Record<string, { angle: number; radius: number }> = {
  'tower-01-back-high': { angle: 225, radius: 2.05 },
  'tower-02': { angle: 270, radius: 1.75 },
  'tower-03': { angle: 310, radius: 1.8308 },
  'tower-04': { angle: 355, radius: 2.02 },
  'tower-07': { angle: 120, radius: 1.7984 },
  'tower-08': { angle: 165, radius: 1.7843 },
  'tower-09': { angle: 200, radius: 1.8007 },
}

function createRuntime() {
  const { model } = createHolographicCoreProductModel()
  return model.userData.sculptRuntime as TowerRuntime
}

function boundingSize(mesh: THREE.Mesh) {
  mesh.geometry.computeBoundingBox()
  return mesh.geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3()
}

// The plinth is 0.04 wider than the glass volume, hence the extra 0.01 on the half-size.
function footprintHalf(runtime: TowerRuntime, id: string) {
  return boundingSize(runtime.meshes[id]).x / 2 + 0.01
}

// Nearest-edge distance between two axis-aligned footprints; 0 means they overlap.
function clearance(runtime: TowerRuntime, a: string, b: string) {
  const nodeA = runtime.nodes[a]
  const nodeB = runtime.nodes[b]
  const span = footprintHalf(runtime, a) + footprintHalf(runtime, b)
  const dx = Math.abs(nodeA.position.x - nodeB.position.x) - span
  const dz = Math.abs(nodeA.position.z - nodeB.position.z) - span
  return Math.hypot(Math.max(0, dx), Math.max(0, dz))
}

// Distance from the axis to the nearest point of the tower footprint.
function innerFace(runtime: TowerRuntime, id: string) {
  const node = runtime.nodes[id]
  const half = footprintHalf(runtime, id)
  return Math.hypot(Math.max(0, Math.abs(node.position.x) - half), Math.max(0, Math.abs(node.position.z) - half))
}

describe('holographic tower architecture', () => {
  it('builds solid beveled glass volumes instead of wireframe grids', () => {
    const runtime = createRuntime()
    const glassMaterials = new Set<THREE.Material>()

    for (const [id, target] of Object.entries(TOWER_TARGETS)) {
      const mesh = runtime.meshes[id]
      const node = runtime.nodes[id]
      expect(mesh).toBeDefined()
      expect(node).toBeDefined()
      if (!mesh || !node) continue

      expect(mesh.scale.y).toBe(1)
      expect(node.position.y).toBeCloseTo(BASE_Y[id] + target / 2, 5)

      expect(boundingSize(mesh).y).toBeCloseTo(target, 4)

      if (HERO_IDS.has(id)) {
        expect((mesh.material as THREE.Material).visible).toBe(false)
        const arms = mesh.getObjectByName('hero-glass-arms') as THREE.InstancedMesh
        expect(arms.material).toBeInstanceOf(THREE.MeshPhysicalMaterial)
        expect(mesh.getObjectByName('hero-metal-corners')).toBeDefined()
        expect(mesh.getObjectByName('hero-cap')).toBeDefined()
        expect(mesh.getObjectByName('hero-square-core')).toBeDefined()
        expect(mesh.getObjectByName('tower-corner-post')).toBeUndefined()
        expect(mesh.getObjectByName('tower-floor-frame')).toBeUndefined()
        continue
      }
      expect(mesh.material).toBeInstanceOf(THREE.MeshPhysicalMaterial)
      glassMaterials.add(mesh.material as THREE.Material)

      const frame = mesh.children.find(child => child.name === 'tower-floor-frame')
      expect(frame).toBeInstanceOf(THREE.InstancedMesh)
      expect((frame as THREE.InstancedMesh).count).toBeGreaterThan(6)

      const windows = mesh.children.find(child => child.name === 'tower-window-panel')
      expect(windows).toBeInstanceOf(THREE.InstancedMesh)
      expect((windows as THREE.InstancedMesh).count).toBeGreaterThan(0)
      expect((windows as THREE.InstancedMesh).instanceColor).not.toBeNull()

      expect(mesh.children.some(child => child.name === 'tower-corner-post')).toBe(true)
      expect(mesh.children.some(child => child.name === 'tower-roof-outline')).toBe(true)
      expect(mesh.children.some(child => child.name === 'technical-planar-grid')).toBe(false)
      expect(mesh.children.some(child => child.name === 'holographic-contour')).toBe(false)
    }

    expect(glassMaterials.size).toBe(1)
  })

  it('raises only the tallest tower above a flat parapet', () => {
    const runtime = createRuntime()
    const tallest = runtime.meshes['tower-01-back-high']
    const neighbour = runtime.meshes['tower-02']
    expect(tallest).toBeDefined()
    expect(neighbour).toBeDefined()
    if (!tallest || !neighbour) return

    expect(boundingSize(tallest).y).toBeGreaterThan(boundingSize(neighbour).y)
  })

  it('keeps seven original and seven outer towers at their approved positions', () => {
    const runtime = createRuntime()
    const towerIds = Object.keys(runtime.meshes).filter(id => id.startsWith('tower-'))
    expect(towerIds).toHaveLength(14)

    for (const [id, layout] of Object.entries(ORIGINAL_LAYOUT)) {
      const node = runtime.nodes[id]
      expect(node).toBeDefined()
      expect(Math.hypot(node.position.x, node.position.z)).toBeCloseTo(layout.radius, 4)
      const angle = ((Math.atan2(node.position.z, node.position.x) * 180 / Math.PI) + 360) % 360
      expect(angle).toBeCloseTo(layout.angle, 3)
    }

    for (const id of OUTER_IDS) {
      const node = runtime.nodes[id]
      const layout = OUTER_LAYOUT[id]
      expect(node).toBeDefined()
      expect(Math.hypot(node.position.x, node.position.z)).toBeCloseTo(layout.radius, 4)
      const angle = ((Math.atan2(node.position.z, node.position.x) * 180 / Math.PI) + 360) % 360
      expect(angle).toBeCloseTo(layout.angle, 4)
    }
  })

  it('keeps the ring inside the base shell', () => {
    const runtime = createRuntime()

    for (const id of RING_IDS) {
      const node = runtime.nodes[id]
      const radius = Math.hypot(node.position.x, node.position.z)
      const halfDiagonal = Math.SQRT2 * footprintHalf(runtime, id)
      expect(radius + halfDiagonal).toBeLessThanOrEqual(3.07)
      expect(radius - halfDiagonal).toBeGreaterThanOrEqual(2.15)
    }

  })

  it('pulls the original towers onto a shared inner face around the mid collar', () => {
    const runtime = createRuntime()

    for (const id of ORIGINAL_IDS.filter(id => id !== 'tower-04')) {
      expect(innerFace(runtime, id), id).toBeGreaterThanOrEqual(1.47)
      expect(innerFace(runtime, id), id).toBeLessThanOrEqual(1.53)
    }

    // Removing tower-15 does not move tower-04 from its approved radius.
    expect(innerFace(runtime, 'tower-04')).toBeGreaterThan(1.70)
  })

  it('keeps every tower clear of its nearest neighbour', () => {
    const runtime = createRuntime()

    for (const id of ALL_IDS) {
      const nearest = Math.min(
        ...ALL_IDS.filter(other => other !== id).map(other => clearance(runtime, id, other)),
      )
      expect(nearest, `${id} nearest gap`).toBeGreaterThanOrEqual(0.10)
    }
  })

  it('gives every remaining outer tower a sector plinth', () => {
    const runtime = createRuntime()
    const hasPlinth = (id: string) => runtime.meshes[id].children.some(child => child.name === 'tower-plinth')

    for (const id of RING_IDS) expect(hasPlinth(id), id).toBe(true)
  })

  it('keeps every new tower below the ring parapet and tower-01 tallest', () => {
    for (const id of OUTER_IDS) expect(TOWER_TARGETS[id]).toBeLessThanOrEqual(2.2)
    const tallest = Object.entries(TOWER_TARGETS).sort((a, b) => b[1] - a[1])[0]
    expect(tallest[0]).toBe('tower-01-back-high')
  })
})
