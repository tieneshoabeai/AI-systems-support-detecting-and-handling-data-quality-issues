import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interfaces/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/interfaces/middleware/request-id.middleware';
import { JwtAuthGuard } from '../../src/shared/interfaces/guards/jwt-auth.guard';
import { UsersController } from '../../src/modules/users/presentation/controllers/users.controller';
import { FindByIdHandler } from '../../src/modules/users/application/queries/find-by-id.handler';
import { UpdateProfileHandler } from '../../src/modules/users/application/commands/update-profile.handler';
import { SoftDeleteUserHandler } from '../../src/modules/users/application/commands/soft-delete-user.handler';
import { User } from '../../src/modules/users/domain/entities/user.entity';

const UID = '507f1f77bcf86cd799439011';
const MOCK_USER = { userId: UID, email: 'analyst@example.com', role: 'analyst', sessionId: 'sess-1' };
function userEntity() {
  return User.create({ id: UID, email: 'analyst@example.com', firstName: 'An', lastName: 'Nguyen' });
}

/**
 * E2E — Users/me (GET/PATCH/DELETE /users/me).
 * Controller thật + entity thật + handler mock.
 * Assert: không lộ passwordHash/googleId, phone sai -> 400, X-Request-Id luôn có.
 */
describe('E2E — Users/me', () => {
  let app: INestApplication;
  const findById = { execute: jest.fn() };
  const updateProfile = { execute: jest.fn() };
  const softDelete = { execute: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: FindByIdHandler, useValue: findById },
        { provide: UpdateProfileHandler, useValue: updateProfile },
        { provide: SoftDeleteUserHandler, useValue: softDelete },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: ExecutionContext) => { ctx.switchToHttp().getRequest().user = MOCK_USER; return true; } })
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

  it('GET /users/me 200 — envelope + không lộ bí mật', async () => {
    findById.execute.mockResolvedValue(userEntity());
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('analyst@example.com');
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.googleId).toBeUndefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /users/me 404 khi không tìm thấy', async () => {
    findById.execute.mockResolvedValue(null);
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH /users/me 200 — cập nhật hợp lệ; phone sai -> 400', async () => {
    updateProfile.execute.mockResolvedValue(userEntity());
    const ok = await request(app.getHttpServer()).patch('/users/me').send({ first_name: 'Binh', bio: 'hello' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.firstName).toBe('An');
    const bad = await request(app.getHttpServer()).patch('/users/me').send({ phone: 'khong-phai-sdt!!!' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE /users/me 200 — xóa mềm', async () => {
    softDelete.execute.mockResolvedValue(true);
    const res = await request(app.getHttpServer()).delete('/users/me');
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/xóa mềm/i);
  });
});
