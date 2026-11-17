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

export type patchDatasetsByIdDatasetRequest = paths["/api/v1/datasets/{id}"]["patch"]
export type patchDatasetsByIdDatasetParams = patchDatasetsByIdDatasetRequest["parameters"]
export type patchDatasetsByIdDatasetParamsPath = patchDatasetsByIdDatasetParams["path"]
export type patchDatasetsByIdDatasetRequestBody = NonNullable<patchDatasetsByIdDatasetRequest["requestBody"]>["content"][keyof NonNullable<patchDatasetsByIdDatasetRequest["requestBody"]>["content"]]
export type patchDatasetsByIdDatasetResponses = patchDatasetsByIdDatasetRequest["responses"]
export type patchDatasetsByIdDatasetResponse200 = NonNullable<patchDatasetsByIdDatasetResponses["200"]>

export type deleteDatasetsByIdDatasetRequest = paths["/api/v1/datasets/{id}"]["delete"]
export type deleteDatasetsByIdDatasetParams = deleteDatasetsByIdDatasetRequest["parameters"]
export type deleteDatasetsByIdDatasetParamsPath = deleteDatasetsByIdDatasetParams["path"]
export type deleteDatasetsByIdDatasetResponses = deleteDatasetsByIdDatasetRequest["responses"]
export type deleteDatasetsByIdDatasetResponse204 = NonNullable<deleteDatasetsByIdDatasetResponses["204"]>

export type patchDatasetsByIdRenameColumnsRequest = paths["/api/v1/datasets/{id}/columns"]["patch"]
export type patchDatasetsByIdRenameColumnsParams = patchDatasetsByIdRenameColumnsRequest["parameters"]
export type patchDatasetsByIdRenameColumnsParamsPath = patchDatasetsByIdRenameColumnsParams["path"]
export type patchDatasetsByIdRenameColumnsRequestBody = NonNullable<patchDatasetsByIdRenameColumnsRequest["requestBody"]>["content"][keyof NonNullable<patchDatasetsByIdRenameColumnsRequest["requestBody"]>["content"]]
export type patchDatasetsByIdRenameColumnsResponses = patchDatasetsByIdRenameColumnsRequest["responses"]
export type patchDatasetsByIdRenameColumnsResponse200 = NonNullable<patchDatasetsByIdRenameColumnsResponses["200"]>

export type postDatasetsByIdResetColumnNamesRequest = paths["/api/v1/datasets/{id}/columns/reset"]["post"]
export type postDatasetsByIdResetColumnNamesParams = postDatasetsByIdResetColumnNamesRequest["parameters"]
export type postDatasetsByIdResetColumnNamesParamsPath = postDatasetsByIdResetColumnNamesParams["path"]
export type postDatasetsByIdResetColumnNamesResponses = postDatasetsByIdResetColumnNamesRequest["responses"]
export type postDatasetsByIdResetColumnNamesResponse200 = NonNullable<postDatasetsByIdResetColumnNamesResponses["200"]>

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
