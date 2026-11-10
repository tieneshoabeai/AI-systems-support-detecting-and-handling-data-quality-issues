import { createContext } from 'react'
import type { AuthContextValue } from '../../types/auth/auth-context.types'

export const AuthContext = createContext<AuthContextValue | null>(null)
