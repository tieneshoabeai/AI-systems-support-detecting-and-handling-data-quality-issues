import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { MemoryRouter } from 'react-router'
import { AppProviders } from '../../app/app-providers'
import { createQueryClient } from '../../lib/query-client'
import { ApiError } from '../../lib/api-error'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it('keeps login visible with a clear error and disabled submission when configuration is missing', async () => {
  vi.stubEnv('VITE_API_BASE_URL', undefined)
  render(<AppProviders queryClient={createQueryClient()} runtime={null} configurationError={new ApiError({ kind: 'config', message: 'Missing config' })}>
    <MemoryRouter initialEntries={['/auth/login']}><App /></MemoryRouter>
  </AppProviders>)
  expect((await screen.findByRole('heading', { name: 'Chào mừng trở lại' })).textContent).toBe('Chào mừng trở lại')
  expect(screen.getByRole('alert').textContent).toContain('chưa được cấu hình')
  expect((screen.getByRole('button', { name: 'Đăng nhập' }) as HTMLButtonElement).disabled).toBe(true)
})
