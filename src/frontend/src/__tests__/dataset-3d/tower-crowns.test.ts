import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { createHolographicCoreProductModel } from '../../graphics/holographic-core/holographic-core.model'
import { HERO_GAUGES, heroLabelForId } from '../../graphics/holographic-core/tower-gauge-config'
import type { ProceduralModelRuntime } from '../../graphics/holographic-core/generated-core'

it('names each hero dimension in English and Vietnamese without labelling context as hero', () => {
  expect(heroLabelForId('tower-10')).toBe('Completeness — Đầy đủ')
  expect(heroLabelForId('tower-12')).toBe('Uniqueness — Duy nhất')
  expect(heroLabelForId('tower-13')).toBe('Validity — Hợp lệ')
  expect(heroLabelForId('tower-14')).toBe('Accuracy — Chính xác')
  expect(heroLabelForId('tower-17')).toBe('Consistency — Nhất quán')
  expect(heroLabelForId('tower-18')).toBe('Timeliness — Kịp thời')
  expect(heroLabelForId('tower-01-back-high')).toBeNull()
  expect(heroLabelForId('core-cap-lid')).toBeNull()
})

it('keeps six distinct permanent crowns inside their old tower envelopes', () => {
  const api = createHolographicCoreProductModel()
  try {
    api.model.updateMatrixWorld(true)
    const runtime = api.model.userData.sculptRuntime as ProceduralModelRuntime
    const shapes = new Set<string>()
    for (const target of HERO_GAUGES) {
      const tower = runtime.meshes[target.towerId]
      const crown = tower.getObjectByName(`hero-crown-${target.dimension}`)!
      expect(crown?.parent).toBe(tower)
      expect(crown.visible).toBe(true)
      const envelope = tower.geometry.boundingBox!.clone().applyMatrix4(tower.matrixWorld)
      const bounds = new THREE.Box3().setFromObject(crown)
      expect(envelope.containsBox(bounds), target.dimension).toBe(true)
      const glyph = crown.getObjectByName('hero-crown-glyph') as THREE.Mesh
      const positions = glyph.geometry.getAttribute('position')
      shapes.add(`${positions.count}/${Array.from(positions.array).slice(0, 18).join(',')}`)
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true)
    }
    expect(shapes.size).toBe(6)
  } finally { api.dispose() }
})

it('rotates only the clock hand linearly once per minute, with a static reset pose', () => {
  const api = createHolographicCoreProductModel()
  try {
    const hand = api.model.getObjectByName('hero-crown-clock-hand')!
    expect(hand.rotation.y).toBe(0)
    const staticGlyph = api.model.getObjectByName('hero-crown-completeness')!
    api.update(15, 0.016)
    expect(hand.rotation.y).toBeCloseTo(-Math.PI / 2, 6)
    expect(staticGlyph.rotation.y).toBe(0)
    api.update(30, 0.016)
    expect(hand.rotation.y).toBeCloseTo(-Math.PI, 6)
    api.resetMotion()
    expect(hand.rotation.y).toBe(0)
    api.resetMotion()
    expect(hand.rotation.y).toBe(0)
  } finally { api.dispose() }
})

it('removes crowns before the model sweep and disposes their shared material once', () => {
  const api = createHolographicCoreProductModel()
  const roots = HERO_GAUGES.map(target => api.model.getObjectByName(`hero-crown-${target.dimension}`)!)
  const glyph = roots[0].getObjectByName('hero-crown-glyph') as THREE.Mesh
  const dispose = vi.spyOn(glyph.material as THREE.Material, 'dispose')
  api.dispose()
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(roots.every(root => root.parent === null)).toBe(true)
})
