import { Color, Float32BufferAttribute, LatheGeometry, TorusGeometry, Vector2 } from 'three'
import type { DisplayBaseOptions, DisplayBaseTier } from './display-base.config'

export function createBaseTierGeometry(tier: DisplayBaseTier, top: number, radialSegments: number, bevelSegments: number) {
  const { radius, height, bevelBottom, bevelTop } = tier
  const bottom = top - height
  const profile = [new Vector2(0, bottom)]
  for (let i = 0; i <= bevelSegments; i++) {
    const angle = -Math.PI / 2 + Math.PI / 2 * i / bevelSegments
    profile.push(new Vector2(
      radius - bevelBottom + bevelBottom * Math.cos(angle),
      bottom + bevelBottom + bevelBottom * Math.sin(angle),
    ))
  }
  for (let i = 0; i <= bevelSegments; i++) {
    const angle = Math.PI / 2 * i / bevelSegments
    profile.push(new Vector2(
      radius - bevelTop + bevelTop * Math.cos(angle),
      top - bevelTop + bevelTop * Math.sin(angle),
    ))
  }
  profile.push(new Vector2(0, top))
  return new LatheGeometry(profile, radialSegments)
}

export function createBaseRingGeometry(radius: number, ring: DisplayBaseOptions['ring'], segments: number) {
  const geometry = new TorusGeometry(radius, ring.tube, 8, segments)
  const position = geometry.getAttribute('position')
  const stops = [ring.blue, ring.cyan, ring.violet, ring.blue, ring.blue].map(value => new Color(value))
  const color = new Color()
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    // The torus is mounted flat. Its local -Y points toward world +Z (front).
    const angle = Math.atan2(-position.getY(i), position.getX(i))
    const quadrant = ((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)
    const index = Math.floor(quadrant)
    color.copy(stops[index]).lerp(stops[index + 1], quadrant - index).multiplyScalar(1.4).toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}
