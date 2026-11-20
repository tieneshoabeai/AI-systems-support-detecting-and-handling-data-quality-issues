import { getApiConfig } from '../../configs/api.config'

const attemptKey = 'dataverse.google-sign-in'
const attemptLifetimeMs = 10 * 60 * 1000

export function startGoogleSignIn(): void {
  const { baseUrl } = getApiConfig()
  window.sessionStorage.setItem(attemptKey, String(Date.now()))
  window.location.assign(`${baseUrl}/auth/google?format=redirect`)
}

export function consumeGoogleCallback() {
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  const fromGoogle = fragment.get('provider') === 'google'
  if (!fromGoogle && !fragment.has('error_description') && !accessToken && !refreshToken) return null

  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  const started = Number(window.sessionStorage.getItem(attemptKey))
  window.sessionStorage.removeItem(attemptKey)
  const age = Date.now() - started
  if (!fromGoogle || !started || age < 0 || age > attemptLifetimeMs || fragment.has('error') || !accessToken || !refreshToken) {
    return { accessToken: '', refreshToken: '' }
  }
  return { accessToken, refreshToken }
}
