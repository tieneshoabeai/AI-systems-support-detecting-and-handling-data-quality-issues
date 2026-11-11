import { defaultAuthenticatedPath, isWorkbenchPath } from '../../services/navigation/application-route'

export const validReturnTarget = (value: unknown): string => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || value.trim() !== value || value.includes('\\')) return defaultAuthenticatedPath
  try {
    const url = new URL(value, 'https://app.invalid')
    // Only registered private pages can become a post-login destination.
    if (url.origin !== 'https://app.invalid'
      || (url.pathname !== '/workspaces' && !isWorkbenchPath(`${url.pathname}${url.search}`))) return defaultAuthenticatedPath
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return defaultAuthenticatedPath }
}
