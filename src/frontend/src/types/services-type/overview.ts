/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getOverviewUserWorkspacesRequest = paths["/api/v1/overview/workspaces"]["get"]
export type getOverviewUserWorkspacesResponses = getOverviewUserWorkspacesRequest["responses"]
export type getOverviewUserWorkspacesResponse200 = NonNullable<getOverviewUserWorkspacesResponses["200"]>

export type getWorkspacesByIdOverviewRequest = paths["/api/v1/workspaces/{id}/overview"]["get"]
export type getWorkspacesByIdOverviewParams = getWorkspacesByIdOverviewRequest["parameters"]
export type getWorkspacesByIdOverviewParamsPath = getWorkspacesByIdOverviewParams["path"]
export type getWorkspacesByIdOverviewResponses = getWorkspacesByIdOverviewRequest["responses"]
export type getWorkspacesByIdOverviewResponse200 = NonNullable<getWorkspacesByIdOverviewResponses["200"]>
export type getWorkspacesByIdOverviewResponse404 = NonNullable<getWorkspacesByIdOverviewResponses["404"]>
