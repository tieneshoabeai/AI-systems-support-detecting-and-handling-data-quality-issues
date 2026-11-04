import * as THREE from 'three'
import {
  createHolographicOrbitalDataCoreV2Model,
  type ProceduralModelRuntime,
} from './generated-core'
import { createInboundStreams } from './inbound-streams'
import { CORE_VISUAL_REVISION, ISSUE_CONSTELLATION, resolveCoreGlow } from './core-visual-config'
import { createIssueConstellation } from './issue-constellation'
import { createSpoolCore } from './spool-core'
import { CYAN, addTechnicalLine, addTechnicalRods } from './technical-lines'
import { DETACH_DISTANCE, OUTER_TOWER_IDS, TOWER_IDS } from './tower-config'
import { conformOriginalTowers, createTowerRing } from './tower-ring'
import {
  NON_SELECTABLE_PART_IDS,
  type HolographicPartComponent,
  type HolographicPartInfo,
} from '../../types/dataset-3d/holographic-part.types'

type HolographicCoreProductModel = {
  model: THREE.Group
  update(elapsedSeconds: number, deltaSeconds: number): void
  resetMotion(): void
  snapDetach(): void
  setDetached(detached: boolean): void
  setSelected(componentId: string | null): void
  resolvePart(object: THREE.Object3D): HolographicPartInfo | null
  dispose(): void
}

const TIER_OPACITY: Record<string, number> = {
  'core-upper': 0.70,
  'core-lower': 0.65,
  'core-foot': 0.22,
  'core-mid-collar': 0.34,
  'core-lower-collar': 0.30,
  'base-shell': 0.35,
  'base-deck': 0.07,
  'base-intermediate': 0.18,
  'base-sector-01': 0.12, 'base-sector-02': 0.12, 'base-sector-03': 0.12, 'base-sector-04': 0.12,
  'base-sector-05': 0.12, 'base-sector-06': 0.12, 'base-sector-07': 0.12, 'base-sector-08': 0.12,
}
const MATERIAL_PRESETS = {
  'blue-volume': { color: '#075bff', emissive: '#1065ff', intensity: 0.6, opacity: 0.24 },
  'cyan-contour': { color: '#2fe0ff', emissive: '#2fe0ff', intensity: 0.6, opacity: 0.30 },
  'violet-band': { color: '#a01fd8', emissive: '#c33ff0', intensity: 0.6, opacity: 0.45 },
  'blue-face': { color: '#0a63ff', emissive: '#1a7cff', intensity: 0.7, opacity: 0.40 },
  'field-fill': { color: '#0c5ced', emissive: '#1a7cff', intensity: 0.4, opacity: 0.10 },
  'base-intermediate': { color: '#0a5bff', emissive: '#1a7bff', intensity: 0.55, opacity: 0.30 },
} as const

function createIntermediateBase(runtime: ProceduralModelRuntime) {
  const baseNode = runtime.nodes['base-shell']
  if (!baseNode) throw new Error('Thiếu base-shell để gắn base-intermediate')
  const node = new THREE.Group()
  node.name = 'base-intermediate'
  node.position.y = 0.46 + 0.20 / 2 - 0.225
  const profile = [
    new THREE.Vector2(2.15, -0.10), new THREE.Vector2(2.70, -0.10),
    new THREE.Vector2(2.70, 0.10), new THREE.Vector2(2.15, 0.10),
    new THREE.Vector2(2.15, -0.10),
  ]
  const preset = MATERIAL_PRESETS['base-intermediate']
  const mesh = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 96),
    new THREE.MeshStandardMaterial({ color: preset.color, emissive: preset.emissive, emissiveIntensity: preset.intensity, transparent: true, opacity: preset.opacity, side: THREE.DoubleSide, depthWrite: false }),
  )
  mesh.name = 'base-intermediate'
  mesh.userData.sculptComponent = {
    id: 'base-intermediate',
    name: 'Intermediate base drum',
    role: 'projected-part',
    material: 'base-intermediate',
    level: 'macro',
    dimensions: { width: 5.4, height: 0.2, depth: 5.4, units: 'relative' },
  }
  node.add(mesh)
  baseNode.add(node)
  runtime.nodes['base-intermediate'] = node
  runtime.meshes['base-intermediate'] = mesh
}

function addPlanarGrid(parent: THREE.Object3D, radii: number[], spokes: number, y: number, opacity: number, color = CYAN) {
  const vertices: number[] = []
  for (const radius of radii) {
    for (let index = 0; index < spokes; index += 1) {
      const start = index / spokes * Math.PI * 2
      const end = (index + 1) / spokes * Math.PI * 2
      vertices.push(Math.cos(start) * radius, y, Math.sin(start) * radius)
      vertices.push(Math.cos(end) * radius, y, Math.sin(end) * radius)
    }
  }
  for (let index = 0; index < spokes; index += 1) {
    const angle = index / spokes * Math.PI * 2
    const outerRadius = radii.at(-1) ?? 0
    vertices.push(0, y, 0, Math.cos(angle) * outerRadius, y, Math.sin(angle) * outerRadius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const grid = new THREE.LineSegments(geometry, material)
  grid.name = 'technical-planar-grid'
  grid.renderOrder = 5
  parent.add(grid)
}

function addBaseWallGrid(parent: THREE.Object3D, radius: number, yBottom: number, yTop: number, color = CYAN) {
  const verticals: number[] = []
  const segments = 16
  for (let column = 0; column < segments; column += 1) {
    const angle = column / segments * Math.PI * 2
    verticals.push(Math.cos(angle) * radius, yBottom, Math.sin(angle) * radius, Math.cos(angle) * radius, yTop, Math.sin(angle) * radius)
  }
  addTechnicalRods(parent, verticals, { thickness: 0.014, opacity: 0.78, name: 'base-wall-post', color })

  const ringLayer = (y: number, thickness: number, opacity: number) => {
    const rims: number[] = []
    for (let segment = 0; segment < 96; segment += 1) {
      const start = segment / 96 * Math.PI * 2
      const end = (segment + 1) / 96 * Math.PI * 2
      rims.push(Math.cos(start) * radius, y, Math.sin(start) * radius, Math.cos(end) * radius, y, Math.sin(end) * radius)
    }
    addTechnicalRods(parent, rims, { thickness, opacity, name: 'base-wall-ring', color })
  }
  // The lower rim carries the most weight, so the base reads with depth top-down.
  ringLayer(yBottom, 0.016, 0.55)
  ringLayer((yBottom + yTop) / 2, 0.011, 0.42)
  ringLayer(yTop, 0.011, 0.3)
}

// The reference deck is a raised ring platform around a recessed moat, not a filled disc.
function addDeckRecess(parent: THREE.Object3D) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(1.45, 2.35, 96, 1),
    new THREE.MeshBasicMaterial({ color: '#01040e', transparent: true, opacity: 0.84, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.452
  mesh.name = 'deck-recess'
  mesh.renderOrder = 4
  parent.add(mesh)

  // Chevron plate seams across the raised platform ring, matching the reference deck.
  const seams: number[] = []
  for (let index = 0; index < 24; index += 1) {
    const start = index / 24 * Math.PI * 2
    const end = (index + 0.5) / 24 * Math.PI * 2
    for (const [radius, depth] of [[2.62, 0.06], [2.86, 0.06]] as const) {
      seams.push(Math.cos(start) * radius, 0.456, Math.sin(start) * radius, Math.cos(end) * (radius - depth), 0.456, Math.sin(end) * (radius - depth))
    }
  }
  addTechnicalRods(parent, seams, { thickness: 0.008, opacity: 0.6, name: 'deck-chevron-rod' })
}

function addHotspot(parent: THREE.Object3D, position: THREE.Vector3, radius: number, opacity: number, color = '#d8ffff') {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const hotspot = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material)
  hotspot.name = 'holographic-hotspot'
  hotspot.position.copy(position)
  hotspot.renderOrder = 8
  parent.add(hotspot)
  return hotspot
}

function addCylinderGrid(parent: THREE.Object3D, radius: number, height: number, horizontalCount: number, verticalCount: number, opacity: number) {
  const positions: number[] = []
  for (let row = 1; row <= horizontalCount; row += 1) {
    const y = -height / 2 + row * height / (horizontalCount + 1)
    for (let segment = 0; segment < 32; segment += 1) {
      const start = segment / 32 * Math.PI * 2
      const end = (segment + 1) / 32 * Math.PI * 2
      positions.push(radius * Math.cos(start), y, radius * Math.sin(start), radius * Math.cos(end), y, radius * Math.sin(end))
    }
  }
  for (let column = 0; column < verticalCount; column += 1) {
    const angle = column / verticalCount * Math.PI * 2
    positions.push(radius * Math.cos(angle), -height / 2, radius * Math.sin(angle), radius * Math.cos(angle), height / 2, radius * Math.sin(angle))
  }
  addTechnicalLine(parent, positions, opacity)
}

function addScatteredNodes(parent: THREE.Object3D, positions: number[], size: number) {
  const nodes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(size, 1),
    new THREE.MeshBasicMaterial({ color: '#89f7ff', transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    positions.length / 3,
  )
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < positions.length; index += 3) {
    matrix.makeTranslation(positions[index], positions[index + 1], positions[index + 2])
    nodes.setMatrixAt(index / 3, matrix)
  }
  nodes.instanceMatrix.needsUpdate = true
  nodes.name = 'scattered-holographic-nodes'
  nodes.renderOrder = 7
  parent.add(nodes)
  return nodes
}

function addCapSolarRays(parent: THREE.Object3D) {
  for (const [innerRadius, outerRadius, opacity] of [[0.06, 0.26, 0.4], [0.26, 0.52, 0.22], [0.52, 0.82, 0.08]]) {
    const positions: number[] = []
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = ray / 12 * Math.PI * 2
      positions.push(innerRadius * Math.cos(angle), 0.038, innerRadius * Math.sin(angle), outerRadius * Math.cos(angle), 0.038, outerRadius * Math.sin(angle))
    }
    addTechnicalLine(parent, positions, opacity)
  }
}

function applyHolographicMaterials(runtime: ProceduralModelRuntime) {
  for (const [componentId, mesh] of Object.entries(runtime.meshes)) {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!(material instanceof THREE.MeshStandardMaterial)) continue
    const component = mesh.userData.sculptComponent as { material?: unknown } | undefined
    const materialRole = typeof component?.material === 'string' ? component.material : 'base-intermediate'
    const preset = MATERIAL_PRESETS[materialRole as keyof typeof MATERIAL_PRESETS] ?? MATERIAL_PRESETS['base-intermediate']
    material.transparent = true
    // Only the upper drum writes depth, so the pedestal ring behind it stays hidden
    // while the lower glass sections keep their see-through look.
    material.depthWrite = componentId === 'core-upper'
    material.side = THREE.DoubleSide
    material.roughness = 0.34
    material.metalness = 0
    material.color.set(preset.color)
    material.emissive.set(preset.emissive)
    material.emissiveIntensity = preset.intensity
    material.opacity = TIER_OPACITY[componentId] ?? preset.opacity
    mesh.userData.holographicMaterialRole = materialRole
    mesh.renderOrder = 1
  }
  for (const [componentId, mesh] of Object.entries(runtime.meshes)) {
    // Towers get their architecture later in the factory, including a beveled outline;
    // a box EdgesGeometry here would double the silhouette with stale cube seams.
    if (componentId.startsWith('tower-')) continue
    const materialRole = mesh.userData.holographicMaterialRole as string | undefined
    const contourColor = materialRole === 'violet-band' ? '#ff6cf0' : CYAN
    const contourOpacity = materialRole === 'cyan-contour' ? 0.5 : materialRole === 'violet-band' ? 0.7 : 0.3
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 28),
      new THREE.LineBasicMaterial({ color: contourColor, transparent: true, opacity: contourOpacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    edges.name = 'holographic-contour'
    edges.renderOrder = 5
    mesh.add(edges)
  }
}

function conformToReference(runtime: ProceduralModelRuntime) {
  conformOriginalTowers(runtime)

  const upperMesh = runtime.meshes['core-upper']
  const upperNode = runtime.nodes['core-upper']
  if (upperMesh && upperNode) {
    upperMesh.scale.y = 1.3
    upperNode.position.y = 2.08
    const cap = runtime.nodes['core-cap']
    if (cap) cap.position.y = 0.76
  }
  const lowerMesh = runtime.meshes['core-lower']
  if (lowerMesh) {
    // Reference neck under the pedestal is narrower than the drum, so the wide collar reads as a disc.
    lowerMesh.scale.x = 0.75
    lowerMesh.scale.z = 0.75
  }
  const midCollarNode = runtime.nodes['core-mid-collar']
  if (midCollarNode) midCollarNode.position.y = 1.3
  const midCollar = runtime.meshes['core-mid-collar']
  if (midCollar) {
    midCollar.scale.set(0.93, 1.3, 0.93)
    const mat = midCollar.material as THREE.MeshStandardMaterial
    mat.color.set('#0a5cff')
    mat.emissive.set('#1a86ff')
    mat.emissiveIntensity = 0.3
    mat.opacity = 0.3
    midCollar.traverse(child => {
      if (child instanceof THREE.LineSegments) (child.material as THREE.LineBasicMaterial).opacity = 0.28
    })
  }
  const orbitBand = runtime.meshes['orbit-violet']
  if (orbitBand) {
    // The flat lathe band plus its two rim lines render as a doubled ring; the reference orbit is
    // a single glowing line, carried by the core-light torus and halo added below.
    ;(orbitBand.material as THREE.MeshStandardMaterial).opacity = 0.28
    orbitBand.traverse(child => {
      if (child instanceof THREE.LineSegments) (child.material as THREE.LineBasicMaterial).opacity = 0.7
    })
  }
  const lowerCollar = runtime.meshes['core-lower-collar']
  if (lowerCollar) {
    lowerCollar.scale.set(0.75, 0.6, 0.75)
    const mat = lowerCollar.material as THREE.MeshStandardMaterial
    mat.color.set(CYAN)
    mat.emissive.set(CYAN)
    mat.emissiveIntensity = 0.7
    mat.opacity = 0.24
    lowerCollar.traverse(child => {
      if (child instanceof THREE.LineSegments) {
        const line = child.material as THREE.LineBasicMaterial
        line.color.set('#7de6ff')
        line.opacity = 0.32
      }
    })
  }
  // Shared role materials are too hot on the crowned cap and foot, so give those two their own copy.
  const capMesh = runtime.meshes['core-cap']
  if (capMesh) {
    const mat = (capMesh.material as THREE.MeshStandardMaterial).clone()
    mat.emissiveIntensity = 0.45
    mat.opacity = 0.4
    capMesh.material = mat
    capMesh.traverse(child => {
      if (child instanceof THREE.LineSegments) (child.material as THREE.LineBasicMaterial).opacity = 0.35
    })
  }
  const footMesh = runtime.meshes['core-foot']
  if (footMesh) {
    const mat = (footMesh.material as THREE.MeshStandardMaterial).clone()
    mat.emissiveIntensity = 0.45
    mat.opacity = 0.18
    footMesh.material = mat
  }
}

function clonePartMaterial(mesh: THREE.Mesh, patch: { color?: string; emissive?: string; opacity?: number; emissiveIntensity?: number; roughness?: number }) {
  const material = (mesh.material as THREE.MeshStandardMaterial).clone()
  if (patch.color) material.color.set(patch.color)
  if (patch.emissive) material.emissive.set(patch.emissive)
  if (patch.opacity !== undefined) material.opacity = patch.opacity
  if (patch.emissiveIntensity !== undefined) material.emissiveIntensity = patch.emissiveIntensity
  if (patch.roughness !== undefined) material.roughness = patch.roughness
  mesh.material = material
}

function setPartContourOpacity(mesh: THREE.Object3D, opacity: number) {
  mesh.traverse(child => {
    if (child instanceof THREE.LineSegments) (child.material as THREE.LineBasicMaterial).opacity = opacity
  })
}

// The shell's inner rims sit on the wall faces themselves, so they carry the wall color instead of
// cyan linework; the outer rims keep the contour color.
const SHELL_FACE_LINE_COLOR = '#3a1a6e'

function matchInnerShellRings(mesh: THREE.Mesh) {
  const contour = mesh.children.find((child): child is THREE.LineSegments =>
    child instanceof THREE.LineSegments && child.name === 'holographic-contour')
  if (!contour) return
  const position = contour.geometry.getAttribute('position')
  const outerPositions: number[] = []
  const innerPositions: number[] = []
  for (let index = 0; index < position.count; index += 2) {
    const radius = (Math.hypot(position.getX(index), position.getZ(index))
      + Math.hypot(position.getX(index + 1), position.getZ(index + 1))) / 2
    const target = radius < 2.6 ? innerPositions : outerPositions
    for (const vertex of [index, index + 1]) {
      target.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
    }
  }
  const outerGeometry = new THREE.BufferGeometry()
  outerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outerPositions, 3))
  const innerGeometry = new THREE.BufferGeometry()
  innerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(innerPositions, 3))
  mesh.remove(contour)
  contour.geometry.dispose()
  const outer = new THREE.LineSegments(outerGeometry, contour.material)
  outer.name = 'holographic-contour'
  outer.renderOrder = contour.renderOrder
  mesh.add(outer)
  const inner = new THREE.LineSegments(
    innerGeometry,
    new THREE.LineBasicMaterial({
      color: SHELL_FACE_LINE_COLOR,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  )
  inner.name = 'holographic-contour'
  inner.renderOrder = contour.renderOrder
  mesh.add(inner)
}

// Rim edges that run along the shell faces take the wall color so they read as face edges.
function matchFaceContour(mesh: THREE.Object3D) {
  mesh.traverse(child => {
    if (!(child instanceof THREE.LineSegments) || child.name !== 'holographic-contour') return
    const material = child.material as THREE.LineBasicMaterial
    material.color.set(SHELL_FACE_LINE_COLOR)
    material.blending = THREE.NormalBlending
    material.opacity = 0.9
  })
}

// The pedestal reads with depth only if its bottom rim outweighs the top rim.
function applyBaseDepth(runtime: ProceduralModelRuntime) {
  const bottomRim = runtime.meshes['base-rim-outer-bottom']
  if (bottomRim) {
    clonePartMaterial(bottomRim, { opacity: 0.6, emissiveIntensity: 1.15 })
    setPartContourOpacity(bottomRim, 1)
  }
  const outerTopRim = runtime.meshes['base-rim-outer-top']
  if (outerTopRim) {
    clonePartMaterial(outerTopRim, { opacity: 0.36, emissiveIntensity: 0.9 })
    setPartContourOpacity(outerTopRim, 0.45)
  }
  const innerTopRim = runtime.meshes['base-rim-inner-top']
  if (innerTopRim) {
    clonePartMaterial(innerTopRim, { opacity: 0.32 })
    matchFaceContour(innerTopRim)
  }
  const shell = runtime.meshes['base-shell']
  if (shell) {
    // The shell wall stays a touch brighter than the sector wedges so the pedestal still reads
    // as one volume, but its faces no longer wash out the darker sector plates.
    clonePartMaterial(shell, { color: '#041d44', emissive: '#083b88', emissiveIntensity: 0.5, opacity: 0.4 })
    setPartContourOpacity(shell, 0.15)
    matchInnerShellRings(shell)
  }
  const intermediate = runtime.meshes['base-intermediate']
  if (intermediate) (intermediate.material as THREE.MeshStandardMaterial).opacity = 0.34
  for (let index = 1; index <= 8; index += 1) {
    const sector = runtime.meshes[`base-sector-0${index}`]
    if (sector) setPartContourOpacity(sector, 0.48)
  }
}

function addEdgeRods(mesh: THREE.Mesh, options: { thickness: number; opacity: number; color: string; name: string }) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 30)
  const positions = Array.from(edges.getAttribute('position').array)
  edges.dispose()
  addTechnicalRods(mesh, positions, { ...options, blending: THREE.NormalBlending })
}

// ExtrudeGeometry merges every cap and wall into two groups. The wedge needs four shading
// levels (top, underside, inner shell, outer shell), so triangles are re-bucketed here.
function splitSectorFaceGroups(mesh: THREE.Mesh) {
  const source = mesh.geometry
  const geometry = source.index ? source.toNonIndexed() : source.clone()
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const buckets: number[][] = [[], [], [], []]
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const normalZ = normal.getZ(vertex)
    let bucket: number
    if (normalZ > 0.5) bucket = 0
    else if (normalZ < -0.5) bucket = 1
    else {
      const centroidY = (position.getY(vertex) + position.getY(vertex + 1) + position.getY(vertex + 2)) / 3
      // The inner arc sits on the +y half of the extruded local profile.
      bucket = centroidY > 0.1 ? 2 : 3
    }
    for (let corner = 0; corner < 3; corner += 1) {
      const at = vertex + corner
      buckets[bucket].push(
        position.getX(at), position.getY(at), position.getZ(at),
        normal.getX(at), normal.getY(at), normal.getZ(at),
      )
    }
  }
  const positions: number[] = []
  const normals: number[] = []
  const groups: Array<[number, number]> = []
  for (const bucket of buckets) {
    groups.push([positions.length / 3, bucket.length / 6])
    for (let at = 0; at < bucket.length; at += 6) {
      positions.push(bucket[at], bucket[at + 1], bucket[at + 2])
      normals.push(bucket[at + 3], bucket[at + 4], bucket[at + 5])
    }
  }
  const rebuilt = new THREE.BufferGeometry()
  rebuilt.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rebuilt.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  let start = 0
  groups.forEach(([, count], materialIndex) => {
    rebuilt.addGroup(start, count, materialIndex)
    start += count
  })
  mesh.geometry = rebuilt
  geometry.dispose()
  source.dispose()
}

// The reference reads as dark glass volumes lit by bright linework, so dark faces replace
// the additive cyan wash on towers, collar, lower drum and pedestal sectors.
function applyFaceShading(runtime: ProceduralModelRuntime) {
  const lower = runtime.meshes['core-lower']
  if (lower) {
    clonePartMaterial(lower, { color: '#041a38', emissive: '#0a47a8', emissiveIntensity: 0.4, opacity: 0.75 })
    setPartContourOpacity(lower, 0.36)
  }
  const collar = runtime.meshes['core-mid-collar']
  if (collar) {
    clonePartMaterial(collar, { color: '#04152b', emissive: '#0a3f8c', emissiveIntensity: 0.42, opacity: 0.52 })
    setPartContourOpacity(collar, 0.1)
    addEdgeRods(collar, { thickness: 0.01, opacity: 0.85, color: '#ffffff', name: 'collar-edge-rod' })
  }
  const cap = runtime.meshes['core-cap']
  if (cap) cap.scale.y = 0.5

  // Order: top cap, underside, inner shell, outer shell.
  const sectorMaterials = [
    new THREE.MeshStandardMaterial({ color: '#062a63', emissive: '#0b4bb8', emissiveIntensity: 0.4, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, roughness: 0.34, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: '#020b1c', emissive: '#041a3e', emissiveIntensity: 0.15, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false, roughness: 0.34, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: '#020d1f', emissive: '#052046', emissiveIntensity: 0.18, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, roughness: 0.34, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: '#04193c', emissive: '#083a8c', emissiveIntensity: 0.3, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, roughness: 0.34, metalness: 0 }),
  ]
  for (let index = 1; index <= 8; index += 1) {
    const sector = runtime.meshes[`base-sector-0${index}`]
    if (!sector) continue
    splitSectorFaceGroups(sector)
    sector.material = sectorMaterials
    setPartContourOpacity(sector, 0.12)
    addEdgeRods(sector, { thickness: 0.0065, opacity: 0.9, color: '#0e6c86', name: 'sector-edge-rod' })
  }
}

// Three tiers read apart by value and hue: violet pedestal, steel-blue towers, cyan core.
const TIER_CONTOUR = { base: '#8a5bff', core: '#4de6ff' } as const

function paintPart(
  mesh: THREE.Mesh | undefined,
  patch: { color?: string; emissive?: string; opacity?: number; emissiveIntensity?: number; roughness?: number },
  contour?: { color: string; opacity: number },
) {
  if (!mesh) return
  clonePartMaterial(mesh, patch)
  if (!contour) return
  mesh.traverse(child => {
    if (!(child instanceof THREE.LineSegments) || child.name !== 'holographic-contour') return
    const material = child.material as THREE.LineBasicMaterial
    material.color.set(contour.color)
    material.opacity = contour.opacity
  })
}

function applyTierContrast(runtime: ProceduralModelRuntime) {
  // Core stays below bloom threshold 1.0 in v3; thin nucleus bands carry the HDR instead.
  for (const [id, entry] of Object.entries(resolveCoreGlow())) {
    paintPart(runtime.meshes[id], entry.patch, entry.contour)
  }

  // Base: deep violet mass, translucent enough for the core glow to pass overhead.
  paintPart(runtime.meshes['base-shell'],
    { color: '#2a0f52', emissive: '#6d3bff', emissiveIntensity: 0.45, opacity: 0.26 },
    { color: TIER_CONTOUR.base, opacity: 0.45 })
  paintPart(runtime.meshes['base-intermediate'],
    { color: '#1c0a3a', emissive: '#5b2ad9', emissiveIntensity: 0.4, opacity: 0.22 },
    { color: TIER_CONTOUR.base, opacity: 0.4 })
  // Deck and rims stay violet end to end; the bottom rim only keeps more weight for depth.
  paintPart(runtime.meshes['base-deck'],
    { color: '#241047', emissive: '#6a35e0', emissiveIntensity: 0.32, opacity: 0.38 },
    { color: TIER_CONTOUR.base, opacity: 0.5 })
  paintPart(runtime.meshes['base-rim-outer-bottom'],
    { color: '#3a1a78', emissive: '#8a5bff', emissiveIntensity: 0.6, opacity: 0.38 },
    { color: TIER_CONTOUR.base, opacity: 0.75 })
  paintPart(runtime.meshes['base-rim-outer-top'],
    { color: '#2a1058', emissive: '#7b46ff', emissiveIntensity: 0.5, opacity: 0.24 },
    { color: TIER_CONTOUR.base, opacity: 0.35 })
  paintPart(runtime.meshes['base-rim-inner-top'],
    { color: '#1c0a3a', emissive: '#5b2ad9', emissiveIntensity: 0.4, opacity: 0.24 },
    { color: SHELL_FACE_LINE_COLOR, opacity: 0.8 })
  const sectorTones = [
    { color: '#2f1666', emissive: '#7b46ff', emissiveIntensity: 0.45, opacity: 0.5 },
    { color: '#140626', emissive: '#3a1a7a', emissiveIntensity: 0.2, opacity: 0.78 },
    { color: '#1a0733', emissive: '#4a2496', emissiveIntensity: 0.22, opacity: 0.85 },
    { color: '#241047', emissive: '#6a35e0', emissiveIntensity: 0.35, opacity: 0.6 },
  ]
  for (let index = 1; index <= 8; index += 1) {
    const sector = runtime.meshes[`base-sector-0${index}`]
    if (!sector) continue
    const materials = Array.isArray(sector.material) ? sector.material : []
    materials.forEach((material, slot) => {
      const tone = sectorTones[slot]
      if (!tone || !(material instanceof THREE.MeshStandardMaterial)) return
      material.color.set(tone.color)
      material.emissive.set(tone.emissive)
      material.emissiveIntensity = tone.emissiveIntensity
      material.opacity = tone.opacity
    })
    sector.traverse(child => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return
      const material = child.material
      if (material instanceof THREE.MeshBasicMaterial) material.color.set(TIER_CONTOUR.base)
      else if (material instanceof THREE.LineBasicMaterial) {
        material.color.set(TIER_CONTOUR.base)
        material.opacity = 0.5
      }
    })
  }
}

// Build order is load-bearing: each step reads state the previous one left in runtime.meshes /
// runtime.nodes. The Phase 0 fingerprint fails if any of these is reordered.
//   I1 applyHolographicMaterials runs before the tower architecture — it rewrites the material each mesh
//      already carries, so it must not run after towers swap in their shared tone.glass.
//   I2 conformOriginalTowers runs before registerDetach — radialOffset reads node.position when it registers.
//   I3 createOuterTowers runs before the architecture, registerDetach, the selection contours and
//      pickableMeshes — all four read runtime.meshes / runtime.nodes.
//   I4 buildTowerArchitecture runs before the selection-contour loop — that step replaces mesh.geometry and
//      EdgesGeometry reads the geometry at construction.
//   I5 Risers are created after createOuterTowers — they are parented to runtime.nodes[id].
//   I6 Every tower child exists before the model.traverse that assigns raycast = () => {}. That sweep is the
//      safety net: anything outside pickableMeshes stops answering the pointer. By design; keep it.
//   I7 The first resetMotion runs after every subsystem is built — it touches risers, spool, constellation
//      and inbound streams.
export function createHolographicCoreProductModel(): HolographicCoreProductModel {
  const model = createHolographicOrbitalDataCoreV2Model({
    castShadow: false,
    receiveShadow: false,
    qualityPriority: 'reference-fidelity',
  })
  const runtime = model.userData.sculptRuntime as ProceduralModelRuntime
  createIntermediateBase(runtime)
  applyHolographicMaterials(runtime)
  conformToReference(runtime)
  applyBaseDepth(runtime)
  applyFaceShading(runtime)
  applyTierContrast(runtime)
  const spool = CORE_VISUAL_REVISION === 'v4-spool' ? createSpoolCore() : null
  if (spool) {
    // Keep the old meshes (and their nodes) for detach/pick offsets, but never draw them.
    for (const id of ['core-upper', 'core-lower', 'core-cap', 'core-mid-collar', 'core-lower-collar', 'core-foot', 'orbit-violet']) {
      const mesh = runtime.meshes[id]
      if (mesh) mesh.visible = false
    }
  }
  // The constellation lives in world space (core root is at the origin) so issue lanes can
  // reach the orange Detection cube. It is hidden while the model is exploded.
  const constellation = CORE_VISUAL_REVISION !== 'v2-tier' && ISSUE_CONSTELLATION.enabled
    ? createIssueConstellation({ nucleusBands: CORE_VISUAL_REVISION !== 'v4-spool' })
    : null
  if (constellation) model.add(constellation.root)

  // Reference shows the collar and orbit as thin white-hot ring lights on top of their bands.
  const ringLight = (radius: number, tube: number, color: string, y: number, opacity: number) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 6, 128),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    mesh.rotation.x = Math.PI / 2
    mesh.position.y = y
    mesh.renderOrder = 7
    model.add(mesh)
    return mesh
  }
  const collarLight = ringLight(1.35, 0.014, '#84e4ff', 1.44, 0.18)
  collarLight.name = 'collar-ring-light'
  const pedestalLight = ringLight(1, 0.012, '#84e4ff', 0.955, 0.22)
  pedestalLight.name = 'pedestal-ring-light'
  const orbitLight = ringLight(2.53, 0.034, '#ff3ce0', 0.48, 0.5)
  orbitLight.name = 'orbit-violet-core-light'
  const orbitHalo = ringLight(2.53, 0.09, '#7a1fd0', 0.47, 0.18)
  orbitHalo.name = 'orbit-violet-halo'
  const pedestalOrbit = ringLight(1.42, 0.02, '#ff55e8', 1, 0.2)
  pedestalOrbit.name = 'pedestal-violet-light'
  const capRimLight = ringLight(0.915, 0.01, '#aeeeff', 2.865, 0.1)
  capRimLight.name = 'cap-rim-light'
  const lowerCollarLight = ringLight(1.02, 0.01, '#79dcff', 0.44, 0.2)
  lowerCollarLight.name = 'lower-collar-ring-light'
  const deckOuterLight = ringLight(3.06, 0.014, '#b18cff', 0.46, 0.2)
  deckOuterLight.name = 'deck-outer-rim-light'
  const deckInnerLight = ringLight(2.95, 0.012, '#8a5bff', 0.462, 0.1)
  deckInnerLight.name = 'deck-inner-rim-light'
  const baseRimHalo = ringLight(3.108, 0.016, '#b18cff', 0, 0.22)
  baseRimHalo.name = 'base-rim-bottom-halo'
  if (spool) {
    // v3 rim/pedestal halos sit at the old drum heights, and the violet orbit would crowd
    // the four cyan spool orbits, so the spool carries its own edges and rings.
    for (const halo of [capRimLight, collarLight, pedestalLight, pedestalOrbit, lowerCollarLight, orbitLight, orbitHalo]) {
      halo.visible = false
    }
  }

  // Reference-derived technical layers: they are visual structure, not dataset records.
  addPlanarGrid(runtime.nodes['base-deck'] ?? model, [1.1, 1.55, 2.05], 16, 0.016, 0.12, '#a37bff')
  addPlanarGrid(runtime.nodes['base-intermediate'] ?? model, [2.18, 2.4, 2.66], 16, 0.106, 0.24, '#a37bff')
  if (!spool) {
    addPlanarGrid(runtime.nodes['core-cap'] ?? model, [0.22, 0.46, 0.69, 0.9], 12, 0.012, 0.22)
    // The older core reference keeps only soft seam lines on the drum, so the cylinder grids stay faint.
    addCylinderGrid(runtime.meshes['core-upper'] ?? model, 0.906, 1.2, 6, 12, 0.1)
    addCylinderGrid(runtime.meshes['core-lower'] ?? model, 0.906, 0.95, 5, 12, 0.09)
    addCylinderGrid(runtime.meshes['core-foot'] ?? model, 0.966, 0.25, 2, 12, 0.07)
    addCapSolarRays(runtime.meshes['core-cap'] ?? model)
  }
  addBaseWallGrid(model, 3.108, 0.03, 0.44, '#8a5bff')
  addDeckRecess(model)
  const capHotspot = addHotspot(runtime.meshes['core-cap'] ?? model, new THREE.Vector3(0, 0.036, 0), 0.052, 0.42)
  const inboundStreams = createInboundStreams(runtime.nodes['core-cap'] ?? model)
  const collarHotspot = addHotspot(runtime.meshes['core-mid-collar'] ?? model, new THREE.Vector3(0, 0.12, 0), 0.024, 0.22)
  const footHotspot = addHotspot(runtime.meshes['core-foot'] ?? model, new THREE.Vector3(0, 0.13, 0), 0.042, 0.3)
  const axialSpines = [[2.08, 1.6], [0.825, 0.86], [0.24, 0.2]].map(([centerY, height]) => {
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, height, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: '#3deeff', transparent: true, opacity: 0.56, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    )
    spine.position.y = centerY
    spine.name = 'axial-light-spine'
    spine.renderOrder = 7
    model.add(spine)
    return spine
  })
  if (spool) axialSpines.forEach(spine => { spine.visible = false })
  // Reference keeps a single white-hot beam running from the deck, through the core, into the sky.
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#a8ecff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.5, 8, 1, true), beamMaterial)
  beam.position.y = 1.9
  beam.name = 'core-vertical-beam'
  beam.renderOrder = 8
  model.add(beam)
  if (spool) beam.visible = false
  const luminousNodes = [
    addScatteredNodes(runtime.meshes['core-upper'] ?? model, [0.56, 0.32, 0.7, -0.7, 0.18, 0.56, 0.8, -0.16, 0.38, -0.44, -0.3, 0.78], 0.015),
    addScatteredNodes(runtime.meshes['core-upper'] ?? model, [0.04, 0.06, 0.91, -0.84, 0.24, 0.25], 0.023),
    addScatteredNodes(runtime.meshes['core-lower'] ?? model, [0.66, 0.28, 0.61, -0.74, 0.06, 0.49, 0.34, -0.25, 0.84, -0.31, -0.34, 0.84], 0.014),
    addScatteredNodes(runtime.meshes['base-deck'] ?? model, [1.58, 0.026, 1.18, -1.35, 0.026, 1.48, 2.3, 0.026, -1.42, -2.42, 0.026, -0.7, 0.44, 0.026, -2.18, -0.65, 0.026, 2.42], 0.018),
    addScatteredNodes(runtime.meshes['base-intermediate'] ?? model, [2.44, 0.108, 0.45, -2.31, 0.108, -0.72, 0.42, 0.108, -2.5], 0.014),
  ]
  // Towers: build order, placement, the shared materials and the riser animation all live in
  // tower-ring.ts, at exactly this position in the pipeline (see the invariants above).
  const towerRing = createTowerRing(runtime, model)

  const runner = new THREE.Group()
  runner.name = 'orbit-violet-runner'
  runner.position.y = 0.769
  const runnerMaterial = new THREE.MeshBasicMaterial({ color: '#ff7ae8', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const runnerArc = new THREE.Mesh(
    new THREE.TorusGeometry(2.53, 0.026, 6, 36, Math.PI * 0.2),
    runnerMaterial,
  )
  runnerArc.rotation.x = Math.PI / 2
  runnerArc.renderOrder = 7
  runner.add(runnerArc)
  model.add(runner)
  if (spool) runner.visible = false

  // Ring lights and the runner belong to the parts they decorate, so they must ride
  // along when the model explodes instead of hovering at ground level.
  model.updateMatrixWorld(true)
  const attachToNode = (object: THREE.Object3D, id: string) => {
    const target = runtime.nodes[id]
    if (target) target.attach(object)
  }
  attachToNode(capRimLight, 'core-cap')
  attachToNode(collarLight, 'core-mid-collar')
  attachToNode(lowerCollarLight, 'core-lower-collar')
  attachToNode(pedestalLight, 'core-lower')
  attachToNode(pedestalOrbit, 'core-lower')
  attachToNode(orbitLight, 'orbit-violet')
  attachToNode(orbitHalo, 'orbit-violet')
  attachToNode(runner, 'orbit-violet')
  attachToNode(baseRimHalo, 'base-rim-outer-bottom')
  if (spool) {
    // Each spool layer rides the node of the old part it replaces, so detach offsets still work.
    // The top drum stays on core-upper (static) because the old cap node keeps its spin.
    attachToNode(spool.parts.top, 'core-upper')
    attachToNode(spool.parts.chamber, 'core-upper')
    attachToNode(spool.parts.base, 'core-lower')
    attachToNode(spool.parts.platform, 'base-deck')
    model.add(spool.parts.fx)
  }

  const DETACH_DURATION = 0.65
  const detachEntries: Array<{ node: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 }> = []
  const registerDetach = (id: string, offset: THREE.Vector3) => {
    const node = runtime.nodes[id]
    if (!node) return
    detachEntries.push({ node, base: node.position.clone(), offset })
  }
  const radialOffset = (id: string, distance: number, lift: number) => {
    const node = runtime.nodes[id]
    const offset = new THREE.Vector3(node?.position.x ?? 0, 0, node?.position.z ?? 0)
    if (offset.lengthSq() > 0) offset.normalize()
    offset.multiplyScalar(distance)
    offset.y = lift
    return offset
  }
  for (const id of TOWER_IDS) {
    // The outer ring starts farther out, so it travels less to stay inside the frame.
    registerDetach(id, radialOffset(id, OUTER_TOWER_IDS.has(id) ? DETACH_DISTANCE.outer : DETACH_DISTANCE.original, DETACH_DISTANCE.lift))
  }
  for (let index = 1; index <= 8; index += 1) registerDetach(`base-sector-0${index}`, radialOffset(`base-sector-0${index}`, 0.5, 0))
  registerDetach('core-upper', new THREE.Vector3(0, 0.42, 0))
  registerDetach('core-cap', new THREE.Vector3(0, 0.2, 0))
  registerDetach('core-mid-collar', new THREE.Vector3(0, 0.26, 0))
  registerDetach('core-lower', new THREE.Vector3(0, 0.12, 0))
  registerDetach('core-lower-collar', new THREE.Vector3(0, -0.06, 0))
  registerDetach('core-foot', new THREE.Vector3(0, -0.1, 0))
  registerDetach('orbit-violet', new THREE.Vector3(0, 0.16, 0))
  registerDetach('base-deck', new THREE.Vector3(0, 0.15, 0))
  registerDetach('base-rim-outer-top', new THREE.Vector3(0, 0.1, 0))
  registerDetach('base-rim-outer-bottom', new THREE.Vector3(0, -0.1, 0))
  registerDetach('base-rim-inner-top', new THREE.Vector3(0, 0.05, 0))
  registerDetach('base-intermediate', new THREE.Vector3(0, 0.03, 0))

  let detachTarget = 0
  let detachProgress = 0
  const applyDetach = () => {
    const eased = detachProgress < 0.5
      ? 4 * detachProgress * detachProgress * detachProgress
      : 1 - Math.pow(-2 * detachProgress + 2, 3) / 2
    for (const entry of detachEntries) entry.node.position.copy(entry.base).addScaledVector(entry.offset, eased)
    // The spool layers share two pivots, so they get their own ladder of heights on top of those offsets.
    spool?.setExplode(eased)
  }
  const snapDetach = () => {
    detachProgress = detachTarget
    applyDetach()
  }
  const advanceDetach = (deltaSeconds: number) => {
    const next = THREE.MathUtils.clamp(detachProgress + (detachTarget ? 1 : -1) * deltaSeconds / DETACH_DURATION, 0, 1)
    if (next === detachProgress) return
    detachProgress = next
    applyDetach()
  }

  const selectionContours = new Map<string, THREE.LineSegments>()
  for (const [id, mesh] of Object.entries(runtime.meshes)) {
    if (NON_SELECTABLE_PART_IDS.has(id)) continue
    const contour = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 24),
      // Normal blending keeps the amber outline readable on top of additive cyan; additive would wash to white.
      new THREE.LineBasicMaterial({ color: '#ffa41c', transparent: true, opacity: 1, depthWrite: false, depthTest: false, toneMapped: false }),
    )
    contour.name = 'selection-contour'
    contour.scale.setScalar(1.002)
    contour.renderOrder = 9
    contour.visible = false
    contour.raycast = () => {}
    mesh.add(contour)
    selectionContours.set(id, contour)
  }
  if (spool) {
    for (const [id, mesh] of spool.selectableMeshes) {
      const contour = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 24),
        new THREE.LineBasicMaterial({ color: '#ffa41c', transparent: true, opacity: 1, depthWrite: false, depthTest: false, toneMapped: false }),
      )
      contour.name = 'selection-contour'
      contour.scale.setScalar(1.002)
      contour.renderOrder = 9
      contour.visible = false
      contour.raycast = () => {}
      mesh.add(contour)
      selectionContours.set(id, contour)
    }
  }
  let selectedId: string | null = null
  const setSelected = (componentId: string | null) => {
    selectedId = componentId
    selectionContours.forEach((contour, id) => {
      contour.visible = id === selectedId
      ;(contour.material as THREE.LineBasicMaterial).opacity = 1
    })
  }
  const resolvePart = (object: THREE.Object3D): HolographicPartInfo | null => {
    let current: THREE.Object3D | null = object
    while (current) {
      const component = current.userData.sculptComponent as HolographicPartComponent | undefined
      if (component?.id) {
        if (NON_SELECTABLE_PART_IDS.has(component.id)) return null
        return {
          id: component.id,
          name: component.name ?? component.id,
          role: component.role ?? 'component',
          material: component.material ?? 'unknown',
          level: component.level ?? 'unknown',
          dimensions: {
            width: component.dimensions?.width ?? 0,
            height: component.dimensions?.height ?? 0,
            depth: component.dimensions?.depth ?? 0,
            units: component.dimensions?.units ?? 'relative',
          },
        }
      }
      current = current.parent
    }
    return null
  }

  // Only component meshes answer the pointer; decoration, lights and contours stay transparent to it.
  const pickableMeshes = new Set<THREE.Object3D>(Object.values(runtime.meshes))
  if (spool) spool.selectableMeshes.forEach(mesh => pickableMeshes.add(mesh))
  model.traverse(object => {
    if (!pickableMeshes.has(object)) object.raycast = () => {}
  })

  const motionNodes = {
    orbit: runtime.nodes['orbit-violet'],
    collar: runtime.nodes['core-mid-collar'],
    deck: runtime.nodes['base-deck'],
    cap: runtime.nodes['core-cap'],
  }
  const resetMotion = () => {
    Object.values(motionNodes).forEach(node => { if (node) node.rotation.y = 0 })
    runner.rotation.y = 0
    runnerMaterial.opacity = 0.8
    capHotspot.scale.setScalar(1)
    collarHotspot.scale.setScalar(1)
    footHotspot.scale.setScalar(1)
    axialSpines.forEach(spine => { (spine.material as THREE.MeshBasicMaterial).opacity = 0.56 })
    luminousNodes.forEach(nodes => { (nodes.material as THREE.MeshBasicMaterial).opacity = 0.72 })
    beamMaterial.opacity = 0.45
    selectionContours.forEach(contour => { (contour.material as THREE.LineBasicMaterial).opacity = 0.95 })
    towerRing.reset()
    inboundStreams.reset()
    constellation?.reset()
    spool?.reset()
  }
  resetMotion()

  return {
    model,
    update(elapsedSeconds, deltaSeconds) {
      advanceDetach(deltaSeconds)
      if (motionNodes.orbit) motionNodes.orbit.rotation.y = elapsedSeconds * Math.PI * 2 / 21
      if (motionNodes.collar) motionNodes.collar.rotation.y = -elapsedSeconds * Math.PI * 2 / 15
      if (motionNodes.deck) motionNodes.deck.rotation.y = elapsedSeconds * Math.PI * 2 / 32
      if (motionNodes.cap) motionNodes.cap.rotation.y = -elapsedSeconds * Math.PI * 2 / 24
      inboundStreams.update(elapsedSeconds)
      constellation?.update(elapsedSeconds, deltaSeconds)
      spool?.update(elapsedSeconds, deltaSeconds)
      runner.rotation.y = elapsedSeconds * Math.PI * 2 / 6
      runnerMaterial.opacity = 0.66 + Math.sin(elapsedSeconds * Math.PI * 2 / 2.4) * 0.14
      const capPulse = 0.9 + Math.sin(elapsedSeconds * Math.PI * 2 / 3.2) * 0.1
      capHotspot.scale.setScalar(0.96 + capPulse * 0.08)
      ;(capHotspot.material as THREE.MeshBasicMaterial).opacity = 0.42 * capPulse
      collarHotspot.scale.setScalar(0.98 + (0.96 + Math.sin(elapsedSeconds * 1.1 + 1) * 0.04) * 0.035)
      ;(collarHotspot.material as THREE.MeshBasicMaterial).opacity = 0.24 + Math.sin(elapsedSeconds * 1.1 + 1) * 0.03
      footHotspot.scale.setScalar(0.98 + (0.96 + Math.sin(elapsedSeconds * 1.1 + 2) * 0.04) * 0.035)
      ;(footHotspot.material as THREE.MeshBasicMaterial).opacity = 0.29 + Math.sin(elapsedSeconds * 1.1 + 2) * 0.02
      axialSpines.forEach(spine => { (spine.material as THREE.MeshBasicMaterial).opacity = 0.48 + Math.sin(elapsedSeconds * 1.1) * 0.06 })
      luminousNodes.forEach((nodes, index) => { (nodes.material as THREE.MeshBasicMaterial).opacity = 0.52 + (Math.sin(elapsedSeconds * 1.4 + index * 0.9) + 1) * 0.08 })
      towerRing.update(elapsedSeconds)
      beamMaterial.opacity = 0.42 + Math.sin(elapsedSeconds * 0.9) * 0.06
      selectionContours.forEach(contour => {
        if (contour.visible) (contour.material as THREE.LineBasicMaterial).opacity = 0.8 + Math.sin(elapsedSeconds * 4) * 0.2
      })
    },
    resetMotion,
    setDetached(detached) {
      detachTarget = detached ? 1 : 0
      constellation?.setDetached(detached)
      spool?.setDetached(detached)
    },
    snapDetach,
    setSelected,
    resolvePart,
    dispose() {
      if (constellation) {
        model.remove(constellation.root)
        constellation.dispose()
      }
      spool?.dispose()
      model.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(material => material.dispose())
        }
      })
    },
  }
}
