import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isShoppingDemo } from '../../mocks/shopping-trends/demo-mode'

let previousUrl: string
beforeEach(() => { previousUrl = window.location.href; sessionStorage.clear(); vi.stubEnv('DEV', true) })
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', previousUrl); sessionStorage.clear() })

it('enables the demo explicitly, remembers it on navigation and turns it off explicitly', () => {
  window.history.replaceState(null, '', '/auth/login?demo=shopping')
  expect(isShoppingDemo()).toBe(true)
  window.history.replaceState(null, '', '/processing')
  expect(isShoppingDemo()).toBe(true)
  window.history.replaceState(null, '', '/processing?demo=off')
  expect(isShoppingDemo()).toBe(false)
  expect(sessionStorage.getItem('shopping-demo.enabled')).toBeNull()
})

it.each(['', '?demo=unknown', '?demo=off'])('does not enable a fresh session for %s', query => {
  window.history.replaceState(null, '', `/auth/login${query}`)
  expect(isShoppingDemo()).toBe(false)
})

it.each([['shopping', true], ['off', false], ['unknown', false]] as const)('uses the explicit %s query when browser storage is blocked', (choice, expected) => {
  window.history.replaceState(null, '', `/auth/login?demo=${choice}`)
  for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('blocked') })
  }
  expect(isShoppingDemo()).toBe(expected)
})

it('does not enable the demo outside development or without a browser', () => {
  window.history.replaceState(null, '', '/auth/login?demo=shopping')
  vi.stubEnv('DEV', false)
  expect(isShoppingDemo()).toBe(false)
  expect(sessionStorage.getItem('shopping-demo.enabled')).toBeNull()
  vi.stubEnv('DEV', true)
  vi.stubGlobal('window', undefined)
  expect(isShoppingDemo()).toBe(false)
})
