/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type postProjectsByProjectIdUploadDatasetRequest = paths["/api/v1/projects/{projectId}/datasets/upload"]["post"]
export type postProjectsByProjectIdUploadDatasetParams = postProjectsByProjectIdUploadDatasetRequest["parameters"]
export type postProjectsByProjectIdUploadDatasetParamsPath = postProjectsByProjectIdUploadDatasetParams["path"]
export type postProjectsByProjectIdUploadDatasetRequestBody = NonNullable<postProjectsByProjectIdUploadDatasetRequest["requestBody"]>["content"][keyof NonNullable<postProjectsByProjectIdUploadDatasetRequest["requestBody"]>["content"]]
export type postProjectsByProjectIdUploadDatasetResponses = postProjectsByProjectIdUploadDatasetRequest["responses"]
export type postProjectsByProjectIdUploadDatasetResponse201 = NonNullable<postProjectsByProjectIdUploadDatasetResponses["201"]>

export type getProjectsByProjectIdDatasetRequest = paths["/api/v1/projects/{projectId}/datasets"]["get"]
export type getProjectsByProjectIdDatasetParams = getProjectsByProjectIdDatasetRequest["parameters"]
export type getProjectsByProjectIdDatasetParamsPath = getProjectsByProjectIdDatasetParams["path"]
export type getProjectsByProjectIdDatasetResponses = getProjectsByProjectIdDatasetRequest["responses"]
export type getProjectsByProjectIdDatasetResponse200 = NonNullable<getProjectsByProjectIdDatasetResponses["200"]>

export type getDatasetsByIdRequest = paths["/api/v1/datasets/{id}"]["get"]
export type getDatasetsByIdParams = getDatasetsByIdRequest["parameters"]
export type getDatasetsByIdParamsPath = getDatasetsByIdParams["path"]
export type getDatasetsByIdResponses = getDatasetsByIdRequest["responses"]
export type getDatasetsByIdResponse200 = NonNullable<getDatasetsByIdResponses["200"]>

export type deleteDatasetsByIdDatasetRequest = paths["/api/v1/datasets/{id}"]["delete"]
export type deleteDatasetsByIdDatasetParams = deleteDatasetsByIdDatasetRequest["parameters"]
export type deleteDatasetsByIdDatasetParamsPath = deleteDatasetsByIdDatasetParams["path"]
export type deleteDatasetsByIdDatasetResponses = deleteDatasetsByIdDatasetRequest["responses"]
export type deleteDatasetsByIdDatasetResponse204 = NonNullable<deleteDatasetsByIdDatasetResponses["204"]>

export type getDatasetsByIdDownloadDatasetFileRequest = paths["/api/v1/datasets/{id}/file"]["get"]
export type getDatasetsByIdDownloadDatasetFileParams = getDatasetsByIdDownloadDatasetFileRequest["parameters"]
export type getDatasetsByIdDownloadDatasetFileParamsPath = getDatasetsByIdDownloadDatasetFileParams["path"]
export type getDatasetsByIdDownloadDatasetFileResponses = getDatasetsByIdDownloadDatasetFileRequest["responses"]
export type getDatasetsByIdDownloadDatasetFileResponse200 = NonNullable<getDatasetsByIdDownloadDatasetFileResponses["200"]>

export type getDatasetsByIdSchemaRequest = paths["/api/v1/datasets/{id}/schema"]["get"]
export type getDatasetsByIdSchemaParams = getDatasetsByIdSchemaRequest["parameters"]
export type getDatasetsByIdSchemaParamsPath = getDatasetsByIdSchemaParams["path"]
export type getDatasetsByIdSchemaResponses = getDatasetsByIdSchemaRequest["responses"]
export type getDatasetsByIdSchemaResponse200 = NonNullable<getDatasetsByIdSchemaResponses["200"]>
