import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { createHolographicCoreProductModel } from '../../graphics/holographic-core/holographic-core.model'
import type { ProceduralModelRuntime } from '../../graphics/holographic-core/generated-core'
import { CONTEXT_GAUGES, HERO_GAUGES } from '../../graphics/holographic-core/tower-gauge-config'
import { MOCK_QUALITY_SCORES } from '../../graphics/holographic-core/tower-gauge-data'

it('updates context color buffers without altering windows, then survives reset and detach', () => {
  const api = createHolographicCoreProductModel()
  try {
    const runtime = api.model.userData.sculptRuntime as ProceduralModelRuntime
    const windows = (id: string) => runtime.meshes[id].getObjectByName('tower-window-panel') as THREE.InstancedMesh
    const targets = CONTEXT_GAUGES
    const before = targets.map(target => {
      const mesh = windows(target.towerId)
      return { mesh, colors: mesh.instanceColor!.array.slice(), matrices: mesh.instanceMatrix.array.slice(), material: mesh.material, geometry: mesh.geometry }
    })
    // At zero the entire tower uses the alternating upper-floor pattern.
    for (const score of [0, 1]) {
      api.applyQualityScores(MOCK_QUALITY_SCORES.map(row => ({ ...row, score })))
      const mesh = windows('tower-01-back-high')
      const levels: number[] = mesh.userData.markLevels
      const top = Math.max(...levels)
      for (let index = 0; index < mesh.count; index += 1) {
        const red = score === 0 && (top - levels[index]) % 2 === 1
        const expected = new THREE.Color(red ? '#f43f5e' : '#34d399').multiplyScalar((red ? 4.7 : 1.7) * 0.45)
        const actual = new THREE.Color()
        mesh.getColorAt(index, actual)
        expect(actual.r).toBeCloseTo(expected.r, 6)
        expect(actual.g).toBeCloseTo(expected.g, 6)
        expect(actual.b).toBeCloseTo(expected.b, 6)
      }
    }
    api.applyQualityScores(MOCK_QUALITY_SCORES)
    const buffers = before.flatMap(entry => [entry.mesh.instanceMatrix, entry.mesh.instanceColor!])
    for (const target of HERO_GAUGES) {
      const column = runtime.meshes[target.towerId].getObjectByName('hero-glass-arms') as THREE.InstancedMesh
      buffers.push(column.instanceMatrix, column.instanceColor!)
    }
    const versions = buffers.map(buffer => buffer.version)
    api.update(7.3, 0.016)
    api.resetMotion()
    api.setDetached(true)
    api.snapDetach()
    expect(buffers.map(buffer => buffer.version)).toEqual(versions)
    for (const entry of before) {
      expect(entry.mesh.instanceColor!.array).toEqual(entry.colors)
      expect(entry.mesh.instanceMatrix.array).toEqual(entry.matrices)
      expect(entry.mesh.material).toBe(entry.material)
      expect(entry.mesh.geometry).toBe(entry.geometry)
    }
    expect(new Set(before.map(entry => entry.material)).size).toBe(1)
  } finally {
    api.dispose()
  }
})

it('paints every bay on a floor together, with missing completeness at the top', () => {
  const api = createHolographicCoreProductModel()
  try {
    const runtime = api.model.userData.sculptRuntime as ProceduralModelRuntime
    api.applyQualityScores(MOCK_QUALITY_SCORES.map(row => ({ ...row, score: 0.5 })))
    const mesh = runtime.meshes['tower-01-back-high'].getObjectByName('tower-window-panel') as THREE.InstancedMesh
    const floors = new Map<number, string>()
    for (let index = 0; index < mesh.count; index += 1) {
      const level = mesh.userData.markLevels[index]
      const color = Array.from(mesh.instanceColor!.array.slice(index * 3, index * 3 + 3)).join(',')
      if (floors.has(level)) expect(color).toBe(floors.get(level))
      floors.set(level, color)
    }
    const ordered = [...floors].sort(([a], [b]) => a - b).map(([, color]) => color)
    const on = Math.round(ordered.length / 2)
    expect(new Set(ordered.slice(0, on)).size).toBe(1)
    expect(new Set(ordered.slice(on)).size).toBe(2)
    for (let level = on + 1; level < ordered.length; level++) {
      expect(ordered[level]).not.toBe(ordered[level - 1])
    }
    expect(ordered[0]).not.toBe(ordered.at(-1))
  } finally {
    api.dispose()
  }
})

it('builds full white square cores, four ten-band glass bars, metal corners and matching caps', () => {
  const api = createHolographicCoreProductModel()
  try {
    const runtime = api.model.userData.sculptRuntime as ProceduralModelRuntime
    const glasses: THREE.InstancedMesh[] = []
    api.model.traverse(object => { if (object.name === 'hero-glass-arms') glasses.push(object as THREE.InstancedMesh) })
    expect(glasses).toHaveLength(6)
    expect(new Set(glasses.map(mesh => mesh.geometry)).size).toBe(1)
    expect(new Set(glasses.map(mesh => mesh.material)).size).toBe(1)
    for (const target of HERO_GAUGES) {
      const tower = runtime.meshes[target.towerId]
      const glass = tower.getObjectByName('hero-glass-arms') as THREE.InstancedMesh
      const core = tower.getObjectByName('hero-square-core') as THREE.Mesh
      const corners = tower.getObjectByName('hero-metal-corners') as THREE.InstancedMesh
      const cap = tower.getObjectByName('hero-cap') as THREE.Mesh
      expect(glass.count).toBe(40)
      expect((glass.material as THREE.MeshPhysicalMaterial).transparent).toBe(true)
      expect(corners.count).toBe(4)
      expect(cap.material).toBe(corners.material)
      expect((cap.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('0b1430')
      expect((core.material as THREE.MeshBasicMaterial).color.toArray()).toEqual([0.5, 0.5, 0.5])
      expect((tower.getObjectByName('hero-metal-edge') as THREE.LineSegments).material).toBeInstanceOf(THREE.LineBasicMaterial)
      for (const name of ['tower-corner-post', 'tower-floor-frame', 'tower-window-panel', 'tower-roof-outline', 'technical-linework', 'tower-hero-gauge']) {
        expect(tower.getObjectByName(name)).toBeUndefined()
      }
      const bounds = tower.geometry.boundingBox!
      const length = bounds.max.x * 2 * 2 / 3
      core.geometry.computeBoundingBox()
      const coreSize = core.geometry.boundingBox!.getSize(new THREE.Vector3())
      expect(coreSize.x).toBeCloseTo(length, 6)
      expect(coreSize.z).toBeCloseTo(length, 6)
      const matrix = new THREE.Matrix4()
      const point = new THREE.Vector3()
      const color = new THREE.Color()
      const referenceColor = new THREE.Color()
      const unit = glass.geometry.getAttribute('position')
      const levels = new Set<number>()
      for (let i = 0; i < 40; i += 1) {
        glass.getMatrixAt(i, matrix)
        const size = new THREE.Vector3().setFromMatrixScale(matrix)
        expect(Math.max(size.x, size.z)).toBeCloseTo(length, 6)
        expect(Math.min(size.x, size.z)).toBeCloseTo(length / 4, 6)
        levels.add(matrix.elements[13])
        glass.getColorAt(i, color)
        glass.getColorAt(0, referenceColor)
        expect(color).toEqual(referenceColor)
        for (let vertex = 0; vertex < unit.count; vertex += 1) {
          point.fromBufferAttribute(unit, vertex).applyMatrix4(matrix)
          expect(Math.abs(point.x)).toBeLessThanOrEqual(bounds.max.x + 1e-6)
          expect(Math.abs(point.z)).toBeLessThanOrEqual(bounds.max.z + 1e-6)
          expect(Math.abs(point.x) + Math.abs(point.z)).toBeLessThanOrEqual(length * 1.25 + 1e-6)
        }
      }
      expect(levels.size).toBe(10)
      glass.getMatrixAt(0, matrix)
      const cellHeight = new THREE.Vector3().setFromMatrixScale(matrix).y
      cap.geometry.computeBoundingBox()
      const capBounds = cap.geometry.boundingBox!
      const oldCapHeight = (bounds.max.y * 2 - 0.385) / 11
      expect(capBounds.max.y - capBounds.min.y).toBeCloseTo(oldCapHeight / 2, 6)
      expect(coreSize.y).toBeCloseTo(bounds.max.y * 2 - oldCapHeight, 6)
      const sorted = [...levels].sort((a, b) => a - b)
      expect(sorted[9] + cellHeight / 2).toBeCloseTo(capBounds.min.y, 6)
      expect(sorted[0] - cellHeight / 2 - bounds.min.y).toBeCloseTo(0.016, 6)
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i] - sorted[i - 1] - cellHeight).toBeCloseTo(0.005, 6)
      }
      const positions = cap.geometry.getAttribute('position')
      const top: number[] = []
      const bottom: number[] = []
      for (let i = 0; i < positions.count; i += 1) {
        if (Math.abs(positions.getY(i) - capBounds.max.y) < 1e-6) top.push(Math.abs(positions.getX(i)))
        else bottom.push(Math.abs(positions.getX(i)))
      }
      expect(Math.max(...top) / Math.max(...bottom)).toBeCloseTo(0.75, 6)
    }
    for (const target of CONTEXT_GAUGES) {
      expect(runtime.meshes[target.towerId].getObjectByName('hero-glass-arms')).toBeUndefined()
    }
  } finally { api.dispose() }
})

it('updates the four glass faces together while keeping the full core and matrices fixed', () => {
  const api = createHolographicCoreProductModel()
  try {
    const runtime = api.model.userData.sculptRuntime as ProceduralModelRuntime
    const tower = runtime.meshes['tower-12']
    const glass = tower.getObjectByName('hero-glass-arms') as THREE.InstancedMesh
    const core = tower.getObjectByName('hero-square-core') as THREE.Mesh
    const matrix = glass.instanceMatrix.array.slice()
    const geometry = glass.geometry
    const material = glass.material
    const full = MOCK_QUALITY_SCORES.map(row => ({ ...row, score: 1 }))
    const empty = MOCK_QUALITY_SCORES.map(row => ({ ...row, score: 0 }))
    api.applyQualityScores(full)
    const fullColors = glass.instanceColor!.array.slice()
    api.setSelected('tower-12')
    api.applyQualityScores(empty)
    expect(glass.instanceColor!.array).not.toEqual(fullColors)
    for (let face = 1; face < 4; face += 1) {
      expect(glass.instanceColor!.array.slice(face * 30, (face + 1) * 30)).toEqual(glass.instanceColor!.array.slice(0, 30))
    }
    api.applyQualityScores(empty)
    api.resetMotion()
    expect(glass.instanceMatrix.array).toEqual(matrix)
    expect(tower.getObjectByName('selection-contour')!.visible).toBe(true)
    expect((core.material as THREE.MeshBasicMaterial).color.toArray()).toEqual([0.5, 0.5, 0.5])
    api.applyQualityScores(full)
    expect(glass.instanceColor!.array).toEqual(fullColors)
    expect(glass.geometry).toBe(geometry)
    expect(glass.material).toBe(material)
    const completeness = runtime.meshes['tower-10'].getObjectByName('hero-glass-arms') as THREE.InstancedMesh
    api.applyQualityScores(empty)
    const actual = new THREE.Color()
    completeness.getColorAt(9, actual)
    const poor = new THREE.Color('#f43f5e').multiplyScalar(4.7)
    expect(actual.r).toBeCloseTo(poor.r, 6)
    expect(actual.g).toBeCloseTo(poor.g, 6)
    expect(actual.b).toBeCloseTo(poor.b, 6)
  } finally { api.dispose() }
})

it('rejects invalid updates before changing any visible score', () => {
  const api = createHolographicCoreProductModel()
  try {
    const runtime = api.model.userData.sculptRuntime as ProceduralModelRuntime
    const column = runtime.meshes['tower-10'].getObjectByName('hero-glass-arms') as THREE.InstancedMesh
    const before = column.instanceColor!.array.slice()
    expect(() => api.applyQualityScores(MOCK_QUALITY_SCORES.slice(1))).toThrow('missing score')
    // Removing a tower must not shrink the source's 18-score contract.
    expect(() => api.applyQualityScores(MOCK_QUALITY_SCORES.filter(row =>
      row.scope !== 'sliceA' || row.dimension !== 'completeness',
    ))).toThrow('missing score sliceA/completeness')
    expect(() => api.applyQualityScores([...MOCK_QUALITY_SCORES, MOCK_QUALITY_SCORES[0]])).toThrow('duplicate score')
    for (const score of [NaN, Infinity, -0.1, 1.1]) {
      expect(() => api.applyQualityScores(MOCK_QUALITY_SCORES.map((row, index) => index === 0 ? { ...row, score } : row))).toThrow('finite and inside 0..1')
    }
    api.resetMotion()
    expect(column.instanceColor!.array).toEqual(before)
  } finally { api.dispose() }
})

it('disposes shared gauge resources once and removes columns before the model sweep', () => {
  const api = createHolographicCoreProductModel()
  const columns: THREE.InstancedMesh[] = []
  api.model.traverse(object => { if (object.name === 'hero-glass-arms') columns.push(object as THREE.InstancedMesh) })
  const geometryDispose = vi.spyOn(columns[0].geometry, 'dispose')
  const materialDispose = vi.spyOn(columns[0].material as THREE.Material, 'dispose')
  const instanceDispose = columns.map(mesh => vi.spyOn(mesh, 'dispose'))
  const runtime = api.model.userData.sculptRuntime as ProceduralModelRuntime
  const corners = runtime.meshes['tower-10'].getObjectByName('hero-metal-corners') as THREE.InstancedMesh
  const metalDispose = vi.spyOn(corners.material as THREE.Material, 'dispose')
  const cornersDispose = vi.spyOn(corners, 'dispose')
  api.dispose()
  expect(geometryDispose).toHaveBeenCalledTimes(1)
  expect(materialDispose).toHaveBeenCalledTimes(1)
  instanceDispose.forEach(spy => expect(spy).toHaveBeenCalledTimes(1))
  expect(metalDispose).toHaveBeenCalledTimes(1)
  expect(cornersDispose).toHaveBeenCalledTimes(1)
  expect(columns.every(mesh => mesh.parent === null)).toBe(true)
  expect(() => api.applyQualityScores(MOCK_QUALITY_SCORES)).toThrow('disposed')
})
