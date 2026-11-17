import type { RealtimeEnvelope, RealtimeEventName } from '../realtime-events';
export declare const REALTIME_PORT: unique symbol;
export type RealtimeFields = Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & {
    occurredAt?: string;
};
export interface RealtimePort {
    emitToUser(userId: string, event: RealtimeEventName, fields: RealtimeFields): void;
    emitToProject(projectId: string, event: RealtimeEventName, fields: RealtimeFields): void;
    emitToAnalysis(analysisId: string, event: RealtimeEventName, fields: RealtimeFields): void;
    emitAnalysisLifecycle(projectId: string, analysisId: string, event: Extract<RealtimeEventName, 'analysis.progress' | 'analysis.completed' | 'analysis.failed' | 'ai.job.status'>, fields: Omit<RealtimeFields, 'projectId' | 'analysisId'>): void;
}
