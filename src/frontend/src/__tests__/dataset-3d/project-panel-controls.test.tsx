import { fireEvent, render, screen } from '@testing-library/react'
import { useCallback, useState } from 'react'
import { expect, it } from 'vitest'
import { ProjectPanelResize, useProjectPanelMove } from '../../views/processing/project/sections/project-panel-controls'

function PanelFixture() {
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const move = useProjectPanelMove(panel)
  const bindPanel = useCallback((element: HTMLElement | null) => {
    if (element) {
      element.getBoundingClientRect = () => {
        const top = Number.parseFloat(element.parentElement?.style.getPropertyValue('--project-module-top') ?? '') || 20
        return new DOMRect(300, top, 400, 320)
      }
    }
    setPanel(element)
  }, [])

  return <div data-testid="stage" ref={element => {
    if (element) element.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600)
  }}>
    <aside ref={bindPanel}>
      <button type="button" onKeyDown={move?.onKeyDown} onClick={move?.reset}>Đặt lại bảng</button>
      <ProjectPanelResize panel={panel} />
    </aside>
  </div>
}

it('moves and resizes the panel using arrow keys and restores its default geometry', () => {
  render(<PanelFixture />)
  const stage = screen.getByTestId('stage')
  const reset = screen.getByRole('button', { name: 'Đặt lại bảng' })
  const corner = screen.getByRole('button', { name: 'Đổi chiều rộng và chiều cao cửa sổ' })

  fireEvent.keyDown(reset, { key: 'ArrowDown' })
  fireEvent.keyDown(corner, { key: 'ArrowLeft' })

  expect(stage.style.getPropertyValue('--project-module-top')).toBe('44px')
  expect(stage.style.getPropertyValue('--project-module-width')).toBe('424px')

  fireEvent.keyDown(reset, { key: 'Home' })

  expect(stage.style.getPropertyValue('--project-module-top')).toBe('')
  expect(stage.style.getPropertyValue('--project-module-width')).toBe('')
})
