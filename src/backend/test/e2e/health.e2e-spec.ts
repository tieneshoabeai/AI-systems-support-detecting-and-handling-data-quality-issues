import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Param } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/shared/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/middleware/request-id.middleware';

@Controller('workspaces')
class FakeWorkspacesController {
  @Get(':id')
  getOne(@Param('id') id: string): unknown {
    if (id === 'notfound') throw Object.assign(new Error('404'), { status: 404 });
    if (!/^[0-9a-f]{24}$/i.test(id)) {
      const { BadRequestException } = require('@nestjs/common');
      throw new BadRequestException({ message: 'ID khong hop le', error: 'VALIDATION_ERROR' } as never);
    }
    return { workspace: { id, name: 'Workspace mau' } };
  }
  @Get()
  list(): unknown {
    return { items: [], meta: { nextCursor: null, hasMore: false, limit: 15 } };
  }
}

describe('E2E hop dong API (Tang 5) - envelope + X-Request-Id + phan trang cursor', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({ controllers: [FakeWorkspacesController] }).compile();
    app = module.createNestApplication();
    const rid = new RequestIdMiddleware();
    app.use(rid.use.bind(rid));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });
  afterAll(async () => { await app?.close(); });

  it('GET /workspaces/:id hop le -> 200, envelope {success,data}, co X-Request-Id', async () => {
    const id = '507f1f77bcf86cd799439011';
    const res = await request(app.getHttpServer()).get(`/workspaces/${id}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.data.workspace.name).toBe('Workspace mau');
  });
  it('GET /workspaces/:id sai dinh dang -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer()).get('/workspaces/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.headers['x-request-id']).toBeDefined();
  });
  it('GET /workspaces list -> meta co nextCursor/hasMore/limit, KHONG co total/offset (v4)', async () => {
    const res = await request(app.getHttpServer()).get('/workspaces?limit=10');
    expect(res.status).toBe(200);
    const meta = res.body.data.meta ?? res.body.meta;
    expect(meta).toBeDefined();
    expect('nextCursor' in meta).toBe(true);
    expect('hasMore' in meta).toBe(true);
    expect('total' in meta).toBe(false);
    expect('offset' in meta).toBe(false);
  });
});
