export const authGlassViews = ['hero', 'left', 'right', 'top', 'bottom'] as const
export type AuthGlassView = (typeof authGlassViews)[number]
export const authGlassDebugModes = ['off', 'sdf', 'normal', 'offset'] as const
type Vec3 = [number, number, number]

const width = 2

export const authGlassConfig = {
  slab: {
    width,
    height: width * 2,
    depth: width / 10,
    cornerRadius: 0.14,
    bevel: 0.03,
    bevelSegments: 8,
    curveSegments: 12,
  },
  viewport: { width: 1065, height: 1120 },
  dragRadiansPerPixel: 0.012,
  dragThreshold: 6,
  artwork: {
    pixelsWide: 360,
    pixelsHigh: 720,
    inset: 0.16,
    faceOffset: 0.008,
  },
  glass: {
    targetScale: 0.75,
    lensWidth: width * 0.25,
    thicknessPixels: 60,
    ior: 1.5,
    blurPixels: 6,
    chroma: 0.02,
    saturation: 1.25,
    tint: 0.08,
    rimIntensity: 0.5,
  },
  camera: {
    fov: 34,
    compact: {
      maxAspect: 0.78,
      fov: 38,
      position: [-0.73, 2.19, 8.5] as Vec3,
      target: [-0.73, 1.50, 0] as Vec3,
    },
    near: 0.1,
    far: 40,
    target: [0, 2, 0] as Vec3,
    loginFov: 36,
    loginPosition: [0, 2.55, 8.3] as Vec3,
    loginTarget: [0, 1.75, 0] as Vec3,
    positions: {
      hero: [0, 2, 8],
      left: [-6.2, 2.5, 6.9],
      right: [6.2, 2.5, 6.9],
      top: [0, 8.1, 6.2],
      bottom: [0, -4.2, 6.2],
    } satisfies Record<AuthGlassView, Vec3>,
  },
  seamPosition: [0.14, width, 0.35] as Vec3,
  panels: [
    { name: 'LoginPanel', yaw: -0.25, seamSide: 1 },
    { name: 'RegisterPanel', yaw: 0.9, seamSide: -1 },
  ] as const,
}

export function parseAuthGlassView(value: string | null): AuthGlassView | undefined {
  return authGlassViews.find(view => view === value)
}
