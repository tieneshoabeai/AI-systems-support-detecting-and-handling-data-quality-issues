import { CatmullRomCurve3, Vector3 } from 'three'
import { NEON_CUBE_CLUSTER_LAYOUT } from '../neon-cube/neon-cube.cluster'
import { NEON_CUBE, NEON_CUBE_THEMES } from '../neon-cube/neon-cube.model'
import type { NeonCubeThemeId } from '../../types/dataset-3d/cube-focus.types'
import { CORE_VISUAL_REVISION, DETECTION_ANCHOR, resolveIssueLanes } from './core-visual-config'

// Rotate the existing Detection curves around the core, adjusting their reach and
// height to the actual satellite layout. The original orange curves stay intact.
const reference = resolveIssueLanes(CORE_VISUAL_REVISION)
const referenceAngle = Math.atan2(DETECTION_ANCHOR.center[2], DETECTION_ANCHOR.center[0])
const referenceRadius = Math.hypot(DETECTION_ANCHOR.surface[0], DETECTION_ANCHOR.surface[2])

export const CUBE_CONNECTIONS = NEON_CUBE_CLUSTER_LAYOUT.map(node => {
  const [x, y, z] = node.position
  const center = new Vector3(x, y + NEON_CUBE.cubeCenterY * node.scale, z)
  const radius = Math.hypot(x, z)
  const surfaceRadius = radius - NEON_CUBE.cubeHalf * node.scale - 0.14
  const angle = Math.atan2(z, x) - referenceAngle
  const transform = (point: readonly number[], fraction: number) => {
    const scale = 1 + (surfaceRadius / referenceRadius - 1) * fraction
    return new Vector3(
      (point[0] * Math.cos(angle) - point[2] * Math.sin(angle)) * scale,
      point[1] + (center.y - DETECTION_ANCHOR.center[1]) * fraction,
      (point[0] * Math.sin(angle) + point[2] * Math.cos(angle)) * scale,
    )
  }
  const curves = reference.map(lane => new CatmullRomCurve3([
    transform(lane.start, 0), transform(lane.controls[0], 1 / 3),
    transform(lane.controls[1], 2 / 3), transform(lane.end, 1),
  ], false, 'catmullrom', 0.5))
  return { theme: node.theme, center, curves, color: NEON_CUBE_THEMES[node.theme].neonLinear }
})

// User-calibrated connection views at FOV 34, viewport 1068 × 600.
export const CUBE_CONNECTION_CAMERA = {
  cyan: { position: [6.3281, 8.4801, -3.3085], target: [-6.1702, -3.7577, -4.7532] },
  orange: { position: [6.0953, 9.5986, 5.6296], target: [2.2333, -3.5825, -5.2978] },
  blue: { position: [7.3041, 7.8023, 4.7324], target: [-5.7679, -3.0333, 1.5185] },
  violet: { position: [-1.7267, 7.6013, 8.1256], target: [-4.4095, -3.0719, -5.1973] },
} satisfies Record<NeonCubeThemeId, { position: number[]; target: number[] }>

export function cubeConnectionOverview(theme: NeonCubeThemeId) {
  const preset = CUBE_CONNECTION_CAMERA[theme]
  return { position: new Vector3(...preset.position), target: new Vector3(...preset.target) }
}
