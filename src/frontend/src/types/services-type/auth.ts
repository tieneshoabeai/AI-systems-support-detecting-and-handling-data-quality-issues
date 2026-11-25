/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type postAuthRegisterRequest = paths["/api/v1/auth/register"]["post"]
export type postAuthRegisterRequestBody = NonNullable<postAuthRegisterRequest["requestBody"]>["content"][keyof NonNullable<postAuthRegisterRequest["requestBody"]>["content"]]
export type postAuthRegisterResponses = postAuthRegisterRequest["responses"]
export type postAuthRegisterResponse201 = NonNullable<postAuthRegisterResponses["201"]>
export type postAuthRegisterResponse201Content = NonNullable<postAuthRegisterResponse201["content"]>[keyof NonNullable<postAuthRegisterResponse201["content"]>]
export type postAuthRegisterResponse400 = NonNullable<postAuthRegisterResponses["400"]>
export type postAuthRegisterResponse400Content = NonNullable<postAuthRegisterResponse400["content"]>[keyof NonNullable<postAuthRegisterResponse400["content"]>]
export type postAuthRegisterResponse409 = NonNullable<postAuthRegisterResponses["409"]>
export type postAuthRegisterResponse409Content = NonNullable<postAuthRegisterResponse409["content"]>[keyof NonNullable<postAuthRegisterResponse409["content"]>]
export type postAuthRegisterResponse429 = NonNullable<postAuthRegisterResponses["429"]>
export type postAuthRegisterResponse429Content = NonNullable<postAuthRegisterResponse429["content"]>[keyof NonNullable<postAuthRegisterResponse429["content"]>]

export type postAuthLoginRequest = paths["/api/v1/auth/login"]["post"]
export type postAuthLoginRequestBody = NonNullable<postAuthLoginRequest["requestBody"]>["content"][keyof NonNullable<postAuthLoginRequest["requestBody"]>["content"]]
export type postAuthLoginResponses = postAuthLoginRequest["responses"]
export type postAuthLoginResponse200 = NonNullable<postAuthLoginResponses["200"]>
export type postAuthLoginResponse200Content = NonNullable<postAuthLoginResponse200["content"]>[keyof NonNullable<postAuthLoginResponse200["content"]>]
export type postAuthLoginResponse400 = NonNullable<postAuthLoginResponses["400"]>
export type postAuthLoginResponse400Content = NonNullable<postAuthLoginResponse400["content"]>[keyof NonNullable<postAuthLoginResponse400["content"]>]
export type postAuthLoginResponse401 = NonNullable<postAuthLoginResponses["401"]>
export type postAuthLoginResponse401Content = NonNullable<postAuthLoginResponse401["content"]>[keyof NonNullable<postAuthLoginResponse401["content"]>]
export type postAuthLoginResponse429 = NonNullable<postAuthLoginResponses["429"]>
export type postAuthLoginResponse429Content = NonNullable<postAuthLoginResponse429["content"]>[keyof NonNullable<postAuthLoginResponse429["content"]>]

export type postAuthRefreshRequest = paths["/api/v1/auth/refresh"]["post"]
export type postAuthRefreshRequestBody = NonNullable<postAuthRefreshRequest["requestBody"]>["content"][keyof NonNullable<postAuthRefreshRequest["requestBody"]>["content"]]
export type postAuthRefreshResponses = postAuthRefreshRequest["responses"]
export type postAuthRefreshResponse200 = NonNullable<postAuthRefreshResponses["200"]>
export type postAuthRefreshResponse200Content = NonNullable<postAuthRefreshResponse200["content"]>[keyof NonNullable<postAuthRefreshResponse200["content"]>]
export type postAuthRefreshResponse400 = NonNullable<postAuthRefreshResponses["400"]>
export type postAuthRefreshResponse400Content = NonNullable<postAuthRefreshResponse400["content"]>[keyof NonNullable<postAuthRefreshResponse400["content"]>]
export type postAuthRefreshResponse401 = NonNullable<postAuthRefreshResponses["401"]>
export type postAuthRefreshResponse401Content = NonNullable<postAuthRefreshResponse401["content"]>[keyof NonNullable<postAuthRefreshResponse401["content"]>]
export type postAuthRefreshResponse429 = NonNullable<postAuthRefreshResponses["429"]>
export type postAuthRefreshResponse429Content = NonNullable<postAuthRefreshResponse429["content"]>[keyof NonNullable<postAuthRefreshResponse429["content"]>]

export type postAuthForgotPasswordRequest = paths["/api/v1/auth/forgot-password"]["post"]
export type postAuthForgotPasswordRequestBody = NonNullable<postAuthForgotPasswordRequest["requestBody"]>["content"][keyof NonNullable<postAuthForgotPasswordRequest["requestBody"]>["content"]]
export type postAuthForgotPasswordResponses = postAuthForgotPasswordRequest["responses"]
export type postAuthForgotPasswordResponse200 = NonNullable<postAuthForgotPasswordResponses["200"]>
export type postAuthForgotPasswordResponse200Content = NonNullable<postAuthForgotPasswordResponse200["content"]>[keyof NonNullable<postAuthForgotPasswordResponse200["content"]>]
export type postAuthForgotPasswordResponse400 = NonNullable<postAuthForgotPasswordResponses["400"]>
export type postAuthForgotPasswordResponse400Content = NonNullable<postAuthForgotPasswordResponse400["content"]>[keyof NonNullable<postAuthForgotPasswordResponse400["content"]>]
export type postAuthForgotPasswordResponse429 = NonNullable<postAuthForgotPasswordResponses["429"]>
export type postAuthForgotPasswordResponse429Content = NonNullable<postAuthForgotPasswordResponse429["content"]>[keyof NonNullable<postAuthForgotPasswordResponse429["content"]>]

export type postAuthResetPasswordRequest = paths["/api/v1/auth/reset-password"]["post"]
export type postAuthResetPasswordRequestBody = NonNullable<postAuthResetPasswordRequest["requestBody"]>["content"][keyof NonNullable<postAuthResetPasswordRequest["requestBody"]>["content"]]
export type postAuthResetPasswordResponses = postAuthResetPasswordRequest["responses"]
export type postAuthResetPasswordResponse200 = NonNullable<postAuthResetPasswordResponses["200"]>
export type postAuthResetPasswordResponse200Content = NonNullable<postAuthResetPasswordResponse200["content"]>[keyof NonNullable<postAuthResetPasswordResponse200["content"]>]
export type postAuthResetPasswordResponse400 = NonNullable<postAuthResetPasswordResponses["400"]>
export type postAuthResetPasswordResponse400Content = NonNullable<postAuthResetPasswordResponse400["content"]>[keyof NonNullable<postAuthResetPasswordResponse400["content"]>]
export type postAuthResetPasswordResponse401 = NonNullable<postAuthResetPasswordResponses["401"]>
export type postAuthResetPasswordResponse401Content = NonNullable<postAuthResetPasswordResponse401["content"]>[keyof NonNullable<postAuthResetPasswordResponse401["content"]>]
export type postAuthResetPasswordResponse429 = NonNullable<postAuthResetPasswordResponses["429"]>
export type postAuthResetPasswordResponse429Content = NonNullable<postAuthResetPasswordResponse429["content"]>[keyof NonNullable<postAuthResetPasswordResponse429["content"]>]

export type postAuthChangePasswordRequest = paths["/api/v1/auth/change-password"]["post"]
export type postAuthChangePasswordRequestBody = NonNullable<postAuthChangePasswordRequest["requestBody"]>["content"][keyof NonNullable<postAuthChangePasswordRequest["requestBody"]>["content"]]
export type postAuthChangePasswordResponses = postAuthChangePasswordRequest["responses"]
export type postAuthChangePasswordResponse200 = NonNullable<postAuthChangePasswordResponses["200"]>
export type postAuthChangePasswordResponse200Content = NonNullable<postAuthChangePasswordResponse200["content"]>[keyof NonNullable<postAuthChangePasswordResponse200["content"]>]
export type postAuthChangePasswordResponse400 = NonNullable<postAuthChangePasswordResponses["400"]>
export type postAuthChangePasswordResponse400Content = NonNullable<postAuthChangePasswordResponse400["content"]>[keyof NonNullable<postAuthChangePasswordResponse400["content"]>]
export type postAuthChangePasswordResponse401 = NonNullable<postAuthChangePasswordResponses["401"]>
export type postAuthChangePasswordResponse401Content = NonNullable<postAuthChangePasswordResponse401["content"]>[keyof NonNullable<postAuthChangePasswordResponse401["content"]>]
export type postAuthChangePasswordResponse429 = NonNullable<postAuthChangePasswordResponses["429"]>
export type postAuthChangePasswordResponse429Content = NonNullable<postAuthChangePasswordResponse429["content"]>[keyof NonNullable<postAuthChangePasswordResponse429["content"]>]

export type getAuthGoogleStartRequest = paths["/api/v1/auth/google"]["get"]
export type getAuthGoogleStartResponses = getAuthGoogleStartRequest["responses"]
export type getAuthGoogleStartResponse302 = NonNullable<getAuthGoogleStartResponses["302"]>
export type getAuthGoogleStartResponse429 = NonNullable<getAuthGoogleStartResponses["429"]>
export type getAuthGoogleStartResponse429Content = NonNullable<getAuthGoogleStartResponse429["content"]>[keyof NonNullable<getAuthGoogleStartResponse429["content"]>]
export type getAuthGoogleStartResponse501 = NonNullable<getAuthGoogleStartResponses["501"]>
export type getAuthGoogleStartResponse501Content = NonNullable<getAuthGoogleStartResponse501["content"]>[keyof NonNullable<getAuthGoogleStartResponse501["content"]>]

export type getAuthGoogleCallbackRequest = paths["/api/v1/auth/google/callback"]["get"]
export type getAuthGoogleCallbackResponses = getAuthGoogleCallbackRequest["responses"]
export type getAuthGoogleCallbackResponse200 = NonNullable<getAuthGoogleCallbackResponses["200"]>
export type getAuthGoogleCallbackResponse200Content = NonNullable<getAuthGoogleCallbackResponse200["content"]>[keyof NonNullable<getAuthGoogleCallbackResponse200["content"]>]
export type getAuthGoogleCallbackResponse302 = NonNullable<getAuthGoogleCallbackResponses["302"]>
export type getAuthGoogleCallbackResponse401 = NonNullable<getAuthGoogleCallbackResponses["401"]>
export type getAuthGoogleCallbackResponse401Content = NonNullable<getAuthGoogleCallbackResponse401["content"]>[keyof NonNullable<getAuthGoogleCallbackResponse401["content"]>]
export type getAuthGoogleCallbackResponse403 = NonNullable<getAuthGoogleCallbackResponses["403"]>
export type getAuthGoogleCallbackResponse403Content = NonNullable<getAuthGoogleCallbackResponse403["content"]>[keyof NonNullable<getAuthGoogleCallbackResponse403["content"]>]
export type getAuthGoogleCallbackResponse409 = NonNullable<getAuthGoogleCallbackResponses["409"]>
export type getAuthGoogleCallbackResponse409Content = NonNullable<getAuthGoogleCallbackResponse409["content"]>[keyof NonNullable<getAuthGoogleCallbackResponse409["content"]>]
export type getAuthGoogleCallbackResponse429 = NonNullable<getAuthGoogleCallbackResponses["429"]>
export type getAuthGoogleCallbackResponse429Content = NonNullable<getAuthGoogleCallbackResponse429["content"]>[keyof NonNullable<getAuthGoogleCallbackResponse429["content"]>]
export type getAuthGoogleCallbackResponse501 = NonNullable<getAuthGoogleCallbackResponses["501"]>
export type getAuthGoogleCallbackResponse501Content = NonNullable<getAuthGoogleCallbackResponse501["content"]>[keyof NonNullable<getAuthGoogleCallbackResponse501["content"]>]
export type getAuthGoogleCallbackResponse503 = NonNullable<getAuthGoogleCallbackResponses["503"]>
export type getAuthGoogleCallbackResponse503Content = NonNullable<getAuthGoogleCallbackResponse503["content"]>[keyof NonNullable<getAuthGoogleCallbackResponse503["content"]>]

export type postAuthLogoutRequest = paths["/api/v1/auth/logout"]["post"]
export type postAuthLogoutResponses = postAuthLogoutRequest["responses"]
export type postAuthLogoutResponse200 = NonNullable<postAuthLogoutResponses["200"]>
export type postAuthLogoutResponse200Content = NonNullable<postAuthLogoutResponse200["content"]>[keyof NonNullable<postAuthLogoutResponse200["content"]>]
export type postAuthLogoutResponse401 = NonNullable<postAuthLogoutResponses["401"]>
export type postAuthLogoutResponse401Content = NonNullable<postAuthLogoutResponse401["content"]>[keyof NonNullable<postAuthLogoutResponse401["content"]>]
export type postAuthLogoutResponse429 = NonNullable<postAuthLogoutResponses["429"]>
export type postAuthLogoutResponse429Content = NonNullable<postAuthLogoutResponse429["content"]>[keyof NonNullable<postAuthLogoutResponse429["content"]>]

export type getAuthSessionsRequest = paths["/api/v1/auth/sessions"]["get"]
export type getAuthSessionsResponses = getAuthSessionsRequest["responses"]
export type getAuthSessionsResponse200 = NonNullable<getAuthSessionsResponses["200"]>
export type getAuthSessionsResponse200Content = NonNullable<getAuthSessionsResponse200["content"]>[keyof NonNullable<getAuthSessionsResponse200["content"]>]
export type getAuthSessionsResponse401 = NonNullable<getAuthSessionsResponses["401"]>
export type getAuthSessionsResponse401Content = NonNullable<getAuthSessionsResponse401["content"]>[keyof NonNullable<getAuthSessionsResponse401["content"]>]
export type getAuthSessionsResponse429 = NonNullable<getAuthSessionsResponses["429"]>
export type getAuthSessionsResponse429Content = NonNullable<getAuthSessionsResponse429["content"]>[keyof NonNullable<getAuthSessionsResponse429["content"]>]

export type getAuthCurrentSessionRequest = paths["/api/v1/auth/sessions/me"]["get"]
export type getAuthCurrentSessionResponses = getAuthCurrentSessionRequest["responses"]
export type getAuthCurrentSessionResponse200 = NonNullable<getAuthCurrentSessionResponses["200"]>
export type getAuthCurrentSessionResponse200Content = NonNullable<getAuthCurrentSessionResponse200["content"]>[keyof NonNullable<getAuthCurrentSessionResponse200["content"]>]
export type getAuthCurrentSessionResponse401 = NonNullable<getAuthCurrentSessionResponses["401"]>
export type getAuthCurrentSessionResponse401Content = NonNullable<getAuthCurrentSessionResponse401["content"]>[keyof NonNullable<getAuthCurrentSessionResponse401["content"]>]
export type getAuthCurrentSessionResponse404 = NonNullable<getAuthCurrentSessionResponses["404"]>
export type getAuthCurrentSessionResponse404Content = NonNullable<getAuthCurrentSessionResponse404["content"]>[keyof NonNullable<getAuthCurrentSessionResponse404["content"]>]
export type getAuthCurrentSessionResponse429 = NonNullable<getAuthCurrentSessionResponses["429"]>
export type getAuthCurrentSessionResponse429Content = NonNullable<getAuthCurrentSessionResponse429["content"]>[keyof NonNullable<getAuthCurrentSessionResponse429["content"]>]

export type getAuthByIdRequest = paths["/api/v1/auth/sessions/{id}"]["get"]
export type getAuthByIdParams = getAuthByIdRequest["parameters"]
export type getAuthByIdParamsPath = getAuthByIdParams["path"]
export type getAuthByIdResponses = getAuthByIdRequest["responses"]
export type getAuthByIdResponse200 = NonNullable<getAuthByIdResponses["200"]>
export type getAuthByIdResponse200Content = NonNullable<getAuthByIdResponse200["content"]>[keyof NonNullable<getAuthByIdResponse200["content"]>]
export type getAuthByIdResponse401 = NonNullable<getAuthByIdResponses["401"]>
export type getAuthByIdResponse401Content = NonNullable<getAuthByIdResponse401["content"]>[keyof NonNullable<getAuthByIdResponse401["content"]>]
export type getAuthByIdResponse404 = NonNullable<getAuthByIdResponses["404"]>
export type getAuthByIdResponse404Content = NonNullable<getAuthByIdResponse404["content"]>[keyof NonNullable<getAuthByIdResponse404["content"]>]
export type getAuthByIdResponse429 = NonNullable<getAuthByIdResponses["429"]>
export type getAuthByIdResponse429Content = NonNullable<getAuthByIdResponse429["content"]>[keyof NonNullable<getAuthByIdResponse429["content"]>]

export type deleteAuthByIdRevokeSessionRequest = paths["/api/v1/auth/sessions/{id}"]["delete"]
export type deleteAuthByIdRevokeSessionParams = deleteAuthByIdRevokeSessionRequest["parameters"]
export type deleteAuthByIdRevokeSessionParamsPath = deleteAuthByIdRevokeSessionParams["path"]
export type deleteAuthByIdRevokeSessionResponses = deleteAuthByIdRevokeSessionRequest["responses"]
export type deleteAuthByIdRevokeSessionResponse200 = NonNullable<deleteAuthByIdRevokeSessionResponses["200"]>
export type deleteAuthByIdRevokeSessionResponse200Content = NonNullable<deleteAuthByIdRevokeSessionResponse200["content"]>[keyof NonNullable<deleteAuthByIdRevokeSessionResponse200["content"]>]
export type deleteAuthByIdRevokeSessionResponse400 = NonNullable<deleteAuthByIdRevokeSessionResponses["400"]>
export type deleteAuthByIdRevokeSessionResponse400Content = NonNullable<deleteAuthByIdRevokeSessionResponse400["content"]>[keyof NonNullable<deleteAuthByIdRevokeSessionResponse400["content"]>]
export type deleteAuthByIdRevokeSessionResponse401 = NonNullable<deleteAuthByIdRevokeSessionResponses["401"]>
export type deleteAuthByIdRevokeSessionResponse401Content = NonNullable<deleteAuthByIdRevokeSessionResponse401["content"]>[keyof NonNullable<deleteAuthByIdRevokeSessionResponse401["content"]>]
export type deleteAuthByIdRevokeSessionResponse429 = NonNullable<deleteAuthByIdRevokeSessionResponses["429"]>
export type deleteAuthByIdRevokeSessionResponse429Content = NonNullable<deleteAuthByIdRevokeSessionResponse429["content"]>[keyof NonNullable<deleteAuthByIdRevokeSessionResponse429["content"]>]
