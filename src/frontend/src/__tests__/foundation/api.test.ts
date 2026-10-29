import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { composeApiConfig, getApiConfig, parseApiConfig } from '../../configs/api.config'
import { normalizeApiError } from '../../lib/api-error'
import { createAxiosClient } from '../../lib/axios-client'

const baseUrl = 'http://localhost:3000/api/v1'
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config,
})

afterEach(() => vi.unstubAllEnvs())

describe('API configuration', () => {
  it.each(['api/v1', '/api/v1', '/api/v1/'])('composes a separate prefix %s', prefix => {
    expect(composeApiConfig('http://localhost:3000/', prefix)).toEqual({
      baseUrl, timeoutMs: 30_000,
    })
  })

  it.each([undefined, '', '/', '//evil.example', 'https://evil.example', '../api',
    '/api//v1', '/api?x=1', '/api#x', '/%2e%2e/api', '/docs']) (
    'rejects an invalid separate prefix %s', prefix => {
      expect(() => composeApiConfig('http://localhost:3000', prefix)).toThrow()
    },
  )

  it('rejects a base URL that already includes a path', () => {
    expect(() => composeApiConfig(baseUrl, '/api/v1')).toThrow('VITE_API_BASE_URL')
  })

  it('uses both env variables when creating the client', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000')
    vi.stubEnv('VITE_API_PREFIX', '/api/v1')
    const adapter: AxiosAdapter = async config => {
      expect(config.url).toBe(`${baseUrl}/health`)
      return response(config, { success: true, data: true })
    }
    await expect(createAxiosClient({ adapter }).request({ path: '/health', auth: 'public' }))
      .resolves.toBe(true)
  })

  it('preserves the API prefix and uses 30 seconds', () => {
    expect(parseApiConfig(`${baseUrl}/`)).toEqual({ baseUrl, timeoutMs: 30_000 })
  })

  it.each([undefined, '', 'abc', 'ftp://example.com', `${baseUrl}/docs`,
    'https://user:secret@example.com', `${baseUrl}?key=secret`, `${baseUrl}#x`])(
    'rejects invalid configuration without echoing its value: %s', value => {
      expect(() => parseApiConfig(value)).toThrow('VITE_API_BASE_URL')
      try { parseApiConfig(value) } catch (error) {
        expect(String(error)).not.toContain('secret')
      }
    },
  )

  it('only fails when configuration is requested', () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined)
    expect(typeof createAxiosClient).toBe('function')
    expect(() => getApiConfig()).toThrow('VITE_API_BASE_URL')
    expect(() => createAxiosClient()).toThrow('VITE_API_BASE_URL')
  })
})

describe('Axios client', () => {
  it('keeps the prefix, unwraps once and does not read a public request token', async () => {
    const readToken = vi.fn(() => 'secret')
    const adapter = vi.fn<AxiosAdapter>(async config => {
      expect(config.url).toBe(`${baseUrl}/health`)
      expect(config.timeout).toBe(5_000)
      expect(config.headers.get('Authorization')).toBeUndefined()
      return response(config, { success: true, data: { data: 0 } })
    })
    const client = createAxiosClient({ baseUrl, readToken, adapter })
    await expect(client.request({ path: '/health', auth: 'public', timeoutMs: 5_000 }))
      .resolves.toEqual({ data: 0 })
    expect(readToken).not.toHaveBeenCalled()
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('reads the current token on every session request', async () => {
    let token = 'first'
    const headers: unknown[] = []
    const adapter: AxiosAdapter = async config => {
      headers.push(config.headers.get('Authorization'))
      expect(config.timeout).toBe(30_000)
      return response(config, { success: true, data: null })
    }
    const client = createAxiosClient({ baseUrl, readToken: () => token, adapter })
    await client.request({ path: 'user/me', auth: 'session' })
    token = 'second'
    await client.request({ path: 'user/me', auth: 'session' })
    expect(headers).toEqual(['Bearer first', 'Bearer second'])
  })

  it('stops a session request without a token before transport', async () => {
    const adapter = vi.fn<AxiosAdapter>()
    const client = createAxiosClient({ baseUrl, adapter })
    await expect(client.request({ path: 'user/me', auth: 'session' }))
      .rejects.toMatchObject({ kind: 'session' })
    expect(adapter).not.toHaveBeenCalled()
  })

  it.each(['https://other.example/x', '//other.example/x', '../auth', '/../../auth', '\\evil', '']) (
    'rejects a path outside the API prefix: %s', async path => {
      const adapter = vi.fn<AxiosAdapter>()
      const readToken = vi.fn(() => 'secret')
      const client = createAxiosClient({ baseUrl, adapter, readToken })
      await expect(client.request({ path, auth: 'session' })).rejects.toMatchObject({ kind: 'config' })
      expect(adapter).not.toHaveBeenCalled()
      expect(readToken).not.toHaveBeenCalled()
    },
  )

  it.each([0, -1, Infinity, NaN])('rejects invalid timeout %s', async timeoutMs => {
    const adapter = vi.fn<AxiosAdapter>()
    const client = createAxiosClient({ baseUrl, adapter })
    await expect(client.request({ path: 'health', auth: 'public', timeoutMs }))
      .rejects.toMatchObject({ kind: 'config' })
    expect(adapter).not.toHaveBeenCalled()
  })

  it.each([null, false, 0])('accepts a valid envelope containing %s', async data => {
    const adapter: AxiosAdapter = async config => response(config, { success: true, data })
    await expect(createAxiosClient({ baseUrl, adapter }).request({ path: 'health', auth: 'public' }))
      .resolves.toBe(data)
  })

  it.each([null, {}, { success: true }, { success: false, data: 1 },
    { success: true, data: 1, meta: [] }])('rejects malformed envelopes', async data => {
    const adapter: AxiosAdapter = async config => response(config, data)
    await expect(createAxiosClient({ baseUrl, adapter }).request({ path: 'health', auth: 'public' }))
      .rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('does not retry a timed out write', async () => {
    const adapter = vi.fn<AxiosAdapter>(async () => { throw new AxiosError('raw secret', 'ECONNABORTED') })
    await expect(createAxiosClient({ baseUrl, adapter }).request({
      path: 'datasets', method: 'POST', auth: 'public', data: { example: true },
    })).rejects.toMatchObject({ kind: 'timeout' })
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('stops an already cancelled request before transport', async () => {
    const adapter = vi.fn<AxiosAdapter>()
    const controller = new AbortController()
    controller.abort()
    await expect(createAxiosClient({ baseUrl, adapter }).request({
      path: 'health', auth: 'public', signal: controller.signal,
    })).rejects.toMatchObject({ kind: 'cancelled' })
    expect(adapter).not.toHaveBeenCalled()
  })
})

describe('error normalization', () => {
  it('distinguishes cancellation and network failures', () => {
    expect(normalizeApiError(new CanceledError())).toMatchObject({ kind: 'cancelled' })
    expect(normalizeApiError(new AxiosError('secret', 'ERR_NETWORK'))).toMatchObject({ kind: 'network' })
  })

  it.each([400, 401, 403, 500])('preserves HTTP status %s without retaining raw config', status => {
    const config = { headers: new AxiosHeaders({ Authorization: 'Bearer secret' }) }
    const error = new AxiosError('raw secret', undefined, config, undefined, {
      ...response(config, { success: false, error: { code: 'ERROR', message: 'server detail' } }), status,
    })
    const normalized = normalizeApiError(error)
    expect(normalized).toMatchObject({ kind: 'http', status })
    expect(normalized).not.toHaveProperty('config')
    expect(normalized).not.toHaveProperty('cause')
    expect(JSON.stringify(normalized)).not.toContain('secret')
    expect(normalized.fieldErrors).toBeUndefined()
    if (status === 500) expect(normalized.message).not.toContain('server detail')
  })
})
