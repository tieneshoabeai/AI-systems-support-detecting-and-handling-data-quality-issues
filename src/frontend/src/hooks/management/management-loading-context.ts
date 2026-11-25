import { createContext } from 'react'
import type { WorkspaceOverview } from '../../services/management/management.types'

export type ManagementLoading =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; retry?: () => void }

export const ManagementLoadingContext = createContext<ManagementLoading | null>(null)
export const ManagementPersonalLoadingContext = createContext<ManagementLoading | null>(null)
export const ManagementOverviewLoaderContext = createContext<(() => Promise<WorkspaceOverview>) | undefined>(undefined)
