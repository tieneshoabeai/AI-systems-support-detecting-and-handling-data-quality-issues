// The tower ring: build order, placement, the shared tower materials and the riser animation
// (CODE ARCHITECTURE IMPROVEMENT PLAN, Phase 4 / S1). createTowerRing is a straight relocation of the
// factory block it was cut from and must keep running at exactly that position: the I1-I7 conditions at
// the top of the factory say which later steps read what it leaves in runtime.meshes and runtime.nodes.
import * as THREE from 'three'
import { createDataViewRoofSheets } from '../neon-cube/neon-cube.model'
import type { ProceduralModelRuntime } from './generated-core'
import { ORIGINAL_TOWERS, OUTER_TOWERS, TOWER_BASE_Y, TOWER_IDS, type TowerRecord } from './tower-config'
import { buildTowerArchitecture, createOctagonalTowerGeometry, createTowerMaterials } from './tower-architecture'
import { HERO_GAUGES } from './tower-gauge-config'

const heroShapes = new Map(HERO_GAUGES.map(target => [target.towerId, target.shape]))

// The generated reference still contains the original nine towers. Remove retired ones
// before materials, architecture, picking or detach registries read the runtime.
export function removeInactiveGeneratedTowers(runtime: ProceduralModelRuntime) {
  for (const id of Object.keys(runtime.meshes)) {
    if (!id.startsWith('tower-') || TOWER_IDS.includes(id)) continue
    const mesh = runtime.meshes[id]
    runtime.nodes[id].removeFromParent()
    // Each generated tower owns its BoxGeometry; its material is shared with retained parts.
    mesh.geometry.dispose()
    delete runtime.nodes[id]
    delete runtime.meshes[id]
    delete runtime.colliders[id]
    delete runtime.destructionGroups[id]
  }
}

function createOuterTowers(runtime: ProceduralModelRuntime, model: THREE.Object3D, plinthMaterial: THREE.Material) {
  const root = runtime.nodes['root'] ?? model
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
        heroShapes.has(tower.id)
          ? createOctagonalTowerGeometry(tower.width + 0.04, 0.0425, tower.depth + 0.04)
          : new THREE.BoxGeometry(tower.width + 0.04, 0.0425, tower.depth + 0.04),
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
  }
}

// Active original towers are conformed before the detach registry takes a radial
// direction from node.position and the selection contours read the rebuilt geometry.
export function conformOriginalTowers(runtime: ProceduralModelRuntime) {
  // Only retained original towers are conformed here: the outer ring is built later at its own
  // sector-plate base height. Radii that stay absent keep what the generator produced.
  for (const tower of ORIGINAL_TOWERS) {
    const mesh = runtime.meshes[tower.id]
    const node = runtime.nodes[tower.id]
    if (!mesh || !node) continue
    // Tower geometry is rebuilt at reference height, so it never needs to be stretched.
    mesh.scale.y = 1
    node.position.y = TOWER_BASE_Y + tower.height / 2
    if (tower.pulledRadius !== undefined) {
      const pull = tower.pulledRadius / Math.hypot(node.position.x, node.position.z)
      node.position.x *= pull
      node.position.z *= pull
    }
  }
}

// Everything the factory used to do between the core decoration and the orbit runner, in the same order.
type TowerRiser = {
  mesh: THREE.InstancedMesh
  baseX: Float32Array
  baseZ: Float32Array
  phases: Float32Array
  speeds: Float32Array
  lengths: Float32Array
  height: number
  travelHeight: number
}

const riserMatrix = new THREE.Matrix4()
const riserPosition = new THREE.Vector3()
const riserScale = new THREE.Vector3()
const riserQuaternion = new THREE.Quaternion()

// Data motes drift up inside each glass tower, from the deck to the tower top.
function addTowerRiser(parent: THREE.Object3D, width: number, depth: number, height: number, floorHeight: number, seed: number): TowerRiser {
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
  const riser = { mesh, baseX, baseZ, phases, speeds, lengths, height, travelHeight: height + 2 * floorHeight }
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
        // The leading tip reaches two floors above the roof.
        -height / 2 + travel * (riser.travelHeight - lengths[index]) + lengths[index] / 2,
        baseZ[index] + Math.cos(elapsedSeconds * 1.3 + phases[index] * 6.283) * 0.012,
      )
      riserScale.set(1, lengths[index], 1)
      riserMatrix.compose(riserPosition, riserQuaternion, riserScale)
      mesh.setMatrixAt(index, riserMatrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
}

const cyanRoofTowers = new Set(['tower-01-back-high', 'tower-08', 'tower-03'])
const riserTowers = new Set(['tower-09', 'tower-07', 'tower-16', 'tower-02', 'tower-04'])

export function createTowerRing(runtime: ProceduralModelRuntime, model: THREE.Object3D): {
  update(elapsedSeconds: number): void
  reset(): void
} {
  // Shared architectural palette: deep-blue glass volumes, dark structural frames and a soft
  // window glow, with shared materials across all active towers.
  const materials = createTowerMaterials()
  const { tone: towerTone, plinth } = materials
  createOuterTowers(runtime, model, plinth)
  // Build order: retained generated originals first, then the second ring. Several things key off
  // this list — the detach registry walks it as it stands.
  const towerPlan: TowerRecord[] = [...ORIGINAL_TOWERS, ...OUTER_TOWERS]
  const risers: TowerRiser[] = []
  for (const tower of towerPlan) {
    const mesh = runtime.meshes[tower.id]
    if (!mesh) continue
    const shape = heroShapes.get(tower.id) ?? 'box'
    buildTowerArchitecture(runtime, tower.id, tower.width, tower.height, tower.depth, towerTone, shape, materials)
    const floorHeight = tower.height / THREE.MathUtils.clamp(Math.round(tower.height / 0.22), 3, 16)
    if (cyanRoofTowers.has(tower.id)) {
      const side = tower.width * 2 / 3
      const height = floorHeight * 2 / 3
      const sheets = createDataViewRoofSheets(side, height)
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(side, height, side), towerTone.glass)
      pillar.name = 'tower-roof-pillar'
      pillar.position.y = tower.height / 2 + height / 2
      sheets.position.y = tower.height / 2 + height
      pillar.renderOrder = 1
      sheets.renderOrder = 3
      sheets.raycast = () => {}
      pillar.raycast = () => {}
      mesh.add(pillar, sheets)
    } else if (riserTowers.has(tower.id)) {
      risers.push(addTowerRiser(mesh, tower.width, tower.depth, tower.height, floorHeight, tower.riserSeed))
    }
  }
  return {
    update: elapsedSeconds => syncTowerRisers(risers, elapsedSeconds),
    reset: () => syncTowerRisers(risers, 0),
  }
}
