import { Matrix4 } from 'three'
import type { Camera, Object3D } from 'three'
import { authGlassConfig } from './auth-glass.config'

const { artwork, slab } = authGlassConfig
export const faceWidth = slab.width - 2 * artwork.inset
export const faceHeight = slab.height - 2 * artwork.inset
export const faceZ = slab.depth / 2 + artwork.faceOffset

// Map HTML pixels to the same plane used by the panel's front artwork.
const formToPanel = new Matrix4().set(
  faceWidth / artwork.pixelsWide, 0, 0, -faceWidth / 2,
  0, -faceHeight / artwork.pixelsHigh, 0, slab.height - artwork.inset,
  0, 0, 1, faceZ,
  0, 0, 0, 1,
)

export function projectAuthForm(
  camera: Camera,
  loginPanel: Object3D,
  screenWidth: number,
  screenHeight: number,
) {
  const panelToClip = new Matrix4()
    .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    .multiply(loginPanel.matrixWorld)
    .multiply(formToPanel)
  const m = panelToClip.elements
  const halfWidth = screenWidth / 2
  const halfHeight = screenHeight / 2
  const w = m[15]
  const { pixelsWide, pixelsHigh } = artwork
  const rightW = w + m[3] * pixelsWide
  const bottomW = w + m[7] * pixelsHigh
  const oppositeW = rightW + bottomW - w
  if (Math.min(w, rightW, bottomW, oppositeW) <= 0) return null

  const leftX = m[12] / w
  const topY = m[13] / w
  const rightX = (m[12] + m[0] * pixelsWide) / rightW
  const rightY = (m[13] + m[1] * pixelsWide) / rightW
  const bottomX = (m[12] + m[4] * pixelsHigh) / bottomW
  const bottomY = (m[13] + m[5] * pixelsHigh) / bottomW
  // Screen Y points upward here, so a visible front winds clockwise.
  // Hide the form when it turns over or projects to an almost flat line.
  const signedArea = (rightX - leftX) * (bottomY - topY) - (rightY - topY) * (bottomX - leftX)
  if (signedArea >= -0.0005) return null

  // CSS uses pixels and a downward Y axis. Preserve perspective by retaining
  // the clip-space W terms so the HTML corners follow the WebGL plane.
  return `matrix3d(${[
    (m[0] + m[3]) * halfWidth / w, (m[3] - m[1]) * halfHeight / w, 0, m[3] / w,
    (m[4] + m[7]) * halfWidth / w, (m[7] - m[5]) * halfHeight / w, 0, m[7] / w,
    0, 0, 1, 0,
    (m[12] + w) * halfWidth / w, (w - m[13]) * halfHeight / w, 0, 1,
  ].join(',')})`
}
