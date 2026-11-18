/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getWorkspacesEndpointRequest = paths["/api/v1/workspaces"]["get"]
export type getWorkspacesEndpointParams = getWorkspacesEndpointRequest["parameters"]
export type getWorkspacesEndpointParamsQuery = getWorkspacesEndpointParams["query"]
export type getWorkspacesEndpointResponses = getWorkspacesEndpointRequest["responses"]
export type getWorkspacesEndpointResponse200 = NonNullable<getWorkspacesEndpointResponses["200"]>

export type postWorkspacesWorkspaceRequest = paths["/api/v1/workspaces"]["post"]
export type postWorkspacesWorkspaceRequestBody = NonNullable<postWorkspacesWorkspaceRequest["requestBody"]>["content"][keyof NonNullable<postWorkspacesWorkspaceRequest["requestBody"]>["content"]]
export type postWorkspacesWorkspaceResponses = postWorkspacesWorkspaceRequest["responses"]
export type postWorkspacesWorkspaceResponse201 = NonNullable<postWorkspacesWorkspaceResponses["201"]>

export type getWorkspacesByIdRequest = paths["/api/v1/workspaces/{id}"]["get"]
export type getWorkspacesByIdParams = getWorkspacesByIdRequest["parameters"]
export type getWorkspacesByIdParamsPath = getWorkspacesByIdParams["path"]
export type getWorkspacesByIdResponses = getWorkspacesByIdRequest["responses"]
export type getWorkspacesByIdResponse200 = NonNullable<getWorkspacesByIdResponses["200"]>

export type patchWorkspacesByIdWorkspaceRequest = paths["/api/v1/workspaces/{id}"]["patch"]
export type patchWorkspacesByIdWorkspaceParams = patchWorkspacesByIdWorkspaceRequest["parameters"]
export type patchWorkspacesByIdWorkspaceParamsPath = patchWorkspacesByIdWorkspaceParams["path"]
export type patchWorkspacesByIdWorkspaceRequestBody = NonNullable<patchWorkspacesByIdWorkspaceRequest["requestBody"]>["content"][keyof NonNullable<patchWorkspacesByIdWorkspaceRequest["requestBody"]>["content"]]
export type patchWorkspacesByIdWorkspaceResponses = patchWorkspacesByIdWorkspaceRequest["responses"]
export type patchWorkspacesByIdWorkspaceResponse200 = NonNullable<patchWorkspacesByIdWorkspaceResponses["200"]>

export type deleteWorkspacesByIdWorkspaceRequest = paths["/api/v1/workspaces/{id}"]["delete"]
export type deleteWorkspacesByIdWorkspaceParams = deleteWorkspacesByIdWorkspaceRequest["parameters"]
export type deleteWorkspacesByIdWorkspaceParamsPath = deleteWorkspacesByIdWorkspaceParams["path"]
export type deleteWorkspacesByIdWorkspaceResponses = deleteWorkspacesByIdWorkspaceRequest["responses"]
export type deleteWorkspacesByIdWorkspaceResponse204 = NonNullable<deleteWorkspacesByIdWorkspaceResponses["204"]>

export type getWorkspacesByIdMembersRequest = paths["/api/v1/workspaces/{id}/members"]["get"]
export type getWorkspacesByIdMembersParams = getWorkspacesByIdMembersRequest["parameters"]
export type getWorkspacesByIdMembersParamsQuery = getWorkspacesByIdMembersParams["query"]
export type getWorkspacesByIdMembersParamsPath = getWorkspacesByIdMembersParams["path"]
export type getWorkspacesByIdMembersResponses = getWorkspacesByIdMembersRequest["responses"]
export type getWorkspacesByIdMembersResponse200 = NonNullable<getWorkspacesByIdMembersResponses["200"]>

export type postWorkspacesByIdMemberRequest = paths["/api/v1/workspaces/{id}/members"]["post"]
export type postWorkspacesByIdMemberParams = postWorkspacesByIdMemberRequest["parameters"]
export type postWorkspacesByIdMemberParamsPath = postWorkspacesByIdMemberParams["path"]
export type postWorkspacesByIdMemberRequestBody = NonNullable<postWorkspacesByIdMemberRequest["requestBody"]>["content"][keyof NonNullable<postWorkspacesByIdMemberRequest["requestBody"]>["content"]]
export type postWorkspacesByIdMemberResponses = postWorkspacesByIdMemberRequest["responses"]
export type postWorkspacesByIdMemberResponse201 = NonNullable<postWorkspacesByIdMemberResponses["201"]>

export type deleteWorkspacesByIdAndUserIdMemberRequest = paths["/api/v1/workspaces/{id}/members/{userId}"]["delete"]
export type deleteWorkspacesByIdAndUserIdMemberParams = deleteWorkspacesByIdAndUserIdMemberRequest["parameters"]
export type deleteWorkspacesByIdAndUserIdMemberParamsPath = deleteWorkspacesByIdAndUserIdMemberParams["path"]
export type deleteWorkspacesByIdAndUserIdMemberResponses = deleteWorkspacesByIdAndUserIdMemberRequest["responses"]
export type deleteWorkspacesByIdAndUserIdMemberResponse200 = NonNullable<deleteWorkspacesByIdAndUserIdMemberResponses["200"]>

export type postWorkspacesByIdTransferOwnerRequest = paths["/api/v1/workspaces/{id}/transfer-owner"]["post"]
export type postWorkspacesByIdTransferOwnerParams = postWorkspacesByIdTransferOwnerRequest["parameters"]
export type postWorkspacesByIdTransferOwnerParamsPath = postWorkspacesByIdTransferOwnerParams["path"]
export type postWorkspacesByIdTransferOwnerRequestBody = NonNullable<postWorkspacesByIdTransferOwnerRequest["requestBody"]>["content"][keyof NonNullable<postWorkspacesByIdTransferOwnerRequest["requestBody"]>["content"]]
export type postWorkspacesByIdTransferOwnerResponses = postWorkspacesByIdTransferOwnerRequest["responses"]
export type postWorkspacesByIdTransferOwnerResponse201 = NonNullable<postWorkspacesByIdTransferOwnerResponses["201"]>

export type postWorkspacesByIdLeaveRequest = paths["/api/v1/workspaces/{id}/leave"]["post"]
export type postWorkspacesByIdLeaveParams = postWorkspacesByIdLeaveRequest["parameters"]
export type postWorkspacesByIdLeaveParamsPath = postWorkspacesByIdLeaveParams["path"]
export type postWorkspacesByIdLeaveResponses = postWorkspacesByIdLeaveRequest["responses"]
export type postWorkspacesByIdLeaveResponse201 = NonNullable<postWorkspacesByIdLeaveResponses["201"]>
