import { defaultAuthenticatedPath, isWorkbenchPath } from '../../services/navigation'
import { DATASET_3D_PATH, WORKSPACE_PATH } from '../constants'

export const validReturnTarget = (value: unknown): string => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || value.trim() !== value || value.includes('\\')) return defaultAuthenticatedPath
  try {
    const url = new URL(value, 'https://app.invalid')
    // Only registered private pages can become a post-login destination.
    if (url.origin !== 'https://app.invalid'
      || (url.pathname !== WORKSPACE_PATH && url.pathname !== DATASET_3D_PATH
        && !isWorkbenchPath(`${url.pathname}${url.search}`))) return defaultAuthenticatedPath
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return defaultAuthenticatedPath }
}
