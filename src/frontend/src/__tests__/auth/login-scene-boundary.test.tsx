import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LoginSceneBoundary } from '../../views/auth/login/sections/login-scene-boundary'

afterEach(cleanup)

it('renders healthy scene content without reporting a failure', () => {
  const onFailure = vi.fn()
  render(<LoginSceneBoundary onFailure={onFailure}><p>Scene ready</p></LoginSceneBoundary>)
  expect(screen.getByText('Scene ready')).toBeDefined()
  expect(onFailure).not.toHaveBeenCalled()
})

it('removes a failed scene, reports the failure and preserves the surrounding login UI', () => {
  function BrokenScene(): never { throw new Error('Scene failed') }
  const onFailure = vi.fn()
  // React reports caught render errors; silence only this intentional failure.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const view = render(<><button>Đăng nhập</button><LoginSceneBoundary onFailure={onFailure}><p>Scene ready</p></LoginSceneBoundary></>)
  expect(screen.getByText('Scene ready')).toBeDefined()
  view.rerender(<><button>Đăng nhập</button><LoginSceneBoundary onFailure={onFailure}><BrokenScene /></LoginSceneBoundary></>)
  expect(onFailure).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeDefined()
  expect(screen.queryByText('Scene ready')).toBeNull()
})
