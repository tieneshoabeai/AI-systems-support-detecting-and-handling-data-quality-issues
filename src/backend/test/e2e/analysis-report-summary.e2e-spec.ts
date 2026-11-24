import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interfaces/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/interfaces/middleware/request-id.middleware';
import { JwtAuthGuard } from '../../src/shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../src/shared/interfaces/casl/policies.guard';
import { AnalysisController } from '../../src/modules/analysis/presentation/controllers/analysis.controller';
import { SummaryController } from '../../src/modules/analysis/presentation/controllers/summary.controller';
import { ReportController } from '../../src/modules/analysis/presentation/controllers/report.controller';
import { RunAnalysisHandler } from '../../src/modules/analysis/application/commands/run-analysis.handler';
import { GetResultHandler } from '../../src/modules/analysis/application/queries/get-result.handler';
import { GetJobHandler } from '../../src/modules/analysis/application/queries/get-job.handler';
import { RetryJobHandler } from '../../src/modules/analysis/application/commands/retry-job.handler';
import { IngestAiResultHandler } from '../../src/modules/analysis/application/commands/ingest-ai-result.handler';
import { CreateSummaryHandler } from '../../src/modules/analysis/application/commands/create-summary.handler';
import { GetSummaryHandler } from '../../src/modules/analysis/application/queries/get-summary.handler';
import { RequestReportHandler } from '../../src/modules/analysis/application/commands/request-report.handler';
import { GetReportFileMetaHandler } from '../../src/modules/analysis/application/queries/get-report-file-meta.handler';
import { DownloadReportFileHandler } from '../../src/modules/analysis/application/queries/download-report-file.handler';
import { AUDIT_LOGGER_PORT } from '../../src/modules/audit';

const MOCK_USER = { userId: '507f1f77bcf86cd799439011', email: 'a@test.local', role: 'analyst', sessionId: 'sess-1' };
const PRJ = '507f1f77bcf86cd799439013';
const JOB = '507f1f77bcf86cd799439021';

/**
 * E2E — Analysis + Summary + Report.
 * Controller thật + handler mock.
 * Phủ: run 201 / result / job / retry 202 / ingest-ai-result /
 * summary create+get / report request 202 + download 202-chua-san-sang.
 */
describe('E2E — Analysis + Summary + Report', () => {
  let app: INestApplication;
  const run = { execute: jest.fn() };
  const result = { execute: jest.fn() };
  const job = { execute: jest.fn() };
  const retry = { execute: jest.fn() };
  const ingest = { execute: jest.fn() };
  const sumC = { execute: jest.fn() };
  const sumG = { execute: jest.fn() };
  const repR = { execute: jest.fn() };
  const repM = { execute: jest.fn() };
  const repD = { execute: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController, SummaryController, ReportController],
      providers: [
        { provide: RunAnalysisHandler, useValue: run },
        { provide: GetResultHandler, useValue: result },
        { provide: GetJobHandler, useValue: job },
        { provide: RetryJobHandler, useValue: retry },
        { provide: IngestAiResultHandler, useValue: ingest },
        { provide: CreateSummaryHandler, useValue: sumC },
        { provide: GetSummaryHandler, useValue: sumG },
        { provide: RequestReportHandler, useValue: repR },
        { provide: GetReportFileMetaHandler, useValue: repM },
        { provide: DownloadReportFileHandler, useValue: repD },
        { provide: AUDIT_LOGGER_PORT, useValue: { log: jest.fn() } },
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

  it('POST run 201 + GET result + job + retry 202 + ingest', async () => {
    run.execute.mockResolvedValue({ jobId: JOB, status: 'done' });
    const r = await request(app.getHttpServer()).post(`/projects/${PRJ}/analysis`).send({ correlation_method: 'pearson', outlier_method: 'iqr', top_n: 10 });
    expect(r.status).toBe(201);
    const bad = await request(app.getHttpServer()).post(`/projects/${PRJ}/analysis`).send({ top_n: 9999 });
    expect(bad.status).toBe(400);
    result.execute.mockResolvedValue({ projectId: PRJ, findings: [] });
    expect((await request(app.getHttpServer()).get(`/projects/${PRJ}/analysis/result`)).status).toBe(200);
    job.execute.mockResolvedValue({ id: JOB, status: 'done' });
    expect((await request(app.getHttpServer()).get(`/analysis/jobs/${JOB}`)).status).toBe(200);
    retry.execute.mockResolvedValue({ id: JOB, status: 'queued' });
    expect((await request(app.getHttpServer()).post(`/analysis/jobs/${JOB}/retry`)).status).toBe(202);
    ingest.execute.mockResolvedValue({ ok: true });
    expect((await request(app.getHttpServer()).post(`/analysis/jobs/${JOB}/result`).send({ result: {} })).status).toBe(200);
  });

  it('summary create 201 + get + report request 202 + download 202-chua-san-sang', async () => {
    sumC.execute.mockResolvedValue({ id: 'sum-1' });
    expect((await request(app.getHttpServer()).post(`/projects/${PRJ}/summary`)).status).toBe(201);
    sumG.execute.mockResolvedValue({ id: 'sum-1' });
    const g = await request(app.getHttpServer()).get(`/projects/${PRJ}/summary`);
    expect(g.status).toBe(200);
    expect(g.headers['x-request-id']).toBeDefined();
    repR.execute.mockResolvedValue({ reportId: 'rep-1', status: 'queued' });
    expect((await request(app.getHttpServer()).post(`/projects/${PRJ}/report`)).status).toBe(202);
    repM.execute.mockResolvedValue({ reportId: 'rep-1', status: 'pending' });
    const dl = await request(app.getHttpServer()).get(`/projects/${PRJ}/report/rep-1/file`);
    expect(dl.status).toBe(202);
  });
});
