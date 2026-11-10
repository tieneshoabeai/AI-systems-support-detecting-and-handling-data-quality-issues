import * as THREE from 'three'
import type { DimensionScore } from '../../types/datasets/quality-score.types'
import type { ProceduralModelRuntime } from './generated-core'
import { CELL_GAIN, CONTEXT_GAUGES, DIMENSIONS, GAUGE_COLOR, HERO_CELL_COUNT, HERO_GAUGES, heroGaugeDimensions, stateOf, type GaugeTarget, type HeroGaugeTarget } from './tower-gauge-config'
import { deriveCells, type CellKind } from './tower-gauge-data'

const CONTEXT_CELL_EXPOSURE = 0.45

function cellColors(score: number): Record<CellKind, THREE.Color> {
  const state = stateOf(score)
  const base = new THREE.Color(GAUGE_COLOR[state]).multiplyScalar(CELL_GAIN[state])
  const poor = new THREE.Color(GAUGE_COLOR.poor).multiplyScalar(CELL_GAIN.poor)
  const lowerState = state === 'good' ? 'mid' : 'poor'
  return {
    on: base,
    off: new THREE.Color(GAUGE_COLOR.off).multiplyScalar(CELL_GAIN.off),
    invalid: poor,
    duplicate: poor,
    stale: base.clone().multiplyScalar(0.55),
    mismatch: new THREE.Color(GAUGE_COLOR[lowerState]).multiplyScalar(CELL_GAIN[lowerState]),
    verified: base,
    unverified: base.clone().multiplyScalar(0.7),
  }
}

const scoreKey = (target: Pick<GaugeTarget, 'scope' | 'dimension'>) => `${target.scope}/${target.dimension}`

// Check the function's input before changing any buffer. Backend normalization and slice
// semantics remain out of scope; mock updates must still be finite and complete.
function scoresOf(rows: readonly DimensionScore[]) {
  const scores = new Map<string, number>()
  for (const row of rows) {
    const key = scoreKey(row)
    if (scores.has(key)) throw new Error(`Tower gauge: duplicate score ${key}`)
    if (!Number.isFinite(row.score) || row.score < 0 || row.score > 1) {
      throw new RangeError(`Tower gauge: score ${key} must be finite and inside 0..1`)
    }
    scores.set(key, row.score)
  }
  // The source still supplies 6 dimensions × 3 scopes, even when a tower is removed.
  for (const scope of ['overall', 'sliceA', 'sliceB'] as const) {
    for (const dimension of DIMENSIONS) {
      const key = scoreKey({ scope, dimension })
      if (!scores.has(key)) throw new Error(`Tower gauge: missing score ${key}`)
    }
  }
  return scores
}

type ContextWindows = { target: GaugeTarget; mesh: THREE.InstancedMesh; markLevels: number[]; levelCount: number }
type HeroColumn = { target: HeroGaugeTarget; mesh: THREE.InstancedMesh }

function paintContext(binding: ContextWindows, score: number) {
  const cells = deriveCells(binding.target.dimension, score, binding.levelCount)
  const colors = cellColors(score)
  // Several cell kinds share a Color instance. Apply exposure once per distinct color.
  for (const color of new Set(Object.values(colors))) color.multiplyScalar(CONTEXT_CELL_EXPOSURE)
  colors.off.set('#14203f')
  const green = new THREE.Color(GAUGE_COLOR.good).multiplyScalar(CELL_GAIN.good * CONTEXT_CELL_EXPOSURE)
  binding.markLevels.forEach((level, index) => {
    let color = colors[cells[level]]
    if (binding.target.towerId === 'tower-01-back-high' && cells[level] === 'off') {
      const fromTop = binding.levelCount - 1 - level
      color = fromTop % 2 === 0 ? green : colors.invalid
    }
    binding.mesh.setColorAt(index, color)
  })
  if (binding.mesh.instanceColor) binding.mesh.instanceColor.needsUpdate = true
}

function buildHeroColumn(runtime: ProceduralModelRuntime, target: HeroGaugeTarget, geometry: THREE.BufferGeometry, material: THREE.Material): HeroColumn {
  const tower = runtime.meshes[target.towerId]
  tower.geometry.computeBoundingBox()
  const size = tower.geometry.boundingBox!.getSize(new THREE.Vector3())
  const form = heroGaugeDimensions(size.x, size.y, size.z)
  const mesh = new THREE.InstancedMesh(geometry, material, HERO_CELL_COUNT * 4)
  mesh.name = 'hero-glass-arms'
  mesh.frustumCulled = false
  mesh.renderOrder = 4
  mesh.raycast = () => {}
  const arms = [
    { x: 0, z: (form.coreDepth + form.armDepth) / 2, w: form.coreWidth, d: form.armDepth },
    { x: 0, z: -(form.coreDepth + form.armDepth) / 2, w: form.coreWidth, d: form.armDepth },
    { x: (form.coreWidth + form.armWidth) / 2, z: 0, w: form.armWidth, d: form.coreDepth },
    { x: -(form.coreWidth + form.armWidth) / 2, z: 0, w: form.armWidth, d: form.coreDepth },
  ]
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  arms.forEach((arm, face) => {
    for (let level = 0; level < HERO_CELL_COUNT; level += 1) {
      position.set(arm.x, form.cellBottom + form.cellHeight / 2 + level * form.cellPitch, arm.z)
      scale.set(arm.w, form.cellHeight, arm.d)
      matrix.compose(position, rotation, scale)
      mesh.setMatrixAt(face * HERO_CELL_COUNT + level, matrix)
    }
  })
  mesh.instanceMatrix.needsUpdate = true
  tower.add(mesh)
  return { target, mesh }
}

function paintHero(column: HeroColumn, score: number) {
  // Hero bands identify the dimension's overall state, not separate error types per band.
  // Context windows retain deriveCells; all forty hero instances share one hue and gain.
  const state = stateOf(score)
  const color = new THREE.Color(GAUGE_COLOR[state]).multiplyScalar(CELL_GAIN[state])
  for (let index = 0; index < column.mesh.count; index += 1) column.mesh.setColorAt(index, color)
  if (column.mesh.instanceColor) column.mesh.instanceColor.needsUpdate = true
}

// Four L by L/4 glass bars, ten bands each; all faces encode the same score. Matrices stay
// fixed so error states never swell the glass into the metal corners. Only color changes.
export function createTowerGauge(runtime: ProceduralModelRuntime, rows: readonly DimensionScore[]) {
  let scores = scoresOf(rows)
  const contexts: ContextWindows[] = CONTEXT_GAUGES.map(target => {
    const mesh = runtime.meshes[target.towerId]?.getObjectByName('tower-window-panel')
    if (!(mesh instanceof THREE.InstancedMesh)) throw new Error(`Tower gauge: missing window panel for ${target.towerId}`)
    const markLevels: unknown = mesh.userData.markLevels
    if (!Array.isArray(markLevels) || markLevels.length !== mesh.count || !markLevels.length ||
        !markLevels.every(level => Number.isInteger(level) && level >= 0)) {
      throw new Error(`Tower gauge: invalid mark levels for ${target.towerId}`)
    }
    return { target, mesh, markLevels, levelCount: Math.max(...markLevels) + 1 }
  })
  for (const target of HERO_GAUGES) {
    const tower = runtime.meshes[target.towerId]
    if (!tower) throw new Error(`Tower gauge: missing hero ${target.towerId}`)
    if (tower.getObjectByName('hero-glass-arms')) throw new Error(`Tower gauge: hero already initialized ${target.towerId}`)
  }
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshPhysicalMaterial({
    // Emission carries the score hue; black diffuse avoids adding the same color a second
    // time under scene lights and pushing healthy bands into bloom. Specular remains physical.
    color: '#000000', transparent: true, opacity: 0.65, depthWrite: false,
    roughness: 0.15, metalness: 0.04, clearcoat: 0.6, toneMapped: false,
    emissive: '#ffffff', emissiveIntensity: 1,
  })
  // Physical glass still reflects the scene, but the data color must survive blue scene lights.
  // Three applies instanceColor only to diffuse by default; tint emission with that same color.
  material.onBeforeCompile = shader => {
    const chunk = '#include <emissivemap_fragment>'
    if (!shader.fragmentShader.includes(chunk)) throw new Error('Tower gauge glass: emissive shader chunk missing')
    shader.fragmentShader = shader.fragmentShader.replace(chunk, `${chunk}
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
  totalEmissiveRadiance *= vColor.rgb;
#endif`)
  }
  material.customProgramCacheKey = () => 'tower-gauge-glass-instance-emission-v1'
  const heroes = HERO_GAUGES.map(target => buildHeroColumn(runtime, target, geometry, material))
  let selectedId: string | null = null
  let disposed = false
  const assertActive = () => {
    if (disposed) throw new Error('Tower gauge: controller is disposed')
  }
  const repaint = () => {
    contexts.forEach(binding => paintContext(binding, scores.get(scoreKey(binding.target))!))
    heroes.forEach(column => paintHero(column, scores.get(scoreKey(column.target))!))
  }
  repaint()
  return {
    applyScores(next: readonly DimensionScore[]) {
      assertActive()
      scores = scoresOf(next)
      repaint()
    },
    setSelected(id: string | null) {
      assertActive()
      selectedId = heroes.some(column => column.target.towerId === id) ? id : null
    },
    // Keep selection independent of score colors. The existing outline remains the visual
    // feedback; Phase 4 can read this live target without a second selection registry.
    getSelected() {
      assertActive()
      const column = heroes.find(column => column.target.towerId === selectedId)
      return column ? { target: column.target, mesh: column.mesh, score: scores.get(scoreKey(column.target))! } : null
    },
    dispose() {
      if (disposed) return
      disposed = true
      heroes.forEach(({ mesh }) => { mesh.removeFromParent(); mesh.dispose() })
      geometry.dispose()
      material.dispose()
      selectedId = null
    },
  }
}
