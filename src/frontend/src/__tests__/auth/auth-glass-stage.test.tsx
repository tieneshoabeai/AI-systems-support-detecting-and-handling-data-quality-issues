import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthGlassStage } from '../../components/graphics/auth-glass/auth-glass.scene'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('mounts the real canvas without reporting failure from its fallback content', () => {
  vi.stubGlobal('WebGL2RenderingContext', class {})
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  const onSceneStatus = vi.fn()

  const { container } = render(<AuthGlassStage onSceneStatus={onSceneStatus} />)

  expect(container.querySelector('canvas > .auth-glass-fallback')).not.toBeNull()
  expect(onSceneStatus).not.toHaveBeenCalled()
})
