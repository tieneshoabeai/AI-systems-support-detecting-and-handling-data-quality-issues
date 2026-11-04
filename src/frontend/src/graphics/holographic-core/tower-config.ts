// Single source of truth for the 14 active towers (S2). Pure data: no imports, and deliberately no
// derivation from generated-core.ts — the corrected heights are a design decision that differs from
// what the generator emits (tower-02: generated 1.95, corrected 2.7).
//
// Reference-derived proportions: tower tops reach from just below to well above the core cap,
// measured against the primary image (deck top y=0.45, cap top ~2.86).
export const TOWER_BASE_Y = 0.45

export type TowerRecord = {
  id: string
  width: number
  height: number
  depth: number
  // The tallest tower carries a setback crown so the skyline reads at a glance. Was `seed === 0`.
  crowned: boolean
  // Particle phase per tower. Was the positional `index + 1` of the build order.
  riserSeed: number
}

export type OriginalTower = TowerRecord & {
  // The generated radii leave a 0.27-0.38 gap to the mid collar, so the original nine read as a
  // loose ring. Pulling each one in until its nearest footprint edge lands at r ~1.49 puts all but
  // tower-04 on a shared inner face 0.14 outside the collar (rendered outer radius 1.3485).
  // tower-01 already sits at 1.484; tower-04 retains its approved generated radius even after
  // removal of the neighbouring tower-15.
  // Absent means: keep whatever radius the generator produced.
  pulledRadius?: number
}

export type OuterTower = TowerRecord & {
  name: string
  angleDegrees: number
  radius: number
  level: string
  baseY: number
}

// Order matters: it is the build order, and the detach registry walks it as it stands.
export const ORIGINAL_TOWERS: OriginalTower[] = [
  { id: 'tower-01-back-high', width: 0.76, height: 3.3, depth: 0.76, crowned: true, riserSeed: 1 },
  { id: 'tower-02', width: 0.48, height: 2.7, depth: 0.48, crowned: false, riserSeed: 2, pulledRadius: 1.75 },
  { id: 'tower-03', width: 0.45, height: 2.5, depth: 0.45, crowned: false, riserSeed: 3, pulledRadius: 1.8308 },
  { id: 'tower-04', width: 0.42, height: 2, depth: 0.42, crowned: false, riserSeed: 4 },
  { id: 'tower-07', width: 0.42, height: 1.9, depth: 0.42, crowned: false, riserSeed: 7, pulledRadius: 1.7984 },
  { id: 'tower-08', width: 0.46, height: 2.4, depth: 0.46, crowned: false, riserSeed: 8, pulledRadius: 1.7843 },
  { id: 'tower-09', width: 0.46, height: 2.75, depth: 0.46, crowned: false, riserSeed: 9, pulledRadius: 1.8007 },
]

// Second ring: one tower between every pair of the original nine, pulled within 9 degrees of the
// arc midpoint and widened until the nearest AABB gap lands in 0.10-0.38, so the ring reads as one
// dense tier instead of a sparse set of columns.
// Containment on the base: r + sqrt(2)*(w/2 + plinth 0.02) stays under 3.06, inside the rim at
// 3.091, and r - sqrt(2)*(w/2 + 0.02) stays above the sector band's inner radius 2.15. Those
// bounds cap the tall columns at w 0.596 and the low ones at w 0.41.
// baseY 0.50 is the sector plate top, so the ring stands on the sectors instead of the deck.
// Tower-11 and the former inner-field tower-15 were removed; remaining placements stay fixed.
export const OUTER_TOWERS: OuterTower[] = [
  { id: 'tower-10', name: 'Outer ring tower 10', angleDegrees: 14.5, radius: 2.6, width: 0.58, height: 2.1, depth: 0.58, level: 'meso', baseY: 0.5, crowned: false, riserSeed: 10 },
  { id: 'tower-12', name: 'Outer ring tower 12', angleDegrees: 96.5, radius: 2.6, width: 0.58, height: 2.15, depth: 0.58, level: 'meso', baseY: 0.5, crowned: false, riserSeed: 12 },
  { id: 'tower-13', name: 'Outer ring tower 13', angleDegrees: 151.5, radius: 2.74, width: 0.4, height: 1.35, depth: 0.4, level: 'meso', baseY: 0.5, crowned: false, riserSeed: 13 },
  { id: 'tower-14', name: 'Outer ring tower 14', angleDegrees: 181.5, radius: 2.6, width: 0.58, height: 2, depth: 0.58, level: 'meso', baseY: 0.5, crowned: false, riserSeed: 14 },
  { id: 'tower-16', name: 'Outer ring tower 16', angleDegrees: 241.5, radius: 2.6, width: 0.58, height: 1.95, depth: 0.58, level: 'meso', baseY: 0.5, crowned: false, riserSeed: 16 },
  { id: 'tower-17', name: 'Outer ring tower 17', angleDegrees: 282.5, radius: 2.74, width: 0.4, height: 1.3, depth: 0.4, level: 'micro', baseY: 0.5, crowned: false, riserSeed: 17 },
  { id: 'tower-18', name: 'Outer ring tower 18', angleDegrees: 337.5, radius: 2.6, width: 0.58, height: 2.05, depth: 0.58, level: 'meso', baseY: 0.5, crowned: false, riserSeed: 18 },
]

export const TOWER_IDS: string[] = [...ORIGINAL_TOWERS, ...OUTER_TOWERS].map(tower => tower.id)
export const OUTER_TOWER_IDS = new Set(OUTER_TOWERS.map(tower => tower.id))

// Window density, per tower. Towers not listed get no data marks.
export const TOWER_DETAIL_PLAN: Array<{ id: string; density: number }> = [
  { id: 'tower-01-back-high', density: 8 },
  { id: 'tower-04', density: 6 },
  { id: 'tower-09', density: 4 },
  { id: 'tower-12', density: 5 },
]

// The outer ring starts farther out, so it travels less to stay inside the frame.
export const DETACH_DISTANCE = { original: 0.85, outer: 0.5, lift: 0.35 }

// The four materials every tower shares, plus the two decorations that are not part of a tower's own
// volume. Values here are the render, not a starting point: createTowerMaterials() in tower-architecture
// adds only the material type and the flags that never vary (transparent, depthWrite, side, blending).
export const TOWER_PALETTE = {
  // Steel-blue volume that stays well below the core's HDR cyan.
  glass: {
    color: '#0a2848', emissive: '#031a42', emissiveIntensity: 0.42, opacity: 0.36,
    roughness: 0.4, metalness: 0.04, clearcoat: 0.28, clearcoatRoughness: 0.5,
  },
  // No depth write so the interior glow stays visible; the block itself stays faint.
  core: {
    color: '#010c24', emissive: '#031a3a', emissiveIntensity: 0.3, opacity: 0.3,
    roughness: 0.5, metalness: 0,
  },
  frame: {
    color: '#2a6fdb', emissive: '#1b5fbf', emissiveIntensity: 0.55, opacity: 0.9,
    roughness: 0.55, metalness: 0.08,
  },
  // Outward-facing only: far-side rows no longer double up through the glass.
  window: { color: '#ffffff', opacity: 0.34 },
  // Bright steel-blue corner posts; cyan is reserved for the core tier.
  cornerPost: { color: '#6fa8ff', opacity: 0.62 },
  // Sector plates are 0.0425 above the deck, so towers in the plate gaps get a thin footing
  // instead of hovering over the deck.
  plinth: {
    color: '#041a3a', emissive: '#082f60', emissiveIntensity: 0.2, opacity: 0.9,
    roughness: 0.55, metalness: 0.08,
  },
}
