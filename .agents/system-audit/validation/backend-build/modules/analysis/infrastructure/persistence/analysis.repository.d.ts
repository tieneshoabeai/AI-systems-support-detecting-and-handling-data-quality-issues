import { Model } from 'mongoose';
import { IAnalysisRun } from './analysis-run.schema';
import { IAnalysisResult } from './analysis-result.schema';
import { IAiJob } from './ai-job.schema';
import { IFewShotExample } from './few-shot-example.schema';
import { ICellEvidence } from './cell-evidence.schema';
import { IProjectSave } from './project-save.schema';
import { IReportJob } from './report-job.schema';
import { IAnalysisConfig } from './analysis-config.schema';
import { type AiJobRecord, type AnalysisConfigRecord, type AnalysisRepositoryPort, type AnalysisResultRecord, type AnalysisRunRecord, type CellEvidenceRecord, type FewShotExampleRecord, type ProjectSaveRecord, type ReportJobRecord } from '../../domain/ports/analysis.repository.port';
export declare class AnalysisRepository implements AnalysisRepositoryPort {
    private readonly runModel;
    private readonly resultModel;
    private readonly jobModel;
    private readonly fewShotModel;
    private readonly evidenceModel;
    private readonly saveModel;
    private readonly reportModel;
    private readonly configModel;
    constructor(runModel: Model<IAnalysisRun>, resultModel: Model<IAnalysisResult>, jobModel: Model<IAiJob>, fewShotModel: Model<IFewShotExample>, evidenceModel: Model<ICellEvidence>, saveModel: Model<IProjectSave>, reportModel: Model<IReportJob>, configModel: Model<IAnalysisConfig>);
    create(data: Partial<AnalysisRunRecord> & Record<string, unknown> & {
        projectId: string;
        workspaceId: string;
        datasetId: string;
    }): Promise<AnalysisRunRecord>;
    findById(id: string): Promise<AnalysisRunRecord | null>;
    updateById(id: string, update: Partial<AnalysisRunRecord> & Record<string, unknown>): Promise<AnalysisRunRecord | null>;
    findRunByFingerprint(fingerprint: string): Promise<AnalysisRunRecord | null>;
    findLatestRunByProject(projectId: string): Promise<AnalysisRunRecord | null>;
    saveResult(doc: Partial<AnalysisResultRecord> & Record<string, unknown>): Promise<AnalysisResultRecord>;
    findResultByRun(runId: string): Promise<AnalysisResultRecord | null>;
    updateResultById(id: string, update: Record<string, unknown>): Promise<AnalysisResultRecord | null>;
    markResultsStale(projectId: string, keepRunId: string, reason: string): Promise<unknown>;
    createJob(doc: Partial<AiJobRecord> & Record<string, unknown>): Promise<AiJobRecord>;
    findJobById(id: string): Promise<AiJobRecord | null>;
    updateJobById(id: string, update: Record<string, unknown>): Promise<AiJobRecord | null>;
    claimPendingJob(leaseMs?: number): Promise<AiJobRecord | null>;
    skipStaleJobs(leaseMs?: number): Promise<unknown>;
    heartbeatJob(id: string, leaseMs?: number): Promise<AiJobRecord | null>;
    insertEvidences(docs: Partial<CellEvidenceRecord>[]): Promise<number>;
    countEvidencesByRun(runId: string): Promise<number>;
    findEvidencesByRun(runId: string, limit?: number): Promise<CellEvidenceRecord[]>;
    upsertConfig(projectId: string, workspaceId: string, doc: Record<string, unknown>): Promise<AnalysisConfigRecord>;
    findConfigByProject(projectId: string): Promise<AnalysisConfigRecord | null>;
    createSave(doc: Partial<ProjectSaveRecord> & Record<string, unknown> & {
        projectId: string;
    }): Promise<ProjectSaveRecord>;
    findLatestSaveByProject(projectId: string): Promise<ProjectSaveRecord | null>;
    markSavesStale(projectId: string, keepId: string): Promise<unknown>;
    createReportJob(doc: Partial<ReportJobRecord> & Record<string, unknown> & {
        projectId: string;
    }): Promise<ReportJobRecord>;
    findReportById(id: string): Promise<ReportJobRecord | null>;
    updateReportById(id: string, update: Record<string, unknown>): Promise<ReportJobRecord | null>;
    claimPendingReport(): Promise<ReportJobRecord | null>;
    saveFewShotExample(doc: Partial<FewShotExampleRecord> & Record<string, unknown>): Promise<FewShotExampleRecord>;
    enforceFewShotCap(cap?: number): Promise<number>;
    findFewShotCandidates(params: {
        workspaceId: string;
        errorType?: string;
        language?: string;
        minTrustScore: number;
        maxAgeDays: number;
        limit: number;
    }): Promise<FewShotExampleRecord[]>;
    findDuplicateExample(params: {
        workspaceId: string;
        errorType: string;
        description: string;
        label: string;
    }): Promise<FewShotExampleRecord | null>;
    updateFewShotTrust(id: string, update: {
        agreementCount: number;
        trustScore: number;
        embedding: number[];
    }): Promise<FewShotExampleRecord | null>;
    countFewShotExamples(workspaceId: string): Promise<number>;
}
