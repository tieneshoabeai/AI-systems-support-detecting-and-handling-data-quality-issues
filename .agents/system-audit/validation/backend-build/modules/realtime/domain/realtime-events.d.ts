export declare const RealtimeRooms: {
    readonly user: (userId: string) => string;
    readonly project: (projectId: string) => string;
    readonly analysis: (analysisId: string) => string;
};
export type RealtimeEventName = 'notification.created' | 'ai.quality.updated' | 'analysis.progress' | 'analysis.completed' | 'analysis.failed' | 'ai.job.status' | 'feedback.created';
export interface RealtimeEnvelope {
    event: RealtimeEventName;
    occurredAt: string;
    projectId?: string;
    analysisId?: string;
    status?: string;
    progress?: number;
    stage?: string;
    notificationId?: string;
    notificationType?: string;
    jobId?: string;
    attempt?: number;
    feedbackId?: string;
    label?: string;
}
export declare function assertNoSensitiveData(payload: Record<string, unknown>): void;
export declare function buildEnvelope(event: RealtimeEventName, fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & {
    occurredAt?: string;
}): RealtimeEnvelope;
