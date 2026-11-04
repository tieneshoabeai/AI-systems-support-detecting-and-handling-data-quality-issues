// The Tower<->Core clearance gate (CODE ARCHITECTURE IMPROVEMENT PLAN, S3 / Phase 1, Test B).
//
// The binding constraint between the 14 towers and the spinning orbit used to live only in a comment
// in core-visual-config.ts. p1-orbit-clearance.ndjson pins it as numbers, quantised to 6 decimals, so
// "this refactor did not bring a tower closer to the orbit" is a byte comparison instead of a promise.
// The plan's tolerance for Phases 2-5 is zero: any deviation is a diff, and whether to widen it later
// is a design decision, not something a refactor sneaks in.
//
// The baseline is regenerated only by
// .agents/dataset-3d-core/captures/orbit-tower-clearance.measure.ts, which is NOT part of `npm test`,
// and both it and this test call buildClearance() from ./support/orbit-clearance.ts — same rule as the
// Phase 0 fingerprint.
//
// What the pinned numbers mean:
//   * `swept` is the worst case over the FULL spin, not over the captured pose. orbitGroup rotates
//     0.05 rad/s forever (spool-core.ts:634), so every yaw is visited; the swept cylindrical shell of
//     a tower is the exact answer and a 512-step brute sweep agrees with it to 0.0006 (generator §5).
//   * `swept` is measured to the tower's Box3, which unions hidden children such as the selection
//     contour, so it is the conservative reading: never wider than the drawn truth.
//   * After tower-15 removal, all remaining tower gaps must be non-negative.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { createHolographicCoreProductModel } from '../../graphics/holographic-core/holographic-core.model'
import { ALL_TOWER_IDS, buildClearance, coreSurfaceGap, coreSurfaces } from './support/orbit-clearance'

const BASELINE = resolve(process.cwd(), '.agents/dataset-3d-core/fingerprint/p1-orbit-clearance.ndjson')

function parseLines(text: string): string[] {
  return text.split('\n').filter(line => line && !line.startsWith('#'))
}

function field(lines: string[], prefix: string, key: string): number {
  const line = lines.find(candidate => candidate.startsWith(prefix) && candidate.includes(`${key}=`))
  if (!line) throw new Error(`no line starting "${prefix}" carries "${key}"`)
  const token = line.split('|').find(part => part.startsWith(`${key}=`))!
  return Number(token.slice(key.length + 1))
}

function gapsOf(lines: string[], prefix: string): Array<{ id: string; swept: number }> {
  return lines.filter(line => line.startsWith(prefix)).map(line => ({
    id: line.split('|')[1],
    swept: field([line], prefix, 'swept'),
  }))
}

describe('orbit-vs-tower clearance vs the Phase 1 baseline', () => {
  it('measures the slope and full closures of the inverted lower roof', () => {
    const surface = coreSurfaces().find(entry => entry.name === 'lower-roof')!
    expect(coreSurfaceGap(new THREE.Vector3(0, 0.3, 0), surface)).toBeCloseTo(0.1, 6)
    expect(coreSurfaceGap(new THREE.Vector3(0, 0.62, 0), surface)).toBeCloseTo(0.1, 6)
    expect(coreSurfaceGap(new THREE.Vector3(1.11, 0.46, 0), surface)).toBeCloseTo(0, 6)
    expect(coreSurfaceGap(new THREE.Vector3(1.2, 0.46, 0), surface)).toBeCloseTo(0.09 / Math.sqrt(2), 6)
  })

  it('measures both glass closures and the inner wall of the new lower drum', () => {
    const surface = coreSurfaces().find(entry => entry.name === 'base-glass')!
    expect(surface.closed).toBe(true)
    expect(coreSurfaceGap(new THREE.Vector3(0, 0.92, 0), surface)).toBeCloseTo(0.1, 6)
    expect(coreSurfaceGap(new THREE.Vector3(0, 0.42, 0), surface)).toBeCloseTo(0.1, 6)
    expect(coreSurfaceGap(new THREE.Vector3(0, 0.82, 0), surface)).toBeCloseTo(0, 6)
    expect(coreSurfaceGap(new THREE.Vector3(1.01, 0.67, 0), surface)).toBeCloseTo(0.01, 6)
  })
  const expected = parseLines(readFileSync(BASELINE, 'utf8'))
  let got: string[] = []

  beforeAll(() => {
    got = buildClearance(createHolographicCoreProductModel().model)
  }, 120_000)

  it('pins a line for every one of the 14 towers', () => {
    const ids = got.filter(line => line.startsWith('tower|')).map(line => line.split('|')[1])
    expect(ids).toEqual(ALL_TOWER_IDS)
  })

  it('reproduces the baseline byte for byte', () => {
    const diffs: string[] = []
    if (expected.length !== got.length) diffs.push(`line count ${expected.length} -> ${got.length}`)
    for (let index = 0; index < Math.min(expected.length, got.length); index += 1) {
      if (expected[index] === got[index]) continue
      diffs.push(`#${index}\n    - ${expected[index]}\n    + ${got[index]}`)
      if (diffs.length >= 5) break
    }
    expect(diffs, 'clearance drift: a tower, the orbit or a core surface moved').toEqual([])
  }, 120_000)

  // The gate is only as honest as the cloud it measures. The synthetic ring is built from
  // SPOOL_CORE.orbits, so if spool-core ever stops mirroring that pipeline the drift opens up and the
  // pinned gaps would be describing geometry that is no longer on screen.
  it('is still measuring the geometry that is actually drawn', () => {
    expect(field(got, 'orbit|samples=', 'drift')).toBeLessThan(0.003)
    expect(got.filter(line => line.startsWith('tower|'))).toHaveLength(14)
    expect(got.filter(line => line.startsWith('core|'))).toHaveLength(7)
  })

  // No tower exceptions remain after removal of tower-15.
  it('keeps every remaining tower clear of the full spin', () => {
    const gaps = gapsOf(got, 'tower|')
    const pierced = gaps.filter(entry => entry.swept < 0).map(entry => entry.id)
    expect(pierced, 'a remaining tower entered the orbit path').toEqual([])
    expect(gaps.filter(entry => entry.swept >= 0)).toHaveLength(14)
  })
})
