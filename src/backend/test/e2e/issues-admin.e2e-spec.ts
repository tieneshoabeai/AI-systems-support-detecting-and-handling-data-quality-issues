import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interfaces/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/interfaces/middleware/request-id.middleware';
import { JwtAuthGuard } from '../../src/shared/interfaces/guards/jwt-auth.guard';
import { IssuesController } from '../../src/modules/issues/presentation/controllers/issues.controller';
import { CreateReportHandler } from '../../src/modules/issues/application/commands/create-report.handler';
import { ListMineHandler } from '../../src/modules/issues/application/queries/list-mine.handler';
import { GetMineHandler } from '../../src/modules/issues/application/queries/get-mine.handler';
import { UpdateMyReportHandler } from '../../src/modules/issues/application/commands/update-my-report.handler';
import { ListForAdminHandler } from '../../src/modules/issues/application/queries/list-for-admin.handler';
import { GetForAdminHandler } from '../../src/modules/issues/application/queries/get-for-admin.handler';
import { UpdateStatusHandler } from '../../src/modules/issues/application/commands/update-status.handler';
import { UploadAttachmentHandler } from '../../src/modules/issues/application/commands/upload-attachment.handler';
import { DownloadAttachmentHandler } from '../../src/modules/issues/application/queries/download-attachment.handler';
import { AUDIT_LOGGER_PORT } from '../../src/modules/audit';
import { ValidationError } from '../../src/shared/domain/errors';

let CURRENT_ROLE: 'analyst' | 'admin' = 'analyst';
const UID = '507f1f77bcf86cd799439011';
const ISSUE_ID = '507f1f77bcf86cd799439031';

/**
 * E2E — Issues (ISSUE-01..04 + EDIT + admin).
 * Controller thật + handler mock. Giữ RolesGuard thật để kiểm tra 403 admin.
 * Phủ: tạo/list/chi-tiết/sửa (needs_info)/admin list/get/status + validation + optimistic-locking.
 */
describe('E2E — Issues + Admin', () => {
  let app: INestApplication;
  const create = { execute: jest.fn() };
  const listMine = { execute: jest.fn() };
  const getMine = { execute: jest.fn() };
  const updateMine = { execute: jest.fn() };
  const listAdmin = { execute: jest.fn() };
  const getAdmin = { execute: jest.fn() };
  const updateStatus = { execute: jest.fn() };
  const upload = { execute: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IssuesController],
      providers: [
        { provide: CreateReportHandler, useValue: create },
        { provide: ListMineHandler, useValue: listMine },
        { provide: GetMineHandler, useValue: getMine },
        { provide: UpdateMyReportHandler, useValue: updateMine },
        { provide: ListForAdminHandler, useValue: listAdmin },
        { provide: GetForAdminHandler, useValue: getAdmin },
        { provide: UpdateStatusHandler, useValue: updateStatus },
        { provide: UploadAttachmentHandler, useValue: upload },
        { provide: DownloadAttachmentHandler, useValue: { execute: jest.fn() } },
        { provide: AUDIT_LOGGER_PORT, useValue: { log: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: ExecutionContext) => { ctx.switchToHttp().getRequest().user = { userId: UID, email: 'a@test.local', role: CURRENT_ROLE, sessionId: 'sess-1' }; return true; } })
      .compile();
    app = module.createNestApplication();
    const rid = new RequestIdMiddleware();
    app.use(rid.use.bind(rid));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { jest.clearAllMocks(); CURRENT_ROLE = 'analyst'; });

  it('ISSUE-01 tạo 201 + validation issueType/title + list mine cursor', async () => {
    create.execute.mockResolvedValue({ id: ISSUE_ID, status: 'new' });
    const ok = await request(app.getHttpServer()).post('/issues').send({ issueType: 'data_error', title: 'Số liệu sai', description: 'Mô tả chi tiết' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.id).toBe(ISSUE_ID);
    const bad = await request(app.getHttpServer()).post('/issues').send({ issueType: 'khong-hop-le', title: '', description: '' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    listMine.execute.mockResolvedValue({ items: [{ id: ISSUE_ID }], meta: { nextCursor: null, hasMore: false } });
    const l = await request(app.getHttpServer()).get('/issues?limit=10');
    expect(l.status).toBe(200);
    expect('total' in (l.body.data.meta ?? {})).toBe(false);
  });

  it('ISSUE-03 chi tiết + ISSUE-EDIT sửa khi needs_info (thiếu expectedVersion -> 400)', async () => {
    getMine.execute.mockResolvedValue({ id: ISSUE_ID, status: 'needs_info' });
    expect((await request(app.getHttpServer()).get(`/issues/${ISSUE_ID}`)).status).toBe(200);
    updateMine.execute.mockResolvedValue({ id: ISSUE_ID, status: 'in_progress' });
    const ok = await request(app.getHttpServer()).patch(`/issues/${ISSUE_ID}`).send({ title: 'Tiêu đề mới', expectedVersion: 2 });
    expect(ok.status).toBe(200);
    const missing = await request(app.getHttpServer()).patch(`/issues/${ISSUE_ID}`).send({ title: 'Thiếu version' });
    expect(missing.status).toBe(400);
  });

  it('ISSUE-04 admin: analyst bị 403, admin xem list/get/đổi status (optimistic-locking)', async () => {
    CURRENT_ROLE = 'analyst';
    expect((await request(app.getHttpServer()).get('/admin/issues')).status).toBe(403);
    CURRENT_ROLE = 'admin';
    listAdmin.execute.mockResolvedValue({ items: [{ id: ISSUE_ID }], meta: { nextCursor: null, hasMore: false } });
    expect((await request(app.getHttpServer()).get('/admin/issues?limit=10')).status).toBe(200);
    getAdmin.execute.mockResolvedValue({ id: ISSUE_ID, status: 'new' });
    expect((await request(app.getHttpServer()).get(`/admin/issues/${ISSUE_ID}`)).status).toBe(200);
    updateStatus.execute.mockResolvedValue({ id: ISSUE_ID, status: 'in_progress' });
    const ok = await request(app.getHttpServer()).patch(`/admin/issues/${ISSUE_ID}/status`).send({ status: 'in_progress', expectedVersion: 1 });
    expect(ok.status).toBe(200);
    updateStatus.execute.mockRejectedValueOnce(new ValidationError('Phiên bản đã cũ, vui lòng tải lại'));
    const stale = await request(app.getHttpServer()).patch(`/admin/issues/${ISSUE_ID}/status`).send({ status: 'resolved', expectedVersion: 1 });
    expect(stale.status).toBe(400);
    expect(stale.body.error.code).toBe('VALIDATION_ERROR');
  });
});
