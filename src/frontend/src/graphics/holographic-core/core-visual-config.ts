import { NEON_CUBE } from '../neon-cube/neon-cube.model'
import { NEON_CUBE_CLUSTER_LAYOUT, type NeonCubeClusterNode } from '../neon-cube/neon-cube.cluster'

export type Vec3 = readonly [number, number, number]

export type CoreVisualRevision = 'v2-tier' | 'v3-constellation' | 'v4-spool'

// Flip to 'v3-constellation' or 'v2-tier' to roll back without touching git history.
export const CORE_VISUAL_REVISION: CoreVisualRevision = 'v4-spool'

export type CoreGlowEntry = {
  patch: {
    color?: string
    emissive?: string
    emissiveIntensity?: number
    opacity?: number
    roughness?: number
  }
  contour?: { color: string; opacity: number }
}

// Original values, kept verbatim so the feature switch is a true visual rollback.
export const CORE_GLOW_V2: Record<string, CoreGlowEntry> = {
  'core-upper': {
    patch: { color: '#062c4e', emissive: '#2ae6ff', emissiveIntensity: 1.35, opacity: 0.78 },
    contour: { color: '#4de6ff', opacity: 0.8 },
  },
  'core-lower': {
    patch: { color: '#05243f', emissive: '#1fd0ff', emissiveIntensity: 1.0, opacity: 0.7 },
    contour: { color: '#4de6ff', opacity: 0.7 },
  },
  'core-mid-collar': {
    patch: { color: '#062a4a', emissive: '#2ad4ff', emissiveIntensity: 0.6, opacity: 0.46 },
    contour: { color: '#4de6ff', opacity: 0.5 },
  },
  'core-lower-collar': {
    patch: { emissive: '#2fe4ff', emissiveIntensity: 1.0, opacity: 0.3 },
    contour: { color: '#4de6ff', opacity: 0.6 },
  },
  'core-cap': { patch: { emissiveIntensity: 0.9 } },
  'core-foot': { patch: { emissiveIntensity: 0.6 } },
}

// v3: the body stays below bloom threshold 1.0; only thin bands, beads and motes go HDR.
export const CORE_GLOW_V3: Record<string, CoreGlowEntry> = {
  'core-upper': {
    patch: { color: '#04222c', emissive: '#18d2e6', emissiveIntensity: 0.5, opacity: 0.58, roughness: 0.55 },
    contour: { color: '#4de6ff', opacity: 0.22 },
  },
  'core-lower': {
    patch: { color: '#031e26', emissive: '#12c6d6', emissiveIntensity: 0.38, opacity: 0.5, roughness: 0.55 },
    contour: { color: '#4de6ff', opacity: 0.2 },
  },
  'core-mid-collar': {
    patch: { color: '#052a36', emissive: '#22cfe0', emissiveIntensity: 0.4, opacity: 0.4, roughness: 0.52 },
    contour: { color: '#4de6ff', opacity: 0.28 },
  },
  'core-lower-collar': {
    patch: { emissive: '#2fd8f4', emissiveIntensity: 0.55, opacity: 0.28 },
    contour: { color: '#4de6ff', opacity: 0.3 },
  },
  'core-cap': { patch: { emissiveIntensity: 0.45 } },
  'core-foot': { patch: { emissiveIntensity: 0.3 } },
}

export function resolveCoreGlow(revision: CoreVisualRevision = CORE_VISUAL_REVISION): Record<string, CoreGlowEntry> {
  return revision === 'v3-constellation' ? CORE_GLOW_V3 : CORE_GLOW_V2
}

export type DetectionAnchor = {
  center: Vec3
  surface: Vec3
  halfSide: number
  scale: number
}

// Derived from the actual satellite layout so a future cube move carries the issue lane with it.
export function resolveDetectionAnchor(
  layout: readonly NeonCubeClusterNode[] = NEON_CUBE_CLUSTER_LAYOUT,
): DetectionAnchor {
  const node = layout.find(candidate => candidate.theme === 'orange')
  if (!node) throw new Error('Thiếu cube Detection (theme orange) trong cluster layout')
  const [x, y, z] = node.position
  const centerY = y + NEON_CUBE.cubeCenterY * node.scale
  const distance = Math.hypot(x, z) || 1
  const toCoreX = -x / distance
  const toCoreZ = -z / distance
  const halfSide = NEON_CUBE.cubeHalf * node.scale
  const faceOffset = halfSide + 0.14
  return {
    center: [x, centerY, z],
    surface: [x + toCoreX * faceOffset, centerY + 0.08, z + toCoreZ * faceOffset],
    halfSide,
    scale: node.scale,
  }
}

export const DETECTION_ANCHOR = resolveDetectionAnchor()

export const CORE_NUCLEUS_V3 = {
  centerY: 1.9,
  equatorRadius: 1.02,
  bands: [
    { y: 1.55, radius: 0.92, tube: 0.0045, linear: [0.45, 0.9, 1.05] as const },
    { y: 1.9, radius: 1.02, tube: 0.007, linear: [0.8, 1.6, 1.8] as const },
    { y: 2.25, radius: 0.92, tube: 0.0045, linear: [0.45, 0.9, 1.05] as const },
  ],
  beadRings: [
    { radius: 1.02, count: 10, direction: 1 },
    { radius: 1.14, count: 8, direction: -1 },
  ],
  beadSize: 0.026,
  beadOrbitSpeed: 0.18,
  beadPalette: [
    [0.35, 0.95, 1.05],
    [0.7, 0.35, 1.1],
    [0.9, 1.0, 1.15],
    [0.25, 0.75, 1.1],
  ] as const,
} as const

// v4: the nucleus lives inside the spool chamber, so bands and beads shrink to the glass radius.
export const CORE_NUCLEUS_V4 = {
  centerY: 1.42,
  equatorRadius: 0.9,
  bands: [
    { y: 1.16, radius: 0.82, tube: 0.0045, linear: [0.12, 1.55, 1.65] as const },
    { y: 1.42, radius: 0.9, tube: 0.006, linear: [0.3, 2.2, 2.3] as const },
    { y: 1.68, radius: 0.82, tube: 0.0045, linear: [0.12, 1.55, 1.65] as const },
  ],
  beadRings: [
    { radius: 0.55, count: 10, direction: 1 },
    { radius: 0.72, count: 8, direction: -1 },
  ],
  beadSize: 0.02,
  beadOrbitSpeed: 0.14,
  beadPalette: [
    [0.25, 1.7, 1.75],
    [0.6, 1.9, 2.0],
    [1.2, 1.8, 1.7],
    [0.35, 1.4, 1.9],
  ] as const,
} as const

export function resolveCoreNucleus(revision: CoreVisualRevision = CORE_VISUAL_REVISION) {
  return revision === 'v4-spool' ? CORE_NUCLEUS_V4 : CORE_NUCLEUS_V3
}

export type IssueLaneDefinition = {
  id: string
  start: Vec3
  controls: readonly [Vec3, Vec3]
  end: Vec3
  speed: number
  phaseOffset: number
}

const shift = (point: Vec3, dx: number, dy: number, dz: number): Vec3 =>
  [point[0] + dx, point[1] + dy, point[2] + dz]

const detectionSurface = DETECTION_ANCHOR.surface

export const ISSUE_LANES_V3: readonly IssueLaneDefinition[] = [
  {
    id: 'issue-a',
    start: [0.946, 1.98, -0.382],
    controls: [[2.4, 2.45, 0.25], [4.5, 2.55, -0.15]],
    end: shift(detectionSurface, 0, 0.06, -0.04),
    speed: 0.055,
    phaseOffset: 0,
  },
  {
    id: 'issue-b',
    start: [1.01, 1.86, -0.142],
    controls: [[2.2, 2.15, 0.55], [4.3, 2.25, 0.15]],
    end: shift(detectionSurface, 0, 0, 0.05),
    speed: 0.07,
    phaseOffset: 0.17,
  },
  {
    id: 'issue-c',
    start: [0.846, 2.04, -0.571],
    controls: [[2.6, 2.65, -0.55], [4.8, 2.5, -0.85]],
    end: shift(detectionSurface, 0, -0.06, 0.02),
    speed: 0.085,
    phaseOffset: 0.34,
  },
]

// v4: lanes leave the chamber glass at its equator instead of the old drum shoulder.
export const ISSUE_LANES_V4: readonly IssueLaneDefinition[] = [
  {
    id: 'issue-a',
    start: [0.86, 1.5, -0.44],
    controls: [[2.2, 1.85, 0.2], [4.4, 2.1, -0.15]],
    end: shift(detectionSurface, 0, 0.06, -0.04),
    speed: 0.055,
    phaseOffset: 0,
  },
  {
    id: 'issue-b',
    start: [0.96, 1.42, -0.18],
    controls: [[2.1, 1.6, 0.5], [4.3, 1.95, 0.12]],
    end: shift(detectionSurface, 0, 0, 0.05),
    speed: 0.07,
    phaseOffset: 0.17,
  },
  {
    id: 'issue-c',
    start: [0.77, 1.36, -0.59],
    controls: [[2.4, 1.95, -0.5], [4.8, 2.05, -0.8]],
    end: shift(detectionSurface, 0, -0.06, 0.02),
    speed: 0.085,
    phaseOffset: 0.34,
  },
]

export function resolveIssueLanes(revision: CoreVisualRevision = CORE_VISUAL_REVISION) {
  return revision === 'v4-spool' ? ISSUE_LANES_V4 : ISSUE_LANES_V3
}

export const CLEAN_LOOP_POINTS: readonly Vec3[] = [
  [-0.959, 1.9, 0.349],
  [-1.25, 1.55, 0.55],
  [-1.1, 1.35, -0.5],
  [-0.2, 1.3, -1.1],
  [0.9, 1.4, -0.8],
  [1.3, 1.6, 0.2],
  [0.8, 1.8, 0.9],
]

export const ISSUE_CONSTELLATION = {
  enabled: true,
  laneSegments: 64,
  issueParticlesPerLane: 6,
  cleanParticleCount: 30,
  cleanSpeed: 0.03,
  particleSize: { issue: 0.05, clean: 0.034 },
  laneOpacity: 0.32,
  edgeFade: 0.06,
  issuePalette: [
    [2.2, 0.85, 0.25],
    [2.4, 0.45, 0.2],
    [1.8, 1.0, 0.35],
  ] as const,
  cleanPalette: [
    [0.55, 1.8, 2.0],
    [1.2, 0.6, 2.0],
    [1.6, 1.9, 2.2],
  ] as const,
  laneColors: {
    issue: [2.0, 0.7, 0.2] as const,
    clean: [0.35, 1.0, 1.4] as const,
  },
  beacon: {
    ringRadius: 0.55,
    ringTube: 0.012,
    spriteSize: 0.9,
    ringLinear: [2.0, 0.8, 0.25] as const,
    baseLevel: 0.35,
    smoothing: 6,
  },
} as const

// v4 spool, revision C: the tower ring keeps its layout, so the core has to fit inside it.
// The ring is nine axis-aligned boxes, not a circle: measured from the axis, the nearest tower
// surface is tower-15 at r 1.288 (azimuth 346 deg), then t02/t06/t08 at r ~1.50. A closed orbit
// sweeps every azimuth, so its minor axis must clear 1.288 while its major axis clears ~1.50.
// That caps the whole collar at r<=1.38 and forces yaw into the 75-105 deg family; the platform
// stops at r 1.55 so the deck no longer sprawls under the tower footprints.
export const SPOOL_CORE = {
  platform: { radius: 1.55, thickness: 0.05, centerY: 0.495, ringRadii: [0.45, 0.82, 1.19, 1.46] },
  baseGlass: { radius: 1.06, height: 0.38, centerY: 0.71 },
  lowerBand: { radius: 1.02, height: 0.09, centerY: 0.945 },
  // The backdrop is derived from the chamber so it can never drift out of containment: it sits
  // 10 mm off the inner glass face and pulls 12 mm in at each end, off the y 1.98 / 0.99 rims.
  chamber: {
    radius: 0.95,
    wall: 0.01,
    height: 0.99,
    centerY: 1.485,
    backdrop: { radiusInset: 0.01, heightInset: 0.012 },
  },
  cap: {
    bottomY: 1.98,
    topY: 2.4,
    outerRadius: 1.17,
    lid: { innerRadius: 0.65, outerRadius: 0.8, height: 0.2, centerY: 2.3 },
    roof: {
      topInner: 0.9,
      topOuter: 1.05,
      bottomInner: 1.02,
      bottomOuter: 1.17,
      topY: 2.4,
      bottomY: 2.28,
    },
    drum: { innerRadius: 1.02, outerRadius: 1.17, height: 0.3, centerY: 2.13 },
    neck: { radius: 1.17, height: 0.04, centerY: 2.0 },
  },
  topY: 2.4,
  // The light has to clear r 0.930 (the backdrop) to make the pool at all, which means it also
  // passes through the glass at r 0.95 — human accepted that the glass lifts ~86% as the price.
  nucleus: {
    y: 1.42,
    radius: 0.2,
    length: 0.16,
    light: { color: '#22e5e0', intensity: 10, distance: 1.2, decay: 2 },
  },
  orbits: {
    // Nested collar rather than a gyroscope: four hoops stacked on the lower chamber, each tipped
    // so the stack reads as one magnetic loop. centerY 1.25 keeps every arc below the backdrop's
    // top edge (1.968), which is what makes all four rings clip it by the same ~30%.
    centerY: 1.25,
    radii: [1.2, 1.26, 1.32, 1.38],
    tube: 0.011,
    flatten: 0.88,
    tiltX: [0.18, -0.24, 0.28, -0.34] as const,
    yaw: [1.31, 1.48, 1.66, 1.83] as const,
    sphereCount: 8,
    sphereRadius: 0.055,
  },
  particles: {
    chamber: 90,
    stream: 36,
    floating: 24,
    sparks: 14,
    chamberRadius: 0.86,
    sizes: { chamber: 0.016, stream: 0.024, floating: 0.02, spark: 0.018 },
  },
  stream: {
    start: [-1.55, 4.05, -0.85] as Vec3,
    end: [-0.25, 2.3, -0.25] as Vec3,
    fallSpeed: 0.16,
  },
  palette: {
    glass: { color: '#0a3b45', emissive: '#0b6a70', emissiveIntensity: 0.22 },
    metal: { color: '#05161c', emissive: '#0a2a30', emissiveIntensity: 0.3 },
    // The chamber's only depth writer, and the surface the nucleus light has to land on. Its albedo
    // used to borrow `metal` (#05161c) which, under the old cutoff 0.94 and metalness 0.34, gave a
    // lit patch of 2.6e-5 — ~1,900x dimmer than the wall's own emissive, i.e. invisible. `#1b4750`
    // at cutoff 1.2 puts the pool at 0.121 against 0.0486 of self-glow (2.5:1): a readable hotspot
    // that stays 8x under the bloom threshold, so the backdrop can never out-shout the nucleus.
    // metalness is 0 because nothing in this scene installs an environment map, so any metalness
    // here only discards diffuse.
    wall: { color: '#1b4750', emissive: '#0b6a70', emissiveIntensity: 0.3, roughness: 0.62, metalness: 0 },
    iceLinear: [0.35, 1.75, 1.55] as const,
    // 2.47 vs the rims' 1.575 per pixel: the 1.57x step human signed off on, and the reason the
    // nucleus needs its own material instead of sharing `ice` with the four rim rings.
    nucleusHotLinear: [0.5, 2.6, 2.3] as const,
    amberLinear: [2.2, 0.95, 0.2] as const,
    platformLinear: [0.05, 0.95, 0.85] as const,
  },
  // The model measured exactly 18 drawables, so the cap had no slack left. Slot 19 is reserved for
  // the opaque chamber backdrop: it is the one mesh that buys real depth instead of renderOrder.
  budget: { drawCalls: 19, triangles: 23000 },
} as const

