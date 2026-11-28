import { expect, it, vi } from 'vitest'
import { createAnalysisService } from '../../services/processing/analysis.service'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'

it('parses the evidence endpoint request into the generated API route, scoped query and session auth', async () => {
  const request = vi.fn(async (_options: ApiRequestOptions) => ({
    items: [],
    meta: { limit: 10, hasMore: false, nextCursor: null },
  }))
  const service = createAnalysisService({ request } as ApiClient)
  await service.listEvidenceSamples('run/id', {
    findingId: 'DQ-01:Email address',
    kind: 'missing',
    column: 'Email address',
    limit: 10,
    cursor: 'cursor-1',
  })

  expect(request).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    path: '/analyses/run%2Fid/evidence-samples',
    auth: 'session',
    params: {
      findingId: 'DQ-01:Email address',
      kind: 'missing',
      column: 'Email address',
      limit: 10,
      cursor: 'cursor-1',
    },
  }))
})
