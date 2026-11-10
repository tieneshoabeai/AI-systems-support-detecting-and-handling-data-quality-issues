import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createInboundGuidePaths, createInboundPaths, type InboundPath } from '../../graphics/holographic-core/inbound-stream-paths'

const POSITION = new THREE.Vector3()
const TANGENT = new THREE.Vector3()

function pointAt(path: InboundPath, s: number) {
  path.sampleAt(s, POSITION, TANGENT)
  return POSITION.clone()
}

function startAzimuth(path: InboundPath) {
  const start = pointAt(path, 0)
  return (THREE.MathUtils.radToDeg(Math.atan2(start.z, start.x)) + 360) % 360
}

function readPoint(points: Float32Array, index: number) {
  return new THREE.Vector3(points[index * 3], points[index * 3 + 1], points[index * 3 + 2])
}

describe('inbound stream paths', () => {
  it('P1: builds twenty-four lanes across four groups with staggered cycles', () => {
    const paths = createInboundPaths()
    expect(paths).toHaveLength(24)

    const offsets = [-5, -3, -1, 1, 3, 5]
    for (const azimuth of [0, 90, 180, 270]) {
      const group = paths.filter(path => path.definition.groupId === `azimuth-${azimuth}`)
      expect(group).toHaveLength(6)
      expect(group.map(path => path.definition.offsetDegrees)).toEqual(offsets)
      expect(group[1].definition.cycleSeconds - group[0].definition.cycleSeconds).toBeCloseTo(0.3, 9)
      group.forEach((path, index) => {
        expect(startAzimuth(path)).toBeCloseTo((azimuth + offsets[index] + 360) % 360, 5)
      })
    }

    for (const path of paths) {
      expect(path.definition.startHeight).toBe(3)
      expect(path.definition.startRadius).toBe(1.45)
      expect(path.definition.landingRadius).toBe(0.22)
      expect(pointAt(path, 0).y).toBeCloseTo(3, 5)
    }

    // Every lane ends on the same ring, not on the exact centre.
    for (const path of paths) {
      const landing = pointAt(path, path.length)
      expect(Math.hypot(landing.x, landing.z)).toBeCloseTo(0.22, 3)
      expect(landing.y).toBeCloseTo(0, 5)
    }
  })

  it('alternates across each lane heading and settles back onto it at the landing', () => {
    const guides = createInboundGuidePaths()
    expect(guides.map(path => Math.round(startAzimuth(path)) % 360)).toEqual([0, 90, 180, 270])

    for (const path of [...guides, ...createInboundPaths()]) {
      const sideways = new THREE.Vector3(-Math.sin(path.azimuthRadians), 0, Math.cos(path.azimuthRadians))
      const offsets = Array.from({ length: path.points.length / 3 }, (_, index) =>
        readPoint(path.points, index).dot(sideways),
      )
      const clearBends = offsets.filter(offset => Math.abs(offset) > 0.025).map(Math.sign)
      const reversals = clearBends.filter((sign, index) => index > 0 && sign !== clearBends[index - 1])

      expect(reversals.length).toBeGreaterThanOrEqual(5)
      expect(offsets[0]).toBeCloseTo(0, 5)
      expect(offsets[offsets.length - 1]).toBeCloseTo(0, 5)
    }
  })

  it('P2: samples uniformly along the arc, above the cap, settling on the landing ring', () => {
    for (const path of createInboundPaths()) {
      const count = path.points.length / 3
      expect(count).toBe(256)

      const spacing = path.length / (count - 1)
      let previousRadius = Infinity
      for (let index = 0; index < count; index++) {
        const point = readPoint(path.points, index)
        expect(point.y).toBeGreaterThanOrEqual(-1e-9)
        expect(Math.hypot(point.x, point.z)).toBeLessThanOrEqual(previousRadius + 1e-6)
        previousRadius = Math.hypot(point.x, point.z)

        if (index > 0) {
          const previous = readPoint(path.points, index - 1)
          expect(previous.distanceTo(point)).toBeCloseTo(spacing, 3)
        }
      }

      const landing = readPoint(path.points, count - 1)
      expect(Math.hypot(landing.x, landing.z)).toBeCloseTo(0.22, 3)
    }
  })

  it('P3: clamps out-of-range arc parameters to the ends', () => {
    for (const path of createInboundPaths()) {
      const first = pointAt(path, -1)
      const end = pointAt(path, path.length)
      const beyond = pointAt(path, path.length + 5)

      expect(first.x).toBeCloseTo(path.points[0], 5)
      expect(first.y).toBeCloseTo(path.points[1], 5)
      expect(first.z).toBeCloseTo(path.points[2], 5)

      const lastIndex = path.points.length - 3
      expect(end.x).toBeCloseTo(path.points[lastIndex], 5)
      expect(end.y).toBeCloseTo(path.points[lastIndex + 1], 5)
      expect(end.z).toBeCloseTo(path.points[lastIndex + 2], 5)
      expect(beyond.distanceTo(end)).toBeLessThan(1e-9)

      for (const value of [first.x, first.y, first.z, end.x, end.y, end.z]) {
        expect(Number.isFinite(value)).toBe(true)
      }
    }
  })

  it('P4: fans neighbouring lanes apart at the rim and tightens them at the landing ring', () => {
    const paths = createInboundPaths()
    for (let groupStart = 0; groupStart < paths.length; groupStart += 6) {
      for (let lane = 1; lane < 6; lane++) {
        const previousRim = readPoint(paths[groupStart + lane - 1].points, 32)
        const currentRim = readPoint(paths[groupStart + lane].points, 32)
        expect(currentRim.distanceTo(previousRim)).toBeGreaterThanOrEqual(0.03)

        const previousEnd = readPoint(paths[groupStart + lane - 1].points, 255)
        const currentEnd = readPoint(paths[groupStart + lane].points, 255)
        expect(currentEnd.distanceTo(previousEnd)).toBeLessThan(0.02)
      }
    }
  })
})
