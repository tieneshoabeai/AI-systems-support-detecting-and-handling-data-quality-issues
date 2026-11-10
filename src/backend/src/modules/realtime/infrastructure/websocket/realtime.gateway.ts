import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from '../../application/realtime.service';
import { RealtimeAuthService, RealtimeClientIdentity } from '../../application/realtime-auth.service';
import { ProjectsService } from '../../../projects/application/projects.service';
import { WorkspacesService } from '../../../workspaces/application/workspaces.service';
import { RealtimeRooms } from '../../domain/realtime-events';

interface JoinProjectPayload {
  projectId?: string;
}

interface JoinAnalysisPayload {
  analysisId?: string;
  projectId?: string;
}

interface AuthedSocket extends Socket {
  data: {
    identity?: RealtimeClientIdentity;
  };
}

/**
 * REALTIME-01 — Socket.IO gateway (Phần 7 v6 §3.17.2, Phần 9 v4).
 * Mount tại `/api/v1/realtime?token=<accessToken>` (Socket.IO path).
 * - Xác thực trước khi accept phiên; thất bại → từ chối handshake (mã 4401).
 * - Tự join `user:{userId}`; join `project:{id}` / `analysis:{id}` qua message có kiểm quyền.
 * - Chỉ giữ kết nối và push, không xử lý nghiệp vụ (Phần 9 v4 §3.5.1).
 */
@WebSocketGateway({
  path: '/api/v1/realtime',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly auth: RealtimeAuthService,
    private readonly projectsService: ProjectsService,
    private readonly workspacesService: WorkspacesService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attachServer(server);
    this.logger.log('Realtime gateway sẵn sàng tại /api/v1/realtime');
  }

  private socketEnabled(): boolean {
    const v = this.config.get<unknown>('SOCKET_ENABLED');
    if (v === false || v === 'false' || v === '0') return false;
    return true;
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    if (!this.socketEnabled()) {
      client.emit('error', { code: 'SOCKET_DISABLED', message: 'Kênh realtime đang tắt (SOCKET_ENABLED=false)' });
      client.disconnect(true);
      return;
    }
    try {
      const token = this.auth.extractToken(client.handshake as unknown as { auth?: Record<string, unknown>; query?: Record<string, unknown> });
      if (!token) throw new Error('4401: thiếu access token (query ?token=)');
      const identity = await this.auth.verifyToken(token);
      client.data.identity = identity;
      await client.join(RealtimeRooms.user(identity.userId));
      client.emit('connected', { userId: identity.userId, rooms: [RealtimeRooms.user(identity.userId)] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.startsWith('4401') ? 4401 : 4401;
      try {
        (client as unknown as { emit: (ev: string, data: unknown) => void }).emit('error', {
          code,
          message: message.replace(/^4401:\s*/, ''),
        });
      } catch {
        // bỏ qua
      }
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    const uid = client.data.identity?.userId ?? 'unknown';
    this.logger.debug(`Realtime client ngắt kết nối: ${uid}`);
  }

  private requireIdentity(client: AuthedSocket): RealtimeClientIdentity | null {
    const identity = client.data.identity;
    if (!identity) {
      client.emit('error', { code: 4401, message: 'Chưa xác thực phiên realtime' });
      return null;
    }
    return identity;
  }

  private async resolveProjectRole(
    projectId: string,
    userId: string,
  ): Promise<{ ok: boolean; workspaceId?: string }> {
    if (!isObjectIdHex(projectId)) return { ok: false };
    try {
      const project = await this.projectsService.getProjectById(projectId);
      const workspaceId = project.workspaceId.toString();
      const workspaceRole = await this.workspacesService.resolveUserWorkspaceRole(workspaceId, userId);
      const projectRole = await this.projectsService.resolveUserProjectRole(projectId, userId, workspaceRole);
      if (!projectRole) return { ok: false };
      return { ok: true, workspaceId };
    } catch {
      return { ok: false };
    }
  }

  @SubscribeMessage('joinProject')
  async handleJoinProject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: JoinProjectPayload,
  ): Promise<Record<string, unknown>> {
    const identity = this.requireIdentity(client);
    if (!identity) return { ok: false, error: 'UNAUTHENTICATED' };
    const projectId = (payload?.projectId ?? '').trim();
    if (!isObjectIdHex(projectId)) return { ok: false, error: 'INVALID_PROJECT_ID' };
    const access = await this.resolveProjectRole(projectId, identity.userId);
    if (!access.ok) return { ok: false, error: 'FORBIDDEN' };
    await client.join(RealtimeRooms.project(projectId));
    return { ok: true, room: RealtimeRooms.project(projectId) };
  }

  @SubscribeMessage('joinAnalysis')
  async handleJoinAnalysis(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: JoinAnalysisPayload,
  ): Promise<Record<string, unknown>> {
    const identity = this.requireIdentity(client);
    if (!identity) return { ok: false, error: 'UNAUTHENTICATED' };
    const analysisId = (payload?.analysisId ?? '').trim();
    const projectId = (payload?.projectId ?? '').trim();
    if (!isObjectIdHex(analysisId)) return { ok: false, error: 'INVALID_ANALYSIS_ID' };
    if (!isObjectIdHex(projectId)) return { ok: false, error: 'INVALID_PROJECT_ID' };
    const access = await this.resolveProjectRole(projectId, identity.userId);
    if (!access.ok) return { ok: false, error: 'FORBIDDEN' };
    await client.join(RealtimeRooms.analysis(analysisId));
    return { ok: true, room: RealtimeRooms.analysis(analysisId) };
  }

  @SubscribeMessage('leaveProject')
  async handleLeaveProject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: JoinProjectPayload,
  ): Promise<Record<string, unknown>> {
    const projectId = (payload?.projectId ?? '').trim();
    if (isObjectIdHex(projectId)) await client.leave(RealtimeRooms.project(projectId));
    return { ok: true };
  }

  @SubscribeMessage('leaveAnalysis')
  async handleLeaveAnalysis(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: JoinAnalysisPayload,
  ): Promise<Record<string, unknown>> {
    const analysisId = (payload?.analysisId ?? '').trim();
    if (isObjectIdHex(analysisId)) await client.leave(RealtimeRooms.analysis(analysisId));
    return { ok: true };
  }
}
