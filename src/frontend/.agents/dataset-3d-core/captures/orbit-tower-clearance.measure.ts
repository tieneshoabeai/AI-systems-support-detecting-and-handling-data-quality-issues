// Orbit-to-tower / orbit-to-core clearance, measured from the REAL scene graph.
//
// Why this exists: change-log §7.2 used to assert containment with v3 arithmetic (orbits at
// y~1.96, radii 1.96-2.20) that P26 replaced. A tilted, flattened torus is not a circle in plan
// view, so "orbit radius < tower inner radius" is not a statement you can evaluate from `radii`
// alone — the reach of a ring depends on azimuth AND on y. This harness samples the actual vertex
// cloud and reports exact distances.
//
// Run from src/frontend:
//   npx vitest run --config .agents/dataset-3d-core/captures/vitest.measure.config.ts
//
// Two rules make the numbers trustworthy:
//   1. The synthetic ring is checked against the merged mesh's own Box3 (assert < 0.003), so if
//      spool-core.ts changes the pipeline, this harness goes red instead of lying.
//   2. Towers are axis-aligned boxes, so point-to-AABB distance is exact — no hull approximation.

import * as THREE from 'three'
import { expect, it } from 'vitest'
import { createHolographicCoreProductModel } from '../../../src/graphics/holographic-core/holographic-core.model'
import { SPOOL_CORE } from '../../../src/graphics/holographic-core/core-visual-config'

const ORIGINAL_IDS = ['tower-01-back-high', 'tower-02', 'tower-03', 'tower-04', 'tower-05', 'tower-06', 'tower-07', 'tower-08', 'tower-09']
const OUTER_IDS = ['tower-10', 'tower-11', 'tower-12', 'tower-13', 'tower-14', 'tower-15', 'tower-16', 'tower-17', 'tower-18']
const ALL_IDS = [...ORIGINAL_IDS, ...OUTER_IDS]
const TOWER_15_WINDOW: [number, number] = [336.78, 353.74]

type Sample = { ring: number; v: THREE.Vector3; reach: number; azimuth: number; bead: boolean }

// Mirrors spool-core.ts:441-460: torus ring in XZ, flattened in z, Euler(tiltX about x, yaw about
// y), lifted to centerY. radialSegments is 4, so the tube is a square section and 4 sides is exact.
function orbitSamples(): Sample[] {
  const out: Sample[] = []
  const euler = new THREE.Euler()
  const rotation = new THREE.Matrix4()
  const v = new THREE.Vector3()
  const push = (ring: number, bead: boolean) => {
    out.push({
      ring,
      v: v.clone(),
      reach: Math.hypot(v.x, v.z) + (bead ? SPOOL_CORE.orbits.sphereRadius : 0),
      azimuth: (THREE.MathUtils.radToDeg(Math.atan2(v.z, v.x)) + 360) % 360,
      bead,
    })
  }
  SPOOL_CORE.orbits.radii.forEach((radius, index) => {
    euler.set(SPOOL_CORE.orbits.tiltX[index], SPOOL_CORE.orbits.yaw[index], 0)
    rotation.makeRotationFromEuler(euler)
    for (let step = 0; step < 512; step += 1) {
      const angle = (step / 512) * Math.PI * 2
      for (let side = 0; side < 4; side += 1) {
        const phi = (side / 4) * Math.PI * 2
        const ring = radius + Math.cos(phi) * SPOOL_CORE.orbits.tube
        v.set(Math.cos(angle) * ring, Math.sin(phi) * SPOOL_CORE.orbits.tube, Math.sin(angle) * ring * SPOOL_CORE.orbits.flatten)
        v.applyMatrix4(rotation)
        v.y += SPOOL_CORE.orbits.centerY
        push(index + 1, false)
      }
    }
    for (let bead = 0; bead < 2; bead += 1) {
      const angle = 0.7 + bead * 2.9 + index * 0.8
      v.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius * SPOOL_CORE.orbits.flatten)
      v.applyMatrix4(rotation)
      v.y += SPOOL_CORE.orbits.centerY
      push(index + 1, true)
    }
  })
  return out
}

// Exact for an axis-aligned box: 0 on the surface, positive outside, negative inside.
function boxGap(p: THREE.Vector3, box: THREE.Box3) {
  const dx = Math.max(box.min.x - p.x, p.x - box.max.x, 0)
  const dy = Math.max(box.min.y - p.y, p.y - box.max.y, 0)
  const dz = Math.max(box.min.z - p.z, p.z - box.max.z, 0)
  const outside = Math.hypot(dx, dy, dz)
  if (outside > 0) return outside
  return -Math.min(...(['x', 'y', 'z'] as const).map(axis => {
    const lo = box.min[axis]
    const hi = box.max[axis]
    return p[axis] >= lo ? p[axis] - lo : hi - p[axis]
  }))
}

// Solid cylinder (the platform disc).
function discGap(p: THREE.Vector3, radius: number, y0: number, y1: number) {
  const radial = Math.hypot(p.x, p.z)
  if (p.y < y0) return Math.hypot(Math.max(radius - radial, 0), y0 - p.y)
  if (p.y > y1) return Math.hypot(Math.max(radius - radial, 0), p.y - y1)
  return radius - radial
}

// Cylindrical surface only (glass walls are shells, so "inside the radius" is not a collision).
function shellGap(p: THREE.Vector3, radius: number, y0: number, y1: number) {
  const dy = Math.max(y0 - p.y, p.y - y1, 0)
  return Math.hypot(Math.abs(Math.hypot(p.x, p.z) - radius), dy)
}

const f = (n: number) => n.toFixed(4)

it('orbit vs tower + core clearance (measurement, not an assertion of taste)', () => {
  const { model } = createHolographicCoreProductModel()
  const runtime = model.userData.sculptRuntime as { nodes: Record<string, THREE.Object3D> }
  model.updateMatrixWorld(true)
  const points = orbitSamples()
  const lines: string[] = []

  // 1. The synthetic cloud must be the real geometry.
  const tube = model.getObjectByName('spool-orbit-tubes') as THREE.Mesh
  expect(tube).toBeTruthy()
  const built = new THREE.Box3().setFromObject(tube)
  const synthetic = new THREE.Box3()
  for (const p of points) if (!p.bead) synthetic.expandByPoint(p.v)
  const spread = (b: THREE.Box3) => `${b.min.toArray().map(f)} .. ${b.max.toArray().map(f)}`
  const drift = Math.max(...(['x', 'y', 'z'] as const).flatMap(a => [
    Math.abs(built.min[a] - synthetic.min[a]),
    Math.abs(built.max[a] - synthetic.max[a]),
  ]))
  lines.push(`merged mesh bbox  ${spread(built)}`)
  lines.push(`synthetic bbox    ${spread(synthetic)}   drift ${f(drift)}`)
  expect(drift).toBeLessThan(0.003)

  // 2. Tower footprints: nearest approach to the axis, and the azimuth each one occupies.
  const boxes = new Map<string, THREE.Box3>()
  for (const id of ALL_IDS) {
    const node = runtime.nodes[id]
    expect(node, `missing tower ${id}`).toBeTruthy()
    boxes.set(id, new THREE.Box3().setFromObject(node))
  }
  const faceOf = (box: THREE.Box3) => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    return Math.hypot(clamp(0, box.min.x, box.max.x), clamp(0, box.min.z, box.max.z))
  }
  const azimuthOf = (x: number, z: number) => (THREE.MathUtils.radToDeg(Math.atan2(z, x)) + 360) % 360
  const faces = ALL_IDS.map(id => ({ id, face: faceOf(boxes.get(id)!) })).sort((a, b) => a.face - b.face)
  lines.push(`tower inner faces: ${faces.slice(0, 3).map(x => `${x.id} ${f(x.face)}`).join(', ')}`)
  const t15 = boxes.get('tower-15')!
  const t15Corners = [
    [t15.min.x, t15.min.z], [t15.min.x, t15.max.z], [t15.max.x, t15.min.z], [t15.max.x, t15.max.z],
  ].map(([x, z]) => azimuthOf(x, z))
  lines.push(`tower-15 bbox x ${f(t15.min.x)}..${f(t15.max.x)} y ${f(t15.min.y)}..${f(t15.max.y)} z ${f(t15.min.z)}..${f(t15.max.z)}`)
  lines.push(`tower-15 azimuth window ${f(Math.min(...t15Corners))}..${f(Math.max(...t15Corners))}`)
  TOWER_15_WINDOW[0] = Math.min(...t15Corners)
  TOWER_15_WINDOW[1] = Math.max(...t15Corners)

  // 3. Per ring: reach extremes, height band, and true 3D gap to the binding tower.
  lines.push('')
  let globalMin = Infinity
  for (const ring of [1, 2, 3, 4]) {
    const rp = points.filter(p => p.ring === ring)
    const tubeOnly = rp.filter(p => !p.bead)
    const minReach = tubeOnly.reduce((a, b) => (b.reach < a.reach ? b : a))
    const maxReach = tubeOnly.reduce((a, b) => (b.reach > a.reach ? b : a))
    const beadMax = rp.filter(p => p.bead).reduce((a, b) => (b.reach > a.reach ? b : a))
    let binding = { gap: Infinity, id: '' }
    for (const p of rp) for (const id of ALL_IDS) {
      const gap = boxGap(p.v, boxes.get(id)!) - (p.bead ? SPOOL_CORE.orbits.sphereRadius : 0)
      if (gap < binding.gap) binding = { gap, id }
    }
    globalMin = Math.min(globalMin, binding.gap)
    const inWindow = rp.filter(p => p.azimuth >= TOWER_15_WINDOW[0] && p.azimuth <= TOWER_15_WINDOW[1])
    const windowReach = Math.max(...inWindow.map(p => p.reach))
    lines.push(`ring ${ring} r${f(SPOOL_CORE.orbits.radii[ring - 1])} y ${f(Math.min(...rp.map(p => p.v.y)))}..${f(Math.max(...rp.map(p => p.v.y)))}`)
    lines.push(`   reach  min ${f(minReach.reach)} @${f(minReach.azimuth)}deg/y${f(minReach.v.y)}` +
      `  max ${f(maxReach.reach)} @${f(maxReach.azimuth)}deg/y${f(maxReach.v.y)}  bead max ${f(beadMax.reach)} @${f(beadMax.azimuth)}deg`)
    lines.push(`   gap to ${binding.id} ${f(binding.gap)};  inside tower-15 azimuth window: max reach ${f(windowReach)} vs face ${f(faces[0].face)} -> radial spare ${f(faces[0].face - windowReach)}`)
  }
  expect(globalMin).toBeGreaterThan(0)

  // 4. Everything the ring passes near on the core side, and the cap.
  lines.push('')
  const outerFace = faces.find(x => x.id !== 'tower-15')!
  const maxReachAll = Math.max(...points.map(p => p.reach))
  lines.push(`global max reach (beads included) ${f(maxReachAll)} vs nearest non-15 face ${outerFace.id} ${f(outerFace.face)} -> spare ${f(outerFace.face - maxReachAll)}`)
  const surfaces = [
    { name: 'platform disc', solid: true, radius: SPOOL_CORE.platform.radius, y0: SPOOL_CORE.platform.centerY - SPOOL_CORE.platform.thickness / 2, y1: SPOOL_CORE.platform.centerY + SPOOL_CORE.platform.thickness / 2 },
    { name: 'base glass', solid: false, radius: SPOOL_CORE.baseGlass.radius, y0: SPOOL_CORE.baseGlass.centerY - SPOOL_CORE.baseGlass.height / 2, y1: SPOOL_CORE.baseGlass.centerY + SPOOL_CORE.baseGlass.height / 2 },
    { name: 'lower band', solid: false, radius: SPOOL_CORE.lowerBand.radius, y0: SPOOL_CORE.lowerBand.centerY - SPOOL_CORE.lowerBand.height / 2, y1: SPOOL_CORE.lowerBand.centerY + SPOOL_CORE.lowerBand.height / 2 },
    { name: 'chamber glass', solid: false, radius: SPOOL_CORE.chamber.radius, y0: SPOOL_CORE.chamber.centerY - SPOOL_CORE.chamber.height / 2, y1: SPOOL_CORE.chamber.centerY + SPOOL_CORE.chamber.height / 2 },
    { name: 'backdrop', solid: false, radius: SPOOL_CORE.chamber.radius - SPOOL_CORE.chamber.wall - SPOOL_CORE.chamber.backdrop.radiusInset, y0: SPOOL_CORE.chamber.centerY - SPOOL_CORE.chamber.height / 2 + SPOOL_CORE.chamber.backdrop.heightInset, y1: SPOOL_CORE.chamber.centerY + SPOOL_CORE.chamber.height / 2 - SPOOL_CORE.chamber.backdrop.heightInset },
    { name: 'cap envelope', solid: false, radius: SPOOL_CORE.cap.outerRadius, y0: SPOOL_CORE.cap.bottomY, y1: SPOOL_CORE.cap.topY },
  ]
  for (const s of surfaces) {
    let gap = Infinity
    let worst = points[0]
    for (const p of points) {
      const g = (s.solid ? discGap : shellGap)(p.v, s.radius, s.y0, s.y1) - (p.bead ? SPOOL_CORE.orbits.sphereRadius : 0)
      if (g < gap) { gap = g; worst = p }
    }
    lines.push(`${gap < 0 ? 'CUTS' : 'clears'} ${s.name} (r ${f(s.radius)}, y ${f(s.y0)}..${f(s.y1)}) by ${f(gap)} at ring ${worst.ring}${worst.bead ? ' bead' : ' tube'} reach ${f(worst.reach)} y ${f(worst.v.y)}`)
  }
  const maxY = Math.max(...points.map(p => p.v.y))
  lines.push(`cap bottomY ${SPOOL_CORE.cap.bottomY} - orbit maxY ${f(maxY)} = ${f(SPOOL_CORE.cap.bottomY - maxY)} vertical (cap clearance is by HEIGHT, not radius)`)
  lines.push('')
  lines.push(`orbit y band ${f(Math.min(...points.map(p => p.v.y)))}..${f(maxY)}, xz bbox ${spread(built)}`)

  console.log(lines.join('\n'))
})
