import { createAxiosClient } from '../../lib/axios-client'
import type { postAuthRegisterRequestBody, postAuthForgotPasswordRequestBody, postAuthResetPasswordRequestBody } from '../../types/services-type/auth'

// Public flows never read or send the session's bearer token.
export const createAccountService = () => {
  const api = createAxiosClient()
  return {
    register: (data: postAuthRegisterRequestBody) => api.request({ path: '/auth/register', method: 'POST', auth: 'public', data }),
    forgotPassword: (data: postAuthForgotPasswordRequestBody) => api.request({ path: '/auth/forgot-password', method: 'POST', auth: 'public', data }),
    resetPassword: (data: postAuthResetPasswordRequestBody) => api.request({ path: '/auth/reset-password', method: 'POST', auth: 'public', data }),
  }
}
