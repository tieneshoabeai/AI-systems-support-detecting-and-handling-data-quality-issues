/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getDatasetsByDatasetIdRecordsRequest = paths["/api/v1/datasets/{datasetId}/records"]["get"]
export type getDatasetsByDatasetIdRecordsParams = getDatasetsByDatasetIdRecordsRequest["parameters"]
export type getDatasetsByDatasetIdRecordsParamsQuery = getDatasetsByDatasetIdRecordsParams["query"]
export type getDatasetsByDatasetIdRecordsParamsPath = getDatasetsByDatasetIdRecordsParams["path"]
export type getDatasetsByDatasetIdRecordsResponses = getDatasetsByDatasetIdRecordsRequest["responses"]
export type getDatasetsByDatasetIdRecordsResponse200 = NonNullable<getDatasetsByDatasetIdRecordsResponses["200"]>

export type postDatasetsByDatasetIdQueryRecordsRequest = paths["/api/v1/datasets/{datasetId}/records/query"]["post"]
export type postDatasetsByDatasetIdQueryRecordsParams = postDatasetsByDatasetIdQueryRecordsRequest["parameters"]
export type postDatasetsByDatasetIdQueryRecordsParamsPath = postDatasetsByDatasetIdQueryRecordsParams["path"]
export type postDatasetsByDatasetIdQueryRecordsRequestBody = NonNullable<postDatasetsByDatasetIdQueryRecordsRequest["requestBody"]>["content"][keyof NonNullable<postDatasetsByDatasetIdQueryRecordsRequest["requestBody"]>["content"]]
export type postDatasetsByDatasetIdQueryRecordsResponses = postDatasetsByDatasetIdQueryRecordsRequest["responses"]
export type postDatasetsByDatasetIdQueryRecordsResponse200 = NonNullable<postDatasetsByDatasetIdQueryRecordsResponses["200"]>

export type getDatasetsByDatasetIdAndColumnColumnStatsRequest = paths["/api/v1/datasets/{datasetId}/columns/{columnKey}/stats"]["get"]
export type getDatasetsByDatasetIdAndColumnColumnStatsParams = getDatasetsByDatasetIdAndColumnColumnStatsRequest["parameters"]
export type getDatasetsByDatasetIdAndColumnColumnStatsParamsPath = getDatasetsByDatasetIdAndColumnColumnStatsParams["path"]
export type getDatasetsByDatasetIdAndColumnColumnStatsResponses = getDatasetsByDatasetIdAndColumnColumnStatsRequest["responses"]
export type getDatasetsByDatasetIdAndColumnColumnStatsResponse200 = NonNullable<getDatasetsByDatasetIdAndColumnColumnStatsResponses["200"]>

export type getDatasetsByDatasetIdChartDataRequest = paths["/api/v1/datasets/{datasetId}/charts"]["get"]
export type getDatasetsByDatasetIdChartDataParams = getDatasetsByDatasetIdChartDataRequest["parameters"]
export type getDatasetsByDatasetIdChartDataParamsQuery = getDatasetsByDatasetIdChartDataParams["query"]
export type getDatasetsByDatasetIdChartDataParamsPath = getDatasetsByDatasetIdChartDataParams["path"]
export type getDatasetsByDatasetIdChartDataResponses = getDatasetsByDatasetIdChartDataRequest["responses"]
export type getDatasetsByDatasetIdChartDataResponse200 = NonNullable<getDatasetsByDatasetIdChartDataResponses["200"]>
export type getDatasetsByDatasetIdChartDataResponse200Content = NonNullable<getDatasetsByDatasetIdChartDataResponse200["content"]>[keyof NonNullable<getDatasetsByDatasetIdChartDataResponse200["content"]>]
export type getDatasetsByDatasetIdChartDataResponse404 = NonNullable<getDatasetsByDatasetIdChartDataResponses["404"]>
