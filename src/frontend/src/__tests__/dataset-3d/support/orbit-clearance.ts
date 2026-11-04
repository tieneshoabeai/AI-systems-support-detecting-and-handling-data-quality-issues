// Shared spec for the Tower<->Core clearance measurement (CODE ARCHITECTURE IMPROVEMENT PLAN, S3 /
// Phase 1, method established at change-log P32-P33).
//
// The binding constraint between the towers and the spinning orbit used to live only in a comment in
// `core-visual-config.ts`. This module turns it into numbers that can be pinned. Two callers use it:
//   * the generator `.agents/dataset-3d-core/captures/orbit-tower-clearance.measure.ts`, which also
//     runs the self-checks and writes the baseline;
//   * the shipped gate `src/__tests__/dataset-3d/orbit-clearance.test.ts`, which compares against it.
// Both go through buildClearance(), so a baseline can never be validated by a different spec than the
// one that checks it — same rule as the Phase 0 fingerprint.
//
// Why the shape of the math is what it is:
//   * `orbitGroup.rotation.y = elapsedSeconds * 0.05` (spool-core.ts:634) and `reset()` puts it back
//     to 0 (:618), so every yaw is visited over the lifetime of the scene. Measuring one captured
//     pose would be a narrower claim than it reads.
//   * Rotating a point about world Y leaves its (radius, height) pair untouched, and distance is
//     rotation-invariant, so  min over yaw  min over samples  gap  ==  min over samples  distance to
//     the tower's swept cylindrical shell. The two mins commute: the spin is exact, with no angle
//     sampling. The generator cross-checks this against a real 512-step sweep.
//   * The sampled ring is the analytic torus at 512 angular steps, while the drawn mesh is
//     `TorusGeometry(r, tube, 4, 128)` — a 128-gon inscribed in that circle. The synthetic cloud is
//     therefore slightly OUTSIDE the geometry actually drawn, which is the conservative direction for
//     a "nothing got closer" gate. The generator asserts the two bounding boxes still agree to 0.003.

import * as THREE from 'three'
import { SPOOL_CORE } from '../../../graphics/holographic-core/core-visual-config'

export const ORIGINAL_TOWER_IDS = ['tower-01-back-high', 'tower-02', 'tower-03', 'tower-04', 'tower-07', 'tower-08', 'tower-09']
export const OUTER_TOWER_IDS = ['tower-10', 'tower-12', 'tower-13', 'tower-14', 'tower-16', 'tower-17', 'tower-18']
export const ALL_TOWER_IDS = [...ORIGINAL_TOWER_IDS, ...OUTER_TOWER_IDS]

// Fixed order, never sorted by the measurement: if a tower disappears the lines shift and the diff
// points at the gap, whereas a sort would hide the removal behind a renumbering.
export type OrbitSample = {
  ring: number
  v: THREE.Vector3
  reach: number
  azimuth: number
  bead: boolean
}

const QUANT = 6

function q(value: number): string {
  const normalised = Object.is(value, -0) ? 0 : value
  return normalised.toFixed(QUANT)
}

function vec3(v: THREE.Vector3): string {
  return `${q(v.x)},${q(v.y)},${q(v.z)}`
}

function box3(b: THREE.Box3): string {
  return `${vec3(b.min)}|${vec3(b.max)}`
}

// Mirrors spool-core.ts:441-460: torus ring in XZ, flattened in z, Euler(tiltX about x, yaw about y),
// lifted to centerY. radialSegments is 4, so the tube section is a square and 4 sides is exact.
export function orbitSamples(): OrbitSample[] {
  const out: OrbitSample[] = []
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
export function boxGap(p: THREE.Vector3, box: THREE.Box3): number {
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

// A box spun about the world Y axis sweeps a solid cylindrical shell: every azimuth, radii r0..r1,
// heights y0..y1.
export type SweptShell = { r0: number; r1: number; y0: number; y1: number }

export function sweptShellOf(box: THREE.Box3): SweptShell {
  const span = (a: number, b: number) => [a > 0 ? a : (b < 0 ? -b : 0), Math.max(Math.abs(a), Math.abs(b))] as const
  const [minX, maxX] = span(box.min.x, box.max.x)
  const [minZ, maxZ] = span(box.min.z, box.max.z)
  return { r0: Math.hypot(minX, minZ), r1: Math.hypot(maxX, maxZ), y0: box.min.y, y1: box.max.y }
}

export function sweptGap(p: THREE.Vector3, s: SweptShell, pad: number): number {
  const r = Math.hypot(p.x, p.z)
  const dr = Math.max(s.r0 - r, r - s.r1, 0)
  const dy = Math.max(s.y0 - p.y, p.y - s.y1, 0)
  const outside = Math.hypot(dr, dy)
  if (outside > 0) return outside - pad
  return -(Math.min(r - s.r0, s.r1 - r, p.y - s.y0, s.y1 - p.y) + pad)
}

// Rotate a point about world Y the way orbitGroup.rotation.y does. Used only by the generator's
// brute-force cross-check.
export function spinY(p: THREE.Vector3, theta: number): THREE.Vector3 {
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  return new THREE.Vector3(p.x * cos + p.z * sin, p.y, -p.x * sin + p.z * cos)
}

// Solid cylinder (the platform disc is a body the ring can be inside of).
export function discGap(p: THREE.Vector3, radius: number, y0: number, y1: number): number {
  const radial = Math.hypot(p.x, p.z)
  if (p.y < y0) return Math.hypot(Math.max(radius - radial, 0), y0 - p.y)
  if (p.y > y1) return Math.hypot(Math.max(radius - radial, 0), p.y - y1)
  return radius - radial
}

// Cylindrical surface only: a glass wall is a shell, so being "inside the radius" is not a collision.
export function shellSurfaceGap(p: THREE.Vector3, radius: number, y0: number, y1: number): number {
  const dy = Math.max(y0 - p.y, p.y - y1, 0)
  return Math.hypot(Math.abs(Math.hypot(p.x, p.z) - radius), dy)
}

export type CoreSurface = { name: string; solid: boolean; radius: number; y0: number; y1: number; innerRadius?: number; closed?: boolean; bottomRadius?: number }

export function coreSurfaceGap(p: THREE.Vector3, surface: CoreSurface): number {
  const { radius, y0, y1 } = surface
  if (surface.solid) return discGap(p, radius, y0, y1)
  let gap = shellSurfaceGap(p, radius, y0, y1)
  if (surface.bottomRadius !== undefined) {
    const radial = Math.hypot(p.x, p.z)
    const dr = radius - surface.bottomRadius
    const dy = y1 - y0
    const t = Math.min(1, Math.max(0,
      ((radial - surface.bottomRadius) * dr + (p.y - y0) * dy) / (dr * dr + dy * dy),
    ))
    gap = Math.hypot(radial - surface.bottomRadius - t * dr, p.y - y0 - t * dy)
  }
  if (surface.innerRadius !== undefined) {
    gap = Math.min(gap, shellSurfaceGap(p, surface.innerRadius, y0, y1))
  }
  if (surface.closed) {
    const radial = Math.hypot(p.x, p.z)
    gap = Math.min(gap,
      Math.hypot(Math.max(radial - (surface.bottomRadius ?? radius), 0), p.y - y0),
      Math.hypot(Math.max(radial - radius, 0), p.y - y1),
    )
  }
  return gap
}

// Derived from config, not copied: if a later phase edits SPOOL_CORE, these follow it and the pinned
// gap moves instead of the surface silently disappearing from the measurement.
export function coreSurfaces(): CoreSurface[] {
  const { platform, baseGlass, lowerRoof, lowerBand, chamber, cap } = SPOOL_CORE
  return [
    { name: 'platform-disc', solid: true, radius: platform.radius, y0: platform.centerY - platform.thickness / 2, y1: platform.centerY + platform.thickness / 2 },
    { name: 'base-glass', solid: false, radius: baseGlass.radius, innerRadius: baseGlass.innerRadius, closed: true, y0: baseGlass.centerY - baseGlass.height / 2, y1: baseGlass.centerY + baseGlass.height / 2 },
    { name: 'lower-roof', solid: false, radius: lowerRoof.topRadius, bottomRadius: lowerRoof.bottomRadius, closed: true, y0: lowerRoof.bottomY, y1: lowerRoof.topY },
    { name: 'lower-band', solid: false, radius: lowerBand.radius, y0: lowerBand.centerY - lowerBand.height / 2, y1: lowerBand.centerY + lowerBand.height / 2 },
    { name: 'chamber-glass', solid: false, radius: chamber.radius, y0: chamber.centerY - chamber.height / 2, y1: chamber.centerY + chamber.height / 2 },
    { name: 'chamber-backdrop', solid: false, radius: chamber.radius - chamber.wall - chamber.backdrop.radiusInset, y0: chamber.centerY - chamber.height / 2 + chamber.backdrop.heightInset, y1: chamber.centerY + chamber.height / 2 - chamber.backdrop.heightInset },
    { name: 'cap-envelope', solid: false, radius: cap.outerRadius, y0: cap.bottomY, y1: cap.topY },
  ]
}

export type TowerRecord = {
  id: string
  box: THREE.Box3
  shell: SweptShell
  swept: number
  tube: number
  bead: number
  staticGap: number
}

// Box3.setFromObject ignores `visible`, so every tower box unions its hidden selection contour (a
// child of the tower mesh, scaled 1.002, spool-core.ts/model.ts:1329-1339) and any other hidden
// descendant. That is the conservative direction: a contour can only make a tower look BIGGER, so a
// gap read from this box is never wider than the drawn truth. It is recorded, not corrected.
export function towerRecords(model: THREE.Object3D, points: OrbitSample[]): TowerRecord[] {
  const runtime = model.userData.sculptRuntime as { nodes: Record<string, THREE.Object3D> }
  return ALL_TOWER_IDS.map(id => {
    const node = runtime.nodes[id]
    if (!node) throw new Error(`missing tower node ${id}`)
    const box = new THREE.Box3().setFromObject(node)
    const shell = sweptShellOf(box)
    let swept = Infinity
    let tube = Infinity
    let bead = Infinity
    let staticGap = Infinity
    for (const p of points) {
      const pad = p.bead ? SPOOL_CORE.orbits.sphereRadius : 0
      const g = sweptGap(p.v, shell, pad)
      if (g < swept) swept = g
      if (p.bead) { if (g < bead) bead = g }
      else if (g < tube) tube = g
      const s = boxGap(p.v, box) - pad
      if (s < staticGap) staticGap = s
    }
    return { id, box, shell, swept, tube, bead, staticGap }
  })
}

// The pinned block. One line per measured relation, every float quantised to 6 decimals BEFORE the
// comparison, so a platform that differs in the last bit of Math.sin still produces the same text.
export function buildClearance(model: THREE.Object3D): string[] {
  model.updateMatrixWorld(true)
  const points = orbitSamples()
  const lines: string[] = []

  const tube = model.getObjectByName('spool-orbit-tubes') as THREE.Mesh
  if (!tube) throw new Error('missing spool-orbit-tubes')
  const built = new THREE.Box3().setFromObject(tube)
  const synthetic = new THREE.Box3()
  for (const p of points) if (!p.bead) synthetic.expandByPoint(p.v)
  const drift = Math.max(...(['x', 'y', 'z'] as const).flatMap(a => [
    Math.abs(built.min[a] - synthetic.min[a]),
    Math.abs(built.max[a] - synthetic.max[a]),
  ]))
  lines.push(`orbit|samples=${points.length}|mesh|bbox=${box3(built)}`)
  lines.push(`orbit|samples=${points.length}|synthetic|bbox=${box3(synthetic)}|drift=${q(drift)}`)
  // The drawn mesh is a 128-gon inscribed in the analytic ring, so its own outermost vertex sits
  // slightly inside the synthetic cloud's max reach. Both are pinned: if they ever separate by more
  // than the sagitta, spool-core has changed the orbit and this spec's mirroring is what broke.
  const position = tube.geometry.getAttribute('position')
  const probe = new THREE.Vector3()
  let meshReach = 0
  for (let index = 0; index < position.count; index += 1) {
    probe.fromBufferAttribute(position, index).applyMatrix4(tube.matrixWorld)
    meshReach = Math.max(meshReach, Math.hypot(probe.x, probe.z))
  }
  lines.push(`orbit|maxReach=${q(Math.max(...points.filter(p => !p.bead).map(p => p.reach)))}|meshReach=${q(meshReach)}`)

  for (const record of towerRecords(model, points)) {
    lines.push(`tower|${record.id}|swept=${q(record.swept)}|tube=${q(record.tube)}|bead=${q(record.bead)}` +
      `|static=${q(record.staticGap)}|shell=${q(record.shell.r0)},${q(record.shell.r1)},${q(record.shell.y0)},${q(record.shell.y1)}` +
      `|box=${box3(record.box)}`)
  }

  for (const s of coreSurfaces()) {
    let gap = Infinity
    let worst = points[0]
    for (const p of points) {
      const g = coreSurfaceGap(p.v, s) - (p.bead ? SPOOL_CORE.orbits.sphereRadius : 0)
      if (g < gap) { gap = g; worst = p }
    }
    lines.push(`core|${s.name}|r=${q(s.radius)}|y=${q(s.y0)},${q(s.y1)}` +
      (s.innerRadius !== undefined ? `|inner=${q(s.innerRadius)}` : '') +
      (s.bottomRadius !== undefined ? `|bottomRadius=${q(s.bottomRadius)}` : '') +
      (s.closed ? '|closed=1' : '') + `|gap=${q(gap)}` +
      `|at=ring ${worst.ring},${worst.bead ? 'bead' : 'tube'},reach ${q(worst.reach)},y ${q(worst.v.y)}`)
  }
  return lines
}
