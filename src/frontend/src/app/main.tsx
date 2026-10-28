import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router'
import { createAppRuntime } from './app-runtime'
import type { AppRuntime } from './app-runtime'
import { AppProviders } from './app-providers'
import { createQueryClient, clearSessionQueries } from '../lib/query-client'
import { normalizeApiError } from '../lib/api-error'
import type { AppError } from '../types/api/api.types'
import './design-tokens.css'
import './style.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Không tìm thấy phần tử #root để khởi tạo ứng dụng')
}

const queryClient = createQueryClient()
let runtime: AppRuntime | null = null
let configurationError: AppError | null = null
try {
  runtime = createAppRuntime({ clearSessionCache: () => clearSessionQueries(queryClient) })
} catch (error) {
  configurationError = normalizeApiError(error)
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders runtime={runtime} queryClient={queryClient} configurationError={configurationError}>
      <BrowserRouter><App /></BrowserRouter>
    </AppProviders>
  </React.StrictMode>,
)

if (import.meta.hot) import.meta.hot.dispose(() => { runtime?.dispose(); queryClient.clear() })
