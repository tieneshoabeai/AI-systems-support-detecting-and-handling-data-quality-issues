import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Dataset3DView } from '../../views/dataset-3d/dataset-3d.view'
import type { CubeFocus, NeonCubeThemeId } from '../../types/dataset-3d/cube-focus.types'

vi.mock('../../components/graphics/holographic-core/holographic-core.scene', () => ({
  HolographicCoreCanvas: ({ cubeFocus, onFocusCube, colorMode }: {
    cubeFocus: CubeFocus | null; onFocusCube: (theme: NeonCubeThemeId) => void; colorMode: string
  }) => <div data-testid="canvas" data-focus={cubeFocus?.theme} data-theme={colorMode}>
    <button onClick={() => onFocusCube('cyan')}>Cube cyan</button>
  </div>,
}))

beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} })))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('shares focus events, blocks cube focus while detached, and updates theme without remounting', () => {
  const onFocusChange = vi.fn()
  const onDetachedChange = vi.fn()
  const props = { embedded: true, onFocusChange, onDetachedChange }
  const view = render(<Dataset3DView {...props} focus={{ theme: 'blue' }} colorMode="dark" />)
  const canvas = screen.getByTestId('canvas')
  expect(canvas.getAttribute('data-focus')).toBe('blue')
  fireEvent.click(screen.getByText('Cube cyan'))
  expect(onFocusChange).toHaveBeenLastCalledWith({ theme: 'cyan' })
  view.rerender(<Dataset3DView {...props} focus={{ theme: 'cyan' }} colorMode="light" />)
  expect(screen.getByTestId('canvas')).toBe(canvas)
  expect(canvas.getAttribute('data-theme')).toBe('light')
  expect(canvas.getAttribute('data-focus')).toBe('cyan')
  fireEvent.click(screen.getByText('Về góc tổng quan'))
  expect(onFocusChange).toHaveBeenLastCalledWith(null)
  fireEvent.click(screen.getByText('Tách mô hình'))
  expect(onDetachedChange).toHaveBeenLastCalledWith(true)
  onFocusChange.mockClear()
  fireEvent.click(screen.getByText('Cube cyan'))
  expect(onFocusChange).not.toHaveBeenCalled()
})
