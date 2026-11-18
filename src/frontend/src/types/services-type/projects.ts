/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getWorkspacesByWorkspaceIdByWorkspaceRequest = paths["/api/v1/workspaces/{workspaceId}/projects"]["get"]
export type getWorkspacesByWorkspaceIdByWorkspaceParams = getWorkspacesByWorkspaceIdByWorkspaceRequest["parameters"]
export type getWorkspacesByWorkspaceIdByWorkspaceParamsQuery = getWorkspacesByWorkspaceIdByWorkspaceParams["query"]
export type getWorkspacesByWorkspaceIdByWorkspaceParamsPath = getWorkspacesByWorkspaceIdByWorkspaceParams["path"]
export type getWorkspacesByWorkspaceIdByWorkspaceResponses = getWorkspacesByWorkspaceIdByWorkspaceRequest["responses"]
export type getWorkspacesByWorkspaceIdByWorkspaceResponse200 = NonNullable<getWorkspacesByWorkspaceIdByWorkspaceResponses["200"]>

export type postWorkspacesByWorkspaceIdProjectRequest = paths["/api/v1/workspaces/{workspaceId}/projects"]["post"]
export type postWorkspacesByWorkspaceIdProjectParams = postWorkspacesByWorkspaceIdProjectRequest["parameters"]
export type postWorkspacesByWorkspaceIdProjectParamsPath = postWorkspacesByWorkspaceIdProjectParams["path"]
export type postWorkspacesByWorkspaceIdProjectRequestBody = NonNullable<postWorkspacesByWorkspaceIdProjectRequest["requestBody"]>["content"][keyof NonNullable<postWorkspacesByWorkspaceIdProjectRequest["requestBody"]>["content"]]
export type postWorkspacesByWorkspaceIdProjectResponses = postWorkspacesByWorkspaceIdProjectRequest["responses"]
export type postWorkspacesByWorkspaceIdProjectResponse201 = NonNullable<postWorkspacesByWorkspaceIdProjectResponses["201"]>

export type getProjectsByIdRequest = paths["/api/v1/projects/{id}"]["get"]
export type getProjectsByIdParams = getProjectsByIdRequest["parameters"]
export type getProjectsByIdParamsPath = getProjectsByIdParams["path"]
export type getProjectsByIdResponses = getProjectsByIdRequest["responses"]
export type getProjectsByIdResponse200 = NonNullable<getProjectsByIdResponses["200"]>

export type patchProjectsByIdProjectRequest = paths["/api/v1/projects/{id}"]["patch"]
export type patchProjectsByIdProjectParams = patchProjectsByIdProjectRequest["parameters"]
export type patchProjectsByIdProjectParamsPath = patchProjectsByIdProjectParams["path"]
export type patchProjectsByIdProjectRequestBody = NonNullable<patchProjectsByIdProjectRequest["requestBody"]>["content"][keyof NonNullable<patchProjectsByIdProjectRequest["requestBody"]>["content"]]
export type patchProjectsByIdProjectResponses = patchProjectsByIdProjectRequest["responses"]
export type patchProjectsByIdProjectResponse200 = NonNullable<patchProjectsByIdProjectResponses["200"]>

export type deleteProjectsByIdProjectRequest = paths["/api/v1/projects/{id}"]["delete"]
export type deleteProjectsByIdProjectParams = deleteProjectsByIdProjectRequest["parameters"]
export type deleteProjectsByIdProjectParamsPath = deleteProjectsByIdProjectParams["path"]
export type deleteProjectsByIdProjectResponses = deleteProjectsByIdProjectRequest["responses"]
export type deleteProjectsByIdProjectResponse204 = NonNullable<deleteProjectsByIdProjectResponses["204"]>

export type putProjectsByIdMarkCompletedRequest = paths["/api/v1/projects/{id}/snapshot"]["put"]
export type putProjectsByIdMarkCompletedParams = putProjectsByIdMarkCompletedRequest["parameters"]
export type putProjectsByIdMarkCompletedParamsPath = putProjectsByIdMarkCompletedParams["path"]
export type putProjectsByIdMarkCompletedRequestBody = NonNullable<putProjectsByIdMarkCompletedRequest["requestBody"]>["content"][keyof NonNullable<putProjectsByIdMarkCompletedRequest["requestBody"]>["content"]]
export type putProjectsByIdMarkCompletedResponses = putProjectsByIdMarkCompletedRequest["responses"]
export type putProjectsByIdMarkCompletedResponse200 = NonNullable<putProjectsByIdMarkCompletedResponses["200"]>

export type getProjectsByIdMembersRequest = paths["/api/v1/projects/{id}/members"]["get"]
export type getProjectsByIdMembersParams = getProjectsByIdMembersRequest["parameters"]
export type getProjectsByIdMembersParamsQuery = getProjectsByIdMembersParams["query"]
export type getProjectsByIdMembersParamsPath = getProjectsByIdMembersParams["path"]
export type getProjectsByIdMembersResponses = getProjectsByIdMembersRequest["responses"]
export type getProjectsByIdMembersResponse200 = NonNullable<getProjectsByIdMembersResponses["200"]>

export type postProjectsByIdMemberRequest = paths["/api/v1/projects/{id}/members"]["post"]
export type postProjectsByIdMemberParams = postProjectsByIdMemberRequest["parameters"]
export type postProjectsByIdMemberParamsPath = postProjectsByIdMemberParams["path"]
export type postProjectsByIdMemberRequestBody = NonNullable<postProjectsByIdMemberRequest["requestBody"]>["content"][keyof NonNullable<postProjectsByIdMemberRequest["requestBody"]>["content"]]
export type postProjectsByIdMemberResponses = postProjectsByIdMemberRequest["responses"]
export type postProjectsByIdMemberResponse201 = NonNullable<postProjectsByIdMemberResponses["201"]>

export type patchProjectsByIdAndUserIdMemberRequest = paths["/api/v1/projects/{id}/members/{userId}"]["patch"]
export type patchProjectsByIdAndUserIdMemberParams = patchProjectsByIdAndUserIdMemberRequest["parameters"]
export type patchProjectsByIdAndUserIdMemberParamsPath = patchProjectsByIdAndUserIdMemberParams["path"]
export type patchProjectsByIdAndUserIdMemberRequestBody = NonNullable<patchProjectsByIdAndUserIdMemberRequest["requestBody"]>["content"][keyof NonNullable<patchProjectsByIdAndUserIdMemberRequest["requestBody"]>["content"]]
export type patchProjectsByIdAndUserIdMemberResponses = patchProjectsByIdAndUserIdMemberRequest["responses"]
export type patchProjectsByIdAndUserIdMemberResponse200 = NonNullable<patchProjectsByIdAndUserIdMemberResponses["200"]>

export type deleteProjectsByIdAndUserIdMemberRequest = paths["/api/v1/projects/{id}/members/{userId}"]["delete"]
export type deleteProjectsByIdAndUserIdMemberParams = deleteProjectsByIdAndUserIdMemberRequest["parameters"]
export type deleteProjectsByIdAndUserIdMemberParamsPath = deleteProjectsByIdAndUserIdMemberParams["path"]
export type deleteProjectsByIdAndUserIdMemberResponses = deleteProjectsByIdAndUserIdMemberRequest["responses"]
export type deleteProjectsByIdAndUserIdMemberResponse200 = NonNullable<deleteProjectsByIdAndUserIdMemberResponses["200"]>

export type postProjectsByIdTransferOwnerRequest = paths["/api/v1/projects/{id}/transfer-owner"]["post"]
export type postProjectsByIdTransferOwnerParams = postProjectsByIdTransferOwnerRequest["parameters"]
export type postProjectsByIdTransferOwnerParamsPath = postProjectsByIdTransferOwnerParams["path"]
export type postProjectsByIdTransferOwnerRequestBody = NonNullable<postProjectsByIdTransferOwnerRequest["requestBody"]>["content"][keyof NonNullable<postProjectsByIdTransferOwnerRequest["requestBody"]>["content"]]
export type postProjectsByIdTransferOwnerResponses = postProjectsByIdTransferOwnerRequest["responses"]
export type postProjectsByIdTransferOwnerResponse201 = NonNullable<postProjectsByIdTransferOwnerResponses["201"]>
