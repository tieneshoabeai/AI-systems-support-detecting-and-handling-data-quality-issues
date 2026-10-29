import type { ResourceNode } from '../../types/workspace-3d/resource-map.types'

// Presentation budgets, not limits on the number of resources rendered.
export function resourceLabelBudget(sceneWidth: number): number {
  return sceneWidth < 640 ? 4 : 8
}

export function shouldShowResourceLabel(
  resource: ResourceNode,
  resourceCount: number,
  sceneWidth: number,
  pinnedIds: readonly (string | null)[],
): boolean {
  return resource.kind !== 'dataset'
    || resourceCount <= resourceLabelBudget(sceneWidth)
    || pinnedIds.includes(resource.id)
}
