import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createHolographicCoreProductModel } from '../../graphics/holographic-core/holographic-core.model'
import { createInboundPaths, type InboundPath } from '../../graphics/holographic-core/inbound-stream-paths'

type StreamRuntime = { nodes: Record<string, THREE.Object3D> }

const STREAKS_PER_LANE = 6
const TUBES_PER_STREAK = 3
const STATIONS = 12
const RINGS = STATIONS + 1
const RADIAL = 6
const VERTICES_PER_LANE = STREAKS_PER_LANE * TUBES_PER_STREAK * RINGS * RADIAL
const LANE_ID = 'azimuth-0@-1'

const projectionStart = new THREE.Vector3()
const projectionEnd = new THREE.Vector3()

function createFixture() {
  const productModel = createHolographicCoreProductModel()
  const runtime = productModel.model.userData.sculptRuntime as StreamRuntime
  const root = productModel.model.getObjectByName('inbound-data-streams')
  if (!root) throw new Error('inbound-data-streams root was not built')
  return { productModel, runtime, root }
}

function meshesNamed(root: THREE.Object3D, name: string) {
  const meshes: THREE.Mesh[] = []
  root.traverse(object => {
    if (object instanceof THREE.Mesh && object.name === name) meshes.push(object)
  })
  return meshes
}

function laneMeshes(root: THREE.Object3D) {
  return meshesNamed(root, 'inbound-stream-streaks')
}

function pathMap() {
  const map = new Map<string, InboundPath>()
  for (const path of createInboundPaths()) map.set(path.id, path)
  return map
}

function lanePath(mesh: THREE.Mesh, paths: Map<string, InboundPath>) {
  const path = paths.get(mesh.userData.pathId as string)
  if (!path) throw new Error(`missing path for ${String(mesh.userData.pathId)}`)
  return path
}

function positionArray(mesh: THREE.Mesh) {
  return mesh.geometry.getAttribute('position').array as Float32Array
}

function colorArray(mesh: THREE.Mesh) {
  return mesh.geometry.getAttribute('color').array as Float32Array
}

// Tube 0 is the main filament; its centroid sits exactly on the sampled path.
function stationCentroid(mesh: THREE.Mesh, streak: number, station: number, target: THREE.Vector3) {
  const positions = positionArray(mesh)
  const base = (streak * TUBES_PER_STREAK * RINGS + station) * RADIAL
  target.set(0, 0, 0)
  for (let ring = 0; ring < RADIAL; ring++) {
    const offset = (base + ring) * 3
    target.x += positions[offset]
    target.y += positions[offset + 1]
    target.z += positions[offset + 2]
  }
  return target.multiplyScalar(1 / RADIAL)
}

function projectOntoPath(path: InboundPath, point: THREE.Vector3) {
  let bestDistanceSquared = Infinity
  let bestS = 0
  const count = path.points.length / 3
  const step = path.length / (count - 1)
  for (let index = 0; index < count - 1; index++) {
    projectionStart.fromArray(path.points, index * 3)
    projectionEnd.fromArray(path.points, (index + 1) * 3)
    const segmentX = projectionEnd.x - projectionStart.x
    const segmentY = projectionEnd.y - projectionStart.y
    const segmentZ = projectionEnd.z - projectionStart.z
    const lengthSquared = segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ
    const raw = lengthSquared > 0
      ? ((point.x - projectionStart.x) * segmentX
        + (point.y - projectionStart.y) * segmentY
        + (point.z - projectionStart.z) * segmentZ) / lengthSquared
      : 0
    const fraction = Math.min(1, Math.max(0, raw))
    const deltaX = point.x - (projectionStart.x + segmentX * fraction)
    const deltaY = point.y - (projectionStart.y + segmentY * fraction)
    const deltaZ = point.z - (projectionStart.z + segmentZ * fraction)
    const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared
      bestS = (index + fraction) * step
    }
  }
  return { s: bestS, distance: Math.sqrt(bestDistanceSquared) }
}

function streakSpan(mesh: THREE.Mesh, streak: number) {
  const previous = new THREE.Vector3()
  const current = new THREE.Vector3()
  let span = 0
  stationCentroid(mesh, streak, 0, previous)
  for (let station = 1; station <= STATIONS; station++) {
    stationCentroid(mesh, streak, station, current)
    span += previous.distanceTo(current)
    previous.copy(current)
  }
  return span
}

function streakColorTotal(mesh: THREE.Mesh, streak: number) {
  const colors = colorArray(mesh)
  let total = 0
  const start = streak * TUBES_PER_STREAK * RINGS * RADIAL * 3
  const end = start + RINGS * RADIAL * 3
  for (let index = start; index < end; index++) total += colors[index]
  return total
}

function stationLuma(mesh: THREE.Mesh, streak: number, station: number) {
  const colors = colorArray(mesh)
  const offset = (streak * TUBES_PER_STREAK * RINGS + station) * RADIAL * 3
  return 0.2126 * colors[offset] + 0.7152 * colors[offset + 1] + 0.0722 * colors[offset + 2]
}

function stationColor(mesh: THREE.Mesh, streak: number, station: number) {
  const colors = colorArray(mesh)
  const offset = (streak * TUBES_PER_STREAK * RINGS + station) * RADIAL * 3
  return `${colors[offset].toFixed(2)},${colors[offset + 1].toFixed(2)},${colors[offset + 2].toFixed(2)}`
}

function snapshotPositions(root: THREE.Object3D) {
  return laneMeshes(root).map(mesh => Array.from(positionArray(mesh)))
}

// Building the procedural model takes seconds under a loaded jsdom worker, so give each case room.
describe('inbound data streaks', { timeout: 20_000 }, () => {
  it('T1: hangs four faint guides and twenty-four streak meshes on the cap pivot', () => {
    const { runtime, root } = createFixture()
    const guides = meshesNamed(root, 'inbound-stream-guide')
    const streaks = laneMeshes(root)

    expect(root.parent).toBe(runtime.nodes['core-cap'])
    expect(root.position.toArray()).toEqual([0, 0.05, 0])
    expect(guides).toHaveLength(4)
    expect(streaks).toHaveLength(24)

    const guideMaterial = guides[0].material as THREE.MeshBasicMaterial
    for (const guide of guides) {
      expect(guide.material).toBe(guideMaterial)
      expect(guide.renderOrder).toBe(5)
      expect(guide.userData.pathId).toBeTruthy()
    }
    expect(new Set(guides.map(guide => guide.userData.pathId))).toEqual(
      new Set(['azimuth-0', 'azimuth-90', 'azimuth-180', 'azimuth-270']),
    )
    expect(guideMaterial.opacity).toBeLessThanOrEqual(0.15)
    expect(guideMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(guideMaterial.depthWrite).toBe(false)

    const streakMaterial = streaks[0].material as THREE.MeshBasicMaterial
    for (const streak of streaks) {
      expect(streak.material).toBe(streakMaterial)
      expect(streak.renderOrder).toBe(7)
      expect(streak.userData.pathId).toBeTruthy()
      expect((streak.geometry.getAttribute('position') as THREE.BufferAttribute).count).toBe(VERTICES_PER_LANE)
    }
    expect(streakMaterial.vertexColors).toBe(true)
    expect(streakMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(streakMaterial.depthWrite).toBe(false)
    expect(streakMaterial.opacity).toBeLessThanOrEqual(0.4)

    const ids = new Set(streaks.map(streak => String(streak.userData.pathId)))
    expect(ids).toEqual(new Set(createInboundPaths().map(path => path.id)))
  })

  it('T2: bends every streak along its own path', () => {
    const { root } = createFixture()
    const paths = pathMap()
    const centroid = new THREE.Vector3()

    for (const mesh of laneMeshes(root)) {
      const path = lanePath(mesh, paths)
      for (let streak = 0; streak < STREAKS_PER_LANE; streak++) {
        for (let station = 0; station <= STATIONS; station++) {
          stationCentroid(mesh, streak, station, centroid)
          expect(projectOntoPath(path, centroid).distance).toBeLessThanOrEqual(5e-3)
        }
      }
    }
  })

  it('T3: keeps streaks short with clear gaps between them', () => {
    const { productModel, root } = createFixture()
    const paths = pathMap()

    for (const mesh of laneMeshes(root)) {
      const path = lanePath(mesh, paths)
      productModel.update(path.definition.cycleSeconds * 0.5, 0.016)

      const head = new THREE.Vector3()
      const tail = new THREE.Vector3()
      const anchors = Array.from({ length: STREAKS_PER_LANE }, (_, streak) => {
        stationCentroid(mesh, streak, STATIONS, head)
        stationCentroid(mesh, streak, 0, tail)
        return {
          headS: projectOntoPath(path, head).s,
          tailS: projectOntoPath(path, tail).s,
          span: streakSpan(mesh, streak),
        }
      }).sort((a, b) => a.headS - b.headS)

      for (const anchor of anchors) {
        expect(anchor.span).toBeLessThan(0.11 * path.length)
      }
      // One streak per lane is always in the absorb window at any instant; the cruising rest must
      // still read as short dashes.
      const cruising = anchors.filter(anchor => {
        const fraction = anchor.headS / path.length
        return fraction > 0.1 && fraction < 0.84
      })
      expect(cruising.length).toBeGreaterThanOrEqual(4)
      for (const anchor of cruising) {
        expect(anchor.span).toBeGreaterThan(0.06 * path.length)
      }

      for (let index = 1; index < anchors.length; index++) {
        expect(anchors[index].tailS - anchors[index - 1].headS).toBeGreaterThan(0.02 * path.length)
      }
      const wrapGap = path.length - anchors[anchors.length - 1].headS + anchors[0].tailS
      expect(wrapGap).toBeGreaterThan(0.02 * path.length)
    }
  })

  it('T4: keeps a bright tinted head above a long dim tail', () => {
    const { productModel, root } = createFixture()
    const paths = pathMap()
    const headLumas: number[] = []
    const headColors = new Set<string>()
    const head = new THREE.Vector3()

    for (const mesh of laneMeshes(root)) {
      const path = lanePath(mesh, paths)
      productModel.update(path.definition.cycleSeconds * 0.5, 0.016)
      let cruising = 0
      for (let streak = 0; streak < STREAKS_PER_LANE; streak++) {
        stationCentroid(mesh, streak, STATIONS, head)
        const fraction = projectOntoPath(path, head).s / path.length
        if (fraction <= 0.1 || fraction >= 0.84) continue
        cruising += 1
        const headLuma = stationLuma(mesh, streak, STATIONS)
        expect(headLuma).toBeGreaterThan(0.9)
        expect(headLuma).toBeLessThan(1.5)
        expect(stationLuma(mesh, streak, 0)).toBeLessThan(0.15)
        headLumas.push(headLuma)
        headColors.add(stationColor(mesh, streak, STATIONS))
      }
      expect(cruising).toBeGreaterThanOrEqual(4)
    }

    expect(Math.min(...headLumas)).toBeLessThan(Math.max(...headLumas))
    // Six grain classes carry six hues; the deterministic hash should surface most of them.
    expect(headColors.size).toBeGreaterThanOrEqual(5)
  })

  it('T5: shortens and dims the streak while the core absorbs it', () => {
    const { productModel, root } = createFixture()
    const paths = pathMap()
    const outer = laneMeshes(root).find(mesh => mesh.userData.pathId === LANE_ID)
    if (!outer) throw new Error(`${LANE_ID} lane was not built`)
    const cycle = lanePath(outer, paths).definition.cycleSeconds

    productModel.update(cycle * 0.5, 0.016)
    const cruiseSpan = streakSpan(outer, 0)
    const cruiseColor = streakColorTotal(outer, 0)

    productModel.update(cycle * 0.94, 0.016)
    const absorbedSpan = streakSpan(outer, 0)
    const absorbedColor = streakColorTotal(outer, 0)

    expect(absorbedSpan).toBeLessThan(cruiseSpan)
    expect(absorbedColor).toBeLessThan(cruiseColor)
  })

  it('T6: depends on elapsed time only, not on delta time', () => {
    const { productModel, root } = createFixture()

    productModel.update(5, 0.016)
    const atSmallDelta = snapshotPositions(root)
    productModel.update(5, 0.2)
    expect(snapshotPositions(root)).toEqual(atSmallDelta)

    productModel.update(5.5, 0.016)
    expect(snapshotPositions(root)).not.toEqual(atSmallDelta)
  })

  it('T7: moves the head forward only, wrapping back to the outer end', () => {
    const { productModel, root } = createFixture()
    const paths = pathMap()
    const outer = laneMeshes(root).find(mesh => mesh.userData.pathId === LANE_ID)
    if (!outer) throw new Error(`${LANE_ID} lane was not built`)
    const path = lanePath(outer, paths)
    const head = new THREE.Vector3()

    const headFraction = (elapsed: number) => {
      productModel.update(elapsed, 0.016)
      stationCentroid(outer, 0, STATIONS, head)
      return projectOntoPath(path, head).s / path.length
    }

    const cycle = path.definition.cycleSeconds
    let previous = -1
    for (let step = 1; step <= 8; step++) {
      const fraction = headFraction(cycle * step * 0.1)
      expect(fraction).toBeGreaterThan(previous)
      previous = fraction
    }

    const samples = Array.from(
      { length: 16 },
      (_, step) => headFraction(cycle * 0.85 + step * cycle * 0.02),
    )
    let wraps = 0
    for (let index = 1; index < samples.length; index++) {
      if (samples[index] < samples[index - 1] - 0.5) {
        wraps += 1
        expect(samples[index - 1]).toBeGreaterThan(0.9)
        expect(samples[index]).toBeLessThan(0.1)
      } else {
        expect(samples[index]).toBeGreaterThan(samples[index - 1])
      }
    }
    expect(wraps).toBe(1)
  })

  it('T8: freezes on a static pose for reduced motion and resumes afterwards', () => {
    const { productModel, root } = createFixture()
    const atBuild = snapshotPositions(root)

    productModel.update(2.3, 0.016)
    expect(snapshotPositions(root)).not.toEqual(atBuild)

    productModel.resetMotion()
    expect(snapshotPositions(root)).toEqual(atBuild)
    expect(root.rotation.y).toBe(0)

    productModel.resetMotion()
    expect(snapshotPositions(root)).toEqual(atBuild)

    productModel.update(2.3, 0.016)
    expect(snapshotPositions(root)).not.toEqual(atBuild)
  })

  it('T9: cancels the cap spin and rides the cap during the explode', () => {
    const { productModel, runtime, root } = createFixture()
    const cap = runtime.nodes['core-cap']

    productModel.update(3.7, 0.016)
    expect(cap.rotation.y).not.toBe(0)
    expect(root.rotation.y).toBeCloseTo(-cap.rotation.y, 10)

    productModel.model.updateMatrixWorld(true)
    const worldRotation = new THREE.Quaternion()
    root.getWorldQuaternion(worldRotation)
    expect(worldRotation.x).toBeCloseTo(0, 6)
    expect(worldRotation.y).toBeCloseTo(0, 6)
    expect(worldRotation.z).toBeCloseTo(0, 6)
    expect(worldRotation.w).toBeCloseTo(1, 6)

    productModel.setDetached(true)
    productModel.snapDetach()
    productModel.model.updateMatrixWorld(true)
    const capWorld = cap.getWorldPosition(new THREE.Vector3())
    const streamsWorld = root.getWorldPosition(new THREE.Vector3())
    expect(streamsWorld.y - capWorld.y).toBeCloseTo(0.05, 6)
  })

  it('T10: stays transparent to pointer picking', () => {
    const { root } = createFixture()
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 6, 0), new THREE.Vector3(0, -1, 0))
    const meshes: THREE.Mesh[] = []
    root.traverse(object => {
      if (object instanceof THREE.Mesh) meshes.push(object)
    })

    expect(meshes).toHaveLength(28)
    for (const mesh of meshes) {
      expect(raycaster.intersectObject(mesh)).toHaveLength(0)
    }
  })
})
