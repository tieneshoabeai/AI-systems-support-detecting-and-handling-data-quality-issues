/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getUsersProfileRequest = paths["/api/v1/users/me"]["get"]
export type getUsersProfileResponses = getUsersProfileRequest["responses"]
export type getUsersProfileResponse200 = NonNullable<getUsersProfileResponses["200"]>

export type patchUsersProfileRequest = paths["/api/v1/users/me"]["patch"]
export type patchUsersProfileRequestBody = NonNullable<patchUsersProfileRequest["requestBody"]>["content"][keyof NonNullable<patchUsersProfileRequest["requestBody"]>["content"]]
export type patchUsersProfileResponses = patchUsersProfileRequest["responses"]
export type patchUsersProfileResponse200 = NonNullable<patchUsersProfileResponses["200"]>

export type deleteUsersAccountRequest = paths["/api/v1/users/me"]["delete"]
export type deleteUsersAccountResponses = deleteUsersAccountRequest["responses"]
export type deleteUsersAccountResponse200 = NonNullable<deleteUsersAccountResponses["200"]>
