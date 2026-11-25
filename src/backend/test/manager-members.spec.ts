import { ForbiddenException } from '@nestjs/common';
import { WorkspacesService } from '../src/modules/workspaces/application/workspaces.service';
import { ProjectsService } from '../src/modules/projects/application/projects.service';

const id = '507f1f77bcf86cd799439011';
const owner = '507f1f77bcf86cd799439012';
const actor = { userId: owner, role: 'analyst' };
const user = { firstName: 'Tai', lastName: 'Nguyen', email: 'tai@example.com', passwordHash: 'private' };
describe('manager member profiles', () => {
  it('returns display fields only and refuses unrelated workspace users', async () => {
    const users = { findById: jest.fn().mockResolvedValue(user) };
    const repo = { findById: jest.fn().mockResolvedValue({ id, ownerId: owner, members: [{ userId: owner, role: 'owner' }] }) };
    const service = new WorkspacesService(repo as never, users as never);
    const result = await service.listMemberProfiles(id, actor);
    expect(result[0]).toEqual({ userId: owner, role: 'owner', name: 'Tai Nguyen', email: 'tai@example.com' });
    users.findById.mockClear();
    await expect(service.listMemberProfiles(id, { userId: 'outsider', role: 'analyst' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.findById).not.toHaveBeenCalled();
  });
  it('allows the workspace owner to manage project members, rejects outsiders', async () => {
    const users = { findById: jest.fn().mockResolvedValue(user) };
    const projects = { findById: jest.fn().mockResolvedValue({ id, workspaceId: id, members: [{ userId: owner, role: 'member' }] }) };
    const workspaces = { findById: jest.fn().mockResolvedValue({ ownerId: owner, members: [] }) };
    const service = new ProjectsService(projects as never, workspaces as never, users as never);
    expect((await service.listMemberProfiles(id, actor))[0]).not.toHaveProperty('passwordHash');
    await expect(service.listMemberProfiles(id, { userId: 'outsider', role: 'analyst' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
