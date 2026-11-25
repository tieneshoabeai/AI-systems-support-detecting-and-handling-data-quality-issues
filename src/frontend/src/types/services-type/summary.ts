/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getProjectsByProjectIdSummaryRequest = paths["/api/v1/projects/{projectId}/summary"]["get"]
export type getProjectsByProjectIdSummaryParams = getProjectsByProjectIdSummaryRequest["parameters"]
export type getProjectsByProjectIdSummaryParamsPath = getProjectsByProjectIdSummaryParams["path"]
export type getProjectsByProjectIdSummaryResponses = getProjectsByProjectIdSummaryRequest["responses"]
export type getProjectsByProjectIdSummaryResponse200 = NonNullable<getProjectsByProjectIdSummaryResponses["200"]>

export type postProjectsByProjectIdSummaryRequest = paths["/api/v1/projects/{projectId}/summary"]["post"]
export type postProjectsByProjectIdSummaryParams = postProjectsByProjectIdSummaryRequest["parameters"]
export type postProjectsByProjectIdSummaryParamsPath = postProjectsByProjectIdSummaryParams["path"]
export type postProjectsByProjectIdSummaryResponses = postProjectsByProjectIdSummaryRequest["responses"]
export type postProjectsByProjectIdSummaryResponse201 = NonNullable<postProjectsByProjectIdSummaryResponses["201"]>
