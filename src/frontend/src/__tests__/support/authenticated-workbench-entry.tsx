import { AuthContext } from '../../hooks/auth/auth-context'
import { WorkbenchEntry } from '../../app/router/workbench-routes'
import type { AuthContextValue } from '../../types/auth/auth-context.types'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

// Routing/theme suites use explicit fixture data. Provider/API behavior has its own suite.
vi.mock('../../views/application/management-data-provider', () => ({
  ManagementDataProvider: ({ children }: { children: ReactNode }) => children,
  ProcessingDataProvider: ({ children }: { children: ReactNode }) => children,
}))

// Explicit session fixture for existing routing/theme tests, never a product bypass.
const routingSession: AuthContextValue = {
  snapshot: {
    phase: 'authenticated', generation: 1, sessionEnded: false,
    accountId: 'routing-test', expiresAtMs: 4_000_000_000_000,
    user: { source: 'login', value: { id: 'routing-test', email: 'routing@example.test', role: 'analyst' } },
    error: null, cleanupError: null,
  },
  configurationError: null,
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve({ serverRevoked: true, revokeError: null, cleanupError: null }),
  confirmRenewal: () => Promise.resolve(),
}

export const AuthenticatedWorkbenchEntry = () => (
  <AuthContext.Provider value={routingSession}><WorkbenchEntry /></AuthContext.Provider>
)
