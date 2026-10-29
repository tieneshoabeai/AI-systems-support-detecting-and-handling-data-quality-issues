import type { ResourceNode } from '../../types/workspace-3d/resource-map.types'

export const CONNECTION = {
  pipeRadius: 0.09, hubRadius: 1.7, hubY: -0.4, hubArc: 2.2,
  projectSide: 0.85, projectTopPort: 1.12, projectPortHeight: 1.6,
  datasetBack: -0.79, recess: 0.14, lip: 0.012,
} as const

// One gauge throughout the visible map. More ports reduce it, never enlarge the body.
export function connectionRadius(nodes: readonly ResourceNode[]): number {
  let radius: number = CONNECTION.pipeRadius
  for (const node of nodes) {
    const count = nodes.filter(child => child.parentId === node.id).length
    if (node.kind === 'project') {
      const incoming = nodes.some(parent => parent.id === node.parentId) ? 1 : 0
      radius = Math.min(radius, CONNECTION.projectPortHeight / (3 * Math.max(1, count + incoming - 1)))
    }
    if (node.kind === 'workspace') radius = Math.min(radius,
      CONNECTION.hubRadius * CONNECTION.hubArc / (3.6 * Math.max(1, count - 1)))
  }
  return radius
}
