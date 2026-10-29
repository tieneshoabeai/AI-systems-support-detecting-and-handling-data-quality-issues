import { CubicBezierCurve3, CurvePath, Vector3 } from 'three'
import type { Point3, PositionedResource, ResourceLayout, ResourcePort, ResourceRoute } from '../../types/workspace-3d/resource-map.types'
import { CONNECTION, connectionRadius } from './resource-connection-profile'

export function routeCurve(route: ResourceRoute): CurvePath<Vector3> {
  const path = new CurvePath<Vector3>()
  for (const segment of route.segments) path.add(new CubicBezierCurve3(...segment.map(point => new Vector3(...point)) as [Vector3, Vector3, Vector3, Vector3]))
  return path
}

const world = (node: PositionedResource, port: ResourcePort): Point3 => port.position.map((value, i) => value + node.position[i]) as Point3
const offset = (point: Point3, normal: Point3, distance: number): Point3 => point.map((value, i) => value + normal[i] * distance) as Point3

// Endpoints are on the body; only transparent tubes occupy the routing corridor.
export function routeResources(input: readonly PositionedResource[], radius = connectionRadius(input.map(node => node.resource))): Pick<ResourceLayout, 'nodes' | 'edges'> {
  const nodes: PositionedResource[] = input.map(node => ({ ...node, ports: [] }))
  const pitch = radius * 3
  const edges: ResourceLayout['edges'] = []
  for (const node of nodes) {
    if (!nodes.some(parent => parent.resource.id === node.resource.parentId)) continue
    node.ports!.push({ id: `${node.resource.id}:in`, direction: 'in', radius,
      position: node.resource.kind === 'project' ? [CONNECTION.projectSide, CONNECTION.projectTopPort, 0] : [0, -0.25, CONNECTION.datasetBack],
      normal: node.resource.kind === 'project' ? [1, 0, 0] : [0, 0, -1] })
  }
  for (const source of nodes) {
    const children = nodes.filter(node => node.resource.parentId === source.resource.id).sort((a, b) => a.position[0] - b.position[0])
    children.forEach((target, order) => {
      const angle = children.length === 1 ? 0 : -CONNECTION.hubArc / 2 + order * CONNECTION.hubArc / (children.length - 1)
      const incoming = source.ports!.some(port => port.direction === 'in') ? 1 : 0
      const port: ResourcePort = { id: `${target.resource.id}:out`, direction: 'out', radius,
        position: source.resource.kind === 'workspace'
          ? [Math.sin(angle) * CONNECTION.hubRadius, CONNECTION.hubY, Math.cos(angle) * CONNECTION.hubRadius]
          : [CONNECTION.projectSide, CONNECTION.projectTopPort - pitch * (order + incoming), 0],
        normal: source.resource.kind === 'workspace' ? [Math.sin(angle), 0, Math.cos(angle)] : [1, 0, 0] }
      source.ports!.push(port)
      const inlet = target.ports!.find(value => value.direction === 'in')!
      const start = world(source, port), end = world(target, inlet)
      let segments: ResourceRoute['segments']
      if (source.resource.kind === 'workspace') {
        const exit = offset(start, port.normal, 0.7)
        const approach: Point3 = [end[0] + 1.2, end[1], end[2] - 1.8]
        const middle = (exit[2] + approach[2]) / 2
        segments = [[start, offset(start, port.normal, 0.24), offset(exit, port.normal, -0.24), exit],
          [exit, offset(exit, port.normal, 0.6), [approach[0], approach[1], middle], approach],
          [approach, [approach[0], approach[1], end[2] - 0.6], offset(end, inlet.normal, 0.7), end]]
      } else {
        const exit: Point3 = [source.position[0] + 2.1, start[1], source.position[2] + 2]
        const approach: Point3 = [end[0], end[1], end[2] - 0.6]
        const middle = (exit[2] + approach[2]) / 2
        segments = [[start, offset(start, port.normal, 0.7), [exit[0], exit[1], exit[2] - 0.7], exit],
          [exit, [exit[0], exit[1], middle], [approach[0], approach[1], middle], approach],
          [approach, [end[0], end[1], end[2] - 0.4], offset(end, inlet.normal, 0.2), end]]
      }
      edges.push({ id: target.resource.id, source, target, route: { segments, radius } })
    })
  }
  return { nodes, edges }
}
