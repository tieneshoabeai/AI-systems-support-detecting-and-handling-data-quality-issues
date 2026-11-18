/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type postAuthRegisterRequest = paths["/api/v1/auth/register"]["post"]
export type postAuthRegisterRequestBody = NonNullable<postAuthRegisterRequest["requestBody"]>["content"][keyof NonNullable<postAuthRegisterRequest["requestBody"]>["content"]]
export type postAuthRegisterResponses = postAuthRegisterRequest["responses"]
export type postAuthRegisterResponse201 = NonNullable<postAuthRegisterResponses["201"]>

export type postAuthLoginRequest = paths["/api/v1/auth/login"]["post"]
export type postAuthLoginRequestBody = NonNullable<postAuthLoginRequest["requestBody"]>["content"][keyof NonNullable<postAuthLoginRequest["requestBody"]>["content"]]
export type postAuthLoginResponses = postAuthLoginRequest["responses"]
export type postAuthLoginResponse200 = NonNullable<postAuthLoginResponses["200"]>

export type postAuthRefreshRequest = paths["/api/v1/auth/refresh"]["post"]
export type postAuthRefreshRequestBody = NonNullable<postAuthRefreshRequest["requestBody"]>["content"][keyof NonNullable<postAuthRefreshRequest["requestBody"]>["content"]]
export type postAuthRefreshResponses = postAuthRefreshRequest["responses"]
export type postAuthRefreshResponse200 = NonNullable<postAuthRefreshResponses["200"]>

export type postAuthForgotPasswordRequest = paths["/api/v1/auth/forgot-password"]["post"]
export type postAuthForgotPasswordRequestBody = NonNullable<postAuthForgotPasswordRequest["requestBody"]>["content"][keyof NonNullable<postAuthForgotPasswordRequest["requestBody"]>["content"]]
export type postAuthForgotPasswordResponses = postAuthForgotPasswordRequest["responses"]
export type postAuthForgotPasswordResponse200 = NonNullable<postAuthForgotPasswordResponses["200"]>

export type postAuthResetPasswordRequest = paths["/api/v1/auth/reset-password"]["post"]
export type postAuthResetPasswordRequestBody = NonNullable<postAuthResetPasswordRequest["requestBody"]>["content"][keyof NonNullable<postAuthResetPasswordRequest["requestBody"]>["content"]]
export type postAuthResetPasswordResponses = postAuthResetPasswordRequest["responses"]
export type postAuthResetPasswordResponse200 = NonNullable<postAuthResetPasswordResponses["200"]>

export type postAuthChangePasswordRequest = paths["/api/v1/auth/change-password"]["post"]
export type postAuthChangePasswordRequestBody = NonNullable<postAuthChangePasswordRequest["requestBody"]>["content"][keyof NonNullable<postAuthChangePasswordRequest["requestBody"]>["content"]]
export type postAuthChangePasswordResponses = postAuthChangePasswordRequest["responses"]
export type postAuthChangePasswordResponse200 = NonNullable<postAuthChangePasswordResponses["200"]>

export type getAuthGoogleStartRequest = paths["/api/v1/auth/google"]["get"]
export type getAuthGoogleStartResponses = getAuthGoogleStartRequest["responses"]
export type getAuthGoogleStartResponse302 = NonNullable<getAuthGoogleStartResponses["302"]>
export type getAuthGoogleStartResponse501 = NonNullable<getAuthGoogleStartResponses["501"]>

export type getAuthGoogleCallbackRequest = paths["/api/v1/auth/google/callback"]["get"]
export type getAuthGoogleCallbackResponses = getAuthGoogleCallbackRequest["responses"]
export type getAuthGoogleCallbackResponse200 = NonNullable<getAuthGoogleCallbackResponses["200"]>
export type getAuthGoogleCallbackResponse401 = NonNullable<getAuthGoogleCallbackResponses["401"]>
export type getAuthGoogleCallbackResponse409 = NonNullable<getAuthGoogleCallbackResponses["409"]>

export type postAuthLogoutRequest = paths["/api/v1/auth/logout"]["post"]
export type postAuthLogoutResponses = postAuthLogoutRequest["responses"]
export type postAuthLogoutResponse200 = NonNullable<postAuthLogoutResponses["200"]>

export type getAuthSessionsRequest = paths["/api/v1/auth/sessions"]["get"]
export type getAuthSessionsResponses = getAuthSessionsRequest["responses"]
export type getAuthSessionsResponse200 = NonNullable<getAuthSessionsResponses["200"]>

export type getAuthByIdRequest = paths["/api/v1/auth/sessions/{id}"]["get"]
export type getAuthByIdParams = getAuthByIdRequest["parameters"]
export type getAuthByIdParamsPath = getAuthByIdParams["path"]
export type getAuthByIdResponses = getAuthByIdRequest["responses"]
export type getAuthByIdResponse200 = NonNullable<getAuthByIdResponses["200"]>
export type getAuthByIdResponse404 = NonNullable<getAuthByIdResponses["404"]>

export type deleteAuthByIdRevokeSessionRequest = paths["/api/v1/auth/sessions/{id}"]["delete"]
export type deleteAuthByIdRevokeSessionParams = deleteAuthByIdRevokeSessionRequest["parameters"]
export type deleteAuthByIdRevokeSessionParamsPath = deleteAuthByIdRevokeSessionParams["path"]
export type deleteAuthByIdRevokeSessionResponses = deleteAuthByIdRevokeSessionRequest["responses"]
export type deleteAuthByIdRevokeSessionResponse200 = NonNullable<deleteAuthByIdRevokeSessionResponses["200"]>
