// Fingerprint of the holographic core model: one deterministic line per scene-graph object.
//
// This is the gate the tower refactor runs against. Phase 2-5 claim "nothing visible changed";
// this module turns that claim into a byte comparison. Both the baseline generator
// (.agents/dataset-3d-core/captures/model-fingerprint.measure.ts) and the suite test
// (src/__tests__/dataset-3d/model-fingerprint.test.ts) call buildFingerprint(), so a baseline can
// never be validated by a different spec than the one that checks it.
//
// Two rules the numbers depend on:
//   1. Everything is quantised to 6 decimals BEFORE hashing, so a platform that differs in the last
//      bit of Math.sin still produces the same line.
//   2. Traversal order is THREE's own `traverse` order, and each line carries its child-index path,
//      so an insertion-order change shows up as a shifted line rather than a silent match.

import * as THREE from 'three'

type ModelApi = {
  model: THREE.Object3D
  update(elapsedSeconds: number, deltaSeconds: number): void
  resetMotion(): void
  setDetached(detached: boolean): void
  snapDetach(): void
  setSelected(componentId: string | null): void
  resolvePart(object: THREE.Object3D): {
    id: string
    name: string
    role: string
    material: string
    level: string
    dimensions: { width: number; height: number; depth: number; units: string }
  } | null
}

const QUANT = 6

function q(value: number): string {
  // -0 and 0 must not hash differently; NaN/Infinity keep their literal name.
  const normalised = Object.is(value, -0) ? 0 : value
  return normalised.toFixed(QUANT)
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function quantisedArray(values: ArrayLike<number>): string {
  let out = ''
  for (let index = 0; index < values.length; index += 1) out += q(values[index]) + ','
  return fnv1a(out)
}

// A material is identified by object identity, not by value: two MeshPhysicalMaterials with equal
// properties are still two materials, and the tower plan's risk is exactly that `tone.glass` gets
// cloned into 18 copies (or the reverse). Group ids are handed out on first appearance.
function describeMaterial(material: THREE.Material | THREE.Material[], groups: Map<THREE.Material, number>): string {
  const list = Array.isArray(material) ? material : [material]
  return list.map(entry => {
    let group = groups.get(entry)
    if (group === undefined) {
      group = groups.size
      groups.set(entry, group)
    }
    const withColor = entry as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number }
    const flags = [
      `c=${withColor.color?.getHexString() ?? '-'}`,
      `e=${withColor.emissive?.getHexString() ?? '-'}`,
      `ei=${q(withColor.emissiveIntensity ?? -1)}`,
      `o=${q(entry.opacity)}`,
      `t=${entry.transparent ? 1 : 0}`,
      `dw=${entry.depthWrite ? 1 : 0}`,
      `s=${entry.side}`,
      `b=${entry.blending}`,
      `tm=${entry.toneMapped ? 1 : 0}`,
    ].join(';')
    return `#${group} ${entry.type} ${fnv1a(flags)}`
  }).join('+')
}

function describeGeometry(geometry: THREE.BufferGeometry | undefined, detail: boolean): string {
  if (!geometry) return 'geo[-]'
  const position = geometry.getAttribute('position')
  if (!position) return `geo[${geometry.type}|no-position]`
  const names = Object.keys(geometry.attributes).sort().join('+')
  if (!detail) return `geo[${geometry.type}|${names}|n=${position.count}]`
  const index = geometry.getIndex()
  const normal = geometry.getAttribute('normal')
  return `geo[${geometry.type}|${names}|n=${position.count}|p=${quantisedArray(position.array)}` +
    `|i=${index ? quantisedArray(index.array) : '-'}|v=${normal ? quantisedArray(normal.array) : '-'}]`
}

function describeInstancing(object: THREE.Object3D, detail: boolean): string {
  if (!(object instanceof THREE.InstancedMesh)) return ''
  const colours = object.instanceColor
  const suffix = colours ? (detail ? `|col=${quantisedArray(colours.array)}` : `|col=n=${colours.count}`) : ''
  return `inst[${object.count}|m=${detail ? quantisedArray(object.instanceMatrix.array) : `n=${object.instanceMatrix.count}`}${suffix}]`
}

function describePart(object: THREE.Object3D, api: ModelApi): string {
  const part = api.resolvePart(object)
  if (!part) return ''
  const { dimensions } = part
  return `part[${part.id}|${part.role}|${part.level}|${part.material}|${q(dimensions.width)}x${q(dimensions.height)}x${q(dimensions.depth)}|${part.dimensions.units}]`
}

type Options = { detail: boolean }

// Child-index path from the model root, rebuilt from the parent chain so a re-parenting or an
// insertion anywhere in the tree shifts the lines that follow it.
function pathOf(object: THREE.Object3D, root: THREE.Object3D): string {
  const hops: number[] = []
  let current: THREE.Object3D = object
  while (current !== root && current.parent) {
    hops.push(current.parent.children.indexOf(current))
    current = current.parent
  }
  return hops.reverse().join('/')
}

export function walkModel(api: ModelApi, options: Options): string[] {
  const groups = new Map<THREE.Material, number>()
  const lines: string[] = []
  api.model.traverse(object => {
    const line = [
      `path[${pathOf(object, api.model)}]`,
      `nm[${object.name}]`,
      object.type,
      `vis=${object.visible ? 1 : 0}`,
      `ro=${object.renderOrder}`,
      `m[${quantisedArray(object.matrixWorld.elements)}]`,
    ]
    const drawable = object as THREE.Mesh
    if (drawable.isMesh || object instanceof THREE.LineSegments || object instanceof THREE.Points || object instanceof THREE.Sprite) {
      line.push(describeGeometry(drawable.geometry, options.detail))
      line.push(`mat[${describeMaterial(drawable.material, groups)}]`)
    }
    const instancing = describeInstancing(object, options.detail)
    if (instancing) line.push(instancing)
    if (object instanceof THREE.Mesh) line.push(describePart(object, api))
    line.push(`ray[${fnv1a(object.raycast.toString())}]`)
    lines.push(line.join(' '))
  })
  return lines
}

// Header block: the object/material counts and the sharing map, which is where "one glass material
// for 18 towers" is either confirmed or broken.
export function materialSummary(api: ModelApi): string[] {
  const groups = new Map<THREE.Material, number>()
  const users = new Map<number, number>()
  api.model.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!(mesh.isMesh || object instanceof THREE.LineSegments || object instanceof THREE.Points || object instanceof THREE.Sprite)) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const entry of list) {
      let group = groups.get(entry)
      if (group === undefined) {
        group = groups.size
        groups.set(entry, group)
      }
      users.set(group, (users.get(group) ?? 0) + 1)
    }
  })
  const shared = [...users.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => a[0] - b[0])
    .map(([group, count]) => `g${group}x${count}`)
    .join(',')
  return [`materials total=${groups.size} shared=${shared || 'none'}`]
}

export type Moment = 'init' | 'update-7.3' | 'reset-motion' | 'detached' | 'selected-18'

const TOWER_IDS = [
  'tower-01-back-high', 'tower-02', 'tower-03', 'tower-04', 'tower-07', 'tower-08', 'tower-09',
  'tower-10', 'tower-12', 'tower-13', 'tower-14', 'tower-16', 'tower-17', 'tower-18',
]

// Each moment rebuilds its own model: the factory is a closure with mutable state, so reusing one
// instance across moments would make the record depend on the order the moments were asked for.
export function buildFingerprint(apiFor: () => ModelApi, moment: Moment): string[] {
  const api = apiFor()
  if (moment === 'update-7.3') api.update(7.3, 0.016)
  if (moment === 'reset-motion') { api.update(7.3, 0.016); api.resetMotion() }
  if (moment === 'detached') { api.setDetached(true); api.snapDetach() }
  if (moment === 'selected-18') {
    const lines: string[] = []
    for (const id of TOWER_IDS) {
      const fresh = apiFor()
      fresh.setSelected(id)
      let visibleContours = 0
      let detail = 'none'
      fresh.model.traverse(object => {
        if (object.name !== 'selection-contour' || !object.visible) return
        visibleContours += 1
        const mesh = object as THREE.LineSegments
        const contour = mesh.material as THREE.LineBasicMaterial
        const geometry = mesh.geometry
        const position = geometry.getAttribute('position')
        detail = `on[${pathOf(object, fresh.model)}|parent=${object.parent?.name ?? '-'}|` +
          `verts=${position ? position.count : 0}|hash=${position ? quantisedArray(position.array) : '-'}|op=${q(contour.opacity)}]`
      })
      fresh.setSelected(null)
      let cleared = 0
      fresh.model.traverse(object => { if (object.name === 'selection-contour' && object.visible) cleared += 1 })
      lines.push(`sel[${id}] visible=${visibleContours} ${detail} afterClear=${cleared}`)
    }
    return lines
  }
  return [...materialSummary(api), ...walkModel(api, { detail: moment === 'init' })]
}

export function fingerprintHeader(moment: Moment): string {
  return `# moment=${moment}`
}

export function renderFingerprint(apiFor: () => ModelApi, moment: Moment): string {
  return [fingerprintHeader(moment), ...buildFingerprint(apiFor, moment)].join('\n') + '\n'
}
