import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeGoogleCallback } from '../../services/auth/google-sign-in'

afterEach(() => {
  window.history.replaceState({}, '', '/')
  window.sessionStorage.removeItem('dataverse.google-sign-in')
  vi.restoreAllMocks()
})

describe('Google callback credentials', () => {
  it('ignores an unrelated fragment', () => {
    window.history.replaceState({}, '', '/auth/login#section')
    expect(consumeGoogleCallback()).toBeNull()
    expect(window.location.hash).toBe('#section')
  })

  it('consumes a recent attempt once and removes credentials from the URL', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100_000)
    window.sessionStorage.setItem('dataverse.google-sign-in', '99000')
    window.history.replaceState({}, '', '/auth/login?returnTo=%2Fmanagement#provider=google&access_token=test-access&refresh_token=test-refresh')
    expect(consumeGoogleCallback()).toEqual({ accessToken: 'test-access', refreshToken: 'test-refresh' })
    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('?returnTo=%2Fmanagement')
    expect(window.sessionStorage.getItem('dataverse.google-sign-in')).toBeNull()
    expect(consumeGoogleCallback()).toBeNull()
  })

  it.each([null, '1', '999999999'])('rejects an unsolicited or expired attempt: %s', started => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    if (started) window.sessionStorage.setItem('dataverse.google-sign-in', started)
    window.history.replaceState({}, '', '/auth/login#provider=google&access_token=test-access&refresh_token=test-refresh')
    expect(consumeGoogleCallback()).toEqual({ accessToken: '', refreshToken: '' })
    expect(window.location.hash).toBe('')
  })
})
