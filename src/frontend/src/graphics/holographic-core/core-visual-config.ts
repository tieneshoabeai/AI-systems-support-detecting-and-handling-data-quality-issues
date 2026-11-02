import { NEON_CUBE } from '../neon-cube/neon-cube.model'
import { NEON_CUBE_CLUSTER_LAYOUT, type NeonCubeClusterNode } from '../neon-cube/neon-cube.cluster'

export type Vec3 = readonly [number, number, number]

export type CoreVisualRevision = 'v2-tier' | 'v3-constellation'

// Flip to 'v2-tier' to restore the pre-constellation look without touching git history.
export const CORE_VISUAL_REVISION: CoreVisualRevision = 'v3-constellation'

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

export const CORE_NUCLEUS = {
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

export const ISSUE_LANES: readonly IssueLaneDefinition[] = [
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
