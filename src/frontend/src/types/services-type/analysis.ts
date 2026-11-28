/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

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

export type getAnalysesByAnalysisRunIdEvidenceSamplesRequest = paths["/api/v1/analyses/{analysisRunId}/evidence-samples"]["get"]
export type getAnalysesByAnalysisRunIdEvidenceSamplesParams = getAnalysesByAnalysisRunIdEvidenceSamplesRequest["parameters"]
export type getAnalysesByAnalysisRunIdEvidenceSamplesParamsQuery = getAnalysesByAnalysisRunIdEvidenceSamplesParams["query"]
export type getAnalysesByAnalysisRunIdEvidenceSamplesParamsPath = getAnalysesByAnalysisRunIdEvidenceSamplesParams["path"]
export type getAnalysesByAnalysisRunIdEvidenceSamplesResponses = getAnalysesByAnalysisRunIdEvidenceSamplesRequest["responses"]
export type getAnalysesByAnalysisRunIdEvidenceSamplesResponse200 = NonNullable<getAnalysesByAnalysisRunIdEvidenceSamplesResponses["200"]>
export type getAnalysesByAnalysisRunIdEvidenceSamplesResponse200Content = NonNullable<getAnalysesByAnalysisRunIdEvidenceSamplesResponse200["content"]>[keyof NonNullable<getAnalysesByAnalysisRunIdEvidenceSamplesResponse200["content"]>]
