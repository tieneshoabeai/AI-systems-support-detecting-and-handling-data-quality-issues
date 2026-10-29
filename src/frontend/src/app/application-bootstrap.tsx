import App from './App'
import { BrowserRouter } from 'react-router'
import { createAppRuntime } from './app-runtime'
import type { AppRuntime } from './app-runtime'
import { AppProviders } from './app-providers'
import { createQueryClient, clearSessionQueries } from '../lib/query-client'
import { normalizeApiError } from '../lib/api-error'
import type { AppError } from '../types/api/api.types'

// Original application composition, loaded only outside the dev preview.
const queryClient = createQueryClient()
let runtime: AppRuntime | null = null
let configurationError: AppError | null = null
try {
  runtime = createAppRuntime({ clearSessionCache: () => clearSessionQueries(queryClient) })
} catch (error) {
  configurationError = normalizeApiError(error)
}

export const Application = () => <AppProviders runtime={runtime} queryClient={queryClient} configurationError={configurationError}>
  <BrowserRouter><App /></BrowserRouter>
</AppProviders>

if (import.meta.hot) import.meta.hot.dispose(() => { runtime?.dispose(); queryClient.clear() })
