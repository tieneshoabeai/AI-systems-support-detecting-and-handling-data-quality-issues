import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorModeSelect } from '../../components/appearance/color-mode-select'
import { previewColorKey, usePreviewColorScheme } from '../../hooks/preview/use-preview-color-scheme'

const media = Object.assign(new EventTarget(), { matches: false })
function AppearanceProbe() {
  const appearance = usePreviewColorScheme()
  return <div data-testid="appearance" data-theme={appearance.resolved}><ColorModeSelect appearance={appearance} /></div>
}
beforeEach(() => {
  localStorage.clear()
  media.matches = false
  vi.stubGlobal('matchMedia', () => media)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('follows operating system changes only while system mode is selected', () => {
  localStorage.setItem(previewColorKey, 'system')
  render(<AppearanceProbe />)
  expect(screen.getByTestId('appearance').dataset['theme']).toBe('light')
  act(() => { media.matches = true; media.dispatchEvent(new Event('change')) })
  expect(screen.getByTestId('appearance').dataset['theme']).toBe('dark')
  fireEvent.click(screen.getByRole('radio', { name: 'Sáng' }))
  expect(localStorage.getItem(previewColorKey)).toBe('light')
  act(() => { media.matches = false; media.dispatchEvent(new Event('change')); media.matches = true; media.dispatchEvent(new Event('change')) })
  expect(screen.getByTestId('appearance').dataset['theme']).toBe('light')
  cleanup()
  render(<AppearanceProbe />)
  expect(screen.getByRole('radio', { name: 'Sáng' }).getAttribute('aria-checked')).toBe('true')
})

it('supports arrow-key selection and one tab stop', () => {
  render(<AppearanceProbe />)
  const group = screen.getByRole('radiogroup', { name: 'Chế độ màu' })
  fireEvent.keyDown(group, { key: 'ArrowRight' })
  const system = screen.getByRole('radio', { name: 'Theo hệ thống' })
  expect(system.getAttribute('aria-checked')).toBe('true')
  expect(document.activeElement).toBe(system)
  expect(screen.getAllByRole('radio').filter(item => item.tabIndex === 0)).toHaveLength(1)
})
