// F5 / deviation #12 — how much of the spool chamber actually occludes anything?
//
// A camera ray is BLOCKED only where it lands on a surface that the material's `side` really draws
// and that writes depth. In the chamber exactly one mesh qualifies: `spool-chamber-backdrop`
// (MeshStandardMaterial, no `transparent`, depthWrite true, side BackSide). Every other layer is
// additive with depthWrite:false, so it tints pixels but never occludes them.
//
// Two side rules do all the work and are easy to get wrong:
//   * BackSide culls the NEAR arc, so only the far interior (the second cylinder root) blocks.
//   * `spool-lower-band` is FrontSide, so a ray leaving the chamber hits its BACK face and passes
//     straight through. Measured contribution: 0.0%.
//
// Run from src/frontend:  node .agents/dataset-3d-core/captures/measure-chamber-occlusion.mjs
const CAM = [11.45, 9, 11.45] // INITIAL_CAMERA_POSITION, holographic-core.scene.tsx
const TARGET = [0, 2.1, 0.5] // CAMERA_TARGET
const GLASS = { r: 0.94, y0: 0.99, y1: 1.98 } // inner face of the chamber shell
const WALL = { r: 0.93, y0: 1.002, y1: 1.968, side: 'back' } // spool-chamber-backdrop
const BAND = { r: 1.02, y0: 0.9, y1: 0.99, side: 'front' } // spool-lower-band

function blocks(P, d, m) {
  const A = d[0] * d[0] + d[2] * d[2]
  const B = 2 * (P[0] * d[0] + P[2] * d[2])
  const C = P[0] * P[0] + P[2] * P[2] - m.r * m.r
  const disc = B * B - 4 * A * C
  if (disc <= 0) return false
  for (const t of [(-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A)]) {
    if (t <= 1e-6) continue
    const x = P[0] + d[0] * t
    const y = P[1] + d[1] * t
    const z = P[2] + d[2] * t
    if (y < m.y0 || y > m.y1) continue
    const facing = (x / m.r) * d[0] + (z / m.r) * d[2]
    if (m.side === 'back' && facing > 0) return true // far arc, normal points away from the camera
    if (m.side === 'front' && facing < 0) return true
  }
  return false
}

function* rays(y, step) {
  for (let deg = -89; deg <= 89; deg += step) {
    // azimuth 45deg is the point nearest the camera (+x +z)
    const a = (deg * Math.PI) / 180 + Math.PI / 4
    const P = [Math.cos(a) * GLASS.r, y, Math.sin(a) * GLASS.r]
    const toCam = [CAM[0] - P[0], CAM[1] - P[1], CAM[2] - P[2]]
    const L = Math.hypot(...toCam)
    const normal = [P[0] / GLASS.r, 0, P[2] / GLASS.r]
    const facing = (normal[0] * toCam[0] + normal[2] * toCam[2]) / L
    if (facing <= 0) continue // back half of the cylinder, not visible
    yield { P, d: [-toCam[0] / L, -toCam[1] / L, -toCam[2] / L], facing }
  }
}

const blockedBy = (P, d) => blocks(P, d, WALL) + blocks(P, d, BAND)
const slice = (y, step) => Array.from(rays(y, step))

console.log(`camera y ${CAM[1]} looking at y ${TARGET[1]} -> every sight line descends\n`)
console.log('lát y    %xuyên thấu (không surface nào ghi depth)')
for (let y = GLASS.y0; y <= GLASS.y1 + 1e-9; y += 0.03) {
  const r = slice(y, 1)
  const leak = r.filter(({ P, d }) => !blockedBy(P, d)).length
  const tag = y <= WALL.y0 ? '  <- dải hở DƯỚI 12mm' : y >= WALL.y1 ? '  <- dải hở TRÊN 12mm' : ''
  console.log(String(+y.toFixed(3)).padEnd(9), ((100 * leak) / r.length).toFixed(1).padStart(6), tag)
}

// Weighted by projected area: a strip of curved glass near the silhouette edge is worth far fewer
// pixels than the same arc length in the middle, so plain azimuth sampling under-reports the hole.
let wBlocked = 0
let wLeak = 0
let unweightedBlocked = 0
let unweightedLeak = 0
for (let y = GLASS.y0; y <= GLASS.y1 + 1e-9; y += 0.003) {
  for (const { P, d, facing } of slice(y, 0.5)) {
    const blocked = blockedBy(P, d) > 0
    if (blocked) wBlocked += facing
    else wLeak += facing
    if (blocked) unweightedBlocked += 1
    else unweightedLeak += 1
  }
}
const pct = (a, b) => `${((100 * a) / (a + b)).toFixed(1)}%`
console.log('\ntoàn bộ mặt kính nhìn thấy được:')
console.log('  có gì chắn      :', pct(wBlocked, wLeak), '(đếm azimuth thuần:', pct(unweightedBlocked, unweightedLeak) + ')')
console.log('  KHÔNG gì chắn   :', pct(wLeak, wBlocked), '(đếm azimuth thuần:', pct(unweightedLeak, unweightedBlocked) + ')')

// Does the metal lower band help at all?
let bandOnly = 0
for (let y = GLASS.y0; y <= GLASS.y1 + 1e-9; y += 0.006) {
  for (const { P, d } of slice(y, 1)) if (!blocks(P, d, WALL) && blocks(P, d, BAND)) bandOnly += 1
}
console.log('  dải kim loại dưới tự tay chặn:', bandOnly, 'tia /', slice(1.4, 1).length, 'tia mỗi lát — FrontSide bị culled từ trong.')
