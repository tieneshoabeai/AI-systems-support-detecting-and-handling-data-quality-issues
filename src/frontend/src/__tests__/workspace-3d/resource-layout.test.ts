import { describe, expect, it } from 'vitest'
import { advanceFlow, layoutResources, resourceTrail, validateResources } from '../../math/workspace-3d/resource-layout'
import { extendedPreviewResources, previewResources } from '../../views/workspace-3d/preview-resources'

describe('resource model and deterministic layout', () => {
  it('maps every parent relation, including the 30-resource fixture, without mutating input', () => {
    for (const resources of [previewResources, extendedPreviewResources]) {
      const frozen = Object.freeze(resources.map(node => Object.freeze({ ...node })))
      expect(validateResources(frozen).ok).toBe(true)
      const layout = layoutResources(frozen)
      expect(layout.nodes).toHaveLength(resources.length)
      expect(layout.edges).toHaveLength(resources.length - 1)
      expect(layout.nodes.every(node => node.position.every(Number.isFinite))).toBe(true)
      expect(new Set(layout.nodes.map(node => node.position.join(','))).size).toBe(resources.length)
      for (const edge of layout.edges) expect(edge.target.resource.parentId).toBe(edge.source.resource.id)
      expect(layoutResources(frozen)).toEqual(layout)
    }
  })

  it('adds one dataset/edge, while a rename preserves existing identities, order and positions', () => {
    const before = layoutResources(previewResources)
    const renamed = previewResources.map(node => ({ ...node, name: 'Tên trùng — khách hàng 🐙' }))
    const after = layoutResources(renamed)
    expect(after.nodes.map(node => [node.resource.id, node.position])).toEqual(before.nodes.map(node => [node.resource.id, node.position]))
    const added = layoutResources([...previewResources, { id: 'extra', name: 'Mới', kind: 'dataset', parentId: 'demo-sales' }])
    expect(added.nodes.length).toBe(before.nodes.length + 1)
    expect(added.edges.length).toBe(before.edges.length + 1)
  })

  it('handles empty, single root, multiple workspaces and scoped exploration', () => {
    expect(validateResources([]).ok).toBe(true)
    expect(layoutResources([]).nodes).toEqual([])
    expect(layoutResources([previewResources[0]]).edges).toEqual([])
    expect(layoutResources([...previewResources, { id: 'w2', kind: 'workspace', name: 'Second', parentId: null }]).nodes).toHaveLength(7)
    const scoped = layoutResources(previewResources, 'demo-sales')
    expect(scoped.nodes).toHaveLength(3)
    expect(scoped.edges).toHaveLength(2)
    expect(resourceTrail(previewResources, 'demo-orders').map(node => node.id)).toEqual(['demo-workspace', 'demo-sales', 'demo-orders'])
  })

  it.each([
    null, undefined, {}, [null], [{ ...previewResources[0], id: '' }],
    [{ ...previewResources[0], name: '  ' }], [{ ...previewResources[0], name: 12 }],
    [{ ...previewResources[0], kind: 'bank' }], [{ ...previewResources[0], parentId: undefined }],
    [previewResources[0], previewResources[0]],
    [{ ...previewResources[0], parentId: 'demo-workspace' }],
    [previewResources[0], { ...previewResources[1], parentId: 'missing' }],
    [previewResources[0], { ...previewResources[1], parentId: 'demo-sales' }],
    [previewResources[0], { ...previewResources[3], parentId: 'demo-workspace' }],
    [{ ...previewResources[0], parentId: 'demo-sales' }, previewResources[1]],
  ])('rejects invalid records/relations explicitly: %j', value => {
    const result = validateResources(value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0)
  })

  it('advances flow by elapsed time rather than number of frames', () => {
    const simulate = (fps: number) => Array.from({ length: fps * 10 }).reduce<number>(phase => advanceFlow(phase, 1 / fps), 0)
    expect(simulate(30)).toBeCloseTo(simulate(120), 10)
    expect(advanceFlow(0.3, 0)).toBe(0.3)
  })
})
