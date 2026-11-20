import { expect, test } from '@playwright/test'
import { apiUrl, data, record } from '../support/live-api'

test.describe('Real API prerequisites', () => {
  test('accepts the E2E origin and rejects an unauthenticated profile request', async ({ request, baseURL }) => {
    if (!baseURL) throw new Error('Playwright baseURL is required.')
    const origin = new URL(baseURL).origin
    const health = await request.get(new URL('/health', apiUrl('/')).href, { headers: { Origin: origin } })
    expect(health.status()).toBe(200)
    const status = record(await data(health))
    expect(typeof status['status']).toBe('string')
    const preflight = await request.fetch(apiUrl('/users/me'), {
      method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type' },
    })
    expect(preflight.status()).toBe(204)
    expect(preflight.headers()['access-control-allow-origin']).toBe(origin)
    expect(preflight.headers()['access-control-allow-credentials']).toBe('true')
    expect(preflight.headers()['access-control-allow-headers']?.toLowerCase()).toContain('authorization')
    const anonymous = await request.get(apiUrl('/users/me'), { headers: { Origin: origin } })
    expect(anonymous.status()).toBe(401)
    const rejected = record(await anonymous.json() as unknown)
    expect(rejected['success']).toBe(false)
    expect(record(rejected['error'])['code']).toBe('UNAUTHENTICATED')
  })
})
