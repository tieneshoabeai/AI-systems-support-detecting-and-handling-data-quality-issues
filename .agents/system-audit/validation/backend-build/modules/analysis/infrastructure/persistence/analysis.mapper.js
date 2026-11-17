"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAnalysisRunRecord = toAnalysisRunRecord;
exports.toAnalysisRunPersistence = toAnalysisRunPersistence;
exports.toAnalysisResultRecord = toAnalysisResultRecord;
exports.toAiJobRecord = toAiJobRecord;
exports.toAnalysisConfigRecord = toAnalysisConfigRecord;
exports.toProjectSaveRecord = toProjectSaveRecord;
exports.toReportJobRecord = toReportJobRecord;
exports.toFewShotRecord = toFewShotRecord;
exports.toCellEvidenceRecord = toCellEvidenceRecord;
const mongoose_1 = require("mongoose");
function oid(v) {
    if (v instanceof mongoose_1.Types.ObjectId)
        return v.toString();
    if (v && typeof v.toString === 'function')
        return v.toString();
    return String(v ?? '');
}
function toAnalysisRunRecord(doc) {
    return {
        id: oid(doc._id),
        projectId: oid(doc.project_id),
        workspaceId: oid(doc.workspace_id),
        datasetId: oid(doc.dataset_id),
        status: doc.status,
        inputFingerprint: doc.input_fingerprint,
        config: (doc.config ?? {}),
        startedBy: doc.started_by ? oid(doc.started_by) : null,
        startedAt: doc.started_at ?? null,
        finishedAt: doc.finished_at ?? null,
        durationMs: doc.duration_ms ?? null,
        error: doc.error ?? null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toAnalysisRunPersistence(data) {
    return {
        project_id: new mongoose_1.Types.ObjectId(data.projectId),
        workspace_id: new mongoose_1.Types.ObjectId(data.workspaceId),
        dataset_id: new mongoose_1.Types.ObjectId(data.datasetId),
        status: data.status,
        input_fingerprint: data.inputFingerprint,
        config: data.config,
        started_by: data.startedBy ? new mongoose_1.Types.ObjectId(data.startedBy) : null,
        started_at: data.startedAt,
    };
}
function toAnalysisResultRecord(doc) {
    const raw = doc;
    const corr = (raw.correlationMatrix ?? null);
    const vif = (raw.vif ?? null);
    const dqSummary = (raw.dq_summary ?? null);
    const dq05 = (raw.dq05 ?? null);
    return {
        id: oid(doc._id),
        analysisRunId: oid(doc.analysis_run_id),
        projectId: oid(doc.project_id),
        datasetId: doc.dataset_id ? oid(doc.dataset_id) : null,
        inputFingerprint: doc.input_fingerprint,
        dqSummary,
        dq_summary: dqSummary,
        dq05,
        descriptive: (raw.descriptive ?? null),
        correlation: corr,
        correlationMatrix: corr,
        vif,
        imbalance: (raw.imbalance ?? null),
        temporal: (raw.timeAnalysis ?? null),
        timeAnalysis: (raw.timeAnalysis ?? null),
        evidenceSummary: (raw.evidenceSummary ?? null),
        aiCorrelationAssessment: (raw.aiCorrelationAssessment ?? null),
        isStale: doc.is_stale ?? false,
        staleReason: (raw.stale_reason ?? null),
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toAiJobRecord(doc) {
    return {
        id: oid(doc._id),
        analysisRunId: doc.analysis_run_id ? oid(doc.analysis_run_id) : null,
        projectId: doc.project_id ? oid(doc.project_id) : null,
        datasetId: doc.dataset_id ? oid(doc.dataset_id) : null,
        inputFingerprint: doc.input_fingerprint ?? null,
        status: doc.status,
        attempt: doc.attempt ?? 0,
        modelId: doc.model_id ?? null,
        promptVersion: doc.prompt_version ?? null,
        prompt: null,
        result: null,
        error: doc.error ?? null,
        startedAt: doc.started_at ?? null,
        finishedAt: doc.finished_at ?? null,
        durationMs: doc.duration_ms ?? null,
        heartbeatAt: doc.heartbeat_at ?? null,
        leaseExpiresAt: doc.lease_expires_at ?? null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toAnalysisConfigRecord(doc) {
    return {
        projectId: oid(doc.project_id),
        workspaceId: oid(doc.workspace_id),
        selectedColumns: doc.selected_columns ?? null,
        labelColumn: doc.label_column ?? null,
        timeColumn: doc.time_column ?? null,
        timeGranularity: String(doc.time_granularity ?? 'day'),
        valueColumn: doc.value_column ?? null,
        correlationMethod: doc.correlation_method ?? 'pearson',
        outlierMethod: doc.outlier_method ?? 'iqr',
        topN: doc.top_n ?? 10,
    };
}
function toProjectSaveRecord(doc) {
    return {
        id: oid(doc._id),
        projectId: oid(doc.project_id),
        workspaceId: oid(doc.workspace_id),
        analysisRunId: doc.analysis_run_id ? oid(doc.analysis_run_id) : null,
        analysisResultId: doc.analysis_result_id ? oid(doc.analysis_result_id) : null,
        inputFingerprint: doc.input_fingerprint ?? '',
        summary: (doc.summary ?? {}),
        isStale: doc.is_stale ?? false,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toReportJobRecord(doc) {
    return {
        id: oid(doc._id),
        projectId: oid(doc.project_id),
        workspaceId: oid(doc.workspace_id),
        projectSaveId: doc.project_save_id ? oid(doc.project_save_id) : null,
        status: doc.status,
        storageKey: doc.storage_key ?? null,
        fileSizeBytes: doc.file_size_bytes ?? null,
        error: (doc.error ?? null),
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toFewShotRecord(doc) {
    return {
        id: oid(doc._id),
        workspaceId: oid(doc.workspace_id),
        projectId: doc.project_id ? oid(doc.project_id) : null,
        errorType: doc.error_type,
        columnTraits: doc.column_traits ?? '',
        description: doc.description,
        label: doc.label,
        trustScore: doc.trust_score ?? 0.6,
        agreementCount: doc.agreement_count ?? 0,
        embedding: doc.embedding ?? [],
        language: doc.language ?? null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toCellEvidenceRecord(doc) {
    return {
        analysisRunId: oid(doc.analysis_run_id),
        column: doc.column,
        rowIndex: doc.row_index,
        reason: doc.reason ?? null,
    };
}
//# sourceMappingURL=analysis.mapper.js.map