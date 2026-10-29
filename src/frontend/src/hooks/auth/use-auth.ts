import { useContext } from 'react'
import { AuthContext } from '../../app/context/auth-context'

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth phải được gọi bên trong AuthProvider.')
  return context
}
