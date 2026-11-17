/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest = paths["/api/v1/analyses/{analysisId}/findings/{findingId}/feedback"]["get"]
export type getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParams = getAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest["parameters"]
export type getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParamsQuery = getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParams["query"]
export type getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParamsPath = getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParams["path"]
export type getAnalysesByAnalysisIdAndFindingIdFindingFeedbackResponses = getAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest["responses"]
export type getAnalysesByAnalysisIdAndFindingIdFindingFeedbackResponse200 = NonNullable<getAnalysesByAnalysisIdAndFindingIdFindingFeedbackResponses["200"]>

export type postAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest = paths["/api/v1/analyses/{analysisId}/findings/{findingId}/feedback"]["post"]
export type postAnalysesByAnalysisIdAndFindingIdFindingFeedbackParams = postAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest["parameters"]
export type postAnalysesByAnalysisIdAndFindingIdFindingFeedbackParamsPath = postAnalysesByAnalysisIdAndFindingIdFindingFeedbackParams["path"]
export type postAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequestBody = NonNullable<postAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest["requestBody"]>["content"][keyof NonNullable<postAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest["requestBody"]>["content"]]
export type postAnalysesByAnalysisIdAndFindingIdFindingFeedbackResponses = postAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest["responses"]
export type postAnalysesByAnalysisIdAndFindingIdFindingFeedbackResponse201 = NonNullable<postAnalysesByAnalysisIdAndFindingIdFindingFeedbackResponses["201"]>

export type getAnalysesByAnalysisIdRunFeedbackRequest = paths["/api/v1/analyses/{analysisId}/feedback"]["get"]
export type getAnalysesByAnalysisIdRunFeedbackParams = getAnalysesByAnalysisIdRunFeedbackRequest["parameters"]
export type getAnalysesByAnalysisIdRunFeedbackParamsQuery = getAnalysesByAnalysisIdRunFeedbackParams["query"]
export type getAnalysesByAnalysisIdRunFeedbackParamsPath = getAnalysesByAnalysisIdRunFeedbackParams["path"]
export type getAnalysesByAnalysisIdRunFeedbackResponses = getAnalysesByAnalysisIdRunFeedbackRequest["responses"]
export type getAnalysesByAnalysisIdRunFeedbackResponse200 = NonNullable<getAnalysesByAnalysisIdRunFeedbackResponses["200"]>

export type postAnalysesByAnalysisIdRunFeedbackRequest = paths["/api/v1/analyses/{analysisId}/feedback"]["post"]
export type postAnalysesByAnalysisIdRunFeedbackParams = postAnalysesByAnalysisIdRunFeedbackRequest["parameters"]
export type postAnalysesByAnalysisIdRunFeedbackParamsPath = postAnalysesByAnalysisIdRunFeedbackParams["path"]
export type postAnalysesByAnalysisIdRunFeedbackRequestBody = NonNullable<postAnalysesByAnalysisIdRunFeedbackRequest["requestBody"]>["content"][keyof NonNullable<postAnalysesByAnalysisIdRunFeedbackRequest["requestBody"]>["content"]]
export type postAnalysesByAnalysisIdRunFeedbackResponses = postAnalysesByAnalysisIdRunFeedbackRequest["responses"]
export type postAnalysesByAnalysisIdRunFeedbackResponse201 = NonNullable<postAnalysesByAnalysisIdRunFeedbackResponses["201"]>

export type patchFeedbackByIdMineRequest = paths["/api/v1/feedback/{id}"]["patch"]
export type patchFeedbackByIdMineParams = patchFeedbackByIdMineRequest["parameters"]
export type patchFeedbackByIdMineParamsPath = patchFeedbackByIdMineParams["path"]
export type patchFeedbackByIdMineRequestBody = NonNullable<patchFeedbackByIdMineRequest["requestBody"]>["content"][keyof NonNullable<patchFeedbackByIdMineRequest["requestBody"]>["content"]]
export type patchFeedbackByIdMineResponses = patchFeedbackByIdMineRequest["responses"]
export type patchFeedbackByIdMineResponse200 = NonNullable<patchFeedbackByIdMineResponses["200"]>

export type deleteFeedbackByIdRequest = paths["/api/v1/feedback/{id}"]["delete"]
export type deleteFeedbackByIdParams = deleteFeedbackByIdRequest["parameters"]
export type deleteFeedbackByIdParamsPath = deleteFeedbackByIdParams["path"]
export type deleteFeedbackByIdResponses = deleteFeedbackByIdRequest["responses"]
export type deleteFeedbackByIdResponse200 = NonNullable<deleteFeedbackByIdResponses["200"]>

export type getProjectsByProjectIdAiQualityMetricsRequest = paths["/api/v1/projects/{projectId}/ai-quality-metrics"]["get"]
export type getProjectsByProjectIdAiQualityMetricsParams = getProjectsByProjectIdAiQualityMetricsRequest["parameters"]
export type getProjectsByProjectIdAiQualityMetricsParamsPath = getProjectsByProjectIdAiQualityMetricsParams["path"]
export type getProjectsByProjectIdAiQualityMetricsResponses = getProjectsByProjectIdAiQualityMetricsRequest["responses"]
export type getProjectsByProjectIdAiQualityMetricsResponse200 = NonNullable<getProjectsByProjectIdAiQualityMetricsResponses["200"]>
