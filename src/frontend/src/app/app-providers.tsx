import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { AuthProvider } from './context/auth-provider'
import type { AppRuntime } from './app-runtime'
import type { AppError } from '../types/api/api.types'

type Props = { queryClient: QueryClient; runtime: AppRuntime | null; configurationError?: Readonly<AppError> | null; children: ReactNode }

export const AppProviders = ({ queryClient, runtime, configurationError, children }: Props) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider runtime={runtime} configurationError={configurationError}>{children}</AuthProvider>
  </QueryClientProvider>
)
