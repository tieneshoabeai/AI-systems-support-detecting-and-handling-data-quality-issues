import { useState } from 'react'
import { normalizeApiError } from '../../lib/api-error'
import { useAuth } from './use-auth'

export const useLogin = () => {
  const { snapshot, signIn, signOut, configurationError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = snapshot.phase === 'signing-in'
  const submit = async () => {
    if (pending || configurationError || snapshot.cleanupError) return
    setError(null)
    try { await signIn({ email, password, ...(rememberMe ? { remember_me: true } : {}) }) } catch (failure) { setError(normalizeApiError(failure).message) }
  }
  return { email, setEmail, password, setPassword, rememberMe, setRememberMe, submit, pending, signOut, configurationError,
    cleanupError: snapshot.cleanupError, error: error ?? snapshot.error?.message ?? null }
}
