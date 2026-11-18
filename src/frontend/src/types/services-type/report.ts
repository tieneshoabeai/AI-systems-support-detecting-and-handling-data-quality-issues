/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type postProjectsByProjectIdRequestReportRequest = paths["/api/v1/projects/{projectId}/report"]["post"]
export type postProjectsByProjectIdRequestReportParams = postProjectsByProjectIdRequestReportRequest["parameters"]
export type postProjectsByProjectIdRequestReportParamsPath = postProjectsByProjectIdRequestReportParams["path"]
export type postProjectsByProjectIdRequestReportResponses = postProjectsByProjectIdRequestReportRequest["responses"]
export type postProjectsByProjectIdRequestReportResponse202 = NonNullable<postProjectsByProjectIdRequestReportResponses["202"]>

export type getProjectsByProjectIdAndReportIdDownloadReportRequest = paths["/api/v1/projects/{projectId}/report/{reportId}/file"]["get"]
export type getProjectsByProjectIdAndReportIdDownloadReportParams = getProjectsByProjectIdAndReportIdDownloadReportRequest["parameters"]
export type getProjectsByProjectIdAndReportIdDownloadReportParamsPath = getProjectsByProjectIdAndReportIdDownloadReportParams["path"]
export type getProjectsByProjectIdAndReportIdDownloadReportResponses = getProjectsByProjectIdAndReportIdDownloadReportRequest["responses"]
export type getProjectsByProjectIdAndReportIdDownloadReportResponse200 = NonNullable<getProjectsByProjectIdAndReportIdDownloadReportResponses["200"]>
