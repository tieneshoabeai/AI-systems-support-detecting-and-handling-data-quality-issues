import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interfaces/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/interfaces/middleware/request-id.middleware';
import { JwtAuthGuard } from '../../src/shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../src/shared/interfaces/casl/policies.guard';
import { WorkspacesController } from '../../src/modules/workspaces/presentation/controllers/workspaces.controller';
import { ProjectsController } from '../../src/modules/projects/presentation/controllers/projects.controller';
import { Workspace } from '../../src/modules/workspaces';
import { Project } from '../../src/modules/projects';
import { CreateWorkspaceHandler } from '../../src/modules/workspaces/application/commands/create-workspace.handler';
import { ListWorkspacesHandler } from '../../src/modules/workspaces/application/queries/list-workspaces.handler';
import { GetWorkspaceByIdHandler } from '../../src/modules/workspaces/application/queries/get-workspace-by-id.handler';
import { UpdateWorkspaceHandler } from '../../src/modules/workspaces/application/commands/update-workspace.handler';
import { DeleteWorkspaceHandler } from '../../src/modules/workspaces/application/commands/delete-workspace.handler';
import { ListMembersHandler as WsListMembersHandler } from '../../src/modules/workspaces/application/queries/list-members.handler';
import { AddMemberHandler as WsAddMemberHandler } from '../../src/modules/workspaces/application/commands/add-member.handler';
import { RemoveMemberHandler as WsRemoveMemberHandler } from '../../src/modules/workspaces/application/commands/remove-member.handler';
import { TransferOwnerHandler as WsTransferOwnerHandler } from '../../src/modules/workspaces/application/commands/transfer-owner.handler';
import { LeaveWorkspaceHandler } from '../../src/modules/workspaces/application/commands/leave-workspace.handler';
import { CreateProjectHandler } from '../../src/modules/projects/application/commands/create-project.handler';
import { ListProjectsByWorkspaceHandler } from '../../src/modules/projects/application/queries/list-projects-by-workspace.handler';
import { ListAllProjectsHandler } from '../../src/modules/projects/application/queries/list-all-projects.handler';
import { GetProjectByIdHandler } from '../../src/modules/projects/application/queries/get-project-by-id.handler';
import { UpdateProjectHandler } from '../../src/modules/projects/application/commands/update-project.handler';
import { DeleteProjectHandler } from '../../src/modules/projects/application/commands/delete-project.handler';
import { MarkCompletedHandler } from '../../src/modules/projects/application/commands/mark-completed.handler';
import { GetWorkspaceNameHandler } from '../../src/modules/projects/application/queries/get-workspace-name.handler';
import { ListMembersHandler as PrjListMembersHandler } from '../../src/modules/projects/application/queries/list-members.handler';
import { AddProjectMemberHandler } from '../../src/modules/projects/application/commands/add-project-member.handler';
import { RemoveProjectMemberHandler } from '../../src/modules/projects/application/commands/remove-project-member.handler';
import { UpdateProjectMemberRoleHandler } from '../../src/modules/projects/application/commands/update-project-member-role.handler';
import { TransferProjectOwnerHandler } from '../../src/modules/projects/application/commands/transfer-project-owner.handler';

const UID = '507f1f77bcf86cd799439011';
const WSID = '507f1f77bcf86cd799439012';
const PRJID = '507f1f77bcf86cd799439013';
const MOCK_USER = { userId: UID, email: 'owner@test.local', role: 'analyst', sessionId: 'sess-1' };

function wsEntity(): Workspace {
  return Workspace.create({ id: WSID, name: 'WS Mau', description: 'mo ta', ownerId: UID });
}
function prjEntity(): Project {
  return Project.create({ id: PRJID, workspaceId: WSID, name: 'PRJ Mau', description: 'mo ta', createdBy: UID });
}
function allowUser() {
  return { canActivate: (ctx: ExecutionContext) => { ctx.switchToHttp().getRequest().user = MOCK_USER; return true; } };
}

describe('E2E — Workspace + Project (WS-01..10, PROJ-01..12)', () => {
  let app: INestApplication;
  const wsCreate = { execute: jest.fn() };
  const wsList = { execute: jest.fn() };
  const wsGet = { execute: jest.fn() };
  const wsUpdate = { execute: jest.fn() };
  const wsDelete = { execute: jest.fn() };
  const wsMembers = { execute: jest.fn() };
  const wsAdd = { execute: jest.fn() };
  const wsRemove = { execute: jest.fn() };
  const wsTransfer = { execute: jest.fn() };
  const wsLeave = { execute: jest.fn() };
  const prjCreate = { execute: jest.fn() };
  const prjListByWs = { execute: jest.fn() };
  const prjListAll = { execute: jest.fn() };
  const prjGet = { execute: jest.fn() };
  const prjUpdate = { execute: jest.fn() };
  const prjDelete = { execute: jest.fn() };
  const prjSnap = { execute: jest.fn() };
  const prjWsName = { execute: jest.fn() };
  const prjMembers = { execute: jest.fn() };
  const prjAdd = { execute: jest.fn() };
  const prjRemove = { execute: jest.fn() };
  const prjRole = { execute: jest.fn() };
  const prjTransfer = { execute: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController, ProjectsController],
      providers: [
        { provide: CreateWorkspaceHandler, useValue: wsCreate },
        { provide: ListWorkspacesHandler, useValue: wsList },
        { provide: GetWorkspaceByIdHandler, useValue: wsGet },
        { provide: UpdateWorkspaceHandler, useValue: wsUpdate },
        { provide: DeleteWorkspaceHandler, useValue: wsDelete },
        { provide: WsListMembersHandler, useValue: wsMembers },
        { provide: WsAddMemberHandler, useValue: wsAdd },
        { provide: WsRemoveMemberHandler, useValue: wsRemove },
        { provide: WsTransferOwnerHandler, useValue: wsTransfer },
        { provide: LeaveWorkspaceHandler, useValue: wsLeave },
        { provide: CreateProjectHandler, useValue: prjCreate },
        { provide: ListProjectsByWorkspaceHandler, useValue: prjListByWs },
        { provide: ListAllProjectsHandler, useValue: prjListAll },
        { provide: GetProjectByIdHandler, useValue: prjGet },
        { provide: UpdateProjectHandler, useValue: prjUpdate },
        { provide: DeleteProjectHandler, useValue: prjDelete },
        { provide: MarkCompletedHandler, useValue: prjSnap },
        { provide: GetWorkspaceNameHandler, useValue: prjWsName },
        { provide: PrjListMembersHandler, useValue: prjMembers },
        { provide: AddProjectMemberHandler, useValue: prjAdd },
        { provide: RemoveProjectMemberHandler, useValue: prjRemove },
        { provide: UpdateProjectMemberRoleHandler, useValue: prjRole },
        { provide: TransferProjectOwnerHandler, useValue: prjTransfer },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowUser())
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

  it('WS-01 tao + WS-02 list cursor + WS-03 chi tiet + WS-04 sua + validation', async () => {
    wsCreate.execute.mockResolvedValue(wsEntity());
    const c = await request(app.getHttpServer()).post('/workspaces').send({ name: 'WS Mau' });
    expect(c.status).toBe(201);
    expect(c.body.data.workspace.name).toBe('WS Mau');
    const bad = await request(app.getHttpServer()).post('/workspaces').send({ name: '' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    wsList.execute.mockResolvedValue({ items: [wsEntity()], meta: { nextCursor: null, hasMore: false, limit: 15 } });
    const l = await request(app.getHttpServer()).get('/workspaces?limit=15');
    expect(l.status).toBe(200);
    expect(l.body.data.meta.hasMore).toBe(false);
    expect('total' in l.body.data.meta).toBe(false);

    wsGet.execute.mockResolvedValue(wsEntity());
    const g = await request(app.getHttpServer()).get(`/workspaces/${WSID}`);
    expect(g.status).toBe(200);
    expect(g.headers['x-request-id']).toBeDefined();

    wsUpdate.execute.mockResolvedValue(wsEntity());
    const u = await request(app.getHttpServer()).patch(`/workspaces/${WSID}`).send({ name: 'WS Moi' });
    expect(u.status).toBe(200);
  });

  it('WS members + transfer + leave + WS-05 xoa 204', async () => {
    wsMembers.execute.mockResolvedValue({ items: [], meta: { nextCursor: null, hasMore: false } });
    expect((await request(app.getHttpServer()).get(`/workspaces/${WSID}/members`)).status).toBe(200);
    wsAdd.execute.mockResolvedValue({ workspace: wsEntity(), invited: false });
    const a = await request(app.getHttpServer()).post(`/workspaces/${WSID}/members`).send({ email: 'm@test.local', role: 'member' });
    expect(a.status).toBe(201);
    wsRemove.execute.mockResolvedValue(wsEntity());
    expect((await request(app.getHttpServer()).delete(`/workspaces/${WSID}/members/${UID}`)).status).toBe(200);
    wsTransfer.execute.mockResolvedValue(wsEntity());
    expect((await request(app.getHttpServer()).post(`/workspaces/${WSID}/transfer-owner`).send({ email: 'm@test.local', expectedVersion: 1 })).status).toBe(201);
    wsLeave.execute.mockResolvedValue({ left: true });
    expect((await request(app.getHttpServer()).post(`/workspaces/${WSID}/leave`)).status).toBe(201);
    wsDelete.execute.mockResolvedValue(true);
    const d = await request(app.getHttpServer()).delete(`/workspaces/${WSID}`);
    expect(d.status).toBe(204);
  });

  it('PROJ-01 tao + PROJ-02 list + PROJ-02b all + PROJ-03/04 + snapshot + 204', async () => {
    prjCreate.execute.mockResolvedValue(prjEntity());
    const c = await request(app.getHttpServer()).post(`/workspaces/${WSID}/projects`).send({ name: 'PRJ Mau' });
    expect(c.status).toBe(201);
    expect(c.body.data.project.name).toBe('PRJ Mau');
    prjListByWs.execute.mockResolvedValue({ items: [prjEntity()], meta: { nextCursor: null, hasMore: false, limit: 15 } });
    expect((await request(app.getHttpServer()).get(`/workspaces/${WSID}/projects`)).status).toBe(200);
    prjListAll.execute.mockResolvedValue({ items: [prjEntity()], meta: { nextCursor: null, hasMore: false, limit: 15 } });
    expect((await request(app.getHttpServer()).get('/projects')).status).toBe(200);
    prjGet.execute.mockResolvedValue(prjEntity());
    prjWsName.execute.mockResolvedValue('WS Mau');
    const g = await request(app.getHttpServer()).get(`/projects/${PRJID}`);
    expect(g.status).toBe(200);
    expect(g.body.data.project.workspaceName).toBe('WS Mau');
    prjUpdate.execute.mockResolvedValue(prjEntity());
    expect((await request(app.getHttpServer()).patch(`/projects/${PRJID}`).send({ name: 'PRJ Moi' })).status).toBe(200);
    prjSnap.execute.mockResolvedValue(true);
    expect((await request(app.getHttpServer()).put(`/projects/${PRJID}/snapshot`).send({ expectedVersion: 1 })).status).toBe(200);
    prjDelete.execute.mockResolvedValue(true);
    expect((await request(app.getHttpServer()).delete(`/projects/${PRJID}`)).status).toBe(204);
  });

  it('PROJ members: list/add/patch/remove/transfer', async () => {
    prjMembers.execute.mockResolvedValue({ items: [], meta: { nextCursor: null, hasMore: false } });
    expect((await request(app.getHttpServer()).get(`/projects/${PRJID}/members`)).status).toBe(200);
    prjAdd.execute.mockResolvedValue(prjEntity());
    expect((await request(app.getHttpServer()).post(`/projects/${PRJID}/members`).send({ email: 'm@test.local', role: 'viewer' })).status).toBe(201);
    prjRole.execute.mockResolvedValue(prjEntity());
    expect((await request(app.getHttpServer()).patch(`/projects/${PRJID}/members/${UID}`).send({ role: 'member', expectedVersion: 1 })).status).toBe(200);
    prjRemove.execute.mockResolvedValue(prjEntity());
    expect((await request(app.getHttpServer()).delete(`/projects/${PRJID}/members/${UID}`)).status).toBe(200);
    prjTransfer.execute.mockResolvedValue(prjEntity());
    expect((await request(app.getHttpServer()).post(`/projects/${PRJID}/transfer-owner`).send({ email: 'm@test.local', expectedVersion: 1 })).status).toBe(201);
  });
});
