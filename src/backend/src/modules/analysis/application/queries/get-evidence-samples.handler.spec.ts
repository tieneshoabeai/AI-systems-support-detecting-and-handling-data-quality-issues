import { ValidationError } from '../../../../shared/domain/errors';
import type { AnalysisRepositoryPort } from '../../domain/ports/analysis.repository.port';
import { GetEvidenceSamplesHandler } from './get-evidence-samples.handler';

const runId = '123456789012345678901234';

function setup(rows: Array<Record<string, unknown>> = []) {
  const findEvidenceSamples = jest.fn(async () => rows);
  const handler = new GetEvidenceSamplesHandler({ findEvidenceSamples } as unknown as AnalysisRepositoryPort);
  return { handler, findEvidenceSamples };
}

it('filters a finding by its kind and column and returns only masked values with zero-based row indices', async () => {
  const { handler, findEvidenceSamples } = setup([{
    id: 'abcdefabcdefabcdefabcdef',
    runId,
    kind: 'missing',
    column: 'Email',
    rowIndex: 0,
    reason: 'DQ01_MISSING',
    valueMasked: null,
  }]);

  const page = await handler.execute(runId, { findingId: 'DQ-01:Email', limit: 20 });

  expect(findEvidenceSamples).toHaveBeenCalledTimes(1);
  expect(findEvidenceSamples).toHaveBeenCalledWith({ runId, kind: 'missing', column: 'Email', limit: 21 });
  expect(page).toEqual({
    items: [{ findingId: 'DQ-01:Email', kind: 'missing', column: 'Email', rowIndex: 0, reason: 'DQ01_MISSING', valueMasked: null }],
    meta: { limit: 20, hasMore: false, nextCursor: null },
  });
})

it('applies the cursor, limits each page and returns the last included evidence id as next cursor', async () => {
  const { handler, findEvidenceSamples } = setup([
    { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', kind: 'missing', column: 'Email', rowIndex: 1, valueMasked: null },
    { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', kind: 'missing', column: 'Email', rowIndex: 2, valueMasked: null },
    { id: 'cccccccccccccccccccccccc', kind: 'missing', column: 'Email', rowIndex: 3, valueMasked: null },
  ]);

  const page = await handler.execute(runId, { findingId: 'DQ-01:Email', limit: 2, cursor: '999999999999999999999999' });

  expect(findEvidenceSamples).toHaveBeenCalledWith({
    runId, kind: 'missing', column: 'Email', afterId: '999999999999999999999999', limit: 3,
  });
  expect(page.items.map((item) => item.rowIndex)).toEqual([1, 2]);
  expect(page.meta).toEqual({ limit: 2, hasMore: true, nextCursor: 'bbbbbbbbbbbbbbbbbbbbbbbb' });
})

it('returns a well-formed empty page when no evidence is stored', async () => {
  const { handler } = setup();
  await expect(handler.execute(runId, { findingId: 'DQ-01:Email', limit: 20 })).resolves.toEqual({
    items: [], meta: { limit: 20, hasMore: false, nextCursor: null },
  });
})

it('shapes legacy stored values at the API boundary so raw sample text is never returned', async () => {
  const rawValue = 'alice@example.com';
  const { handler } = setup([{
    id: 'abcdefabcdefabcdefabcdef', kind: 'invalid_type', column: 'Email', rowIndex: 7,
    reason: 'format check', valueMasked: rawValue,
  }]);

  const page = await handler.execute(runId, { findingId: 'DQ-03:Email', limit: 20 });

  expect(page.items[0]?.valueMasked).toMatch(/^Mẫu: [Aad *]+$/);
  expect(JSON.stringify(page)).not.toContain(rawValue);
})

it('rejects mismatched filters and unsupported findings before querying evidence', async () => {
  const { handler, findEvidenceSamples } = setup();
  await expect(handler.execute(runId, { findingId: 'DQ-01:Email', kind: 'outlier', limit: 20 }))
    .rejects.toBeInstanceOf(ValidationError);
  await expect(handler.execute(runId, { findingId: 'OTHER:Email', limit: 20 }))
    .rejects.toBeInstanceOf(ValidationError);
  await expect(handler.execute('bad-run-id', { findingId: 'DQ-01:Email', limit: 20 }))
    .rejects.toBeInstanceOf(ValidationError);
  expect(findEvidenceSamples).not.toHaveBeenCalled();
})
