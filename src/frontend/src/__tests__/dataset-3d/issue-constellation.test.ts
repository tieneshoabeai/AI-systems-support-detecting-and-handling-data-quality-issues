import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  CLEAN_LOOP_POINTS,
  CORE_GLOW_V2,
  CORE_GLOW_V3,
  CORE_VISUAL_REVISION,
  DETECTION_ANCHOR,
  ISSUE_CONSTELLATION,
  resolveCoreGlow,
  resolveCoreNucleus,
  resolveDetectionAnchor,
  resolveIssueLanes,
  SPOOL_CORE,
  type Vec3,
} from '../../graphics/holographic-core/core-visual-config'
import { createIssueConstellation } from '../../graphics/holographic-core/issue-constellation'
import { NEON_CUBE_THEMES } from '../../graphics/neon-cube/neon-cube.model'
import { createHolographicCoreProductModel } from '../../graphics/holographic-core/holographic-core.model'

function distance(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

describe('core visual config', () => {
  it('derives the Detection anchor from the orange satellite', () => {
    const anchor = resolveDetectionAnchor()
    expect(anchor.center[0]).toBeCloseTo(6.8, 6)
    expect(anchor.center[1]).toBeCloseTo(1.726, 6)
    expect(anchor.center[2]).toBeCloseTo(-1.2, 6)
    expect(anchor.halfSide).toBeCloseTo(0.4752, 6)
    expect(Math.hypot(anchor.surface[0] - anchor.center[0], anchor.surface[2] - anchor.center[2]))
      .toBeCloseTo(anchor.halfSide + 0.14, 5)
  })

  it('keeps every issue lane anchored to the nucleus and the cube face', () => {
    const lanes = resolveIssueLanes(CORE_VISUAL_REVISION)
    const nucleus = resolveCoreNucleus(CORE_VISUAL_REVISION)
    // v4 lanes leave the wider chamber glass, not the old drum shoulder.
    const expectedRadius = CORE_VISUAL_REVISION === 'v4-spool' ? SPOOL_CORE.chamber.radius + 0.03 : nucleus.equatorRadius
    expect(lanes).toHaveLength(3)
    for (const lane of lanes) {
      const startRadius = Math.hypot(lane.start[0], lane.start[2])
      expect(Math.abs(startRadius - expectedRadius)).toBeLessThan(0.05)
      if (CORE_VISUAL_REVISION === 'v4-spool') {
        expect(lane.start[1]).toBeGreaterThanOrEqual(1.3)
        expect(lane.start[1]).toBeLessThanOrEqual(1.55)
      } else {
        expect(lane.start[1]).toBeGreaterThanOrEqual(1.8)
        expect(lane.start[1]).toBeLessThanOrEqual(2.1)
      }
      const endDistance = distance(lane.end, DETECTION_ANCHOR.center)
      expect(endDistance).toBeGreaterThan(DETECTION_ANCHOR.halfSide + 0.1)
      expect(endDistance).toBeLessThan(DETECTION_ANCHOR.halfSide + 0.2)
      expect(lane.speed).toBeGreaterThan(0)
      expect(lane.speed).toBeLessThan(0.1)
    }
  })

  it('keeps the clean loop between the drum and the tower inner faces', () => {
    const maxRadius = Math.max(...CLEAN_LOOP_POINTS.map(point => Math.hypot(point[0], point[2])))
    expect(maxRadius).toBeGreaterThan(1.2)
    expect(maxRadius).toBeLessThan(1.49)
  })

  it('ships 18 issue motes and 30 clean motes', () => {
    expect(resolveIssueLanes(CORE_VISUAL_REVISION).length * ISSUE_CONSTELLATION.issueParticlesPerLane).toBe(18)
    expect(ISSUE_CONSTELLATION.cleanParticleCount).toBe(30)
    expect(ISSUE_CONSTELLATION.issuePalette.every(([r, g, b]) => r > g && g > b)).toBe(true)
    expect(ISSUE_CONSTELLATION.cleanPalette.every(([r, , b]) => b > r)).toBe(true)
  })

  it('keeps the core body below bloom threshold while legacy values stay intact', () => {
    expect(CORE_VISUAL_REVISION).toBe('v4-spool')
    for (const entry of Object.values(CORE_GLOW_V3)) {
      expect(entry.patch.emissiveIntensity ?? 0).toBeLessThanOrEqual(1)
    }
    expect(CORE_GLOW_V3['core-upper'].patch.emissiveIntensity).toBe(0.5)
    expect(CORE_GLOW_V2['core-upper'].patch.emissiveIntensity).toBe(1.35)
    expect(resolveCoreGlow('v2-tier')).toBe(CORE_GLOW_V2)
    expect(resolveCoreNucleus('v4-spool').centerY).toBe(SPOOL_CORE.nucleus.y)
  })
})

describe('issue constellation model', () => {
  it.each(['orange', 'cyan', 'blue', 'violet'] as const)('uses %s color and never shows motes ahead of the reveal', theme => {
    const constellation = createIssueConstellation()
    constellation.setConnection(theme, 0.25)
    constellation.update(0, 0)
    const group = constellation.root.getObjectByName(`cube-connection-${theme}`) as THREE.Group
    const line = group.children[0] as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>
    expect(line.material.color.toArray()).toEqual([...NEON_CUBE_THEMES[theme].neonLinear])
    const particles = constellation.root.getObjectByName('constellation-particles') as THREE.InstancedMesh
    const matrix = new THREE.Matrix4()
    // Lane zero's third mote starts at t=2/6, beyond the visible quarter.
    particles.getMatrixAt(2, matrix)
    expect(new THREE.Vector3().setFromMatrixScale(matrix).length()).toBe(0)
    constellation.setConnection(null, 0)
    for (let i = 0; i < 18; i++) {
      particles.getMatrixAt(i, matrix)
      expect(new THREE.Vector3().setFromMatrixScale(matrix).length()).toBe(0)
    }
    constellation.dispose()
  })

  it('builds the expected draw groups and updates without allocation errors', () => {
    const constellation = createIssueConstellation()
    expect(constellation.root.name).toBe('issue-constellation')
    const particles = constellation.root.getObjectByName('constellation-particles') as THREE.InstancedMesh
    const beads = constellation.root.getObjectByName('nucleus-beads') as THREE.InstancedMesh
    expect(particles).toBeInstanceOf(THREE.InstancedMesh)
    expect(particles.count).toBe(48)
    expect(beads.count).toBe(18)
    expect(constellation.root.getObjectByName('nucleus-bands')).toBeInstanceOf(THREE.Mesh)
    expect(constellation.root.getObjectByName('constellation-lanes')).toBeInstanceOf(THREE.LineSegments)
    expect(constellation.root.getObjectByName('detection-beacon-ring')).toBeInstanceOf(THREE.Mesh)
    expect(constellation.root.getObjectByName('detection-beacon-sprite')).toBeInstanceOf(THREE.Sprite)

    const before = new THREE.Matrix4()
    constellation.setConnection('orange', 1)
    particles.getMatrixAt(0, before)
    const beforeElements = [...before.elements]
    constellation.update(2.5, 1 / 60)
    particles.getMatrixAt(0, before)
    expect([...before.elements]).not.toEqual(beforeElements)

    constellation.reset()
    expect(() => constellation.reset()).not.toThrow()
    constellation.setDetached(true)
    expect(constellation.root.visible).toBe(false)
    constellation.setDetached(false)
    expect(constellation.root.visible).toBe(true)
    constellation.dispose()
  })

  it('starts hidden, reveals three paths, and hides the old bundle immediately', () => {
    const constellation = createIssueConstellation()
    const bundles = ['orange', 'cyan', 'blue', 'violet'].map(theme =>
      constellation.root.getObjectByName(`cube-connection-${theme}`) as THREE.Group)
    expect(bundles.every(bundle => !bundle.visible && bundle.children.length === 3)).toBe(true)
    constellation.setConnection('orange', 0.5)
    const line = bundles[0].children[0] as THREE.Line
    expect(line.geometry.drawRange.count).toBe(34)
    expect(bundles[0].visible).toBe(true)
    expect(constellation.root.getObjectByName('detection-beacon-ring')?.visible).toBe(false)
    constellation.setConnection('orange', 1)
    expect(line.geometry.drawRange.count).toBe(65)
    expect(constellation.root.getObjectByName('detection-beacon-ring')?.visible).toBe(true)
    constellation.setConnection('cyan', 0)
    expect(bundles.every(bundle => !bundle.visible)).toBe(true)
    constellation.setConnection('cyan', 1)
    expect(bundles.map(bundle => bundle.visible)).toEqual([false, true, false, false])
    constellation.reset()
    expect(bundles[1].visible).toBe(true)
    constellation.setConnection(null, 0)
    expect(bundles.every(bundle => !bundle.visible)).toBe(true)
    constellation.dispose()
  })

  it('is mounted in the product model and hidden while exploded', () => {
    const product = createHolographicCoreProductModel()
    const root = product.model.getObjectByName('issue-constellation')
    expect(root).toBeDefined()
    product.setDetached(true)
    expect(root?.visible).toBe(false)
    product.setDetached(false)
    expect(root?.visible).toBe(true)
    product.dispose()
  })
})
