import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interfaces/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/interfaces/middleware/request-id.middleware';
import { JwtAuthGuard } from '../../src/shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../src/shared/interfaces/casl/policies.guard';
import { FeedbackController } from '../../src/modules/feedback/feedback.controller';
import { FeedbackService } from '../../src/modules/feedback/feedback.service';
import { NotificationsController } from '../../src/modules/notifications/notifications.controller';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { OverviewController } from '../../src/modules/overview/overview.controller';
import { OverviewService } from '../../src/modules/overview/overview.service';
import { ForbiddenError } from '../../src/shared/domain/errors';

const MOCK_USER = { userId: '507f1f77bcf86cd799439011', email: 'a@test.local', role: 'analyst', sessionId: 'sess-1' };
const ANALYSIS_ID = '507f1f77bcf86cd799439021';
const FINDING_ID = 'f-corr-01';
const PRJ = '507f1f77bcf86cd799439013';
const WSID = '507f1f77bcf86cd799439012';

/**
 * E2E — Feedback (FB-01..06) + Notifications (NOTIF-01..03) + Overview (E3/E4).
 * Controller thật + service mock.
 * Phủ: tạo/sửa/xóa feedback + reason bắt buộc + admin bị chặn (403) /
 * list/unread/detail/read/preferences / user-overview + workspace-overview + X-Request-Id.
 */
describe('E2E — Feedback + Notifications + Overview', () => {
  let app: INestApplication;
  const feedback = { createFindingFeedback: jest.fn(), createRunFeedback: jest.fn(), listFindingFeedback: jest.fn(), listRunFeedback: jest.fn(), updateMine: jest.fn(), remove: jest.fn(), aiQualityMetrics: jest.fn() };
  const notif = { listForUser: jest.fn(), countUnread: jest.fn(), getDetail: jest.fn(), markAsRead: jest.fn(), updatePreferences: jest.fn() };
  const overview = { getUserOverview: jest.fn(), getWorkspaceOverview: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController, NotificationsController, OverviewController],
      providers: [
        { provide: FeedbackService, useValue: feedback },
        { provide: NotificationsService, useValue: notif },
        { provide: OverviewService, useValue: overview },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: ExecutionContext) => { ctx.switchToHttp().getRequest().user = MOCK_USER; return true; } })
      .overrideGuard(PoliciesGuard).useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    const rid = new RequestIdMiddleware();
    app.use(rid.use.bind(rid));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => jest.clearAllMocks());

  it('FB-01/02 tạo feedback + reason bắt buộc (false_positive thiếu reason -> 400)', async () => {
    feedback.createFindingFeedback.mockResolvedValue({ id: 'fb-1' });
    const ok = await request(app.getHttpServer()).post(`/analyses/${ANALYSIS_ID}/findings/${FINDING_ID}/feedback`).send({ label: 'correct', reason: 'đồng ý' });
    expect(ok.status).toBe(201);
    const bad = await request(app.getHttpServer()).post(`/analyses/${ANALYSIS_ID}/findings/${FINDING_ID}/feedback`).send({ label: 'false_positive' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    feedback.createRunFeedback.mockResolvedValue({ id: 'fb-2' });
    expect((await request(app.getHttpServer()).post(`/analyses/${ANALYSIS_ID}/feedback`).send({ label: 'correct' })).status).toBe(201);
  });

  it('FB-03/04 xem + FB-05 sửa/xóa + FB-06 metrics (admin bị 403)', async () => {
    feedback.listFindingFeedback.mockResolvedValue({ items: [], meta: { nextCursor: null, hasMore: false }, summary: {} });
    expect((await request(app.getHttpServer()).get(`/analyses/${ANALYSIS_ID}/findings/${FINDING_ID}/feedback`)).status).toBe(200);
    feedback.listRunFeedback.mockResolvedValue({ items: [], meta: { nextCursor: null, hasMore: false }, summary: {} });
    const l = await request(app.getHttpServer()).get(`/analyses/${ANALYSIS_ID}/feedback`);
    expect(l.status).toBe(200);
    expect(l.headers['x-request-id']).toBeDefined();
    feedback.updateMine.mockResolvedValue({ id: 'fb-1' });
    expect((await request(app.getHttpServer()).patch('/feedback/fb-1').send({ label: 'correct' })).status).toBe(200);
    const emptyPatch = await request(app.getHttpServer()).patch('/feedback/fb-1').send({});
    expect(emptyPatch.status).toBe(400);
    feedback.remove.mockResolvedValue({ deleted: true });
    expect((await request(app.getHttpServer()).delete('/feedback/fb-1')).status).toBe(200);
    feedback.aiQualityMetrics.mockRejectedValueOnce(new ForbiddenError('System Admin không có quyền với nhóm nhận xét'));
    expect((await request(app.getHttpServer()).get(`/projects/${PRJ}/ai-quality-metrics`)).status).toBe(403);
    feedback.aiQualityMetrics.mockResolvedValue({ total: 10 });
    expect((await request(app.getHttpServer()).get(`/projects/${PRJ}/ai-quality-metrics`)).status).toBe(200);
  });

  it('NOTIF-01 list/unread + NOTIF-02 detail/read + NOTIF-03 preferences', async () => {
    notif.listForUser.mockResolvedValue({ items: [], meta: { nextCursor: null, hasMore: false }, unreadCount: 0 });
    expect((await request(app.getHttpServer()).get('/notifications?limit=10')).status).toBe(200);
    notif.countUnread.mockResolvedValue({ unreadCount: 3 });
    const u = await request(app.getHttpServer()).get('/notifications/unread-count');
    expect(u.status).toBe(200);
    expect(u.body.data.unreadCount).toBe(3);
    notif.getDetail.mockResolvedValue({ id: 'n-1', read: true });
    expect((await request(app.getHttpServer()).get('/notifications/n-1')).status).toBe(200);
    notif.markAsRead.mockResolvedValue({ id: 'n-1', read: true });
    expect((await request(app.getHttpServer()).patch('/notifications/n-1/read')).status).toBe(200);
    notif.updatePreferences.mockResolvedValue({ notificationsEnabled: false });
    expect((await request(app.getHttpServer()).patch('/users/me/notification-preferences').send({ notificationsEnabled: false })).status).toBe(200);
    const badPref = await request(app.getHttpServer()).patch('/users/me/notification-preferences').send({});
    expect(badPref.status).toBe(400);
  });

  it('E3 user-overview 5 chỉ số + E4 workspace-overview', async () => {
    overview.getUserOverview.mockResolvedValue({ totalWorkspaces: 2, totalProjects: 3, ownedWorkspaces: 1, sharedWorkspaces: 1, myProjects: 3 });
    const e3 = await request(app.getHttpServer()).get('/overview/workspaces');
    expect(e3.status).toBe(200);
    expect(e3.body.data.totalWorkspaces).toBe(2);
    expect(e3.body.data.myProjects).toBe(3);
    overview.getWorkspaceOverview.mockResolvedValue({ workspaceId: WSID, projectCount: 2, notStartedCount: 0, inProgressCount: 1, completedCount: 1, memberCount: 2, storageUsedBytes: 1024, lastAccessedAt: null });
    const e4 = await request(app.getHttpServer()).get(`/workspaces/${WSID}/overview`);
    expect(e4.status).toBe(200);
    expect(e4.body.data.projectCount).toBe(2);
    expect(e4.headers['x-request-id']).toBeDefined();
  });
});
