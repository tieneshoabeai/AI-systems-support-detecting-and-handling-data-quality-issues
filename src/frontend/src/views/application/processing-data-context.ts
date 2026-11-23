import { createContext } from 'react'

export const ProcessingDataContext = createContext<{ loading: boolean; error?: string; missing?: boolean; retry: () => void } | null>(null)
