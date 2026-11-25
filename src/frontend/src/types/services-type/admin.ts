/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getAdminEndpointRequest = paths["/api/v1/admin/users"]["get"]
export type getAdminEndpointResponses = getAdminEndpointRequest["responses"]
export type getAdminEndpointResponse200 = NonNullable<getAdminEndpointResponses["200"]>

export type getAdminByIdDetailRequest = paths["/api/v1/admin/users/{id}"]["get"]
export type getAdminByIdDetailParams = getAdminByIdDetailRequest["parameters"]
export type getAdminByIdDetailParamsPath = getAdminByIdDetailParams["path"]
export type getAdminByIdDetailResponses = getAdminByIdDetailRequest["responses"]
export type getAdminByIdDetailResponse200 = NonNullable<getAdminByIdDetailResponses["200"]>
