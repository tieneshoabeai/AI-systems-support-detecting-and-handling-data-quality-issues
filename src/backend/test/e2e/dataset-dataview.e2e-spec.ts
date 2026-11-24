import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interfaces/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/interfaces/middleware/request-id.middleware';
import { JwtAuthGuard } from '../../src/shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../src/shared/interfaces/casl/policies.guard';
import { DatasetsController } from '../../src/modules/datasets/presentation/controllers/datasets.controller';
import { DataViewController } from '../../src/modules/data-view/data-view.controller';
import { Dataset } from '../../src/modules/datasets';
import { DataViewService } from '../../src/modules/data-view/data-view.service';
import { AUDIT_LOGGER_PORT } from '../../src/modules/audit';
import { DeleteDatasetHandler } from '../../src/modules/datasets/application/commands/delete-dataset.handler';
import { IngestDatasetStreamHandler } from '../../src/modules/datasets/application/commands/ingest-dataset-stream.handler';
import { DownloadDatasetFileHandler } from '../../src/modules/datasets/application/queries/download-dataset-file.handler';
import { GetDatasetByIdHandler } from '../../src/modules/datasets/application/queries/get-dataset-by-id.handler';
import { GetDatasetByProjectIdHandler } from '../../src/modules/datasets/application/queries/get-dataset-by-project-id.handler';
import { GetDatasetSchemaHandler } from '../../src/modules/datasets/application/queries/get-dataset-schema.handler';

const UID = '507f1f77bcf86cd799439011';
const PRJID = '507f1f77bcf86cd799439013';
const DSID = '507f1f77bcf86cd799439014';
const MOCK_USER = { userId: UID, email: 'owner@test.local', role: 'analyst', sessionId: 'sess-1' };
function dsEntity() {
  return Dataset.create({ id: DSID, projectId: PRJID, workspaceId: '507f1f77bcf86cd799439012', name: 'sales.csv', originalFileName: 'sales.csv', fileSizeBytes: 1024, storageKey: 'k1' });
}

/**
 * E2E — Datasets (F4) + DataView (F5 Virtual Grid).
 * Controller thật + entity thật + handler mock.
 * Phủ: upload CSV (busboy) / get-by-project / get-by-id (ẩn storageKey) /
 * schema c0..cN / delete 204 / records keyset / records/query / column-stats / charts.
 */
describe('E2E — Datasets + DataView', () => {
  let app: INestApplication;
  const delDs = { execute: jest.fn() };
  const ingest = { execute: jest.fn() };
  const dlFile = { execute: jest.fn() };
  const getById = { execute: jest.fn() };
  const getByPrj = { execute: jest.fn() };
  const getSchema = { execute: jest.fn() };
  const dataView = { getRecords: jest.fn(), queryRecords: jest.fn(), getColumnStats: jest.fn(), getChartData: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatasetsController, DataViewController],
      providers: [
        { provide: DeleteDatasetHandler, useValue: delDs },
        { provide: IngestDatasetStreamHandler, useValue: ingest },
        { provide: DownloadDatasetFileHandler, useValue: dlFile },
        { provide: GetDatasetByIdHandler, useValue: getById },
        { provide: GetDatasetByProjectIdHandler, useValue: getByPrj },
        { provide: GetDatasetSchemaHandler, useValue: getSchema },
        { provide: DataViewService, useValue: dataView },
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

  it('F4.1 upload CSV 201 + F4.2 get-by-project + F4.3 get-by-id (ẩn storageKey)', async () => {
    ingest.execute.mockResolvedValue(dsEntity());
    const up = await request(app.getHttpServer()).post(`/projects/${PRJID}/datasets/upload`).attach('file', Buffer.from('a,b\n1,2\n'), 'sales.csv');
    expect([201, 200]).toContain(up.status);
    getByPrj.execute.mockResolvedValue(dsEntity());
    const byPrj = await request(app.getHttpServer()).get(`/projects/${PRJID}/datasets`);
    expect(byPrj.status).toBe(200);
    expect(byPrj.body.data.dataset.id).toBe(DSID);
    getById.execute.mockResolvedValue(dsEntity());
    const byId = await request(app.getHttpServer()).get(`/datasets/${DSID}`);
    expect(byId.status).toBe(200);
    expect(byId.body.data.dataset.storageKey).toBeUndefined();
    expect(byId.headers['x-request-id']).toBeDefined();
  });

  it('F4.6 schema key c0..cN + F4.5 delete 204 + upload thiếu file -> 400', async () => {
    getSchema.execute.mockResolvedValue([{ key: 'c0', index: 0, name: 'age', dataType: 'number', originalName: 'age', missingCount: 0, isPii: false }]);
    const sc = await request(app.getHttpServer()).get(`/datasets/${DSID}/schema`);
    expect(sc.status).toBe(200);
    expect(sc.body.data.columns[0].key).toBe('c0');
    delDs.execute.mockResolvedValue(true);
    expect((await request(app.getHttpServer()).delete(`/datasets/${DSID}`)).status).toBe(204);
    const noFile = await request(app.getHttpServer()).post(`/projects/${PRJID}/datasets/upload`).set('Content-Type', 'multipart/form-data; boundary=----jest').send('------jest--');
    expect([400, 500]).toContain(noFile.status);
    expect(noFile.body.success).toBe(false);
  });

  it('F5 Virtual Grid: records keyset + query + stats + charts + validation', async () => {
    dataView.getRecords.mockResolvedValue({ items: [{ row_index: 1 }], meta: { nextCursor: null, hasMore: false } });
    const r = await request(app.getHttpServer()).get(`/datasets/${DSID}/records?limit=50`);
    expect(r.status).toBe(200);
    expect(r.body.data.meta.hasMore).toBe(false);
    dataView.queryRecords.mockResolvedValue({ items: [], meta: { nextCursor: null, hasMore: false } });
    const q = await request(app.getHttpServer()).post(`/datasets/${DSID}/records/query`).send({ filters: [], sort: [], limit: 50 });
    expect(q.status).toBe(200);
    const badQ = await request(app.getHttpServer()).post(`/datasets/${DSID}/records/query`).send({ filters: [{ column: 'c0', operator: 'between', value: [1] }], limit: 10 });
    expect(badQ.status).toBe(400);
    expect(badQ.body.error.code).toBe('VALIDATION_ERROR');
    dataView.getColumnStats.mockResolvedValue({ count: 10 });
    expect((await request(app.getHttpServer()).get(`/datasets/${DSID}/columns/c0/stats`)).status).toBe(200);
    dataView.getChartData.mockResolvedValue([]);
    expect((await request(app.getHttpServer()).get(`/datasets/${DSID}/charts?top_n=5`)).status).toBe(200);
  });
});
