import type { ApiClient, ApiResponseWithStatus } from '../../types/api/api.types'
import { ApiError } from '../../lib/api-error'
import type { SavedAnalysisResult } from '../management/management.types'
import type {
  postProjectsByProjectIdSaveAnalysisConfigRequestBody,
  postProjectsByProjectIdRunAnalysisRequestBody,
} from '../../types/services-type/analysis'
import type {
  getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParamsQuery,
  getAnalysesByAnalysisIdRunFeedbackParamsQuery,
  postAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequestBody,
  postAnalysesByAnalysisIdRunFeedbackRequestBody,
  patchFeedbackByIdMineRequestBody,
} from '../../types/services-type/feedback'

export type AnalysisConfigInput = postProjectsByProjectIdSaveAnalysisConfigRequestBody
export type RunAnalysisInput = postProjectsByProjectIdRunAnalysisRequestBody
export type CreateFeedbackInput = postAnalysesByAnalysisIdRunFeedbackRequestBody
export type UpdateFeedbackInput = patchFeedbackByIdMineRequestBody
export type FeedbackQuery = getAnalysesByAnalysisIdRunFeedbackParamsQuery

export type ReportDownload =
  | { status: 'ready'; file: Blob }
  | { status: 'pending'; metadata: unknown }

export function createAnalysisService(api: ApiClient) {
  const projectPath = (projectId: string, suffix: string) =>
    `/projects/${encodeURIComponent(projectId)}/${suffix}`
  const request = <T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; data?: unknown; params?: Record<string, string | number | boolean | null | undefined>; responseType?: 'blob'; signal?: AbortSignal } = {}) =>
    api.request<T>({ path, auth: 'session', ...options })

  return {
    getConfig: (projectId: string, signal?: AbortSignal) =>
      request<unknown>(projectPath(projectId, 'analysis/config'), signal ? { signal } : {}),
    saveConfig: (projectId: string, data: AnalysisConfigInput, signal?: AbortSignal) =>
      request<unknown>(projectPath(projectId, 'analysis/config'), { method: 'POST', data, ...(signal ? { signal } : {}) }),
    run: (projectId: string, data: RunAnalysisInput, signal?: AbortSignal) =>
      request<SavedAnalysisResult>(projectPath(projectId, 'analysis'), { method: 'POST', data, ...(signal ? { signal } : {}) }),
    getResult: (projectId: string, signal?: AbortSignal) =>
      request<SavedAnalysisResult>(projectPath(projectId, 'analysis/result'), signal ? { signal } : {}),
    getJob: (jobId: string, signal?: AbortSignal) =>
      request<unknown>(`/analysis/jobs/${encodeURIComponent(jobId)}`, signal ? { signal } : {}),
    retryJob: (jobId: string, signal?: AbortSignal) =>
      request<unknown>(`/analysis/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST', ...(signal ? { signal } : {}) }),
    getSummary: (projectId: string, signal?: AbortSignal) =>
      request<unknown>(projectPath(projectId, 'summary'), signal ? { signal } : {}),
    createSummary: (projectId: string, signal?: AbortSignal) =>
      request<unknown>(projectPath(projectId, 'summary'), { method: 'POST', ...(signal ? { signal } : {}) }),
    requestReport: (projectId: string, signal?: AbortSignal) =>
      request<unknown>(projectPath(projectId, 'report'), { method: 'POST', ...(signal ? { signal } : {}) }),
    async downloadReport(projectId: string, reportId: string, signal?: AbortSignal): Promise<ReportDownload> {
      const { status, data } = await api.request<ApiResponseWithStatus<Blob>>({
        path: projectPath(projectId, `report/${encodeURIComponent(reportId)}/file`),
        auth: 'session',
        responseType: 'blob',
        includeStatus: true,
        ...(signal ? { signal } : {}),
      })
      if (status === 202) {
        const text = data?.size ? await data.text() : ''
        let metadata: unknown = text
        try { metadata = JSON.parse(text) as unknown } catch { /* Keep the server message as text. */ }
        return { status: 'pending', metadata }
      }
      if (status !== 200 || !data || await data.slice(0, 5).text() !== '%PDF-') {
        throw new ApiError({ kind: 'invalid-response', status, message: 'Phản hồi tải report không chứa tệp PDF hợp lệ.' })
      }
      return { status: 'ready', file: data }
    },
    createRunFeedback: (analysisId: string, data: CreateFeedbackInput, signal?: AbortSignal) =>
      request<unknown>(`/analyses/${encodeURIComponent(analysisId)}/feedback`, { method: 'POST', data, ...(signal ? { signal } : {}) }),
    listRunFeedback: (analysisId: string, query: getAnalysesByAnalysisIdRunFeedbackParamsQuery = {}, signal?: AbortSignal) =>
      request<unknown>(`/analyses/${encodeURIComponent(analysisId)}/feedback`, { params: { ...query }, ...(signal ? { signal } : {}) }),
    createFindingFeedback: (analysisId: string, findingId: string, data: postAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequestBody, signal?: AbortSignal) =>
      request<unknown>(`/analyses/${encodeURIComponent(analysisId)}/findings/${encodeURIComponent(findingId)}/feedback`, { method: 'POST', data, ...(signal ? { signal } : {}) }),
    listFindingFeedback: (analysisId: string, findingId: string, query: getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParamsQuery = {}, signal?: AbortSignal) =>
      request<unknown>(`/analyses/${encodeURIComponent(analysisId)}/findings/${encodeURIComponent(findingId)}/feedback`, { params: { ...query }, ...(signal ? { signal } : {}) }),
    updateFeedback: (feedbackId: string, data: UpdateFeedbackInput, signal?: AbortSignal) =>
      request<unknown>(`/feedback/${encodeURIComponent(feedbackId)}`, { method: 'PATCH', data, ...(signal ? { signal } : {}) }),
    deleteFeedback: (feedbackId: string, signal?: AbortSignal) =>
      request<unknown>(`/feedback/${encodeURIComponent(feedbackId)}`, { method: 'DELETE', ...(signal ? { signal } : {}) }),
    getAiQualityMetrics: (projectId: string, signal?: AbortSignal) =>
      request<unknown>(projectPath(projectId, 'ai-quality-metrics'), signal ? { signal } : {}),
  }
}

export type AnalysisService = ReturnType<typeof createAnalysisService>
