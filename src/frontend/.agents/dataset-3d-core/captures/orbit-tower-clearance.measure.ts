// Orbit-to-tower / orbit-to-core clearance — generator, self-checks and the pinned baseline.
//
// Why this exists: change-log §7.2 used to assert containment with v3 arithmetic (orbits at y~1.96,
// radii 1.96-2.20) that P26 replaced. A tilted, flattened torus is not a circle in plan view, so
// "orbit radius < tower inner radius" is not a statement you can evaluate from `radii` alone — the
// reach of a ring depends on azimuth AND on y. This harness samples the actual geometry, reports exact
// distances, and writes the numbers that src/__tests__/dataset-3d/orbit-clearance.test.ts pins.
//
// Run from src/frontend:
//   npx vitest run --config .agents/dataset-3d-core/captures/vitest.measure.config.ts
//
// The measurement itself lives in src/__tests__/dataset-3d/support/orbit-clearance.ts, imported by
// both this generator and the shipped test, so a baseline can never be produced by a different spec
// than the one that checks it. What stays HERE is the part that does not belong in `npm test`:
//   1. The synthetic ring is checked against the merged mesh's own Box3 (assert < 0.003), so if
//      spool-core.ts changes the pipeline this harness goes red instead of lying.
//   2. The spin worst case is cross-checked against a real 512-step yaw sweep, so the commutation
//      argument that makes it exact is tested, not trusted.
//   3. The drawn-surface raster (§6) asks whether a Box3 hit is real geometry or empty chamfer. It
//      samples tens of thousands of triangle points, which is why it is a report and not a gate.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as THREE from 'three'
import { expect, it } from 'vitest'
import { createHolographicCoreProductModel } from '../../../src/graphics/holographic-core/holographic-core.model'
import { SPOOL_CORE } from '../../../src/graphics/holographic-core/core-visual-config'
import {
  ALL_TOWER_IDS, type OrbitSample, boxGap, buildClearance, coreSurfaces, coreSurfaceGap, orbitSamples,
  spinY, sweptGap, sweptShellOf, towerRecords,
} from '../../../src/__tests__/dataset-3d/support/orbit-clearance'

const OUT = resolve(process.cwd(), '.agents/dataset-3d-core/fingerprint/p1-orbit-clearance.ndjson')
const BINDING_WINDOW: [number, number] = [0, 0]

const f = (n: number) => n.toFixed(4)

// --- report-only: the DRAWN surface, not the bounding box -----------------------------------------
// Meridian raster of a tower's DRAWN surfaces. Rotating a point about Y keeps its (r, y) and lets it
// reach every azimuth, so for a fixed surface patch T:
//   min over yaw of dist(spinY(p, yaw), T)  ==  dist in the (r, y) plane from (r_p, y_p) to
//   {(hypot(x, z), y) : q in T}
// i.e. the whole 3D sweep collapses to a 2D distance to the projected triangles. That is what
// separates "the tube enters the bounding box" from "the tube touches real geometry": a bevelled
// corner leaves box volume with no surface in it.
const CELL = 0.002
const R_ORIGIN = 1.0
const Y_ORIGIN = 0.3
const cellKey = (ir: number, iy: number) => ir * 4096 + iy

function meridianCellsOf(node: THREE.Object3D, step: number) {
  const cells = new Map<number, string>()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const p = new THREE.Vector3()
  node.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return
    const position = mesh.geometry.getAttribute('position')
    if (!position) return
    const index = mesh.geometry.getIndex()
    const matrices: THREE.Matrix4[] = []
    if (mesh instanceof THREE.InstancedMesh) {
      for (let s = 0; s < mesh.count; s += 1) {
        const local = new THREE.Matrix4()
        mesh.getMatrixAt(s, local)
        matrices.push(new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, local))
      }
    } else {
      matrices.push(mesh.matrixWorld)
    }
    const faces = Math.floor((index ? index.count : position.count) / 3)
    for (let t = 0; t < faces; t += 1) {
      const corners = index
        ? [index.getX(3 * t), index.getX(3 * t + 1), index.getX(3 * t + 2)]
        : [3 * t, 3 * t + 1, 3 * t + 2]
      for (const matrix of matrices) {
        a.fromBufferAttribute(position, corners[0]).applyMatrix4(matrix)
        b.fromBufferAttribute(position, corners[1]).applyMatrix4(matrix)
        c.fromBufferAttribute(position, corners[2]).applyMatrix4(matrix)
        ab.subVectors(b, a)
        ac.subVectors(c, a)
        const n = Math.min(240, Math.max(2, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / step)))
        for (let i = 0; i <= n; i += 1) for (let j = 0; j <= n - i; j += 1) {
          p.copy(a).addScaledVector(ab, i / n).addScaledVector(ac, j / n)
          const k = cellKey(Math.round((Math.hypot(p.x, p.z) - R_ORIGIN) / CELL), Math.round((p.y - Y_ORIGIN) / CELL))
          if (!cells.has(k)) cells.set(k, mesh.name)
        }
      }
    }
  })
  return cells
}

// Distance from one orbit point to the nearest covered cell, minus its own radius.
function surfaceGapOf(v: THREE.Vector3, cells: Map<number, string>, pad: number) {
  const ir = Math.round((Math.hypot(v.x, v.z) - R_ORIGIN) / CELL)
  const iy = Math.round((v.y - Y_ORIGIN) / CELL)
  const window = Math.ceil(0.06 / CELL)
  let best = Infinity
  let owner = ''
  for (let dr = -window; dr <= window; dr += 1) for (let dy = -window; dy <= window; dy += 1) {
    const ownerHere = cells.get(cellKey(ir + dr, iy + dy))
    if (ownerHere === undefined) continue
    const d = Math.hypot(dr * CELL, dy * CELL)
    if (d < best) { best = d; owner = ownerHere }
  }
  return { gap: best - pad, owner, found: best < Infinity }
}

it('orbit vs tower + core clearance (measurement, not an assertion of taste)', () => {
  expect(existsSync(resolve(process.cwd(), '.agents/dataset-3d-core')), `run from src/frontend, not ${process.cwd()}`).toBe(true)
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
  for (const id of ALL_TOWER_IDS) {
    const node = runtime.nodes[id]
    expect(node, `missing tower ${id}`).toBeTruthy()
    boxes.set(id, new THREE.Box3().setFromObject(node))
  }
  const faceOf = (box: THREE.Box3) => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    return Math.hypot(clamp(0, box.min.x, box.max.x), clamp(0, box.min.z, box.max.z))
  }
  const azimuthOf = (x: number, z: number) => (THREE.MathUtils.radToDeg(Math.atan2(z, x)) + 360) % 360
  const faces = ALL_TOWER_IDS.map(id => ({ id, face: faceOf(boxes.get(id)!) })).sort((a, b) => a.face - b.face)
  lines.push(`tower inner faces: ${faces.slice(0, 3).map(x => `${x.id} ${f(x.face)}`).join(', ')}`)
  const bindingId = faces[0].id
  const bindingBox = boxes.get(bindingId)!
  const bindingCorners = [
    [bindingBox.min.x, bindingBox.min.z], [bindingBox.min.x, bindingBox.max.z], [bindingBox.max.x, bindingBox.min.z], [bindingBox.max.x, bindingBox.max.z],
  ].map(([x, z]) => azimuthOf(x, z))
  lines.push(`${bindingId} bbox x ${f(bindingBox.min.x)}..${f(bindingBox.max.x)} y ${f(bindingBox.min.y)}..${f(bindingBox.max.y)} z ${f(bindingBox.min.z)}..${f(bindingBox.max.z)}`)
  lines.push(`${bindingId} azimuth window ${f(Math.min(...bindingCorners))}..${f(Math.max(...bindingCorners))}`)
  BINDING_WINDOW[0] = Math.min(...bindingCorners)
  BINDING_WINDOW[1] = Math.max(...bindingCorners)

  // 3. Per ring: reach extremes, height band, and true 3D gap to the binding tower at the captured
  //    yaw (rotation.y = 0).
  lines.push('')
  let globalMin = Infinity
  for (const ring of [1, 2, 3, 4]) {
    const rp = points.filter(p => p.ring === ring)
    const tubeOnly = rp.filter(p => !p.bead)
    const minReach = tubeOnly.reduce((a, b) => (b.reach < a.reach ? b : a))
    const maxReach = tubeOnly.reduce((a, b) => (b.reach > a.reach ? b : a))
    const beadMax = rp.filter(p => p.bead).reduce((a, b) => (b.reach > a.reach ? b : a))
    let binding = { gap: Infinity, id: '' }
    for (const p of rp) for (const id of ALL_TOWER_IDS) {
      const gap = boxGap(p.v, boxes.get(id)!) - (p.bead ? SPOOL_CORE.orbits.sphereRadius : 0)
      if (gap < binding.gap) binding = { gap, id }
    }
    globalMin = Math.min(globalMin, binding.gap)
    const inWindow = rp.filter(p => p.azimuth >= BINDING_WINDOW[0] && p.azimuth <= BINDING_WINDOW[1])
    const windowReach = Math.max(...inWindow.map(p => p.reach))
    lines.push(`ring ${ring} r${f(SPOOL_CORE.orbits.radii[ring - 1])} y ${f(Math.min(...rp.map(p => p.v.y)))}..${f(Math.max(...rp.map(p => p.v.y)))}`)
    lines.push(`   reach  min ${f(minReach.reach)} @${f(minReach.azimuth)}deg/y${f(minReach.v.y)}` +
      `  max ${f(maxReach.reach)} @${f(maxReach.azimuth)}deg/y${f(maxReach.v.y)}  bead max ${f(beadMax.reach)} @${f(beadMax.azimuth)}deg`)
    lines.push(`   gap to ${binding.id} ${f(binding.gap)};  inside ${bindingId} azimuth window: max reach ${f(windowReach)} vs face ${f(faces[0].face)} -> radial spare ${f(faces[0].face - windowReach)}`)
  }
  expect(globalMin).toBeGreaterThan(0)

  // 4. Everything the ring passes near on the core side, and the cap.
  lines.push('')
  const outerFace = faces[0]
  const maxReachAll = Math.max(...points.map(p => p.reach))
  lines.push(`global max reach (beads included) ${f(maxReachAll)} vs nearest tower face ${outerFace.id} ${f(outerFace.face)} -> spare ${f(outerFace.face - maxReachAll)}`)
  for (const s of coreSurfaces()) {
    let gap = Infinity
    let worst: OrbitSample = points[0]
    for (const p of points) {
      const g = coreSurfaceGap(p.v, s) - (p.bead ? SPOOL_CORE.orbits.sphereRadius : 0)
      if (g < gap) { gap = g; worst = p }
    }
    lines.push(`${gap < 0 ? 'CUTS' : 'clears'} ${s.name} (r ${f(s.radius)}, y ${f(s.y0)}..${f(s.y1)}) by ${f(gap)} at ring ${worst.ring}${worst.bead ? ' bead' : ' tube'} reach ${f(worst.reach)} y ${f(worst.v.y)}`)
  }
  const maxY = Math.max(...points.map(p => p.v.y))
  lines.push(`cap bottomY ${SPOOL_CORE.cap.bottomY} - orbit maxY ${f(maxY)} = ${f(SPOOL_CORE.cap.bottomY - maxY)} vertical (cap clearance is by HEIGHT, not radius)`)

  // 5. The spin. orbitGroup.rotation.y = elapsedSeconds * 0.05 (spool-core.ts:634) and reset()
  //    returns it to 0 (:618), so every yaw is visited over time. The core surfaces above are
  //    cylinders on the axis, so they are yaw-invariant; only the towers can get closer.
  lines.push('')
  const swept = towerRecords(model, points).sort((a, b) => a.swept - b.swept)
  const sweptMin = swept[0]
  lines.push(`yaw-invariant worst case (exact): ${sweptMin.id}` +
    ` gap ${f(sweptMin.swept)}  [shell r ${f(sweptMin.shell.r0)}..${f(sweptMin.shell.r1)}, y ${f(sweptMin.shell.y0)}..${f(sweptMin.shell.y1)}]`)
  lines.push(`   ${sweptMin.id} split: glass TUBE worst ${f(sweptMin.tube)} | BEAD worst ${f(sweptMin.bead)}`)
  for (const s of swept.slice(0, 6)) {
    lines.push(`   ${s.swept < 0 ? 'PIERCES' : 'clears'} ${s.id} by ${f(s.swept)} over the full spin` +
      `  (at the captured yaw ${f(s.staticGap)}, loss ${f(s.staticGap - s.swept)})` +
      `  | tube-only ${f(s.tube)}`)
  }
  lines.push(`   the ${swept.filter(s => s.swept >= 0).length} that stay clear, smallest first: ${swept.filter(s => s.swept >= 0).map(s => `${s.id} ${f(s.swept)}`).join(', ')}`)

  // Cross-check the commutation argument by actually sweeping one yaw axis, 512 steps.
  const checkTower = boxes.get(sweptMin.id)!
  let brute = Infinity
  for (let step = 0; step < 512; step += 1) {
    const theta = (step / 512) * Math.PI * 2
    for (const p of points) {
      const g = boxGap(spinY(p.v, theta), checkTower) - (p.bead ? SPOOL_CORE.orbits.sphereRadius : 0)
      if (g < brute) brute = g
    }
  }
  lines.push(`   brute-force 512-yaw sweep of ${sweptMin.id}: ${f(brute)}  -> formula error ${f(Math.abs(brute - sweptMin.swept))}`)
  expect(Math.abs(brute - sweptMin.swept)).toBeLessThan(0.002)
  expect(sweptMin.swept).toBeLessThanOrEqual(globalMin)

  // 6. Box3 or drawn surface? Only points the shell model already calls < 0.06 can bind, because
  //    the box projection contains the surface projection, so the real gap is never smaller.
  lines.push('')
  const cells = meridianCellsOf(runtime.nodes[sweptMin.id], 0.004)
  const shell = sweptShellOf(boxes.get(sweptMin.id)!)
  const candidates = points.filter(p => sweptGap(p.v, shell, p.bead ? SPOOL_CORE.orbits.sphereRadius : 0) < 0.06)
  let surfaceWorst = { gap: Infinity, p: candidates[0], owner: '' }
  for (const key of ['bead', 'tube'] as const) {
    let worst = { gap: Infinity, p: candidates[0], owner: '' }
    let touching = 0
    const total = candidates.filter(p => p.bead === (key === 'bead')).length
    for (const p of candidates) {
      if ((key === 'bead') !== p.bead) continue
      const s = surfaceGapOf(p.v, cells, p.bead ? SPOOL_CORE.orbits.sphereRadius : 0)
      if (s.found && s.gap < 1.5 * CELL) touching += 1
      if (s.found && s.gap < worst.gap) worst = { gap: s.gap, p, owner: s.owner }
    }
    if (!worst.p) {
      lines.push(`   ${key} vs DRAWN surface of ${sweptMin.id}: no nearby raster samples; use the swept box clearance above`)
      continue
    }
    if (worst.gap < surfaceWorst.gap) surfaceWorst = worst
    // A zero-radius sample can only ever read 0 in projection (the silhouette is filled), so 0.0000
    // for the tube means "coincides with a drawn surface at some yaw", NOT "clears". Only padded
    // bodies (the beads) get a measurable depth.
    const verdict = worst.gap < 0 ? `CROSSES by ${f(-worst.gap)}` : worst.gap < 1.5 * CELL ? 'TOUCHES (0 depth: projection cannot measure how deep)' : `clears by ${f(worst.gap)}`
    lines.push(`   ${key} vs DRAWN surface of ${sweptMin.id}: ${verdict}` +
      `  [binding: ring ${worst.p.ring} r ${f(Math.hypot(worst.p.v.x, worst.p.v.z))} y ${f(worst.p.v.y)} cell drawn by ${worst.owner || 'the surface itself'}]` +
      `  ${touching}/${total} candidate ${key} points actually touch it`)
  }
  lines.push(`   raster: ${cells.size} cells @${CELL * 1000} mm, ${candidates.length}/${points.length} points inside the box's swept shell` +
    `  (quantisation error ~${(1.5 * CELL).toFixed(4)})`)
  expect(surfaceWorst.gap).toBeGreaterThanOrEqual(sweptMin.swept - 0.005)

  lines.push('')
  lines.push(`orbit y band ${f(Math.min(...points.map(p => p.v.y)))}..${f(maxY)}, xz bbox ${spread(built)}`)

  // 7. Write the baseline the shipped test pins, and print it so this run quotes the same bytes.
  const baseline = ['# phase1-orbit-clearance', ...buildClearance(model)].join('\n') + '\n'
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, baseline, 'utf8')
  lines.push('')
  lines.push(`baseline -> ${OUT}  ${baseline.length} bytes  sha256 ${createHash('sha256').update(baseline).digest('hex')}`)
  lines.push(baseline.replace(/^/gm, '  '))

  console.log(lines.join('\n'))
})
