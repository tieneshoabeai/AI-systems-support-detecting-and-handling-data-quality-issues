/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getProjectsByProjectIdAnalysisConfigRequest = paths["/api/v1/projects/{projectId}/analysis/config"]["get"]
export type getProjectsByProjectIdAnalysisConfigParams = getProjectsByProjectIdAnalysisConfigRequest["parameters"]
export type getProjectsByProjectIdAnalysisConfigParamsPath = getProjectsByProjectIdAnalysisConfigParams["path"]
export type getProjectsByProjectIdAnalysisConfigResponses = getProjectsByProjectIdAnalysisConfigRequest["responses"]
export type getProjectsByProjectIdAnalysisConfigResponse200 = NonNullable<getProjectsByProjectIdAnalysisConfigResponses["200"]>

export type postProjectsByProjectIdSaveAnalysisConfigRequest = paths["/api/v1/projects/{projectId}/analysis/config"]["post"]
export type postProjectsByProjectIdSaveAnalysisConfigParams = postProjectsByProjectIdSaveAnalysisConfigRequest["parameters"]
export type postProjectsByProjectIdSaveAnalysisConfigParamsPath = postProjectsByProjectIdSaveAnalysisConfigParams["path"]
export type postProjectsByProjectIdSaveAnalysisConfigRequestBody = NonNullable<postProjectsByProjectIdSaveAnalysisConfigRequest["requestBody"]>["content"][keyof NonNullable<postProjectsByProjectIdSaveAnalysisConfigRequest["requestBody"]>["content"]]
export type postProjectsByProjectIdSaveAnalysisConfigResponses = postProjectsByProjectIdSaveAnalysisConfigRequest["responses"]
export type postProjectsByProjectIdSaveAnalysisConfigResponse200 = NonNullable<postProjectsByProjectIdSaveAnalysisConfigResponses["200"]>

export type postProjectsByProjectIdRunAnalysisRequest = paths["/api/v1/projects/{projectId}/analysis"]["post"]
export type postProjectsByProjectIdRunAnalysisParams = postProjectsByProjectIdRunAnalysisRequest["parameters"]
export type postProjectsByProjectIdRunAnalysisParamsPath = postProjectsByProjectIdRunAnalysisParams["path"]
export type postProjectsByProjectIdRunAnalysisRequestBody = NonNullable<postProjectsByProjectIdRunAnalysisRequest["requestBody"]>["content"][keyof NonNullable<postProjectsByProjectIdRunAnalysisRequest["requestBody"]>["content"]]
export type postProjectsByProjectIdRunAnalysisResponses = postProjectsByProjectIdRunAnalysisRequest["responses"]
export type postProjectsByProjectIdRunAnalysisResponse201 = NonNullable<postProjectsByProjectIdRunAnalysisResponses["201"]>

export type getProjectsByProjectIdAnalysisResultRequest = paths["/api/v1/projects/{projectId}/analysis/result"]["get"]
export type getProjectsByProjectIdAnalysisResultParams = getProjectsByProjectIdAnalysisResultRequest["parameters"]
export type getProjectsByProjectIdAnalysisResultParamsPath = getProjectsByProjectIdAnalysisResultParams["path"]
export type getProjectsByProjectIdAnalysisResultResponses = getProjectsByProjectIdAnalysisResultRequest["responses"]
export type getProjectsByProjectIdAnalysisResultResponse200 = NonNullable<getProjectsByProjectIdAnalysisResultResponses["200"]>

export type getAnalysisByJobIdAiJobRequest = paths["/api/v1/analysis/jobs/{jobId}"]["get"]
export type getAnalysisByJobIdAiJobParams = getAnalysisByJobIdAiJobRequest["parameters"]
export type getAnalysisByJobIdAiJobParamsPath = getAnalysisByJobIdAiJobParams["path"]
export type getAnalysisByJobIdAiJobResponses = getAnalysisByJobIdAiJobRequest["responses"]
export type getAnalysisByJobIdAiJobResponse200 = NonNullable<getAnalysisByJobIdAiJobResponses["200"]>

export type postAnalysisByJobIdRetryAiJobRequest = paths["/api/v1/analysis/jobs/{jobId}/retry"]["post"]
export type postAnalysisByJobIdRetryAiJobParams = postAnalysisByJobIdRetryAiJobRequest["parameters"]
export type postAnalysisByJobIdRetryAiJobParamsPath = postAnalysisByJobIdRetryAiJobParams["path"]
export type postAnalysisByJobIdRetryAiJobResponses = postAnalysisByJobIdRetryAiJobRequest["responses"]
export type postAnalysisByJobIdRetryAiJobResponse202 = NonNullable<postAnalysisByJobIdRetryAiJobResponses["202"]>

export type postAnalysisByJobIdIngestAiResultRequest = paths["/api/v1/analysis/jobs/{jobId}/result"]["post"]
export type postAnalysisByJobIdIngestAiResultParams = postAnalysisByJobIdIngestAiResultRequest["parameters"]
export type postAnalysisByJobIdIngestAiResultParamsPath = postAnalysisByJobIdIngestAiResultParams["path"]
export type postAnalysisByJobIdIngestAiResultResponses = postAnalysisByJobIdIngestAiResultRequest["responses"]
export type postAnalysisByJobIdIngestAiResultResponse200 = NonNullable<postAnalysisByJobIdIngestAiResultResponses["200"]>
