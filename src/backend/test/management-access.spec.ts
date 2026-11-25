import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ManagementAccessGuard } from '../src/shared/guards/management-access.guard';
import { WORKSPACE_REPOSITORY_PORT } from '../src/modules/workspaces/domain/ports/workspace.repository.port';
import { PROJECT_REPOSITORY_PORT } from '../src/modules/projects/domain/ports/project.repository.port';

const workspace = { id: 'w', ownerId: 'wo', members: [{ userId: 'po', role: 'member' }, { userId: 'pm', role: 'member' }, { userId: 'viewer', role: 'member' }] };
const project = { id: 'p', workspaceId: 'w', members: [{ userId: 'po', role: 'owner' }, { userId: 'pm', role: 'member' }] };
const modules = { get: (token: symbol) => ({ findById: jest.fn().mockResolvedValue(token === WORKSPACE_REPOSITORY_PORT ? workspace : token === PROJECT_REPOSITORY_PORT ? project : { projectId: 'p' }) }) };
const guard = new ManagementAccessGuard(modules as never);
function access(controller: string, operation: string, userId: string, params: Record<string, string> = { id: 'p' }, role = 'analyst') {
  return guard.canActivate({ getClass: () => ({ name: controller }), getHandler: () => ({ name: operation }), switchToHttp: () => ({ getRequest: () => ({ user: { userId, role }, params }) }) } as unknown as ExecutionContext);
}
describe('manager resource authorization without workspace JWT claims', () => {
  it('allows an analyst to create/list their workspaces without a selected workspace', async () => {
    await expect(access('WorkspacesController', 'createWorkspace', 'new', {})).resolves.toBe(true);
    await expect(access('WorkspacesController', 'listWorkspaces', 'new', {})).resolves.toBe(true);
  });
  it.each(['getProjectById', 'listMembers'])('lets implicit workspace viewers %s', async operation => {
    await expect(access('ProjectsController', operation, 'viewer')).resolves.toBe(true);
  });
  it.each(['updateProject', 'addMember', 'updateMember', 'removeMember', 'transferOwner'])('only owners may %s', async operation => {
    await expect(access('ProjectsController', operation, 'po')).resolves.toBe(true);
    await expect(access('ProjectsController', operation, 'pm')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('only workspace owner may create or delete projects', async () => {
    await expect(access('ProjectsController', 'createProject', 'wo', { workspaceId: 'w' })).resolves.toBe(true);
    await expect(access('ProjectsController', 'deleteProject', 'po')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('upload requires owner while renaming columns permits a project member', async () => {
    await expect(access('DatasetsController', 'uploadDataset', 'po', { projectId: 'p' })).resolves.toBe(true);
    await expect(access('DatasetsController', 'uploadDataset', 'pm', { projectId: 'p' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(access('DatasetsController', 'renameColumns', 'pm')).resolves.toBe(true);
  });
  it('rejects outsiders, removed workspace members, system administrators and unknown actions', async () => {
    for (const user of ['outsider', 'removed']) await expect(access('ProjectsController', 'getProjectById', user)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(access('WorkspacesController', 'listWorkspaces', 'wo', {}, 'admin')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(access('ProjectsController', 'unknown', 'wo')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
