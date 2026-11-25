import { Box3, Matrix4, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { alignPanelAtSeam, createAuthGlassGeometry, findPanelFootprintCenter } from '../../graphics/auth-glass/auth-glass.geometry'
import { authGlassConfig } from '../../graphics/auth-glass/auth-glass.config'

it('creates a finite bevelled panel with configured dimensions and centered thickness', () => {
  const geometry = createAuthGlassGeometry()
  try {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const size = box.getSize(new Vector3())
    expect(size.x).toBeCloseTo(authGlassConfig.slab.width, 5)
    expect(size.y).toBeCloseTo(authGlassConfig.slab.height, 5)
    expect(size.z).toBeCloseTo(authGlassConfig.slab.depth, 5)
    expect(box.getCenter(new Vector3()).z).toBeCloseTo(0, 6)
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
  } finally { geometry.dispose() }
})

it.each([-1, 1] as const)('aligns the rotated panel contact edge to the seam on side %s', side => {
  const geometry = createAuthGlassGeometry()
  try {
    const yaw = 0.42
    const position = alignPanelAtSeam(geometry, yaw, side)
    const placed = geometry.clone()
    try {
      placed.applyMatrix4(new Matrix4().makeRotationY(yaw))
      placed.translate(...position)
      placed.computeBoundingBox()
      const edge = side === 1 ? placed.boundingBox!.max.x : placed.boundingBox!.min.x
      expect(edge).toBeCloseTo(0, 6)
      expect(position[1]).toBe(-authGlassConfig.slab.height / 2)
    } finally { placed.dispose() }
  } finally { geometry.dispose() }
})

it('finds the combined footprint center after rotations and translations', () => {
  const geometry = createAuthGlassGeometry()
  try {
    const layout = [
      { yaw: 0, position: [2, 0, -3] as [number, number, number] },
      { yaw: Math.PI / 2, position: [-1, 0, 4] as [number, number, number] },
    ]
    const bounds = new Box3()
    for (const panel of layout) {
      const placed = geometry.clone()
      placed.rotateY(panel.yaw).translate(...panel.position)
      placed.computeBoundingBox()
      bounds.union(placed.boundingBox!)
      placed.dispose()
    }
    const expected = bounds.getCenter(new Vector3())
    const center = findPanelFootprintCenter(geometry, layout)
    expect(center.x).toBeCloseTo(expected.x, 6)
    expect(center.z).toBeCloseTo(expected.z, 6)
  } finally { geometry.dispose() }
})
