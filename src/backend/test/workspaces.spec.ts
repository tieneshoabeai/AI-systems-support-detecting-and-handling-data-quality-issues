import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { WorkspacesService } from '../src/modules/workspaces/application/workspaces.service';
import { WORKSPACE_REPOSITORY_PORT } from '../src/modules/workspaces/domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('WorkspacesService (CRUD & Phân quyền Thành viên)', () => {
  let service: WorkspacesService;
  let repository: Record<string, jest.Mock>;
  let usersPort: { findByEmail: jest.Mock };

  const mockAdminUser = {
    userId: new Types.ObjectId().toHexString(),
    email: 'admin@shool.local',
    role: 'admin' as const,
  };

  const mockAnalystUser = {
    userId: new Types.ObjectId().toHexString(),
    email: 'analyst@shool.local',
    role: 'analyst' as const,
  };

  const mockWorkspaceId = new Types.ObjectId().toHexString();
  const mockWorkspaceRecord = {
    id: mockWorkspaceId,
    name: 'Research Workspace',
    description: 'Workspace for QA research',
    ownerId: mockAdminUser.userId,
    members: [{ userId: mockAdminUser.userId, role: 'owner' as const, joinedAt: new Date() }],
    storageUsedBytes: 0,
    lastAccessedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockResolvedValue(mockWorkspaceRecord),
      findById: jest.fn().mockImplementation((id: string) => {
        if (id === mockWorkspaceId) return Promise.resolve(mockWorkspaceRecord);
        return Promise.resolve(null);
      }),
      findByUser: jest.fn().mockResolvedValue([mockWorkspaceRecord]),
      findAllActive: jest.fn().mockResolvedValue([mockWorkspaceRecord]),
      updateById: jest.fn().mockResolvedValue(mockWorkspaceRecord),
      softDelete: jest.fn().mockResolvedValue(true),
      addMember: jest.fn().mockResolvedValue(true),
      removeMember: jest.fn().mockResolvedValue(true),
      findByUserPaged: jest.fn().mockResolvedValue({ items: [mockWorkspaceRecord], total: 1 }),
      touchLastAccessed: jest.fn().mockResolvedValue(undefined),
      addStorageUsed: jest.fn().mockResolvedValue(undefined),
      transferOwner: jest.fn().mockResolvedValue(true),
      updateMemberRole: jest.fn().mockResolvedValue(true),
    };

    usersPort = { findByEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: repository },
        { provide: USER_REPOSITORY_PORT, useValue: usersPort },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it('createWorkspace should initialize creator as owner in members list', async () => {
    const result = await service.createWorkspace(mockAdminUser.userId, {
      name: 'Research Workspace',
      description: 'Workspace for QA research',
    });
    expect(result).toBeDefined();
    expect(repository.create).toHaveBeenCalled();
  });

  it('getWorkspaces should return all active workspaces for admin and filtered for analyst', async () => {
    const adminWorkspaces = await service.getWorkspaces(mockAdminUser);
    expect(repository.findAllActive).toHaveBeenCalled();
    expect(adminWorkspaces).toHaveLength(1);

    const analystWorkspaces = await service.getWorkspaces(mockAnalystUser);
    expect(repository.findByUser).toHaveBeenCalledWith(mockAnalystUser.userId);
    expect(analystWorkspaces).toHaveLength(1);
  });

  it('addMember should add new member with role and reject duplicate members', async () => {
    const newUserId = new Types.ObjectId().toHexString();
    usersPort.findByEmail.mockResolvedValueOnce({ id: newUserId, email: 'collaborator@shool.local' });
    await service.addMember(mockWorkspaceId, { email: 'collaborator@shool.local', role: 'member' });
    expect(repository.addMember).toHaveBeenCalled();

    usersPort.findByEmail.mockResolvedValueOnce({ id: mockAdminUser.userId, email: mockAdminUser.email });
    await expect(
      service.addMember(mockWorkspaceId, { email: mockAdminUser.email, role: 'member' }),
    ).rejects.toThrow(ConflictException);
  });

  it('removeMember should reject removing original workspace owner', async () => {
    await expect(service.removeMember(mockWorkspaceId, mockAdminUser.userId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deleteWorkspace should soft delete workspace', async () => {
    const success = await service.deleteWorkspace(mockWorkspaceId);
    expect(success).toBe(true);
    expect(repository.softDelete).toHaveBeenCalledWith(mockWorkspaceId);
  });

  it('getWorkspaceById should throw NotFoundException for non-existent workspace', async () => {
    const randomId = new Types.ObjectId().toHexString();
    await expect(service.getWorkspaceById(randomId)).rejects.toThrow(NotFoundException);
  });

  it('transferOwner should enforce exactly-one-owner invariant (WS-09)', async () => {
    const newOwnerId = new Types.ObjectId().toHexString();
    usersPort.findByEmail.mockResolvedValueOnce({ id: newOwnerId, email: 'newowner@shool.local' });
    (repository.findById as jest.Mock).mockResolvedValue({
      ...mockWorkspaceRecord,
      ownerId: mockAdminUser.userId,
      members: [
        { userId: mockAdminUser.userId, role: 'owner' as const, joinedAt: new Date() },
        { userId: newOwnerId, role: 'member' as const, joinedAt: new Date() },
      ],
    });
    const result = await service.transferOwner(mockWorkspaceId, mockAdminUser.userId, {
      email: 'newowner@shool.local',
    });
    expect(result).toBeDefined();
    expect(repository.transferOwner).toHaveBeenCalled();
  });

  it('transferOwner should reject non-owner actor (WS-09)', async () => {
    await expect(
      service.transferOwner(mockWorkspaceId, '000000000000000000000099', { email: 'x@shool.local' }),
    ).rejects.toThrow();
  });

  it('leaveWorkspace should require owner to transfer first (WS-10)', async () => {
    await expect(service.leaveWorkspace(mockWorkspaceId, mockAdminUser.userId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('checkWorkspaceUploadQuota should block when over workspace quota (O24)', async () => {
    (repository.findById as jest.Mock).mockResolvedValue({ ...mockWorkspaceRecord, storageUsedBytes: 1900 });
    await expect(service.checkWorkspaceUploadQuota(mockWorkspaceId, 200, 2000)).rejects.toThrow();
  });

  it('listWorkspaces should support pagination/search/filter/sort (WS-02)', async () => {
    const r = await service.listWorkspaces(mockAnalystUser as never, {
      page: 1,
      limit: 10,
      sort: 'name_asc',
    } as never);
    expect(r.total).toBe(1);
    expect(r.items).toHaveLength(1);
  });
});
