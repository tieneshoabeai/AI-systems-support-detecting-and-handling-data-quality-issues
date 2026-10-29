export const validReturnTarget = (value: unknown): string => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || value.trim() !== value || value.includes('\\')) return '/workspaces'
  try {
    const url = new URL(value, 'https://app.invalid')
    // Registry hiện chỉ có một private route thật; không nhận arbitrary URL.
    if (url.origin !== 'https://app.invalid' || url.pathname !== '/workspaces') return '/workspaces'
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return '/workspaces' }
}
