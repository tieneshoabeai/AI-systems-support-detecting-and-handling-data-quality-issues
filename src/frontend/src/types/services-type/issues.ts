/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getIssuesMineRequest = paths["/api/v1/issues"]["get"]
export type getIssuesMineParams = getIssuesMineRequest["parameters"]
export type getIssuesMineParamsQuery = getIssuesMineParams["query"]
export type getIssuesMineResponses = getIssuesMineRequest["responses"]
export type getIssuesMineResponse200 = NonNullable<getIssuesMineResponses["200"]>

export type postIssuesReportRequest = paths["/api/v1/issues"]["post"]
export type postIssuesReportRequestBody = NonNullable<postIssuesReportRequest["requestBody"]>["content"][keyof NonNullable<postIssuesReportRequest["requestBody"]>["content"]]
export type postIssuesReportResponses = postIssuesReportRequest["responses"]
export type postIssuesReportResponse201 = NonNullable<postIssuesReportResponses["201"]>

export type postIssuesByIdUploadAttachmentRequest = paths["/api/v1/issues/{id}/attachments"]["post"]
export type postIssuesByIdUploadAttachmentParams = postIssuesByIdUploadAttachmentRequest["parameters"]
export type postIssuesByIdUploadAttachmentParamsPath = postIssuesByIdUploadAttachmentParams["path"]
export type postIssuesByIdUploadAttachmentResponses = postIssuesByIdUploadAttachmentRequest["responses"]
export type postIssuesByIdUploadAttachmentResponse201 = NonNullable<postIssuesByIdUploadAttachmentResponses["201"]>

export type getIssuesByIdAndAttachmentIdDownloadAttachmentRequest = paths["/api/v1/issues/{id}/attachments/{attachmentId}"]["get"]
export type getIssuesByIdAndAttachmentIdDownloadAttachmentParams = getIssuesByIdAndAttachmentIdDownloadAttachmentRequest["parameters"]
export type getIssuesByIdAndAttachmentIdDownloadAttachmentParamsPath = getIssuesByIdAndAttachmentIdDownloadAttachmentParams["path"]
export type getIssuesByIdAndAttachmentIdDownloadAttachmentResponses = getIssuesByIdAndAttachmentIdDownloadAttachmentRequest["responses"]
export type getIssuesByIdAndAttachmentIdDownloadAttachmentResponse200 = NonNullable<getIssuesByIdAndAttachmentIdDownloadAttachmentResponses["200"]>

export type getIssuesByIdMineRequest = paths["/api/v1/issues/{id}"]["get"]
export type getIssuesByIdMineParams = getIssuesByIdMineRequest["parameters"]
export type getIssuesByIdMineParamsPath = getIssuesByIdMineParams["path"]
export type getIssuesByIdMineResponses = getIssuesByIdMineRequest["responses"]
export type getIssuesByIdMineResponse200 = NonNullable<getIssuesByIdMineResponses["200"]>

export type patchIssuesByIdMineRequest = paths["/api/v1/issues/{id}"]["patch"]
export type patchIssuesByIdMineParams = patchIssuesByIdMineRequest["parameters"]
export type patchIssuesByIdMineParamsPath = patchIssuesByIdMineParams["path"]
export type patchIssuesByIdMineRequestBody = NonNullable<patchIssuesByIdMineRequest["requestBody"]>["content"][keyof NonNullable<patchIssuesByIdMineRequest["requestBody"]>["content"]]
export type patchIssuesByIdMineResponses = patchIssuesByIdMineRequest["responses"]
export type patchIssuesByIdMineResponse200 = NonNullable<patchIssuesByIdMineResponses["200"]>

export type getAdminForRequest = paths["/api/v1/admin/issues"]["get"]
export type getAdminForParams = getAdminForRequest["parameters"]
export type getAdminForParamsQuery = getAdminForParams["query"]
export type getAdminForResponses = getAdminForRequest["responses"]
export type getAdminForResponse200 = NonNullable<getAdminForResponses["200"]>

export type getAdminByIdForRequest = paths["/api/v1/admin/issues/{id}"]["get"]
export type getAdminByIdForParams = getAdminByIdForRequest["parameters"]
export type getAdminByIdForParamsPath = getAdminByIdForParams["path"]
export type getAdminByIdForResponses = getAdminByIdForRequest["responses"]
export type getAdminByIdForResponse200 = NonNullable<getAdminByIdForResponses["200"]>

export type patchAdminByIdStatusRequest = paths["/api/v1/admin/issues/{id}/status"]["patch"]
export type patchAdminByIdStatusParams = patchAdminByIdStatusRequest["parameters"]
export type patchAdminByIdStatusParamsPath = patchAdminByIdStatusParams["path"]
export type patchAdminByIdStatusRequestBody = NonNullable<patchAdminByIdStatusRequest["requestBody"]>["content"][keyof NonNullable<patchAdminByIdStatusRequest["requestBody"]>["content"]]
export type patchAdminByIdStatusResponses = patchAdminByIdStatusRequest["responses"]
export type patchAdminByIdStatusResponse200 = NonNullable<patchAdminByIdStatusResponses["200"]>
