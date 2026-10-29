import { expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { hubSocketWall, socketPanel } from '../../graphics/workspace-3d/connection-geometry'
import { CONNECTION } from '../../math/workspace-3d/resource-connection-profile'
import { layoutResources } from '../../math/workspace-3d/resource-layout'
import { extendedPreviewResources, previewResources } from '../../views/workspace-3d/preview-resources'

it('cuts a real through-hole in the side panel instead of placing a dark disk on a closed wall', () => {
  const radius = CONNECTION.pipeRadius * 1.32
  const geometry = socketPanel(1.35, 2.05, CONNECTION.recess, [{ x: 0, y: 0, radius }])
  const material = new MeshBasicMaterial({ side: DoubleSide })
  const mesh = new Mesh(geometry, material)
  mesh.updateMatrixWorld()
  expect(new Raycaster(new Vector3(0, 0, 1), new Vector3(0, 0, -1)).intersectObject(mesh)).toHaveLength(0)
  const outside = new Raycaster(new Vector3(radius * 2, 0, 1), new Vector3(0, 0, -1)).intersectObject(mesh)
  expect(outside[0].distance).toBeCloseTo(1 - CONNECTION.recess)
  geometry.dispose(); material.dispose()
})

it('cuts recessed bores through the curved hub facade along the actual radial normals', () => {
  const hub = layoutResources(previewResources).nodes.find(node => node.resource.kind === 'workspace')!
  const geometry = hubSocketWall(hub.ports!)
  const material = new MeshBasicMaterial({ side: DoubleSide })
  const mesh = new Mesh(geometry, material)
  mesh.updateMatrixWorld()
  for (const port of hub.ports!) {
    const point = new Vector3(...port.position), normal = new Vector3(...port.normal)
    const origin = point.clone().addScaledVector(normal, 0.5)
    const through = new Raycaster(origin, normal.clone().negate()).intersectObject(mesh)
    expect(through[0]?.distance ?? Infinity).toBeGreaterThan(0.5 + CONNECTION.recess)
    const tangent = new Vector3(port.normal[2], 0, -port.normal[0])
    const surface = new Raycaster(origin.addScaledVector(tangent, port.radius * 2.5), normal.clone().negate()).intersectObject(mesh)
    expect(surface[0].distance).toBeLessThan(0.6)
  }
  geometry.dispose(); material.dispose()
})

it('keeps all ports flush, on one project side, with the same small gauge even after changing scope', () => {
  const layout = layoutResources(extendedPreviewResources)
  const radii = new Set(layout.edges.map(edge => edge.route.radius))
  expect(radii.size).toBe(1)
  expect([...radii][0]).toBeLessThanOrEqual(0.09)
  const scoped = layoutResources(extendedPreviewResources, 'demo-project-0')
  expect(scoped.edges[0].route.radius).toBe(layout.edges[0].route.radius)
  for (const node of layout.nodes) for (const port of node.ports!) {
    expect(port.radius).toBe(layout.edges[0].route.radius)
    expect(CONNECTION.lip / 2 + port.radius * 0.12).toBeLessThan(0.06)
    if (node.resource.kind === 'workspace') expect(Math.hypot(port.position[0], port.position[2])).toBeCloseTo(CONNECTION.hubRadius)
    if (node.resource.kind === 'project') {
      expect(port.position[0]).toBe(CONNECTION.projectSide)
      expect(port.normal).toEqual([1, 0, 0])
      expect(port.position[1] - port.radius * 1.4).toBeGreaterThan(-0.675)
      expect(port.position[1] + port.radius * 1.4).toBeLessThan(1.375)
    }
  }
})
