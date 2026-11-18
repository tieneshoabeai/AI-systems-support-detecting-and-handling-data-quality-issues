import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import { RealtimeEnvelope, RealtimeEventName } from '../domain/realtime-events';
import type { RealtimePort } from '../domain/ports/realtime.port';
export declare class RealtimeService implements RealtimePort {
    private readonly config?;
    private readonly logger;
    private server;
    constructor(config?: ConfigService | undefined);
    attachServer(server: Server): void;
    private isEnabled;
    private safeEmit;
    emitToUser(userId: string, event: RealtimeEventName, fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & {
        occurredAt?: string;
    }): void;
    emitToProject(projectId: string, event: RealtimeEventName, fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & {
        occurredAt?: string;
    }): void;
    emitToAnalysis(analysisId: string, event: RealtimeEventName, fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & {
        occurredAt?: string;
    }): void;
    emitAnalysisLifecycle(projectId: string, analysisId: string, event: Extract<RealtimeEventName, 'analysis.progress' | 'analysis.completed' | 'analysis.failed' | 'ai.job.status'>, fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt' | 'projectId' | 'analysisId'> & {
        occurredAt?: string;
    }): void;
}
