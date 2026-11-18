import { AdditiveBlending, EquirectangularReflectionMapping, Vector3, Vector4 } from 'three'
import { expect, it, vi } from 'vitest'
import { createBaseRingGeometry, createBaseTierGeometry } from '../../graphics/auth-glass/display-base/display-base.geometry'
import { displayBaseOptions, parseDisplayBaseView } from '../../graphics/auth-glass/display-base/display-base.config'
import { createBaseFloorFade, createBaseGlint, createBaseGlow, createBasePanorama } from '../../graphics/auth-glass/display-base/display-base.lighting'

it.each(displayBaseOptions.tiers)('builds tier $name with its physical radius and height', tier => {
  const top = 0.7
  const geometry = createBaseTierGeometry(tier, top, 32, 4)
  try {
    geometry.computeBoundingBox()
    const size = geometry.boundingBox!.getSize(new Vector3())
    expect(size.x).toBeCloseTo(2 * tier.radius, 5)
    expect(size.z).toBeCloseTo(2 * tier.radius, 5)
    expect(size.y).toBeCloseTo(tier.height, 5)
    expect(geometry.boundingBox!.max.y).toBeCloseTo(top, 5)
    expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
  } finally { geometry.dispose() }
})

it('assigns finite, varying vertex colors to the illuminated ring', () => {
  const geometry = createBaseRingGeometry(2, displayBaseOptions.ring, 32)
  try {
    const color = geometry.getAttribute('color')
    expect(color.count).toBe(geometry.getAttribute('position').count)
    expect(Array.from(color.array).every(Number.isFinite)).toBe(true)
    expect(new Set(Array.from(color.array)).size).toBeGreaterThan(3)
    expect(Math.min(...color.array)).toBeGreaterThanOrEqual(0)
  } finally { geometry.dispose() }
})

it('produces a finite HDR panorama with opaque pixels and nonuniform lighting', () => {
  const texture = createBasePanorama()
  try {
    expect(texture.mapping).toBe(EquirectangularReflectionMapping)
    expect(texture.image.width).toBe(128)
    expect(texture.image.height).toBe(64)
    if (texture.image.data === null) throw new Error('Missing panorama pixel buffer')
    const pixels = Array.from(texture.image.data)
    expect(pixels).toHaveLength(128 * 64 * 4)
    expect(pixels.every(Number.isFinite)).toBe(true)
    expect(pixels.filter((_value, index) => index % 4 === 3).every(value => value === 1)).toBe(true)
    expect(Math.max(...pixels)).toBeGreaterThan(1)
  } finally { texture.dispose() }
})

it.each(['inlay', 'floor', 'halo'] as const)('creates an independent %s glow with caller-supplied intensity', kind => {
  const material = createBaseGlow(kind, 3, 0.75, true)
  const other = createBaseGlow(kind, 2, 0.25, false)
  try {
    expect(material.uniforms['uRadius']?.value).toBe(3)
    expect(material.uniforms['uStrength']?.value).toBe(0.75)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.blending).toBe(AdditiveBlending)
    material.uniforms['uTime']!.value = 10
    expect(other.uniforms['uTime']?.value).toBe(0)
    expect(material.uniforms['uFootlights']).toBeUndefined()
  } finally { material.dispose(); other.dispose() }
})

it('maps panel footlights to world position and direction uniforms', () => {
  const material = createBaseGlow('inlay', 3, 1, false, {
    panels: [{ x: 2, z: -1, yaw: Math.PI / 2 }], width: 4, depth: 0.5,
  })
  try {
    const lights = material.uniforms['uFootlights']!.value as Vector4[]
    expect(lights).toHaveLength(1)
    expect(lights[0]!.x).toBe(2)
    expect(lights[0]!.y).toBe(-1)
    expect(lights[0]!.z).toBeCloseTo(0, 6)
    expect(lights[0]!.w).toBeCloseTo(-1, 6)
    expect(material.uniforms['uFootSize']?.value).toMatchObject({ x: 2, y: 0.25 })
  } finally { material.dispose() }
})

it.each([createBaseGlint, createBaseFloorFade])('degrades to an allocated texture when Canvas2D is unavailable: %s', create => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const texture = create()
  try {
    const canvas = texture.image
    expect(canvas.width).toBe(64)
    expect(canvas.height).toBe(64)
  } finally { texture.dispose() }
})

it.each(['front', 'left', 'right', 'top', 'low'] as const)('recognizes the %s review camera', view => {
  expect(parseDisplayBaseView(view)).toBe(view)
})
it.each([null, '', 'invalid', 'TOP'])('defaults unsupported review view %s to front', value => {
  expect(parseDisplayBaseView(value)).toBe('front')
})
