import { ExtrudeGeometry, Shape } from 'three'
import { authGlassConfig } from './auth-glass.config'

export function createAuthGlassGeometry() {
  const { width, height, depth, cornerRadius, bevel, bevelSegments, curveSegments } = authGlassConfig.slab
  // Leave room for the bevel so the finished solid has the configured outer dimensions.
  const left = -width / 2 + bevel
  const right = width / 2 - bevel
  const bottom = bevel
  const top = height - bevel
  const radius = cornerRadius - bevel
  const shape = new Shape()
  shape.moveTo(left + radius, bottom)
  shape.lineTo(right - radius, bottom)
  shape.quadraticCurveTo(right, bottom, right, bottom + radius)
  shape.lineTo(right, top - radius)
  shape.quadraticCurveTo(right, top, right - radius, top)
  shape.lineTo(left + radius, top)
  shape.quadraticCurveTo(left, top, left, top - radius)
  shape.lineTo(left, bottom + radius)
  shape.quadraticCurveTo(left, bottom, left + radius, bottom)
  shape.closePath()

  const coreDepth = depth - 2 * bevel
  const geometry = new ExtrudeGeometry(shape, {
    depth: coreDepth,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments,
    curveSegments,
  })
  // Center the thickness around the panel's local Z origin.
  geometry.translate(0, 0, -coreDepth / 2)
  return geometry
}

export function alignPanelAtSeam(geometry: ExtrudeGeometry, yaw: number, seamSide: -1 | 1): [number, number, number] {
  const vertices = geometry.getAttribute('position')
  const cosine = Math.cos(yaw)
  const sine = Math.sin(yaw)
  let edgeX = 0
  let edgeZ = 0

  // Find the outermost edge of the actual bevel after yaw. Each slab then
  // touches X = 0 from its own side, with both contact edges at Z = 0.
  for (let index = 0; index < vertices.count; index += 1) {
    const x = vertices.getX(index)
    const z = vertices.getZ(index)
    const rotatedX = x * cosine + z * sine
    if (rotatedX * seamSide > edgeX * seamSide) {
      edgeX = rotatedX
      edgeZ = z * cosine - x * sine
    }
  }

  return [-edgeX, -authGlassConfig.slab.height / 2, -edgeZ]
}

export function findPanelFootprintCenter(
  geometry: ExtrudeGeometry,
  layout: ReadonlyArray<{ yaw: number; position: [number, number, number] }>,
) {
  const vertices = geometry.getAttribute('position')
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const { yaw, position } of layout) {
    const cosine = Math.cos(yaw)
    const sine = Math.sin(yaw)
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i)
      const z = vertices.getZ(i)
      const footprintX = x * cosine + z * sine + position[0]
      const footprintZ = z * cosine - x * sine + position[2]
      minX = Math.min(minX, footprintX)
      maxX = Math.max(maxX, footprintX)
      minZ = Math.min(minZ, footprintZ)
      maxZ = Math.max(maxZ, footprintZ)
    }
  }
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }
}
