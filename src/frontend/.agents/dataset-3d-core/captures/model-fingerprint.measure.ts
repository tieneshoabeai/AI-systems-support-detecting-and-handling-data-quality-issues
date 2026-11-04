// Phase 0 baseline generator. Writes the fingerprint of the CURRENT tree to
// .agents/dataset-3d-core/fingerprint/p0-baseline.ndjson, which
// src/__tests__/dataset-3d/model-fingerprint.test.ts then compares every later phase against.
//
// Run from src/frontend:
//   npx vitest run --config .agents/dataset-3d-core/captures/vitest.measure.config.ts
//
// This file is deliberately NOT part of `npm test`: a test that can rewrite its own baseline would
// not be a gate. The comparison side lives in src/__tests__ and shares buildFingerprint() with here,
// so the two can never drift apart.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { createHolographicCoreProductModel } from '../../../src/graphics/holographic-core/holographic-core.model'
import { renderFingerprint, type Moment } from '../../../src/__tests__/dataset-3d/support/model-fingerprint'

const MOMENTS: Moment[] = ['init', 'update-7.3', 'reset-motion', 'detached', 'selected-18']
// import.meta.url is not a file: URL under Vitest's jsdom transform, so the baseline path is
// resolved from the working directory. Every harness in this repo is run from src/frontend.
const OUT = resolve(process.cwd(), '.agents/dataset-3d-core/fingerprint/p0-baseline.ndjson')

it('writes the Phase 0 fingerprint baseline', () => {
  expect(existsSync(resolve(process.cwd(), '.agents/dataset-3d-core')), `run from src/frontend, not ${process.cwd()}`).toBe(true)
  const apiFor = () => createHolographicCoreProductModel()
  const body = MOMENTS.map(moment => renderFingerprint(apiFor, moment)).join('')
  expect(body.startsWith('# moment=init')).toBe(true)

  const lines = body.split('\n')
  const perMoment = MOMENTS.map(moment => {
    const start = lines.indexOf(`# moment=${moment}`)
    let end = lines.length
    for (let index = start + 1; index < lines.length; index += 1) if (lines[index].startsWith('# moment=')) end = index
    return `${moment}=${end - start - 1}`
  })
  console.log([
    `baseline -> ${OUT}`,
    `  ${perMoment.join('  ')}`,
    `  bytes=${body.length} sha256=${createHash('sha256').update(body).digest('hex').slice(0, 16)}`,
  ].join('\n'))
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, body, 'utf8')
})
