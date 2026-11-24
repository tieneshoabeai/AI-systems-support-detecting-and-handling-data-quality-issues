/**
 * B2.9 — Test unit cho `RealtimeGateway` (Socket.IO gateway).
 *
 * Gateway là **cửa chào duy nhất** của kênh realtime — nơi quyết định ai được
 * vào room nào. Trước đây 0% coverage ⇒ một lỗi ở đây có thể biến thành
 * **rò rỉ dữ liệu giữa các project** mà không ai phát hiện.
 *
 * Bộ test chứng minh:
 *   1. Handshake: thiếu/sai token ⇒ emit lỗi 4401 + disconnect.
 *   2. `SOCKET_ENABLED=false` ⇒ từ chối kết nối.
 *   3. `joinProject` / `joinAnalysis` **kiểm quyền thật** trước khi join room.
 *   4. `leaveProject` / `leaveAnalysis` rời room đúng.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';
import { RealtimeAuthService } from '../src/modules/realtime/realtime-auth.service';
import { REALTIME_TRANSPORT_PORT } from '../src/modules/realtime/realtime.transport';
import { PROJECT_ACCESS_PORT } from '../src/modules/projects';
import { WORKSPACE_ACCESS_PORT } from '../src/modules/workspaces';

describe('B2.9 — RealtimeGateway (Socket.IO)', () => {
  let gateway: RealtimeGateway;
  let auth: { extractToken: jest.Mock; verifyToken: jest.Mock };
  let transport: { attachServer: jest.Mock; emitToRoom: jest.Mock; disconnectUser: jest.Mock };
  let projects: {
    getProjectById: jest.Mock;
    resolveUserProjectRole: jest.Mock;
    setHasDataset: jest.Mock;
  };
  let workspaces: {
    resolveUserWorkspaceRole: jest.Mock;
    incrementStorageUsed: jest.Mock;
    checkWorkspaceUploadQuota: jest.Mock;
  };
  let config: { get: jest.Mock };

  const oid = (): string => new Types.ObjectId().toHexString();

  const makeClient = (identity?: { userId: string; email: string; role: string }) => {
    const client = {
      data: identity ? { identity } : {},
      handshake: { auth: {}, query: {} },
      emit: jest.fn(),
      join: jest.fn(async () => undefined),
      leave: jest.fn(async () => undefined),
      disconnect: jest.fn(),
    };
    return client;
  };

  beforeEach(async () => {
    auth = {
      extractToken: jest.fn(() => 'token-abc'),
      verifyToken: jest.fn(async () => ({ userId: 'u1', email: 'a@b.c', role: 'user' })),
    };
    transport = {
      attachServer: jest.fn(),
      emitToRoom: jest.fn(() => true),
      disconnectUser: jest.fn(() => true),
    };
    projects = {
      getProjectById: jest.fn(async () => ({ id: 'p1', workspaceId: new Types.ObjectId() })),
      resolveUserProjectRole: jest.fn(async () => 'owner' as const),
      setHasDataset: jest.fn(async () => true),
    };
    workspaces = {
      resolveUserWorkspaceRole: jest.fn(async () => 'owner' as const),
      incrementStorageUsed: jest.fn(async () => undefined),
      checkWorkspaceUploadQuota: jest.fn(async () => undefined),
    };
    config = { get: jest.fn(() => undefined) };

    const module = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: RealtimeAuthService, useValue: auth },
        { provide: REALTIME_TRANSPORT_PORT, useValue: transport },
        { provide: PROJECT_ACCESS_PORT, useValue: projects },
        { provide: WORKSPACE_ACCESS_PORT, useValue: workspaces },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    gateway = module.get(RealtimeGateway);
  });

  // ─── afterInit ───────────────────────────────────────────────────────────

  it('afterInit gắn server vào transport', () => {
    const server = { id: 'srv' };
    gateway.afterInit(server as never);
    expect(transport.attachServer).toHaveBeenCalledWith(server);
  });

  // ─── handleConnection ────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('thành công ⇒ join room user + emit connected', async () => {
      const client = makeClient();
      await gateway.handleConnection(client as never);

      expect(client.join).toHaveBeenCalledWith('user:u1');
      expect(client.emit).toHaveBeenCalledWith('connected', {
        userId: 'u1',
        rooms: ['user:u1'],
      });
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('thiếu token ⇒ emit lỗi 4401 + disconnect', async () => {
      auth.extractToken.mockReturnValue(null);
      const client = makeClient();
      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 4401,
        message: expect.stringContaining('thiếu access token'),
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('token không hợp lệ ⇒ emit lỗi 4401 + disconnect', async () => {
      auth.verifyToken.mockRejectedValue(new Error('4401: token không hợp lệ'));
      const client = makeClient();
      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 4401,
        message: 'token không hợp lệ',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('lỗi không phải Error ⇒ vẫn disconnect, không throw ra ngoài', async () => {
      auth.verifyToken.mockRejectedValue('string error');
      const client = makeClient();
      await expect(gateway.handleConnection(client as never)).resolves.toBeUndefined();
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('SOCKET_ENABLED=false ⇒ từ chối kết nối', async () => {
      config.get.mockReturnValue(false);
      const client = makeClient();
      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'SOCKET_DISABLED',
        message: expect.stringContaining('SOCKET_ENABLED=false'),
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(auth.verifyToken).not.toHaveBeenCalled();
    });

    it('SOCKET_ENABLED="false" (string) ⇒ cũng từ chối', async () => {
      config.get.mockReturnValue('false');
      const client = makeClient();
      await gateway.handleConnection(client as never);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('SOCKET_ENABLED="0" ⇒ cũng từ chối', async () => {
      config.get.mockReturnValue('0');
      const client = makeClient();
      await gateway.handleConnection(client as never);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('SOCKET_ENABLED=true ⇒ vẫn xác thực bình thường', async () => {
      config.get.mockReturnValue(true);
      const client = makeClient();
      await gateway.handleConnection(client as never);
      expect(client.join).toHaveBeenCalledWith('user:u1');
    });
  });

  // ─── handleDisconnect ────────────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('client đã xác thực ⇒ không lỗi', () => {
      const client = makeClient({ userId: 'u1', email: 'a@b.c', role: 'user' });
      expect(() => gateway.handleDisconnect(client as never)).not.toThrow();
    });

    it('client chưa xác thực ⇒ không lỗi', () => {
      const client = makeClient();
      expect(() => gateway.handleDisconnect(client as never)).not.toThrow();
    });
  });

  // ─── joinProject ─────────────────────────────────────────────────────────

  describe('handleJoinProject', () => {
    const identity = { userId: 'u1', email: 'a@b.c', role: 'user' };

    it('chưa xác thực ⇒ UNAUTHENTICATED', async () => {
      const client = makeClient();
      const res = await gateway.handleJoinProject(client as never, { projectId: oid() });
      expect(res).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 4401,
        message: 'Chưa xác thực phiên realtime',
      });
    });

    it('projectId không phải ObjectId ⇒ INVALID_PROJECT_ID', async () => {
      const client = makeClient(identity);
      const res = await gateway.handleJoinProject(client as never, { projectId: 'abc' });
      expect(res).toEqual({ ok: false, error: 'INVALID_PROJECT_ID' });
    });

    it('payload rỗng ⇒ INVALID_PROJECT_ID', async () => {
      const client = makeClient(identity);
      const res = await gateway.handleJoinProject(client as never, {});
      expect(res).toEqual({ ok: false, error: 'INVALID_PROJECT_ID' });
    });

    it('projectId có khoảng trắng thừa ⇒ vẫn trim và hợp lệ', async () => {
      const projectId = oid();
      const client = makeClient(identity);
      const res = await gateway.handleJoinProject(client as never, { projectId: `  ${projectId}  ` });
      expect(res).toEqual({ ok: true, room: `project:${projectId}` });
    });

    it('user không có quyền trong project ⇒ FORBIDDEN', async () => {
      projects.resolveUserProjectRole.mockResolvedValue(null);
      const client = makeClient(identity);
      const res = await gateway.handleJoinProject(client as never, { projectId: oid() });
      expect(res).toEqual({ ok: false, error: 'FORBIDDEN' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('project không tồn tại (lỗi DB) ⇒ FORBIDDEN, không throw', async () => {
      projects.getProjectById.mockRejectedValue(new Error('db down'));
      const client = makeClient(identity);
      const res = await gateway.handleJoinProject(client as never, { projectId: oid() });
      expect(res).toEqual({ ok: false, error: 'FORBIDDEN' });
    });

    it('có quyền ⇒ join room project', async () => {
      const projectId = oid();
      const client = makeClient(identity);
      const res = await gateway.handleJoinProject(client as never, { projectId });

      expect(res).toEqual({ ok: true, room: `project:${projectId}` });
      expect(client.join).toHaveBeenCalledWith(`project:${projectId}`);
      // Vai trò workspace được truyền sang để suy luận viewer.
      expect(projects.resolveUserProjectRole).toHaveBeenCalled();
    });

    it('user là viewer vẫn được join (chỉ đọc)', async () => {
      projects.resolveUserProjectRole.mockResolvedValue('viewer' as never);
      const client = makeClient(identity);
      const res = await gateway.handleJoinProject(client as never, { projectId: oid() });
      expect(res.ok).toBe(true);
    });
  });

  // ─── joinAnalysis ────────────────────────────────────────────────────────

  describe('handleJoinAnalysis', () => {
    const identity = { userId: 'u1', email: 'a@b.c', role: 'user' };

    it('chưa xác thực ⇒ UNAUTHENTICATED', async () => {
      const client = makeClient();
      const res = await gateway.handleJoinAnalysis(client as never, {
        analysisId: oid(),
        projectId: oid(),
      });
      expect(res).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    });

    it('analysisId không hợp lệ ⇒ INVALID_ANALYSIS_ID', async () => {
      const client = makeClient(identity);
      const res = await gateway.handleJoinAnalysis(client as never, {
        analysisId: 'xyz',
        projectId: oid(),
      });
      expect(res).toEqual({ ok: false, error: 'INVALID_ANALYSIS_ID' });
    });

    it('projectId không hợp lệ ⇒ INVALID_PROJECT_ID', async () => {
      const client = makeClient(identity);
      const res = await gateway.handleJoinAnalysis(client as never, {
        analysisId: oid(),
        projectId: 'xyz',
      });
      expect(res).toEqual({ ok: false, error: 'INVALID_PROJECT_ID' });
    });

    it('không có quyền project ⇒ FORBIDDEN', async () => {
      projects.resolveUserProjectRole.mockResolvedValue(null);
      const client = makeClient(identity);
      const res = await gateway.handleJoinAnalysis(client as never, {
        analysisId: oid(),
        projectId: oid(),
      });
      expect(res).toEqual({ ok: false, error: 'FORBIDDEN' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('có quyền ⇒ join room analysis', async () => {
      const analysisId = oid();
      const client = makeClient(identity);
      const res = await gateway.handleJoinAnalysis(client as never, {
        analysisId,
        projectId: oid(),
      });
      expect(res).toEqual({ ok: true, room: `analysis:${analysisId}` });
      expect(client.join).toHaveBeenCalledWith(`analysis:${analysisId}`);
    });
  });

  // ─── leaveProject / leaveAnalysis ────────────────────────────────────────

  describe('leaveProject / leaveAnalysis', () => {
    it('leaveProject hợp lệ ⇒ rời room', async () => {
      const projectId = oid();
      const client = makeClient();
      const res = await gateway.handleLeaveProject(client as never, { projectId });
      expect(res).toEqual({ ok: true });
      expect(client.leave).toHaveBeenCalledWith(`project:${projectId}`);
    });

    it('leaveProject id không hợp lệ ⇒ không gọi leave', async () => {
      const client = makeClient();
      const res = await gateway.handleLeaveProject(client as never, { projectId: 'abc' });
      expect(res).toEqual({ ok: true });
      expect(client.leave).not.toHaveBeenCalled();
    });

    it('leaveAnalysis hợp lệ ⇒ rời room', async () => {
      const analysisId = oid();
      const client = makeClient();
      const res = await gateway.handleLeaveAnalysis(client as never, { analysisId });
      expect(res).toEqual({ ok: true });
      expect(client.leave).toHaveBeenCalledWith(`analysis:${analysisId}`);
    });

    it('leaveAnalysis id không hợp lệ ⇒ không gọi leave', async () => {
      const client = makeClient();
      const res = await gateway.handleLeaveAnalysis(client as never, { analysisId: 'abc' });
      expect(res).toEqual({ ok: true });
      expect(client.leave).not.toHaveBeenCalled();
    });
  });
});
