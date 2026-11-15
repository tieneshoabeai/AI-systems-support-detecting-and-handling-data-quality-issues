import { Types } from 'mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import {
  RealtimeRooms,
  assertNoSensitiveData,
  buildEnvelope,
} from '../src/modules/realtime/domain/realtime-events';
import { RealtimeService } from '../src/modules/realtime/application/realtime.service';

describe('REALTIME-01: envelope + room + no-sensitive-data', () => {
  it('room đặt tên đúng user/project/analysis', () => {
    const uid = new Types.ObjectId().toHexString();
    expect(RealtimeRooms.user(uid)).toBe(`user:${uid}`);
    expect(RealtimeRooms.project('p1')).toBe('project:p1');
    expect(RealtimeRooms.analysis('a1')).toBe('analysis:a1');
  });

  it('buildEnvelope chỉ chứa id + trạng thái, không chứa dữ liệu nhạy cảm', () => {
    const e = buildEnvelope('analysis.completed', {
      projectId: 'p1',
      analysisId: 'a1',
      status: 'succeeded',
    });
    expect(e.event).toBe('analysis.completed');
    expect(e.projectId).toBe('p1');
    expect(e.analysisId).toBe('a1');
    expect('reason' in e).toBe(false);
  });

  it('chặn payload chứa trường nhạy cảm (reason/email/value)', () => {
    expect(() =>
      assertNoSensitiveData({ event: 'feedback.created', reason: 'abc' } as unknown as Record<string, unknown>),
    ).toThrow();
    expect(() =>
      buildEnvelope('notification.created', {
        notificationId: 'n1',
        notificationType: 'issue_resolved',
      }),
    ).not.toThrow();
  });

  it('emit không bao giờ ném lỗi khi chưa gắn server (luồng nghiệp vụ an toàn)', async () => {
    const m: TestingModule = await Test.createTestingModule({
      providers: [RealtimeService],
    }).compile();
    const svc = m.get<RealtimeService>(RealtimeService);
    expect(() =>
      svc.emitAnalysisLifecycle('p1', 'a1', 'analysis.completed', { status: 'succeeded' }),
    ).not.toThrow();
    expect(() => svc.emitToUser('u1', 'notification.created', { notificationId: 'n1' })).not.toThrow();
  });

  it('extractToken ưu tiên auth.token, fallback query ?token=', async () => {
    const { RealtimeAuthService } = await import('../src/modules/realtime/application/realtime-auth.service');
    const svc = new RealtimeAuthService(
      { verifyAsync: async () => ({}) } as never,
      { get: () => 'secret' } as never,
      { findById: async () => null } as never,
    );
    expect(svc.extractToken({ auth: { token: ' abc ' }, query: {} })).toBe('abc');
    expect(svc.extractToken({ auth: {}, query: { token: 'q1' } })).toBe('q1');
    expect(svc.extractToken({ auth: {}, query: {} })).toBeNull();
  });
});
