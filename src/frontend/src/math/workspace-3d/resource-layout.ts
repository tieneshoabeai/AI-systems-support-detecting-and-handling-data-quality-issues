import type { PositionedResource, ResourceLayout, ResourceNode } from '../../types/workspace-3d/resource-map.types'
import { routeResources } from './resource-routing'
import { connectionRadius } from './resource-connection-profile'

type Validation = { ok: true; resources: readonly ResourceNode[] } | { ok: false; message: string }

export function validateResources(input: unknown): Validation {
  if (!Array.isArray(input)) return { ok: false, message: 'Danh sách tài nguyên không hợp lệ.' }
  const ids = new Map<string, ResourceNode>()
  for (const value of input) {
    if (!value || typeof value !== 'object'
      || typeof value.id !== 'string' || !value.id.trim()
      || typeof value.name !== 'string' || !value.name.trim()
      || !['workspace', 'project', 'dataset'].includes(value.kind)
      || (value.parentId !== null && (typeof value.parentId !== 'string' || !value.parentId.trim()))) {
      return { ok: false, message: 'Tài nguyên thiếu ID, tên, loại hoặc thông tin cha hợp lệ.' }
    }
    if (ids.has(value.id)) return { ok: false, message: 'ID tài nguyên bị trùng. Tên được phép trùng, ID thì không.' }
    ids.set(value.id, value)
  }
  for (const node of ids.values()) {
    const parent = node.parentId === null ? null : ids.get(node.parentId)
    if (node.kind === 'workspace' ? node.parentId !== null
      : !parent || parent.kind !== (node.kind === 'project' ? 'workspace' : 'project')) {
      return { ok: false, message: 'Quan hệ không hợp lệ: Workspace → Project → Dataset. Hãy kiểm tra parentId.' }
    }
  }
  // Strictly decreasing parent levels also rule out cycles.
  return { ok: true, resources: input }
}

export function resourceTrail(resources: readonly ResourceNode[], id: string | null): ResourceNode[] {
  const index = new Map(resources.map(node => [node.id, node]))
  const trail: ResourceNode[] = []
  let node = id === null ? undefined : index.get(id)
  const seen = new Set<string>()
  while (node && !seen.has(node.id)) {
    seen.add(node.id)
    trail.unshift(node)
    node = node.parentId === null ? undefined : index.get(node.parentId)
  }
  return trail
}

// Call after validation. Sibling order follows input, never the display name.
export function layoutResources(resources: readonly ResourceNode[], scopeId: string | null = null): ResourceLayout {
  const children = new Map<string | null, ResourceNode[]>()
  for (const node of resources) {
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node)
    children.set(node.parentId, siblings)
  }
  const root = resources.find(node => node.id === scopeId)
  const roots = root ? [root] : children.get(null) ?? []
  const nodes: PositionedResource[] = []
  type Branch = { width: number; depth: number; nodes: PositionedResource[] }
  function arrange(branches: Branch[]): Branch {
    if (!branches.length) return { width: 0, depth: 0, nodes: [] }
    const widths = branches.map(branch => branch.width)
    const gap = 2.5
    return {
      width: widths.reduce((sum, width) => sum + width, 0) + gap * (branches.length - 1),
      depth: Math.max(...branches.map(branch => branch.depth)),
      nodes: branches.flatMap((branch, index) => {
        const x = widths.slice(0, index).reduce((sum, width) => sum + width, 0) + gap * index
        return branch.nodes.map(node => ({ ...node, position: [node.position[0] + x, 0, node.position[2]] as [number, number, number] }))
      }),
    }
  }
  function place(resource: ResourceNode): Branch {
    const descendants = arrange((children.get(resource.id) ?? []).map(place))
    const width = Math.max(4, descendants.width)
    // Wide fans need longitudinal room too, otherwise neighbouring tubes almost touch at the outlets.
    const tierGap = Math.max(7.5, descendants.width * 0.4)
    return {
      width, depth: 3 + (descendants.nodes.length ? tierGap - 3 + descendants.depth : 0),
      nodes: [{ resource, position: [width / 2, 0, 0] }, ...descendants.nodes.map(node => ({
        ...node, position: [node.position[0] + (width - descendants.width) / 2, 0, node.position[2] + tierGap] as [number, number, number],
      }))],
    }
  }
  nodes.push(...arrange(roots.map(place)).nodes)
  const order = new Map(resources.map((node, index) => [node.id, index]))
  nodes.sort((a, b) => order.get(a.resource.id)! - order.get(b.resource.id)!)
  const routed = routeResources(nodes, connectionRadius(resources))
  const xs = nodes.map(node => node.position[0])
  const zs = nodes.map(node => node.position[2])
  const minX = Math.min(0, ...xs), maxX = Math.max(0, ...xs), maxZ = Math.max(0, ...zs)
  return { ...routed, center: [(minX + maxX) / 2, 0, maxZ / 2], span: Math.max(8, maxX - minX + 5, maxZ + 5) }
}

// Distance in curve-fraction per second; independent of monitor refresh rate.
export function advanceFlow(phase: number, delta: number): number {
  return (phase + Math.max(0, delta) * 0.22) % 1
}
