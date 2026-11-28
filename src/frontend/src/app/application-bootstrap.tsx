import App from './App'
import { useEffect } from 'react'
import { BrowserRouter } from 'react-router'
import { createAppRuntime } from './app-runtime'
import type { AppRuntime } from './app-runtime'
import { AppProviders } from './provider'
import { createQueryClient, clearSessionQueries } from '../lib/query-client'
import { normalizeApiError } from '../lib/api-error'
import type { AppError } from '../types'
import '../lib/api-target-hmr'

// Application composition for login and protected production routes.
const queryClient = createQueryClient()
let runtime: AppRuntime | null = null
let configurationError: AppError | null = null
try {
  runtime = createAppRuntime({ clearSessionCache: () => clearSessionQueries(queryClient) })
} catch (error) {
  configurationError = normalizeApiError(error)
}

export const Application = () => {
  useEffect(() => {
    const refreshServerData = () => { void queryClient.invalidateQueries() }
    window.addEventListener('dev-api-target:ready', refreshServerData)
    return () => window.removeEventListener('dev-api-target:ready', refreshServerData)
  }, [])

  return <AppProviders runtime={runtime} queryClient={queryClient} configurationError={configurationError}>
    <BrowserRouter><App /></BrowserRouter>
  </AppProviders>
}

if (import.meta.hot) import.meta.hot.dispose(() => { runtime?.dispose(); queryClient.clear() })
