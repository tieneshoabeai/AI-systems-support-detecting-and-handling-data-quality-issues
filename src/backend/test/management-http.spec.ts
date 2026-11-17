import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { WorkspacesController } from '../src/modules/workspaces/infrastructure/http/workspaces.controller';
import { WorkspacesService } from '../src/modules/workspaces/application/workspaces.service';
import { WORKSPACE_REPOSITORY_PORT } from '../src/modules/workspaces/domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';

// HTTP integration: real controller, validation, membership guard and service; persistence is isolated.
describe('manager HTTP boundaries', () => {
  let app: INestApplication;
  let actor = '507f1f77bcf86cd799439012';
  const id = '507f1f77bcf86cd799439011';
  const owner = actor;
  const workspace = { id, ownerId: owner, name: 'Team', version: 1, members: [{ userId: owner, role: 'owner' }] };
  const repo = {
    findById: jest.fn(async () => workspace),
    create: jest.fn(async () => workspace),
    updateById: jest.fn(async () => ({ ...workspace, name: 'Updated' })),
    findByUserPaged: jest.fn(async () => ({ items: [workspace], total: 1 })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [WorkspacesController], providers: [WorkspacesService,
      { provide: WORKSPACE_REPOSITORY_PORT, useValue: repo },
      { provide: USER_REPOSITORY_PORT, useValue: {} },
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: ExecutionContext) => {
      ctx.switchToHttp().getRequest().user = { userId: actor, role: 'analyst' }; return true;
    } }).compile();
    app = module.createNestApplication(); await app.init();
  });
  afterAll(async () => { await app?.close(); });
  it('creates and reads a workspace with an ordinary identity-only JWT', async () => {
    await request(app.getHttpServer()).post('/workspaces').send({ name: 'Team' }).expect(201);
    const response = await request(app.getHttpServer()).get('/workspaces').expect(200);
    expect(response.body.items[0].id).toBe(id);
  });
  it('validates input before creating a workspace', async () => {
    const count = repo.create.mock.calls.length;
    await request(app.getHttpServer()).post('/workspaces').send({ name: '' }).expect(400);
    expect(repo.create.mock.calls.length).toBe(count);
  });
  it('blocks cross-workspace writes before persistence', async () => {
    actor = '507f1f77bcf86cd799439099';
    await request(app.getHttpServer()).patch(`/workspaces/${id}`).send({ name: 'Intrusion', expectedVersion: 1 }).expect(403);
    expect(repo.updateById).not.toHaveBeenCalled();
    actor = owner;
    await request(app.getHttpServer()).patch(`/workspaces/${id}`).send({ name: 'Updated', expectedVersion: 1 }).expect(200);
  });
});
