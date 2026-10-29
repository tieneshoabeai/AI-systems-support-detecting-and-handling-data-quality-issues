import { expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { layoutResources } from '../../math/workspace-3d/resource-layout'
import { routeCurve, routeResources } from '../../math/workspace-3d/resource-routing'
import { fitPose, nodeCorners, overviewDirection, overviewPose, panPose } from '../../math/workspace-3d/resource-camera'
import { extendedPreviewResources, previewResources } from '../../views/workspace-3d/preview-resources'
import type { ResourceNode } from '../../types/workspace-3d/resource-map.types'

const many: ResourceNode[] = [previewResources[0], { id: 'p', name: 'Project', kind: 'project', parentId: previewResources[0].id },
  ...Array.from({ length: 12 }, (_, i): ResourceNode => ({ id: `d${i}`, name: `Dataset ${i}`, kind: 'dataset', parentId: 'p' }))]
const manyProjects: ResourceNode[] = [previewResources[0], ...Array.from({ length: 12 }, (_, i): ResourceNode =>
  ({ id: `p${i}`, name: `Project ${i}`, kind: 'project', parentId: previewResources[0].id }))]

it('keeps routing pure and repeatable, and a rename leaves the ports and route points unchanged', () => {
  const before = layoutResources(previewResources)
  const frozen = Object.freeze(before.nodes.map(node => Object.freeze({ ...node })))
  expect(routeResources(frozen)).toEqual(routeResources(frozen))
  expect(routeResources(frozen).nodes.map(node => node.ports)).toEqual(before.nodes.map(node => node.ports))
  const after = layoutResources(previewResources.map(node => ({ ...node, name: 'Tên mới' })))
  expect(after.edges.map(edge => [edge.id, edge.route])).toEqual(before.edges.map(edge => [edge.id, edge.route]))
  expect(after.nodes.map(node => node.ports)).toEqual(before.nodes.map(node => node.ports))
})

it.each([previewResources, extendedPreviewResources, many, manyProjects].map(resources => ({ resources })))('keeps distinct ports and whole sampled tubes clear of other nodes and tubes (%#)', ({ resources }) => {
  const layout = layoutResources(resources)
  const curves = layout.edges.map(edge => routeCurve(edge.route))
  const radius = layout.edges[0].route.radius
  const samples = curves.map(curve => Array.from({ length: 101 }, (_, i) => curve.getPoint(i / 100)))
  let clearance = Infinity
  const collisions = new Set<string>()
  let finite = true
  for (const node of layout.nodes) {
    expect(new Set(node.ports?.map(port => port.position.join(','))).size).toBe(node.ports?.length ?? 0)
  }
  for (let i = 0; i < curves.length; i++) {
    const edge = layout.edges[i]
    const outlet = edge.source.ports!.find(port => port.id === `${edge.id}:out`)!
    const inlet = edge.target.ports!.find(port => port.direction === 'in')!
    expect(curves[i].getTangent(0).dot(new Vector3(...outlet.normal))).toBeGreaterThan(0.99)
    expect(curves[i].getTangent(1).dot(new Vector3(...inlet.normal))).toBeLessThan(-0.99)
    for (let step = 0; step <= 100; step++) {
      const point = samples[i][step]
      finite &&= point.toArray().every(Number.isFinite)
      for (const node of layout.nodes) {
        if (node === edge.source || node === edge.target) continue
        const halfWidth = node.resource.kind === 'workspace' ? 1.75 : node.resource.kind === 'project' ? 0.98 : 1.27
        const halfDepth = node.resource.kind === 'workspace' ? 1.75 : node.resource.kind === 'project' ? 0.8 : 0.92
        const inside = Math.abs(point.x - node.position[0]) < halfWidth + radius
          && Math.abs(point.z - node.position[2]) < halfDepth + radius
        if (inside) collisions.add(`${edge.id} → ${node.resource.id}`)
      }
      for (let j = i + 1; j < curves.length; j++) {
        // Compare all sampled points, not just matching curve parameters.
        for (const other of samples[j]) clearance = Math.min(clearance, point.distanceTo(other))
      }
    }
  }
  expect(finite).toBe(true)
  expect([...collisions]).toEqual([])
  expect(clearance).toBeGreaterThan(radius * 2 + 0.015)
})

it('fits a remote node and its ports at wide and narrow aspects, independently of tree span', () => {
  const layout = layoutResources(extendedPreviewResources)
  for (const aspect of [1.7, 0.8]) for (const node of [layout.nodes[0], layout.nodes.at(-1)!]) {
    const pose = fitPose([node], new Vector3(...node.position), overviewDirection(), 40, aspect)
    const camera = new PerspectiveCamera(40, aspect, 0.1, 1000)
    camera.position.copy(pose.position)
    camera.lookAt(pose.target)
    camera.updateMatrixWorld()
    for (const corner of nodeCorners(node)) {
      corner.project(camera)
      expect(Math.abs(corner.x)).toBeLessThan(0.95)
      expect(Math.abs(corner.y)).toBeLessThan(0.95)
    }
  }
})

it('pans position and target together, keeps heading, and clamps navigation to scene margins', () => {
  const layout = layoutResources(previewResources)
  const pose = overviewPose(layout, 40, 1.5)
  for (const direction of ['left', 'right', 'forward', 'back'] as const) {
    let moved = panPose(pose, direction, layout)
    expect(moved.position.clone().sub(moved.target).distanceTo(pose.position.clone().sub(pose.target))).toBeLessThan(1e-10)
    expect(moved.target.distanceTo(pose.target)).toBeGreaterThan(0)
    for (let i = 0; i < 100; i++) moved = panPose(moved, direction, layout)
    expect(moved.target.toArray().every(Number.isFinite)).toBe(true)
    expect(moved.target.z).toBeGreaterThanOrEqual(-5)
    expect(moved.target.z).toBeLessThanOrEqual(Math.max(...layout.nodes.map(node => node.position[2])) + 5)
  }
})
