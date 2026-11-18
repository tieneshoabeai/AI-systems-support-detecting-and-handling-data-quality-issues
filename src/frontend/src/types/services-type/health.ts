/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getHealthEndpointRequest = paths["/health"]["get"]
export type getHealthEndpointResponses = getHealthEndpointRequest["responses"]
export type getHealthEndpointResponse200 = NonNullable<getHealthEndpointResponses["200"]>

export type getHealthReadyRequest = paths["/health/ready"]["get"]
export type getHealthReadyResponses = getHealthReadyRequest["responses"]
export type getHealthReadyResponse200 = NonNullable<getHealthReadyResponses["200"]>
export type getHealthReadyResponse503 = NonNullable<getHealthReadyResponses["503"]>
