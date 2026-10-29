import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape } from 'three'
import type { ResourcePort } from '../../types/workspace-3d/resource-map.types'
import { CONNECTION } from '../../math/workspace-3d/resource-connection-profile'

export function socketPanel(width: number, height: number, depth: number, holes: { x: number; y: number; radius: number }[]) {
  const shape = new Shape()
  const r = Math.min(0.08, height / 8)
  const x = width / 2, y = height / 2
  shape.moveTo(-x + r, -y)
  shape.lineTo(x - r, -y); shape.quadraticCurveTo(x, -y, x, -y + r)
  shape.lineTo(x, y - r); shape.quadraticCurveTo(x, y, x - r, y)
  shape.lineTo(-x + r, y); shape.quadraticCurveTo(-x, y, -x, y - r)
  shape.lineTo(-x, -y + r); shape.quadraticCurveTo(-x, -y, -x + r, -y)
  for (const hole of holes) {
    const path = new Path()
    path.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true)
    shape.holes.push(path)
  }
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 })
}

// Unwrap the annular outer wall, cut real bores, then bend it back onto the ring.
// Subdivision before bending prevents large triangulation chords cutting across the hub.
export function hubSocketWall(ports: readonly ResourcePort[]) {
  const radius = CONNECTION.hubRadius
  const wall = socketPanel(2 * Math.PI * radius, 0.34, 0.15, ports.map(port => ({
    x: Math.atan2(port.position[0], port.position[2]) * radius,
    y: port.position[1] - CONNECTION.hubY, radius: port.radius * 1.32,
  })))
  const vertices = wall.getAttribute('position')
  const result: number[] = []
  type Vertex = [number, number, number]
  function triangle(a: Vertex, b: Vertex, c: Vertex) {
    const differences = [Math.abs(a[0] - b[0]), Math.abs(b[0] - c[0]), Math.abs(c[0] - a[0])]
    const longest = Math.max(...differences)
    if (longest > 0.12) {
      const points = [a, b, c]
      const edge = differences.indexOf(longest)
      const first = points[edge], second = points[(edge + 1) % 3], third = points[(edge + 2) % 3]
      const middle = first.map((value, i) => (value + second[i]) / 2) as Vertex
      triangle(first, middle, third); triangle(middle, second, third)
      return
    }
    for (const [u, v, depth] of [a, b, c]) {
      const angle = u / radius
      const r = radius - 0.15 + depth
      result.push(Math.sin(angle) * r, CONNECTION.hubY + v, Math.cos(angle) * r)
    }
  }
  for (let i = 0; i < vertices.count; i += 3) triangle(
    [vertices.getX(i), vertices.getY(i), vertices.getZ(i)],
    [vertices.getX(i + 1), vertices.getY(i + 1), vertices.getZ(i + 1)],
    [vertices.getX(i + 2), vertices.getY(i + 2), vertices.getZ(i + 2)])
  wall.dispose()
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(result, 3))
  geometry.computeVertexNormals()
  return geometry
}
