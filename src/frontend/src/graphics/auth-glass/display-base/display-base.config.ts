type Vec3 = [number, number, number]

export type DisplayBaseTier = {
  name: string
  radius: number
  height: number
  bevelTop: number
  bevelBottom: number
  color: string
}

export type DisplayBaseOptions = {
  tiers: [DisplayBaseTier, DisplayBaseTier, DisplayBaseTier]
  radialSegments: number
  bevelSegments: number
  ring: { tube: number; cyan: string; blue: string; violet: string }
  floor: { size: number; y: number; color: string }
  sockets: { login: Vec3; register: Vec3; embed: number }
  effects: { bloomStrength: number; upperRing: boolean; ripples: boolean; animate: boolean }
}

export type DisplayBaseFootlights = {
  panels: ReadonlyArray<{ x: number; z: number; yaw: number }>
  width: number
  depth: number
}

// The first two slots retain the warm and violet accents at the front.
export const displayBaseGlints = [
  { color: '#ffb46b', size: 0.28, opacity: 0.88 },
  { color: '#a253ff', size: 0.25, opacity: 0.84 },
  { color: '#7386ff', size: 0.23, opacity: 0.78 },
  { color: '#65ddff', size: 0.24, opacity: 0.81 },
  { color: '#84b7ff', size: 0.23, opacity: 0.78 },
]

export const displayBaseOptions: DisplayBaseOptions = {
  tiers: [
    { name: 'base-top', radius: 2.15, height: 0.10, bevelTop: 0.022, bevelBottom: 0.015, color: '#08132b' },
    { name: 'base-mid', radius: 2.27, height: 0.07, bevelTop: 0.016, bevelBottom: 0.013, color: '#203960' },
    { name: 'base-lower', radius: 2.4, height: 0.05, bevelTop: 0.012, bevelBottom: 0.01, color: '#12243e' },
  ],
  radialSegments: 96,
  bevelSegments: 4,
  ring: { tube: 0.014, cyan: '#22d3ee', blue: '#2563ff', violet: '#8b5cf6' },
  floor: { size: 9, y: -0.30, color: '#050a17' },
  sockets: {
    login: [-0.6877, 0, 0.5178],
    register: [0.9871, 0, -0.0223],
    embed: 0.01,
  },
  effects: { bloomStrength: 0.32, upperRing: false, ripples: false, animate: false },
}

export const displayBaseViews = ['front', 'left', 'right', 'top', 'low'] as const
export type DisplayBaseView = (typeof displayBaseViews)[number]

export const displayBaseReviewCamera = {
  fov: 34,
  width: 1536,
  height: 1024,
  overlayOffset: [288, -241] as [number, number],
  position: {
    front: [0, 2.5, 9.25],
    left: [-5.6, 2.5, 7.36],
    right: [5.6, 2.5, 7.36],
    top: [0, 9.4, 0.8],
    low: [0, 0.58, 9.3],
  } satisfies Record<DisplayBaseView, Vec3>,
}

export function parseDisplayBaseView(value: string | null): DisplayBaseView {
  return displayBaseViews.find(view => view === value) ?? 'front'
}
