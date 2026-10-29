import { expect, it } from 'vitest'
import { resourceLabelBudget, shouldShowResourceLabel } from '../../math/workspace-3d/resource-label-policy'
import type { ResourceNode } from '../../types/workspace-3d/resource-map.types'

const dataset: ResourceNode = { id: 'd', kind: 'dataset', name: 'Data', parentId: 'p' }

it.each([[639, 4], [640, 8], [1024, 8], [341, 4]])('uses a label budget for scene width %i', (width, budget) => {
  expect(resourceLabelBudget(width)).toBe(budget)
})

it.each([[8, 1024, true], [9, 1024, false], [30, 1024, false], [4, 341, true], [5, 341, false]])(
  'changes dataset name visibility at the budget boundary: count %i, width %i', (count, width, expected) => {
    expect(shouldShowResourceLabel(dataset, count, width, [])).toBe(expected)
  },
)

it('always keeps workspace/project names, even when over budget', () => {
  expect(shouldShowResourceLabel({ ...dataset, kind: 'workspace', parentId: null }, 30, 341, [])).toBe(true)
  expect(shouldShowResourceLabel({ ...dataset, kind: 'project' }, 30, 341, [])).toBe(true)
})

it('reveals selected, hovered or keyboard-focused datasets without relying on name or array index', () => {
  for (const pins of [['d', null, null], [null, 'd', null], [null, null, 'd']]) {
    expect(shouldShowResourceLabel(dataset, 30, 341, pins)).toBe(true)
    expect(shouldShowResourceLabel({ ...dataset, id: 'different' }, 30, 341, pins)).toBe(false)
  }
})
