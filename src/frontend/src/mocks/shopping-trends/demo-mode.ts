export const isShoppingDemo = (): boolean => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  const choice = new URLSearchParams(window.location.search).get('demo')
  try {
    if (choice === 'shopping') window.sessionStorage.setItem('shopping-demo.enabled', '1')
    if (choice === 'off') window.sessionStorage.removeItem('shopping-demo.enabled')
    return window.sessionStorage.getItem('shopping-demo.enabled') === '1'
  } catch { return choice === 'shopping' }
}
