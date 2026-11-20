import { createContext } from 'react'

export type ManagementLoading =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; retry?: () => void }

export const ManagementLoadingContext = createContext<ManagementLoading | null>(null)
export const ManagementPersonalLoadingContext = createContext<ManagementLoading | null>(null)
