import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import {
  RealtimeEnvelope,
  RealtimeEventName,
  RealtimeRooms,
  assertNoSensitiveData,
  buildEnvelope,
} from '../domain/realtime-events';
import type { RealtimePort } from '../domain/ports/realtime.port';

/**
 * REALTIME-01 — Push service (Phần 7 v6 §3.17.2, Phần 9 v4 §3.5.2 realtime-push).
 * Quy tắc bắt buộc:
 * - Server là nguồn sự thật: client nhận event chỉ để cập nhật giao diện, mọi dữ liệu
 *   chính xác phải gọi lại REST API.
 * - Không gửi dữ liệu nhạy cảm (giá trị ô lỗi, nội dung nhận xét, email).
 * - Không bao giờ làm hỏng luồng nghiệp vụ chính: emit luôn try/catch.
 * - Tôn trọng SOCKET_ENABLED=false (chế độ suy giảm theo Phần 9 v4 §3.2).
 */
@Injectable()
export class RealtimeService implements RealtimePort {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  constructor(@Optional() private readonly config?: ConfigService) {}

  /** Gateway gọi 1 lần khi khởi tạo để gắn Socket.IO server. */
  attachServer(server: Server): void {
    this.server = server;
  }

  private isEnabled(): boolean {
    try {
      const v = this.config?.get<boolean | string>('SOCKET_ENABLED');
      if (v === false || v === 'false' || v === '0') return false;
      return true;
    } catch {
      return true;
    }
  }

  private safeEmit(room: string, envelope: RealtimeEnvelope): void {
    try {
      assertNoSensitiveData(envelope as unknown as Record<string, unknown>);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Realtime payload bị chặn (nhạy cảm): ${message}`);
      return;
    }
    if (!this.isEnabled()) return;
    if (!this.server) return;
    try {
      this.server.to(room).emit(envelope.event, envelope);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Realtime emit thất bại (room=${room}): ${message}`);
    }
  }

  emitToUser(
    userId: string,
    event: RealtimeEventName,
    fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & { occurredAt?: string },
  ): void {
    const envelope = buildEnvelope(event, fields);
    this.safeEmit(RealtimeRooms.user(userId), envelope);
  }

  emitToProject(
    projectId: string,
    event: RealtimeEventName,
    fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & { occurredAt?: string },
  ): void {
    const envelope = buildEnvelope(event, { ...fields, projectId });
    this.safeEmit(RealtimeRooms.project(projectId), envelope);
  }

  emitToAnalysis(
    analysisId: string,
    event: RealtimeEventName,
    fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & { occurredAt?: string },
  ): void {
    const envelope = buildEnvelope(event, { ...fields, analysisId });
    this.safeEmit(RealtimeRooms.analysis(analysisId), envelope);
  }

  /** Tiện ích: đẩy đồng thời tới room project + analysis của cùng một lần chạy. */
  emitAnalysisLifecycle(
    projectId: string,
    analysisId: string,
    event: Extract<RealtimeEventName, 'analysis.progress' | 'analysis.completed' | 'analysis.failed' | 'ai.job.status'>,
    fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt' | 'projectId' | 'analysisId'> & { occurredAt?: string },
  ): void {
    const forProject = buildEnvelope(event, { ...fields, projectId, analysisId });
    const forAnalysis = buildEnvelope(event, { ...fields, projectId, analysisId });
    this.safeEmit(RealtimeRooms.project(projectId), forProject);
    this.safeEmit(RealtimeRooms.analysis(analysisId), forAnalysis);
  }
}
