export type SurfaceSide = 'bottom' | 'right'

export type SurfaceOrigin = { kind: 'pointer'; x: number; y: number } | { kind: 'anchor'; element: HTMLElement }
