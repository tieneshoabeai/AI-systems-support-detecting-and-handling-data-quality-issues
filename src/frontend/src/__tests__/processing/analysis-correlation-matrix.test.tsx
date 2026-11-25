import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { AnalysisCorrelationMatrix } from '../../views/processing/project/sections/analysis-correlation-matrix'

afterEach(cleanup)

it('expands the matrix while preserving the inspected pair and returns focus after Escape', () => {
  const columns = Array.from({ length: 17 }, (_, index) => `Cột ${index + 1}`)
  render(<AnalysisCorrelationMatrix matrix={{ columns, cells: [] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cột tiếp theo' }))
  const expand = screen.getByRole('button', { name: 'Phóng to' })
  fireEvent.click(expand)

  const dialog = screen.getByRole('dialog', { name: 'Ma trận tương quan' })
  expect(within(dialog).getByRole('columnheader', { name: 'Cột 17' })).toBeDefined()
  expect(within(dialog).getByText('Cột 1 / Cột 13')).toBeDefined()
  fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Đóng' }), { key: 'Escape' })

  expect(screen.queryByRole('dialog', { name: 'Ma trận tương quan' })).toBeNull()
  expect(document.activeElement).toBe(expand)
  expect(screen.getByText('Cột 13–17 / 17')).toBeDefined()
})

it('distinguishes signed coefficients, association strength, and missing values', () => {
  render(<AnalysisCorrelationMatrix matrix={{
    columns: ['A', 'B', 'C'],
    cells: [
      { colA: 'A', colB: 'B', kind: 'pearson', coef: -0.82, n: 20 },
      { colA: 'A', colB: 'C', kind: 'cramers_v', coef: 0.82, n: 20 },
      { colA: 'B', colB: 'C', kind: 'eta_squared', coef: null, reason: 'insufficient_pairwise_n_lt_4' },
    ],
  }} />)

  const signed = screen.getByRole('button', { name: /A \/ B:.*Pearson/ })
  const strength = screen.getByRole('button', { name: /A \/ C:.*Cramér/ })
  const missing = screen.getByRole('button', { name: /B \/ C: —/ })
  expect(signed.getAttribute('data-tone')).toBe('negative')
  expect(strength.getAttribute('data-tone')).toBe('strength')
  expect(missing.getAttribute('data-tone')).toBe('missing')

  fireEvent.mouseEnter(missing)
  expect(screen.getByText('Cần ít nhất 4 mẫu hợp lệ.')).toBeDefined()
})

it('moves focus with arrow keys and reaches columns outside the first page', () => {
  const columns = Array.from({ length: 13 }, (_, index) => `Cột ${index + 1}`)
  render(<AnalysisCorrelationMatrix matrix={{ columns, cells: [] }} />)
  const first = screen.getByRole('button', { name: 'Cột 1 / Cột 1: —' })
  first.focus()

  fireEvent.keyDown(first, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cột 1 / Cột 2: —' }))

  fireEvent.click(screen.getByRole('button', { name: 'Cột tiếp theo' }))
  const table = screen.getByRole('table', { name: 'Bảng màu hệ số theo cặp cột' })
  expect(within(table).getByRole('columnheader', { name: 'Cột 13' })).toBeDefined()
})
