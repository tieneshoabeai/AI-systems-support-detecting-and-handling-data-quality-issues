import { requireDefined } from '../../utils/required-value'
// Structural regression gate, originally established at Phase 0.
// The historical fixture filename is retained; Batch 4 rebases it to the explicitly accepted
// current tower/glass/backdrop design. It does not prove image equivalence or WebGL correctness.
// Changes to matrices, geometry hashes, materials or selection contours require another review.
//
// Regeneration is a separate reviewed measurement step, using the same buildFingerprint helper
// as .agents/dataset-3d-core/captures/model-fingerprint.measure.ts. Normal tests only read the
// fixture: a test that could rewrite its own expected output would not be a gate.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createHolographicCoreProductModel } from '../../graphics/holographic-core/holographic-core.model'
import { buildFingerprint, type Moment } from './support/model-fingerprint'

const BASELINE = resolve(process.cwd(), '.agents/dataset-3d-core/fingerprint/p0-baseline.ndjson')
const MOMENTS: Moment[] = ['init', 'update-7.3', 'reset-motion', 'detached', 'selected-18']

function parseBaseline(text: string): Map<Moment, string[]> {
  const sections = new Map<Moment, string[]>()
  let current: Moment | null = null
  for (const line of text.split('\n')) {
    if (line.startsWith('# moment=')) {
      const moment = line.slice('# moment='.length).trim() as Moment
      if (!MOMENTS.includes(moment)) throw new Error(`unknown moment in baseline: ${moment}`)
      current = moment
      sections.set(moment, [])
      continue
    }
    if (current && line) sections.get(current)!.push(line)
  }
  return sections
}

function truncate(line: string): string {
  return line.length > 240 ? `${line.slice(0, 240)}... (${line.length} chars)` : line
}

describe('holographic core fingerprint vs the accepted structural baseline', () => {
  const text = readFileSync(BASELINE, 'utf8')
  const expected = parseBaseline(text)
  const apiFor = () => createHolographicCoreProductModel()

  it('has a baseline section for every captured moment', () => {
    expect([...expected.keys()].sort()).toEqual([...MOMENTS].sort())
  })

  // selected-18 rebuilds one model per tower, so it needs far more than the 5s default.
  it.each(MOMENTS)('%s reproduces the baseline byte for byte', (moment) => {
    const want = expected.get(moment)!
    const got = buildFingerprint(apiFor, moment)
    const diffs: string[] = []
    if (want.length !== got.length) diffs.push(`line count ${want.length} -> ${got.length}`)
    for (let index = 0; index < Math.min(want.length, got.length); index += 1) {
      if (want[index] === got[index]) continue
      diffs.push(`#${index}\n    - ${truncate(requireDefined(want[index], 'model-fingerprint.test.ts:58'))}\n    + ${truncate(requireDefined(got[index], 'model-fingerprint.test.ts:58'))}`)
      if (diffs.length >= 5) break
    }
    expect(diffs, `fingerprint drift at moment "${moment}"`).toEqual([])
  }, 120_000)
})
